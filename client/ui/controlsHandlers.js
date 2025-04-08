// client/ui/controlsHandlers.js
import { uiElements } from './elements.js';
// Import the socket instance from the new dedicated module
import { socket } from '../socket.js'; // <<< UPDATED PATH
// We no longer directly modify gameState here

/**
 * Handles changes to the Stomata Slider input.
 * Updates the UI display and sends the new value to the server.
 * @param {Event} e - The input event object.
 */
export function handleStomataChange(e) {
    const newValue = parseFloat(e.target.value);

    // Update UI display immediately for responsiveness
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(newValue * 100)}%`;
    }

    // --- Send update to server ---
    if (socket && socket.connected) {
        // console.log(`UI->Server: Emitting updateStomata: ${newValue}`); // Debug log
        socket.emit('updateStomata', { value: newValue });
    } else {
        console.warn("Socket not connected, cannot send stomata update.");
    }
}

/**
 * Handles changes to EITHER the Savings or Growth Ratio sliders.
 * Updates the UI display and sends the new allocation intent to the server.
 */
export function handleAllocationSliderChange() {
    // Check required elements exist
    if (!uiElements.savingsSlider || !uiElements.growthRatioSlider ||
        !uiElements.savingsPercentageUI || !uiElements.growthRatioPercentageUI) {
            console.warn("Allocation slider UI elements missing in handler.");
            return;
        }

    // Read current values from both sliders
    const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
    const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;

    // Update percentage displays immediately
    uiElements.savingsPercentageUI.textContent = `${savingsPercent}%`;
    const seedRatioPercent = 100 - growthRatioPercent;
    uiElements.growthRatioPercentageUI.textContent = `${growthRatioPercent}%/${seedRatioPercent}%`;

    // --- Send update to server ---
    if (socket && socket.connected) {
         // console.log(`UI->Server: Emitting updateAllocation: Savings=${savingsPercent}, GrowthRatio=${growthRatioPercent}`); // Debug log
         socket.emit('updateAllocation', {
             savings: savingsPercent,
             growthRatio: growthRatioPercent
         });
    } else {
         console.warn("Socket not connected, cannot send allocation update.");
    }
}