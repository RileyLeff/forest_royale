import * as Config from './config.js';
import { calculateDimensions } from './tree.js'; // Need this for initialization

// The single source of truth for the game's state
export const gameState = {};

// Initializes or resets the game state object
export function initializeGameState() {
    // Using Object.assign to clear and reset properties
    Object.assign(gameState, {
        carbonStorage: Config.INITIAL_CARBON,
        hydraulicSafety: Config.INITIAL_HYDRAULICS,
        currentLA: Config.INITIAL_LEAF_AREA,
        effectiveLA: Config.INITIAL_LEAF_AREA, // Start with full effectiveness
        trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        seedCount: 0,
        stomatalConductance: 0.5, // Default starting value
        day: 1,
        timeOfDay: 'day', // 'day' or 'night'
        timeInCycle: 0,   // Seconds elapsed in current day/night phase
        droughtFactor: 1.0, // Environmental factor affecting transpiration
        isPaused: false,    // For allocation modal/phase
        gameOver: false,
        gameOverReason: '', // Store the reason for game over
        treeMeshGroup: null,// Reference to the THREE.Group for the tree
        damagedLAPercentage: 0, // Tracks canopy health (0 to 1)
        // Colors
        leafColor: Config.DEFAULT_LEAF_COLOR,
        trunkColor: Config.DEFAULT_TRUNK_COLOR,
        // Allocation Timer
        allocationTimerId: null,
        // Derived dimensions (calculated after basic state is set)
        trunkWidth: 0,
        trunkDepth: 0,
        canopyWidth: 0,
        canopyDepth: 0,
    });

    // Calculate initial dimensions based on the reset state
    calculateDimensions(gameState); // Updates gameState directly
}

// Example of a specific state modifier (optional, could just modify gameState directly)
// export function setGameOver(reason) {
//     gameState.gameOver = true;
//     gameState.gameOverReason = reason;
//     gameState.isPaused = true; // Often want to pause on game over
// }

// Call initialize once on load to ensure gameState object exists
initializeGameState();