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
        hydraulicSafety: Config.INITIAL_HYDRAULICS,
        currentLA: Config.INITIAL_LEAF_AREA,
        effectiveLA: Config.INITIAL_LEAF_AREA,
        trunkHeight: Config.INITIAL_TRUNK_HEIGHT,
        seedCount: 0,
        stomatalConductance: 0.5,
        day: 1,
        // timeOfDay: 'day', // REMOVED: Replaced by isNight and period index
        timeInCycle: 0.0,   // Tracks time *within* the current full day/night cycle

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

        // Maximum hydraulic buffer, calculated dynamically
        maxHydraulic: 0,

        // ++ NEW: Weather & Time State ++
        currentPeriodIndex: -1,     // 0, 1, 2 for day periods, -1 for night or initial state
        isNight: false,             // Flag indicating if it's currently nighttime
        currentLightMultiplier: 1.0,// Current effect of light on photosynthesis
        currentDroughtFactor: Config.DROUGHT_MULT_BASE, // Current effect of drought on transpiration
        isRaining: false,           // Flag indicating if it's currently raining
        foliarUptakeAppliedThisNight: false, // Tracks if night rain boost was applied
        // No 'dailyWeather' array needed for dynamic generation
        // ++ END NEW ++

        // ++ INTERNAL: Flags for simulation logic ++
        // allocationAppliedThisCycle: false, // RENAMED: More specific flags needed
        growthAppliedThisCycle: false, // Tracks if growth was triggered in the current night phase
        // ++ END INTERNAL ++
    });

    // Calculate initial maxHydraulic and clamp starting safety
    gameState.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * gameState.currentLA;
    gameState.hydraulicSafety = Math.min(gameState.hydraulicSafety, gameState.maxHydraulic);

    console.log(`GameState Initialized. Player: ${gameState.playerName}, Leaf: ${gameState.leafColor}, Trunk: ${gameState.trunkColor}, MaxHydraulics: ${gameState.maxHydraulic.toFixed(1)}`);
}

// Call initialization immediately when the module loads
initializeGameState();