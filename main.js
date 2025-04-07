import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createPlayerTree, calculateDimensions, disposeTreeMaterials, updateTreeGeometry, updateCanopyTiles } from './tree.js';
// Import UI modules
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { hideGameOverModal } from './ui/gameOver.js';
// Import simulation and environment updates
import { updateSimulation } from './simulation.js';
import { updateEnvironmentVisuals } from './environment.js'; // Import environment lerp function

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Game...");
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }
    initScene(canvas); // Creates scene, lights, fog, stars etc.
    initializeGameState(); // Creates gameState object
    createPlayerTree(); // Creates tree meshes

    if (controls) {
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update();
    } else { console.warn("OrbitControls not available to set target."); }

    setupUIListeners();
    updateUI(); // Initial UI state
    // Set initial weather targets based on initial state (usually Day 1, Period 0)
    // Simulation loop will handle subsequent calls via its transition logic
    // setWeatherTargets(gameState.isNight, false, gameState.isRaining); // Initial call (optional, simulation handles first transition)

    clearMessage();
    startGameLoop();
    console.log("Game Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();

    // --- Core Loop Logic ---
    // 1. Update Simulation (handles game state, triggers target visual changes)
    updateSimulation(deltaTime);

    // 2. Update Environment Visuals (handles lerping towards targets)
    updateEnvironmentVisuals(deltaTime); // NEW call

    // 3. Update UI (reflects game state changes onto the screen)
    if (!gameState.gameOver) {
        updateUI();
    }

    // 4. Update Camera Controls
    if (controls) {
        controls.update();
    }

    // 5. Render Scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error("Render components missing in game loop!");
        if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    }
}

// Helper to start/restart the game loop
function startGameLoop() {
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); }
    clock = new THREE.Clock();
    gameLoop();
    console.log("MAIN: Game loop started/restarted.");
}


// --- Exported Restart Handler ---
export function handleRestart() {
    console.log("MAIN: Handling Restart Request...");
    hideGameOverModal();

    // Cleanup old tree
    if (gameState.treeMeshGroup) {
         if(scene) scene.remove(gameState.treeMeshGroup);
         // disposeTreeGroup is handled by createPlayerTree now
         disposeTreeMaterials();
         gameState.treeMeshGroup = null;
    } else {
        disposeTreeMaterials(); // Ensure module materials are cleared
    }

    // Reset game state logic
    initializeGameState();
    console.log("MAIN: Game state initialized.");

    // Recreate Tree
    createPlayerTree(); // Handles mesh creation and initial visuals
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
    // Optionally reset environment visuals instantly on restart?
    // setWeatherTargets(gameState.isNight, false, gameState.isRaining);
    // updateEnvironmentVisuals(1.0); // Force instant jump? Or let lerp handle it.

    // Ensure simulation loop is running
    startGameLoop();
    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);