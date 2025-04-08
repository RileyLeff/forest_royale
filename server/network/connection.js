// server/network/connection.js
import { addPlayer, removePlayer, getGlobalState, getAllPlayers, setGamePhase, getPlayerState, updateGlobalState } from '../game/GameState.js';
import { getFullGameStateSnapshot, broadcastGameState } from './stateBroadcaster.js';
import { stopSimulation, startGame as triggerServerStartGame } from '../server.js';
import { resetGame, startLobbyCountdown, cancelLobbyCountdown } from '../game/gameLogic.js';
import * as Config from '../config.js';

const MIN_SPAWN_DISTANCE_SQ = 4 * 4;

/** Sets up event listeners for a newly connected socket. */
export function handleConnection(socket, io) {
    console.log(`Connection: Player connected: ${socket.id}`);

    socket.on('playerJoinRequest', (data) => {
        console.log(`Connection: Received playerJoinRequest from ${socket.id}`, data);
        const intent = data?.intent || 'single';
        const playerName = data?.playerName; // ... other data ...

        if (getPlayerState(socket.id)) { /* ... handle already exists ... */ return; }

        addPlayer(socket.id);
        const playerState = getPlayerState(socket.id);
        if (!playerState) { /* ... handle state creation failure ... */ return; }
        // ... (update name/color if needed) ...

        const currentPhase = getGlobalState().gamePhase;
        const playerCount = Object.keys(getAllPlayers()).length;
        const isFirstPlayer = (playerCount === 1);

        // --- Handle based on Intent ---

        if (intent === 'spectate') {
             // *** SPECTATOR JOIN ***
             console.log(`Connection: Player ${socket.id} joining as spectator.`);
             playerState.isAlive = false;
             playerState.isSpectator = true; // <<< Set spectator flag
             // Send current state, including self marked as spectator
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
             // Inform others (optional, leaderboard might show differently later?)
             broadcastGameState(io, getAllPlayers(), getGlobalState());

        } else if (intent === 'single') {
            // *** SINGLE PLAYER JOIN ***
            if (isFirstPlayer && (currentPhase === 'lobby' || currentPhase === 'ended')) {
                 console.log(`Connection: Player ${socket.id} starting single-player game.`);
                 resetGame();
                 const freshPlayerState = getPlayerState(socket.id) || addPlayer(socket.id);
                 if (freshPlayerState) {
                     freshPlayerState.isAlive = true; freshPlayerState.isSpectator = false; // Ensure not spectator
                     const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                     freshPlayerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                     setGamePhase('playing');
                     console.log(`Connection: Player ${socket.id} marked alive.`);
                     broadcastGameState(io, getAllPlayers(), getGlobalState());
                     triggerServerStartGame();
                 }
            } else { /* ... handle cannot start single ... */
                 console.warn(`Connection: Player ${socket.id} requested single-player, cannot start. Joining observer.`);
                 playerState.isAlive = false; playerState.isSpectator = true; // Join as spectator if cannot start
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
            }
        } else if (intent === 'multi') {
             // *** MULTIPLAYER JOIN ***
             playerState.isSpectator = false; // Ensure not spectator
             if (currentPhase === 'playing' || currentPhase === 'countdown') {
                 console.log(`Connection: Player ${socket.id} joining multi game in progress/countdown. Observer.`);
                 playerState.isAlive = false;
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             } else { // Lobby or Ended
                 console.log(`Connection: Player ${socket.id} joining multi lobby/ended. Phase: ${currentPhase}`);
                 playerState.isAlive = false;
                 if (currentPhase === 'ended' && isFirstPlayer) resetGame();
                 socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
                 broadcastGameState(io, getAllPlayers(), getGlobalState());
             }
        } else { /* ... handle unknown intent ... */
             console.warn(`Connection: Unknown player intent: ${intent}. Joining observer.`);
             playerState.isAlive = false; playerState.isSpectator = true;
             socket.emit('gameStateUpdate', getFullGameStateSnapshot(getAllPlayers(), getGlobalState()));
        }

        // Setup other listeners specific to this player *now*
        // Spectators generally won't send inputs, but safe to add listeners anyway
        setupInputAndActionListeners(socket, io);

    }); // End of 'playerJoinRequest' handler

    socket.on('disconnect', () => { handleDisconnect(socket, io); });

} // End of handleConnection

/** Sets up listeners for controls AND actions */
function setupInputAndActionListeners(socket, io) {
     socket.on('updateStomata', (data) => { /* ... stomata logic ... */
         const playerState = getPlayerState(socket.id);
         // Ignore input from spectators
         if (playerState && playerState.isAlive && !playerState.isSpectator && typeof data?.value === 'number') {
              playerState.stomatalConductance = Math.max(0, Math.min(1, data.value));
         }
      });
     socket.on('updateAllocation', (data) => { /* ... allocation logic ... */
         const playerState = getPlayerState(socket.id);
          // Ignore input from spectators
         if (playerState && playerState.isAlive && !playerState.isSpectator && typeof data?.savings === 'number' && typeof data?.growthRatio === 'number') {
             playerState.lastSavingsPercent = Math.max(0, Math.min(100, data.savings));
             playerState.lastGrowthRatioPercent = Math.max(0, Math.min(100, data.growthRatio));
         }
      });
     socket.on('requestStartCountdown', () => { /* ... countdown logic ... */
         console.log(`Connection: Received 'requestStartCountdown' from socket ${socket.id}`);
         const currentPhase = getGlobalState().gamePhase;
         const playerState = getPlayerState(socket.id);
         // Ignore request from spectators
         if (playerState && !playerState.isSpectator && currentPhase === 'lobby') { startLobbyCountdown(io); }
         else { console.log(`Connection: Ignoring requestStartCountdown. Phase: ${currentPhase}, Player: ${!!playerState}, Spectator: ${playerState?.isSpectator}`); }
      });
     socket.on('selectSpawnPoint', (coords) => { /* ... spawn selection logic ... */
          const playerState = getPlayerState(socket.id);
          const currentPhase = getGlobalState().gamePhase;
          const players = getAllPlayers();
          console.log(`Connection: Received 'selectSpawnPoint' from ${socket.id}:`, coords);
          // Ignore request from spectators
          if (!playerState || playerState.isSpectator || !coords || typeof coords.x !== 'number' || typeof coords.z !== 'number') { console.warn(`Conn: Invalid spawn request data/spectator.`); socket.emit('spawnPointInvalid', { reason: 'Invalid data/spectator.' }); return; }
          if (currentPhase !== 'lobby') { console.warn(`Conn: Spawn request outside lobby.`); socket.emit('spawnPointInvalid', { reason: 'Can only select in lobby.' }); return; }
          if (playerState.hasChosenSpawn) { console.warn(`Conn: Player ${socket.id} already chose spawn.`); socket.emit('spawnPointInvalid', { reason: 'Already chosen.' }); return; }
          // Validate Coordinates
          const islandRadius = Config.ISLAND_RADIUS || 50; const distSqFromCenter = coords.x**2 + coords.z**2;
          if (distSqFromCenter > islandRadius*islandRadius) { console.log(`Conn: Spawn rej - Out of bounds.`); socket.emit('spawnPointInvalid', { reason: 'Outside island.' }); return; }
          let tooClose = false;
          for (const otherPlayer of Object.values(players)) { if (otherPlayer.id !== socket.id && otherPlayer.hasChosenSpawn) { const dx = coords.x - otherPlayer.spawnPoint.x; const dz = coords.z - otherPlayer.spawnPoint.z; const distSq = dx*dx + dz*dz; if (distSq < MIN_SPAWN_DISTANCE_SQ) { tooClose = true; break; } } }
          if (tooClose) { console.log(`Conn: Spawn rej - Too close.`); socket.emit('spawnPointInvalid', { reason: 'Too close.' }); return; }
          // Validation Passed
          console.log(`Conn: Spawn point for ${socket.id} confirmed.`);
          const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
          playerState.spawnPoint = { x: coords.x, y: baseHeight, z: coords.z }; playerState.hasChosenSpawn = true;
          socket.emit('spawnPointConfirmed', playerState.spawnPoint); broadcastGameState(io, players, getGlobalState());
      });
} // End of setupInputAndActionListeners

/** Handles socket disconnection */
function handleDisconnect(socket, io) { /* ... disconnect logic ... */
     console.log(`Connection: Player disconnected: ${socket.id}`); const playerState = getPlayerState(socket.id); const wasRemoved = removePlayer(socket.id);
     if (wasRemoved) { io.emit('playerDisconnected', socket.id); broadcastGameState(io, getAllPlayers(), getGlobalState()); const remainingPlayerCount = Object.keys(getAllPlayers()).length; const currentPhase = getGlobalState().gamePhase; if (remainingPlayerCount === 0) { console.log("Connection: Last player disconnected. Resetting game."); resetGame(); } else if (currentPhase === 'countdown') { console.log("Connection: Player left during countdown. Continues."); }
     } else { console.warn(`Connection: Disconnect for ${socket.id}, but player not found.`); }
}