// main.js

import * as THREE from 'three';
// Import SPECIFIC functions/objects from gameState
import { gameState, loadClientSettings, getMyPlayerState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Import NEW tree functions
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js';
// Import UI modules
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js'; // Import showGameOverUI
// Import simulation (we won't call it, but keep import for now if needed elsewhere)
// import { updateSimulation } from './simulation.js';
// Import environment update functions (will use server state)
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;
let socket = null; // Holds the socket connection

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Client...");
    loadClientSettings(); // Load player name/color prefs (placeholder)
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }

    // Scene setup is independent of game state initially
    initScene(canvas);

    // --- Connect to Server ---
    console.log("Attempting to connect to server...");
    socket = io(); // Connect

    // --- Socket Event Listeners ---
    setupSocketListeners(); // Moved listeners to separate function

    // UI Listeners are setup, but will need modification later
    setupUIListeners();

    // Initial UI state (will be quickly overridden by server)
    updateUI();
    clearMessage();

    // Don't create local tree or start game loop until connected and state received
    // createPlayerTree(); // REMOVED - Tree creation driven by server state
    // startGameLoop(); // REMOVED - Started after first state received

    console.log("Client Initialization complete. Waiting for server connection...");
}

// --- Socket Event Listener Setup ---
function setupSocketListeners() {
    socket.on('connect', () => {
        gameState.myId = socket.id; // Store our own ID
        console.log(`Connected to server with ID: ${gameState.myId}`);
        showMessage(`Connected! Waiting for game state...`, 'info');
        // We could send client settings (name, color) here if needed
        // socket.emit('clientSettings', { name: gameState.playerName, leafColor: gameState.leafColor, ... });
    });

    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from server: ${reason}`);
        showMessage("Disconnected from server!", "error");
        gameState.myId = null;
        gameState.initialStateReceived = false; // Reset flag
        // Stop game loop if running
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("Animation loop stopped due to disconnection.");
        }
        // Cleanup visual elements
        disposeAllTrees();
        // Could show a "Disconnected" overlay here
    });

    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        showMessage("Connection failed!", "error");
    });

    // --- Game State Update Handler ---
    socket.on('gameStateUpdate', (serverState) => {
        // console.log("Received gameStateUpdate:", serverState); // DEBUG - Can be very noisy

        // --- Update Local Game State Cache ---
        gameState.day = serverState.day;
        gameState.timeInCycle = serverState.timeInCycle;
        gameState.currentPeriodIndex = serverState.currentPeriodIndex;
        gameState.isNight = serverState.isNight;
        gameState.currentLightMultiplier = serverState.currentLightMultiplier;
        gameState.currentDroughtFactor = serverState.currentDroughtFactor;
        gameState.isRaining = serverState.isRaining;
        gameState.gamePhase = serverState.gamePhase;
        gameState.serverTime = serverState.serverTime;
        // Store player data - overwrite existing players, add new ones
        gameState.players = serverState.players;

        // --- First Time Setup ---
        if (!gameState.initialStateReceived) {
            console.log("First gameStateUpdate received. Setting up initial scene.");
            // Set initial camera target based on *our* player's initial state
            const myInitialState = getMyPlayerState();
            if (myInitialState && controls) {
                const initialHeight = myInitialState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT;
                controls.target.set(0, initialHeight / 2, 0); // Default target for now
                // TODO: Target player's actual spawn position once available
                controls.update();
            } else if (!myInitialState) {
                 console.warn("My player state not found in first update!");
            }
             // Set initial weather without transition
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000); // Force instant update
             if(gameState.isRaining) startRain(); else stopRain(); // Set initial rain state


            gameState.initialStateReceived = true;
            startGameLoop(); // Start the rendering loop NOW
            showMessage(`Game state received. Phase: ${gameState.gamePhase}`, 'info');
        }

        // --- Update Environment Targets (for smooth transitions) ---
        // We might need to track previous rain state to only call start/stop on change
        const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; // Check current rain visibility
        setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
        if (gameState.isRaining && !wasRaining) {
             startRain();
        } else if (!gameState.isRaining && wasRaining) {
             stopRain();
        }


        // --- Update/Create Player Trees ---
        const receivedPlayerIds = new Set(Object.keys(serverState.players));
        // Update existing / create new
        for (const playerId in serverState.players) {
            createOrUpdateTree(playerId, serverState.players[playerId]);
        }
        // Remove trees for players that are no longer in the server state
        gameState.playerTrees.forEach((treeGroup, playerId) => {
            if (!receivedPlayerIds.has(playerId)) {
                removeTree(playerId);
            }
        });

        // --- Update Camera Target (Example: Target own tree if exists) ---
        const myState = getMyPlayerState();
        if (myState && myState.isAlive && controls && gameState.playerTrees.has(gameState.myId)) {
             const myTreeGroup = gameState.playerTrees.get(gameState.myId);
             // Simple target: center of tree base + half height
             controls.target.lerp(new THREE.Vector3(myTreeGroup.position.x, myState.trunkHeight / 2 + myTreeGroup.position.y, myTreeGroup.position.z), 0.1);
        }

    }); // End of gameStateUpdate handler

     // --- Player Disconnected Handler ---
     socket.on('playerDisconnected', (playerId) => {
         console.log(`Player ${playerId} disconnected.`);
         removeTree(playerId); // Remove visual representation
         // No need to delete from gameState.players, next gameStateUpdate won't include them
     });

     // --- Game Over Handler ---
     socket.on('gameOver', (data) => {
         console.log("Game Over event received:", data);
         gameState.gameOver = true;
         gameState.gameOverReason = data.reason || "The game has ended!";
         gameState.winnerId = data.winnerId; // Store winner ID
         stopGameLoop(); // Stop rendering loop? Or let it run for game over screen? TBD
         showGameOverUI(); // Update UI to show modal
         // Make all trees non-interactive / visually distinct?
         // Set canopy visibility is handled by createOrUpdateTree based on isAlive
     });

} // End of setupSocketListeners


// --- Main Game Loop (Now primarily for Rendering & Client-Side Effects) ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();

    // 1. Simulation is handled by SERVER

    // 2. Update Environment Visuals (Lerping towards targets set by gameStateUpdate)
    updateEnvironmentVisuals(deltaTime);

    // 3. Update Rain Animation
    updateRain(deltaTime);

    // 4. Update UI (Reads from local gameState cache, updated by server)
    if (!gameState.gameOver) { // Check local game over flag
        updateUI();
    }

    // 5. Update Camera Controls
    if (controls) {
        controls.update();
    }

    // 6. Render Scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error("Render components missing in game loop!");
        stopGameLoop();
    }
}

// Helper to start/restart the game loop
function startGameLoop() {
    if (animationFrameId !== null) { // Already running
         console.log("MAIN: Game loop already running.");
        return;
    }
    console.log("MAIN: Starting client render loop.");
    clock = new THREE.Clock(); // Reset clock
    gameLoop();
}

// Helper to stop the game loop
function stopGameLoop() {
     if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("MAIN: Stopped client render loop.");
    }
}

// --- Exported Restart Handler (Needs full rethink for multiplayer) ---
export function handleRestart() {
    console.warn("MAIN: handleRestart() called - Needs full rework for multiplayer!");
    // Simplest 'restart' is reload, takes player back to landing page
    window.location.href = '/'; // Navigate to root
}


// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);

// --- Export socket for UI handlers ---
export { socket };