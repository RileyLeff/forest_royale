// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
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

    // --- Listen for Player Join Request ---
    socket.on('playerJoinRequest', (data) => {
        console.log(`Connection: Received playerJoinRequest from ${socket.id}`, data);
        const intent = data?.intent || 'single'; // Default to single if missing
        const playerName = data?.playerName; // Optional name from client
        const leafColor = data?.leafColor;   // Optional color
        const trunkColor = data?.trunkColor; // Optional color

        addPlayer(socket.id); // Add player state *after* receiving join request
        const playerState = getPlayerState(socket.id);
        if (!playerState) {
            console.error(`Connection: Failed to get player state for ${socket.id} after join request.`);
            socket.disconnect(true); // Disconnect if state creation failed
            return;
        }

        // --- Update Player State with Client Info (Optional) ---
        if (playerName) playerState.playerName = playerName.substring(0, 16); // Limit name length
        if (leafColor) playerState.leafColor = leafColor; // Basic validation might be needed
        if (trunkColor) playerState.trunkColor = trunkColor;

        // --- Handle based on Intent ---
        const currentPhase = getGlobalState().gamePhase;
        const playerCount = Object.keys(getAllPlayers()).length;

        if (intent === 'single') {
            // *** SINGLE PLAYER JOIN ***
            // Can only start if lobby/ended and they are the only player
            if ((currentPhase === 'lobby' || currentPhase === 'ended') && playerCount === 1) {
                console.log(`Connection: Player ${socket.id} starting single-player game.`);
                resetGame(); // Reset global state

                // Ensure player state is fresh after reset (addPlayer called above)
                const freshPlayerState = getPlayerState(socket.id); // Should exist now
                if (freshPlayerState) {
                    freshPlayerState.isAlive = true;
                    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                    freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                    setGamePhase('playing');
                    console.log(`Connection: Player ${socket.id} marked alive.`);

                    // Send initial state for THIS player only first? Or broadcast? Broadcast is simpler.
                     broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast includes the new player

                    triggerServerStartGame(); // Start simulation
                } else {
                     console.error("Connection: Player state missing after reset in single-player start!");
                     // Handle error? Maybe disconnect client?
                }

            } else {
                // Cannot start single player (game in progress, or >1 player connected somehow?)
                console.warn(`Connection: Player ${socket.id} requested single-player, but cannot start. Phase: ${currentPhase}, Players: ${playerCount}. Joining as observer.`);
                playerState.isAlive = false;
                socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
            }

        } else if (intent === 'multi') {
             // *** MULTIPLAYER JOIN ***
             if (currentPhase === 'playing' || currentPhase === 'countdown') {
                 // Join mid-game/countdown as observer
                 console.log(`Connection: Player ${socket.id} joining multi game in progress/countdown. Setting as observer.`);
                 playerState.isAlive = false;
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 // Broadcast updated player list to others
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             } else {
                 // Join lobby (or ended state view)
                 console.log(`Connection: Player ${socket.id} joining multi lobby/ended. Phase: ${currentPhase}`);
                 playerState.isAlive = false;
                 // If joining an ended game view and they are the first, reset to lobby
                 if (currentPhase === 'ended' && playerCount === 1) {
                     console.log("Connection: First player joined after multi end. Resetting to lobby.");
                     resetGame();
                 }
                  // Send current state to joining player
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 // Broadcast updated player list to others
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             }
        } else {
            console.warn(`Connection: Unknown player intent received: ${intent}`);
             // Treat as observer?
             playerState.isAlive = false;
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        }

    }); // End of 'playerJoinRequest' handler


    // --- Listen for other Client Actions ---
    socket.on('requestStartCountdown', () => {
        const currentPhase = getGlobalState().gamePhase;
        console.log(`Connection: Received requestStartCountdown from ${socket.id}. Phase: ${currentPhase}`);
        // Only allow starting countdown from lobby (multiplayer context implicitly)
        if (currentPhase === 'lobby') {
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
            // Only broadcast disconnect if player was actually removed
            io.emit('playerDisconnected', socket.id);
            broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast updated player list

            const remainingPlayerCount = Object.keys(getAllPlayers()).length;
            const currentPhase = getGlobalState().gamePhase;

            if (remainingPlayerCount === 0) {
                console.log("Connection: Last player disconnected. Resetting game.");
                resetGame();
            } else if (currentPhase === 'countdown') {
                 console.log("Connection: Player left during countdown. Countdown continues.");
                 // Optionally cancel if count < min threshold later
            }
        }
    });
} // End of handleConnection