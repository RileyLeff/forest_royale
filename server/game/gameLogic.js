// server/game/gameLogic.js
import { getGlobalState, getAllPlayers, setGamePhase, resetGlobalStateValues, updateGlobalState, getPlayerState } from './GameState.js';
// Import simulation control functions and main server start function
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
// Import broadcaster
import { broadcastGameState } from '../network/stateBroadcaster.js';

const COUNTDOWN_DURATION = 5; // Seconds for the lobby countdown
let countdownInterval = null; // Interval ID for the countdown timer

/** Starts the lobby countdown timer. */
export function startLobbyCountdown(io) {
    const globalState = getGlobalState();
    if (globalState.gamePhase !== 'lobby' || countdownInterval) { console.log("GameLogic: Cannot start countdown."); return; }
    if (Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length === 0) { console.log("GameLogic: Cannot start countdown, no active players."); return; } // Don't start if only spectators

    console.log(`GameLogic: Starting ${COUNTDOWN_DURATION}s countdown...`);
    setGamePhase('countdown');
    updateGlobalState({ countdownTimer: COUNTDOWN_DURATION });
    broadcastGameState(io, getAllPlayers(), globalState); // Broadcast state with timer

    countdownInterval = setInterval(() => {
        const state = getGlobalState();
        if (state.gamePhase !== 'countdown' || state.countdownTimer === null) { console.warn("GameLogic: Countdown interval invalid state. Cancelling."); cancelLobbyCountdown(); return; }
        if (Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length === 0) { console.log("GameLogic: No active players left during countdown. Cancelling."); cancelLobbyCountdown(); setGamePhase('lobby'); broadcastGameState(io, getAllPlayers(), getGlobalState()); return; } // Cancel if lobby empties of players

        const newTime = state.countdownTimer - 1;
        updateGlobalState({ countdownTimer: newTime });
        // Main loop broadcasts the new timer value

        if (newTime <= 0) { console.log("GameLogic: Countdown finished. Triggering game start."); cancelLobbyCountdown(); triggerServerStartGame(); }
    }, 1000);
}

/** Cancels the lobby countdown if it's running. */
export function cancelLobbyCountdown() {
    if (countdownInterval) { console.log("GameLogic: Cancelling lobby countdown interval."); clearInterval(countdownInterval); countdownInterval = null; updateGlobalState({ countdownTimer: null }); }
}

/** Ends the current game round. Accepts optional reason. */
export function endGame(io, players, globalState, reason = "All trees have perished!") { // Added reason parameter
    if (globalState.gamePhase !== 'playing' && globalState.gamePhase !== 'countdown') { // Allow ending countdown too
        console.log(`GameLogic: endGame called but game not playing/countdown. Phase: ${globalState.gamePhase}`);
        stopSimulation(); cancelLobbyCountdown(); // Ensure both stopped
        if (globalState.gamePhase !== 'ended') setGamePhase('ended');
        // Still broadcast the ended state if phase wasn't already ended
        broadcastGameState(io, players, globalState);
        return;
    }

    console.log("GameLogic: Determining winner and ending game.");
    stopSimulation(); cancelLobbyCountdown(); // Stop both loops
    setGamePhase('ended');

    let winnerId = null; let maxSeeds = -1;
    Object.values(players).forEach(p => { if (!p.isSpectator && p.seedCount > maxSeeds) { maxSeeds = p.seedCount; winnerId = p.id; } }); // Exclude spectators from winning

    console.log(`GameLogic: Game Ended. Winner: ${winnerId || 'None'} with ${maxSeeds} seeds. Reason: ${reason}`);

    io.emit('gameOver', { reason: reason, winnerId: winnerId }); // Send reason to clients
    broadcastGameState(io, players, globalState); // Broadcast final ended state
}

/** Resets the game state fully. */
export function resetGame() {
    console.log("GameLogic: Resetting game state...");
    cancelLobbyCountdown(); stopSimulation(); resetGlobalStateValues();
    console.log("GameLogic: Game reset complete.");
}