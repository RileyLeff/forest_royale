// client/ui/setupListeners.js
import { uiElements } from './elements.js';
import { handleStomataChange, handleAllocationSliderChange } from './controlsHandlers.js';
import { handleRestart, socket } from '../main.js'; // Import socket

/**
 * Attaches event listeners to the interactive UI elements.
 */
export function setupUIListeners() {
    console.log("UI: Setting up listeners...");

    // Check required elements using optional chaining for safety
    // Ensure all elements used below are checked here
    if (!uiElements.stomataSlider ||
        !uiElements.savingsSlider ||
        !uiElements.growthRatioSlider ||
        !uiElements.restartButton ||
        !uiElements.startCountdownButton) // Added check
    {
        console.error("Cannot set up UI listeners - one or more essential controls missing!");
        if (!uiElements.stomataSlider) console.error("- Stomata slider missing");
        if (!uiElements.savingsSlider) console.error("- Savings slider missing");
        if (!uiElements.growthRatioSlider) console.error("- Growth ratio slider missing");
        if (!uiElements.restartButton) console.error("- Restart button missing");
        if (!uiElements.startCountdownButton) console.error("- Start Countdown button missing");
        return;
    }


    // Control Sliders
    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.savingsSlider.addEventListener('input', handleAllocationSliderChange);
    uiElements.growthRatioSlider.addEventListener('input', handleAllocationSliderChange);

    // Restart Button
    uiElements.restartButton.addEventListener('click', handleRestart);

    // Start Countdown Button
    uiElements.startCountdownButton.addEventListener('click', () => {
        console.log("UI: Start Countdown button clicked."); // <<< Log 1
        if (socket && socket.connected) {
             // +++ Add more detailed log before emitting +++
             console.log(`UI: Emitting 'requestStartCountdown' via socket ${socket.id}. Connected: ${socket.connected}`); // <<< Log 2
             socket.emit('requestStartCountdown'); // Send event to server
        } else {
            // +++ Log the socket object for inspection +++
            console.error("UI: Cannot start countdown, socket invalid or not connected.", { socket_exists: !!socket, connected: socket?.connected }); // <<< Log 3 (with more info)
            // Maybe show an error message to the user
            alert("Error: Not connected to server. Cannot start countdown.");
        }
    });

    console.log("UI: Listeners set up.");
}