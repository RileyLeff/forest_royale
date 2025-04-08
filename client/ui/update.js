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
    // Filter for actual players (non-spectators)
    const activePlayers = allPlayerArray.filter(p => p && !p.isSpectator);
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
            // +++ Use totalConnectionsCount for Lobby Player Count +++
            if (uiElements.lobbyPlayerCountUI) uiElements.lobbyPlayerCountUI.textContent = totalConnectionsCount;

            // Control visibility of lobby instruction
            if (uiElements.lobbyInstructionUI) {
                uiElements.lobbyInstructionUI.style.display = (phase === 'lobby') ? 'block' : 'none'; // Show only in lobby
            }

            if (uiElements.startCountdownButton) { uiElements.startCountdownButton.disabled = (phase === 'countdown'); uiElements.startCountdownButton.textContent = (phase === 'countdown') ? 'Countdown...' : 'Start Countdown'; }

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
         // +++ Use totalConnectionsCount for Lobby title, use activePlayerCount for game title +++
         if (phase === 'lobby' || phase === 'countdown') uiElements.leaderboardTitleUI.textContent = `Lobby (${totalConnectionsCount})`;
         else uiElements.leaderboardTitleUI.textContent = `Leaderboard (${alivePlayerCount}/${activePlayerCount})`; // Show Alive/Total Active Players
     }
    if (uiElements.leaderboardListUI) {
        let listHTML = '';
        // +++ Use the pre-filtered activePlayers list +++
        const playersToDisplay = [...activePlayers]; // Create a mutable copy for sorting

        // Sort the filtered players
        playersToDisplay.sort((a, b) => {
            if (phase === 'lobby' || phase === 'countdown') {
                 // Should not be sorting active players in lobby? This list should show spectators too in lobby?
                 // Let's adjust: Sort ALL connections for lobby/countdown display
                 const allSorted = [...allPlayerArray].sort((a, b) => (a?.playerName || '').localeCompare(b?.playerName || ''));
                 listHTML = ''; // Reset listHTML
                 allSorted.forEach(player => {
                    const isMe = player.id === gameState.myId;
                    let status = '';
                    if (player.isSpectator) {
                         status = player.playerName.startsWith('ADMIN_') ? ' (Admin)' : ' (Spectator)';
                    } else {
                         status = player.hasChosenSpawn ? ' (Placed)' : '';
                    }
                    const name = player.playerName || `Player ${player.id.substring(0,4)}`;
                    listHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}</li>`;
                 });

            } else { // Playing or Ended phase - sort active players by seeds
                playersToDisplay.sort((a, b) => (b?.seedCount ?? 0) - (a?.seedCount ?? 0));
                // Generate HTML only for active players
                 playersToDisplay.forEach(player => {
                    const isMe = player.id === gameState.myId;
                    let status = player.isAlive ? '' : ' (Dead)'; // Should always be active player here
                    const name = player.playerName || `Player ${player.id.substring(0,4)}`;
                    const seeds = `: ${player.seedCount} Seeds`;
                    listHTML += `<li${isMe ? ' style="font-weight: bold;"' : ''}>${name}${status}${seeds}</li>`;
                });
            }
            return; // Exit sort callback early if handled lobby case
        });


        // Handle empty list (only if not lobby/countdown where we build it differently)
        if (listHTML === '' && phase !== 'lobby' && phase !== 'countdown') {
             if (totalConnectionsCount > 0 && activePlayerCount === 0) { // Check if connections exist but no active players
                 listHTML = '<li>Only spectators connected...</li>';
             } else if (totalConnectionsCount === 0) { // Check if truly empty
                 listHTML = '<li>Waiting for players...</li>';
             }
        } else if (listHTML === '' && (phase === 'lobby' || phase === 'countdown')) {
             if (totalConnectionsCount === 0) {
                 listHTML = '<li>Waiting for players...</li>';
             }
             // If connections exist but list is empty, it means the allSorted loop failed (shouldn't happen)
        }


        uiElements.leaderboardListUI.innerHTML = listHTML;
     }
}