// server/game/gameLogic.js
import { getGlobalState, getAllPlayers, setGamePhase, resetGlobalStateValues, updateGlobalState, getPlayerState } from './GameState.js';
// Import simulation control functions and main server start function
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';

const COUNTDOWN_DURATION = 30; // Seconds for the lobby countdown
let countdownInterval = null; // Interval ID for the countdown timer

/**
 * Starts the lobby countdown timer.
 * @param {object} io - The Socket.IO server instance for broadcasting updates.
 */
export function startLobbyCountdown(io) {
    const globalState = getGlobalState();
    if (globalState.gamePhase !== 'lobby' || countdownInterval) {
        console.log("GameLogic: Cannot start countdown, not in lobby phase or countdown already running.");
        return;
    }
    if (Object.keys(getAllPlayers()).length === 0) {
         console.log("GameLogic: Cannot start countdown, no players in lobby.");
        return;
    }

    console.log(`GameLogic: Starting ${COUNTDOWN_DURATION} second countdown...`);
    setGamePhase('countdown');
    updateGlobalState({ countdownTimer: COUNTDOWN_DURATION }); // Set initial time

    // Broadcast immediate state change
    broadcastGameState(io, getAllPlayers(), globalState); // Use broadcaster

    countdownInterval = setInterval(() => {
        const currentTimer = getGlobalState().countdownTimer;
        if (currentTimer === null) { // Should not happen, but safety check
            console.warn("GameLogic: Countdown timer is null during interval.");
            cancelLobbyCountdown();
            return;
        }

        const newTime = currentTimer - 1;
        updateGlobalState({ countdownTimer: newTime });

        // Broadcast state update frequently during countdown
        // broadcastGameState(io, getAllPlayers(), getGlobalState()); // Included in main loop broadcast now

        if (newTime <= 0) {
            console.log("GameLogic: Countdown finished. Starting game.");
            cancelLobbyCountdown(); // Clear interval
            triggerServerStartGame(); // Call the main start function from server.js
        }
    }, 1000); // Update every second
}

/**
 * Cancels the lobby countdown if it's running.
 */
export function cancelLobbyCountdown() {
    if (countdownInterval) {
        console.log("GameLogic: Cancelling lobby countdown.");
        clearInterval(countdownInterval);
        countdownInterval = null;
        updateGlobalState({ countdownTimer: null }); // Clear timer value
        // Optionally set phase back to lobby if needed, depends on calling context
        // setGamePhase('lobby');
    }
}


/**
 * Ends the current game round if it's in the 'playing' phase.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} players - The current players state object.
 * @param {object} globalState - The current global state object.
 */
export function endGame(io, players, globalState) {
    if (globalState.gamePhase !== 'playing') {
        console.log("GameLogic: endGame called but game not in 'playing' phase. Phase:", globalState.gamePhase);
        stopSimulation();
        if (globalState.gamePhase !== 'ended') setGamePhase('ended');
        return;
    }

    console.log("GameLogic: Determining winner and ending game.");
    stopSimulation();
    setGamePhase('ended');

    let winnerId = null;
    let maxSeeds = -1;
    Object.values(players).forEach(p => {
        if (p.seedCount > maxSeeds) {
            maxSeeds = p.seedCount;
            winnerId = p.id;
        }
    });

    const reason = "All trees have perished!";
    console.log(`GameLogic: Game Ended. Winner: ${winnerId || 'None'} with ${maxSeeds} seeds.`);

    io.emit('gameOver', {
        reason: reason,
        winnerId: winnerId,
    });
}

/**
 * Resets the game state fully, preparing for a new round.
 */
export function resetGame() {
    console.log("GameLogic: Resetting game state...");
    cancelLobbyCountdown(); // Ensure countdown is stopped
    stopSimulation(); // Ensure main simulation is stopped
    resetGlobalStateValues(); // Reset time, weather, phase to 'lobby'
    console.log("GameLogic: Game reset complete.");
}

// Need to import broadcastGameState from stateBroadcaster to use it here
import { broadcastGameState } from '../network/stateBroadcaster.js';