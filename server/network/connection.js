// server/network/connection.js
// Import updatePlayerState if needed (or just modify directly via getPlayerState)
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

    // --- Listen for Player Join Request FIRST ---
    socket.on('playerJoinRequest', (data) => {
        console.log(`Connection: Received playerJoinRequest from ${socket.id}`, data);
        const intent = data?.intent || 'single';
        const playerName = data?.playerName;
        const leafColor = data?.leafColor;
        const trunkColor = data?.trunkColor;

        addPlayer(socket.id); // Add player state *after* receiving join request
        const playerState = getPlayerState(socket.id);
        if (!playerState) {
             console.error(`Connection: Failed to get player state for ${socket.id} after join request.`);
             socket.disconnect(true); return;
        }
        if (playerName) playerState.playerName = playerName.substring(0, 16);
        if (leafColor) playerState.leafColor = leafColor;
        if (trunkColor) playerState.trunkColor = trunkColor;

        // --- Handle based on Intent ---
        const currentPhase = getGlobalState().gamePhase;
        const playerCount = Object.keys(getAllPlayers()).length;

        if (intent === 'single') {
            if ((currentPhase === 'lobby' || currentPhase === 'ended') && playerCount === 1) {
                console.log(`Connection: Player ${socket.id} starting single-player game.`);
                resetGame();
                const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); // Re-get/add
                 if (freshPlayerState) {
                    freshPlayerState.isAlive = true;
                    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                    freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                    setGamePhase('playing');
                    console.log(`Connection: Player ${socket.id} marked alive.`);
                    broadcastGameState(io, getAllPlayers(), getGlobalState());
                    triggerServerStartGame();
                }
            } else {
                console.warn(`Connection: Player ${socket.id} requested single-player, but cannot start. Joining as observer.`);
                playerState.isAlive = false;
                socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
            }
        } else if (intent === 'multi') {
             if (currentPhase === 'playing' || currentPhase === 'countdown') {
                 console.log(`Connection: Player ${socket.id} joining multi game in progress/countdown. Setting as observer.`);
                 playerState.isAlive = false;
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             } else {
                 console.log(`Connection: Player ${socket.id} joining multi lobby/ended. Phase: ${currentPhase}`);
                 playerState.isAlive = false;
                 if (currentPhase === 'ended' && playerCount === 1) { resetGame(); }
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             }
        } else {
             console.warn(`Connection: Unknown player intent: ${intent}. Joining as observer.`);
             playerState.isAlive = false;
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        }

        // --- Now that player state exists, setup input listeners ---
        setupInputListeners(socket);

    }); // End of 'playerJoinRequest' handler


    // --- Setup Disconnect Listener ---
    // Moved setupInputListeners into playerJoinRequest because playerState needs to exist first
    // setupInputListeners(socket); // <<< REMOVE from here
    socket.on('disconnect', () => { handleDisconnect(socket, io); }); // Delegate disconnect logic

} // End of handleConnection


/** Sets up listeners for controls coming from the client */
function setupInputListeners(socket) {
     socket.on('updateStomata', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.value === 'number') {
            // Validate range (0 to 1)
            const newValue = Math.max(0, Math.min(1, data.value));
            playerState.stomatalConductance = newValue;
            // console.log(`Server: Updated stomata for ${socket.id} to ${newValue.toFixed(2)}`); // Debug log
            // No need to broadcast immediately, next gameStateUpdate will include it
        } else {
             console.log(`Server: Ignoring stomata update for ${socket.id}. Player null, dead, or bad data.`, playerState?.isAlive, data);
        }
    });

     socket.on('updateAllocation', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') {
            // Validate range (0 to 100)
            const newSavings = Math.max(0, Math.min(100, data.savings));
            const newGrowthRatio = Math.max(0, Math.min(100, data.growthRatio));
            playerState.lastSavingsPercent = newSavings;
            playerState.lastGrowthRatioPercent = newGrowthRatio;
            // console.log(`Server: Updated allocation for ${socket.id}. Savings: ${newSavings}%, GrowthRatio: ${newGrowthRatio}%`); // Debug log
        } else {
            console.log(`Server: Ignoring allocation update for ${socket.id}. Player null, dead, or bad data.`, playerState?.isAlive, data);
        }
    });
}

/** Handles socket disconnection */
function handleDisconnect(socket, io) {
     console.log(`Connection: Player disconnected: ${socket.id}`);
    const wasRemoved = removePlayer(socket.id);

    if (wasRemoved) {
        io.emit('playerDisconnected', socket.id);
        broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast updated player list

        const remainingPlayerCount = Object.keys(getAllPlayers()).length;
        const currentPhase = getGlobalState().gamePhase;

        if (remainingPlayerCount === 0) {
            console.log("Connection: Last player disconnected. Resetting game.");
            resetGame();
        } else if (currentPhase === 'countdown') {
             console.log("Connection: Player left during countdown. Countdown continues.");
             // Optional: Cancel if count < min threshold later
        }
    }
}