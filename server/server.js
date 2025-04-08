// server/server.js

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import * as Config from './config.js'; // Import server-side config

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Directory of server.js
const projectRoot = path.join(__dirname, '..'); // Go up one level to project root

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = process.env.PORT || 3000;

// --- Game Constants ---
const TICK_RATE = 20; // Updates per second
const TICK_INTERVAL_MS = 1000 / TICK_RATE;
let lastTickTime = Date.now();
let simulationInterval = null; // To hold the interval ID

// --- Game State ---
let globalGameState = {
    day: 1,
    timeInCycle: 0.0,
    currentPeriodIndex: -1, // -1: Initial/Night, 0-2: Day periods
    isNight: false,
    currentLightMultiplier: Config.LIGHT_MULT_SUNNY, // Initial assumption
    currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false,
    gamePhase: 'lobby', // 'lobby', 'countdown', 'playing', 'ended'
    // Add other global state as needed
};

// Store players: { socketId: playerData }
// playerData structure will evolve
let players = {};
function initializePlayerState(socketId) {
    const initialLA = Config.INITIAL_LEAF_AREA;
    const maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * initialLA;
    return {
        id: socketId,
        // --- Player Attributes ---
        playerName: `Player_${socketId.substring(0, 4)}`, // Default name
        leafColor: '#228B22', // Default color (client can override later)
        trunkColor: '#8B4513', // Default color
        spawnPoint: { x: 0, y: Config.ISLAND_LEVEL, z: 0 }, // Default spawn (will be chosen later)
        isAlive: false, // Becomes true when game starts

        // --- Core Resources ---
        carbonStorage: Config.INITIAL_CARBON,
        hydraulicSafety: Math.min(Config.INITIAL_HYDRAULICS, maxHydraulic), // Clamp initial
        maxHydraulic: maxHydraulic,

        // --- Size & Structure ---
        currentLA: initialLA,
        effectiveLA: initialLA, // Start undamaged
        trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        trunkWidth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO), // Calculate initial derived
        trunkDepth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO),

        // --- Status & Outputs ---
        seedCount: 0,
        damagedLAPercentage: 0,

        // --- Player Inputs (Server authoritative state) ---
        stomatalConductance: 0.5, // Default
        lastSavingsPercent: 50,   // Default
        lastGrowthRatioPercent: 50, // Default

        // --- Internal Simulation State ---
        foliarUptakeAppliedThisNight: false,
        growthAppliedThisCycle: false,
    };
}

// --- Serve Static Files & Routes (Keep as before) ---
console.log(`Serving static files from: ${projectRoot}`);
app.use(express.static(projectRoot));
app.get('/', (req, res) => { res.sendFile(path.join(projectRoot, 'index.html')); });
app.get('/game', (req, res) => { res.sendFile(path.join(projectRoot, 'game.html')); });
app.get('/settings', (req, res) => { res.sendFile(path.join(projectRoot, 'settings.html')); });
// Add /admin route later

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    players[socket.id] = initializePlayerState(socket.id);
    console.log("Current players:", Object.keys(players).length);

    // Send initial full game state to the new player (lobby state for now)
    socket.emit('gameStateUpdate', getFullGameStateSnapshot());

    // Inform others (optional for lobby)
    // socket.broadcast.emit('playerConnected', players[socket.id]);

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        console.log("Current players:", Object.keys(players).length);
        // Inform others
        io.emit('playerDisconnected', socket.id); // Broadcast the ID of the disconnected player
        // Stop simulation if no players left? (Handle later in game flow)
    });

    // Add input listeners later...
});

// --- Server-Side Simulation Loop ---

function updateGame() {
    const now = Date.now();
    const deltaTime = (now - lastTickTime) / 1000.0; // Delta time in seconds
    lastTickTime = now;

    // Only run simulation if in 'playing' phase
    if (globalGameState.gamePhase !== 'playing') {
        // We might still want to update countdown timer here later
        return;
    }

    // --- 1. Update Global Time ---
    globalGameState.timeInCycle += deltaTime;

    // --- 2. Handle Cycle Transitions & Weather ---
    let enteringNewDay = false;
    if (globalGameState.timeInCycle >= Config.TOTAL_CYCLE_DURATION) {
        enteringNewDay = true;
        globalGameState.day++;
        globalGameState.timeInCycle -= Config.TOTAL_CYCLE_DURATION;
        globalGameState.currentPeriodIndex = 0;
        globalGameState.isNight = false;
        // Reset per-cycle flags for all players
        Object.values(players).forEach(p => {
             p.growthAppliedThisCycle = false;
        });
        console.log(`SERVER: --- START DAY ${globalGameState.day} ---`);
        // TODO: Reset previousPeriodIndex logic if needed here or rely on change detection below
    }

    // Determine current logical period index and night status
    let calculatedPeriodIndex;
    if (globalGameState.timeInCycle < Config.DAY_TOTAL_DURATION) {
        calculatedPeriodIndex = Math.floor(globalGameState.timeInCycle / Config.PERIOD_DURATION);
        globalGameState.isNight = false;
    } else {
        calculatedPeriodIndex = -1; // Night
        globalGameState.isNight = true;
    }

    // Check for Period/Phase Transitions & Generate Weather
    const periodChanged = calculatedPeriodIndex !== globalGameState.currentPeriodIndex || enteringNewDay;
    if (periodChanged) {
        const oldPeriodIndex = globalGameState.currentPeriodIndex; // Store previous index
        globalGameState.currentPeriodIndex = calculatedPeriodIndex;

        if (!globalGameState.isNight) {
            // New Daytime Period
            const isCloudy = generatePeriodWeather(); // Updates globalGameState directly
            globalGameState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
            console.log(`SERVER: Entering Day Period ${globalGameState.currentPeriodIndex}: Light=${globalGameState.currentLightMultiplier.toFixed(2)}, Drought=${globalGameState.currentDroughtFactor.toFixed(2)}, Raining=${globalGameState.isRaining}`);
        } else {
            // Entering Nighttime
            if (oldPeriodIndex !== -1) { // Only generate weather once when entering night
                generateNightWeather(); // Updates globalGameState directly
                // Reset foliar uptake flags for all players
                Object.values(players).forEach(p => { p.foliarUptakeAppliedThisNight = false; });
                console.log(`SERVER: Entering Night: Raining=${globalGameState.isRaining}`);
            }
        }
        // Note: Visual transitions (lerping) happen client-side based on this state
    }


    // --- 3. Update Each Player's State ---
    Object.values(players).forEach(playerState => {
        if (!playerState.isAlive) return; // Skip dead players

        const stomata = playerState.stomatalConductance;
        const effLA = Math.max(0, playerState.effectiveLA);
        const currentLA = Math.max(0, playerState.currentLA);
        const trunkVolume = Math.max(0, playerState.trunkWidth * playerState.trunkDepth * playerState.trunkHeight);

        // Photosynthesis (Day Only)
        let potentialCarbonGain = 0;
        if (!globalGameState.isNight) {
            potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * globalGameState.currentLightMultiplier;
        }

        // Respiration
        const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

        // Hydraulics
        const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * globalGameState.currentDroughtFactor;
        let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE;
        if (globalGameState.isRaining) {
            currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT;
        }
        const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss;
        playerState.hydraulicSafety += hydraulicChange * deltaTime;

        // Apply Carbon Changes
        const potentialGainThisStep = potentialCarbonGain * deltaTime;
        const respirationLossThisStep = respirationLoss * deltaTime;
        const currentStorage = playerState.carbonStorage;
        const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
        const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);
        playerState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;

        // Clamp Values
        playerState.carbonStorage = Math.max(0, playerState.carbonStorage);
        playerState.hydraulicSafety = Math.max(0, Math.min(playerState.maxHydraulic, playerState.hydraulicSafety));

        // Crown Dieback / Damage
        if (playerState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
            const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
            playerState.damagedLAPercentage = Math.min(1, playerState.damagedLAPercentage + damageIncrease);
            playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage);
            // Note: Visual update happens client-side based on this percentage
        }

        // Night Events
        if (globalGameState.isNight) {
            // Foliar Uptake
            if (globalGameState.isRaining && !playerState.foliarUptakeAppliedThisNight) {
                const boostAmount = Config.NIGHT_RAIN_HYDRAULIC_BOOST;
                playerState.hydraulicSafety = Math.min(playerState.hydraulicSafety + boostAmount, playerState.maxHydraulic);
                playerState.foliarUptakeAppliedThisNight = true;
                // console.log(`SERVER: Foliar Boost for ${playerState.id}`);
            }

            // Growth Allocation Trigger
            const timeIntoNight = globalGameState.timeInCycle - Config.DAY_TOTAL_DURATION;
            if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !playerState.growthAppliedThisCycle) {
                 console.log(`SERVER: Triggering growth for ${playerState.id}`);
                 applyAllocation(playerState); // Apply growth based on player's state
                 playerState.growthAppliedThisCycle = true;
            }
        }

        // Check Game Over Conditions for this player
        if ((playerState.carbonStorage <= 0 || playerState.hydraulicSafety <= 0) && playerState.isAlive) {
            console.log(`SERVER: Player ${playerState.id} died. Carbon: ${playerState.carbonStorage.toFixed(1)}, Hydraulics: ${playerState.hydraulicSafety.toFixed(1)}`);
            playerState.isAlive = false;
            // TODO: Check if this was the last player alive to end the game
        }
    });

    // --- 4. Broadcast Game State ---
    // Send a snapshot of the relevant state to all clients
    io.emit('gameStateUpdate', getSimplifiedGameStateSnapshot()); // Use simplified snapshot for regular updates
}

// --- Simulation Helper Functions (Adapted from client simulation.js) ---

function generatePeriodWeather() {
    const isSunny = Math.random() < Config.SUNNY_PROB;
    const isCloudy = !isSunny;
    globalGameState.currentLightMultiplier = isCloudy ? Config.LIGHT_MULT_CLOUDY : Config.LIGHT_MULT_SUNNY;
    const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION;
    globalGameState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation);
    // Rain is set separately after checking cloudiness
    return isCloudy; // Return cloudiness status for rain check
}

function generateNightWeather() {
    const isConceptuallyCloudy = Math.random() >= Config.SUNNY_PROB;
    globalGameState.isRaining = isConceptuallyCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
    globalGameState.currentLightMultiplier = 0; // No light at night
    globalGameState.currentDroughtFactor = Config.DROUGHT_MULT_BASE; // Assume base drought at night? Or lower? TBD.
}

function applyAllocation(playerState) {
    const available = Math.floor(playerState.carbonStorage);
    if (available <= 0) return; // Cannot allocate if no carbon

    const savingsPercent = Math.max(0, Math.min(100, playerState.lastSavingsPercent));
    const growthRatioPercent = Math.max(0, Math.min(100, playerState.lastGrowthRatioPercent));

    const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100));
    const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
    const seedsToMake = Math.floor(carbonForSeeds / Config.SEED_COST); // Ensure integer seeds
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST; // Actual cost based on integer seeds

    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    // Sanity check
    if (totalSpent > available + 0.01 || totalSpent < 0) {
        console.error(`SERVER ALLOCATION ERROR for ${playerState.id}: Invalid spend (${totalSpent}) vs available (${available}). Skipping.`);
        return;
    }

    playerState.carbonStorage -= totalSpent;
    playerState.seedCount += seedsToMake;

    if (actualCarbonForGrowth > 0) {
        // Apply growth logic (updates playerState directly)
        const currentTrunkVolume = (playerState.trunkWidth || 0.1) * (playerState.trunkDepth || 0.1) * (playerState.trunkHeight || 0.1);
        const currentBiomassEstimate = Math.max(1, playerState.currentLA + currentTrunkVolume);
        const biomassToAdd = actualCarbonForGrowth / Config.GROWTH_COST_PER_LA;
        const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

        playerState.currentLA *= growthFactor;
        playerState.trunkHeight *= growthFactor;
        // Recalculate derived values
        playerState.trunkWidth = Math.sqrt(playerState.currentLA * Config.k_TA_LA_RATIO);
        playerState.trunkDepth = playerState.trunkWidth;
        playerState.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * playerState.currentLA;
        playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage); // Update effective LA after growth

         // console.log(`SERVER: Growth applied for ${playerState.id}. New LA: ${playerState.currentLA.toFixed(1)}, H: ${playerState.trunkHeight.toFixed(1)}`);
    }
}

// --- State Snapshot Functions ---

// Creates a lightweight snapshot for frequent updates
function getSimplifiedGameStateSnapshot() {
    // Extract only the necessary data for each player
    const playersSnapshot = {};
    Object.values(players).forEach(p => {
        playersSnapshot[p.id] = {
            id: p.id,
            playerName: p.playerName,
            isAlive: p.isAlive,
            // Resources (send percentage or value?) Value might be better for bars.
            carbonStorage: p.carbonStorage,
            hydraulicSafety: p.hydraulicSafety,
            maxHydraulic: p.maxHydraulic, // Needed to calculate % on client
            // Visual state
            currentLA: p.currentLA, // Needed for scaling
            trunkHeight: p.trunkHeight,
            damagedLAPercentage: p.damagedLAPercentage,
            // Score
            seedCount: p.seedCount,
            // Add position later when spawning is implemented
            // position: p.spawnPoint
        };
    });

    return {
        // Global environment
        day: globalGameState.day,
        timeInCycle: globalGameState.timeInCycle,
        currentPeriodIndex: globalGameState.currentPeriodIndex,
        isNight: globalGameState.isNight,
        currentLightMultiplier: globalGameState.currentLightMultiplier,
        currentDroughtFactor: globalGameState.currentDroughtFactor,
        isRaining: globalGameState.isRaining,
        // Game Phase
        gamePhase: globalGameState.gamePhase,
        // Player states
        players: playersSnapshot,
        // Timestamp for debugging/lag comp later?
        serverTime: Date.now()
    };
}

// Creates a full snapshot (e.g., for initial connection)
function getFullGameStateSnapshot() {
    // For now, it's the same as the simplified one, but could include more later
    return getSimplifiedGameStateSnapshot();
}


// --- Game Control Functions ---
function startGameSimulation() {
    if (simulationInterval) {
        console.log("SERVER: Simulation already running.");
        return;
    }
    console.log("SERVER: Starting simulation loop.");
    lastTickTime = Date.now(); // Reset start time
    simulationInterval = setInterval(updateGame, TICK_INTERVAL_MS);
}

function stopGameSimulation() {
    if (simulationInterval) {
        console.log("SERVER: Stopping simulation loop.");
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
}

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Don't start the simulation immediately, wait for lobby/start logic
    // startGameSimulation();
});

// Example: Start game manually for testing (replace with lobby logic later)
// setTimeout(() => {
//     console.log("SERVER: Manually starting game for testing...");
//     globalGameState.gamePhase = 'playing';
//     // Mark all connected players as alive and give them a default spawn
//     Object.values(players).forEach(p => {
//          p.isAlive = true;
//          p.spawnPoint = { x: Math.random() * 10 - 5, y: Config.ISLAND_LEVEL, z: Math.random() * 10 - 5 }; // Random spawn for testing
//     });
//     startGameSimulation();
// }, 5000); // Start after 5 seconds