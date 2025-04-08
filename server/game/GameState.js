// server/game/GameState.js
import * as Config from '../config.js'; // Use server config

// --- Core State Variables ---

let globalGameState = {
    day: 1,
    timeInCycle: 0.0,
    currentPeriodIndex: -1,
    isNight: false,
    currentLightMultiplier: Config.LIGHT_MULT_SUNNY,
    currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false,
    gamePhase: 'lobby', // 'lobby', 'countdown', 'playing', 'ended'
    countdownTimer: null, // Added: Holds remaining countdown seconds, or null
};

let players = {}; // { socketId: playerData }

// --- State Management Functions ---

function initializePlayerState(socketId) {
    const initialLA = Config.INITIAL_LEAF_AREA;
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
    const maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * initialLA;
    return {
        id: socketId,
        // --- Attributes ---
        playerName: `Player_${socketId.substring(0, 4)}`,
        leafColor: '#228B22',
        trunkColor: '#8B4513',
        spawnPoint: { x: 0, y: baseHeight, z: 0 }, // Default, updated later
        isAlive: false,
        hasChosenSpawn: false, // Added: Tracks if player selected a spawn point
        // --- Resources ---
        carbonStorage: Config.INITIAL_CARBON,
        hydraulicSafety: Math.min(Config.INITIAL_HYDRAULICS, maxHydraulic),
        maxHydraulic: maxHydraulic,
        // --- Size & Structure ---
        currentLA: initialLA,
        effectiveLA: initialLA,
        trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        trunkWidth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO),
        trunkDepth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO),
        // --- Status & Output ---
        seedCount: 0,
        damagedLAPercentage: 0,
        // --- Inputs (Server authoritative) ---
        stomatalConductance: 0.5,
        lastSavingsPercent: 50,
        lastGrowthRatioPercent: 50,
        // --- Internal Sim State ---
        foliarUptakeAppliedThisNight: false,
        growthAppliedThisCycle: false,
    };
}

export function addPlayer(socketId) {
    if (!players[socketId]) {
        players[socketId] = initializePlayerState(socketId);
        console.log(`GameState: Added player ${socketId}. Total: ${Object.keys(players).length}`);
    } else {
        console.warn(`GameState: Player ${socketId} already exists.`);
    }
}

export function removePlayer(socketId) {
    if (players[socketId]) {
        delete players[socketId];
        console.log(`GameState: Removed player ${socketId}. Remaining: ${Object.keys(players).length}`);
        return true;
    }
    return false;
}

export function getPlayerState(socketId) {
    return players[socketId] || null;
}

export function getAllPlayers() {
    return players;
}

export function getGlobalState() {
    return globalGameState;
}

/**
 * Updates specific properties of the global state.
 * @param {object} updates - An object containing key-value pairs to update.
 */
export function updateGlobalState(updates) {
     Object.assign(globalGameState, updates);
     // Example: updateGlobalState({ countdownTimer: 29, gamePhase: 'countdown' })
}

export function setGamePhase(phase) {
    if (['lobby', 'countdown', 'playing', 'ended'].includes(phase)) {
        if (globalGameState.gamePhase !== phase) {
             console.log(`GameState: Changing phase from ${globalGameState.gamePhase} to ${phase}`);
             globalGameState.gamePhase = phase;
             // Reset countdown timer when leaving countdown phase
             if (phase !== 'countdown') {
                 globalGameState.countdownTimer = null;
             }
        }
    } else {
        console.error(`GameState: Invalid game phase specified: ${phase}`);
    }
}


export function resetGlobalStateValues() {
     console.log("GameState: Resetting global state values...");
     globalGameState.day = 1;
     globalGameState.timeInCycle = 0.0;
     globalGameState.currentPeriodIndex = -1;
     globalGameState.isNight = false;
     globalGameState.currentLightMultiplier = Config.LIGHT_MULT_SUNNY;
     globalGameState.currentDroughtFactor = Config.DROUGHT_MULT_BASE;
     globalGameState.isRaining = false;
     globalGameState.gamePhase = 'lobby';
     globalGameState.countdownTimer = null; // Ensure timer is reset
}