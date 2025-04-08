// server/game/GameInstanceManager.js
import { GameInstance } from './GameInstance.js';
import * as Config from '../config.js'; // <<< Import Config here

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
        // Don't map player yet, routePlayer will do it after adding
        // this.playerInstanceMap.set(socket.id, instance.state.instanceId);
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
            instance.stopSimulationLoop(); // Ensure loops are stopped
            instance.stopCountdown();

            // Remove players from the map and potentially the socket rooms
            instance.getAllPlayers().forEach((playerData, socketId) => {
                 this.playerInstanceMap.delete(socketId);
                 const socket = instance.findSocket(socketId); // Attempt to find socket
                 if (socket) {
                      socket.leave(instance.state.roomId);
                 }
            });

            this.instances.delete(instanceId);
            if (this.multiplayerInstanceId === instanceId) {
                console.log(`InstanceMgr: Removed multiplayer instance. It needs to be recreated.`);
                this.multiplayerInstanceId = null; // Allow recreation
            }
            console.log(`InstanceMgr: Instance ${instanceId} removed. Remaining instances: ${this.instances.size}`);
            return true;
        }
         console.warn(`InstanceMgr: Tried to remove non-existent instance ${instanceId}`);
        return false;
    }

    // --- Player Routing & Management ---

    routePlayer(socket, intent, isAdmin) {
        console.log(`InstanceMgr: Routing player ${socket.id} with intent: ${intent}, isAdmin: ${isAdmin}`);
        let targetInstance = null;

        if (isAdmin || intent === 'spectate') {
            console.log(`InstanceMgr: Routing admin/spectator ${socket.id} to multiplayer instance.`);
            targetInstance = this.getOrCreateMultiplayerInstance();
            const playerState = targetInstance.addPlayer(socket);
            if (playerState) {
                playerState.isSpectator = true;
                playerState.isAlive = false;
                if (isAdmin) playerState.playerName = `ADMIN_${socket.id.substring(0, 4)}`;
                 socket.emit('gameStateUpdate', targetInstance.getSnapshot());
                 targetInstance.broadcastState(); // Inform others in the room
                 this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId); // Map player to instance
            } else {
                 console.error(`InstanceMgr: Failed to add admin/spectator ${socket.id} to multiplayer instance.`);
                 socket.disconnect(true);
                 return null; // Explicitly return null on failure
            }
        }
        else if (intent === 'single') {
            targetInstance = this.createSinglePlayerInstance(socket);
            const playerState = targetInstance.addPlayer(socket);
             if (playerState) {
                 playerState.isSpectator = false;
                 playerState.isAlive = true; // Start single player alive
                 // *** Use Config here for default spawn height ***
                 const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 playerState.spawnPoint = { x: 0, y: baseHeight, z: 0 };
                 playerState.hasChosenSpawn = true;
                 targetInstance.setGamePhase('playing');
                 targetInstance.startSimulationLoop();
                 socket.emit('gameStateUpdate', targetInstance.getSnapshot());
                 this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId); // Map player to instance
             } else {
                  console.error(`InstanceMgr: Failed to add player ${socket.id} to new single-player instance.`);
                  // Instance was added to map in createSinglePlayerInstance, remove it now.
                  if (targetInstance) this.removeInstance(targetInstance.state.instanceId);
                  socket.disconnect(true);
                  return null; // Explicitly return null on failure
             }
        }
        else if (intent === 'multi') {
            targetInstance = this.getOrCreateMultiplayerInstance();
            const currentPhase = targetInstance.state.gamePhase;

            if (currentPhase === 'playing' || currentPhase === 'countdown') {
                console.warn(`InstanceMgr: Player ${socket.id} joining active multiplayer game (Phase: ${currentPhase}). Forcing Spectator.`);
                const playerState = targetInstance.addPlayer(socket);
                 if (playerState) {
                     playerState.isSpectator = true;
                     playerState.isAlive = false;
                     socket.emit('serverMessage', { text: 'Game in progress, joining as spectator.', type: 'warning'});
                     socket.emit('gameStateUpdate', targetInstance.getSnapshot());
                     targetInstance.broadcastState();
                     this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId); // Map player to instance
                 } else {
                      console.error(`InstanceMgr: Failed to add player ${socket.id} as spectator to active multiplayer game.`);
                      socket.disconnect(true);
                      return null; // Explicitly return null on failure
                 }
            } else { // Joining lobby/ended multiplayer game
                 console.log(`InstanceMgr: Player ${socket.id} joining multiplayer lobby (Phase: ${currentPhase}).`);
                 const playerState = targetInstance.addPlayer(socket);
                 if (playerState) {
                     playerState.isSpectator = false;
                     playerState.isAlive = false; // Start dead in lobby
                     socket.emit('gameStateUpdate', targetInstance.getSnapshot());
                     targetInstance.broadcastState();
                     this.playerInstanceMap.set(socket.id, targetInstance.state.instanceId); // Map player to instance
                 } else {
                      console.error(`InstanceMgr: Failed to add player ${socket.id} to multiplayer lobby.`);
                      socket.disconnect(true);
                      return null; // Explicitly return null on failure
                 }
            }
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

                      // Check if instance should be removed
                      if (instance.state.mode === 'single' && instance.getAllPlayers().size === 0) {
                           console.log(`InstanceMgr: Last player left single-player instance ${instanceId}. Removing instance.`);
                           this.removeInstance(instanceId);
                      }
                      // Auto-remove multiplayer instance if empty? Maybe not, allow it to persist in lobby state.
                      // else if (instance.state.mode === 'multi' && instance.getAllPlayers().size === 0) {
                      //      console.log(`InstanceMgr: Last player left multiplayer instance ${instanceId}. Removing instance.`);
                      //      this.removeInstance(instanceId);
                      // }
                      else {
                          // If not removing instance, broadcast updated state within the instance
                          instance.broadcastState();
                      }
                      return true; // Successfully removed
                 }
            } else {
                 console.error(`InstanceMgr: Instance ${instanceId} not found for player ${socketId} during removal.`);
                 this.playerInstanceMap.delete(socketId); // Clean up map anyway
            }
        } else {
             console.warn(`InstanceMgr: Cannot remove player ${socketId}, instance ID not found in map.`);
        }
        return false; // Removal failed or player not found
    }
}

export { GameInstanceManager }; // Export the class