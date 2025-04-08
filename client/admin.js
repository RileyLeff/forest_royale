// client/admin.js - Logic for the Admin Panel

import * as THREE from 'three';
// Import necessary modules (paths relative to client/)
import { gameState, getMyPlayerState } from './gameState.js'; // Use gameState for caching server state
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js'; // Reuse scene setup
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js'; // Reuse tree rendering
import { cacheDOMElements, uiElements } from './ui/elements.js'; // Cache admin page UI elements
// Import the SPECIFIC Admin UI update function
import { updateUI as updateAdminUI } from './ui/updateAdmin.js'; // Use a SEPARATE admin UI update function
import { showMessage, clearMessage, attachServerMessageListener } from './ui/messageHandler.js'; // Use message handler
// Don't reuse gameOver UI directly, use admin modal buttons
import { hideGameOverModal } from './ui/gameOver.js';
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
    cacheDOMElements(); // Cache elements defined in admin.html
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Admin Canvas element #game-canvas not found!"); return; }

    initScene(canvas); // Setup Three.js scene
    // No need for island mesh ref or spawn click listener for admin

    console.log("Admin: Attempting to connect to server...");
    socket = io(); // Define socket
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
            // Request full state upon successful auth? Server should send it anyway.
             if (uiElements.adminControls) { // Show controls on successful auth
                 uiElements.adminControls.style.display = 'flex';
             }
             // Attach server message listener now that socket is ready
             attachServerMessageListener();

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

    socket.on('disconnect', (reason) => { /* ... disconnect logic ... */
         console.log(`Admin: Disconnected: ${reason}`); showMessage("Disconnected!", "error");
         isAdminAuthenticated = false; gameState.myId = null; gameState.initialStateReceived = false;
         if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
         if (uiElements.adminControls) uiElements.adminControls.style.display = 'none'; // Hide controls
         disposeAllTrees();
    });
    socket.on('connect_error', (error) => { /* ... */ console.error('Admin Conn Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler (Spectator View) ---
    socket.on('gameStateUpdate', (serverState) => {
         const previousPhase = gameState.gamePhase;
         Object.assign(gameState, { /* ... assign properties ... */ day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex, isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor, isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer, serverTime: serverState.serverTime, players: serverState.players, });
         gameState.isSpectator = true; // Ensure always spectator

         if (!gameState.initialStateReceived) { /* ... First time setup ... */
             console.log("Admin: First gameStateUpdate received.");
             if(controls) controls.target.set(0, 5, 0); controls.update(); // General island view
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain();
             gameState.initialStateReceived = true; startGameLoop();
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         } else if (gameState.gamePhase !== previousPhase) { /* ... Phase change update ... */ console.log(`Admin phase updated to: ${gameState.gamePhase}`); showMessage(`Game state: ${gameState.gamePhase}`, 'info'); }

         /* Update Environment */ const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();
         /* Update Trees */ const receivedPlayerIds = new Set(Object.keys(serverState.players)); for (const playerId in serverState.players) { const playerData = serverState.players[playerId]; if (playerData.isSpectator) { removeTree(playerId); continue; } createOrUpdateTree(playerId, playerData); } gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeTree(playerId); });
         /* Update Camera Target */ if (controls) controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); // Keep overview

     }); // End gameStateUpdate

    socket.on('playerDisconnected', (playerId) => { console.log(`Admin View: Player ${playerId} disconnected.`); removeTree(playerId); });
    // Use simplified game over display for admin
    socket.on('gameOver', (data) => {
         console.log("Admin View: Game Over event received:", data);
         gameState.gameOver = true; gameState.gameOverReason = data.reason || "Game Ended"; gameState.winnerId = data.winnerId;
         // Show modal, but maybe don't stop loop?
         if (uiElements.gameOverModal) {
            if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.textContent = `Game Ended: ${gameState.gameOverReason}`;
            // Hide player-specific day/seed count on admin modal
            if(uiElements.finalDayUI) uiElements.finalDayUI.parentElement.style.display = 'none';
            if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.parentElement.style.display = 'none';
            // Hide regular restart button if it exists, show only admin close
            if(uiElements.restartButton) uiElements.restartButton.style.display = 'none';
            if(document.getElementById('admin-close-modal')) document.getElementById('admin-close-modal').style.display = 'inline-block';

            uiElements.gameOverModal.classList.remove('hidden');
         }
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
    const closeModalBtn = document.getElementById('admin-close-modal');

    // Ensure controls panel starts hidden until authenticated
     if (uiElements.adminControls) uiElements.adminControls.style.display = 'none';

    function emitAdminCommand(command) {
        // Only allow commands if WS connection is authenticated
        if (socket && socket.connected && isAdminAuthenticated) {
            console.log(`Admin: Emitting command: ${command}`);
            socket.emit(command); // Send command to server
        } else {
            console.error(`Admin: Cannot send command '${command}', socket not connected or not authenticated.`);
            showMessage("Cannot send command: Not authenticated.", "error");
        }
    }

    if (forceStartBtn) forceStartBtn.addEventListener('click', () => emitAdminCommand('adminForceStart'));
    else console.warn("Admin button 'admin-force-start' not found.");

    if (forceEndBtn) forceEndBtn.addEventListener('click', () => emitAdminCommand('adminForceEnd'));
    else console.warn("Admin button 'admin-force-end' not found.");

    if (resetCountdownBtn) resetCountdownBtn.addEventListener('click', () => emitAdminCommand('adminResetCountdown'));
    else console.warn("Admin button 'admin-reset-countdown' not found.");

    if (closeModalBtn) {
         closeModalBtn.addEventListener('click', hideGameOverModal);
         // Ensure it starts hidden in case game over modal is reused but button is admin-specific
         closeModalBtn.style.display = 'inline-block';
    } else {
         console.warn("Admin close modal button 'admin-close-modal' not found.");
    }
}

// --- Admin Rendering Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop); const deltaTime = clock.getDelta();
    updateEnvironmentVisuals(deltaTime); updateRain(deltaTime); updateAdminUI();
    if (controls) controls.update(); if (renderer && scene && camera) renderer.render(scene, camera);
    else { console.error("Admin Render components missing!"); stopGameLoop(); }
}
function startGameLoop() { if (animationFrameId !== null) return; console.log("Admin: Starting render loop."); clock = new THREE.Clock(); gameLoop(); }
function stopGameLoop() { if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Admin: Stopped render loop."); } }

// --- Start Admin Application ---
document.addEventListener('DOMContentLoaded', initializeAdminApp);

// No exports needed for admin bundle