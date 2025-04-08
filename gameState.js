// gameState.js
import * as Config from './config.js'; // Keep config for defaults if needed momentarily

// The main state object. Will be populated primarily by server updates.
export const gameState = {
    // --- Server Synced State (Defaults for initial load) ---
    day: 1,
    timeInCycle: 0.0,
    currentPeriodIndex: -1,
    isNight: false,
    currentLightMultiplier: 1.0,
    currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false,
    gamePhase: 'loading', // Start in a 'loading' phase until server confirms
    players: {}, // Stores player state keyed by ID: { id: { ...playerData } }
    serverTime: Date.now(),

    // --- Client-Specific State ---
    // Local player's ID (set on connection)
    myId: null,
    // Spectator status (set on connection/load)
    isSpectator: false, // TODO: Implement spectator joining logic
    // Game over state (set by server 'gameOver' event)
    gameOver: false,
    gameOverReason: '',
    winnerId: null, // ID of the winner

    // --- Old Local State (To be removed or carefully managed) ---
    // These values will now come from the 'players' object above, indexed by myId
    // carbonStorage: Config.INITIAL_CARBON,
    // hydraulicSafety: Config.INITIAL_HYDRAULICS,
    // currentLA: Config.INITIAL_LEAF_AREA,
    // effectiveLA: Config.INITIAL_LEAF_AREA,
    // trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
    // seedCount: 0,
    // stomatalConductance: 0.5, // Input state, sent to server
    // damagedLAPercentage: 0,
    // playerName: 'Treebard', // Loaded from localStorage, sent to server on join?
    // leafColor: Config.DEFAULT_LEAF_COLOR,
    // trunkColor: Config.DEFAULT_TRUNK_COLOR,
    // lastSavingsPercent: 50, // Input state, sent to server
    // lastGrowthRatioPercent: 50, // Input state, sent to server
    // maxHydraulic: 0,

    // Tree object references (Client-side rendering objects)
    // We need a way to map player IDs to their tree meshes
    playerTrees: new Map(), // Map<playerId, THREE.Group>

    // Flag to indicate if the initial state has been received
    initialStateReceived: false,
};

// We no longer initialize the full state here.
// Server will send the authoritative state.
// We might load local settings like name/color here later.
export function loadClientSettings() {
    // Placeholder for loading player name/color prefs later
    // const savedName = localStorage.getItem('playerName') || 'Treebard';
    // const savedLeafColor = localStorage.getItem('leafColor') || Config.DEFAULT_LEAF_COLOR;
    // const savedTrunkColor = localStorage.getItem('trunkColor') || Config.DEFAULT_TRUNK_COLOR;
    // gameState.playerName = savedName;
    // gameState.leafColor = savedLeafColor;
    // gameState.trunkColor = savedTrunkColor;
    console.log("Client settings loaded (placeholder).");
}

// Call settings load immediately (can be done in main.js too)
loadClientSettings();

// Helper function to get the local player's state object
export function getMyPlayerState() {
    if (!gameState.myId || !gameState.players[gameState.myId]) {
        return null; // Not connected or state not received yet
    }
    return gameState.players[gameState.myId];
}