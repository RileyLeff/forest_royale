import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js'; // Import config if needed directly
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Import necessary tree functions - updated list
import { createPlayerTree, calculateDimensions, disposeTreeMaterials, updateTreeGeometry, updateCanopyTiles } from './tree.js';

// Import functions from specific UI modules
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

    cacheDOMElements();

    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element #game-canvas not found!");
        return;
    }
    initScene(canvas);

    initializeGameState(); // Creates gameState object

    // createPlayerTree reads gameState, calculates dimensions, creates meshes,
    // and calls initial visual updates (updateCanopyTiles)
    createPlayerTree();

    // Reset camera target *after* tree exists
     if (controls) {
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update();
     } else {
         console.warn("OrbitControls not available to set target.");
     }

    setupUIListeners();
    updateUI(); // Initial UI state
    clearMessage();
    startGameLoop();

    console.log("Game Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();

    // Core Loop Logic
    updateSimulation(deltaTime); // Updates state, calls growTree/updateCanopyTiles if needed

    if (!gameState.gameOver) {
        updateUI(); // Updates DOM based on gameState
    }

    if (controls) {
        controls.update(); // Updates camera damping etc.
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera); // Renders the frame
    } else {
        console.error("Render components missing in game loop!");
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
}

// Helper to start/restart the game loop
function startGameLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    clock = new THREE.Clock(); // Reset clock
    gameLoop();
    console.log("MAIN: Game loop started/restarted.");
}


// --- Exported Restart Handler ---
export function handleRestart() {
    console.log("MAIN: Handling Restart Request...");

    hideGameOverModal();

    // Clean up old Three.js resources
    // createPlayerTree now handles cleanup internally via disposeTreeGroup/disposeTreeMaterials
    // We still need to remove the top-level group from the scene here.
    if (gameState.treeMeshGroup) {
         if(scene) {
             scene.remove(gameState.treeMeshGroup);
             // Call dispose helpers manually *before* nulling the reference
             // disposeTreeGroup(gameState.treeMeshGroup); // createPlayerTree does this now
             disposeTreeMaterials(); // Dispose module materials
        } else {
            console.warn("MAIN: Scene not found during tree cleanup.");
            disposeTreeMaterials(); // Still attempt material cleanup
        }
         gameState.treeMeshGroup = null;
    } else {
        console.log("MAIN: No old tree mesh group found to remove.");
        disposeTreeMaterials(); // Ensure materials are cleared even if no group existed
    }


    // Reset game state logic
    initializeGameState(); // Re-initializes state vars, including colors
    console.log("MAIN: Game state initialized.");

    // Recreate Tree (reads new state, creates meshes/tiles, does initial visual setup)
    createPlayerTree();
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

    // Ensure simulation loop is running
    startGameLoop(); // Restart the loop

    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);