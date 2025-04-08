// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
// Import adminSockets Set from server.js
import { stopSimulation, startGame as triggerServerStartGame, adminSockets } from '../server.js';
import { resetGame, startLobbyCountdown, cancelLobbyCountdown, endGame } from '../game/gameLogic.js'; // Import endGame
import * as Config from '../config.js';

const MIN_SPAWN_DISTANCE_SQ = 4 * 4;

/** Sets up event listeners for a newly connected socket. */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    // --- Listen for Admin Authentication FIRST ---
    socket.on('adminAuthenticate', (data) => {
         // Retrieve password securely from env var on server side
         const serverAdminPassword = process.env.ADMIN_PASSWORD || "defaultAdminPass123";
         if (data?.password && data.password === serverAdminPassword) {
             console.log(`Connection: Admin authentication successful for ${socket.id}`);
             adminSockets.add(socket.id); // Add socket ID to the authorized set
             socket.emit('adminAuthResult', { success: true });

             // Now setup the regular join request listener for admin (treat as spectator)
             setupJoinRequestListener(socket, io, true); // Pass isAdmin = true
             // Also set up action/input listeners (admin actions will be checked)
             setupInputAndActionListeners(socket, io);

         } else {
             console.warn(`Connection: Admin authentication FAILED for ${socket.id}`);
             socket.emit('adminAuthResult', { success: false, reason: 'Invalid Password' });
             // Optionally disconnect unauthorized admin attempts after a delay?
             setTimeout(() => socket.disconnect(true), 1000);
         }
    });

    // --- Listen for Regular Player Join Request ---
    // If adminAuthenticate wasn't received first, setup regular join listener
    // Use socket.once to prevent setting up multiple listeners if auth takes time
    socket.once('playerJoinRequest', (data) => {
        // If the socket is ALREADY admin, ignore regular join request
        if (adminSockets.has(socket.id)) {
            console.log(`Connection: Ignoring regular playerJoinRequest from already authenticated admin ${socket.id}`);
            return;
        }
        // Proceed with normal join logic (passing isAdmin = false)
        handleJoinRequest(socket, io, data, false);
        // Setup input listeners for the regular player
        setupInputAndActionListeners(socket, io);
    });


    // Setup Disconnect Listener (applies to admin and players)
    socket.on('disconnect', () => { handleDisconnect(socket, io); });

} // End of handleConnection


/** Handles the actual logic after receiving 'playerJoinRequest' or admin auth */
function handleJoinRequest(socket, io, data, isAdmin) {
    const intent = isAdmin ? 'spectate' : (data?.intent || 'single'); // Admins join as spectators
    const playerName = data?.playerName; // ... other data ...

    console.log(`Join Handling: Processing join for ${socket.id}. Intent: ${intent}, Admin: ${isAdmin}`);

    if (getPlayerState(socket.id)) { /* ... handle already exists ... */ console.warn(`Join Handling: Player ${socket.id} already exists.`); socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); return; }

    addPlayer(socket.id);
    const playerState = getPlayerState(socket.id);
    if (!playerState) { /* ... handle state creation failure ... */ console.error(`Join Handling: Failed state for ${socket.id}`); socket.disconnect(true); return; }
    // ... (update name/color if needed) ...
    if (playerName && !isAdmin) playerState.playerName = playerName.substring(0, 16); // Don't override admin name?
    // Set spectator flag based on intent OR admin status
    playerState.isSpectator = (intent === 'spectate' || isAdmin);
    if(isAdmin) playerState.playerName = `ADMIN_${socket.id.substring(0,4)}`; // Distinguish admin name

    // --- Handle based on Intent/Status ---
    const currentPhase = getGlobalState().gamePhase;
    const playerCount = Object.keys(getAllPlayers()).length;
    const isFirstPlayer = (playerCount === 1);

    if (intent === 'single' && !isAdmin) { // Regular single player
        if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) { /* ... start single player game ... */ console.log(`Join Handling: Player ${socket.id} starting single-player.`); resetGame(); const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id); if (freshPlayerState) { freshPlayerState.isAlive = true; freshPlayerState.isSpectator = false; const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; setGamePhase('playing'); console.log(`Join Handling: Player ${socket.id} marked alive.`); broadcastGameState(io, getAllPlayers(), getGlobalState()); triggerServerStartGame(); }
        } else { /* ... handle cannot start single -> join observer ... */ console.warn(`Join Handling: Player ${socket.id} requested single, cannot start. Observer.`); playerState.isAlive = false; playerState.isSpectator = true; socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); }
    } else { // Multiplayer, Spectator, or Admin (treat as observer initially)
         if (currentPhase === 'playing' || currentPhase === 'countdown') { console.log(`Join Handling: ${socket.id} (Admin: ${isAdmin}) joining mid-game/countdown. Observer.`); playerState.isAlive = false; }
         else { console.log(`Join Handling: ${socket.id} (Admin: ${isAdmin}) joining lobby/ended. Phase: ${currentPhase}`); playerState.isAlive = false; if (currentPhase === 'ended' && isFirstPlayer) resetGame(); }
         socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
         broadcastGameState(io, getAllPlayers(), getGlobalState()); // Inform others
    }
}


/** Sets up listeners for controls AND actions coming from the client */
function setupInputAndActionListeners(socket, io) {

     // --- CONTROL INPUTS (Ignored if spectator/admin) ---
     socket.on('updateStomata', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.value === 'number') ps.stomatalConductance = Math.max(0, Math.min(1, data.value)); });
     socket.on('updateAllocation', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') { ps.lastSavingsPercent = Math.max(0, Math.min(100, data.savings)); ps.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio)); } });

     // --- ACTION REQUESTS (Player Actions) ---
     socket.on('requestStartCountdown', () => { console.log(`Conn: Received 'requestStartCountdown' from ${socket.id}`); const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; if (ps && !ps.isSpectator && phase === 'lobby') startLobbyCountdown(io); else console.log(`Conn: Ignoring requestStartCountdown. Phase: ${phase}, Player: ${!!ps}, Spectator: ${ps?.isSpectator}`); });
     socket.on('selectSpawnPoint', (coords) => { /* ... spawn selection logic (check !isSpectator)... */ const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; const players = getAllPlayers(); console.log(`Conn: Received 'selectSpawnPoint' from ${socket.id}:`, coords); if (!ps || ps.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { console.warn(`Conn: Invalid spawn req data/spectator.`); socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; } if (phase !== 'lobby') { console.warn(`Conn: Spawn req outside lobby.`); socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; } if (ps.hasChosenSpawn) { console.warn(`Conn: Player ${socket.id} already chose spawn.`); socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; } const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2; if (distSqFromCenter > islandRadius*islandRadius) { console.log(`Conn: Spawn rej - Out of bounds.`); socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; } let tooClose = false; for (const op of Object.values(players)) { if (op.id !== socket.id && op.hasChosenSpawn) { const dx = coords.x - op.spawnPoint.x; const dz = coords.z - op.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; break; } } } if (tooClose) { console.log(`Conn: Spawn rej - Too close.`); socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; } console.log(`Conn: Spawn point for ${socket.id} confirmed.`); const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; ps.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; ps.hasChosenSpawn = true; socket.emit('spawnPointConfirmed', ps.spawnPoint); broadcastGameState(io, players, getGlobalState()); });

     // +++ ADMIN ACTION LISTENERS +++
     socket.on('adminForceStart', () => {
         if (adminSockets.has(socket.id)) { // Verify admin status
            console.log(`ADMIN COMMAND: Force Start received from ${socket.id}`);
            const phase = getGlobalState().gamePhase;
            if (phase === 'lobby' || phase === 'countdown') {
                cancelLobbyCountdown(); // Stop countdown if running
                triggerServerStartGame(); // Attempt to start game immediately
                 showMessage(io, 'Admin forced game start!', 'warning'); // Send global message
            } else { console.log("ADMIN COMMAND: Cannot Force Start, game phase is not lobby/countdown."); }
         } else { console.warn(`Unauthorized adminForceStart attempt from ${socket.id}`); }
     });

     socket.on('adminForceEnd', () => {
         if (adminSockets.has(socket.id)) {
             console.log(`ADMIN COMMAND: Force End received from ${socket.id}`);
             const phase = getGlobalState().gamePhase;
             if (phase === 'playing' || phase === 'countdown') { // Can end playing or countdown game
                 // Pass necessary arguments to endGame
                 endGame(io, getAllPlayers(), getGlobalState(), "Game ended by admin."); // Pass custom reason
                  showMessage(io, 'Admin ended the game.', 'warning');
             } else { console.log("ADMIN COMMAND: Cannot Force End, game not playing/countdown."); }
         } else { console.warn(`Unauthorized adminForceEnd attempt from ${socket.id}`); }
     });

     socket.on('adminResetCountdown', () => {
         if (adminSockets.has(socket.id)) {
             console.log(`ADMIN COMMAND: Reset Countdown received from ${socket.id}`);
             const phase = getGlobalState().gamePhase;
             if (phase === 'countdown') {
                 cancelLobbyCountdown();
                 startLobbyCountdown(io); // Restart it immediately
                  showMessage(io, 'Admin reset the countdown.', 'info');
             } else if (phase === 'lobby') {
                  startLobbyCountdown(io); // Start it if in lobby
                  showMessage(io, 'Admin started the countdown.', 'info');
             } else { console.log("ADMIN COMMAND: Cannot Reset/Start Countdown, invalid phase."); }
         } else { console.warn(`Unauthorized adminResetCountdown attempt from ${socket.id}`); }
     });

} // End of setupInputAndActionListeners

/** Handles socket disconnection */
function handleDisconnect(socket, io) {
     console.log(`Connection: Player disconnected: ${socket.id}`);
     // Remove from admin set if present
     if (adminSockets.has(socket.id)) {
         adminSockets.delete(socket.id);
         console.log(`Connection: Removed ${socket.id} from admin list.`);
     }
     const wasRemoved = removePlayer(socket.id); // Remove from player state
     if (wasRemoved) { /* ... handle broadcast, reset if last player ... */ io.emit('playerDisconnected', socket.id); broadcastGameState(io, getAllPlayers(), getGlobalState()); const remainingPlayerCount = Object.keys(getAllPlayers()).length; const currentPhase = getGlobalState().gamePhase; if (remainingPlayerCount === 0) { console.log("Connection: Last player disconnected. Resetting game."); resetGame(); } else if (currentPhase === 'countdown') { console.log("Connection: Player left during countdown. Continues."); } }
     else { console.warn(`Connection: Disconnect for ${socket.id}, player not found.`); }
}

/** Helper to broadcast a message to all clients */
function showMessage(io, text, type = 'info') {
    io.emit('serverMessage', { text, type }); // Send message event to all clients
}