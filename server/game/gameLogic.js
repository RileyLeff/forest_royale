// server/game/gameLogic.js
import { getGlobalState, getAllPlayers, setGamePhase, resetGlobalStateValues, updateGlobalState, getPlayerState } from './GameState.js';
// Import simulation control functions and main server start function
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
// Import broadcaster
import { broadcastGameState } from '../network/stateBroadcaster.js';

const COUNTDOWN_DURATION = 5; // Seconds for the lobby countdown (shortened for testing)
let countdownInterval = null; // Interval ID for the countdown timer

/**
 * Starts the lobby countdown timer.
 * @param {object} io - The Socket.IO server instance for broadcasting updates.
 */
export function startLobbyCountdown(io) {
    const globalState = getGlobalState();
    if (globalState.gamePhase !== 'lobby' || countdownInterval) {
        console.log("GameLogic: Cannot start countdown, incorrect phase or already running.");
        return;
    }
    if (Object.keys(getAllPlayers()).length === 0) {
         console.log("GameLogic: Cannot start countdown, no players in lobby.");
        return;
    }

    console.log(`GameLogic: Starting ${COUNTDOWN_DURATION} second countdown...`);
    setGamePhase('countdown'); // Set phase first
    updateGlobalState({ countdownTimer: COUNTDOWN_DURATION }); // Then set timer value

    // Broadcast immediately so clients see 'countdown' phase and initial timer value
    broadcastGameState(io, getAllPlayers(), getGlobalState());

    countdownInterval = setInterval(() => {
        // We read the state directly inside the interval now
        const currentState = getGlobalState();

        // Exit checks
        if (currentState.gamePhase !== 'countdown' || currentState.countdownTimer === null) {
            console.warn("GameLogic: Countdown interval running but phase/timer invalid. Cancelling.");
            cancelLobbyCountdown(); // Also calls updateGlobalState({ countdownTimer: null })
            return;
        }
        if (Object.keys(getAllPlayers()).length === 0) {
             console.log("GameLogic: Countdown interval running but no players left. Cancelling.");
             cancelLobbyCountdown();
             setGamePhase('lobby'); // Go back to lobby if empty
             return;
        }


        const newTime = currentState.countdownTimer - 1;
        updateGlobalState({ countdownTimer: newTime }); // Update state only
        // Main server loop (runGameTick) will broadcast this updated timer

        if (newTime <= 0) {
            console.log("GameLogic: Countdown finished. Triggering game start.");
            // Important: cancelLobbyCountdown clears the interval AND sets timer to null
            cancelLobbyCountdown();
            triggerServerStartGame(); // Trigger the actual game start in server.js
        }
    }, 1000); // Update every second
}

/**
 * Cancels the lobby countdown if it's running. Also clears timer value in state.
 */
export function cancelLobbyCountdown() {
    if (countdownInterval) {
        console.log("GameLogic: Cancelling lobby countdown interval.");
        clearInterval(countdownInterval);
        countdownInterval = null;
        // Clear timer value in global state
        updateGlobalState({ countdownTimer: null });
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
    cancelLobbyCountdown(); // Ensure countdown is stopped and timer cleared
    stopSimulation(); // Ensure main simulation is stopped
    resetGlobalStateValues(); // Reset time, weather, phase to 'lobby'
    console.log("GameLogic: Game reset complete.");
}