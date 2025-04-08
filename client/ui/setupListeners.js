// ui/setupListeners.js
// Sets up all necessary event listeners for UI elements.

// Import the cached UI element references
import { uiElements } from './elements.js';

// Import handler functions from other modules
import { handleStomataChange, handleAllocationSliderChange } from './controlsHandlers.js'; // Adjust path if needed
// Game Over modal is handled separately, but restart is triggered from main
import { handleRestart } from '../main.js'; // Adjust path to go up one level

/**
 * Attaches event listeners to the interactive UI elements.
 * Should be called once after elements are cached.
 */
export function setupUIListeners() {
    console.log("UI: Setting up listeners...");

    // Check essential elements exist before adding listeners
    const essentialControls = [
        uiElements.stomataSlider,
        uiElements.savingsSlider,
        uiElements.growthRatioSlider,
        uiElements.restartButton
    ];
    if (essentialControls.some(el => !el)) {
        console.error("Cannot set up UI listeners - one or more essential controls missing!");
        // Find which one is missing
        if (!uiElements.stomataSlider) console.error("- Stomata slider missing");
        if (!uiElements.savingsSlider) console.error("- Savings slider missing");
        if (!uiElements.growthRatioSlider) console.error("- Growth ratio slider missing");
        if (!uiElements.restartButton) console.error("- Restart button missing");
        return;
    }

    // Control Sliders
    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.savingsSlider.addEventListener('input', handleAllocationSliderChange);
    uiElements.growthRatioSlider.addEventListener('input', handleAllocationSliderChange);

    // Restart Button (on Game Over Modal)
    uiElements.restartButton.addEventListener('click', handleRestart);

    // Add listeners for any other interactive elements here (e.g., leaderboard expand)

    console.log("UI: Listeners set up.");
}