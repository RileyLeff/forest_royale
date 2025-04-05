import * as THREE from 'three';
import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createPlayerTree, calculateDimensions, disposeTreeMaterials } from './tree.js';
// ++ Import hideGameOverModal ++
import { cacheDOMElements, setupUIListeners, updateUI, clearMessage, hideGameOverModal } from './ui.js';
import { updateSimulation } from './simulation.js';
// Scene already imported via sceneSetup

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim...");
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }
    initScene(canvas);
    initializeGameState();
    calculateDimensions(); // Reads gameState directly now
    createPlayerTree(); // Reads gameState directly now
    if (controls) {
        const targetY = (gameState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT) / 2;
        controls.target.set(0, targetY, 0);
        controls.update();
    } else { console.warn("OrbitControls not available to set target."); }
    setupUIListeners();
    updateUI();
    clearMessage();
    startGameLoop();
    console.log("Initialization complete. Starting game loop.");
}

// --- Main Game Loop ---
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();
    updateSimulation(deltaTime);
    if (!gameState.gameOver) { updateUI(); }
    if (controls) { controls.update(); }
    if (renderer && scene && camera) { renderer.render(scene, camera); }
    else { console.error("Render components missing!"); cancelAnimationFrame(animationFrameId); animationFrameId = null; }
}

// Helper to start/restart the game loop
function startGameLoop() {
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); }
    clock = new THREE.Clock();
    gameLoop();
}


// --- Exported Restart Handler ---
// This function is called by the button listener in ui.js
export function handleRestart() {
    console.log("MAIN: Handling Restart Request...");

    // ++ Hide the Game Over modal FIRST ++
    hideGameOverModal(); // Call the function from ui.js

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
    clearMessage();

    // Ensure simulation loop is running and flags are correct
    startGameLoop(); // Restart loop to be safe

    console.log("MAIN: Game Restarted successfully.");
}


// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);