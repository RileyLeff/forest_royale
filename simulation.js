// Simulation Module: Handles game logic updates, physics, time, weather

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary functions from tree.js
import { growTree, updateCanopyTiles, setCanopyVisibility, updateTreeGeometry } from './tree.js';
// Import UI functions from specific modules
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { showGameOverUI } from './ui/gameOver.js';
// Import environment control functions
import { updateLighting, updateSky } from './environment.js'; // Added environment imports

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
        enteringNewDay = true;
        gameState.day++;
        gameState.timeInCycle -= Config.TOTAL_CYCLE_DURATION;
        gameState.currentPeriodIndex = 0;
        gameState.isNight = false;
        gameState.growthAppliedThisCycle = false;
        previousPeriodIndex = -1;
        console.log(`--- START DAY ${gameState.day} ---`);
        showMessage(`Day ${gameState.day} starting.`);
    }

    let calculatedPeriodIndex;
    if (gameState.timeInCycle < Config.DAY_TOTAL_DURATION) {
        calculatedPeriodIndex = Math.floor(gameState.timeInCycle / Config.PERIOD_DURATION);
        gameState.isNight = false;
    } else {
        calculatedPeriodIndex = -1;
        gameState.isNight = true;
    }

    // --- Check for Period/Phase Transitions ---
    const periodChanged = calculatedPeriodIndex !== previousPeriodIndex;
    let isCloudyCurrentPeriod = false; // Track cloudiness for visual update
    if (periodChanged || enteringNewDay) {
        gameState.currentPeriodIndex = calculatedPeriodIndex;

        if (!gameState.isNight) {
            // Entering a New Daytime Period
            isCloudyCurrentPeriod = generatePeriodWeather(gameState.currentPeriodIndex); // Get cloud status
            console.log(`Entering Day Period ${gameState.currentPeriodIndex}: Light=${gameState.currentLightMultiplier.toFixed(2)}, Drought=${gameState.currentDroughtFactor.toFixed(2)}, Raining=${gameState.isRaining}`);
            // ++ Update Visuals ++
            updateLighting(false, isCloudyCurrentPeriod);
            updateSky(false, isCloudyCurrentPeriod);
            // TODO: Call start/stop rain later
        } else {
            // Entering Nighttime
            generateNightWeather(); // Includes setting gameState.isRaining
            gameState.foliarUptakeAppliedThisNight = false;
            console.log(`Entering Night: Raining=${gameState.isRaining}`);
             // ++ Update Visuals ++
            updateLighting(true, false); // Cloudiness irrelevant for night lighting model
            updateSky(true, false); // Cloudiness irrelevant for night sky model
             // TODO: Call start/stop rain later
        }
        previousPeriodIndex = gameState.currentPeriodIndex;
    }

    // --- 3. Apply Ongoing Physiological Processes ---
    const stomata = gameState.stomatalConductance;
    const effLA = Math.max(0, gameState.effectiveLA);
    const currentLA = Math.max(0, gameState.currentLA);
    const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

    // Photosynthesis (Uses gameState.currentLightMultiplier set by weather gen)
    let potentialCarbonGain = 0;
    if (!gameState.isNight) {
        potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * gameState.currentLightMultiplier;
    }

    // Respiration
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

    // Hydraulics (Uses gameState.currentDroughtFactor and gameState.isRaining set by weather gen)
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.currentDroughtFactor;
    let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE;
    if (gameState.isRaining) {
        currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT;
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
        updateCanopyTiles();
        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
         if (wasStressed) {
            clearMessage();
            updateCanopyTiles();
        }
    }

    // --- 4. Handle Specific Timed Events (Night Logic) ---
    if (gameState.isNight) {
        if (gameState.isRaining && !gameState.foliarUptakeAppliedThisNight) {
            applyFoliarUptake();
            gameState.foliarUptakeAppliedThisNight = true;
        }

        const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
        if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !gameState.growthAppliedThisCycle) {
            console.log(`SIM: Triggering growth allocation at ${timeIntoNight.toFixed(2)}s into night.`);
            applyAllocation();
            gameState.growthAppliedThisCycle = true;
        }
    }

    // TODO: Call updateRain(deltaTime) every frame here in Phase 3

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
    const isCloudy = !isSunny; // Determine cloudiness
    gameState.currentLightMultiplier = isCloudy ? Config.LIGHT_MULT_CLOUDY : Config.LIGHT_MULT_SUNNY;

    const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION;
    gameState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation);

    gameState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);

    return isCloudy; // Return cloud status for visual update call
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