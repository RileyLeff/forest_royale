// client/ui/gameOver.js
import { gameState, getMyPlayerState } from '../gameState.js';
import { uiElements } from './elements.js';
// Import restart handler only needed if we have a restart button
// import { handleRestart } from '../main.js';

/** Displays the Game Over modal. */
export function showGameOverUI() {
    console.log("UI: showGameOverUI called.");
    if (!uiElements.gameOverModal) { console.error("UI ERROR: gameOverModal element not found!"); return; }
    // ... (check other elements as before) ...
    if (!uiElements.gameOverReasonUI) { console.warn("UI element gameOverReasonUI missing."); }
    if (!uiElements.finalDayUI) { console.warn("UI element finalDayUI missing."); }
    if (!uiElements.finalSeedsUI) { console.warn("UI element finalSeedsUI missing."); }

    const myFinalState = getMyPlayerState(); // Could be null if spectator/disconnected
    const finalDay = gameState.day;
    // Only show player seeds if they were not a spectator
    const finalSeeds = (myFinalState && !myFinalState.isSpectator) ? myFinalState.seedCount : 'N/A';

    // --- Populate Modal Content ---
    let reasonText = gameState.gameOverReason;
    if (gameState.winnerId) {
        const winnerState = gameState.players[gameState.winnerId];
        const winnerName = winnerState?.playerName || `Player ${gameState.winnerId.substring(0,4)}`;
        // Check if WE are the winner (and not a spectator)
        if (gameState.winnerId === gameState.myId && !gameState.isSpectator) { reasonText += `<br><strong>Congratulations, you had the most seeds!</strong>`; }
        else { reasonText += `<br>Winner: ${winnerName} with ${winnerState?.seedCount ?? '?'} seeds.`; }
    } else if (gameState.gameOverReason !== "Game ended by admin.") { // Avoid adding "no winner" if admin ended it
         reasonText += "<br>No winner declared.";
    }

    if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.innerHTML = reasonText;
    if(uiElements.finalDayUI) uiElements.finalDayUI.textContent = finalDay;
    if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.textContent = finalSeeds;

    // Show the Modal
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible.");

    // Attach listener for the admin close button if it exists
    // This assumes the gameOver modal is the same for admin and players
    const adminCloseButton = document.getElementById('admin-close-modal');
    if(adminCloseButton) {
         // Ensure listener isn't added multiple times
         adminCloseButton.removeEventListener('click', hideGameOverModal);
         adminCloseButton.addEventListener('click', hideGameOverModal);
    } else if (uiElements.restartButton) {
         // Re-attach listener for regular restart button if needed (or handled elsewhere)
         // uiElements.restartButton.removeEventListener('click', handleRestart);
         // uiElements.restartButton.addEventListener('click', handleRestart);
    }
}

/** Hides the Game Over modal. */
export function hideGameOverModal() {
    if (uiElements.gameOverModal) {
        uiElements.gameOverModal.classList.add('hidden');
        console.log("UI: Game over modal hidden.");
    } else { console.warn("UI: Tried to hide game over modal, element not found."); }
}