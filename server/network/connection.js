// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
// Import renamed start/stop simulation functions from server.js
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
import { resetGame, startLobbyCountdown, cancelLobbyCountdown } from '../game/gameLogic.js';
import * as Config from '../config.js';

/**
 * Sets up event listeners for a newly connected socket.
 * @param {object} socket - The connected Socket.IO socket instance.
 * @param {object} io - The Socket.IO server instance.
 */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    addPlayer(socket.id);

    const currentPhase = getGlobalState().gamePhase;
    const playerCount = Object.keys(getAllPlayers()).length;
    const playerState = getPlayerState(socket.id);

    // Determine Connection Context - Simplified: Treat first connection as single-player intent for now
    const isSinglePlayer = (playerCount === 1);

    // --- Player Joining Logic ---

    if (isSinglePlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) {
        // *** SINGLE PLAYER START ***
        console.log(`Connection: First player (${socket.id}) starting single-player game. Resetting state...`);
        resetGame(); // Reset global state, stops sim/countdown

        // Player state is re-initialized by resetGame implicitly (via addPlayer on reconnect)
        // We need to get the potentially *new* state after reset/re-add
        const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); // Get/Re-add if somehow missing

        if (freshPlayerState) {
            freshPlayerState.isAlive = true;
            const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
            freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
            setGamePhase('playing'); // Set phase directly to playing *after* reset
            console.log(`Connection: Player ${socket.id} marked alive. Phase set to 'playing'.`);

            // Send initial state immediately *after* setting phase/player state
            socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));

            triggerServerStartGame(); // Start the game simulation loop IMMEDIATELY
        } else {
             console.error(`Connection: Could not find player state for ${socket.id} after reset/add!`);
        }

    } else if (currentPhase === 'playing') {
        // *** JOINING MID-GAME (Spectator/Dead) ***
        console.log(`Connection: Player ${socket.id} joined mid-game. Setting as observer/dead.`);
        if (playerState) playerState.isAlive = false;
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));

    } else {
        // *** JOINING LOBBY (Multiplayer) or attaching to Ended Game ***
        console.log(`Connection: Player ${socket.id} joined. Phase: ${currentPhase}, Players: ${playerCount}`);
        if (playerState) playerState.isAlive = false; // Ensure not alive in lobby/ended

        if (currentPhase === 'ended') {
             console.log("Connection: Player joined ended game state view.");
             // Maybe reset if they are the only one? Handled by disconnect/reconnect logic now.
        } else {
            // This is the multiplayer lobby case
            console.log("Connection: Player joined lobby.");
             // TODO: Add multiplayer lobby specific logic (e.g., ready checks)
        }
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        // Broadcast full state so others see the new player in the list
        broadcastGameState(io, getAllPlayers(), getGlobalState());
    }


    // --- Listen for Client Actions ---
    socket.on('requestStartCountdown', () => {
        const currentPhase = getGlobalState().gamePhase;
        console.log(`Connection: Received requestStartCountdown from ${socket.id}. Phase: ${currentPhase}`);
        // Only allow starting countdown from lobby, and maybe only if > 1 player later?
        if (currentPhase === 'lobby') { // Simplification: Allow starting even w/ 1 player for now
             startLobbyCountdown(io);
        } else {
            console.log(`Connection: Ignoring requestStartCountdown (not in lobby phase).`);
        }
    });


    // --- Setup Disconnect Listener ---
    socket.on('disconnect', () => {
         console.log(`Connection: Player disconnected: ${socket.id}`);
        const wasRemoved = removePlayer(socket.id);

        if (wasRemoved) {
            io.emit('playerDisconnected', socket.id);
            const remainingPlayerCount = Object.keys(getAllPlayers()).length;
            const currentPhase = getGlobalState().gamePhase;

            if (remainingPlayerCount === 0) {
                // Last player left, always reset
                console.log("Connection: Last player disconnected. Resetting game.");
                resetGame(); // This stops sim, stops countdown, resets global state to lobby
            } else if (currentPhase === 'countdown') {
                 // If countdown running and lobby not empty, maybe cancel if below threshold?
                 console.log("Connection: Player left during countdown. Countdown continues.");
                 // Example: Cancel if < 2 players for multiplayer
                 // if (remainingPlayerCount < 2) { cancelLobbyCountdown(); setGamePhase('lobby'); }
            }
        }
    });
}