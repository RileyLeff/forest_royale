// client/admin.js - Logic for the Admin Panel

import * as THREE from 'three';
// Import necessary modules (paths relative to client/)
import { gameState, getMyPlayerState } from './gameState.js'; // Use gameState for caching server state
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js'; // Reuse scene setup
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js'; // Reuse tree rendering
import { cacheDOMElements, uiElements } from './ui/elements.js'; // Cache admin page UI elements
// import { setupUIListeners } from './ui/setupListeners.js'; // We don't need player control listeners
import { updateUI as updateAdminUI } from './ui/updateAdmin.js'; // Use a SEPARATE admin UI update function
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js'; // Reuse game over modal display
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;
let socket = null;
let adminPassword = null; // Store password retrieved from URL

// --- Initialization Function ---
function initializeAdminApp() {
    console.log("Initializing Admin Panel Client...");

    // --- Get Admin Password from URL ---
    // This is a simple way; more secure methods exist but are complex for this scope.
    const urlParams = new URLSearchParams(window.location.search);
    adminPassword = urlParams.get('pw');
    if (!adminPassword) {
        console.error("Admin Password missing from URL query parameter 'pw'. Cannot authenticate.");
        document.body.innerHTML = '<h1>Access Denied: Admin password missing from URL (?pw=...)</h1>';
        return;
    }
    // Clear URL history potentially? (More advanced)
    // history.replaceState(null, '', window.location.pathname); // Remove query param from view/history

    // --- Basic Setup ---
    gameState.isSpectator = true; // Admin is always a spectator
    cacheDOMElements(); // Cache elements defined in admin.html
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Admin Canvas element #game-canvas not found!"); return; }

    initScene(canvas); // Setup Three.js scene

    // No need to find island mesh for clicking
    // No need to add spawn click listener

    console.log("Admin: Attempting to connect to server...");
    socket = io();
    setupAdminSocketListeners();
    setupAdminButtonListeners(); // Setup listeners for admin buttons
    updateAdminUI(); // Initial UI render
    clearMessage();
    console.log("Admin Client Initialization complete. Waiting for server connection...");
}

// --- Socket Event Listener Setup ---
function setupAdminSocketListeners() {
    socket.on('connect', () => {
        gameState.myId = socket.id; // Store socket ID, though less relevant for admin
        console.log(`Admin: Connected to server with ID: ${gameState.myId}`);
        showMessage(`Admin connected. Authenticating...`, 'info');

        // --- Send authentication event ---
        socket.emit('adminAuthenticate', { password: adminPassword });
        // Clear password variable after sending
        adminPassword = null;
    });

    // Listen for authentication confirmation/rejection
    socket.on('adminAuthResult', (result) => {
        if (result.success) {
            console.log("Admin: Authentication successful.");
            showMessage(`Admin Authenticated`, 'success');
            // Request full state upon successful auth
            // The server might send this automatically, or we can request if needed
        } else {
            console.error("Admin: Authentication Failed!", result.reason);
            showMessage(`Admin Auth Failed: ${result.reason || 'Invalid Password'}`, 'error');
            // Maybe disconnect or disable controls?
            if(socket) socket.disconnect();
        }
    });

    socket.on('disconnect', (reason) => { /* ... disconnect logic ... */
         console.log(`Admin: Disconnected from server: ${reason}`); showMessage("Disconnected!", "error");
         gameState.myId = null; gameState.initialStateReceived = false;
         if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
         disposeAllTrees(); // No markers for admin view
    });
    socket.on('connect_error', (error) => { /* ... */ console.error('Admin Conn Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler (Similar to Spectator) ---
    socket.on('gameStateUpdate', (serverState) => {
         const previousPhase = gameState.gamePhase;
         Object.assign(gameState, { /* ... assign properties ... */ day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex, isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor, isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer, serverTime: serverState.serverTime, players: serverState.players, });
         // Admin is always spectator
         gameState.isSpectator = true;

         if (!gameState.initialStateReceived) { /* ... First time setup ... */
             console.log("Admin: First gameStateUpdate received.");
             if(controls) controls.target.set(0, 5, 0); controls.update(); // General island view for admin
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain();
             gameState.initialStateReceived = true; startGameLoop();
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         } else if (gameState.gamePhase !== previousPhase) { /* ... Phase change update ... */ console.log(`Admin phase updated to: ${gameState.gamePhase}`); showMessage(`Game state: ${gameState.gamePhase}`, 'info'); }

         /* Update Environment */
         const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();

         /* Update Trees */
         const receivedPlayerIds = new Set(Object.keys(serverState.players));
         for (const playerId in serverState.players) { const playerData = serverState.players[playerId]; if (playerData.isSpectator) { removeTree(playerId); continue; } createOrUpdateTree(playerId, playerData); } // Render all non-spectator trees
         gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeTree(playerId); }); // Remove disconnected

         /* Update Camera Target */
         if (controls) controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); // Keep overview

     }); // End gameStateUpdate

    socket.on('playerDisconnected', (playerId) => { console.log(`Admin View: Player ${playerId} disconnected.`); removeTree(playerId); });
    socket.on('gameOver', (data) => { console.log("Admin View: Game Over event received:", data); gameState.gameOver = true; gameState.gameOverReason = data.reason || "Game Ended"; gameState.winnerId = data.winnerId; showGameOverUI(); }); // Use regular gameOver UI for now

} // End of setupSocketListeners


// --- Setup Listeners for Admin Buttons ---
function setupAdminButtonListeners() {
    console.log("Admin: Setting up button listeners...");
    const forceStartBtn = document.getElementById('admin-force-start');
    const forceEndBtn = document.getElementById('admin-force-end');
    const resetCountdownBtn = document.getElementById('admin-reset-countdown');
    const closeModalBtn = document.getElementById('admin-close-modal'); // Button on game over modal

    function emitAdminCommand(command) {
        if (socket && socket.connected) {
            console.log(`Admin: Emitting command: ${command}`);
            socket.emit(command); // Send command to server
        } else {
            console.error("Admin: Cannot send command, socket not connected.");
            showMessage("Not connected to server!", "error");
        }
    }

    if (forceStartBtn) forceStartBtn.addEventListener('click', () => emitAdminCommand('adminForceStart'));
    if (forceEndBtn) forceEndBtn.addEventListener('click', () => emitAdminCommand('adminForceEnd'));
    if (resetCountdownBtn) resetCountdownBtn.addEventListener('click', () => emitAdminCommand('adminResetCountdown'));

    // Listener for the custom close button on the admin game over modal
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', hideGameOverModal);
    } else {
         console.warn("Admin close modal button not found.");
    }
}

// --- Admin Rendering Loop ---
// Replicates the necessary parts of main.js game loop
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();
    updateEnvironmentVisuals(deltaTime); // Update sky, fog, lighting
    updateRain(deltaTime); // Update rain effect
    updateAdminUI(); // Use the specific admin UI update function
    if (controls) controls.update(); // Update camera controls
    if (renderer && scene && camera) renderer.render(scene, camera); // Render scene
    else { console.error("Admin Render components missing!"); stopGameLoop(); }
}
function startGameLoop() { if (animationFrameId !== null) return; console.log("Admin: Starting render loop."); clock = new THREE.Clock(); gameLoop(); }
function stopGameLoop() { if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Admin: Stopped render loop."); } }

// --- Start Admin Application ---
document.addEventListener('DOMContentLoaded', initializeAdminApp);

// No need to export socket usually for admin page