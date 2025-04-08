// server/network/connection.js
import { adminSockets } from '../server.js'; // Keep adminSockets import for now
import * as Config from '../config.js'; // Keep for config values if needed locally
// Game state, logic, and simulation are now handled by GameInstance and GameInstanceManager

const MIN_SPAWN_DISTANCE_SQ = 4 * 4;

/** Sets up event listeners for a newly connected socket. */
// Accept gameInstanceManager as argument
export function handleConnection(socket, io, gameInstanceManager) {
    console.log(`Connection: Player connected: ${socket.id}`);

    // --- Admin Authentication ---
    socket.on('adminAuthenticate', (data) => {
        const serverAdminPassword = process.env.ADMIN_PASSWORD || "defaultAdminPass123";
        if (data?.password && data.password === serverAdminPassword) {
            console.log(`Connection: Admin auth OK for ${socket.id}`);
            adminSockets.add(socket.id);
            socket.emit('adminAuthResult', { success: true });
            const targetInstance = gameInstanceManager.routePlayer(socket, 'spectate', true);
            if (targetInstance) {
                setupInputAndActionListeners(socket, io, gameInstanceManager); // Pass manager
            } else { console.error(`Connection: Failed to route authenticated admin ${socket.id}.`); }
        } else {
            console.warn(`Connection: Admin auth FAILED for ${socket.id}`);
            socket.emit('adminAuthResult', { success: false, reason: 'Invalid Password' });
            setTimeout(() => socket.disconnect(true), 1000);
        }
    });

    // --- Regular Player Join ---
    const regularJoinListener = (data) => {
        if (adminSockets.has(socket.id)) { return; }
        if (!data || !data.intent) { socket.disconnect(true); return; }
        const targetInstance = gameInstanceManager.routePlayer(socket, data.intent, false);
        if (targetInstance) {
             setupInputAndActionListeners(socket, io, gameInstanceManager); // Pass manager
        } else { console.error(`Connection: Failed to route player ${socket.id} with intent ${data.intent}.`); }
    };
    socket.once('playerJoinRequest', regularJoinListener);

    // --- Disconnect Handling ---
    socket.on('disconnect', () => {
        console.log(`Connection: Disconnect event for ${socket.id}`);
        if (adminSockets.has(socket.id)) {
            adminSockets.delete(socket.id);
            console.log(`Connection: Removed ${socket.id} from global admin set.`);
        }
        gameInstanceManager.removePlayerFromInstance(socket.id); // Delegate removal
    });
} // End of handleConnection

// handleJoinRequest is removed as its logic is now in gameInstanceManager.routePlayer

/** Sets up listeners for controls AND actions coming from the client */
// Accept gameInstanceManager as argument
function setupInputAndActionListeners(socket, io, gameInstanceManager) {

    // Helper function to get the instance for the current socket
    function getInstanceForSocket() {
        const instanceId = gameInstanceManager.getInstanceIdForPlayer(socket.id);
        if (!instanceId) { console.error(`InputHandler: Cannot find instance ID for socket ${socket.id}`); return null; }
        const instance = gameInstanceManager.getInstance(instanceId);
        if (!instance) { console.error(`InputHandler: Instance ${instanceId} not found for socket ${socket.id}`); return null; }
        return instance;
    }

    // --- Player Input Events ---
    socket.on('updateStomata', (data) => {
        const instance = getInstanceForSocket(); if (!instance) return;
        const ps = instance.getPlayerState(socket.id);
        if (ps && ps.isAlive && !ps.isSpectator && instance.state.gamePhase === 'playing' && typeof data?.value === 'number') {
             ps.stomatalConductance = Math.max(0, Math.min(1, data.value));
        }
    });
    socket.on('updateAllocation', (data) => {
        const instance = getInstanceForSocket(); if (!instance) return;
        const ps = instance.getPlayerState(socket.id);
        if (ps && ps.isAlive && !ps.isSpectator && instance.state.gamePhase === 'playing' && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') {
            ps.lastSavingsPercent = Math.max(0, Math.min(100, data.savings));
            ps.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio));
        }
    });
     socket.on('requestStartCountdown', () => {
         const instance = getInstanceForSocket(); if (!instance) return;
         console.log(`Conn: Received 'requestStartCountdown' from ${socket.id} for instance ${instance.state.instanceId}`);
         const ps = instance.getPlayerState(socket.id);
         if (instance.state.mode === 'multi' && ps && !ps.isSpectator && instance.state.gamePhase === 'lobby' /* && instance.state.allowPlayerCountdownStart TBD */) {
             instance.startCountdown(); // Call instance method
         } else { console.log(`Conn: Ignoring start countdown. Mode:${instance.state.mode}, Phase:${instance.state.gamePhase}, Player:${!!ps}, Spectator:${ps?.isSpectator}`); }
     });
     socket.on('selectSpawnPoint', (coords) => {
         const instance = getInstanceForSocket(); if (!instance) return;
         const ps = instance.getPlayerState(socket.id);
         console.log(`Conn: Received 'selectSpawnPoint' from ${socket.id} for instance ${instance.state.instanceId}:`, coords);
         if (!ps || ps.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; }
         if (instance.state.gamePhase !== 'lobby') { socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; }
         if (ps.hasChosenSpawn) { socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; }
         const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2;
         if (distSqFromCenter > islandRadius*islandRadius) { socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; }
         let tooClose = false;
         instance.getAllPlayers().forEach((op) => { if (op.id === socket.id) return; if (op.hasChosenSpawn && !op.isSpectator) { const dx = coords.x - op.spawnPoint.x; const dz = coords.z - op.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; } } });
         if (tooClose) { socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; }
         console.log(`Conn: Spawn point for ${socket.id} confirmed.`);
         const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
         ps.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; ps.hasChosenSpawn = true;
         socket.emit('spawnPointConfirmed', ps.spawnPoint);
         instance.broadcastState();
     });

     // --- Admin Commands (Target Multiplayer Instance) ---
     function handleAdminCommand(commandName, actionFn) {
         if (!adminSockets.has(socket.id)) { console.warn(`Unauthorized admin command '${commandName}' from ${socket.id}`); return; }
         const multiplayerInstance = gameInstanceManager.multiplayerInstanceId ? gameInstanceManager.getInstance(gameInstanceManager.multiplayerInstanceId) : null;
         if (!multiplayerInstance) { console.log(`ADMIN COMMAND ${commandName}: No active multiplayer instance found.`); socket.emit('serverMessage', { text: 'No active multiplayer game.', type: 'error'}); return; }
         console.log(`ADMIN COMMAND: ${commandName} from ${socket.id} targeting instance ${multiplayerInstance.state.instanceId}`);
         actionFn(multiplayerInstance); // Execute action, passing the target instance
     }

     socket.on('adminForceStart', () => handleAdminCommand('Force Start', (instance) => {
         const phase = instance.state.gamePhase;
         if (phase === 'lobby' || phase === 'countdown') {
             // *** CALL INSTANCE METHOD TO START ***
             instance._prepareAndStartGame();
             instance.io.to(instance.state.roomId).emit('serverMessage', { text: 'Admin forced game start!', type: 'warning'});
             socket.emit('serverMessage', { text: 'Game force-started.', type: 'success'});
         } else {
             console.log("ADMIN: Cannot Force Start, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot force start now.', type: 'error'});
         }
     }));

     socket.on('adminForceEnd', () => handleAdminCommand('Force End', (instance) => {
          const phase = instance.state.gamePhase;
         if (phase === 'playing' || phase === 'countdown') {
             // *** CALL INSTANCE METHOD TO END ***
             instance.endGame("Game ended by admin.");
             instance.io.to(instance.state.roomId).emit('serverMessage', { text: 'Admin ended the game.', type: 'warning'});
             socket.emit('serverMessage', { text: 'Game force-ended.', type: 'success'});
         } else {
             console.log("ADMIN: Cannot Force End, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot force end now.', type: 'error'});
         }
     }));

     socket.on('adminResetCountdown', () => handleAdminCommand('Reset Countdown', (instance) => {
         const phase = instance.state.gamePhase;
         let message = ''; let feedback = '';
         if (phase === 'countdown') {
             // *** CALL INSTANCE METHODS ***
             instance.stopCountdown();
             instance.startCountdown();
             message = 'Admin reset the countdown.';
             feedback = 'Countdown reset.';
         } else if (phase === 'lobby') {
              // *** CALL INSTANCE METHOD ***
             instance.startCountdown();
             message = 'Admin started the countdown.';
             feedback = 'Countdown started.';
         } else {
             console.log("ADMIN: Cannot Reset/Start Countdown, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot reset/start countdown now.', type: 'error'});
             return;
         }
         if (message) instance.io.to(instance.state.roomId).emit('serverMessage', { text: message, type: 'info'});
         if (feedback) socket.emit('serverMessage', { text: feedback, type: 'success'});
     }));

} // End of setupInputAndActionListeners