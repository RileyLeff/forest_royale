// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary UI functions
import { showMessage, showAllocationSection, showGameOverUI, clearMessage } from './ui.js';
import { updateCanopyVisuals, setCanopyVisibility } from './tree.js';
import { sunLight } from './sceneSetup.js'; // Need to control light

// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    if (gameState.isPaused || gameState.gameOver) return; // Don't update if paused or game over

    // --- Day/Night Cycle ---
    gameState.timeInCycle += deltaTime;
    let cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
    let nextPhase = false; // Flag to know if phase just changed

    if (gameState.timeInCycle >= cycleDuration) {
        gameState.timeInCycle = 0; // Reset timer for the new phase
        nextPhase = true; // Mark that phase changed

        if (gameState.timeOfDay === 'day') {
            // --- Transition to Night ---
            gameState.timeOfDay = 'night';
            // Update lighting
            if (sunLight) {
                sunLight.intensity = 0.2;
                sunLight.position.set(-30, 50, -20);
            }
            // Trigger the allocation UI to show
            showAllocationSection();
        } else {
            // --- Transition to Day ---
            gameState.timeOfDay = 'day';
            gameState.day++;
            // Update lighting
            if (sunLight) {
                sunLight.intensity = 1.5;
                sunLight.position.set(30, 50, 20);
            }
            // Show start-of-day message
             showMessage(`Day ${gameState.day} starting.`);
            // Optional: Change drought factor
            // gameState.droughtFactor = 1.0 + Math.random() * 0.5;
            // showMessage(`Day ${gameState.day} starting. Drought: ${gameState.droughtFactor.toFixed(1)}`);
        }
    }

    // --- Run physiological simulation only during the day ---
    if (gameState.timeOfDay === 'day') {
        const stomata = gameState.stomatalConductance;
        // Ensure values are valid numbers and non-negative
        const effLA = Math.max(0, gameState.effectiveLA);
        const currentLA = Math.max(0, gameState.currentLA);
        const trunkVolume = Math.max(0, gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight);

        // Photosynthesis
        const potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata;
        gameState.carbonStorage += potentialCarbonGain * deltaTime;

        // Respiration
        const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
        gameState.carbonStorage -= respirationLoss * deltaTime;

        // Transpiration & Hydraulics
        const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
        const hydraulicChange = (Config.HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
        gameState.hydraulicSafety += hydraulicChange * deltaTime;

        // Clamp values to min/max
        gameState.carbonStorage = Math.max(0, Math.min(Config.MAX_CARBON, gameState.carbonStorage));
        gameState.hydraulicSafety = Math.max(0, Math.min(Config.MAX_HYDRAULIC, gameState.hydraulicSafety));

        // --- Crown Dieback / Damage ---
        if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
            const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
            gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
            // Update effective leaf area based on new damage
            gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
            updateCanopyVisuals(gameState); // Update color tint
            // Show persistent warning message while stressed
             showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
             // Clear warning message ONLY if it was previously showing hydraulic stress
            if (uiElements.messageLogUI && uiElements.messageLogUI.textContent.includes('Hydraulic stress')) {
                 clearMessage();
            }
            // Optional: Implement slow canopy recovery if hydraulics are good?
            // For now, just ensure visuals are correct if damage returns to 0
            if (gameState.damagedLAPercentage === 0) {
                  updateCanopyVisuals(gameState); // Reset color if needed
            }
        }


        // --- Check Game Over Conditions ---
        if (gameState.carbonStorage <= 0) {
            triggerGameOver("Starvation! Ran out of carbon.");
        } else if (gameState.hydraulicSafety <= 0) {
            triggerGameOver("Desiccation! Hydraulic system failed.");
        }
    }

    // If the phase just changed TO day, clear any lingering stress message
     if (nextPhase && gameState.timeOfDay === 'day') {
         clearMessage();
         showMessage(`Day ${gameState.day} starting.`); // Re-show day message
     }
}


// Function to set the game over state and trigger UI/visual updates
function triggerGameOver(reason) {
    if (gameState.gameOver) return; // Prevent multiple triggers

    console.log("Game Over:", reason);
    gameState.gameOver = true;
    gameState.gameOverReason = reason;
    gameState.isPaused = true; // Pause simulation

    // Trigger visual changes for game over
    setCanopyVisibility(gameState, false); // Hide the canopy via tree module

    // Trigger the UI display for game over
    showGameOverUI();
}