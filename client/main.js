// client/main.js

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // Keep if OrbitControls is used here
import { gameState, loadClientSettings, getMyPlayerState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js';
import { uiElements, cacheDOMElements } from './ui/elements.js'; // Import uiElements
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
import { showMessage, clearMessage, attachServerMessageListener } from './ui/messageHandler.js';
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js';
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock(); let animationFrameId = null; let socket = null;
let raycaster = new THREE.Raycaster(); let mouse = new THREE.Vector2();
let islandMesh = null; let spawnMarkers = new Map(); let tempSpawnMarker = null;

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Client...");
    const intent = sessionStorage.getItem('gameModeIntent') || 'single'; // Default to single if nothing stored
    gameState.isSpectator = (intent === 'spectate');
    console.log(`Client: Detected intent: ${intent}, Is Spectator: ${gameState.isSpectator}`);

    loadClientSettings(); cacheDOMElements(); // Cache elements including the new button

    const canvas = uiElements.canvas; // Use cached element
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }
    initScene(canvas);

    islandMesh = scene.getObjectByName('island');
    if (!islandMesh) console.error("Spawn Error: Island mesh 'island' not found in scene!");
    // Only add spawn click listener if not spectator
    if (!gameState.isSpectator && canvas) {
        canvas.addEventListener('pointerup', handleSpawnClick, false);
        console.log("Spawn click listener added.");
    } else {
         console.log("Spectator mode: Spawn click listener skipped.");
    }


    // +++ Add Back Button Listener +++
    if (uiElements.backButton) {
        uiElements.backButton.addEventListener('click', () => {
            console.log("Client: Back to Menu button clicked.");
            if (socket && socket.connected) {
                socket.disconnect(); // Gracefully disconnect before navigating
            }
            window.location.href = '/'; // Navigate to main menu
        });
        console.log("Back button listener added.");
    } else {
         console.warn("Back button UI element not found during init.");
    }

    console.log("Attempting to connect to server...");
    socket = io({
         reconnection: true, // Enable default reconnection
         reconnectionAttempts: 5,
         reconnectionDelay: 1000,
    });
    setupSocketListeners(intent);
    setupUIListeners(); // Sets up listeners for game controls etc.
    updateUI(); clearMessage();
    console.log("Client Initialization complete. Waiting for server connection...");
}

// --- Spawn Selection Click Handler ---
function handleSpawnClick(event) {
    const myState = getMyPlayerState();
    // Check all conditions: lobby phase, not spectator, player state exists, hasn't chosen, island exists, not pointer locked
    if (gameState.gamePhase !== 'lobby' || gameState.isSpectator || !myState || myState.hasChosenSpawn || !islandMesh || document.pointerLockElement === renderer.domElement) {
        // console.log("Spawn click ignored:", gameState.gamePhase, gameState.isSpectator, !!myState, myState?.hasChosenSpawn); // Debug log
        return;
    }
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(islandMesh);
    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        const islandRadius = Config.ISLAND_RADIUS || 50;
        // Check bounds relative to island center (0,0)
        if (intersectionPoint.x**2 + intersectionPoint.z**2 > islandRadius*islandRadius) {
            showMessage("Cannot spawn outside island!", "warning");
            return;
        }
        showTemporaryMarker(intersectionPoint);
        if (socket && socket.connected) {
            console.log(`Client: Emitting selectSpawnPoint: { x: ${intersectionPoint.x.toFixed(2)}, z: ${intersectionPoint.z.toFixed(2)} }`);
            socket.emit('selectSpawnPoint', { x: intersectionPoint.x, z: intersectionPoint.z });
        } else {
            showMessage("Not connected!", "error");
            removeTemporaryMarker();
        }
    }
}

// --- Spawn Marker Visuals ---
const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16);
const tempMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 });
const confirmedMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const otherPlayerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });

function showTemporaryMarker(position) {
     removeTemporaryMarker();
     if (!tempSpawnMarker) {
         tempSpawnMarker = new THREE.Mesh(markerGeometry, tempMarkerMaterial);
         tempSpawnMarker.name = "tempSpawnMarker";
     }
     const baseLevel = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
     tempSpawnMarker.position.set(position.x, baseLevel + 0.1, position.z); // Position just above island level
     if (!tempSpawnMarker.parent) scene.add(tempSpawnMarker);
}
function removeTemporaryMarker() { if (tempSpawnMarker && tempSpawnMarker.parent) scene.remove(tempSpawnMarker); }

function addOrUpdateSpawnMarker(playerId, spawnPoint, isConfirmed) {
    if (!spawnPoint) return; // Guard against missing spawn point data
    let marker = spawnMarkers.get(playerId);
    if (!marker && isConfirmed) {
        const material = (playerId === gameState.myId && !gameState.isSpectator) ? confirmedMarkerMaterial.clone() : otherPlayerMarkerMaterial.clone();
        marker = new THREE.Mesh(markerGeometry.clone(), material);
        marker.name = `spawnMarker_${playerId}`;
        scene.add(marker);
        spawnMarkers.set(playerId, marker);
    }
    if (marker) {
         const baseLevel = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
        marker.position.set(spawnPoint.x, baseLevel + 0.1, spawnPoint.z);
        marker.visible = isConfirmed; // Only show confirmed markers
    }
}

function removeSpawnMarker(playerId) {
    const marker = spawnMarkers.get(playerId);
    if (marker) {
        if(marker.parent) scene.remove(marker);
        marker.geometry.dispose();
        if(marker.material) marker.material.dispose(); // Dispose material
        spawnMarkers.delete(playerId);
    }
}
function removeAllSpawnMarkers() {
    spawnMarkers.forEach((marker, playerId) => { removeSpawnMarker(playerId); }); // Use removeSpawnMarker for proper disposal
    spawnMarkers.clear();
    removeTemporaryMarker();
}

// --- Socket Event Listener Setup ---
function setupSocketListeners(intent) {
    socket.on('connect', () => {
        gameState.myId = socket.id;
        console.log(`Connected to server with ID: ${gameState.myId}`);
        showMessage(`Connected! Joining as ${intent}...`, 'info');
        // Retrieve settings to send with join request
        const playerName = localStorage.getItem('playerName') || `Tree_${socket.id.substring(0, 4)}`;
        const leafColor = localStorage.getItem('leafColor') || Config.DEFAULT_LEAF_COLOR;
        const trunkColor = localStorage.getItem('trunkColor') || Config.DEFAULT_TRUNK_COLOR;

        socket.emit('playerJoinRequest', {
            intent: intent,
            playerName: playerName,
            leafColor: leafColor,
            trunkColor: trunkColor
         });
        sessionStorage.removeItem('gameModeIntent'); // Clean up intent storage

        attachServerMessageListener(); // Moved here previously

    });

    socket.on('disconnect', (reason) => {
        console.log(`Disconnected: ${reason}`);
        showMessage("Disconnected!", "error");
        gameState.myId = null;
        gameState.initialStateReceived = false;
        gameState.isSpectator = false; // Reset spectator status on disconnect
        gameState.gameOver = false; // Reset game over state
        gameState.players = {}; // Clear player cache
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        disposeAllTrees();
        removeAllSpawnMarkers();
        updateUI(); // Update UI to reflect disconnected state
    });
    socket.on('connect_error', (error) => {
        console.error('Connection Error:', error);
        showMessage("Connection failed!", "error");
    });

    // --- Game State Update Handler ---
    socket.on('gameStateUpdate', (serverState) => {
        // console.log("GS Update:", serverState.gamePhase, serverState.players); // Debug log
        const previousPhase = gameState.gamePhase;

        // Check if serverState.players exists before trying to access it
        const playersFromServer = serverState.players || {};
        const myServerData = playersFromServer[gameState.myId];

        // Update core state properties
        Object.assign(gameState, {
            day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex,
            isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor,
            isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer,
            serverTime: serverState.serverTime,
            players: playersFromServer, // Update player cache
            allowPlayerCountdownStart: serverState.allowPlayerCountdownStart, // Sync admin toggle
        });

        // Update spectator status based *only* on server data for this client
        gameState.isSpectator = myServerData?.isSpectator ?? gameState.isSpectator; // Keep current if server data missing

        // First time setup
        if (!gameState.initialStateReceived && gameState.myId && myServerData) {
             console.log("First gameStateUpdate processed.");
             const myInitialState = myServerData; // Use direct data
             if (myInitialState && controls) {
                 const initialHeight = myInitialState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT;
                 const targetX = myInitialState.spawnPoint?.x ?? 0;
                 const targetZ = myInitialState.spawnPoint?.z ?? 0;
                 const baseLevel = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 if(gameState.isSpectator) { // Camera for spectator
                     controls.target.set(0, 5, 0); // Overview
                     camera.position.set(15, 20, 15); // Slightly higher overview
                 } else { // Camera for player
                      controls.target.set(targetX, initialHeight / 2 + baseLevel, targetZ);
                      camera.position.set(targetX + 8, initialHeight + 5, targetZ + 8); // Position near own tree
                 }
                 controls.update();
             }
             // Initial environment setup
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000); // Initial fast transition
             if(gameState.isRaining) startRain(); else stopRain();

             gameState.initialStateReceived = true;
             startGameLoop(); // Start render loop ONLY after first state
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         } else if (gameState.gamePhase !== previousPhase) {
             console.log(`Client phase updated from ${previousPhase} to: ${gameState.gamePhase}`);
             showMessage(`Game state: ${gameState.gamePhase}`, 'info');
             // Clear spawn markers when leaving lobby/countdown
             if ((previousPhase === 'lobby' || previousPhase === 'countdown') && (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown')) {
                 removeAllSpawnMarkers();
             }
         }

         // --- Continuous Updates ---

         // Update Environment Visuals (Sky, Fog, Rain)
         const wasRaining = scene?.getObjectByName("rain")?.visible ?? false;
         setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
         if (gameState.isRaining && !wasRaining) startRain();
         else if (!gameState.isRaining && wasRaining) stopRain();

         // Update Trees & Spawn Markers
         const receivedPlayerIds = new Set(Object.keys(playersFromServer));
         for (const playerId in playersFromServer) {
             const playerData = playersFromServer[playerId];
             // Tree Rendering: Render if NOT spectator OR if spectator viewing others
             if (!playerData.isSpectator) {
                 createOrUpdateTree(playerId, playerData);
             } else {
                  // Ensure no tree is rendered for spectators themselves
                  removeTree(playerId);
             }
             // Spawn Marker Rendering: Only show in lobby/countdown phase
             if (gameState.gamePhase === 'lobby' || gameState.gamePhase === 'countdown') {
                 addOrUpdateSpawnMarker(playerId, playerData.spawnPoint, playerData.hasChosenSpawn);
             }
         }
         // Remove trees for players no longer in the state
         gameState.playerTrees.forEach((_, playerId) => {
             if (!receivedPlayerIds.has(playerId)) removeTree(playerId);
         });
         // Remove markers for players no longer in the state
         spawnMarkers.forEach((_, playerId) => {
              if (!receivedPlayerIds.has(playerId)) removeSpawnMarker(playerId);
         });
         // Clean up all markers if not in lobby/countdown
         if (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown' && spawnMarkers.size > 0) {
             removeAllSpawnMarkers();
         }

         // Update Camera Target (Player Follow / Spectator Overview)
         const myCurrentState = getMyPlayerState(); // Get potentially updated state
         if (myCurrentState && myCurrentState.isAlive && !gameState.isSpectator && controls && gameState.playerTrees.has(gameState.myId)) {
             const myTreeGroup = gameState.playerTrees.get(gameState.myId);
             if (myTreeGroup) { // Check tree exists
                 const baseLevel = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 const targetPos = new THREE.Vector3(myTreeGroup.position.x, myCurrentState.trunkHeight / 2 + baseLevel, myTreeGroup.position.z);
                 if (!controls.target.equals(targetPos)){ controls.target.lerp(targetPos, 0.1); } // Smooth follow
             }
         } else if (controls && (gameState.isSpectator || !myCurrentState?.isAlive) && gameState.gamePhase !== 'lobby') {
             // If spectator, or player is dead, or game not in lobby -> general overview
             controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05);
         }
         // No camera lerp in lobby - allow free look

     }); // End gameStateUpdate

    // --- Spawn Handlers ---
    socket.on('spawnPointConfirmed', (confirmedPoint) => {
        if(gameState.isSpectator) return;
        console.log("Client: Spawn Confirmed", confirmedPoint);
        removeTemporaryMarker();
        const myId = gameState.myId;
        if (myId) {
            addOrUpdateSpawnMarker(myId, confirmedPoint, true);
            const myState = getMyPlayerState();
            if(myState) myState.hasChosenSpawn = true; // Update local cache immediately
            showMessage("Spawn confirmed!", "success"); // Changed type
            updateUI(); // Update UI to show "(Placed)" status
        }
    });
    socket.on('spawnPointInvalid', (data) => {
        if(gameState.isSpectator) return;
        console.log("Client: Spawn Invalid", data);
        removeTemporaryMarker();
        showMessage(`Spawn invalid: ${data?.reason || 'Try again.'}`, "warning");
    });

    // --- Other handlers ---
    socket.on('playerDisconnected', (playerId) => {
        console.log(`Player ${playerId} disconnected.`);
        removeTree(playerId);
        removeSpawnMarker(playerId);
        // Player list UI will update on next gameStateUpdate
    });
    socket.on('gameOver', (data) => {
        console.log("Game Over received:", data);
        gameState.gameOver = true;
        gameState.gameOverReason = data.reason || "Game Ended!";
        gameState.winnerId = data.winnerId;
        removeAllSpawnMarkers();
        showGameOverUI(); // Update UI immediately
    });

     // Listen for server messages (e.g., join notifications)
     socket.on('serverMessage', (data) => {
         console.log("Received server message:", data);
         showMessage(data.text, data.type || 'info');
     });


} // End of setupSocketListeners

// --- Main Game Loop & Helpers ---
function gameLoop() {
    animationFrameId=requestAnimationFrame(gameLoop);
    const dt=clock.getDelta();
    updateEnvironmentVisuals(dt);
    updateRain(dt);
    updateUI(); // Update UI every frame
    if(controls) controls.update();
    if(renderer && scene && camera) renderer.render(scene, camera);
    else { console.error("Render components missing!"); stopGameLoop(); }
}
function startGameLoop() {
    if(animationFrameId!==null) return;
    console.log("MAIN: Starting client render loop.");
    clock = new THREE.Clock(); // Reset clock
    gameLoop();
}
function stopGameLoop() {
    if(animationFrameId!==null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("MAIN: Stopped client render loop.");
    }
}
// handleRestart is now primarily used by the GameOver modal 'Play Again' button
export function handleRestart() {
     console.log("Restart button clicked, navigating to /");
     if (socket && socket.connected) {
        socket.disconnect();
     }
     window.location.href = '/';
}

// --- Export socket for other modules ---
export { socket };

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);