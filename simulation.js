// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary functions from tree.js
import { growTree, updateCanopyTiles, setCanopyVisibility, updateTreeGeometry } from './tree.js'; // Added updateTreeGeometry, changed updateCanopyVisuals->Tiles
// Import UI functions from specific modules
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { showGameOverUI } from './ui/gameOver.js';
import { sunLight } from './sceneSetup.js';

// REMOVED startNewDay function export


// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    if (gameState.gameOver) return;

    // --- Optional Visual Day/Night Cycle ---
    const visualCycleDuration = Config.DAY_DURATION_SECONDS + Config.NIGHT_DURATION_SECONDS;
    gameState.timeInCycle += deltaTime;
    const cycleProgress = (gameState.timeInCycle % visualCycleDuration) / visualCycleDuration;

    if (sunLight) {
        const dayFraction = Config.DAY_DURATION_SECONDS / visualCycleDuration;
        if (cycleProgress <= dayFraction) {
            const dayProgress = cycleProgress / dayFraction;
            sunLight.intensity = 0.3 + 1.2 * Math.sin(dayProgress * Math.PI);
            gameState.timeOfDay = 'day';
        } else {
             sunLight.intensity = 0.1;
             gameState.timeOfDay = 'night';
        }
    } else {
        gameState.timeOfDay = 'day';
    }


    // --- Physiological Simulation ---
    const stomata = gameState.stomatalConductance;
    const effLA = Math.max(0, gameState.effectiveLA);
    const currentLA = Math.max(0, gameState.currentLA);
    const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

    // Photosynthesis
    const currentLightIntensity = sunLight ? Math.max(0, sunLight.intensity / 1.5) : 1.0;
    const potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * currentLightIntensity;

    // Respiration
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

    // Hydraulics
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
    const hydraulicChange = (Config.HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
    gameState.hydraulicSafety += hydraulicChange * deltaTime;

    // Update Carbon Storage with Source Limit
    const potentialGainThisStep = potentialCarbonGain * deltaTime;
    const respirationLossThisStep = respirationLoss * deltaTime;
    const currentStorage = gameState.carbonStorage;
    const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
    const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);
    gameState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;

    // Clamp values
    gameState.carbonStorage = Math.max(0, gameState.carbonStorage);
    gameState.hydraulicSafety = Math.max(0, Math.min(gameState.maxHydraulic, gameState.hydraulicSafety));


    // --- Crown Dieback / Damage ---
    const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD;
    if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
        const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
        gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);

        // ++ MODIFIED: Call new function to update tile visibility/color ++
        updateCanopyTiles();
        // Geometry doesn't change here, only visibility/color

        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
        // If recovering, ensure canopy visuals are correct (color reverts)
         if (wasStressed) {
            clearMessage();
            // Update canopy tiles to reflect lack of *new* damage (color might change back slightly)
            updateCanopyTiles();
        }
         // If damage was exactly 0, ensure visuals are pristine (needed if damage could hypothetically be repaired)
         // else if (gameState.damagedLAPercentage === 0) {
         //    updateCanopyTiles();
         // }
    }

    // --- Periodic Allocation & Day Increment ---
    const allocationCycleLength = Config.DAY_DURATION_SECONDS;
    if (!gameState.allocationAppliedThisCycle && gameState.timeInCycle >= allocationCycleLength) {
         console.log(`SIM: End of Day ${gameState.day}. Applying allocation.`);
         applyAllocation(); // Calls growTree -> updateTreeGeometry if growth occurs
         gameState.day++;
         gameState.timeInCycle -= allocationCycleLength;
         gameState.allocationAppliedThisCycle = true;
         clearMessage();
         showMessage(`Day ${gameState.day} starting.`);
    } else if (gameState.timeInCycle < allocationCycleLength) {
         gameState.allocationAppliedThisCycle = false;
    }


    // --- Check Game Over Conditions ---
    if (gameState.carbonStorage <= 0) {
        triggerGameOver("Starvation! Ran out of carbon.");
        return;
    }
    if (gameState.hydraulicSafety <= 0) {
        triggerGameOver("Desiccation! Hydraulic system failed.");
        return;
    }
}

// --- Function to Apply Allocation ---
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
            growTree(actualCarbonForGrowth); // Calls updateTreeGeometry inside
        }
    }
}


// --- Game Over Logic ---
function triggerGameOver(reason) {
    console.log(`triggerGameOver called. Reason: "${reason}", Current gameOver state: ${gameState.gameOver}`);
    if (gameState.gameOver) return;

    console.log("Game Over:", reason);
    gameState.gameOver = true;
    gameState.gameOverReason = reason;
    // Use updated function targeting the canopy group
    setCanopyVisibility(false);
    showGameOverUI();
}