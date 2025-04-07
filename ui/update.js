// ui/update.js
// Contains the main updateUI function to refresh dynamic UI elements.

import { gameState } from '../gameState.js'; // Reads current state
import * as Config from '../config.js'; // Needs constants like MAX values, cycle lengths
import { uiElements } from './elements.js'; // Needs element references

/**
 * Updates all relevant UI elements based on the current gameState.
 * Called each frame in the main game loop.
 */
export function updateUI() {
    // Prevent updates if gameState or essential elements aren't ready
    if (!gameState || !uiElements.carbonBar || !uiElements.dayCounterUI) {
        // console.warn("updateUI called before gameState or essential UI ready.");
        return;
    }

    // Update Status Bars (Bottom Left)
    if (uiElements.carbonBar) {
        uiElements.carbonBar.style.width = `${(gameState.carbonStorage / Config.MAX_CARBON) * 100}%`;
    }
    if (uiElements.hydraulicBar) {
        uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / Config.MAX_HYDRAULIC) * 100}%`;
    }
    if (uiElements.carbonValueUI) {
        uiElements.carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    }
    if (uiElements.hydraulicValueUI) {
        uiElements.hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);
    }
    if (uiElements.seedCounterUI) {
        uiElements.seedCounterUI.textContent = gameState.seedCount;
    }

    // Update Info (Top Left)
    if (uiElements.dayCounterUI) {
        uiElements.dayCounterUI.textContent = gameState.day;
    }
    if (uiElements.timeOfDayUI) {
        // Update based on visual cycle state if kept
        uiElements.timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);
    }
    // Update Cycle Timer (Top Left) - showing time left until next allocation/day increment
    const allocationCycleLength = Config.DAY_DURATION_SECONDS;
    const timeSinceLastCycleStart = gameState.timeInCycle % allocationCycleLength;
    const timeLeftInCycle = Math.max(0, allocationCycleLength - timeSinceLastCycleStart);
    if (uiElements.cycleTimerUI) {
        uiElements.cycleTimerUI.textContent = Math.floor(timeLeftInCycle);
    }
    if (uiElements.weatherStatusUI) {
        // Example weather display based on drought factor
        uiElements.weatherStatusUI.textContent = gameState.droughtFactor > 1.2 ? "Dry" : gameState.droughtFactor < 0.8 ? "Wet" : "Clear";
    }

    // Update Controls (Bottom Bar) - Ensure they reflect current game state
    // Primarily needed for initialization/restart, user input normally syncs these
    if (uiElements.stomataSlider) {
        // Only update if the value differs significantly, prevent overriding user input mid-drag?
        // Or maybe simpler: just ensure it reflects state if not actively focused?
        // For now, let's update if different - might cause slight jump after drag end
        if (parseFloat(uiElements.stomataSlider.value) !== gameState.stomatalConductance) {
            uiElements.stomataSlider.value = gameState.stomatalConductance;
        }
    }
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    }

    // Update Allocation Sliders and their percentage displays
    if (uiElements.savingsSlider) {
        if (parseInt(uiElements.savingsSlider.value) !== gameState.lastSavingsPercent) {
             uiElements.savingsSlider.value = gameState.lastSavingsPercent;
        }
    }
     if (uiElements.savingsPercentageUI) {
        uiElements.savingsPercentageUI.textContent = `${gameState.lastSavingsPercent}%`;
     }

    if (uiElements.growthRatioSlider) {
        if (parseInt(uiElements.growthRatioSlider.value) !== gameState.lastGrowthRatioPercent) {
            uiElements.growthRatioSlider.value = gameState.lastGrowthRatioPercent;
        }
    }
     if (uiElements.growthRatioPercentageUI) {
        const seedRatioPercent = 100 - gameState.lastGrowthRatioPercent;
        uiElements.growthRatioPercentageUI.textContent = `${gameState.lastGrowthRatioPercent}%/${seedRatioPercent}%`;
     }


    // Update Leaderboard (Top Right - Basic for SP)
     if (uiElements.leaderboardListUI) {
         uiElements.leaderboardListUI.innerHTML = `<li>${gameState.playerName || 'Player'}: ${gameState.seedCount} Seeds</li>`;
     }
     if (uiElements.treeCountUI) {
         // Assuming '1' active tree unless game over
         uiElements.treeCountUI.textContent = gameState.gameOver ? 0 : 1;
     }
}