// server/game/gameLogic.js
import { getGlobalState, getAllPlayers, setGamePhase, resetGlobalStateValues } from './GameState.js';
// We need simulation control functions (start/stop)
import { stopSimulation } from '../server.js'; // We'll export start/stop from server.js later


/**
 * Ends the current game round if it's in the 'playing' phase.
 * Determines the winner, broadcasts the gameOver event.
 * @param {object} io - The Socket.IO server instance.
 * @param {object} players - The current players state object.
 * @param {object} globalState - The current global state object.
 */
export function endGame(io, players, globalState) {
    if (globalState.gamePhase !== 'playing') {
         console.log("GameLogic: endGame called but game not in 'playing' phase. Phase:", globalState.gamePhase);
         // Still ensure simulation is stopped if somehow called inappropriately
         stopSimulation(); // Make sure loop is stopped
         // If ended, maybe just ensure phase is set correctly
         if (globalState.gamePhase !== 'ended') setGamePhase('ended');
         return;
    }

    console.log("GameLogic: Determining winner and ending game.");
    stopSimulation(); // Stop the simulation loop
    setGamePhase('ended'); // Set phase to ended

    // Determine winner
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

    // Broadcast game over event
    io.emit('gameOver', {
        reason: reason,
        winnerId: winnerId,
    });

    // Note: State reset is handled separately (e.g., on last player disconnect or admin action)
}

/**
 * Resets the game state fully, preparing for a new round.
 * Stops simulation and resets global state values.
 * Assumes the players object will be cleared naturally by disconnections/reconnections.
 */
export function resetGame() {
    console.log("GameLogic: Resetting game state...");
    stopSimulation(); // Ensure loop is stopped
    resetGlobalStateValues(); // Reset time, weather, phase to defaults
    // players object is managed by connection handler
    console.log("GameLogic: Game reset complete.");
}