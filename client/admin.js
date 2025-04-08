import * as THREE from 'three';
// Import necessary modules (paths relative to client/)
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
let socket = null; // Keep socket global within this module's scope
let adminPassword = null; // Store password retrieved from URL
let isAdminAuthenticated = false; // Track websocket auth status
let targetInstanceId = null; // <<< Store the ID of the instance admin should observe


// --- Initialization Function ---
function initializeAdminApp() {
    console.log("Initializing Admin Panel Client...");
    // --- Get Admin Password from URL ---
    const urlParams = new URLSearchParams(window.location.search);
    adminPassword = urlParams.get('pw');
    if (!adminPassword) {
        console.error("Admin Password missing from URL (?pw=...).");
        document.body.innerHTML = '<h1>Access Denied: Admin password missing from URL (?pw=...)</h1>';
        return; // Stop execution if no password
    }
    try { history.replaceState(null, '', window.location.pathname); } catch (e) { console.warn("Could not clear URL history."); }


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

    console.log("Admin: Attempting to connect to server...");
    console.log("[admin.js] About to call io() constructor..."); // <<< ADD LOG
    socket = io({
         reconnection: true,
         reconnectionAttempts: 3, // Less aggressive for admin?
         reconnectionDelay: 2000,
    }); // Define socket
    console.log("[admin.js] io() constructor called. Socket ID (initially):", socket?.id || 'N/A'); // <<< ADD LOG

    setupAdminSocketListeners(); // Setup listeners AFTER socket defined
    setupAdminButtonListeners(); // Setup listeners for admin buttons
    updateAdminUI(); // Initial UI render
    clearMessage();
    console.log("Admin Client Initialization complete. Waiting for server connection...");
}

// --- Socket Event Listener Setup ---
function setupAdminSocketListeners() {
    socket.on('connect', () => {
        gameState.myId = socket.id; // Store socket ID
        console.log(`Admin: Connected to server with ID: ${gameState.myId}`);
        showMessage(`Admin connected. Authenticating...`, 'info');

        // --- Send authentication event ---
        if (adminPassword) {
             console.log("Admin: Sending authentication request...");
             socket.emit('adminAuthenticate', { password: adminPassword });
        } else {
             console.error("Admin: Password was lost before authentication could be sent.");
              showMessage(`Authentication Error! Refresh.`, 'error');
              socket.disconnect();
        }
        adminPassword = null; // Clear password variable immediately after sending
    });

    socket.on('adminAuthResult', (result) => {
        if (result.success) {
            isAdminAuthenticated = true; console.log("Admin: WebSocket Authentication successful."); showMessage(`Admin Authenticated`, 'success'); if (uiElements.adminControls) { uiElements.adminControls.style.display = 'flex'; } attachServerMessageListener(); // Attach listener AFTER auth success
        } else {
            isAdminAuthenticated = false; console.error("Admin: WebSocket Authentication Failed!", result.reason); showMessage(`Admin Auth Failed: ${result.reason || 'Invalid Password'}`, 'error'); if (uiElements.adminControls) { uiElements.adminControls.style.display = 'none'; } if(socket) socket.disconnect();
        }
    });

    socket.on('disconnect', (reason) => { console.log(`Admin: Disconnected: ${reason}`); showMessage("Disconnected!", "error"); isAdminAuthenticated = false; gameState.myId = null; gameState.initialStateReceived = false; targetInstanceId = null; /* Clear target instance */ if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null; if (uiElements.adminControls) uiElements.adminControls.style.display = 'none'; disposeAllTrees(); });
    socket.on('connect_error', (error) => { console.error('Admin Conn Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler (Spectator View) ---
    socket.on('gameStateUpdate', (serverState) => {
        if (!gameState.myId) { console.log("Admin GS Update: Skipping update, myId not set yet."); return; } // Need own ID first

        // +++ Check if this update is from the correct instance +++
         if (!targetInstanceId) {
             if (serverState.instanceId) {
                 // Check if this instance contains our admin ID
                 if(serverState.players && serverState.players[gameState.myId]){
                      console.log(`Admin GS Update: Received first valid state from Instance ${serverState.instanceId}. Setting as target.`);
                      targetInstanceId = serverState.instanceId;
                 } else {
                      console.warn(`Admin GS Update: Received initial state from Instance ${serverState.instanceId}, but it doesn't contain my ID (${gameState.myId}). Waiting for correct instance state.`);
                      return; // Ignore this update for now.
                 }
             } else {
                  console.warn("Admin GS Update: Received state without instanceId. Cannot determine target. Ignoring update.");
                  return;
             }
         } else if (serverState.instanceId !== targetInstanceId) {
             // console.warn(`Admin GS Update: Ignoring state from wrong instance ${serverState.instanceId} (Target: ${targetInstanceId}).`); // Reduce noise
             return; // Ignore updates from other instances
         }
         // +++ If we reach here, the update is for the correct instance +++

         const previousPhase = gameState.gamePhase;
         const playersFromServer = serverState.players || {};
         const myServerData = playersFromServer[gameState.myId]; // <<< Get my data

         // +++ Log Received Admin State +++
         if (myServerData) {
              console.log(`Admin GS Update (${targetInstanceId}): Received state for self (${gameState.myId}): isSpectator=${myServerData.isSpectator}, isAlive=${myServerData.isAlive}, Name=${myServerData.playerName}`);
         } else {
              // This can happen briefly if the admin disconnects and reconnects before the server removes the old player state
              console.warn(`Admin GS Update (${targetInstanceId}): Did not receive state for self (${gameState.myId}) in this update.`);
         }
         // ++++++++++++++++++++++++++++++++

         // Update core state properties (including gameState.isSpectator)
         Object.assign(gameState, {
             day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex, isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor, isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer, serverTime: serverState.serverTime, players: playersFromServer, allowPlayerCountdownStart: serverState.allowPlayerCountdownStart,
         });
         // *** Force isSpectator based on received data for self, fallback to true if self not found (shouldn't happen after target set) ***
         gameState.isSpectator = myServerData ? myServerData.isSpectator : true;

         if (!gameState.initialStateReceived && myServerData) { // Ensure myServerData exists for first setup
             console.log(`Admin: First valid state for target instance ${targetInstanceId} processed.`);
             if(controls) { controls.target.set(0, 5, 0); camera.position.set(15, 20, 15); controls.update(); } // Set overview camera
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
         // console.log(`--- Admin Tree Update Loop START (Instance: ${targetInstanceId}) ---`); // Reduce noise
         const receivedPlayerIds = new Set(Object.keys(playersFromServer));
         for (const playerId in playersFromServer) {
             const playerData = playersFromServer[playerId];
             // *** Determine spectator status based purely on THIS update's data for robustness ***
             // Use startsWith('ADMIN_') as the primary check for admins
             const isPlayerSpectatorInThisUpdate = playerData.isSpectator || playerData.playerName.startsWith('ADMIN_');
             // console.log(`Admin Tree Update: Processing P:[${playerId.substring(0,5)}] Is Spectator Flag (this update): ${isPlayerSpectatorInThisUpdate}`); // Reduce noise

             if (isPlayerSpectatorInThisUpdate) {
                 // console.log(`Admin Tree Update: Calling removeTree for spectator/admin ${playerId}`); // Reduce noise
                 removeTree(playerId); // Ensure admins/spectators don't have trees
             } else {
                 // console.log(`Admin Tree Update: Calling createOrUpdateTree for non-spectator ${playerId}`); // Reduce noise
                 createOrUpdateTree(playerId, playerData);
             }
         }
         // Remove trees for players who are no longer in the state update
         gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) { removeTree(playerId); } });
         // console.log("--- Admin Tree Update Loop END ---"); // Reduce noise

         /* Update Camera Target */ if (controls) controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); // Keep overview target

         updateAdminUI(); // Update non-tree UI

     }); // End gameStateUpdate

    socket.on('playerDisconnected', (playerId) => { console.log(`Admin View: Player ${playerId} disconnected.`); removeTree(playerId); /* UI updates on next gameStateUpdate */ });
    socket.on('gameOver', (data) => {
         console.log("Admin View: Game Over event received:", data);
         gameState.gameOver = true; gameState.gameOverReason = data.reason || "Game Ended"; gameState.winnerId = data.winnerId;
         showGameOverUI(); // Use the shared function to show/configure the modal
    });
    socket.on('serverMessage', (data) => { console.log("Admin received server message:", data); showMessage(data.text, data.type || 'info'); });

} // End of setupAdminSocketListeners


// --- Setup Listeners for Admin Buttons ---
function setupAdminButtonListeners() {
    console.log("Admin: Setting up button listeners...");
    const forceStartBtn = document.getElementById('admin-force-start');
    const forceEndBtn = document.getElementById('admin-force-end');
    const resetCountdownBtn = document.getElementById('admin-reset-countdown');
    const closeModalBtn = uiElements.adminCloseModalButton; // Use cached element

    if (uiElements.adminControls) uiElements.adminControls.style.display = 'none'; // Start hidden until authenticated

    function emitAdminCommand(command) {
        if (socket && socket.connected && isAdminAuthenticated) {
            console.log(`Admin: Emitting command: ${command}`);
            socket.emit(command);
        } else { console.error(`Admin: Cannot send command '${command}', socket not connected or not authenticated.`); showMessage("Cannot send command: Not authenticated.", "error"); }
    }

    if (forceStartBtn) forceStartBtn.addEventListener('click', () => emitAdminCommand('adminForceStart')); else console.warn("Admin button 'admin-force-start' not found.");
    if (forceEndBtn) forceEndBtn.addEventListener('click', () => emitAdminCommand('adminForceEnd')); else console.warn("Admin button 'admin-force-end' not found.");
    if (resetCountdownBtn) resetCountdownBtn.addEventListener('click', () => emitAdminCommand('adminResetCountdown')); else console.warn("Admin button 'admin-reset-countdown' not found.");

    // Game over modal close button listener is now handled within showGameOverUI
    // if (closeModalBtn) { closeModalBtn.removeEventListener('click', hideGameOverModal); closeModalBtn.addEventListener('click', hideGameOverModal); } else { console.warn("Admin close modal button 'admin-close-modal' not found."); }
}

// --- Admin Rendering Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();
    updateEnvironmentVisuals(deltaTime);
    updateRain(deltaTime);
    updateAdminUI(); // Use the dedicated admin UI updater
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
    else { console.error("Admin Render components missing!"); stopGameLoop(); }
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
// Add conditional check similar to main.js for safety
const adminScriptUrl = new URL('/admin.js', window.location.origin).href;
if (import.meta.url === adminScriptUrl) {
     console.log("admin.js detected as entry point script. Adding DOMContentLoaded listener.");
     document.addEventListener('DOMContentLoaded', initializeAdminApp);
} else {
     console.log(`admin.js imported as dependency (URL: ${import.meta.url}), skipping initializeAdminApp listener.`);
}