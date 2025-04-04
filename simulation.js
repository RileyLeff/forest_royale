// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary UI functions
import { showMessage, showAllocationSection, showGameOverUI, clearMessage } from './ui.js'; // Make sure clearMessage is imported
import { updateCanopyVisuals, setCanopyVisibility } from './tree.js';
import { sunLight } from './sceneSetup.js'; // Need to control light

// --- Exported function to handle starting a new day ---
export function startNewDay() {
    console.log("SIM: startNewDay called."); // Log start
    if (gameState.gameOver) {
        console.log("SIM: Game over, returning from startNewDay."); // Log
        return;
    }

    gameState.timeOfDay = 'day';
    gameState.day++;
    gameState.timeInCycle = 0; // Reset timer for the new day
    console.log(`SIM: State updated - Day ${gameState.day}, TimeOfDay 'day', TimeInCycle 0`); // Log state change

    // Update lighting
    if (sunLight) {
        sunLight.intensity = 1.5;
        sunLight.position.set(30, 50, 20);
        console.log("SIM: Sunlight updated."); // Log
    } else {
        console.warn("SIM: sunLight not found in startNewDay."); // Warn if missing
    }


    // Clear any lingering messages (like allocation timeout warning)
    clearMessage();
    // Show start-of-day message
    showMessage(`Day ${gameState.day} starting.`);

    // Optional: Change drought factor at the start of each day
    // gameState.droughtFactor = 1.0 + Math.random() * 0.5;
    // showMessage(`Day ${gameState.day} starting. Drought: ${gameState.droughtFactor.toFixed(1)}`);

    console.log(`SIM: Finished startNewDay for Day ${gameState.day}.`); // Log end
}


// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    if (gameState.isPaused || gameState.gameOver) return; // Don't update if paused or game over

    // --- Day/Night Cycle ---
    gameState.timeInCycle += deltaTime;
    // Only check for end-of-day transition now
    if (gameState.timeOfDay === 'day') {
        const cycleDuration = Config.DAY_DURATION_SECONDS;
        if (gameState.timeInCycle >= cycleDuration) {
            // --- Transition to Night ---
            gameState.timeOfDay = 'night';
            gameState.timeInCycle = 0; // Reset timer for night (allocation phase)
            // Update lighting
            if (sunLight) {
                sunLight.intensity = 0.2;
                sunLight.position.set(-30, 50, -20);
            }
            // Trigger the allocation UI to show (UI module handles pausing)
            showAllocationSection();
            // Stop further simulation this frame after triggering allocation
            return;
        }
    }
    // --- REMOVED the else block that handled night-to-day transition ---


    // --- Run physiological simulation only during the day ---
    if (gameState.timeOfDay === 'day') {
        const stomata = gameState.stomatalConductance;
        const effLA = Math.max(0, gameState.effectiveLA);
        const currentLA = Math.max(0, gameState.currentLA);
        const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

        // Photosynthesis, Respiration, Hydraulics...
        const potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata;
        gameState.carbonStorage += potentialCarbonGain * deltaTime;
        const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
        gameState.carbonStorage -= respirationLoss * deltaTime;
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
            updateCanopyVisuals(gameState);
            showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
             // If safety is now above threshold AND it *was* stressed just before
             if (wasStressed) {
                 clearMessage(); // Clear the stress message now that it's recovered
             }
             if (gameState.damagedLAPercentage === 0) { updateCanopyVisuals(gameState); } // Reset color if needed
        }

        // --- Check Game Over Conditions ---
        if (gameState.carbonStorage <= 0) {
            triggerGameOver("Starvation! Ran out of carbon."); // Call with reason
            return; // Stop further simulation this frame
        }
        if (gameState.hydraulicSafety <= 0) {
            triggerGameOver("Desiccation! Hydraulic system failed."); // Call with reason
            return; // Stop further simulation this frame
        }
    }
    // Note: Day start message logic removed from here, handled by startNewDay
}


// Function to set the game over state and trigger UI/visual updates
function triggerGameOver(reason) {
    if (gameState.gameOver) {
        console.log("SIM: triggerGameOver called but game already over."); // Log if already over
        return;
    }
    // ++ Added Log ++
    console.log(`SIM: triggerGameOver called with reason: "${reason}"`); // Log reason received

    gameState.gameOver = true;
    gameState.gameOverReason = reason; // Store the reason
    gameState.isPaused = true;
    // ++ Added Log ++
    console.log(`SIM: gameState updated - gameOver: ${gameState.gameOver}, reason: "${gameState.gameOverReason}", isPaused: ${gameState.isPaused}`); // Log state update

    // Trigger visual changes for game over
    setCanopyVisibility(gameState, false);
    // ++ Added Log ++
    console.log("SIM: Canopy visibility set to false."); // Log visual trigger

    // Trigger the UI display for game over
    // ++ Added Log ++
    console.log("SIM: Calling showGameOverUI()..."); // Log before calling UI
    showGameOverUI();
    // ++ Added Log ++
    console.log("SIM: Finished triggerGameOver."); // Log end
}