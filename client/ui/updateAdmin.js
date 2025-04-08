// client/ui/updateAdmin.js - UI Updater for Admin Panel
import { gameState } from '../gameState.js';
import * as Config from '../config.js';
import { uiElements } from './elements.js'; // Use cached elements

/** Updates admin UI elements based on the current gameState. */
export function updateUI() { // Renamed function locally
    // Wait until elements are cached, no need to wait for initial state like player view
    if (!uiElements.dayCounterUI) { return; }

    const phase = gameState.gamePhase;
    const allConnections = gameState.players;
    const playersOnly = Object.values(allConnections).filter(p => !p.isSpectator);
    const playerCount = playersOnly.length;
    const aliveCount = playersOnly.filter(p => p.isAlive).length;

    // --- Update Info (Top Left) ---
    // (Same as regular update.js)
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = (phase !== 'loading') ? gameState.day : '-';
    if (uiElements.timeOfDayUI) { let timeText = ''; if (phase === 'lobby' || phase === 'loading' || phase === 'ended') timeText = phase.charAt(0).toUpperCase() + phase.slice(1); else if (phase === 'countdown') timeText = 'Starting Soon!'; else if (phase === 'playing') { if (gameState.isNight) timeText = 'Night'; else if (gameState.currentPeriodIndex >= 0) timeText = `Day Period ${gameState.currentPeriodIndex + 1}`; else timeText = 'Starting...'; } else timeText = 'Unknown Phase'; uiElements.timeOfDayUI.textContent = timeText; }
    if (uiElements.cycleTimerUI) { let timeLeft = 0; if (phase === 'playing') { if (gameState.isNight) { const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION; timeLeft = Config.NIGHT_DURATION - timeIntoNight; } else if (gameState.currentPeriodIndex >= 0) { const timeIntoPeriod = gameState.timeInCycle - (gameState.currentPeriodIndex * Config.PERIOD_DURATION); timeLeft = Config.PERIOD_DURATION - timeIntoPeriod; } else { timeLeft = Config.PERIOD_DURATION - gameState.timeInCycle; } uiElements.cycleTimerUI.textContent = Math.max(0, Math.floor(timeLeft)); } else { uiElements.cycleTimerUI.textContent = '--'; } }
    if (uiElements.weatherStatusUI) { let weatherText = ''; if(phase === 'lobby' || phase === 'loading' || phase === 'ended' || phase === 'countdown') weatherText = '--'; else if (phase === 'playing') { if (gameState.isNight) weatherText = 'Night'; else weatherText = (gameState.currentLightMultiplier === Config.LIGHT_MULT_SUNNY) ? 'Sunny' : 'Cloudy'; if (gameState.isRaining) weatherText += ', Raining'; if (gameState.currentDroughtFactor > Config.DROUGHT_MULT_BASE + Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Dry)'; else if (gameState.currentDroughtFactor < Config.DROUGHT_MULT_BASE - Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Wet)'; } else weatherText = 'Initializing...'; uiElements.weatherStatusUI.textContent = weatherText; }

    // --- Update Lobby/Countdown Info (Top Left) ---
    // (Same as regular update.js, but button is hidden via HTML)
    if (uiElements.lobbyInfoPanel) {
        const showLobby = (phase === 'lobby' || phase === 'countdown');
        uiElements.lobbyInfoPanel.style.display = showLobby ? 'block' : 'none';
        if (showLobby) {
            if (uiElements.lobbyPlayerCountUI) uiElements.lobbyPlayerCountUI.textContent = Object.keys(allConnections).length;
             // No start button logic needed here
            if (uiElements.countdownTimerDisplayUI) { if (phase === 'countdown' && gameState.countdownTimer !== null) { uiElements.countdownTimerDisplayUI.textContent = `Starting in: ${gameState.countdownTimer}s`; uiElements.countdownTimerDisplayUI.style.display = 'block'; } else { uiElements.countdownTimerDisplayUI.style.display = 'none'; } }
        }
    }

    // --- Update Leaderboard / Player List (Top Right) ---
    // (Same as regular update.js - shows non-spectators)
    if (uiElements.leaderboardTitleUI) { if (phase === 'lobby' || phase === 'countdown') uiElements.leaderboardTitleUI.textContent = `Lobby (${Object.keys(allConnections).length})`; else uiElements.leaderboardTitleUI.textContent = `Leaderboard (${aliveCount}/${playerCount})`; }
    if (uiElements.leaderboardListUI) { let listHTML = ''; const playersToDisplay = Object.values(allConnections).filter(p => !p.isSpectator); playersToDisplay.sort((a, b) => { if (phase === 'lobby' || phase === 'countdown') { return (a?.playerName || '').localeCompare(b?.playerName || ''); } else { return (b?.seedCount ?? 0) - (a?.seedCount ?? 0); } }); playersToDisplay.forEach(player => { const isMe = player.id === gameState.myId; let status = ''; if (player.isSpectator) status = ' (Spectating)'; else if (phase === 'playing' || phase === 'ended') status = player.isAlive ? '' : ' (Dead)'; else if (phase === 'lobby' || phase === 'countdown') status = player.hasChosenSpawn ? ' (Placed)' : ''; const name = player.playerName || `Player ${player.id.substring(0,4)}`; const seeds = (phase === 'playing' || phase === 'ended') ? `: ${player.seedCount} Seeds` : ''; listHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}${seeds}</li>`; }); if(listHTML === '' && phase !== 'loading') { if (Object.keys(allConnections).length > 0 && playerCount === 0) listHTML = '<li>Only spectators connected...</li>'; else if (Object.keys(allConnections).length === 0) listHTML = '<li>Waiting for server...</li>'; } uiElements.leaderboardListUI.innerHTML = listHTML; }

    // No need to update player status bars or controls for admin view
}