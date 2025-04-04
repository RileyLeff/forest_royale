// Simulation Module: Handles game logic updates, physics, time

import { gameState } from './gameState.js';
import * as Config from './config.js';
import { showMessage, showAllocationSection, showGameOverUI } from './ui.js';
import { updateCanopyVisuals, setCanopyVisibility } from './tree.js';
import { sunLight } from './sceneSetup.js'; // Need to control light

// Updates the simulation state by one time step (deltaTime)
export function updateSimulation(deltaTime) {
    if (gameState.isPaused || gameState.gameOver) return; // Don't update if paused or game over

    // --- Day/Night Cycle ---
    gameState.timeInCycle += deltaTime;
    let cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
    let nextPhase = false;

    if (gameState.timeInCycle >= cycleDuration) {
        gameState.timeInCycle = 0; // Reset timer for the new phase
        nextPhase = true;
        if (gameState.timeOfDay === 'day') {
            // Transition to Night
            gameState.timeOfDay = 'night';
            if (sunLight) { // Check if sunLight exists
                sunLight.intensity = 0.2; // Dim sunlight for night
                sunLight.position.set(-30, 50, -20); // Move sun
            }
            showAllocationSection(); // Trigger allocation UI
        } else {
            // Transition to Day
            gameState.timeOfDay = 'day';
            gameState.day++;
             if (sunLight) { // Check if sunLight exists
                sunLight.intensity = 1.5; // Restore sun intensity
                sunLight.position.set(30, 50, 20); // Reset sun position
             }
            // Maybe add random drought factor changes per day?
            // gameState.droughtFactor = 1.0 + Math.random() * 0.5;
             showMessage(`Day ${gameState.day} starting.`);
        }
    }

    // --- Run physiological simulation only during the day ---
    if (gameState.timeOfDay === 'day') {
        const stomata = gameState.stomatalConductance;
        // Ensure effectiveLA and other params are valid numbers
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

        // Clamp values
        gameState.carbonStorage = Math.max(0, Math.min(Config.MAX_CARBON, gameState.carbonStorage));
        gameState.hydraulicSafety = Math.max(0, Math.min(Config.MAX_HYDRAULIC, gameState.hydraulicSafety));

        // --- Crown Dieback / Damage ---
        if (gameState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
            const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
            gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageIncrease);
            // Update effective leaf area based on new damage
            gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
            updateCanopyVisuals(gameState); // Update color tint
             showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
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

    // Update UI timer display happens in ui.js or main loop based on gameState.timeInCycle
}


// Function to set the game over state and trigger UI updates
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