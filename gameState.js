import * as Config from './config.js';

export const gameState = {};

export function initializeGameState() {
    // Load settings from localStorage or use defaults
    const savedName = localStorage.getItem('playerName') || 'Treebard';
    const savedLeafColor = localStorage.getItem('leafColor') || Config.DEFAULT_LEAF_COLOR;
    const savedTrunkColor = localStorage.getItem('trunkColor') || Config.DEFAULT_TRUNK_COLOR;

    Object.assign(gameState, {
        // Core gameplay state
        carbonStorage: Config.INITIAL_CARBON,
        hydraulicSafety: Config.INITIAL_HYDRAULICS, // Start with the initial value
        currentLA: Config.INITIAL_LEAF_AREA,
        effectiveLA: Config.INITIAL_LEAF_AREA,
        trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        seedCount: 0,
        stomatalConductance: 0.5,
        day: 1,
        timeOfDay: 'day', // Keep for potential visual sun cycle?
        timeInCycle: 0,   // Now tracks time *within* the current day/allocation cycle
        droughtFactor: 1.0,

        gameOver: false,
        gameOverReason: '',

        // Tree object reference
        treeMeshGroup: null,
        damagedLAPercentage: 0,

        // Settings loaded from localStorage
        playerName: savedName,
        leafColor: savedLeafColor,
        trunkColor: savedTrunkColor,

        // Last allocation state (still needed, updated by sliders)
        lastSavingsPercent: 50,
        lastGrowthRatioPercent: 50,

        // Derived dimensions (calculated after init)
        trunkWidth: 0,
        trunkDepth: 0,
        canopyWidth: 0,
        canopyDepth: 0,

        // ++ NEW: Maximum hydraulic buffer, calculated dynamically ++
        maxHydraulic: 0,
    });

    // ++ NEW: Calculate initial maxHydraulic and clamp starting safety ++
    // Calculate initial maxHydraulic based on initial LA and config settings
    gameState.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * gameState.currentLA;
    // Ensure initial safety doesn't exceed the calculated maximum
    gameState.hydraulicSafety = Math.min(gameState.hydraulicSafety, gameState.maxHydraulic);
    // ++ END NEW ++


    console.log(`GameState Initialized. Player: ${gameState.playerName}, Leaf: ${gameState.leafColor}, Trunk: ${gameState.trunkColor}, MaxHydraulics: ${gameState.maxHydraulic.toFixed(1)}`);
}

// Call initialization immediately when the module loads
initializeGameState();