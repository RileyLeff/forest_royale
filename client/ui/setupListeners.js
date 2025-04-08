// client/ui/setupListeners.js
import { uiElements } from './elements.js';
import { handleStomataChange, handleAllocationSliderChange } from './controlsHandlers.js';
// Import ONLY the socket instance from the shared module
import { socket } from '../socket.js'; // Path was already updated
// REMOVE handleRestart from main.js import, as it's handled in gameOver.js now
// import { handleRestart } from '../main.js'; // DELETE OR COMMENT OUT THIS LINE if it was separate
// OR modify the import from socket.js if handleRestart was mistakenly added there (unlikely)

// If handleRestart was imported alongside socket previously from main.js, modify the line like this:
// import { handleRestart, socket } from '../main.js'; // <<< OLD LINE
import { socket } from '../socket.js';             // <<< CORRECTED LINE (assuming handleRestart was only needed for main.js import)
// Also check if handleRestart was accidentally imported from '../main.js' on a separate line and remove it.

// We still might need handleRestart IF setupUIListeners attached it directly, but it doesn't seem to.
// Let's re-import it from gameOver.js ONLY IF needed here (it's not)
// import { handleRestart } from './gameOver.js'; // Not needed here

/**
 * Attaches event listeners to the interactive UI elements.
 */
export function setupUIListeners() {
    console.log("UI: Setting up listeners...");

    // Attempt to cache elements if not already done (safer)
    if (Object.keys(uiElements).length === 0) {
        console.warn("UI Listeners: Caching DOM elements as they weren't cached before setupUIListeners call.");
        cacheDOMElements();
    }

    // --- Game Page Specific Listeners ---
    if (uiElements.stomataSlider) {
        uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    }
    if (uiElements.savingsSlider) {
        uiElements.savingsSlider.addEventListener('input', handleAllocationSliderChange);
    }
    if (uiElements.growthRatioSlider) {
        uiElements.growthRatioSlider.addEventListener('input', handleAllocationSliderChange);
    }

    // The restart button listener is attached in gameOver.js, no need here.
    // if (uiElements.restartButton) {
    //     // uiElements.restartButton.addEventListener('click', handleRestart); // Don't add listener here
    // }

    if (uiElements.startCountdownButton) {
        uiElements.startCountdownButton.addEventListener('click', () => {
            console.log("UI: Start Countdown button clicked.");
            if (socket && socket.connected) {
                 console.log(`UI: Emitting 'requestStartCountdown' via socket ${socket.id}. Connected: ${socket.connected}`);
                 socket.emit('requestStartCountdown'); // Send event to server
            } else {
                console.error("UI: Cannot start countdown, socket invalid or not connected.", { socket_exists: !!socket, connected: socket?.connected });
                alert("Error: Not connected to server. Cannot start countdown.");
            }
        });
    }

    console.log("UI: Listener setup function finished.");
}