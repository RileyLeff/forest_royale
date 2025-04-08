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
    // --- Guard Clauses ---
    if (globalState.gamePhase !== 'lobby' || countdownInterval) {
        console.log(`GameLogic: Cannot start countdown. Phase: ${globalState.gamePhase}, Interval Exists: ${!!countdownInterval}`);
        return;
    }
    const activePlayerCount = Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length;
    if (activePlayerCount === 0) {
        console.log("GameLogic: Cannot start countdown, no active players.");
        // Maybe send a message back to the requester?
        // Example: io.to(socketId).emit('serverMessage', { text: 'Need players to start!', type: 'warning' });
        return;
    }

    console.log(`GameLogic: Starting ${COUNTDOWN_DURATION}s countdown for ${activePlayerCount} players...`);
    setGamePhase('countdown');
    updateGlobalState({ countdownTimer: COUNTDOWN_DURATION }); // Set initial timer value
    broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast initial countdown state (Phase: countdown, Timer: 5)

    // --- The Interval ---
    countdownInterval = setInterval(() => {
        // +++ Log entry into interval +++
        console.log("GameLogic: Countdown interval tick...");

        // Get the *current* state inside the interval callback
        const state = getGlobalState(); // Fetch fresh state each time

        // +++ Log current state values +++
        console.log(`GameLogic: Tick - Phase: ${state.gamePhase}, Current Timer: ${state.countdownTimer}`);

        // --- Guard clauses inside interval ---
        if (state.gamePhase !== 'countdown' || state.countdownTimer === null) {
            console.warn(`GameLogic: Countdown interval invalid state (Phase: ${state.gamePhase}, Timer: ${state.countdownTimer}). Cancelling.`);
            cancelLobbyCountdown(); // Use the cancel function
            return; // Stop this tick execution
        }

        const currentActivePlayers = Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length;
        if (currentActivePlayers === 0) {
            console.log("GameLogic: No active players left during countdown tick. Cancelling.");
            cancelLobbyCountdown(); // Use the cancel function
            setGamePhase('lobby'); // Go back to lobby
            broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast lobby state
            return; // Stop this tick execution
        }

        // --- Decrement timer ---
        const newTime = state.countdownTimer - 1;
        updateGlobalState({ countdownTimer: newTime }); // Update the global state

        // +++ Log the new timer value +++
        console.log(`GameLogic: Countdown timer updated to: ${newTime}`);

        // --- Broadcast the updated state *after* decrementing ---
        console.log("GameLogic: Broadcasting updated countdown state...");
        broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast (Phase: countdown, Timer: newTime)

        // --- Check for finish condition ---
        if (newTime <= 0) {
            console.log("GameLogic: Countdown finished (newTime <= 0). Triggering game start.");
            // It's crucial to cancel the interval *before* triggering start game,
            // as startGame might change the phase, affecting the guard clause next tick.
            cancelLobbyCountdown(); // Use the cancel function FIRST
            triggerServerStartGame(); // Then start the game
            // No need to broadcast here, triggerServerStartGame changes phase and broadcasts
        } else {
            console.log("GameLogic: Countdown continues...");
        }

    }, 1000); // Interval is 1000ms (1 second)
}

/** Cancels the lobby countdown if it's running. */
export function cancelLobbyCountdown() {
    if (countdownInterval) {
        console.log("GameLogic: Cancelling lobby countdown interval.");
        clearInterval(countdownInterval);
        countdownInterval = null; // Clear the interval ID tracker
        // It's often good practice to also null the timer value in the state when cancelling
        // updateGlobalState({ countdownTimer: null }); // Ensure timer is nulled
        // Note: If called *before* phase change, subsequent broadcasts will show timer=null
    } else {
        // console.log("GameLogic: cancelLobbyCountdown called but no interval was running."); // Optional log
    }
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
    // --- Stop loops first ---
    stopSimulation(); // Stop the main simulation if it's running
    cancelLobbyCountdown(); // Stop the countdown interval if it's running

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
    // Ensure both potential loops are stopped
    cancelLobbyCountdown();
    stopSimulation();
    // Reset global values and set phase to 'lobby'
    resetGlobalStateValues(); // Resets time, weather, sets phase to 'lobby', countdownTimer to null
    // Note: Players are not cleared here; disconnect/reconnect handles that.
    // Reset any necessary player state flags if needed (like growthAppliedThisCycle)
    Object.values(getAllPlayers()).forEach(p => {
        p.growthAppliedThisCycle = false;
        p.foliarUptakeAppliedThisNight = false;
        // Don't reset hasChosenSpawn here, let new joins handle it
    });
    console.log("GameLogic: Game reset complete. Ready for lobby.");
}