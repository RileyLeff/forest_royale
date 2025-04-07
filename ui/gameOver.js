// ui/gameOver.js
// Handles showing and hiding the Game Over modal UI.

// Import shared game state to read final scores and reason
import { gameState } from '../gameState.js'; // Adjust path as needed
// Import UI elements cache
import { uiElements } from './elements.js';
// Import tree function needed to visually update tree on game over
import { setCanopyVisibility } from '../tree.js'; // Adjust path as needed

/**
 * Displays the Game Over modal, populating it with final stats.
 * Assumes the gameState.gameOver flag and reason have already been set.
 */
export function showGameOverUI() {
    console.log("UI: showGameOverUI called."); // Log function start

    // Check required elements exist
    if (!uiElements.gameOverModal) {
        console.error("UI ERROR: gameOverModal element not found in showGameOverUI!");
        return;
    }
    if (!uiElements.gameOverReasonUI) {
        console.error("UI ERROR: gameOverReasonUI element not found in showGameOverUI!");
        // Attempt to continue without the reason text
    }
    if (!uiElements.finalDayUI) {
         console.warn("UI element finalDayUI missing.");
    }
     if (!uiElements.finalSeedsUI) {
         console.warn("UI element finalSeedsUI missing.");
    }


    console.log(`UI: Attempting to display reason: "${gameState.gameOverReason}"`);

    // --- Populate Modal Content ---
    // Set text content, checking if elements exist first
    if(uiElements.gameOverReasonUI) {
        uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
        console.log("UI: gameOverReasonUI textContent set.");
    } else {
        console.log("UI: gameOverReasonUI element was missing, couldn't set text.");
    }

    if(uiElements.finalDayUI) {
        uiElements.finalDayUI.textContent = gameState.day;
    }

    if(uiElements.finalSeedsUI) {
        uiElements.finalSeedsUI.textContent = gameState.seedCount;
    }

    // --- Trigger Visual Changes Associated with Game Over ---
    // Note: Canopy hiding is logically part of game over, triggered by simulation,
    // but we ensure it's called here just in case. Best practice is Simulation calls it.
    setCanopyVisibility(false); // Reads gameState internally now


    // --- Show the Modal ---
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible.");
}

/**
 * Hides the Game Over modal. Called by the restart logic.
 */
export function hideGameOverModal() {
    if (uiElements.gameOverModal) {
        uiElements.gameOverModal.classList.add('hidden');
        console.log("UI: Game over modal hidden.");
    } else {
        console.warn("UI: Tried to hide game over modal, but element not found.");
    }
}