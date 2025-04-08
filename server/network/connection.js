// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
import { resetGame, startLobbyCountdown, cancelLobbyCountdown } from '../game/gameLogic.js';
import * as Config from '../config.js'; // Use server config

// --- Constants for Spawn Validation ---
const MIN_SPAWN_DISTANCE_SQ = 4 * 4; // Minimum distance squared (e.g., 4 units apart)

/**
 * Sets up event listeners for a newly connected socket.
 * @param {object} socket - The connected Socket.IO socket instance.
 * @param {object} io - The Socket.IO server instance.
 */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    socket.on('playerJoinRequest', (data) => {
        console.log(`Connection: Received playerJoinRequest from ${socket.id}`, data);
        const intent = data?.intent || 'single';
        const playerName = data?.playerName;
        const leafColor = data?.leafColor;
        const trunkColor = data?.trunkColor;

        if (getPlayerState(socket.id)) {
             console.warn(`Connection: Player ${socket.id} sent join request but already exists.`);
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
             return;
        }

        addPlayer(socket.id);
        const playerState = getPlayerState(socket.id);
        if (!playerState) {
            console.error(`Connection: Failed to get player state for ${socket.id} after adding! Disconnecting.`);
            socket.disconnect(true); return;
        }
        if (playerName) playerState.playerName = playerName.substring(0, 16);
        if (leafColor) playerState.leafColor = leafColor;
        if (trunkColor) playerState.trunkColor = trunkColor;

        const currentPhase = getGlobalState().gamePhase;
        const playerCount = Object.keys(getAllPlayers()).length;
        const isFirstPlayer = (playerCount === 1);

        if (intent === 'single') {
            if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) {
                console.log(`Connection: Player ${socket.id} starting single-player game.`);
                resetGame();
                const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); // Re-get/add state
                 if (freshPlayerState) {
                    freshPlayerState.isAlive = true;
                    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                    freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                    setGamePhase('playing');
                    console.log(`Connection: Player ${socket.id} marked alive.`);
                    broadcastGameState(io, getAllPlayers(), getGlobalState());
                    triggerServerStartGame();
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
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
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

        // Setup other listeners *after* player state exists and join handled
        setupInputAndActionListeners(socket, io);

    }); // End of 'playerJoinRequest' handler


    // Setup Disconnect Listener (outside join request)
    socket.on('disconnect', () => { handleDisconnect(socket, io); });

} // End of handleConnection


/** Sets up listeners for controls AND actions coming from the client */
function setupInputAndActionListeners(socket, io) {

     // --- CONTROL INPUTS ---
     socket.on('updateStomata', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.value === 'number') {
             playerState.stomatalConductance = Math.max(0, Math.min(1, data.value));
        }
     });
     socket.on('updateAllocation', (data) => {
        const playerState = getPlayerState(socket.id);
        if (playerState && playerState.isAlive && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') {
            playerState.lastSavingsPercent = Math.max(0, Math.min(100, data.savings));
            playerState.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio));
        }
     });

     // --- ACTION REQUESTS ---
     socket.on('requestStartCountdown', () => {
        console.log(`Connection: Received 'requestStartCountdown' from socket ${socket.id}`);
        const currentPhase = getGlobalState().gamePhase;
        const playerState = getPlayerState(socket.id);
        if (playerState && currentPhase === 'lobby') { startLobbyCountdown(io); }
        else { console.log(`Connection: Ignoring requestStartCountdown. Phase: ${currentPhase}, Player Exists: ${!!playerState}`); }
     });

     // +++ SPAWN SELECTION LISTENER +++
     socket.on('selectSpawnPoint', (coords) => {
         const playerState = getPlayerState(socket.id);
         const currentPhase = getGlobalState().gamePhase;
         const players = getAllPlayers(); // Get current players for validation

         console.log(`Connection: Received 'selectSpawnPoint' from ${socket.id}:`, coords);

         // Basic validation
         if (!playerState || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') {
             console.warn(`Connection: Invalid spawn request data from ${socket.id}.`);
             socket.emit('spawnPointInvalid', { reason: 'Invalid data received.' }); return;
         }
         if (currentPhase !== 'lobby') {
             console.warn(`Connection: Spawn request from ${socket.id} outside of lobby phase.`);
             socket.emit('spawnPointInvalid', { reason: 'Can only select spawn in lobby.' }); return;
         }
         if (playerState.hasChosenSpawn) {
             console.warn(`Connection: Player ${socket.id} tried to select spawn point again.`);
             socket.emit('spawnPointInvalid', { reason: 'Spawn point already chosen.' }); return;
         }

         // --- Validate Coordinates ---
         const islandRadius = Config.ISLAND_RADIUS || 50;
         const distSqFromCenter = coords.x * coords.x + coords.z * coords.z;

         // 1. Check bounds
         if (distSqFromCenter > islandRadius * islandRadius) {
              console.log(`Connection: Spawn for ${socket.id} rejected - Out of bounds.`);
              socket.emit('spawnPointInvalid', { reason: 'Selected point is outside the island.' }); return;
         }

         // 2. Check distance from other players' confirmed spawns
         let tooClose = false;
         for (const otherPlayer of Object.values(players)) {
             if (otherPlayer.id !== socket.id && otherPlayer.hasChosenSpawn) {
                 const dx = coords.x - otherPlayer.spawnPoint.x;
                 const dz = coords.z - otherPlayer.spawnPoint.z;
                 const distSq = dx * dx + dz * dz;
                 if (distSq < MIN_SPAWN_DISTANCE_SQ) {
                     console.log(`Connection: Spawn for ${socket.id} too close to ${otherPlayer.id}`);
                     tooClose = true;
                     break;
                 }
             }
         }
         if (tooClose) {
             console.log(`Connection: Spawn for ${socket.id} rejected - Too close.`);
             socket.emit('spawnPointInvalid', { reason: 'Too close to another tree.' }); return;
         }

         // --- Validation Passed ---
         console.log(`Connection: Spawn point for ${socket.id} confirmed.`);
         const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
         playerState.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z };
         playerState.hasChosenSpawn = true;

         socket.emit('spawnPointConfirmed', playerState.spawnPoint); // Confirm to client
         broadcastGameState(io, players, getGlobalState()); // Broadcast update

     }); // End of 'selectSpawnPoint' listener

} // End of setupInputAndActionListeners


/** Handles socket disconnection */
function handleDisconnect(socket, io) {
    console.log(`Connection: Player disconnected: ${socket.id}`);
    const playerState = getPlayerState(socket.id); // Get state *before* removing
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
             // Add logic here to cancel countdown if player count < min requirement if desired
             // e.g., if (remainingPlayerCount < 2) { cancelLobbyCountdown(); setGamePhase('lobby'); broadcastGameState(io, getAllPlayers(), getGlobalState()); }
        }
    } else {
         console.warn(`Connection: Disconnect requested for ${socket.id}, but player was not found.`);
    }
}