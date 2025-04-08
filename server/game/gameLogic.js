// server/game/gameLogic.js
import { getGlobalState, getAllPlayers, setGamePhase, resetGlobalStateValues, updateGlobalState, getPlayerState } from './GameState.js';
// Import simulation control functions and main server start function
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
// Import broadcaster
import { broadcastGameState } from '../network/stateBroadcaster.js';

const COUNTDOWN_DURATION = 5; // Seconds for the lobby countdown
let countdownInterval = null; // Interval ID for the countdown timer

/** Starts the lobby countdown timer. */
export function startLobbyCountdown(io) { /* ... start countdown logic (no changes needed here) ... */
    const globalState = getGlobalState(); if (globalState.gamePhase !== 'lobby' || countdownInterval) { console.log("GameLogic: Cannot start countdown."); return; } if (Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length === 0) { console.log("GameLogic: Cannot start countdown, no active players."); return; }
    console.log(`GameLogic: Starting ${COUNTDOWN_DURATION}s countdown...`); setGamePhase('countdown'); updateGlobalState({ countdownTimer: COUNTDOWN_DURATION }); broadcastGameState(io, getAllPlayers(), getGlobalState());
    countdownInterval = setInterval(() => { const state = getGlobalState(); if (state.gamePhase !== 'countdown' || state.countdownTimer === null) { console.warn("GameLogic: Countdown interval invalid state. Cancelling."); cancelLobbyCountdown(); return; } if (Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length === 0) { console.log("GameLogic: No active players left during countdown. Cancelling."); cancelLobbyCountdown(); setGamePhase('lobby'); broadcastGameState(io, getAllPlayers(), getGlobalState()); return; } const newTime = state.countdownTimer - 1; updateGlobalState({ countdownTimer: newTime }); if (newTime <= 0) { console.log("GameLogic: Countdown finished. Triggering game start."); cancelLobbyCountdown(); triggerServerStartGame(); } }, 1000);
}

/** Cancels the lobby countdown if it's running. */
export function cancelLobbyCountdown() { /* ... cancel countdown logic (no changes needed here) ... */
    if (countdownInterval) { console.log("GameLogic: Cancelling lobby countdown interval."); clearInterval(countdownInterval); countdownInterval = null; updateGlobalState({ countdownTimer: null }); }
}

/** Ends the current game round. Accepts optional reason. Calls resetGame afterwards. */
export function endGame(io, players, globalState, reason = "All trees have perished!") {
    // Check if game is actually in a state that can be ended
    if (globalState.gamePhase !== 'playing' && globalState.gamePhase !== 'countdown') {
        console.log(`GameLogic: endGame called but game not playing/countdown. Phase: ${globalState.gamePhase}. Ensuring reset.`);
        // Ensure simulation/countdown are stopped and state is reset properly even if called in wrong phase
        resetGame(); // Call reset to clean up and go to lobby
        return;
    }

    console.log("GameLogic: Determining winner and ending game.");
    stopSimulation(); cancelLobbyCountdown(); // Stop loops first
    setGamePhase('ended'); // Set phase to ended

    let winnerId = null; let maxSeeds = -1;
    Object.values(players).forEach(p => { if (!p.isSpectator && p.seedCount > maxSeeds) { maxSeeds = p.seedCount; winnerId = p.id; } });

    console.log(`GameLogic: Game Ended. Winner: ${winnerId || 'None'} with ${maxSeeds} seeds. Reason: ${reason}`);

    // Broadcast game over event FIRST, while state is still 'ended'
    io.emit('gameOver', { reason: reason, winnerId: winnerId });
    // Broadcast the final 'ended' state snapshot
    broadcastGameState(io, players, globalState);

    // --- Call resetGame AFTER broadcasting the final 'ended' state ---
    // This ensures clients see the game over message/state before server resets to lobby
    // Add a small delay so clients definitely process the 'gameOver'/'ended' state first
    setTimeout(() => {
        resetGame(); // Reset server to lobby state for the next round
        // Players object will clear as clients disconnect/reconnect after seeing game over
    }, 1000); // 1 second delay before reset (adjust if needed)

}

/** Resets the game state fully, preparing for a new round. */
export function resetGame() {
    // This function should ONLY reset state and stop loops, not handle broadcasts
    console.log("GameLogic: Resetting game state...");
    cancelLobbyCountdown();
    stopSimulation();
    resetGlobalStateValues(); // Resets time, weather, sets phase to 'lobby'
    // Note: Players are not cleared here; disconnect/reconnect handles that.
    console.log("GameLogic: Game reset complete. Ready for lobby.");
}