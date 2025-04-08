// client/main.js

import * as THREE from 'three';
import { gameState, loadClientSettings, getMyPlayerState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js';
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage } from './ui/messageHandler.js';
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js';
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock();
let animationFrameId = null;
let socket = null;
let gameModeIntent = 'single'; // Default to single player if not set

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Client...");

    // --- Read Game Mode Intent ---
    gameModeIntent = sessionStorage.getItem('gameModeIntent') || 'single';
    console.log(`Client: Detected game mode intent: ${gameModeIntent}`);
    // Optional: Clear the intent flag now that we've read it
    // sessionStorage.removeItem('gameModeIntent');

    loadClientSettings();
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }

    initScene(canvas);

    console.log("Attempting to connect to server...");
    socket = io();

    setupSocketListeners();
    setupUIListeners();
    updateUI();
    clearMessage();

    console.log("Client Initialization complete. Waiting for server connection...");
}

// --- Socket Event Listener Setup ---
function setupSocketListeners() {
    socket.on('connect', () => {
        gameState.myId = socket.id;
        console.log(`Connected to server with ID: ${gameState.myId}`);
        showMessage(`Connected! Joining as ${gameModeIntent}...`, 'info');

        // --- Send join request with intent ---
        socket.emit('playerJoinRequest', {
            intent: gameModeIntent,
            // Send other client info if needed (name, colors from localStorage)
            // playerName: localStorage.getItem('playerName') || 'Treebard',
            // leafColor: localStorage.getItem('leafColor') || Config.DEFAULT_LEAF_COLOR,
            // trunkColor: localStorage.getItem('trunkColor') || Config.DEFAULT_TRUNK_COLOR,
        });
         // Clear intent after sending (optional, maybe keep for reconnect?)
         sessionStorage.removeItem('gameModeIntent');

    });

    // ... (disconnect, connect_error, gameStateUpdate, playerDisconnected, gameOver handlers remain the same) ...
    socket.on('disconnect', (reason) => {
        console.log(`Disconnected from server: ${reason}`);
        showMessage("Disconnected from server!", "error");
        gameState.myId = null;
        gameState.initialStateReceived = false;
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            console.log("Animation loop stopped due to disconnection.");
        }
        disposeAllTrees();
    });

    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        showMessage("Connection failed!", "error");
    });

    socket.on('gameStateUpdate', (serverState) => {
        // console.log("Received update. Server phase:", serverState.gamePhase, "Timer:", serverState.countdownTimer);
        const previousPhase = gameState.gamePhase; // Store previous phase for comparison

        gameState.day = serverState.day;
        gameState.timeInCycle = serverState.timeInCycle;
        gameState.currentPeriodIndex = serverState.currentPeriodIndex;
        gameState.isNight = serverState.isNight;
        gameState.currentLightMultiplier = serverState.currentLightMultiplier;
        gameState.currentDroughtFactor = serverState.currentDroughtFactor;
        gameState.isRaining = serverState.isRaining;
        gameState.gamePhase = serverState.gamePhase;
        gameState.countdownTimer = serverState.countdownTimer;
        gameState.serverTime = serverState.serverTime;
        gameState.players = serverState.players;

        if (!gameState.initialStateReceived) {
            console.log("First gameStateUpdate received. Setting up initial scene.");
            const myInitialState = getMyPlayerState();
            if (myInitialState && controls) {
                const initialHeight = myInitialState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT;
                const targetX = myInitialState.spawnPoint?.x ?? 0;
                const targetZ = myInitialState.spawnPoint?.z ?? 0;
                controls.target.set(targetX, initialHeight / 2 + (Config.ISLAND_LEVEL || 0), targetZ);
                controls.update();
            } else if (!myInitialState) {
                 console.warn("My player state not found in first update!");
            }
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000);
             if(gameState.isRaining) startRain(); else stopRain();

            gameState.initialStateReceived = true;
            startGameLoop();
            // Show phase message *after* loop starts, ensures UI is ready
            // Use timeout to allow first render potentially
            setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);

        } else if (gameState.gamePhase !== previousPhase) {
             // Optional: Show message when phase changes after initial load
             console.log(`Client phase updated from ${previousPhase} to: ${gameState.gamePhase}`);
             showMessage(`Game state: ${gameState.gamePhase}`, 'info');
        }


        const wasRaining = scene?.getObjectByName("rain")?.visible ?? false;
        setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
        if (gameState.isRaining && !wasRaining) startRain();
        else if (!gameState.isRaining && wasRaining) stopRain();

        const receivedPlayerIds = new Set(Object.keys(serverState.players));
        for (const playerId in serverState.players) { createOrUpdateTree(playerId, serverState.players[playerId]); }
        gameState.playerTrees.forEach((treeGroup, playerId) => { if (!receivedPlayerIds.has(playerId)) removeTree(playerId); });

        const myState = getMyPlayerState();
        if (myState && myState.isAlive && controls && gameState.playerTrees.has(gameState.myId)) {
             const myTreeGroup = gameState.playerTrees.get(gameState.myId);
             const targetPos = new THREE.Vector3(myTreeGroup.position.x, myState.trunkHeight / 2 + (Config.ISLAND_LEVEL || 0), myTreeGroup.position.z);
             if (!controls.target.equals(targetPos)){ controls.target.lerp(targetPos, 0.1); }
        }

    });

    socket.on('playerDisconnected', (playerId) => {
         console.log(`Player ${playerId} disconnected.`);
         removeTree(playerId);
    });

     socket.on('gameOver', (data) => {
         console.log("Game Over event received:", data);
         gameState.gameOver = true;
         gameState.gameOverReason = data.reason || "The game has ended!";
         gameState.winnerId = data.winnerId;
         showGameOverUI();
     });

} // End of setupSocketListeners

// --- Main Game Loop ---
// (gameLoop, startGameLoop, stopGameLoop, handleRestart remain the same)
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);
    const deltaTime = clock.getDelta();
    updateEnvironmentVisuals(deltaTime);
    updateRain(deltaTime);
    updateUI();
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
    else { console.error("Render components missing!"); stopGameLoop(); }
}
function startGameLoop() {
    if (animationFrameId !== null) { console.log("MAIN: Game loop already running."); return; }
    console.log("MAIN: Starting client render loop.");
    clock = new THREE.Clock();
    gameLoop();
}
function stopGameLoop() {
     if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("MAIN: Stopped client render loop."); }
}
export function handleRestart() {
    console.warn("MAIN: handleRestart() called - Current behavior reloads page.");
    window.location.href = '/';
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);

// --- Export socket for UI handlers ---
export { socket };