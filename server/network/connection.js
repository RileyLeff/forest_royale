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

    // Listen for Player Join Request FIRST
    // Setup other listeners only AFTER player state is confirmed
    socket.on('playerJoinRequest', (data) => {
        console.log(`Connection: Received playerJoinRequest from ${socket.id}`, data);
        const intent = data?.intent || 'single';
        const playerName = data?.playerName;
        const leafColor = data?.leafColor;
        const trunkColor = data?.trunkColor;

        // Ensure player isn't already added somehow (e.g., duplicate join request)
        if (getPlayerState(socket.id)) {
            console.warn(`Connection: Player ${socket.id} sent join request but already exists.`);
            // Maybe just update their state? Or ignore? Let's ignore for now.
            // Send them the current state again just in case.
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
            return;
        }

        addPlayer(socket.id); // Add player state
        const playerState = getPlayerState(socket.id);
        if (!playerState) {
            console.error(`Connection: Failed to get player state for ${socket.id} after adding! Disconnecting.`);
            socket.disconnect(true); return;
        }
        if (playerName) playerState.playerName = playerName.substring(0, 16);
        if (leafColor) playerState.leafColor = leafColor;
        if (trunkColor) playerState.trunkColor = trunkColor;

        // --- Handle based on Intent ---
        const currentPhase = getGlobalState().gamePhase;
        const playerCount = Object.keys(getAllPlayers()).length;
        const isFirstPlayer = (playerCount === 1);

        if (intent === 'single') {
            if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) {
                console.log(`Connection: Player ${socket.id} starting single-player game.`);
                resetGame(); // Reset global state
                const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); // Re-get/add state
                 if (freshPlayerState) {
                    freshPlayerState.isAlive = true;
                    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                    freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                    setGamePhase('playing');
                    console.log(`Connection: Player ${socket.id} marked alive.`);
                    broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast includes new player and 'playing' state
                    triggerServerStartGame(); // Start simulation
                } else { console.error("Connection: Player state missing after reset in single-player!"); }
            } else {
                console.warn(`Connection: Player ${socket.id} requested single-player, cannot start. Phase: ${currentPhase}, Players: ${playerCount}. Joining observer.`);
                playerState.isAlive = false;
                socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
            }
        } else if (intent === 'multi') {
             if (currentPhase === 'playing' || currentPhase === 'countdown') {
                 console.log(`Connection: Player ${socket.id} joining multi game in progress/countdown. Observer.`);
                 playerState.isAlive = false;
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState()); // Inform others
             } else { // Lobby or Ended
                 console.log(`Connection: Player ${socket.id} joining multi lobby/ended. Phase: ${currentPhase}`);
                 playerState.isAlive = false;
                 if (currentPhase === 'ended' && isFirstPlayer) {
                     console.log("Connection: First player joined after multi end. Resetting to lobby.");
                     resetGame();
                 }
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState()); // Inform others
             }
        } else {
             console.warn(`Connection: Unknown player intent: ${intent}. Joining observer.`);
             playerState.isAlive = false;
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        }

        // --- Setup other listeners specific to this player *now* ---
        setupInputListeners(socket, io);

    }); // End of 'playerJoinRequest' handler


    // --- Setup Disconnect Listener ---
    socket.on('disconnect', () => { handleDisconnect(socket, io); }); // Delegate disconnect logic

} // End of handleConnection


/** Sets up listeners for controls AND actions coming from the client */
function setupInputListeners(socket, io) { // Pass io if needed

     // --- CONTROL INPUTS ---
     socket.on('updateStomata', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.value === 'number') {
            const newValue = Math.max(0, Math.min(1, data.value));
            playerState.stomatalConductance = newValue;
            // console.log(`Server: Updated stomata for ${socket.id} to ${newValue.toFixed(2)}`);
        } else {
             // console.log(`Server: Ignoring stomata update for ${socket.id}. Player null, dead, or bad data.`, playerState?.isAlive, data);
        }
    });

     socket.on('updateAllocation', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') {
            const newSavings = Math.max(0, Math.min(100, data.savings));
            const newGrowthRatio = Math.max(0, Math.min(100, data.growthRatio));
            playerState.lastSavingsPercent = newSavings;
            playerState.lastGrowthRatioPercent = newGrowthRatio;
            // console.log(`Server: Updated allocation for ${socket.id}. Savings: ${newSavings}%, GrowthRatio: ${newGrowthRatio}%`);
        } else {
            // console.log(`Server: Ignoring allocation update for ${socket.id}. Player null, dead, or bad data.`, playerState?.isAlive, data);
        }
    });

     // --- ACTION REQUESTS ---
     socket.on('requestStartCountdown', () => {
        // +++ Add log to confirm server RECEIVES the event +++
        console.log(`Connection: Received 'requestStartCountdown' from socket ${socket.id}`); // <<< Log 4
        const currentPhase = getGlobalState().gamePhase;
        const playerState = getPlayerState(socket.id); // Check if requesting player exists

        // Check phase inside the handler AND if player exists
        if (playerState && currentPhase === 'lobby') {
             startLobbyCountdown(io); // Call the logic function
        } else {
            console.log(`Connection: Ignoring requestStartCountdown from ${socket.id}. Phase: ${currentPhase}, Player Exists: ${!!playerState}`);
        }
    });

     // TODO: Add listener for 'selectSpawnPoint' later

} // End of setupInputListeners


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
             // Optionally cancel if count < min threshold later
        }
    } else {
         console.warn(`Connection: Disconnect requested for ${socket.id}, but player was not found in state.`);
    }
}