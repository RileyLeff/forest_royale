// ui/update.js
// Contains the main updateUI function to refresh dynamic UI elements.

// Import gameState and helper
import { gameState, getMyPlayerState } from '../gameState.js';
import * as Config from '../config.js'; // Keep for MAX_CARBON etc.
import { uiElements } from './elements.js'; // Needs element references

/**
 * Updates all relevant UI elements based on the current gameState
 * (which is populated by server updates).
 * Called each frame in the main game loop.
 */
export function updateUI() {
    // Wait until initial state is received and elements are ready
    if (!gameState.initialStateReceived || !uiElements.carbonBar || !uiElements.dayCounterUI) {
        // console.warn("updateUI called before initial state or UI ready.");
        return;
    }

    // Get the state specific to the local player
    const myState = getMyPlayerState(); // Returns player state object or null

    // --- Update Status Bars (Bottom Left) ---
    // Show default/empty state if local player data isn't available yet
    const carbon = myState?.carbonStorage ?? 0;
    const maxCarbon = Config.MAX_CARBON; // Still use client config for max? Or send from server? Config is safer.
    const hydraulics = myState?.hydraulicSafety ?? 0;
    const maxHydraulics = myState?.maxHydraulic ?? Config.BASE_HYDRAULIC; // Use player's max or base if no state
    const seeds = myState?.seedCount ?? 0;

    if (uiElements.carbonBar) {
        uiElements.carbonBar.style.width = `${(carbon / maxCarbon) * 100}%`;
    }
    if (uiElements.hydraulicBar) {
        uiElements.hydraulicBar.style.width = maxHydraulics > 0 ? `${(hydraulics / maxHydraulics) * 100}%` : '0%';
    }
    if (uiElements.carbonValueUI) {
        uiElements.carbonValueUI.textContent = Math.floor(carbon);
    }
    if (uiElements.hydraulicValueUI) {
        uiElements.hydraulicValueUI.textContent = Math.floor(hydraulics);
    }
    if (uiElements.seedCounterUI) {
        uiElements.seedCounterUI.textContent = seeds;
    }

    // --- Update Info (Top Left) ---
    if (uiElements.dayCounterUI) {
        uiElements.dayCounterUI.textContent = gameState.day;
    }
    if (uiElements.timeOfDayUI) {
        let timeText = '';
        if(gameState.gamePhase === 'lobby' || gameState.gamePhase === 'loading') {
            timeText = gameState.gamePhase.charAt(0).toUpperCase() + gameState.gamePhase.slice(1);
        } else if (gameState.isNight) {
            timeText = 'Night';
        } else if (gameState.currentPeriodIndex >= 0) {
            timeText = `Day Period ${gameState.currentPeriodIndex + 1}`;
        } else {
            timeText = 'Starting...';
        }
        uiElements.timeOfDayUI.textContent = timeText;
    }
    if (uiElements.cycleTimerUI) {
         // Calculate time left based on server's timeInCycle
         let timeLeft = 0;
         if (gameState.isNight) {
             const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
             timeLeft = Config.NIGHT_DURATION - timeIntoNight;
         } else if (gameState.currentPeriodIndex >= 0) {
             const timeIntoPeriod = gameState.timeInCycle - (gameState.currentPeriodIndex * Config.PERIOD_DURATION);
             timeLeft = Config.PERIOD_DURATION - timeIntoPeriod;
         } else {
             timeLeft = Config.PERIOD_DURATION - gameState.timeInCycle; // Time left in first period (or before start)
         }
         uiElements.cycleTimerUI.textContent = gameState.gamePhase === 'playing' ? Math.max(0, Math.floor(timeLeft)) : '--'; // Only show timer when playing
    }

    // Update Weather Status UI (use global server state)
    if (uiElements.weatherStatusUI) {
        let weatherText = '';
        if(gameState.gamePhase === 'lobby' || gameState.gamePhase === 'loading') {
             weatherText = '--';
        } else if (gameState.currentPeriodIndex === -1 && !gameState.isNight && gameState.gamePhase !== 'playing') {
            weatherText = 'Initializing...';
        } else {
            if (gameState.isNight) {
                weatherText = 'Night';
            } else {
                // Determine light condition text based on server multiplier
                 weatherText = (gameState.currentLightMultiplier === Config.LIGHT_MULT_SUNNY) ? 'Sunny' : 'Cloudy';
            }
            if (gameState.isRaining) {
                weatherText += ', Raining';
            }
            // Add drought status based on server factor
            if (gameState.currentDroughtFactor > Config.DROUGHT_MULT_BASE + Config.DROUGHT_VARIATION * 0.6) {
                weatherText += ' (Dry)';
            } else if (gameState.currentDroughtFactor < Config.DROUGHT_MULT_BASE - Config.DROUGHT_VARIATION * 0.6) {
                weatherText += ' (Wet)';
            }
        }
        uiElements.weatherStatusUI.textContent = weatherText;
    }

    // --- Update Controls (Bottom Bar) ---
    // Controls should reflect the player's *intended* state, which is sent to server.
    // For now, keep updating them based on local interaction, handlers will send to server.
    // We might want server to confirm the state later if needed.
    // Slider values are handled by event listeners + controlsHandlers.js now
    // We only need to update the TEXT displays if they aren't updated by handlers
    const stomataValue = myState?.stomatalConductance ?? 0.5; // Default if no state
    const savingsValue = myState?.lastSavingsPercent ?? 50;
    const growthRatioValue = myState?.lastGrowthRatioPercent ?? 50;

    if (uiElements.stomataValueUI) {
         // Ensure text matches the actual state value (might differ slightly from slider during drag)
         // uiElements.stomataValueUI.textContent = `${Math.round(stomataValue * 100)}%`;
         // Let the input handler manage this text for responsiveness
    }
    if (uiElements.savingsPercentageUI) {
         // uiElements.savingsPercentageUI.textContent = `${savingsValue}%`;
         // Let the input handler manage this text
    }
    if (uiElements.growthRatioPercentageUI) {
         // const seedRatioPercent = 100 - growthRatioValue;
         // uiElements.growthRatioPercentageUI.textContent = `${growthRatioValue}%/${seedRatioPercent}%`;
          // Let the input handler manage this text
     }

     // Hide controls if spectator or game over?
     if (uiElements.controlPanelRight) { // Assuming control-panel-right is the container
        const shouldShowControls = myState && myState.isAlive && !gameState.isSpectator && !gameState.gameOver;
        uiElements.controlPanelRight.style.display = shouldShowControls ? 'flex' : 'none';
     }


    // --- Update Leaderboard (Top Right) ---
    if (uiElements.leaderboardListUI) {
        let leaderboardHTML = '';
        // Sort players by seed count (descending)
        const sortedPlayerIds = Object.keys(gameState.players).sort((a, b) => {
            const playerA = gameState.players[a];
            const playerB = gameState.players[b];
            return (playerB?.seedCount ?? 0) - (playerA?.seedCount ?? 0);
        });

        sortedPlayerIds.forEach(playerId => {
            const player = gameState.players[playerId];
            if (player) {
                const isMe = playerId === gameState.myId;
                const status = player.isAlive ? '' : ' (Dead)';
                const name = player.playerName || `Player ${playerId.substring(0,4)}`;
                leaderboardHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}: ${player.seedCount} Seeds</li>`;
            }
        });
        uiElements.leaderboardListUI.innerHTML = leaderboardHTML || '<li>Waiting for players...</li>';
    }
    if (uiElements.treeCountUI) {
        // Count alive players
        const aliveCount = Object.values(gameState.players).filter(p => p.isAlive).length;
        uiElements.treeCountUI.textContent = aliveCount;
    }
}