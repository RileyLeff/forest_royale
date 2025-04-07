// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Need growTree now for allocation step
// Import functions needed from tree.js - will update later when functions change
import { growTree, updateCanopyVisuals, setCanopyVisibility } from './tree.js';
// Import UI functions from specific modules
import { showMessage, clearMessage } from './ui/messageHandler.js'; // Correct path for messages
import { showGameOverUI } from './ui/gameOver.js';           // Correct path for game over UI
import { sunLight } from './sceneSetup.js';                  // Keep for potential visual cycle

// REMOVED startNewDay function export


// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    // Only check for game over now
    if (gameState.gameOver) return;

    // --- Optional Visual Day/Night Cycle (Doesn't pause simulation) ---
    const visualCycleDuration = Config.DAY_DURATION_SECONDS + Config.NIGHT_DURATION_SECONDS; // Total visual cycle length
    gameState.timeInCycle += deltaTime; // Accumulate time globally
    const cycleProgress = (gameState.timeInCycle % visualCycleDuration) / visualCycleDuration; // Progress through visual cycle (0 to 1)

    if (sunLight) {
        // Example: Simple intensity change based on cycle progress
        const dayFraction = Config.DAY_DURATION_SECONDS / visualCycleDuration;
        if (cycleProgress <= dayFraction) { // Daytime visual
            const dayProgress = cycleProgress / dayFraction;
            sunLight.intensity = 0.3 + 1.2 * Math.sin(dayProgress * Math.PI); // Sine peak at midday
            gameState.timeOfDay = 'day'; // Update UI string
        } else { // Nighttime visual
             sunLight.intensity = 0.1; // Dim night light
             gameState.timeOfDay = 'night'; // Update UI string
        }
    } else {
        // If no sunlight, assume it's always day for simulation logic?
        gameState.timeOfDay = 'day';
    }


    // --- Physiological Simulation (Always runs) ---
    const stomata = gameState.stomatalConductance;
    const effLA = Math.max(0, gameState.effectiveLA);
    const currentLA = Math.max(0, gameState.currentLA);
    const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

    // Photosynthesis (Gain modulated by visual light intensity)
    const currentLightIntensity = sunLight ? Math.max(0, sunLight.intensity / 1.5) : 1.0; // Approx 0-1
    const potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * currentLightIntensity;
    // gameState.carbonStorage += potentialCarbonGain * deltaTime; // OLD direct gain

    // Respiration (Always happens)
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
    // gameState.carbonStorage -= respirationLoss * deltaTime; // OLD direct loss

    // Transpiration & Hydraulics (Always happens)
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
    const hydraulicChange = (Config.HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
    gameState.hydraulicSafety += hydraulicChange * deltaTime;

    // --- Update Carbon Storage with Source Limit ---
    const potentialGainThisStep = potentialCarbonGain * deltaTime;
    const respirationLossThisStep = respirationLoss * deltaTime;
    const currentStorage = gameState.carbonStorage;

    // Calculate how much carbon *can* be added before hitting the max
    const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
    // The actual gain is limited by potential gain AND available space
    const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);

    // Apply the limited gain and the respiration loss
    gameState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;


    // Clamp values
    // gameState.carbonStorage = Math.max(0, Math.min(Config.MAX_CARBON, gameState.carbonStorage)); // Old clamping
    // Clamp only needed for lower bound now, max is handled by actualGain logic
    gameState.carbonStorage = Math.max(0, gameState.carbonStorage);

    // Use dynamic maxHydraulic from gameState for clamping
    gameState.hydraulicSafety = Math.max(0, Math.min(gameState.maxHydraulic, gameState.hydraulicSafety));


    // --- Crown Dieback / Damage ---
    const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD;
    if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
        const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
        gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
        // Note: This call will change later
        updateCanopyVisuals(); // Reads gameState directly now
        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
         if (wasStressed) { clearMessage(); }
         // Note: This call might change later
         if (gameState.damagedLAPercentage === 0) { updateCanopyVisuals(); } // Reads gameState directly
    }

    // --- Periodic Allocation & Day Increment ---
    const allocationCycleLength = Config.DAY_DURATION_SECONDS;
    if (!gameState.allocationAppliedThisCycle && gameState.timeInCycle >= allocationCycleLength) {
         console.log(`SIM: End of Day ${gameState.day}. Applying allocation.`);
         applyAllocation(); // Call the allocation function
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
// Reverted: No sink limitation logic here anymore
function applyAllocation() {
    const available = Math.floor(gameState.carbonStorage);
    const savingsPercent = Math.max(0, Math.min(100, gameState.lastSavingsPercent));
    const growthRatioPercent = Math.max(0, Math.min(100, gameState.lastGrowthRatioPercent));

    // Perform calculations (original way)
    const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100));
    const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
    const seedsToMake = carbonForSeeds;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;

    // Use original total spent calculation
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    console.log(`SIM Applying Allocation: Available=${available}, Spend=${totalSpent}, GrowthCarbon=${actualCarbonForGrowth}, Seeds=${seedsToMake}`); // Updated log name

    // Final sanity checks
    if (totalSpent > available + 0.01 || totalSpent < 0) { // Allow tiny floating point diff
        console.error(`SIM ALLOCATION ERROR: Invalid spend calculated (${totalSpent}) vs available (${available}). Skipping allocation.`);
        showMessage("Allocation Error!", "error");
    } else {
        // Apply changes to gameState
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) {
             // Pass the originally calculated carbon for growth
            growTree(actualCarbonForGrowth);
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
    // Note: This call will change later
    setCanopyVisibility(false);
    showGameOverUI();
}