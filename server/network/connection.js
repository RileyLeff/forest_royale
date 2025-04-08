// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, resetGlobalStateValues } from '../game/GameState.js';
import { getFullGameStateSnapshot } from './stateBroadcaster.js';
// Import game logic and simulation control that might be needed on connect/disconnect
import { startGame, stopSimulation } from '../server.js'; // Import start/stop from main server file
import { resetGame, endGame } from '../game/gameLogic.js';
import * as Config from '../config.js'; // For player initialization details like ISLAND_LEVEL

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
    const playerState = getPlayerState(socket.id); // Get the newly initialized state

    // --- Single-Player Start Logic ---
    // If the game is over or in lobby, and this is the first player connecting, start a new game.
    if ((currentPhase === 'lobby' || currentPhase === 'ended') && playerCount === 1) {
        console.log(`Connection: First player (${socket.id}) joined. Starting single-player game.`);

        resetGame(); // Reset global state AND stop any lingering simulation

        // Player should already be added by addPlayer, now configure for start
        if (playerState) {
            playerState.isAlive = true;
            // Use server config for initial spawn height
            const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
            playerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; // Center spawn
            setGamePhase('playing'); // Set phase AFTER reset
            console.log(`Connection: Player ${socket.id} marked alive.`);

            // Send initial state immediately *after* setting phase and player state
            socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));

            startGame(); // Start the simulation loop (exported from server.js)
        } else {
             console.error(`Connection: Could not find player state for ${socket.id} after adding!`);
             // Handle error - maybe disconnect?
        }

    }
    // --- Joining Mid-Game / Multiplayer Lobby ---
    else if (currentPhase === 'playing') {
        // Handle joining a game already in progress
        console.log(`Connection: Player ${socket.id} joined mid-game. Setting as observer/dead.`);
        if (playerState) {
             playerState.isAlive = false; // Join as non-alive for now
             // TODO: Implement spectator logic later
        }
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));

    } else {
        // Handle joining lobby when others are present, or other states
        console.log(`Connection: Player ${socket.id} joined. Phase: ${currentPhase}, Players: ${playerCount}`);
         if (playerState) {
             playerState.isAlive = false; // Ensure not alive if joining lobby/ended phase
        }
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
         // TODO: Implement multiplayer lobby logic here later
    }


    // --- Setup Disconnect Listener ---
    socket.on('disconnect', () => {
        console.log(`Connection: Player disconnected: ${socket.id}`);
        const wasRemoved = removePlayer(socket.id); // Remove player from state

        if (wasRemoved) {
             io.emit('playerDisconnected', socket.id); // Inform other clients

            // Check if the last player left, reset if so
            const remainingPlayerCount = Object.keys(getAllPlayers()).length;
            if (remainingPlayerCount === 0) {
                console.log("Connection: Last player disconnected. Resetting game.");
                // endGame needs access to players/global state *before* reset potentially
                // But maybe just resetting is enough if game already ended or was lobby
                 resetGame(); // Resets global state and stops simulation
            }
        }
    });

    // --- Setup other event listeners (input, settings) ---
    // socket.on('updateControls', (data) => handlePlayerInput(socket.id, data)); // Example
}

// --- TODO: Add handlers for player input events ---
// function handlePlayerInput(socketId, data) { ... }