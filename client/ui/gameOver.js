// client/ui/gameOver.js
import { gameState, getMyPlayerState } from '../gameState.js';
import { uiElements } from './elements.js';
// Import the socket instance from the new dedicated module
import { socket } from '../socket.js'; // <<< ADD socket import

// --- Define handleRestart locally ---
function handleRestart() {
    console.log("UI: Restart button clicked, navigating to /");
    if (socket && socket.connected) {
       console.log("UI: Disconnecting socket before restart...");
       socket.disconnect();
    }
    // Use a small delay to allow socket disconnect message to potentially send/process
    setTimeout(() => {
        window.location.href = '/';
    }, 100); // 100ms delay
}

/** Displays the Game Over modal. */
export function showGameOverUI() {
    console.log("UI: showGameOverUI called.");
    if (!uiElements.gameOverModal) { console.error("UI ERROR: gameOverModal element not found!"); return; }
    // Check optional elements safely
    if (!uiElements.gameOverReasonUI) { console.warn("UI element gameOverReasonUI missing."); }
    if (!uiElements.finalDayUI) { console.warn("UI element finalDayUI missing."); }
    if (!uiElements.finalSeedsUI) { console.warn("UI element finalSeedsUI missing."); }

    const myFinalState = getMyPlayerState();
    const finalDay = gameState.day;
    // Show N/A seeds if spectator or state missing
    const finalSeeds = (myFinalState && !gameState.isSpectator) ? myFinalState.seedCount : 'N/A';
    // Determine if this client is admin (by checking if admin controls exist on page)
    const isAdminView = !!document.getElementById('admin-controls'); // Check if admin controls are present

    // --- Populate Modal Content ---
    let reasonText = gameState.gameOverReason || "The game has ended!"; // Default reason
    if (gameState.winnerId) {
        const winnerState = gameState.players[gameState.winnerId];
        const winnerName = winnerState?.playerName || `Player ${gameState.winnerId.substring(0,4)}`;
        // Check if WE are the winner (and not a spectator)
        if (gameState.winnerId === gameState.myId && !gameState.isSpectator) { reasonText += `<br><strong>Congratulations, you had the most seeds!</strong>`; }
        else { reasonText += `<br>Winner: ${winnerName} with ${winnerState?.seedCount ?? '?'} seeds.`; }
    } else if (reasonText.indexOf("admin") === -1 && reasonText.indexOf("ended") > -1) { // Avoid adding "no winner" if admin ended it or just ended naturally
         reasonText += "<br>No winner declared.";
    }

    if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.innerHTML = reasonText;

    // Show/Hide player-specific stats based on view type and spectator status
    const showPlayerStats = !isAdminView && !gameState.isSpectator; // Show stats only if regular player view AND not spectator

    if(uiElements.finalDayUI && uiElements.finalDayUI.parentElement) { // Check parent exists
        uiElements.finalDayUI.textContent = finalDay;
        uiElements.finalDayUI.parentElement.style.display = showPlayerStats ? 'block' : 'none'; // Show/hide the whole <p> tag
    }
    if(uiElements.finalSeedsUI && uiElements.finalSeedsUI.parentElement) { // Check parent exists
        uiElements.finalSeedsUI.textContent = finalSeeds;
         uiElements.finalSeedsUI.parentElement.style.display = showPlayerStats ? 'block' : 'none'; // Show/hide the whole <p> tag
    }

    // --- Show/Hide and Setup Buttons ---
    const adminCloseButton = document.getElementById('admin-close-modal'); // Reference admin specific button if it exists

    // Regular Player View: Show 'Play Again' (which reloads to '/')
    if (uiElements.restartButton) {
        uiElements.restartButton.style.display = showPlayerStats ? 'inline-block' : 'none';
        if (showPlayerStats) {
            // Attach listener (remove first to prevent duplicates if modal shown multiple times)
            uiElements.restartButton.removeEventListener('click', handleRestart); // Use the local handleRestart
            uiElements.restartButton.addEventListener('click', handleRestart); // Use the local handleRestart
        }
    }
    // Admin View: Show 'Close'
    if (adminCloseButton) {
        adminCloseButton.style.display = isAdminView ? 'inline-block' : 'none';
         if (isAdminView) {
             // Attach listener (remove first to prevent duplicates)
             adminCloseButton.removeEventListener('click', hideGameOverModal);
             adminCloseButton.addEventListener('click', hideGameOverModal);
         }
    } else if (isAdminView) {
         // Warn if admin view but expected button is missing
         console.warn("Admin view detected, but 'admin-close-modal' button not found in HTML.");
    }


    // Show the Modal itself
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible.");
}

/** Hides the Game Over modal. */
export function hideGameOverModal() {
    if (uiElements.gameOverModal) {
        uiElements.gameOverModal.classList.add('hidden');
        console.log("UI: Game over modal hidden.");
    } else { console.warn("UI: Tried to hide game over modal, element not found."); }
}