import * as THREE from 'three';
import { socket } from './socket.js'; // <<< Import from new module
import { gameState } from './gameState.js'; // Use gameState for caching server state
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js'; // Reuse scene setup
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js'; // Reuse tree rendering
import { uiElements, cacheDOMElements } from './ui/elements.js'; // Cache admin page UI elements & uiElements ref
import { updateUI as updateAdminUI } from './ui/updateAdmin.js'; // Use a SEPARATE admin UI update function
import { showMessage, clearMessage, attachServerMessageListener } from './ui/messageHandler.js'; // Use message handler
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js'; // Import hide/show functions
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;
// let socket = null; // <<< REMOVE
let isAdminAuthenticated = false; // Track websocket auth status
let targetInstanceId = null; // <<< Store the ID of the instance admin should observe
let messageListenerAttached = false; // Module-level flag for message listener


// --- Initialization Function ---
function initializeAdminApp() {
    console.log("Initializing Admin Panel Client...");
    // --- Get Admin Password from URL ---
    // No change needed here, password still needed for initial auth
    const urlParams = new URLSearchParams(window.location.search);
    const initialAdminPassword = urlParams.get('pw'); // Store locally for initial connect
    if (!initialAdminPassword) {
        console.error("Admin Password missing from URL (?pw=...).");
        document.body.innerHTML = '<h1>Access Denied: Admin password missing from URL (?pw=...)</h1>';
        return; // Stop execution if no password
    }
    // Don't clear URL history immediately, might need it on reconnect logic in 'connect' handler
    // try { history.replaceState(null, '', window.location.pathname); } catch (e) { console.warn("Could not clear URL history."); }

    // --- Basic Setup ---
    gameState.isSpectator = true; // Admin is always a spectator type
    cacheDOMElements(); // Cache elements defined in admin.html, including back button
    const canvas = uiElements.canvas; // Use cached canvas
    if (!canvas) { console.error("Admin Canvas element #game-canvas not found!"); return; }

    initScene(canvas); // Setup Three.js scene

     // +++ Add Back Button Listener +++
    if (uiElements.backButton) {
        uiElements.backButton.addEventListener('click', () => {
            console.log("Admin: Back to Menu button clicked.");
            if (socket && socket.connected) {
                socket.disconnect(); // Disconnect before navigating
            }
            window.location.href = '/'; // Navigate to main menu
        });
         console.log("Admin: Back button listener added.");
    } else {
         console.warn("Admin: Back button UI element not found during init.");
    }

    // Socket is already connecting via socket.js
    console.log("Admin: Socket connection managed by socket.js. Setting up listeners.");
    setupAdminSocketListeners(initialAdminPassword); // Pass initial password to listener setup
    setupAdminButtonListeners(); // Setup listeners for admin buttons
    updateAdminUI(); // Initial UI render
    clearMessage();
    console.log("Admin Client Initialization complete.");
}

// --- Socket Event Listener Setup ---
function setupAdminSocketListeners(initialPassword) { // Accept initial password
     // Listen for 'connect' event from the shared socket
     socket.on('connect', () => {
         // Check if we already authenticated for this connection instance
         // (socket.id should be populated by the time 'connect' fires)
         if (socket.id && socket.id !== gameState.myId) { // Only authenticate if ID changed or is new
             gameState.myId = socket.id; // Update local ID
             console.log(`Admin: Socket connected with ID: ${gameState.myId}. Authenticating...`);
             showMessage(`Admin connected. Authenticating...`, 'info');

             // Use the password passed during setup or try to get from URL again (for reconnects)
             let passwordToSend = initialPassword;
             if (!passwordToSend) {
                 const urlParams = new URLSearchParams(window.location.search);
                 passwordToSend = urlParams.get('pw');
                 console.log("Admin: Re-fetching password from URL for authentication.");
             }

             if (passwordToSend) {
                 console.log("Admin: Sending authentication request...");
                 socket.emit('adminAuthenticate', { password: passwordToSend });
                 // Clear URL history *after* successful authentication might be better
             } else {
                 console.error("Admin: Password missing from URL/initial setup on (re)connect.");
                 showMessage(`Authentication Error! No password found.`, 'error');
                 socket.disconnect(); // Can't authenticate, disconnect
             }
             // Do not clear password variable here

             // Attach message listener *once* per logical connection attempt
             if (!messageListenerAttached) {
                 console.log("Admin: Attaching server message listener.");
                 attachServerMessageListener();
                 messageListenerAttached = true; // Set flag
             }
         } else if (!socket.id) {
             console.warn("Admin: 'connect' event fired but socket.id is still null?");
         } else {
             console.log(`Admin: Socket already connected with ID ${socket.id}. Waiting for auth result if pending.`);
             // Potentially re-send auth if not authenticated yet?
             if (!isAdminAuthenticated && initialPassword) {
                  console.log("Admin: Re-sending authentication request on existing connection (was not authenticated)...");
                  socket.emit('adminAuthenticate', { password: initialPassword });
             }
         }
     });

    socket.on('adminAuthResult', (result) => {
        if (result.success) {
            isAdminAuthenticated = true;
            console.log("Admin: WebSocket Authentication successful.");
            showMessage(`Admin Authenticated`, 'success');
            if (uiElements.adminControls) {
                uiElements.adminControls.style.display = 'flex';
            }
            // Maybe clear URL history now?
            try { history.replaceState(null, '', window.location.pathname); } catch (e) { console.warn("Could not clear URL history after auth."); }
        } else {
            isAdminAuthenticated = false;
            console.error("Admin: WebSocket Authentication Failed!", result.reason);
            showMessage(`Admin Auth Failed: ${result.reason || 'Invalid Password'}`, 'error');
            if (uiElements.adminControls) {
                uiElements.adminControls.style.display = 'none';
            }
            // Consider disconnecting if auth fails persistently
            // if(socket) socket.disconnect();
        }
    });

    socket.on('disconnect', (reason) => {
        console.log(`Admin: Disconnected: ${reason}`);
        showMessage("Disconnected!", "error");
        isAdminAuthenticated = false; // Reset auth status
        gameState.myId = null; // Clear ID
        messageListenerAttached = false; // Allow re-attaching on next connect
        gameState.initialStateReceived = false;
        targetInstanceId = null; /* Clear target instance */
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        if (uiElements.adminControls) { uiElements.adminControls.style.display = 'none'; }
        disposeAllTrees();
        // Don't clear players here, rely on next gameStateUpdate
    });

    // connect_error listener is now in socket.js
    // socket.on('connect_error', (error) => { ... });

    // --- Game State Update Handler (Spectator View) ---
    socket.on('gameStateUpdate', (serverState) => {
        // --- Ensure admin is authenticated before processing game state ---
        // Although server *shouldn't* send updates if auth failed, this is safer client-side
        if (!isAdminAuthenticated) {
             // console.log("Admin GS Update: Skipping update, not authenticated.");
             return;
        }

        if (!gameState.myId) { console.log("Admin GS Update: Skipping update, myId not set yet."); return; } // Need own ID first

        // +++ Check if this update is from the correct instance +++
         if (!targetInstanceId) {
             if (serverState.instanceId) {
                 if(serverState.players && serverState.players[gameState.myId]){
                      console.log(`Admin GS Update: Received first valid state from Instance ${serverState.instanceId}. Setting as target.`);
                      targetInstanceId = serverState.instanceId;
                 } else {
                      console.warn(`Admin GS Update: Received initial state from Instance ${serverState.instanceId}, but it doesn't contain my ID (${gameState.myId}). Waiting for correct instance state.`);
                      return;
                 }
             } else {
                  console.warn("Admin GS Update: Received state without instanceId. Cannot determine target. Ignoring update.");
                  return;
             }
         } else if (serverState.instanceId !== targetInstanceId) {
             // console.warn(`Admin GS Update: Ignoring state from wrong instance ${serverState.instanceId} (Target: ${targetInstanceId}).`);
             return; // Ignore updates from other instances
         }
         // +++ If we reach here, the update is for the correct instance +++

         const previousPhase = gameState.gamePhase;
         const playersFromServer = serverState.players || {};
         const myServerData = playersFromServer[gameState.myId];

         // +++ Log Received Admin State +++
         if (myServerData) {
              // console.log(`Admin GS Update (${targetInstanceId}): Received state for self (${gameState.myId}): isSpectator=${myServerData.isSpectator}, isAlive=${myServerData.isAlive}, Name=${myServerData.playerName}`); // Reduce noise
         } else {
              console.warn(`Admin GS Update (${targetInstanceId}): Did not receive state for self (${gameState.myId}) in this update.`);
         }
         // ++++++++++++++++++++++++++++++++

         // Update core state properties
         Object.assign(gameState, {
             day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex, isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor, isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer, serverTime: serverState.serverTime, players: playersFromServer, allowPlayerCountdownStart: serverState.allowPlayerCountdownStart,
         });
         // *** Force isSpectator based on received data for self, fallback to true if self not found ***
         gameState.isSpectator = myServerData ? myServerData.isSpectator : true;

         if (!gameState.initialStateReceived && myServerData) {
             console.log(`Admin: First valid state for target instance ${targetInstanceId} processed.`);
             if(controls && camera) { // Ensure camera also exists
                 controls.target.set(0, 5, 0);
                 camera.position.set(15, 20, 15); // Overview position
                 controls.update();
                 console.log("Admin camera position set:", camera.position);
                 console.log("Admin controls target set:", controls.target);
             }
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain();
             gameState.initialStateReceived = true; startGameLoop();
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         } else if (gameState.gamePhase !== previousPhase) {
             console.log(`Admin phase updated to: ${gameState.gamePhase}`); showMessage(`Game state: ${gameState.gamePhase}`, 'info');
             if(gameState.gamePhase !== 'ended' && uiElements.gameOverModal && !uiElements.gameOverModal.classList.contains('hidden')) { hideGameOverModal(); }
         }

         /* Update Environment */ const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();

         /* Update Trees */
         // console.log(`--- Admin Tree Update Loop START (Instance: ${targetInstanceId}) ---`);
         const receivedPlayerIds = new Set(Object.keys(playersFromServer));
         for (const playerId in playersFromServer) {
             const playerData = playersFromServer[playerId];
             const isPlayerSpectatorInThisUpdate = playerData.isSpectator || playerData.playerName.startsWith('ADMIN_');
             // console.log(`Admin Tree Update: Processing P:[${playerId.substring(0,5)}] Is Spectator Flag (this update): ${isPlayerSpectatorInThisUpdate}`);

             if (isPlayerSpectatorInThisUpdate) {
                 // console.log(`Admin Tree Update: Calling removeTree for spectator/admin ${playerId}`);
                 removeTree(playerId);
             } else {
                 // console.log(`Admin Tree Update: Calling createOrUpdateTree for non-spectator ${playerId}`);
                 createOrUpdateTree(playerId, playerData);
             }
         }
         gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) { removeTree(playerId); } });
         // console.log("--- Admin Tree Update Loop END ---");

         /* Update Camera Target */ if (controls) controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05);

         updateAdminUI(); // Update non-tree UI

     }); // End gameStateUpdate

    socket.on('playerDisconnected', (playerId) => { console.log(`Admin View: Player ${playerId} disconnected.`); removeTree(playerId); /* UI updates on next gameStateUpdate */ });
    socket.on('gameOver', (data) => {
         console.log("Admin View: Game Over event received:", data);
         gameState.gameOver = true; gameState.gameOverReason = data.reason || "Game Ended"; gameState.winnerId = data.winnerId;
         showGameOverUI();
    });
    // serverMessage listener attached via attachServerMessageListener
    // socket.on('serverMessage', (data) => { ... });

} // End of setupAdminSocketListeners


// --- Setup Listeners for Admin Buttons ---
function setupAdminButtonListeners() {
    console.log("Admin: Setting up button listeners...");
    const forceStartBtn = document.getElementById('admin-force-start');
    const forceEndBtn = document.getElementById('admin-force-end');
    const resetCountdownBtn = document.getElementById('admin-reset-countdown');
    // const closeModalBtn = uiElements.adminCloseModalButton; // Listener attached in showGameOverUI

    if (uiElements.adminControls) uiElements.adminControls.style.display = 'none'; // Start hidden

    function emitAdminCommand(command) {
        // Use the imported socket directly
        if (socket && socket.connected && isAdminAuthenticated) {
            console.log(`Admin: Emitting command: ${command}`);
            socket.emit(command);
        } else { console.error(`Admin: Cannot send command '${command}', socket not connected or not authenticated.`); showMessage("Cannot send command: Not authenticated.", "error"); }
    }

    if (forceStartBtn) forceStartBtn.addEventListener('click', () => emitAdminCommand('adminForceStart')); else console.warn("Admin button 'admin-force-start' not found.");
    if (forceEndBtn) forceEndBtn.addEventListener('click', () => emitAdminCommand('adminForceEnd')); else console.warn("Admin button 'admin-force-end' not found.");
    if (resetCountdownBtn) resetCountdownBtn.addEventListener('click', () => emitAdminCommand('adminResetCountdown')); else console.warn("Admin button 'admin-reset-countdown' not found.");

}

// --- Admin Rendering Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();
    // +++ Add Log +++
    // console.log(`Admin gameLoop tick: ${deltaTime.toFixed(4)}`); // Can be noisy, use temporarily
    updateEnvironmentVisuals(deltaTime);
    updateRain(deltaTime);
    updateAdminUI(); // Use the dedicated admin UI updater
    if (controls) controls.update();
    if (renderer && scene && camera) {
         renderer.render(scene, camera); // Render AFTER updates
    } else {
         console.error("Admin Render components missing!");
         stopGameLoop();
    }
}
function startGameLoop() {
    if (animationFrameId !== null) return;
    console.log("Admin: Starting render loop.");
    clock = new THREE.Clock(); // Reset clock
    gameLoop();
}
function stopGameLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Admin: Stopped render loop.");
    }
}

// --- Start Admin Application ---
// Conditional check remains the same
const adminScriptUrl = new URL('/admin.js', window.location.origin).href;
if (import.meta.url === adminScriptUrl) {
     console.log("admin.js detected as entry point script. Adding DOMContentLoaded listener.");
     document.addEventListener('DOMContentLoaded', initializeAdminApp);
} else {
     console.log(`admin.js imported as dependency (URL: ${import.meta.url}), skipping initializeAdminApp listener.`);
}