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
    const allConnections = gameState.players || {}; // Use empty object if players doesn't exist yet
    const isSpectator = gameState.isSpectator; // Use the flag from client gameState

    // +++ Consistent Player/Spectator Filtering +++
    const allPlayerArray = Object.values(allConnections);
    // Filter for actual players (non-spectators, non-admins)
    const activePlayers = allPlayerArray.filter(p => p && !p.isSpectator && !p.playerName.startsWith('ADMIN_'));
    // Count total connections (including spectators/admins)
    const totalConnectionsCount = allPlayerArray.length;
    // Count active players
    const activePlayerCount = activePlayers.length;
    // Count alive among active players
    const alivePlayerCount = activePlayers.filter(p => p.isAlive).length;


    // --- Update Status Bars (Bottom Left) ---
    if (uiElements.bottomLeftStatus) { // Check element exists before accessing style
        uiElements.bottomLeftStatus.style.display = isSpectator ? 'none' : 'block';
    }
    if (!isSpectator && gameState.initialStateReceived && myState) { // Ensure myState exists too
        const carbon = myState.carbonStorage ?? 0; const maxCarbon = Config.MAX_CARBON;
        const hydraulics = myState.hydraulicSafety ?? 0; const maxHydraulics = myState.maxHydraulic ?? Config.BASE_HYDRAULIC;
        const seeds = myState.seedCount ?? 0;
        if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(carbon / maxCarbon) * 100}%`;
        if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = maxHydraulics > 0 ? `${(hydraulics / maxHydraulics) * 100}%` : '0%';
        if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(carbon);
        if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(hydraulics);
        if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = seeds;
    } else if (!isSpectator && uiElements.bottomLeftStatus) { // Only reset if panel exists
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
        // Show lobby panel only if NOT spectator AND in lobby/countdown
        const showLobbyPanel = !isSpectator && (phase === 'lobby' || phase === 'countdown');
        uiElements.lobbyInfoPanel.style.display = showLobbyPanel ? 'block' : 'none';

        if (showLobbyPanel) {
            // +++ Use activePlayerCount for Lobby Player Count (excluding spectators/admins) +++
            if (uiElements.lobbyPlayerCountUI) uiElements.lobbyPlayerCountUI.textContent = activePlayerCount;

            // Control visibility of lobby instruction
            if (uiElements.lobbyInstructionUI) {
                uiElements.lobbyInstructionUI.style.display = (phase === 'lobby') ? 'block' : 'none'; // Show only in lobby
            }

            // Update start countdown button state
            if (uiElements.startCountdownButton) {
                const canStart = gameState.allowPlayerCountdownStart && activePlayerCount > 0; // Check admin setting and if players exist
                uiElements.startCountdownButton.disabled = (phase === 'countdown' || !canStart);
                uiElements.startCountdownButton.textContent = (phase === 'countdown') ? 'Countdown...' : 'Start Countdown';
                // Optionally add a title if disabled due to admin setting
                uiElements.startCountdownButton.title = !gameState.allowPlayerCountdownStart ? "Admin has disabled player start" : "";
             }

            // Countdown Timer Display
            if (uiElements.countdownTimerDisplayUI) {
                if (phase === 'countdown' && gameState.countdownTimer !== null && gameState.countdownTimer >= 0) { // Check >= 0
                    // console.log(`UI Update: Countdown phase, timer value: ${gameState.countdownTimer}`);
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
        // Show controls ONLY if playing, alive, and NOT spectator
        const showControls = phase === 'playing' && myState && myState.isAlive && !isSpectator && !gameState.gameOver;
        uiElements.controlPanelRight.style.display = showControls ? 'flex' : 'none';
    }

    // --- Update Leaderboard / Player List (Top Right) ---
    if (uiElements.leaderboardTitleUI) {
         // +++ Use activePlayerCount for game title +++
         if (phase === 'lobby' || phase === 'countdown') uiElements.leaderboardTitleUI.textContent = `Players (${activePlayerCount})`; // Show only active players count
         else uiElements.leaderboardTitleUI.textContent = `Leaderboard (${alivePlayerCount}/${activePlayerCount})`; // Show Alive/Total Active Players
     }
    if (uiElements.leaderboardListUI) {
        let listHTML = '';
        // --- Determine players to display based on phase ---
        let playersToDisplay = [];
        if (phase === 'lobby' || phase === 'countdown') {
            // *** Filter spectators/admins even in lobby/countdown ***
            playersToDisplay = allPlayerArray.filter(p => p && !p.isSpectator && !p.playerName.startsWith('ADMIN_')); // Filter out spectators and admins
            playersToDisplay.sort((a, b) => (a?.playerName || '').localeCompare(b?.playerName || '')); // Sort remaining by name
        } else { // Playing or Ended phase
            playersToDisplay = allPlayerArray.filter(p => p && !p.isSpectator && !p.playerName.startsWith('ADMIN_')); // Filter out spectators and admins
            playersToDisplay.sort((a, b) => (b?.seedCount ?? 0) - (a?.seedCount ?? 0)); // Sort remaining by seeds
        }

        // --- Generate HTML list from the filtered playersToDisplay ---
        playersToDisplay.forEach(player => {
            const isMe = player.id === gameState.myId; // Check if it's the current player
            let status = '';
            if (phase === 'lobby' || phase === 'countdown') {
                status = player.hasChosenSpawn ? ' (Placed)' : '';
            } else { // Playing or Ended
                status = player.isAlive ? '' : ' (Dead)';
            }
            const name = player.playerName || `Player ${player.id.substring(0,4)}`;
            const seeds = (phase === 'playing' || phase === 'ended') ? `: ${player.seedCount} Seeds` : '';
            // Highlight 'Me' only if not spectator (spectator shouldn't see themselves on leaderboard)
            const highlightClass = (isMe && !isSpectator) ? ' style="font-weight: bold;"' : '';
            listHTML += `<li${highlightClass}>${name}${status}${seeds}</li>`;
        });


        // --- Handle empty list conditions (considering only NON-spectators/admins now) ---
        if (listHTML === '') {
             if (totalConnectionsCount > 0 && activePlayerCount === 0) {
                 listHTML = '<li>Only spectators/admins connected...</li>';
             } else if (totalConnectionsCount === 0) {
                 listHTML = '<li>Waiting for players...</li>';
             } else if (phase !== 'loading') {
                 // This case might occur if playersToDisplay was filtered to empty but connections existed
                 listHTML = '<li>No active players found.</li>';
             }
        }

        uiElements.leaderboardListUI.innerHTML = listHTML;
     }
}