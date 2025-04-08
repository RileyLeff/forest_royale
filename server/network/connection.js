// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
import { stopSimulation, startGame as triggerServerStartGame, adminSockets } from '../server.js';
// Import resetGame explicitly ONLY if needed elsewhere, endGame now triggers reset
import { resetGame, startLobbyCountdown, cancelLobbyCountdown, endGame } from '../game/gameLogic.js';
import * as Config from '../config.js';

const MIN_SPAWN_DISTANCE_SQ = 4 * 4; // Example value (4 units separation)

/** Sets up event listeners for a newly connected socket. */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    // Listener for Admin Authentication
    socket.on('adminAuthenticate', (data) => {
        const serverAdminPassword = process.env.ADMIN_PASSWORD || "defaultAdminPass123";
        if (data?.password && data.password === serverAdminPassword) {
            console.log(`Connection: Admin auth OK for ${socket.id}`);
            adminSockets.add(socket.id);
            socket.emit('adminAuthResult', { success: true });
            // --- Force admin join as spectator ---
            handleJoinRequest(socket, io, { intent: 'spectate' }, true); // Force intent to spectate for admin
            setupInputAndActionListeners(socket, io); // Setup listeners AFTER join request is handled
        } else {
            console.warn(`Connection: Admin auth FAILED for ${socket.id}`);
            socket.emit('adminAuthResult', { success: false, reason: 'Invalid Password' });
            setTimeout(() => socket.disconnect(true), 1000); // Disconnect on failed auth
        }
    });

    // Listener for Regular Player Join
    const regularJoinListener = (data) => {
        if (adminSockets.has(socket.id)) {
             console.log(`Connection: Ignoring regular join for already authenticated admin ${socket.id}`);
            return;
        }
        handleJoinRequest(socket, io, data, false);
        setupInputAndActionListeners(socket, io); // Setup listeners AFTER join request is handled
    };
    // Use 'once' to prevent multiple join attempts on the same connection
    socket.once('playerJoinRequest', regularJoinListener);

    socket.on('disconnect', () => {
        handleDisconnect(socket, io);
    });
} // End of handleConnection


/** Handles the logic AFTER receiving 'playerJoinRequest' or admin auth */
function handleJoinRequest(socket, io, data, isAdmin) {
    const intent = isAdmin ? 'spectate' : (data?.intent || 'single');
    const playerName = data?.playerName; // Will be handled later when customization is fixed
    const leafColor = data?.leafColor;   // Will be handled later
    const trunkColor = data?.trunkColor; // Will be handled later

    console.log(`Join Handling: Processing join for ${socket.id}. Intent: ${intent}, Admin: ${isAdmin}`);

    // Prevent adding player if they already exist
    if (getPlayerState(socket.id)) {
        console.warn(`Join Handling: Player ${socket.id} already exists in state. Ignoring join request.`);
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        return;
    }

    addPlayer(socket.id);
    const playerState = getPlayerState(socket.id);
    if (!playerState) {
        console.error(`Join Handling: Failed to get player state for ${socket.id} after adding. Disconnecting.`);
        socket.disconnect(true);
        return;
    }

    // --- Set Spectator Status ---
    playerState.isSpectator = isAdmin || (intent === 'spectate');
    console.log(`Join Handling: Player ${socket.id} spectator status set to: ${playerState.isSpectator}`);

    // --- Set Admin Name ---
    if (isAdmin) {
        playerState.playerName = `ADMIN_${socket.id.substring(0, 4)}`;
    }
    // TODO: Handle regular playerName, leafColor, trunkColor, and name uniqueness here later

    // --- Determine Initial State/Phase ---
    const currentGlobalState = getGlobalState(); // Get current state *before* potential reset
    const currentPhase = currentGlobalState.gamePhase;
    const currentPlayers = getAllPlayers(); // Get *current* full list including the new player
    const currentNonSpectatorPlayers = Object.values(currentPlayers).filter(p => !p.isSpectator);
    const currentNonSpectatorCount = currentNonSpectatorPlayers.length;

    // Default: Player starts dead
    playerState.isAlive = false;

    // --- Single Player Logic ---
    // *** Revised Condition: Stricter check ***
    if (intent === 'single' && !isAdmin) {
        // Only start single player if:
        // 1. Phase is lobby or ended (safe to reset)
        // 2. This new player is the *only* non-spectator currently connected
        if ((currentPhase === 'lobby' || currentPhase === 'ended') && currentNonSpectatorCount === 1) {
            console.log(`Join Handling: Player ${socket.id} starting single (Phase: ${currentPhase}, NonSpectators: ${currentNonSpectatorCount}).`);
            resetGame(); // Reset state completely
            const freshPlayerState = getPlayerState(socket.id); // Get state again after reset
            if (freshPlayerState) {
                freshPlayerState.isAlive = true; // Mark alive
                freshPlayerState.isSpectator = false; // Ensure not spectator
                const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; // Default center spawn
                freshPlayerState.hasChosenSpawn = true; // Mark spawn as chosen
                setGamePhase('playing'); // Set phase
                console.log(`Join Handling: Player ${socket.id} marked alive for single player.`);
                broadcastGameState(io, getAllPlayers(), getGlobalState()); // Broadcast the new 'playing' state
                triggerServerStartGame(); // Start the simulation
            } else {
                 console.error(`Join Handling: Could not find player state for ${socket.id} after reset for single player start.`);
                 socket.disconnect(true);
            }
        } else {
            console.warn(`Join Handling: Player ${socket.id} requested single player, but conditions not met (Phase: ${currentPhase}, NonSpectators: ${currentNonSpectatorCount}). Joining as observer.`);
            playerState.isSpectator = true; // Force spectator if single player rules not met
            playerState.isAlive = false;
            socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState())); // Send current state
            broadcastGameState(io, getAllPlayers(), getGlobalState()); // Inform others
        }
    }
    // --- Multiplayer / Spectator Logic ---
    else {
        // Handle joining an ongoing 'playing' game
        if (currentPhase === 'playing' && !playerState.isSpectator) {
            console.log(`Join Handling: Player ${socket.id} (Multiplayer) joining ongoing 'playing' game.`);
            playerState.isAlive = true; // Mark as alive to join simulation
            // Assign a default spawn point (random offset) since they can't choose
            const currentPlayersCount = Object.keys(currentPlayers).length; // Use total count for angle variation
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 10; // Spawn further out
            const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
            playerState.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) };
            playerState.hasChosenSpawn = true; // Mark as chosen
            console.log(`Join Handling: Assigned default spawn (${playerState.spawnPoint.x.toFixed(1)}, ${playerState.spawnPoint.z.toFixed(1)}) and marked alive.`);
            // No need to start simulation, it's already running
        }
        // Handle joining lobby, countdown, or ended phase, or joining as spectator
        else if (currentPhase === 'countdown' || currentPhase === 'lobby' || currentPhase === 'ended' || playerState.isSpectator) {
             console.log(`Join Handling: ${socket.id} (Spectator: ${playerState.isSpectator}) joining non-playing phase or as spectator (Phase: ${currentPhase}). Observer status.`);
             // isAlive remains false (set by default above)
        } else {
            // Should not be reached, but good to log
            console.error(`Join Handling: Unhandled case for player ${socket.id} (Intent: ${intent}, Phase: ${currentPhase}, Spectator: ${playerState.isSpectator})`);
        }

        // Send the current snapshot to the joining player
        socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        // Broadcast updated player list/state to everyone else
        broadcastGameState(io, getAllPlayers(), getGlobalState());
    }
}


// setupInputAndActionListeners remains the same as the previous version...
/** Sets up listeners for controls AND actions coming from the client */
function setupInputAndActionListeners(socket, io) {
     socket.on('updateStomata', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.value === 'number') ps.stomatalConductance = Math.max(0, Math.min(1, data.value)); });
     socket.on('updateAllocation', (data) => { const ps = getPlayerState(socket.id); if (ps && ps.isAlive && !ps.isSpectator && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') { ps.lastSavingsPercent = Math.max(0, Math.min(100, data.savings)); ps.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio)); } });
     socket.on('requestStartCountdown', () => { console.log(`Conn: Received 'requestStartCountdown' from ${socket.id}`); const ps = getPlayerState(socket.id); const globalState = getGlobalState(); const phase = globalState.gamePhase; if (ps && !ps.isSpectator && phase === 'lobby' /*&& globalState.allowPlayerCountdownStart TBD Later */ ) startLobbyCountdown(io); else console.log(`Conn: Ignoring start countdown. Phase:${phase}, Player:${!!ps}, Spectator:${ps?.isSpectator}`); });
     socket.on('selectSpawnPoint', (coords) => { const ps = getPlayerState(socket.id); const phase = getGlobalState().gamePhase; const players = getAllPlayers(); console.log(`Conn: Received 'selectSpawnPoint' from ${socket.id}:`, coords); if (!ps || ps.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; } if (phase !== 'lobby') { socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; } if (ps.hasChosenSpawn) { socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; } const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2; if (distSqFromCenter > islandRadius*islandRadius) { socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; } let tooClose = false; for (const otherPlayerId in players) { if (otherPlayerId === socket.id) continue; const op = players[otherPlayerId]; if (op.hasChosenSpawn && !op.isSpectator) { const dx = coords.x - op.spawnPoint.x; const dz = coords.z - op.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; break; } } } if (tooClose) { socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; } console.log(`Conn: Spawn point for ${socket.id} confirmed.`); const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1; ps.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; ps.hasChosenSpawn = true; socket.emit('spawnPointConfirmed', ps.spawnPoint); broadcastGameState(io, players, getGlobalState()); });

     // --- Admin Commands ---
     function handleAdminCommand(commandName, actionFn) {
         if (adminSockets.has(socket.id)) {
             console.log(`ADMIN COMMAND: ${commandName} from ${socket.id}`);
             actionFn(); // Execute the provided action
         } else {
             console.warn(`Unauthorized admin command '${commandName}' from ${socket.id}`);
         }
     }

     socket.on('adminForceStart', () => handleAdminCommand('Force Start', () => {
         const phase = getGlobalState().gamePhase;
         if (phase === 'lobby' || phase === 'countdown') {
             cancelLobbyCountdown(); // Ensure countdown stops if running
             triggerServerStartGame(); // This sets phase to playing and prepares players
             showMessageToAll(io, 'Admin forced game start!', 'warning');
             socket.emit('serverMessage', { text: 'Game force-started.', type: 'success'}); // Feedback to admin
         } else {
             console.log("ADMIN: Cannot Force Start, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot force start now.', type: 'error'});
         }
     }));

     socket.on('adminForceEnd', () => handleAdminCommand('Force End', () => {
          const globalState = getGlobalState(); // Get fresh state
          const phase = globalState.gamePhase;
         if (phase === 'playing' || phase === 'countdown') {
             endGame(io, getAllPlayers(), globalState, "Game ended by admin."); // endGame stops loops, sets phase, etc.
             showMessageToAll(io, 'Admin ended the game.', 'warning');
             socket.emit('serverMessage', { text: 'Game force-ended.', type: 'success'});
         } else {
             console.log("ADMIN: Cannot Force End, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot force end now.', type: 'error'});
         }
     }));

     socket.on('adminResetCountdown', () => handleAdminCommand('Reset Countdown', () => {
         const phase = getGlobalState().gamePhase;
         let message = '';
         let feedback = '';
         if (phase === 'countdown') {
             cancelLobbyCountdown();
             startLobbyCountdown(io); // Restart it
             message = 'Admin reset the countdown.';
             feedback = 'Countdown reset.';
         } else if (phase === 'lobby') {
             startLobbyCountdown(io); // Just start it
             message = 'Admin started the countdown.';
             feedback = 'Countdown started.';
         } else {
             console.log("ADMIN: Cannot Reset/Start Countdown, invalid phase.");
             socket.emit('serverMessage', { text: 'Cannot reset/start countdown now.', type: 'error'});
             return; // Don't send messages if invalid phase
         }
         if (message) showMessageToAll(io, message, 'info');
         if (feedback) socket.emit('serverMessage', { text: feedback, type: 'success'});
     }));

     // TODO: Add listener for 'adminTogglePlayerCountdown' later

} // End of setupInputAndActionListeners


// handleDisconnect remains the same as the previous version...
/** Handles socket disconnection */
function handleDisconnect(socket, io) {
     console.log(`Connection: Player disconnected: ${socket.id}`);
     if (adminSockets.has(socket.id)) {
         adminSockets.delete(socket.id);
         console.log(`Connection: Removed ${socket.id} from admins.`);
     }

     // Check if player actually exists before trying to remove
     const playerExists = !!getPlayerState(socket.id);
     if (!playerExists) {
         console.warn(`Connection: Disconnect for ${socket.id}, but player not found in state.`);
         return; // Nothing more to do
     }

     const wasRemoved = removePlayer(socket.id); // Remove from state object
     if (wasRemoved) {
         io.emit('playerDisconnected', socket.id); // Inform clients

         const currentPhase = getGlobalState().gamePhase;
         const players = getAllPlayers(); // Get remaining players
         const remainingPlayerCount = Object.keys(players).length;
         const activePlayerCount = Object.values(players).filter(p => !p.isSpectator).length;

         // --- Logic after disconnect ---
         if (currentPhase === 'playing') {
             // If the last *active* player leaves mid-game, end it.
             if (activePlayerCount === 0 && remainingPlayerCount >= 0) { // Check if only spectators left or list is empty
                 console.log("Connection: Last active player disconnected mid-game. Ending game.");
                 endGame(io, players, getGlobalState(), "Last player left.");
             }
             // Otherwise, game continues with remaining players
         } else if (currentPhase === 'countdown') {
             // If the last *active* player leaves during countdown, cancel and return to lobby.
             if (activePlayerCount === 0) {
                 console.log("Connection: Last active player disconnected during countdown. Returning to lobby.");
                 cancelLobbyCountdown();
                 setGamePhase('lobby');
                 // Broadcast the change back to lobby state
             }
             // Otherwise, countdown continues
         } else if (currentPhase === 'lobby' || currentPhase === 'ended') {
              // If a player leaves lobby/ended, just update the player list
              // No phase change needed usually. Reset logic happens in endGame or on new game start.
         }

         // Always broadcast the potentially updated state after handling disconnect logic
         broadcastGameState(io, players, getGlobalState());

     } else {
         console.error(`Connection: Failed to remove player ${socket.id} even though they existed.`);
     }
}

// showMessageToAll remains the same...
/** Helper to broadcast a message to all clients */
function showMessageToAll(io, text, type = 'info') {
    io.emit('serverMessage', { text, type });
}