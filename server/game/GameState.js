// server/game/GameState.js
import * as Config from '../config.js'; // Use server config

// --- Core State Variables ---
let globalGameState = {
    day: 1,
    timeInCycle: 0.0,
    currentPeriodIndex: -1, // -1: Initial/Night, 0-2: Day periods
    isNight: false,
    currentLightMultiplier: Config.LIGHT_MULT_SUNNY, // Initial assumption
    currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false,
    gamePhase: 'lobby', // 'lobby', 'countdown', 'playing', 'ended'
    countdownTimer: null, // Holds remaining countdown seconds, or null
};
let players = {}; // { socketId: playerData }

// --- State Management Functions ---

/** Creates initial state for a new player. */
function initializePlayerState(socketId) {
    const initialLA = Config.INITIAL_LEAF_AREA;
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
    const maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * initialLA;
    return {
        id: socketId,
        // --- Attributes ---
        playerName: `Player_${socketId.substring(0, 4)}`,
        leafColor: '#228B22', trunkColor: '#8B4513',
        spawnPoint: { x: 0, y: baseHeight, z: 0 }, // Default, updated later
        isAlive: false, // Starts not alive
        hasChosenSpawn: false,
        isSpectator: false, // Defaults to false
        // --- Resources ---
        carbonStorage: Config.INITIAL_CARBON, hydraulicSafety: Math.min(Config.INITIAL_HYDRAULICS, maxHydraulic), maxHydraulic: maxHydraulic,
        // --- Size & Structure ---
        currentLA: initialLA, effectiveLA: initialLA, trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        trunkWidth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO), trunkDepth: Math.sqrt(initialLA * Config.k_TA_LA_RATIO),
        // --- Status & Output ---
        seedCount: 0, damagedLAPercentage: 0,
        // --- Inputs (Server authoritative) ---
        stomatalConductance: 0.5, lastSavingsPercent: 50, lastGrowthRatioPercent: 50,
        // --- Internal Sim State ---
        foliarUptakeAppliedThisNight: false, growthAppliedThisCycle: false,
    };
}

/** Adds a new player to the state. */
export function addPlayer(socketId) {
    if (!players[socketId]) {
        players[socketId] = initializePlayerState(socketId);
        console.log(`GameState: Added player ${socketId}. Total: ${Object.keys(players).length}`);
    } else {
        console.warn(`GameState: Player ${socketId} already exists.`);
    }
}

/** Removes a player from the state. */
export function removePlayer(socketId) {
    if (players[socketId]) {
        delete players[socketId];
        console.log(`GameState: Removed player ${socketId}. Remaining: ${Object.keys(players).length}`);
        return true;
    }
    return false;
}

/** Retrieves state for a specific player. */
export function getPlayerState(socketId) {
    return players[socketId] || null;
}

/** Retrieves the entire players object. */
export function getAllPlayers() {
    return players;
}

/** Retrieves the global game state object. */
export function getGlobalState() {
    return globalGameState;
}

/** Updates specific properties of the global state. */
export function updateGlobalState(updates) {
     Object.assign(globalGameState, updates);
}

/** Sets the current game phase. */
export function setGamePhase(phase) {
    if (['lobby', 'countdown', 'playing', 'ended'].includes(phase)) {
        if (globalGameState.gamePhase !== phase) {
             console.log(`GameState: Changing phase from ${globalGameState.gamePhase} to ${phase}`);
             globalGameState.gamePhase = phase;
             if (phase !== 'countdown') globalGameState.countdownTimer = null; // Reset timer unless entering countdown
        }
    } else { console.error(`GameState: Invalid phase: ${phase}`); }
}

/** Resets global state variables to defaults. */
export function resetGlobalStateValues() {
     console.log("GameState: Resetting global values...");
     Object.assign(globalGameState, {
        day: 1, timeInCycle: 0.0, currentPeriodIndex: -1, isNight: false,
        currentLightMultiplier: Config.LIGHT_MULT_SUNNY, currentDroughtFactor: Config.DROUGHT_MULT_BASE,
        isRaining: false, gamePhase: 'lobby', countdownTimer: null
     });
}