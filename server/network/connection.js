// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
// Import adminSockets Set and start/stop from server.js
import { stopSimulation, startGame as triggerServerStartGame, adminSockets } from '../server.js';
import { resetGame, startLobbyCountdown, cancelLobbyCountdown, endGame } from '../game/gameLogic.js';
import * as Config from '../config.js';

const MIN_SPAWN_DISTANCE_SQ = 4 * 4;

/** Sets up event listeners for a newly connected socket. */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    // --- Listen for Admin Authentication FIRST ---
    socket.on('adminAuthenticate', (data) => {
         const serverAdminPassword = process.env.ADMIN_PASSWORD || "defaultAdminPass123";
         if (data?.password && data.password === serverAdminPassword) {
             console.log(`Connection: Admin authentication successful for ${socket.id}`);
             adminSockets.add(socket.id); // Add to authorized set
             socket.emit('adminAuthResult', { success: true }); // Confirm success
             // Treat admin as spectator join request
             handleJoinRequest(socket, io, { intent: 'spectate' }, true); // Pass isAdmin = true
             // Setup listeners AFTER join is processed
             setupInputAndActionListeners(socket, io);
         } else {
             console.warn(`Connection: Admin authentication FAILED for ${socket.id}`);
             socket.emit('adminAuthResult', { success: false, reason: 'Invalid Password' });
             setTimeout(() => socket.disconnect(true), 1000);
         }
    });

    // --- Listen for Regular Player Join Request ---
    // Use socket.once OR check within listener if admin already
    const regularJoinListener = (data) => {
        // If the socket is ALREADY admin, ignore regular join request
        if (adminSockets.has(socket.id)) {
             console.log(`Connection: Ignoring regular playerJoinRequest from authenticated admin ${socket.id}`);
             // Remove the listener to prevent it firing again if client sends it again
             socket.off('playerJoinRequest', regularJoinListener);
             return;
        }
        // Proceed with normal join logic (passing isAdmin = false)
        handleJoinRequest(socket, io, data, false);
        // Setup input listeners for the regular player
        setupInputAndActionListeners(socket, io);
         // Remove the listener after it's handled once
         // socket.off('playerJoinRequest', regularJoinListener); // Not strictly necessary if join only happens once
    };
    socket.on('playerJoinRequest', regularJoinListener);


    // Setup Disconnect Listener (applies to admin and players)
    socket.on('disconnect', () => { handleDisconnect(socket, io); });

} // End of handleConnection


/** Handles the logic AFTER receiving 'playerJoinRequest' or admin auth */
function handleJoinRequest(socket, io, data, isAdmin) {
    // --- This internal function remains largely the same ---
    // It sets playerState.isSpectator based on intent or isAdmin flag
    const intent = isAdmin ? 'spectate' : (data?.intent || 'single');
    const playerName = data?.playerName;

    console.log(`Join Handling: Processing join for ${socket.id}. Intent: ${intent}, Admin: ${isAdmin}`);
    if (getPlayerState(socket.id)) { /* ... handle already exists ... */ return; } // Safety check

    addPlayer(socket.id);
    const playerState = getPlayerState(socket.id);
    if (!playerState) { /* ... handle state creation failure ... */ return; }
    if (playerName && !isAdmin) playerState.playerName = playerName.substring(0, 16);
    playerState.isSpectator = (intent === 'spectate' || isAdmin);
    if(isAdmin) playerState.playerName = `ADMIN_${socket.id.substring(0,4)}`;

    const currentPhase = getGlobalState().gamePhase;
    const playerCount = Object.keys(getAllPlayers()).length;
    const isFirstPlayer = (playerCount === 1);

    if (intent === 'single' && !isAdmin) { /* ... start single player game ... */ if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) { console.log(`Join Handling: Player ${socket.id} starting single.`); resetGame(); const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); if (freshPlayerState) { freshPlayerState.isAlive = true; freshPlayerState.isSpectator = false; const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; setGamePhase('playing'); console.log(`Join Handling: Player ${socket.id} marked alive.`); broadcastGameState(io, getAllPlayers(), getGlobalState()); triggerServerStartGame(); } } else { console.warn(`Join Handling: Player ${socket.id} req single, cannot start. Observer.`); playerState.isAlive = false; playerState.isSpectator = true; socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); }
    } else { /* Multiplayer, Spectator, or Admin */ if (currentPhase === 'playing' || currentPhase === 'countdown') { console.log(`Join Handling: ${socket.id} (Admin:${isAdmin}) joining mid-game/countdown. Observer.`); playerState.isAlive = false; } else { console.log(`Join Handling: ${socket.id} (Admin:${isAdmin}) joining lobby/ended. Phase: ${currentPhase}`); playerState.isAlive = false; if (currentPhase === 'ended' && isFirstPlayer && !isAdmin) resetGame(); } socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); broadcastGameState(io, getAllPlayers(), getGlobalState()); }
}


/** Sets up listeners for controls AND actions coming from the client */
function setupInputAndActionListeners(socket, io) {

     // --- CONTROL INPUTS (Ignored if spectator/admin) ---
     socket.on('updateStomata', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.value === 'number') ps.stomatalConductance = Math.max(0, Math.min(1, data.value)); });
     socket.on('updateAllocation', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') { ps.lastSavingsPercent = Math.max(0, Math.min(100, data.savings)); ps.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio)); } });

     // --- ACTION REQUESTS (Player Actions) ---
     socket.on('requestStartCountdown', () => { console.log(`Conn: Received 'requestStartCountdown' from ${socket.id}`); const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; if (ps && !ps.isSpectator && phase === 'lobby') startLobbyCountdown(io); else console.log(`Conn: Ignoring start countdown. Phase:${phase}, Player:${!!ps}, Spectator:${ps?.isSpectator}`); });
     socket.on('selectSpawnPoint', (coords) => { /* ... spawn selection logic (check !isSpectator)... */ const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; const players = getAllPlayers(); console.log(`Conn: Received 'selectSpawnPoint' from ${socket.id}:`, coords); if (!ps || ps.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; } if (phase !== 'lobby') { socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; } if (ps.hasChosenSpawn) { socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; } const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2; if (distSqFromCenter > islandRadius*islandRadius) { socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; } let tooClose = false; for (const op of Object.values(players)) { if (op.id !== socket.id && op.hasChosenSpawn) { const dx = coords.x - op.spawnPoint.x; const dz = coords.z - op.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; break; } } } if (tooClose) { socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; } console.log(`Conn: Spawn point for ${socket.id} confirmed.`); const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; ps.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; ps.hasChosenSpawn = true; socket.emit('spawnPointConfirmed', ps.spawnPoint); broadcastGameState(io, players, getGlobalState()); });

     // +++ ADMIN ACTION LISTENERS +++
     socket.on('adminForceStart', () => {
         if (adminSockets.has(socket.id)) { // Verify admin status
            console.log(`ADMIN COMMAND: Force Start received from ${socket.id}`);
            const phase = getGlobalState().gamePhase;
            if (phase === 'lobby' || phase === 'countdown') {
                cancelLobbyCountdown(); // Stop countdown if running
                triggerServerStartGame(); // Attempt to start game immediately
                showMessageToAll(io, 'Admin forced game start!', 'warning'); // Use helper
            } else { console.log("ADMIN COMMAND: Cannot Force Start, invalid phase."); socket.emit('serverMessage', { text: 'Cannot force start now.', type: 'error'}); } // Feedback to admin
         } else { console.warn(`Unauthorized adminForceStart attempt from ${socket.id}`); }
     });

     socket.on('adminForceEnd', () => {
         if (adminSockets.has(socket.id)) {
             console.log(`ADMIN COMMAND: Force End received from ${socket.id}`);
             const phase = getGlobalState().gamePhase;
             if (phase === 'playing' || phase === 'countdown') { // Can end playing or countdown game
                 endGame(io, getAllPlayers(), getGlobalState(), "Game ended by admin."); // Pass custom reason
                 showMessageToAll(io, 'Admin ended the game.', 'warning');
             } else { console.log("ADMIN COMMAND: Cannot Force End, game not running."); socket.emit('serverMessage', { text: 'Cannot force end now.', type: 'error'}); }
         } else { console.warn(`Unauthorized adminForceEnd attempt from ${socket.id}`); }
     });

     socket.on('adminResetCountdown', () => {
         if (adminSockets.has(socket.id)) {
             console.log(`ADMIN COMMAND: Reset Countdown received from ${socket.id}`);
             const phase = getGlobalState().gamePhase;
             if (phase === 'countdown') {
                 cancelLobbyCountdown();
                 startLobbyCountdown(io); // Restart it immediately
                 showMessageToAll(io, 'Admin reset the countdown.', 'info');
             } else if (phase === 'lobby') {
                  startLobbyCountdown(io); // Start it if in lobby
                  showMessageToAll(io, 'Admin started the countdown.', 'info');
             } else { console.log("ADMIN COMMAND: Cannot Reset/Start Countdown, invalid phase."); socket.emit('serverMessage', { text: 'Cannot reset/start countdown now.', type: 'error'}); }
         } else { console.warn(`Unauthorized adminResetCountdown attempt from ${socket.id}`); }
     });

} // End of setupInputAndActionListeners

/** Handles socket disconnection */
function handleDisconnect(socket, io) {
     console.log(`Connection: Player disconnected: ${socket.id}`);
     if (adminSockets.has(socket.id)) { adminSockets.delete(socket.id); console.log(`Connection: Removed ${socket.id} from admins.`); } // Remove admin on disconnect
     const wasRemoved = removePlayer(socket.id);
     if (wasRemoved) { /* ... handle broadcast, reset if last player ... */ io.emit('playerDisconnected', socket.id); broadcastGameState(io, getAllPlayers(), getGlobalState()); const remainingPlayerCount = Object.keys(getAllPlayers()).length; const currentPhase = getGlobalState().gamePhase; if (remainingPlayerCount === 0) { console.log("Connection: Last player disconnected. Resetting game."); resetGame(); } else if (currentPhase === 'countdown') { console.log("Connection: Player left countdown."); } }
     else { console.warn(`Connection: Disconnect for ${socket.id}, player not found.`); }
}

/** Helper to broadcast a message to all clients */
function showMessageToAll(io, text, type = 'info') {
    io.emit('serverMessage', { text, type });
}