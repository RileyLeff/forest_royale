import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js'; // Import config if needed directly
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Import necessary tree functions for initialization and restart
import { createPlayerTree, calculateDimensions, disposeTreeMaterials } from './tree.js';

// ++ Import functions from specific UI modules ++
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage } from './ui/messageHandler.js'; // Import message handlers
import { hideGameOverModal } from './ui/gameOver.js'; // Needed for restart

// Import simulation logic
import { updateSimulation } from './simulation.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null; // To potentially stop/restart the loop

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Game...");

    // Set up DOM element references first (from ui/elements.js)
    cacheDOMElements();

    // Set up Three.js scene, camera, renderer, controls, environment
    const canvas = document.getElementById('game-canvas'); // Still need canvas ref here
    if (!canvas) {
        console.error("Canvas element #game-canvas not found!");
        return;
    }
    initScene(canvas);

    // Initialize game state (loads settings)
    initializeGameState();

    // Calculate initial dimensions based on the freshly initialized state
    calculateDimensions(); // Reads gameState directly now

    // Create the initial player tree visuals using the state
    createPlayerTree(); // Reads gameState directly now

    // Reset camera target *after* tree exists and has dimensions
     if (controls) {
        // Use default height from Config if gameState hasn't updated yet
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update(); // Apply immediately
     } else {
         console.warn("OrbitControls not available to set target.");
     }

    // Set up UI event listeners (from ui/setupListeners.js)
    setupUIListeners();

    // Perform initial UI update (from ui/update.js)
    updateUI();
    // Clear message log (from ui/messageHandler.js)
    clearMessage();

    // Start the main game loop
    startGameLoop();

    console.log("Game Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
// ++ Ensure this function is fully defined ++
function gameLoop() {
    // Request the next frame
    animationFrameId = requestAnimationFrame(gameLoop);

    // Get time delta for simulation updates
    const deltaTime = clock.getDelta();

    // Log current state *before* updateSimulation (Optional, can be noisy)
    // console.log(`MAIN: Loop - Day ${gameState.day}, ${gameState.timeOfDay}, GameOver:${gameState.gameOver}, TimeInCycle:${gameState.timeInCycle.toFixed(1)}`);


    // --- Core Loop Logic ---
    // 1. Update Simulation (handles game logic, physics, time progression, periodic allocation)
    //    It internally checks if game over.
    updateSimulation(deltaTime);

    // 2. Update UI (reflects changes in state onto the screen)
    //    Only update if the game isn't over.
    if (!gameState.gameOver) {
        updateUI(); // From ui/update.js
    }

    // 3. Update Camera Controls (allows damping etc. to work)
    if (controls) {
        controls.update();
    }

    // 4. Render Scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        // Critical components missing, stop the loop to prevent errors
        console.error("Render components missing in game loop!");
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
}

// Helper to start/restart the game loop
// ++ Ensure this function is fully defined ++
function startGameLoop() {
    // Make sure any previous loop is stopped before starting a new one
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    clock = new THREE.Clock(); // Reset clock for accurate delta time
    gameLoop(); // Start the loop
    console.log("MAIN: Game loop started/restarted."); // Add log
}


// --- Exported Restart Handler ---
// This function is called by the button listener in ui/setupListeners.js
export function handleRestart() {
    console.log("MAIN: Handling Restart Request...");

    // Hide the Game Over modal (from ui/gameOver.js)
    hideGameOverModal();

    // Clean up old Three.js resources
    if (gameState.treeMeshGroup) {
         if(scene) scene.remove(gameState.treeMeshGroup);
         else console.warn("MAIN: Scene not found during tree cleanup.");
         disposeTreeMaterials();
         gameState.treeMeshGroup = null;
    } else {
        console.log("MAIN: No old tree mesh group found to remove.");
        disposeTreeMaterials();
    }

    // Reset game state logic
    initializeGameState();
    console.log("MAIN: Game state initialized.");

    // Calculate dimensions
    calculateDimensions(); // Reads gameState directly
    console.log("MAIN: Dimensions calculated.");

    // Create new tree visuals
    createPlayerTree(); // Reads gameState directly
    console.log("MAIN: New player tree created.");

    // Reset camera target
    if (controls) {
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update();
        console.log("MAIN: Camera target reset.");
    }

    // Reset UI display elements
    updateUI();
    // Clear message log
    clearMessage();

    // Ensure simulation loop is running and flags are correct
    startGameLoop(); // Ensure loop is running after reset

    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
// This script (main.js) is loaded by game.html
document.addEventListener('DOMContentLoaded', initializeApp);