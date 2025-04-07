// Simulation Module: Handles game logic updates, physics, time, weather

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary functions from tree.js
import { growTree, updateCanopyTiles, setCanopyVisibility, updateTreeGeometry } from './tree.js';
// Import UI functions from specific modules
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { showGameOverUI } from './ui/gameOver.js';
// Import scene objects IF needed for visual updates controlled here (deferring to environment.js later)
// import { sunLight } from './sceneSetup.js'; // Keep for now, but ideally move light logic

// --- Internal State ---
let previousPeriodIndex = -2; // Initialize differently from gameState.currentPeriodIndex

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
    if (periodChanged || enteringNewDay) {
        gameState.currentPeriodIndex = calculatedPeriodIndex; // Update state

        if (!gameState.isNight) {
            // --- Entering a New Daytime Period ---
            generatePeriodWeather(gameState.currentPeriodIndex); // Generate weather for this specific period
            console.log(`Entering Day Period ${gameState.currentPeriodIndex}: Light=${gameState.currentLightMultiplier.toFixed(2)}, Drought=${gameState.currentDroughtFactor.toFixed(2)}, Raining=${gameState.isRaining}`);
            // TODO: Trigger visual updates (light, sky, rain particles - Phase 2/3)
        } else {
            // --- Entering Nighttime ---
            generateNightWeather(); // Determine if it rains at night
            gameState.foliarUptakeAppliedThisNight = false; // Reset foliar uptake flag
            console.log(`Entering Night: Raining=${gameState.isRaining}`);
            // TODO: Trigger visual updates (darken lights, stars, rain particles - Phase 2/3)
        }
        previousPeriodIndex = gameState.currentPeriodIndex; // Update tracked index
    }

    // --- 3. Apply Ongoing Physiological Processes ---
    const stomata = gameState.stomatalConductance;
    const effLA = Math.max(0, gameState.effectiveLA);
    const currentLA = Math.max(0, gameState.currentLA);
    const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

    // --- Photosynthesis (Only during Day) ---
    let potentialCarbonGain = 0;
    if (!gameState.isNight) {
        // Use currentLightMultiplier generated by weather function
        potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * gameState.currentLightMultiplier;
    }

    // --- Respiration (Always happens) ---
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

    // --- Transpiration & Hydraulics (Always happens, rate depends on weather) ---
    // Use currentDroughtFactor generated by weather function
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.currentDroughtFactor;
    let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE;
    if (gameState.isRaining) {
        currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT; // Bonus recovery during rain
    }
    const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss;
    gameState.hydraulicSafety += hydraulicChange * deltaTime;

    // --- Apply Carbon Changes (Source Limited) ---
    const potentialGainThisStep = potentialCarbonGain * deltaTime;
    const respirationLossThisStep = respirationLoss * deltaTime;
    const currentStorage = gameState.carbonStorage;
    const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
    const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);
    gameState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;

    // --- Clamp Values ---
    gameState.carbonStorage = Math.max(0, gameState.carbonStorage);
    gameState.hydraulicSafety = Math.max(0, Math.min(gameState.maxHydraulic, gameState.hydraulicSafety));

    // --- Crown Dieback / Damage ---
    const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD;
    if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
        const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
        gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
        updateCanopyTiles(); // Update visual damage
        // Show message only if newly stressed or periodically? For now, always show when below threshold.
        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
         if (wasStressed) {
            clearMessage(); // Clear warning when recovered above threshold
            updateCanopyTiles(); // Update visuals (color might change)
        }
    }

    // --- 4. Handle Specific Timed Events (Night Logic) ---
    if (gameState.isNight) {
        // --- Foliar Water Uptake ---
        if (gameState.isRaining && !gameState.foliarUptakeAppliedThisNight) {
            applyFoliarUptake(); // Apply the boost once
            gameState.foliarUptakeAppliedThisNight = true;
            console.log("Applied foliar water uptake boost.");
        }

        // --- Growth Allocation Trigger ---
        const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
        if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !gameState.growthAppliedThisCycle) {
            console.log(`SIM: Triggering growth allocation at ${timeIntoNight.toFixed(2)}s into night.`);
            applyAllocation(); // Call the allocation function
            gameState.growthAppliedThisCycle = true; // Mark as done for this night cycle
        }
    }

    // --- 5. Check Game Over Conditions ---
    // Check AFTER applying physiological changes and potential growth allocation
    if (gameState.carbonStorage <= 0 && !gameState.gameOver) { // Check gameOver flag to prevent multiple triggers
        triggerGameOver("Starvation! Ran out of carbon.");
        return; // Stop further processing if game over
    }
    if (gameState.hydraulicSafety <= 0 && !gameState.gameOver) {
        triggerGameOver("Desiccation! Hydraulic system failed.");
        return; // Stop further processing if game over
    }
}

// --- Helper Functions ---

// Generates weather for a specific daytime period
function generatePeriodWeather(periodIndex) {
    // Light
    const isSunny = Math.random() < Config.SUNNY_PROB;
    gameState.currentLightMultiplier = isSunny ? Config.LIGHT_MULT_SUNNY : Config.LIGHT_MULT_CLOUDY;

    // Drought Factor (Random variation around base)
    const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION; // Random value between -VAR and +VAR
    gameState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation); // Ensure factor is positive

    // Rain (Only if cloudy)
    const isCloudy = !isSunny;
    gameState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
}

// Determines if it rains during the night
function generateNightWeather() {
    // Night weather only determines rain based on cloudiness (conceptual)
    // We don't explicitly model night clouds vs day clouds, assume 1/3 chance like day
    const isConceptuallyCloudy = Math.random() >= Config.SUNNY_PROB; // Reuse sunny prob for simplicity
    gameState.isRaining = isConceptuallyCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
    // Night doesn't have light multiplier or drought factor variation in this model
    gameState.currentLightMultiplier = 0; // No sun at night
    gameState.currentDroughtFactor = Config.DROUGHT_MULT_BASE; // Assume base transpiration pull at night? Or lower? Let's use base for now.
}

// Applies the foliar uptake boost
function applyFoliarUptake() {
    const currentSafety = gameState.hydraulicSafety;
    const boostAmount = Config.NIGHT_RAIN_HYDRAULIC_BOOST;
    // Apply boost, ensuring it doesn't exceed maxHydraulic
    gameState.hydraulicSafety = Math.min(currentSafety + boostAmount, gameState.maxHydraulic);
    console.log(`Foliar Boost: ${currentSafety.toFixed(1)} + ${boostAmount} -> ${gameState.hydraulicSafety.toFixed(1)} (Max: ${gameState.maxHydraulic.toFixed(1)})`);
    showMessage("Absorbing night rain!", "info"); // Give feedback
}


// Applies carbon allocation decided by player sliders
function applyAllocation() {
    // Reads allocation percentages directly from gameState (updated by UI sliders)
    const available = Math.floor(gameState.carbonStorage);
    const savingsPercent = Math.max(0, Math.min(100, gameState.lastSavingsPercent));
    const growthRatioPercent = Math.max(0, Math.min(100, gameState.lastGrowthRatioPercent));

    // Perform calculations
    const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100));
    const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
    const seedsToMake = carbonForSeeds; // Since cost = 1
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST; // = seedsToMake

    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    console.log(`SIM Applying Allocation: Available=${available}, Spend=${totalSpent}, GrowthCarbon=${actualCarbonForGrowth}, Seeds=${seedsToMake}`);

    // Final sanity checks
    if (totalSpent > available + 0.01 || totalSpent < 0) { // Allow tiny floating point diff
        console.error(`SIM ALLOCATION ERROR: Invalid spend calculated (${totalSpent}) vs available (${available}). Skipping allocation.`);
        showMessage("Allocation Error!", "error");
    } else {
        // Apply changes to gameState
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) {
            growTree(actualCarbonForGrowth); // Calls updateTreeGeometry inside
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
    setCanopyVisibility(false); // Hide canopy tiles
    showGameOverUI(); // Show modal
}