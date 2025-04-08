// ui/controlsHandlers.js
// Contains event handler functions for user controls (sliders).

// Import the shared game state
import { gameState } from '../gameState.js'; // Adjust path to go up one level
// Import the cached UI elements
import { uiElements } from './elements.js';

/**
 * Handles changes to the Stomata Slider input.
 * Updates the game state and the UI display for stomata %.
 * @param {Event} e - The input event object.
 */
export function handleStomataChange(e) {
    // Update game state immediately
    gameState.stomatalConductance = parseFloat(e.target.value);
    // Update UI display immediately
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    } else {
        console.warn("Stomata value UI element missing in handler.");
    }
}

/**
 * Handles changes to EITHER the Savings or Growth Ratio sliders.
 * Updates the relevant percentage display and immediately updates
 * the corresponding last known allocation state in gameState.
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
    uiElements.growthRatioPercentageUI.textContent = `${growthRatioPercent}%/${seedRatioPercent}%`; // Short format

    // Update gameState immediately so the simulation uses the latest values
    // when it performs the periodic allocation.
    gameState.lastSavingsPercent = savingsPercent;
    gameState.lastGrowthRatioPercent = growthRatioPercent;

    // Optional: Log the change
    // console.log(`UI Handler: Updated Allocation State - Savings: ${savingsPercent}%, Growth Ratio: ${growthRatioPercent}%`);

    // No need to update the allocation *preview* text here anymore,
    // as the allocation happens periodically based on these stored values.
}