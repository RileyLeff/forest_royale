import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js'; // Import config if needed directly
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Import necessary tree functions for initialization and restart
import { createPlayerTree, calculateDimensions, disposeTreeMaterials } from './tree.js';
// Import necessary UI functions
import { cacheDOMElements, setupUIListeners, updateUI, clearMessage, hideAllocationSection } from './ui.js';
import { updateSimulation } from './simulation.js';
// Import scene explicitly for cleanup in restart (if not already imported via sceneSetup exports)
// import { scene } from './sceneSetup.js'; // Already imported via named exports

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null; // To potentially stop/restart the loop

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim...");

    // Set up DOM element references first
    cacheDOMElements();

    // Set up Three.js scene, camera, renderer, controls, environment
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element #game-canvas not found!");
        return;
    }
    initScene(canvas);

    // Initialize game state object (resets values)
    initializeGameState();

    // Calculate initial dimensions based on the freshly initialized state
    calculateDimensions(gameState);

    // Create the initial player tree visuals using the state
    createPlayerTree(gameState);

    // Reset camera target *after* tree exists and has dimensions
     if (controls) {
        // Use default height from Config if gameState hasn't updated yet
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update(); // Apply immediately
     } else {
         console.warn("OrbitControls not available to set target.");
     }

    // Set up UI event listeners
    setupUIListeners();

    // Perform initial UI update based on default state
    updateUI();
    clearMessage(); // Start with no message

    // Start the main game loop
    startGameLoop();

    console.log("Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
function gameLoop() {
    // Request the next frame
    animationFrameId = requestAnimationFrame(gameLoop);

    // Get time delta for simulation updates
    const deltaTime = clock.getDelta();

    // Log current state *before* updateSimulation (Optional, can be noisy)
    // console.log(`MAIN: Loop - Day ${gameState.day}, ${gameState.timeOfDay}, Paused:${gameState.isPaused}, Over:${gameState.gameOver}, TimeInCycle:${gameState.timeInCycle.toFixed(1)}`);


    // --- Core Loop Logic ---
    // 1. Update Simulation (handles game logic, physics, time progression)
    //    It internally checks if paused or game over.
    updateSimulation(deltaTime);

    // 2. Update UI (reflects changes in state onto the screen)
    //    Only update if the game isn't over.
    if (!gameState.gameOver) {
        updateUI();
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
function startGameLoop() {
    // Make sure any previous loop is stopped before starting a new one
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    clock = new THREE.Clock(); // Reset clock for accurate delta time
    gameLoop(); // Start the loop
}


// --- Exported Restart Handler ---
// This function is called by the button listener in ui.js
export function handleRestart() {
    console.log("MAIN: Handling Restart Request..."); // Log in main

    // Stop potentially running timers etc. (e.g., allocation timer)
    hideAllocationSection(); // Calls clearAllocationTimer internally

    // Clean up old Three.js resources
    if (gameState.treeMeshGroup) {
         // Check if scene exists before removing from it
         if(scene) {
             scene.remove(gameState.treeMeshGroup);
             console.log("MAIN: Old tree mesh removed from scene."); // Log cleanup
         } else {
             console.warn("MAIN: Scene not found during tree cleanup.");
         }
         disposeTreeMaterials(); // Dispose materials associated with tree.js
         gameState.treeMeshGroup = null; // Clear reference in state
    } else {
        console.log("MAIN: No old tree mesh group found to remove."); // Log if no tree
        // If no tree group exists, still ensure materials are cleared
        disposeTreeMaterials();
    }


    // Reset game state logic using the function from gameState.js
    initializeGameState();
    console.log("MAIN: Game state initialized."); // Log state reset

    // Calculate dimensions for the newly reset state
    calculateDimensions(gameState);
    console.log("MAIN: Dimensions calculated."); // Log calculation

    // Create new tree visuals based on the reset state
    createPlayerTree(gameState);
    console.log("MAIN: New player tree created."); // Log tree creation

    // Reset camera target to the new tree
    if (controls) {
        // Ensure trunkHeight is valid before setting target
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update(); // Apply target change immediately
        console.log("MAIN: Camera target reset."); // Log camera reset
    }

    // Reset UI display elements to reflect initial state
    updateUI();
    clearMessage(); // Clear any game over message

    // Ensure simulation is unpaused and game over is false (should be handled by initializeGameState)
    // gameState.isPaused = false;
    // gameState.gameOver = false;

    // Ensure the loop is running (it should be, but doesn't hurt to ensure)
    // startGameLoop(); // Loop should still be running, just controlled by isPaused/gameOver flags

    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
// Use DOMContentLoaded to ensure HTML is ready before grabbing elements and starting Three.js
document.addEventListener('DOMContentLoaded', initializeApp);