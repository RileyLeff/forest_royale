// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Import necessary UI functions
import { showMessage, showAllocationSection, showGameOverUI, clearMessage } from './ui.js'; // Make sure clearMessage is imported
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
            if (sunLight) {
                sunLight.intensity = 0.2;
                sunLight.position.set(-30, 50, -20);
            }
            showAllocationSection();
        } else {
            // --- Transition to Day ---
            gameState.timeOfDay = 'day';
            gameState.day++;
            if (sunLight) {
                sunLight.intensity = 1.5;
                sunLight.position.set(30, 50, 20);
            }
             showMessage(`Day ${gameState.day} starting.`);
        }
    }

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
        const wasStressed = gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD; // Check before update

        if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
            const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
            gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
            gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
            updateCanopyVisuals(gameState);
            // Show warning message (it's okay to call showMessage repeatedly)
            showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
             // If safety is now above threshold AND it *was* stressed just before
             if (wasStressed) {
                 clearMessage(); // Clear the stress message now that it's recovered
             }
            // Ensure visuals are correct if damage somehow returns to 0
            if (gameState.damagedLAPercentage === 0) {
                  updateCanopyVisuals(gameState); // Reset color if needed
            }
        }

        // --- Check Game Over Conditions ---
        if (gameState.carbonStorage <= 0) {
            triggerGameOver("Starvation! Ran out of carbon.");
            return; // Stop further simulation this frame if game over
        }
        if (gameState.hydraulicSafety <= 0) {
            triggerGameOver("Desiccation! Hydraulic system failed.");
            return; // Stop further simulation this frame if game over
        }
    }

    // If the phase just changed TO day, clear any message (could be stress or allocation message)
     if (nextPhase && gameState.timeOfDay === 'day') {
         clearMessage();
         showMessage(`Day ${gameState.day} starting.`); // Show day message again
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