// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Need growTree now for allocation step
import { growTree, updateCanopyVisuals, setCanopyVisibility } from './tree.js';
// Still need UI functions for messages and game over
import { showMessage, showGameOverUI, clearMessage } from './ui.js';
import { sunLight } from './sceneSetup.js'; // Keep for potential visual cycle

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
    gameState.carbonStorage += potentialCarbonGain * deltaTime;

    // Respiration (Always happens)
    const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
    gameState.carbonStorage -= respirationLoss * deltaTime;

    // Transpiration & Hydraulics (Always happens)
    const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
    const hydraulicChange = (Config.HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
    gameState.hydraulicSafety += hydraulicChange * deltaTime;

    // Clamp values
    gameState.carbonStorage = Math.max(0, Math.min(Config.MAX_CARBON, gameState.carbonStorage));
    gameState.hydraulicSafety = Math.max(0, Math.min(Config.MAX_HYDRAULIC, gameState.hydraulicSafety));

    // --- Crown Dieback / Damage ---
    const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD;
    if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
        const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
        gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
        updateCanopyVisuals(); // Reads gameState directly now
        showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
    } else {
         if (wasStressed) { clearMessage(); }
         if (gameState.damagedLAPercentage === 0) { updateCanopyVisuals(); } // Reads gameState directly
    }

    // --- Periodic Allocation & Day Increment ---
    // Check if enough time has passed for an allocation cycle
    const allocationCycleLength = Config.DAY_DURATION_SECONDS; // Use day duration as interval
    // Check if the *total accumulated time* crosses a multiple of the cycle length
    // Example: Day ends at 20s, 40s, 60s etc.
    // This requires tracking total time or checking if timeInCycle just wrapped around 0 after exceeding duration
    // Simpler: Use modulo, but needs careful handling if deltaTime > cycleLength
    // Let's use a state variable to track if allocation is due this frame
    if (!gameState.allocationAppliedThisCycle && gameState.timeInCycle >= allocationCycleLength) {
         console.log(`SIM: End of Day ${gameState.day}. Applying allocation.`);
         applyAllocation(); // Call the allocation function
         gameState.day++; // Increment the day count
         gameState.timeInCycle -= allocationCycleLength; // Reset timer relative to overshoot
         gameState.allocationAppliedThisCycle = true; // Mark as applied

         clearMessage(); // Clear previous message
         showMessage(`Day ${gameState.day} starting.`); // Show new day message
    } else if (gameState.timeInCycle < allocationCycleLength) {
         // Reset the flag once the timer is below the threshold again
         gameState.allocationAppliedThisCycle = false;
    }


    // --- Check Game Over Conditions (Check AFTER allocation potentially reduces carbon) ---
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

    console.log(`SIM Applying Allocation: Available=${available}, Spend=${totalSpent}, Growth=${actualCarbonForGrowth}, Seeds=${seedsToMake}`);

    // Final sanity checks
    if (totalSpent > available + 0.01 || totalSpent < 0) {
        console.error(`SIM ALLOCATION ERROR: Invalid spend calculated (${totalSpent}). Skipping allocation.`);
        showMessage("Allocation Error!", "error");
    } else {
        // Apply changes to gameState
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) {
            // Call growTree - assumes growTree reads gameState directly now
            growTree(actualCarbonForGrowth);
        }
    }
}


// --- Game Over Logic ---
function triggerGameOver(reason) {
    if (gameState.gameOver) return;
    console.log("Game Over:", reason);
    gameState.gameOver = true;
    gameState.gameOverReason = reason;
    // No need to set isPaused anymore
    setCanopyVisibility(false); // Assumes reads gameState directly
    showGameOverUI();
}