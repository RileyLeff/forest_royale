// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot } from './stateBroadcaster.js';
import { stopSimulation } from '../server.js'; // Only need stopSimulation here maybe
import { resetGame, startLobbyCountdown, cancelLobbyCountdown } from '../game/gameLogic.js';
import * as Config from '../config.js';

/**
 * Sets up event listeners for a newly connected socket.
 * @param {object} socket - The connected Socket.IO socket instance.
 * @param {object} io - The Socket.IO server instance.
 */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    addPlayer(socket.id); // Add player to game state

    const currentPhase = getGlobalState().gamePhase;
    const playerCount = Object.keys(getAllPlayers()).length;
    const playerState = getPlayerState(socket.id);

    // --- Player Joining Logic ---
    if (currentPhase === 'playing') {
        // Joining mid-game
        console.log(`Connection: Player ${socket.id} joined mid-game. Setting as observer/dead.`);
        if (playerState) playerState.isAlive = false;
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
    } else {
        // Joining lobby or ended game
        console.log(`Connection: Player ${socket.id} joined lobby/ended phase. Phase: ${currentPhase}, Players: ${playerCount}`);
        if (playerState) playerState.isAlive = false; // Ensure not alive
        // If game just ended, we might need to reset it fully before player can join lobby properly
        if (currentPhase === 'ended' && playerCount === 1) {
            console.log("Connection: First player joined after end. Resetting game.");
            resetGame(); // Reset to lobby state
        }
         // Send current state (which might now be 'lobby' if reset)
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        // Broadcast to others that player joined lobby (use standard broadcast for simplicity now)
        // io.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); // Handled by main loop broadcast
    }

    // --- Listen for Client Actions ---

    socket.on('requestStartCountdown', () => {
        const requestingPlayer = getPlayerState(socket.id);
        const currentPhase = getGlobalState().gamePhase;
        console.log(`Connection: Received requestStartCountdown from ${socket.id}. Phase: ${currentPhase}`);
        if (requestingPlayer && currentPhase === 'lobby') {
             // Check other conditions? (e.g., min players?) - For now, any player can start
             startLobbyCountdown(io); // Start the countdown
        } else {
            console.log(`Connection: Ignoring requestStartCountdown (player null or phase not lobby)`);
        }
    });

    // TODO: Add listener for 'selectSpawnPoint' later

    // --- Setup Disconnect Listener ---
    socket.on('disconnect', () => {
        console.log(`Connection: Player disconnected: ${socket.id}`);
        const wasRemoved = removePlayer(socket.id);

        if (wasRemoved) {
            io.emit('playerDisconnected', socket.id);

            const remainingPlayerCount = Object.keys(getAllPlayers()).length;
            const currentPhase = getGlobalState().gamePhase;

            // If lobby/countdown becomes empty, cancel countdown and reset phase
            if (remainingPlayerCount === 0 && (currentPhase === 'lobby' || currentPhase === 'countdown')) {
                console.log("Connection: Lobby/Countdown empty. Resetting phase to lobby.");
                 cancelLobbyCountdown();
                 setGamePhase('lobby'); // Ensure it's lobby
                 stopSimulation(); // Ensure sim is stopped
            }
            // If playing game becomes empty, resetGame handles it
            else if (remainingPlayerCount === 0 && (currentPhase === 'playing' || currentPhase === 'ended')) {
                 console.log("Connection: Last player disconnected from active/ended game. Resetting game.");
                 resetGame();
            }
             // If countdown was running but lobby not empty, just let it continue for now
             // (Could optionally cancel if player count drops below minimum)
        }
    });
}