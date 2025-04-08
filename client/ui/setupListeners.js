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
    if (!uiElements.stomataSlider || !uiElements.savingsSlider || !uiElements.growthRatioSlider || !uiElements.restartButton || !uiElements.startCountdownButton) {
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
        console.log("UI: Start Countdown button clicked.");
        if (socket && socket.connected) {
             socket.emit('requestStartCountdown'); // Send event to server
        } else {
            console.error("UI: Cannot start countdown, socket not connected.");
            // Maybe show an error message to the user
        }
    });

    console.log("UI: Listeners set up.");
}