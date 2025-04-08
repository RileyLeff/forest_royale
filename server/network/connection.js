// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
import { stopSimulation, startGame as triggerServerStartGame, adminSockets } from '../server.js';
// Import resetGame explicitly ONLY if needed elsewhere, endGame now triggers reset
import { resetGame, startLobbyCountdown, cancelLobbyCountdown, endGame } from '../game/gameLogic.js';
import * as Config from '../config.js';

const MIN_SPAWN_DISTANCE_SQ = 4 * 4;

/** Sets up event listeners for a newly connected socket. */
export function handleConnection(socket, io) { /* ... connection setup ... */
    console.log(`Connection: Player connected: ${socket.id}`);
    socket.on('adminAuthenticate', (data) => { /* ... admin auth logic ... */ const serverAdminPassword = process.env.ADMIN_PASSWORD || "defaultAdminPass123"; if (data?.password && data.password === serverAdminPassword) { console.log(`Connection: Admin auth OK for ${socket.id}`); adminSockets.add(socket.id); socket.emit('adminAuthResult', { success: true }); handleJoinRequest(socket, io, { intent: 'spectate' }, true); setupInputAndActionListeners(socket, io); } else { console.warn(`Connection: Admin auth FAILED for ${socket.id}`); socket.emit('adminAuthResult', { success: false, reason: 'Invalid Password' }); setTimeout(() => socket.disconnect(true), 1000); } });
    const regularJoinListener = (data) => { if (adminSockets.has(socket.id)) { socket.off('playerJoinRequest', regularJoinListener); return; } handleJoinRequest(socket, io, data, false); setupInputAndActionListeners(socket, io); };
    socket.on('playerJoinRequest', regularJoinListener);
    socket.on('disconnect', () => { handleDisconnect(socket, io); });
} // End of handleConnection


/** Handles the logic AFTER receiving 'playerJoinRequest' or admin auth */
function handleJoinRequest(socket, io, data, isAdmin) { /* ... join request logic ... */
    const intent = isAdmin ? 'spectate' : (data?.intent || 'single'); const playerName = data?.playerName; console.log(`Join Handling: Processing join for ${socket.id}. Intent: ${intent}, Admin: ${isAdmin}`); if (getPlayerState(socket.id)) { return; } addPlayer(socket.id); const playerState = getPlayerState(socket.id); if (!playerState) { socket.disconnect(true); return; } if (playerName && !isAdmin) playerState.playerName = playerName.substring(0, 16); playerState.isSpectator = (intent === 'spectate' || isAdmin); if(isAdmin) playerState.playerName = `ADMIN_${socket.id.substring(0,4)}`; const currentPhase = getGlobalState().gamePhase; const playerCount = Object.keys(getAllPlayers()).length; const isFirstPlayer = (playerCount === 1);
    if (intent === 'single' && !isAdmin) { if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) { console.log(`Join Handling: Player ${socket.id} starting single.`); resetGame(); const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); if (freshPlayerState) { freshPlayerState.isAlive = true; freshPlayerState.isSpectator = false; const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; setGamePhase('playing'); console.log(`Join Handling: Player ${socket.id} marked alive.`); broadcastGameState(io, getAllPlayers(), getGlobalState()); triggerServerStartGame(); } } else { console.warn(`Join Handling: Player ${socket.id} req single, cannot start. Observer.`); playerState.isAlive = false; playerState.isSpectator = true; socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); }
    } else { if (currentPhase === 'playing' || currentPhase === 'countdown') { console.log(`Join Handling: ${socket.id} (Admin:${isAdmin}) joining mid-game/countdown. Observer.`); playerState.isAlive = false; } else { console.log(`Join Handling: ${socket.id} (Admin:${isAdmin}) joining lobby/ended. Phase: ${currentPhase}`); playerState.isAlive = false; /* Reset handled by endGame now */ } socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); broadcastGameState(io, getAllPlayers(), getGlobalState()); }
}


/** Sets up listeners for controls AND actions coming from the client */
function setupInputAndActionListeners(socket, io) { /* ... input/action listeners ... */
     socket.on('updateStomata', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.value === 'number') ps.stomatalConductance = Math.max(0, Math.min(1, data.value)); });
     socket.on('updateAllocation', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') { ps.lastSavingsPercent = Math.max(0, Math.min(100, data.savings)); ps.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio)); } });
     socket.on('requestStartCountdown', () => { console.log(`Conn: Received 'requestStartCountdown' from ${socket.id}`); const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; if (ps && !ps.isSpectator && phase === 'lobby') startLobbyCountdown(io); else console.log(`Conn: Ignoring start countdown. Phase:${phase}, Player:${!!ps}, Spectator:${ps?.isSpectator}`); });
     socket.on('selectSpawnPoint', (coords) => { /* ... spawn selection logic ... */ const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; const players = getAllPlayers(); console.log(`Conn: Received 'selectSpawnPoint' from ${socket.id}:`, coords); if (!ps || ps.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; } if (phase !== 'lobby') { socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; } if (ps.hasChosenSpawn) { socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; } const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2; if (distSqFromCenter > islandRadius*islandRadius) { socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; } let tooClose = false; for (const op of Object.values(players)) { if (op.id !== socket.id && op.hasChosenSpawn) { const dx = coords.x - op.spawnPoint.x; const dz = coords.z - op.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; break; } } } if (tooClose) { socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; } console.log(`Conn: Spawn point for ${socket.id} confirmed.`); const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; ps.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; ps.hasChosenSpawn = true; socket.emit('spawnPointConfirmed', ps.spawnPoint); broadcastGameState(io, players, getGlobalState()); });
     socket.on('adminForceStart', () => { if (adminSockets.has(socket.id)) { console.log(`ADMIN COMMAND: Force Start from ${socket.id}`); const phase = getGlobalState().gamePhase; if (phase === 'lobby' || phase === 'countdown') { cancelLobbyCountdown(); triggerServerStartGame(); showMessageToAll(io, 'Admin forced game start!', 'warning'); } else { console.log("ADMIN: Cannot Force Start, invalid phase."); socket.emit('serverMessage', { text: 'Cannot force start now.', type: 'error'}); } } else { console.warn(`Unauthorized adminForceStart from ${socket.id}`); } });
     socket.on('adminForceEnd', () => { if (adminSockets.has(socket.id)) { console.log(`ADMIN COMMAND: Force End from ${socket.id}`); const phase = getGlobalState().gamePhase; if (phase === 'playing' || phase === 'countdown') { endGame(io, getAllPlayers(), getGlobalState(), "Game ended by admin."); showMessageToAll(io, 'Admin ended the game.', 'warning'); } else { console.log("ADMIN: Cannot Force End, invalid phase."); socket.emit('serverMessage', { text: 'Cannot force end now.', type: 'error'}); } } else { console.warn(`Unauthorized adminForceEnd from ${socket.id}`); } });
     socket.on('adminResetCountdown', () => { if (adminSockets.has(socket.id)) { console.log(`ADMIN COMMAND: Reset Countdown from ${socket.id}`); const phase = getGlobalState().gamePhase; if (phase === 'countdown') { cancelLobbyCountdown(); startLobbyCountdown(io); showMessageToAll(io, 'Admin reset the countdown.', 'info'); } else if (phase === 'lobby') { startLobbyCountdown(io); showMessageToAll(io, 'Admin started the countdown.', 'info'); } else { console.log("ADMIN: Cannot Reset/Start Countdown, invalid phase."); socket.emit('serverMessage', { text: 'Cannot reset/start countdown now.', type: 'error'}); } } else { console.warn(`Unauthorized adminResetCountdown from ${socket.id}`); } });
} // End of setupInputAndActionListeners


/** Handles socket disconnection */
function handleDisconnect(socket, io) {
     console.log(`Connection: Player disconnected: ${socket.id}`);
     if (adminSockets.has(socket.id)) { adminSockets.delete(socket.id); console.log(`Connection: Removed ${socket.id} from admins.`); }
     const wasRemoved = removePlayer(socket.id);
     if (wasRemoved) {
         io.emit('playerDisconnected', socket.id);
         broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast updated player list

         const remainingPlayerCount = Object.keys(getAllPlayers()).length;
         const currentPhase = getGlobalState().gamePhase;

         // *** REMOVE resetGame call from here ***
         // if (remainingPlayerCount === 0) {
         //     console.log("Connection: Last player disconnected. Resetting game.");
         //     resetGame(); // Let endGame handle reset now
         // } else
         if (currentPhase === 'countdown') {
              console.log("Connection: Player left during countdown. Continues.");
              // Logic to cancel if needed based on player count can remain
              const activePlayerCount = Object.keys(getAllPlayers()).filter(id => !getPlayerState(id)?.isSpectator).length;
              if(activePlayerCount === 0 && remainingPlayerCount > 0){ // Only spectators left
                   console.log("Connection: Only spectators left in countdown. Resetting to lobby.");
                   cancelLobbyCountdown();
                   setGamePhase('lobby');
                   broadcastGameState(io, getAllPlayers(), getGlobalState());
              }
         }
     } else { console.warn(`Connection: Disconnect for ${socket.id}, player not found.`); }
}

/** Helper to broadcast a message to all clients */
function showMessageToAll(io, text, type = 'info') {
    io.emit('serverMessage', { text, type });
}