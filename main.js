import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Import tree functions needed
import { createPlayerTree, disposeTreeMaterials } from './tree.js';
// Import UI modules
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { hideGameOverModal } from './ui/gameOver.js';
// Import simulation and environment updates
import { updateSimulation } from './simulation.js';
// Import both environment update functions
import { updateEnvironmentVisuals, updateRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Game...");
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }
    initScene(canvas); // Creates scene, lights, fog, calls createStars/createRainSystem
    initializeGameState(); // Creates gameState object
    createPlayerTree(); // Creates tree meshes and does initial visual setup

    // Set initial camera target
    if (controls) {
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update();
    } else { console.warn("OrbitControls not available to set target."); }

    // Setup UI and start game loop
    setupUIListeners();
    updateUI(); // Initial UI state display
    clearMessage(); // Clear any initial messages
    startGameLoop();
    console.log("Game Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
function gameLoop() {
    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
    // Get time difference since last frame
    const deltaTime = clock.getDelta();

    // --- Core Loop Logic - Order Matters! ---

    // 1. Update Simulation: Calculates game state changes based on deltaTime.
    //    Determines target weather/visual states and calls environment.setWeatherTargets if transitions occur.
    updateSimulation(deltaTime);

    // 2. Update Environment Visuals: Lerps current visuals (lights, fog, sky) towards targets set by simulation.
    updateEnvironmentVisuals(deltaTime);

    // 3. Update Rain Animation: Moves rain particles based on deltaTime if rain is active.
    updateRain(deltaTime);

    // 4. Update UI: Reads the latest gameState and updates the HTML display elements.
    if (!gameState.gameOver) {
        updateUI();
    }

    // 5. Update Camera Controls: Applies damping, inertia etc. to camera movement.
    if (controls) {
        controls.update();
    }

    // 6. Render Scene: Draws the updated scene to the canvas.
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        // Stop loop if critical components are missing
        console.error("Render components missing in game loop!");
        if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    }
}

// Helper to start/restart the game loop
function startGameLoop() {
    // Ensure previous loop is stopped
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null; // Clear ID
    }
    // Reset the clock for accurate deltaTime on first frame of new loop
    clock = new THREE.Clock();
    // Start the loop
    gameLoop();
    console.log("MAIN: Game loop started/restarted.");
}

// --- Exported Restart Handler ---
export function handleRestart() {
    console.log("MAIN: Handling Restart Request...");
    hideGameOverModal(); // Hide UI modal

    // Cleanup old tree resources
    if (gameState.treeMeshGroup) {
         if(scene) {
             scene.remove(gameState.treeMeshGroup); // Remove from scene graph
        } else {
            console.warn("MAIN: Scene not found during tree cleanup.");
        }
         // Dispose materials (geometries disposed within createPlayerTree now)
         disposeTreeMaterials();
         gameState.treeMeshGroup = null; // Clear reference in state
    } else {
        console.log("MAIN: No old tree mesh group found to remove.");
        disposeTreeMaterials(); // Still ensure materials are cleared
    }

    // Reset game state logic
    initializeGameState(); // Re-initializes state vars
    console.log("MAIN: Game state initialized.");

    // Recreate Tree
    createPlayerTree(); // Creates new meshes, does initial visual setup
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
    clearMessage();

    // Note: Environment visuals will transition smoothly from whatever state they were in.
    // If an instant reset is desired, we could add an instant update call here.

    // Ensure simulation loop is running
    startGameLoop(); // Restart the loop
    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);