// Simulation Module: Handles game logic updates, physics, time, weather

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary functions from tree.js
import { growTree, updateCanopyTiles, setCanopyVisibility, updateTreeGeometry } from './tree.js';
// Import UI functions from specific modules
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { showGameOverUI } from './ui/gameOver.js';
// Import environment control functions
import { setWeatherTargets, startRain, stopRain } from './environment.js'; // Added start/stop rain

// --- Internal State ---
let previousPeriodIndex = -2; // Initialize differently from gameState.currentPeriodIndex to trigger initial update
// Removed wasRainingLastUpdate as the check is now done by comparing oldIsRaining within the transition block

// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    if (gameState.gameOver) return;

    // --- 1. Update Cycle Time ---
    gameState.timeInCycle += deltaTime;

    // --- 2. Determine Current Phase & Handle Transitions ---
    let enteringNewDay = false;
    if (gameState.timeInCycle >= Config.TOTAL_CYCLE_DURATION) {
        // --- Start of a New Day ---
        enteringNewDay = true;
        gameState.day++;
        gameState.timeInCycle -= Config.TOTAL_CYCLE_DURATION; // Wrap time
        gameState.currentPeriodIndex = 0; // Start at period 0
        gameState.isNight = false;
        gameState.growthAppliedThisCycle = false; // Reset growth flag for the new night
        previousPeriodIndex = -1; // Ensure weather generation triggers for period 0
        console.log(`--- START DAY ${gameState.day} ---`);
        // Future: Call catastrophe check logic here
        showMessage(`Day ${gameState.day} starting.`);
    }

    // Determine current logical period index and night status
    let calculatedPeriodIndex;
    if (gameState.timeInCycle < Config.DAY_TOTAL_DURATION) {
        // --- Daytime ---
        calculatedPeriodIndex = Math.floor(gameState.timeInCycle / Config.PERIOD_DURATION);
        gameState.isNight = false;
    } else {
        // --- Nighttime ---
        calculatedPeriodIndex = -1; // Use -1 to denote night
        gameState.isNight = true;
    }

    // --- Check for Period/Phase Transitions ---
    const periodChanged = calculatedPeriodIndex !== previousPeriodIndex;
    let isCloudyCurrentPeriod = false; // Track cloudiness for target setting
    // let rainStatusChanged = false; // Flag to check if rain starts/stops - check done inline

    if (periodChanged || enteringNewDay) {
        const oldIsRaining = gameState.isRaining; // Store state *before* generating new weather

        gameState.currentPeriodIndex = calculatedPeriodIndex; // Update state index

        if (!gameState.isNight) {
            // --- Entering a New Daytime Period ---
            isCloudyCurrentPeriod = generatePeriodWeather(gameState.currentPeriodIndex); // Generates light, drought, rain state
            console.log(`Entering Day Period ${gameState.currentPeriodIndex}: Light=${gameState.currentLightMultiplier.toFixed(2)}, Drought=${gameState.currentDroughtFactor.toFixed(2)}, Raining=${gameState.isRaining}`);
            setWeatherTargets(false, isCloudyCurrentPeriod, gameState.isRaining);
        } else {
            // --- Entering Nighttime ---
            generateNightWeather(); // Generates night rain state
            gameState.foliarUptakeAppliedThisNight = false; // Reset foliar uptake flag
            console.log(`Entering Night: Raining=${gameState.isRaining}`);
            setWeatherTargets(true, false, gameState.isRaining); // Pass isRaining for conditional star visibility
        }

        // Check if rain status changed and trigger effects
        if (oldIsRaining !== gameState.isRaining) {
            if (gameState.isRaining) {
                startRain(); // Call function from environment.js
            } else {
                stopRain(); // Call function from environment.js
            }
        }

        previousPeriodIndex = gameState.currentPeriodIndex; // Update tracked index
    }

    // --- 3. Apply Ongoing Physiological Processes ---
    const stomata = gameState.stomatalConductance;
    const effLA = Math.max(0, gameState.effectiveLA);
    const currentLA = Math.max(0, gameState.currentLA);
    const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

    // Photosynthesis (Only during Day)
    let potentialCarbonGain = 0;
    if (!gameState.isNight) {
        potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * gameState.currentLightMultiplier;
    }

    // Respiration (Always happens)
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

    // Hydraulics (Always happens, rate depends on weather)
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.currentDroughtFactor;
    let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE;
    if (gameState.isRaining) {
        currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT; // Bonus recovery during rain
    }
    const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss;
    gameState.hydraulicSafety += hydraulicChange * deltaTime;

    // Apply Carbon Changes (Source Limited)
    const potentialGainThisStep = potentialCarbonGain * deltaTime;
    const respirationLossThisStep = respirationLoss * deltaTime;
    const currentStorage = gameState.carbonStorage;
    const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
    const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);
    gameState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;

    // Clamp Values
    gameState.carbonStorage = Math.max(0, gameState.carbonStorage);
    gameState.hydraulicSafety = Math.max(0, Math.min(gameState.maxHydraulic, gameState.hydraulicSafety));

    // Crown Dieback / Damage
    const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD;
    if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
        const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
        gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
        updateCanopyTiles(); // Update visual damage
        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
         if (wasStressed) {
            clearMessage(); // Clear warning when recovered above threshold
            updateCanopyTiles(); // Update visuals (color might change)
        }
    }

    // --- 4. Handle Specific Timed Events (Night Logic) ---
    if (gameState.isNight) {
        // Foliar Water Uptake
        if (gameState.isRaining && !gameState.foliarUptakeAppliedThisNight) {
            applyFoliarUptake(); // Apply the boost once
            gameState.foliarUptakeAppliedThisNight = true;
        }

        // Growth Allocation Trigger
        const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
        if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !gameState.growthAppliedThisCycle) {
            console.log(`SIM: Triggering growth allocation at ${timeIntoNight.toFixed(2)}s into night.`);
            applyAllocation(); // Call the allocation function
            gameState.growthAppliedThisCycle = true; // Mark as done for this night cycle
        }
    }

    // NOTE: updateEnvironmentVisuals and updateRain called from main.js loop

    // --- 5. Check Game Over Conditions ---
    if (gameState.carbonStorage <= 0 && !gameState.gameOver) {
        triggerGameOver("Starvation! Ran out of carbon.");
        return;
    }
    if (gameState.hydraulicSafety <= 0 && !gameState.gameOver) {
        triggerGameOver("Desiccation! Hydraulic system failed.");
        return;
    }
}

// --- Helper Functions ---

// Generates weather for a specific daytime period, RETURNS isCloudy status
function generatePeriodWeather(periodIndex) {
    const isSunny = Math.random() < Config.SUNNY_PROB;
    const isCloudy = !isSunny;
    gameState.currentLightMultiplier = isCloudy ? Config.LIGHT_MULT_CLOUDY : Config.LIGHT_MULT_SUNNY;
    const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION;
    gameState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation);
    gameState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
    return isCloudy;
}

// Determines if it rains during the night
function generateNightWeather() {
    const isConceptuallyCloudy = Math.random() >= Config.SUNNY_PROB;
    gameState.isRaining = isConceptuallyCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
    gameState.currentLightMultiplier = 0;
    gameState.currentDroughtFactor = Config.DROUGHT_MULT_BASE;
}

// Applies the foliar uptake boost
function applyFoliarUptake() {
    const currentSafety = gameState.hydraulicSafety;
    const boostAmount = Config.NIGHT_RAIN_HYDRAULIC_BOOST;
    gameState.hydraulicSafety = Math.min(currentSafety + boostAmount, gameState.maxHydraulic);
    console.log(`Foliar Boost: ${currentSafety.toFixed(1)} + ${boostAmount} -> ${gameState.hydraulicSafety.toFixed(1)} (Max: ${gameState.maxHydraulic.toFixed(1)})`);
    showMessage("Absorbing night rain!", "info");
}

// Applies carbon allocation decided by player sliders
function applyAllocation() {
    const available = Math.floor(gameState.carbonStorage);
    const savingsPercent = Math.max(0, Math.min(100, gameState.lastSavingsPercent));
    const growthRatioPercent = Math.max(0, Math.min(100, gameState.lastGrowthRatioPercent));
    const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100));
    const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
    const seedsToMake = carbonForSeeds;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    console.log(`SIM Applying Allocation: Available=${available}, Spend=${totalSpent}, GrowthCarbon=${actualCarbonForGrowth}, Seeds=${seedsToMake}`);
    if (totalSpent > available + 0.01 || totalSpent < 0) {
        console.error(`SIM ALLOCATION ERROR: Invalid spend calculated (${totalSpent}) vs available (${available}). Skipping allocation.`);
        showMessage("Allocation Error!", "error");
    } else {
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) {
            growTree(actualCarbonForGrowth);
        }
    }
}

// Triggers the game over sequence
function triggerGameOver(reason) {
    console.log(`triggerGameOver called. Reason: "${reason}", Current gameOver state: ${gameState.gameOver}`);
    if (gameState.gameOver) return;
    console.log("Game Over:", reason);
    gameState.gameOver = true;
    gameState.gameOverReason = reason;
    setCanopyVisibility(false);
    showGameOverUI();
}