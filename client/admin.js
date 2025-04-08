// client/admin.js - Logic for the Admin Panel

import * as THREE from 'three';
// Import necessary modules (paths relative to client/)
import { gameState } from './gameState.js'; // Use gameState for caching server state
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js'; // Reuse scene setup
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js'; // Reuse tree rendering
import { uiElements, cacheDOMElements } from './ui/elements.js'; // Cache admin page UI elements & uiElements ref
import { updateUI as updateAdminUI } from './ui/updateAdmin.js'; // Use a SEPARATE admin UI update function
import { showMessage, clearMessage, attachServerMessageListener } from './ui/messageHandler.js'; // Use message handler
import { hideGameOverModal } from './ui/gameOver.js'; // Import hide function
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;
let socket = null;
let adminPassword = null; // Store password retrieved from URL
let isAdminAuthenticated = false; // Track websocket auth status

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
    // Attempt to remove password from URL bar history for basic security
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
    socket = io({
         reconnection: true,
         reconnectionAttempts: 3, // Less aggressive for admin?
         reconnectionDelay: 2000,
    }); // Define socket
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
        // Clear password variable immediately after sending
        adminPassword = null;
    });

    // Listen for authentication confirmation/rejection
    socket.on('adminAuthResult', (result) => {
        if (result.success) {
            isAdminAuthenticated = true;
            console.log("Admin: WebSocket Authentication successful.");
            showMessage(`Admin Authenticated`, 'success');
             if (uiElements.adminControls) { // Show controls on successful auth
                 uiElements.adminControls.style.display = 'flex';
             } else {
                  console.warn("Admin controls panel not found after auth success.");
             }
             // Attach server message listener now that socket is ready
             attachServerMessageListener(); // Call the exported function

        } else {
            isAdminAuthenticated = false;
            console.error("Admin: WebSocket Authentication Failed!", result.reason);
            showMessage(`Admin Auth Failed: ${result.reason || 'Invalid Password'}`, 'error');
             if (uiElements.adminControls) { // Hide controls on failed auth
                 uiElements.adminControls.style.display = 'none';
             }
            // Disconnect on failed auth
            if(socket) socket.disconnect();
        }
    });

    socket.on('disconnect', (reason) => {
         console.log(`Admin: Disconnected: ${reason}`); showMessage("Disconnected!", "error");
         isAdminAuthenticated = false; gameState.myId = null; gameState.initialStateReceived = false;
         if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
         if (uiElements.adminControls) uiElements.adminControls.style.display = 'none'; // Hide controls
         disposeAllTrees();
    });
    socket.on('connect_error', (error) => { console.error('Admin Conn Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler (Spectator View) ---
    socket.on('gameStateUpdate', (serverState) => {
         const previousPhase = gameState.gamePhase;
         const playersFromServer = serverState.players || {}; // Ensure players object exists
         const myServerData = playersFromServer[gameState.myId]; // Get data for this admin client

         // +++ Log Received Spectator Status +++
         console.log(`Admin GS Update: Received state. My server data:`, myServerData);
         if (myServerData) {
             console.log(`Admin GS Update: My isSpectator status from server = ${myServerData.isSpectator}`);
         } else if (gameState.myId) {
              console.warn(`Admin GS Update: Did not find own ID (${gameState.myId}) in received players object.`);
         }

         // Update core state properties
         Object.assign(gameState, {
             day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex,
             isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor,
             isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer,
             serverTime: serverState.serverTime,
             players: playersFromServer, // Update player cache
             allowPlayerCountdownStart: serverState.allowPlayerCountdownStart,
         });

         // +++ Force local spectator status based on received data or default to true +++
         // Ensure admin client always considers itself a spectator locally
         gameState.isSpectator = true; // Keep this definitively true for admin client
         console.log(`Admin GS Update: Local gameState.isSpectator forced to = ${gameState.isSpectator}`);
         // We still log the server status above for debugging, but the admin client UI/logic should rely on its forced spectator status.

         // --- First time setup ---
         if (!gameState.initialStateReceived && gameState.myId /*&& myServerData - Don't require server data for first admin setup*/) {
             console.log("Admin: First gameStateUpdate processed (or initial connection established).");
             if(controls) { controls.target.set(0, 5, 0); controls.update(); } // General island view
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain();
             gameState.initialStateReceived = true; startGameLoop();
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         }
         // --- Phase change updates ---
         else if (gameState.gamePhase !== previousPhase) {
             console.log(`Admin phase updated to: ${gameState.gamePhase}`);
             showMessage(`Game state: ${gameState.gamePhase}`, 'info');
             if(gameState.gamePhase !== 'ended' && uiElements.gameOverModal && !uiElements.gameOverModal.classList.contains('hidden')) { hideGameOverModal(); }
         }

         /* Update Environment */ const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();

         /* Update Trees */
         const receivedPlayerIds = new Set(Object.keys(playersFromServer));
         for (const playerId in playersFromServer) {
             const playerData = playersFromServer[playerId];
             // *** Use the player's spectator flag from the received data ***
             if (playerData.isSpectator) {
                 removeTree(playerId); // Remove tree for ANY spectator
             } else {
                 createOrUpdateTree(playerId, playerData); // Render non-spectators
             }
         }
         // Remove trees for players no longer in the state
         gameState.playerTrees.forEach((_, playerId) => {
             if (!receivedPlayerIds.has(playerId)) removeTree(playerId);
         });

         /* Update Camera Target */ if (controls) controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); // Keep overview

     }); // End gameStateUpdate

    socket.on('playerDisconnected', (playerId) => { console.log(`Admin View: Player ${playerId} disconnected.`); removeTree(playerId); });

    // Use simplified game over display for admin
    socket.on('gameOver', (data) => {
         console.log("Admin View: Game Over event received:", data);
         gameState.gameOver = true; // Set local flag
         gameState.gameOverReason = data.reason || "Game Ended";
         gameState.winnerId = data.winnerId;

         // Show modal, but maybe don't stop loop?
         if (uiElements.gameOverModal && uiElements.adminCloseModalButton) { // Check modal and button exist
            if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.textContent = `Game Ended: ${gameState.gameOverReason}`;
            if(uiElements.finalDayUI && uiElements.finalDayUI.parentElement) uiElements.finalDayUI.parentElement.style.display = 'none';
            if(uiElements.finalSeedsUI && uiElements.finalSeedsUI.parentElement) uiElements.finalSeedsUI.parentElement.style.display = 'none';
            if(uiElements.restartButton) uiElements.restartButton.style.display = 'none';
            uiElements.adminCloseModalButton.style.display = 'inline-block'; // Ensure admin close is visible
            uiElements.gameOverModal.classList.remove('hidden');
         } else { console.warn("Cannot show admin game over modal - elements missing."); }
    });

     // Listen for server messages (e.g., admin command confirmations)
     socket.on('serverMessage', (data) => {
         console.log("Admin received server message:", data);
         showMessage(data.text, data.type || 'info');
     });

} // End of setupSocketListeners


// --- Setup Listeners for Admin Buttons ---
function setupAdminButtonListeners() {
    console.log("Admin: Setting up button listeners...");
    const forceStartBtn = document.getElementById('admin-force-start');
    const forceEndBtn = document.getElementById('admin-force-end');
    const resetCountdownBtn = document.getElementById('admin-reset-countdown');
    const closeModalBtn = uiElements.adminCloseModalButton; // Use cached element

    if (uiElements.adminControls) uiElements.adminControls.style.display = 'none';

    function emitAdminCommand(command) {
        if (socket && socket.connected && isAdminAuthenticated) {
            console.log(`Admin: Emitting command: ${command}`);
            socket.emit(command);
        } else { console.error(`Admin: Cannot send command '${command}', socket not connected or not authenticated.`); showMessage("Cannot send command: Not authenticated.", "error"); }
    }

    if (forceStartBtn) forceStartBtn.addEventListener('click', () => emitAdminCommand('adminForceStart')); else console.warn("Admin button 'admin-force-start' not found.");
    if (forceEndBtn) forceEndBtn.addEventListener('click', () => emitAdminCommand('adminForceEnd')); else console.warn("Admin button 'admin-force-end' not found.");
    if (resetCountdownBtn) resetCountdownBtn.addEventListener('click', () => emitAdminCommand('adminResetCountdown')); else console.warn("Admin button 'admin-reset-countdown' not found.");
    if (closeModalBtn) { closeModalBtn.removeEventListener('click', hideGameOverModal); closeModalBtn.addEventListener('click', hideGameOverModal); } else { console.warn("Admin close modal button 'admin-close-modal' not found."); }
}

// --- Admin Rendering Loop ---
function gameLoop() { animationFrameId = requestAnimationFrame(gameLoop); const deltaTime = clock.getDelta(); updateEnvironmentVisuals(deltaTime); updateRain(deltaTime); updateAdminUI(); if (controls) controls.update(); if (renderer && scene && camera) renderer.render(scene, camera); else { console.error("Admin Render components missing!"); stopGameLoop(); } }
function startGameLoop() { if (animationFrameId !== null) return; console.log("Admin: Starting render loop."); clock = new THREE.Clock(); gameLoop(); }
function stopGameLoop() { if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Admin: Stopped render loop."); } }

// --- Start Admin Application ---
document.addEventListener('DOMContentLoaded', initializeAdminApp);