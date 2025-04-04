import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createPlayerTree, updateTreeColors } from './tree.js'; // Only need high-level functions here usually
import { cacheDOMElements, setupUIListeners, updateUI, clearMessage } from './ui.js';
import { updateSimulation } from './simulation.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null; // To potentially stop the loop

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim...");

    // Set up DOM element references
    cacheDOMElements();

    // Set up Three.js scene, camera, renderer, controls, environment
    // Pass the canvas element to the scene setup
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error("Canvas element #game-canvas not found!");
        return;
    }
    initScene(canvas);

    // Initialize game state object (already happens on gameState.js load, but call again for clarity/reset)
    initializeGameState();

    // Create the initial player tree visuals
    createPlayerTree(gameState);

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

    // Get time delta
    const deltaTime = clock.getDelta();

    // --- Core Loop Logic ---
    // 1. Update Simulation (if not paused/game over)
    updateSimulation(deltaTime); // Handles game logic, physics, time progression

    // 2. Update UI (if not game over)
    if (!gameState.gameOver) {
        updateUI(); // Reflects changes in state onto the screen
    }

    // 3. Update Camera Controls
    if (controls) {
        controls.update(); // Allows damping etc. to work
    }

    // 4. Render Scene
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error("Render components missing in game loop!");
        cancelAnimationFrame(animationFrameId); // Stop loop if critical components missing
    }
}

function startGameLoop() {
    // Make sure any previous loop is stopped before starting a new one
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
    }
    clock = new THREE.Clock(); // Reset clock just in case
    gameLoop(); // Start the loop
}


// --- Start Application ---
// Use DOMContentLoaded to ensure HTML is ready before grabbing elements and starting Three.js
document.addEventListener('DOMContentLoaded', initializeApp);