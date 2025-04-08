// client/ui/setupListeners.js
import { uiElements } from './elements.js';
import { handleStomataChange, handleAllocationSliderChange } from './controlsHandlers.js';
// Import ONLY the socket instance from the shared module
import { socket } from '../socket.js'; // <<< ENSURE THIS IS THE ONLY SOCKET IMPORT

// Remove any other imports that might have included 'socket' from '../main.js'

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