// server/game/GameInstanceManager.js
import { GameInstance } from './GameInstance.js';
import * as Config from '../config.js'; // Import Config here

class GameInstanceManager {
    constructor(io) {
        this.io = io; // Socket.IO server instance
        this.instances = new Map(); // Map<instanceId, GameInstance>
        this.multiplayerInstanceId = null; // Track the ID of the single multiplayer game instance
        this.playerInstanceMap = new Map(); // Map<socketId, instanceId> - To quickly find which instance a player belongs to
        console.log("GameInstanceManager initialized.");
    }

    // --- Instance Creation ---

    createSinglePlayerInstance(socket) {
        console.log(`InstanceMgr: Creating new single-player instance for ${socket.id}`);
        const instance = new GameInstance('single', this.io);
        this.instances.set(instance.state.instanceId, instance);
        console.log(`InstanceMgr: Added instance ${instance.state.instanceId} to manager. Total instances: ${this.instances.size}`);
        return instance;
    }

    getOrCreateMultiplayerInstance() {
        if (this.multiplayerInstanceId && this.instances.has(this.multiplayerInstanceId)) {
            return this.instances.get(this.multiplayerInstanceId);
        } else {
            console.log("InstanceMgr: Creating new (and only) multiplayer instance.");
            const instance = new GameInstance('multi', this.io);
            this.instances.set(instance.state.instanceId, instance);
            this.multiplayerInstanceId = instance.state.instanceId; // Store its ID
            console.log(`InstanceMgr: Added multiplayer instance ${instance.state.instanceId}. Total instances: ${this.instances.size}`);
            return instance;
        }
    }

    // --- Instance Management ---

    getInstance(instanceId) {
        return this.instances.get(instanceId) || null;
    }

    removeInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            console.log(`InstanceMgr: Removing instance ${instanceId} (Mode: ${instance.state.mode}).`);
            instance.stopSimulationLoop();
            instance.stopCountdown();
            instance.getAllPlayers().forEach((playerData, socketId) => {
                 this.playerInstanceMap.delete(socketId);
                 const socket = instance.findSocket(socketId);
                 if (socket) { socket.leave(instance.state.roomId); }
            });
            this.instances.delete(instanceId);
            if (this.multiplayerInstanceId === instanceId) {
                console.log(`InstanceMgr: Removed multiplayer instance. It needs to be recreated.`);
                this.multiplayerInstanceId = null;
            }
            console.log(`InstanceMgr: Instance ${instanceId} removed. Remaining instances: ${this.instances.size}`);
            return true;
        }
         console.warn(`InstanceMgr: Tried to remove non-existent instance ${instanceId}`);
        return false;
    }

    // --- Player Routing & Management ---
    // <<<--- ACCEPT SETTINGS ARGUMENT (make it optional for admin/spectate) ---<<<
    routePlayer(socket, intent, isAdmin, settings = null) {
        console.log(`InstanceMgr: Routing player ${socket.id} with intent: ${intent}, isAdmin: ${isAdmin}`);
        let targetInstance = null;

        if (isAdmin || intent === 'spectate') {
            // Admins/Spectators don't typically need custom settings applied this way
            console.log(`InstanceMgr: Routing admin/spectator ${socket.id} to multiplayer instance.`);
            targetInstance = this.getOrCreateMultiplayerInstance();
            const playerState = targetInstance.addPlayer(socket);
            if (playerState) {
                playerState.isSpectator = true;
                playerState.isAlive = false;
                if (isAdmin) playerState.playerName = `ADMIN_${socket.id.substring(0, 4)}`;
                // Don't apply user settings to admin/spectator unless desired

                console.log(`InstanceMgr: Player state for ${socket.id} SET: isSpectator=${playerState.isSpectator}, isAlive=${playerState.isAlive}, Name=${playerState.playerName}`);
                this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId);
                const snapshotData = targetInstance.getSnapshot();
                const adminDataInSnapshot = snapshotData.players[socket.id];
                console.log(`InstanceMgr: Sending initial snapshot. Admin (${socket.id}) data in snapshot: isSpectator=${adminDataInSnapshot?.isSpectator}, isAlive=${adminDataInSnapshot?.isAlive}`);
                socket.emit('gameStateUpdate', snapshotData);
                targetInstance.broadcastState();
            } else {
                 console.error(`InstanceMgr: Failed to add admin/spectator ${socket.id} to multiplayer instance.`);
                 socket.disconnect(true);
                 return null;
            }

        } else if (intent === 'single') {
            targetInstance = this.createSinglePlayerInstance(socket);
            const playerState = targetInstance.addPlayer(socket);
             if (playerState) {
                 playerState.isSpectator = false;
                 playerState.isAlive = true;
                 const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 playerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                 playerState.hasChosenSpawn = true;

                 // --->>> APPLY SETTINGS FOR SINGLE PLAYER <<<---
                 if (settings) {
                     playerState.playerName = settings.playerName;
                     playerState.leafColor = settings.leafColor;
                     playerState.trunkColor = settings.trunkColor;
                     console.log(`InstanceMgr: Applied settings to single player ${socket.id}:`, { name: playerState.playerName, leaf: playerState.leafColor, trunk: playerState.trunkColor });
                 } else {
                      console.warn(`InstanceMgr: No settings provided for single player ${socket.id}. Using defaults.`);
                 }
                 // ---<<< END APPLY SETTINGS >>>---

                 targetInstance.setGamePhase('playing');
                 targetInstance.startSimulationLoop();
                 this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId);
                 console.log(`InstanceMgr: Sending initial state snapshot to single player ${socket.id}`);
                 socket.emit('gameStateUpdate', targetInstance.getSnapshot());
             } else {
                  console.error(`InstanceMgr: Failed to add player ${socket.id} to new single-player instance.`);
                  if (targetInstance) this.removeInstance(targetInstance.state.instanceId);
                  socket.disconnect(true);
                  return null;
             }

        } else if (intent === 'multi') {
            targetInstance = this.getOrCreateMultiplayerInstance();
            const currentPhase = targetInstance.state.gamePhase;
            const playerState = targetInstance.addPlayer(socket);

            if(!playerState){
                 console.error(`InstanceMgr: Failed to add multiplayer player ${socket.id}.`);
                 socket.disconnect(true);
                 return null;
            }

             playerState.isSpectator = false; // Default for multi intent
             playerState.isAlive = false;

            // --->>> APPLY SETTINGS FOR MULTIPLAYER <<<---
            if (settings) {
                playerState.playerName = settings.playerName;
                playerState.leafColor = settings.leafColor;
                playerState.trunkColor = settings.trunkColor;
                console.log(`InstanceMgr: Applied settings to multiplayer player ${socket.id}:`, { name: playerState.playerName, leaf: playerState.leafColor, trunk: playerState.trunkColor });
            } else {
                 console.warn(`InstanceMgr: No settings provided for multiplayer player ${socket.id}. Using defaults.`);
            }
            // ---<<< END APPLY SETTINGS >>>---

            // Determine spectator status based on phase *after* applying settings
            if (currentPhase === 'playing' || currentPhase === 'countdown') {
                console.warn(`InstanceMgr: Player ${socket.id} (${playerState.playerName}) joining active multiplayer game (Phase: ${currentPhase}). Forcing Spectator.`);
                playerState.isSpectator = true; // Force spectator
                socket.emit('serverMessage', { text: 'Game in progress, joining as spectator.', type: 'warning'});
            } else {
                 console.log(`InstanceMgr: Player ${socket.id} (${playerState.playerName}) joining multiplayer lobby (Phase: ${currentPhase}).`);
                 // isSpectator = false, isAlive = false (already set)
            }

            this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId); // Map player to instance
            console.log(`InstanceMgr: Sending initial state snapshot to multiplayer player ${socket.id}`);
            socket.emit('gameStateUpdate', targetInstance.getSnapshot());
            targetInstance.broadcastState(); // Inform others
        }
        else {
            console.error(`InstanceMgr: Unknown intent '${intent}' for player ${socket.id}. Disconnecting.`);
            socket.disconnect(true);
            return null; // Explicitly return null on failure
        }

        // Return the instance the player was routed to (or null if failed)
        return targetInstance;
    }


    getInstanceIdForPlayer(socketId) {
        return this.playerInstanceMap.get(socketId) || null;
    }

    removePlayerFromInstance(socketId) {
        const instanceId = this.getInstanceIdForPlayer(socketId);
        if (instanceId) {
            const instance = this.getInstance(instanceId);
            if (instance) {
                 const wasRemoved = instance.removePlayer(socketId);
                 if (wasRemoved) {
                      this.playerInstanceMap.delete(socketId);
                      console.log(`InstanceMgr: Removed player ${socketId} from instance map.`);
                      if (instance.state.mode === 'single' && instance.getAllPlayers().size === 0) {
                           console.log(`InstanceMgr: Last player left single-player instance ${instanceId}. Removing instance.`);
                           this.removeInstance(instanceId);
                      }
                      else if (instance.getAllPlayers().size > 0) {
                          instance.broadcastState();
                      }
                      return true;
                 }
            } else {
                 console.error(`InstanceMgr: Instance ${instanceId} not found for player ${socketId} during removal.`);
                 this.playerInstanceMap.delete(socketId);
            }
        } else {
             console.warn(`InstanceMgr: Cannot remove player ${socketId}, instance ID not found in map.`);
        }
        return false;
    }
}

export { GameInstanceManager };