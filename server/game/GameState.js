// server/game/GameState.js
import * as Config from '../config.js'; // Use server config

// --- Core State Variables ---

// Holds state applicable to the entire game session
let globalGameState = {
    day: 1,
    timeInCycle: 0.0,
    currentPeriodIndex: -1, // -1: Initial/Night, 0-2: Day periods
    isNight: false,
    currentLightMultiplier: Config.LIGHT_MULT_SUNNY, // Initial assumption
    currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false,
    gamePhase: 'lobby', // 'lobby', 'countdown', 'playing', 'ended'
};

// Stores state for each connected player, keyed by socket.id
let players = {}; // { socketId: playerData }

// --- State Management Functions ---

/**
 * Creates the initial state object for a new player.
 * @param {string} socketId - The socket ID of the player.
 * @returns {object} Initial player state data.
 */
function initializePlayerState(socketId) {
    const initialLA = Config.INITIAL_LEAF_AREA;
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
    const maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * initialLA;
    return {
        id: socketId,
        // --- Attributes ---
        playerName: `Player_${socketId.substring(0, 4)}`,
        leafColor: '#228B22', // Defaults, can be updated later
        trunkColor: '#8B4513',
        spawnPoint: { x: 0, y: baseHeight, z: 0 }, // Default, updated on join/spawn selection
        isAlive: false, // Set true when game starts for player
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

/**
 * Adds a new player to the state upon connection.
 * @param {string} socketId - The socket ID of the connecting player.
 */
export function addPlayer(socketId) {
    if (!players[socketId]) {
        players[socketId] = initializePlayerState(socketId);
        console.log(`GameState: Added player ${socketId}. Total: ${Object.keys(players).length}`);
    } else {
        console.warn(`GameState: Player ${socketId} already exists.`);
    }
}

/**
 * Removes a player from the state upon disconnection.
 * @param {string} socketId - The socket ID of the disconnecting player.
 * @returns {boolean} True if the player existed and was removed, false otherwise.
 */
export function removePlayer(socketId) {
    if (players[socketId]) {
        delete players[socketId];
        console.log(`GameState: Removed player ${socketId}. Remaining: ${Object.keys(players).length}`);
        return true;
    }
    return false;
}

/**
 * Retrieves the state object for a specific player.
 * @param {string} socketId - The socket ID of the player.
 * @returns {object | null} The player's state object or null if not found.
 */
export function getPlayerState(socketId) {
    return players[socketId] || null;
}

/**
 * Retrieves the entire players object.
 * Use cautiously, prefer specific getters if possible.
 * @returns {object} The players state object.
 */
export function getAllPlayers() {
    return players;
}

/**
 * Retrieves the global game state object.
 * Use cautiously, prefer specific getters if possible.
 * @returns {object} The global game state object.
 */
export function getGlobalState() {
    return globalGameState;
}

/**
 * Sets the current game phase.
 * @param {'lobby' | 'countdown' | 'playing' | 'ended'} phase - The new phase.
 */
export function setGamePhase(phase) {
    if (['lobby', 'countdown', 'playing', 'ended'].includes(phase)) {
        if (globalGameState.gamePhase !== phase) {
             console.log(`GameState: Changing phase from ${globalGameState.gamePhase} to ${phase}`);
             globalGameState.gamePhase = phase;
        }
    } else {
        console.error(`GameState: Invalid game phase specified: ${phase}`);
    }
}

/**
 * Resets the global game state variables to their initial values.
 * Does NOT clear the players object.
 */
export function resetGlobalStateValues() {
     console.log("GameState: Resetting global state values...");
     globalGameState.day = 1;
     globalGameState.timeInCycle = 0.0;
     globalGameState.currentPeriodIndex = -1;
     globalGameState.isNight = false;
     globalGameState.currentLightMultiplier = Config.LIGHT_MULT_SUNNY;
     globalGameState.currentDroughtFactor = Config.DROUGHT_MULT_BASE;
     globalGameState.isRaining = false;
     globalGameState.gamePhase = 'lobby'; // Default reset phase
}

// Export the state objects directly ONLY if modules absolutely need mutable access.
// Prefer exporting getter functions. We export getters and setters above.
// export { globalGameState, players };