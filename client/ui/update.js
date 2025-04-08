// client/ui/update.js
import { gameState, getMyPlayerState } from '../gameState.js';
import * as Config from '../config.js';
import { uiElements } from './elements.js';

/** Updates all relevant UI elements based on the current gameState. */
export function updateUI() {
    // Allow update even before initial state for basic loading display
    if (!uiElements.dayCounterUI) { // Check only one essential element that should always exist on game page
        // console.warn("UpdateUI: Waiting for essential UI elements.");
        return;
    }

    const myState = getMyPlayerState();
    const phase = gameState.gamePhase;
    const allConnections = gameState.players; // Get all connections
    const playersOnly = Object.values(allConnections).filter(p => !p.isSpectator); // Filter out spectators
    const playerCount = playersOnly.length; // Count only actual players
    const aliveCount = playersOnly.filter(p => p.isAlive).length; // Count alive among players
    const isSpectator = gameState.isSpectator; // Use the flag from client gameState

    // --- Update Status Bars (Bottom Left) ---
    // Hide if spectator
    if (uiElements.bottomLeftStatus) {
        uiElements.bottomLeftStatus.style.display = isSpectator ? 'none' : 'block';
    }
    if (!isSpectator && gameState.initialStateReceived) { // Only update values if not spectator AND state received
        const carbon = myState?.carbonStorage ?? 0; const maxCarbon = Config.MAX_CARBON;
        const hydraulics = myState?.hydraulicSafety ?? 0; const maxHydraulics = myState?.maxHydraulic ?? Config.BASE_HYDRAULIC;
        const seeds = myState?.seedCount ?? 0;
        if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(carbon / maxCarbon) * 100}%`;
        if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = maxHydraulics > 0 ? `${(hydraulics / maxHydraulics) * 100}%` : '0%';
        if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(carbon);
        if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(hydraulics);
        if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = seeds;
    } else if (!isSpectator) {
         // Show default '--' if not spectator but state not ready
        if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = '--';
        if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = '--';
        if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = '0';
        if (uiElements.carbonBar) uiElements.carbonBar.style.width = '0%';
        if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = '0%';
    }

    // --- Update Info (Top Left) ---
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = (phase !== 'loading') ? gameState.day : '-';
    if (uiElements.timeOfDayUI) {
        let timeText = '';
        if (phase === 'lobby' || phase === 'loading' || phase === 'ended') timeText = phase.charAt(0).toUpperCase() + phase.slice(1);
        else if (phase === 'countdown') timeText = 'Starting Soon!';
        else if (phase === 'playing') { if (gameState.isNight) timeText = 'Night'; else if (gameState.currentPeriodIndex >= 0) timeText = `Day Period ${gameState.currentPeriodIndex + 1}`; else timeText = 'Starting...'; }
        else timeText = 'Unknown Phase';
        uiElements.timeOfDayUI.textContent = timeText;
     }
    if (uiElements.cycleTimerUI) {
        let timeLeft = 0; if (phase === 'playing') { if (gameState.isNight) { const timeIntoNight = gameState.timeInCycle - Config.DAY_TOTAL_DURATION; timeLeft = Config.NIGHT_DURATION - timeIntoNight; } else if (gameState.currentPeriodIndex >= 0) { const timeIntoPeriod = gameState.timeInCycle - (gameState.currentPeriodIndex * Config.PERIOD_DURATION); timeLeft = Config.PERIOD_DURATION - timeIntoPeriod; } else { timeLeft = Config.PERIOD_DURATION - gameState.timeInCycle; } uiElements.cycleTimerUI.textContent = Math.max(0, Math.floor(timeLeft)); } else { uiElements.cycleTimerUI.textContent = '--'; }
     }
    if (uiElements.weatherStatusUI) {
        let weatherText = ''; if(phase === 'lobby' || phase === 'loading' || phase === 'ended' || phase === 'countdown') weatherText = '--'; else if (phase === 'playing') { if (gameState.isNight) weatherText = 'Night'; else weatherText = (gameState.currentLightMultiplier === Config.LIGHT_MULT_SUNNY) ? 'Sunny' : 'Cloudy'; if (gameState.isRaining) weatherText += ', Raining'; if (gameState.currentDroughtFactor > Config.DROUGHT_MULT_BASE + Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Dry)'; else if (gameState.currentDroughtFactor < Config.DROUGHT_MULT_BASE - Config.DROUGHT_VARIATION * 0.6) weatherText += ' (Wet)'; } else weatherText = 'Initializing...'; uiElements.weatherStatusUI.textContent = weatherText;
     }

    // --- Update Lobby/Countdown UI (Top Left) ---
    if (uiElements.lobbyInfoPanel) {
        // Show only if NOT spectator AND in lobby/countdown
        const showLobby = !isSpectator && (phase === 'lobby' || phase === 'countdown');
        uiElements.lobbyInfoPanel.style.display = showLobby ? 'block' : 'none';
        if (showLobby) {
            if (uiElements.lobbyPlayerCountUI) uiElements.lobbyPlayerCountUI.textContent = Object.keys(allConnections).length; // Show total connections in lobby
            if (uiElements.startCountdownButton) { uiElements.startCountdownButton.disabled = (phase === 'countdown'); uiElements.startCountdownButton.textContent = (phase === 'countdown') ? 'Countdown...' : 'Start Countdown'; }
            if (uiElements.countdownTimerDisplayUI) { if (phase === 'countdown' && gameState.countdownTimer !== null) { uiElements.countdownTimerDisplayUI.textContent = `Starting in: ${gameState.countdownTimer}s`; uiElements.countdownTimerDisplayUI.style.display = 'block'; } else { uiElements.countdownTimerDisplayUI.style.display = 'none'; } }
         }
    }


    // --- Update Controls (Bottom Right) ---
    if (uiElements.controlPanelRight) {
        // Show controls ONLY if playing, alive, and NOT spectator
        const showControls = phase === 'playing' && myState && myState.isAlive && !isSpectator && !gameState.gameOver;
        uiElements.controlPanelRight.style.display = showControls ? 'flex' : 'none';
    }

    // --- Update Leaderboard / Player List (Top Right) ---
    if (uiElements.leaderboardTitleUI) {
         // Show total connections in lobby title, show active player count otherwise
         if (phase === 'lobby' || phase === 'countdown') uiElements.leaderboardTitleUI.textContent = `Lobby (${Object.keys(allConnections).length})`;
         else uiElements.leaderboardTitleUI.textContent = `Leaderboard (${aliveCount}/${playerCount})`; // Show Alive/Total Players
     }
    if (uiElements.leaderboardListUI) {
        let listHTML = '';
        // Filter out spectators BEFORE sorting and rendering the list
        const playersToDisplay = Object.values(allConnections).filter(p => !p.isSpectator);

        // Sort the filtered players
        playersToDisplay.sort((a, b) => {
            if (phase === 'lobby' || phase === 'countdown') {
                 return (a?.playerName || '').localeCompare(b?.playerName || ''); // Sort lobby alphabetically
            } else {
                return (b?.seedCount ?? 0) - (a?.seedCount ?? 0); // Sort game by seeds
            }
        });

        // Generate HTML only for non-spectators
        playersToDisplay.forEach(player => {
            const isMe = player.id === gameState.myId;
            let status = '';
            if (phase === 'playing' || phase === 'ended') status = player.isAlive ? '' : ' (Dead)';
            else if (phase === 'lobby' || phase === 'countdown') status = player.hasChosenSpawn ? ' (Placed)' : '';
            const name = player.playerName || `Player ${player.id.substring(0,4)}`;
            // Only show seeds if game is playing or ended
            const seeds = (phase === 'playing' || phase === 'ended') ? `: ${player.seedCount} Seeds` : '';
            listHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}${seeds}</li>`;
        });

        // Handle empty player list or only spectators connected
        if(listHTML === '' && phase !== 'loading') {
            if (Object.keys(allConnections).length > 0 && playerCount === 0) { // Check if connections exist but no players
                 listHTML = '<li>Only spectators connected...</li>';
            } else if (Object.keys(allConnections).length === 0) { // Check if truly empty
                 listHTML = '<li>Waiting for players...</li>';
            }
             // If listHTML is still empty here, it means players exist but loop didn't add them? Should not happen.
        }

        uiElements.leaderboardListUI.innerHTML = listHTML;
     }
}