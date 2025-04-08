// client/ui/update.js
import { gameState, getMyPlayerState } from '../gameState.js';
import * as Config from '../config.js';
import { uiElements } from './elements.js';

/**
 * Updates all relevant UI elements based on the current gameState.
 */
export function updateUI() {
    if (!gameState.initialStateReceived || !uiElements.carbonBar || !uiElements.dayCounterUI) {
        return;
    }

    const myState = getMyPlayerState();
    const phase = gameState.gamePhase;
    const playerCount = Object.keys(gameState.players).length;
    const aliveCount = Object.values(gameState.players).filter(p => p.isAlive).length;

    // --- Update Status Bars (Bottom Left) ---
    // (Logic remains the same as before)
    const carbon = myState?.carbonStorage ?? 0;
    const maxCarbon = Config.MAX_CARBON;
    const hydraulics = myState?.hydraulicSafety ?? 0;
    const maxHydraulics = myState?.maxHydraulic ?? Config.BASE_HYDRAULIC;
    const seeds = myState?.seedCount ?? 0;
    if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(carbon / maxCarbon) * 100}%`;
    if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = maxHydraulics > 0 ? `${(hydraulics / maxHydraulics) * 100}%` : '0%';
    if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(carbon);
    if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(hydraulics);
    if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = seeds;


    // --- Update Info (Top Left) ---
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = gameState.day;
    if (uiElements.timeOfDayUI) {
        let timeText = '';
        if (phase === 'lobby' || phase === 'loading' || phase === 'ended') {
            timeText = phase.charAt(0).toUpperCase() + phase.slice(1);
        } else if (phase === 'countdown') {
             timeText = 'Starting Soon!';
        } else if (phase === 'playing') {
            if (gameState.isNight) timeText = 'Night';
            else if (gameState.currentPeriodIndex >= 0) timeText = `Day Period ${gameState.currentPeriodIndex + 1}`;
            else timeText = 'Starting...';
        } else {
            timeText = 'Unknown Phase';
        }
        uiElements.timeOfDayUI.textContent = timeText;
    }
    if (uiElements.cycleTimerUI) {
         let timeLeft = 0;
         if (phase === 'playing') { // Only calculate if playing
            if (gameState.isNight) {
                const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION;
                timeLeft = Config.NIGHT_DURATION - timeIntoNight;
            } else if (gameState.currentPeriodIndex >= 0) {
                const timeIntoPeriod = gameState.timeInCycle - (gameState.currentPeriodIndex * Config.PERIOD_DURATION);
                timeLeft = Config.PERIOD_DURATION - timeIntoPeriod;
            } else {
                timeLeft = Config.PERIOD_DURATION - gameState.timeInCycle;
            }
            uiElements.cycleTimerUI.textContent = Math.max(0, Math.floor(timeLeft));
         } else {
              uiElements.cycleTimerUI.textContent = '--'; // Show '--' if not playing
         }
    }
    if (uiElements.weatherStatusUI) {
        // (Weather logic remains the same, shows '--' if not playing)
        let weatherText = '';
        if(phase === 'lobby' || phase === 'loading' || phase === 'ended' || phase === 'countdown') {
             weatherText = '--';
        } else if (phase === 'playing') {
            if (gameState.isNight) weatherText = 'Night';
            else weatherText = (gameState.currentLightMultiplier === Config.LIGHT_MULT_SUNNY) ? 'Sunny' : 'Cloudy';
            if (gameState.isRaining) weatherText += ', Raining';
            if (gameState.currentDroughtFactor > Config.DROUGHT_MULT_BASE + Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Dry)';
            else if (gameState.currentDroughtFactor < Config.DROUGHT_MULT_BASE - Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Wet)';
        } else {
            weatherText = 'Initializing...';
        }
        uiElements.weatherStatusUI.textContent = weatherText;
    }

    // --- Update Lobby/Countdown UI (Top Left) ---
    if (uiElements.lobbyInfoPanel) {
        const showLobby = (phase === 'lobby' || phase === 'countdown');
        uiElements.lobbyInfoPanel.style.display = showLobby ? 'block' : 'none';
        if (showLobby) {
            if (uiElements.lobbyPlayerCountUI) uiElements.lobbyPlayerCountUI.textContent = playerCount;
            if (uiElements.startCountdownButton) {
                // Disable button if countdown running or game starting/ended
                uiElements.startCountdownButton.disabled = (phase === 'countdown' || phase === 'playing' || phase === 'ended');
                uiElements.startCountdownButton.textContent = (phase === 'countdown') ? 'Countdown Started...' : 'Start Game Countdown';
            }
            if (uiElements.countdownTimerDisplayUI) {
                if (phase === 'countdown' && gameState.countdownTimer !== null) {
                    uiElements.countdownTimerDisplayUI.textContent = `Starting in: ${gameState.countdownTimer}s`;
                    uiElements.countdownTimerDisplayUI.style.display = 'block';
                } else {
                    uiElements.countdownTimerDisplayUI.style.display = 'none';
                }
            }
        }
    }


    // --- Update Controls (Bottom Right) ---
    if (uiElements.controlPanelRight) {
        // Show controls ONLY if playing, alive, and not spectator/game over
        const showControls = phase === 'playing' && myState && myState.isAlive && !gameState.isSpectator && !gameState.gameOver;
        uiElements.controlPanelRight.style.display = showControls ? 'flex' : 'none';
    }
     // Control slider values/text are updated by handlers

    // --- Update Leaderboard / Player List (Top Right) ---
    if (uiElements.leaderboardTitleUI) {
         if (phase === 'lobby' || phase === 'countdown') {
              uiElements.leaderboardTitleUI.textContent = `Lobby (${playerCount})`;
         } else {
              uiElements.leaderboardTitleUI.textContent = `Leaderboard (${aliveCount} Remaining)`;
         }
    }
    if (uiElements.leaderboardListUI) {
        let listHTML = '';
        const sortedPlayerIds = Object.keys(gameState.players).sort((a, b) => {
            const playerA = gameState.players[a];
            const playerB = gameState.players[b];
            // Sort differently depending on phase
            if (phase === 'lobby' || phase === 'countdown') {
                 // Maybe sort alphabetically or by connection order? Alphabetical for now.
                 return (playerA?.playerName || '').localeCompare(playerB?.playerName || '');
            } else {
                // Sort by seeds descending when playing/ended
                return (playerB?.seedCount ?? 0) - (playerA?.seedCount ?? 0);
            }
        });

        sortedPlayerIds.forEach(playerId => {
            const player = gameState.players[playerId];
            if (player) {
                const isMe = playerId === gameState.myId;
                let status = '';
                if (phase === 'playing' || phase === 'ended') {
                     status = player.isAlive ? '' : ' (Dead)';
                } else {
                     // Lobby status (e.g., chosen spawn?)
                     status = player.hasChosenSpawn ? ' (Placed)' : ''; // Example
                }
                const name = player.playerName || `Player ${playerId.substring(0,4)}`;
                const seeds = (phase === 'playing' || phase === 'ended') ? `: ${player.seedCount} Seeds` : '';
                listHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}${seeds}</li>`;
            }
        });
        uiElements.leaderboardListUI.innerHTML = listHTML || '<li>Waiting for players...</li>';
    }
    // treeCountUI is updated within leaderboardTitleUI logic now
}