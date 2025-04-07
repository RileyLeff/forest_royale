// ui/update.js
// Contains the main updateUI function to refresh dynamic UI elements.

import { gameState } from '../gameState.js'; // Reads current state
import * as Config from '../config.js'; // Needs constants like cycle lengths
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
        if (gameState.maxHydraulic > 0) {
             uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / gameState.maxHydraulic) * 100}%`;
        } else {
             uiElements.hydraulicBar.style.width = '0%';
        }
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
        // ++ MODIFIED: Use isNight and currentPeriodIndex instead of timeOfDay ++
        let timeText = '';
        if (gameState.isNight) {
            timeText = 'Night';
        } else if (gameState.currentPeriodIndex >= 0) {
            // Display Day Period number (1-based for user display)
            timeText = `Day Period ${gameState.currentPeriodIndex + 1}`;
        } else {
            timeText = 'Starting...'; // Initial state before first period starts
        }
        uiElements.timeOfDayUI.textContent = timeText;
        // ++ END MODIFICATION ++
    }
    // Update Cycle Timer (Top Left) - showing time left until next *full cycle* repeats (Day 1 -> Day 2)
    // OR maybe time left in current period/night? Let's do time left in period/night phase.
    let timeLeft = 0;
    if (gameState.isNight) {
        const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
        timeLeft = Config.NIGHT_DURATION - timeIntoNight;
    } else if (gameState.currentPeriodIndex >= 0) {
        const timeIntoPeriod = gameState.timeInCycle - (gameState.currentPeriodIndex * Config.PERIOD_DURATION);
        timeLeft = Config.PERIOD_DURATION - timeIntoPeriod;
    } else {
        timeLeft = Config.PERIOD_DURATION - gameState.timeInCycle; // Time left in first period
    }

    if (uiElements.cycleTimerUI) {
        uiElements.cycleTimerUI.textContent = Math.max(0, Math.floor(timeLeft)); // Ensure non-negative
    }

    // Update Weather Status UI (using new state vars)
    if (uiElements.weatherStatusUI) {
        let weatherText = '';
        if (gameState.currentPeriodIndex === -1 && !gameState.isNight) {
            weatherText = 'Initializing...'; // Before first period weather is generated
        } else {
            // Determine light condition text
            if(gameState.isNight) {
                weatherText = 'Night';
            } else {
                 weatherText = (gameState.currentLightMultiplier === Config.LIGHT_MULT_SUNNY) ? 'Sunny' : 'Cloudy';
            }
            // Add rain status
            if (gameState.isRaining) {
                weatherText += ', Raining';
            }
            // Add drought status (example interpretation)
            if (gameState.currentDroughtFactor > Config.DROUGHT_MULT_BASE + Config.DROUGHT_VARIATION * 0.6) {
                weatherText += ' (Dry)';
            } else if (gameState.currentDroughtFactor < Config.DROUGHT_MULT_BASE - Config.DROUGHT_VARIATION * 0.6) {
                weatherText += ' (Wet)';
            }
        }
        uiElements.weatherStatusUI.textContent = weatherText;
    }

    // Update Controls (Bottom Bar)
    if (uiElements.stomataSlider) {
        if (parseFloat(uiElements.stomataSlider.value) !== gameState.stomatalConductance) {
            uiElements.stomataSlider.value = gameState.stomatalConductance;
        }
    }
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    }
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


    // Update Leaderboard (Top Right)
     if (uiElements.leaderboardListUI) {
         uiElements.leaderboardListUI.innerHTML = `<li>${gameState.playerName || 'Player'}: ${gameState.seedCount} Seeds</li>`;
     }
     if (uiElements.treeCountUI) {
         uiElements.treeCountUI.textContent = gameState.gameOver ? 0 : 1;
     }
}