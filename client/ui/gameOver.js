// client/ui/gameOver.js
import { gameState, getMyPlayerState } from '../gameState.js';
import { uiElements } from './elements.js';
// Import handleRestart if using the default restart button
import { handleRestart } from '../main.js';

/** Displays the Game Over modal. */
export function showGameOverUI() {
    console.log("UI: showGameOverUI called.");
    if (!uiElements.gameOverModal) { console.error("UI ERROR: gameOverModal element not found!"); return; }
    if (!uiElements.gameOverReasonUI) { console.warn("UI element gameOverReasonUI missing."); }
    if (!uiElements.finalDayUI) { console.warn("UI element finalDayUI missing."); }
    if (!uiElements.finalSeedsUI) { console.warn("UI element finalSeedsUI missing."); }

    const myFinalState = getMyPlayerState();
    const finalDay = gameState.day;
    // Show N/A seeds if spectator or state missing
    const finalSeeds = (myFinalState && !myFinalState.isSpectator) ? myFinalState.seedCount : 'N/A';

    // --- Populate Modal Content ---
    let reasonText = gameState.gameOverReason || "The game has ended!"; // Default reason
    if (gameState.winnerId) {
        const winnerState = gameState.players[gameState.winnerId];
        const winnerName = winnerState?.playerName || `Player ${gameState.winnerId.substring(0,4)}`;
        if (gameState.winnerId === gameState.myId && !gameState.isSpectator) { reasonText += `<br><strong>Congratulations, you had the most seeds!</strong>`; }
        else { reasonText += `<br>Winner: ${winnerName} with ${winnerState?.seedCount ?? '?'} seeds.`; }
    } else if (reasonText.indexOf("admin") === -1) { // Avoid adding "no winner" if admin ended it
         reasonText += "<br>No winner declared.";
    }

    if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.innerHTML = reasonText;

    // Show/Hide player-specific stats based on spectator status
    const isSpectatorView = document.getElementById('admin-controls') !== null; // Simple check if on admin page
    const showPlayerStats = !isSpectatorView; // Could also check gameState.isSpectator if reliable

    if(uiElements.finalDayUI) {
        uiElements.finalDayUI.textContent = finalDay;
        uiElements.finalDayUI.parentElement.style.display = showPlayerStats ? 'block' : 'none'; // Show/hide the whole <p> tag
    }
    if(uiElements.finalSeedsUI) {
        uiElements.finalSeedsUI.textContent = finalSeeds;
         uiElements.finalSeedsUI.parentElement.style.display = showPlayerStats ? 'block' : 'none'; // Show/hide the whole <p> tag
    }

    // Show appropriate button (Restart or Admin Close)
    if(uiElements.restartButton) uiElements.restartButton.style.display = showPlayerStats ? 'inline-block' : 'none';
    const adminCloseButton = document.getElementById('admin-close-modal'); // Check existence
    if(adminCloseButton) adminCloseButton.style.display = isSpectatorView ? 'inline-block' : 'none';


    // Show the Modal
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible.");

    // Attach listener for the appropriate close/restart button
    if(isSpectatorView && adminCloseButton) {
         adminCloseButton.removeEventListener('click', hideGameOverModal); // Prevent duplicates
         adminCloseButton.addEventListener('click', hideGameOverModal);
    } else if (uiElements.restartButton) {
         uiElements.restartButton.removeEventListener('click', handleRestart); // Prevent duplicates
         uiElements.restartButton.addEventListener('click', handleRestart);
    }
}

/** Hides the Game Over modal. */
export function hideGameOverModal() {
    if (uiElements.gameOverModal) {
        uiElements.gameOverModal.classList.add('hidden');
        console.log("UI: Game over modal hidden.");
    } else { console.warn("UI: Tried to hide game over modal, element not found."); }
}