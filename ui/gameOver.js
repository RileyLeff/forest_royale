// ui/gameOver.js
// Handles showing and hiding the Game Over modal UI.

import { gameState, getMyPlayerState } from '../gameState.js'; // Import state
import { uiElements } from './elements.js';
// Tree visibility handled by main loop based on isAlive now
// import { setCanopyVisibility } from '../tree.js';

/**
 * Displays the Game Over modal, populating it with final stats.
 * Assumes the gameState.gameOver flag, reason, and winnerId have already been set.
 */
export function showGameOverUI() {
    console.log("UI: showGameOverUI called.");

    if (!uiElements.gameOverModal) { console.error("UI ERROR: gameOverModal element not found!"); return; }
    if (!uiElements.gameOverReasonUI) { console.warn("UI element gameOverReasonUI missing."); }
    if (!uiElements.finalDayUI) { console.warn("UI element finalDayUI missing."); }
    if (!uiElements.finalSeedsUI) { console.warn("UI element finalSeedsUI missing."); }

    // Get local player's final state for display
    const myFinalState = getMyPlayerState(); // Might be null if disconnected before game over
    const finalDay = gameState.day;
    const finalSeeds = myFinalState?.seedCount ?? 0; // Show 0 if state missing

    // --- Populate Modal Content ---
    let reasonText = gameState.gameOverReason;
    // Check if there's a winner and if it's us
    if (gameState.winnerId) {
        const winnerState = gameState.players[gameState.winnerId];
        const winnerName = winnerState?.playerName || `Player ${gameState.winnerId.substring(0,4)}`;
        if (gameState.winnerId === gameState.myId) {
            reasonText += `<br><strong>Congratulations, you had the most seeds!</strong>`;
        } else {
             reasonText += `<br>Winner: ${winnerName} with ${winnerState?.seedCount ?? '?'} seeds.`;
        }
    } else {
        // Handle cases with no winner? (e.g., admin stop)
         reasonText += "<br>No winner declared." // Or specific message
    }


    if(uiElements.gameOverReasonUI) {
        uiElements.gameOverReasonUI.innerHTML = reasonText; // Use innerHTML for the <br> and <strong>
    }
    if(uiElements.finalDayUI) {
        uiElements.finalDayUI.textContent = finalDay;
    }
    if(uiElements.finalSeedsUI) {
        uiElements.finalSeedsUI.textContent = finalSeeds;
    }

    // Tree visibility is handled by the main loop checking player.isAlive status

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