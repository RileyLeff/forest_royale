// client/main.js

import * as THREE from 'three';
import { gameState, loadClientSettings, getMyPlayerState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
// Tree functions used for rendering players, disposeAllTrees for cleanup
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
// +++ Spawn Selection Variables +++
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let islandMesh = null; // Reference to the island object for raycasting
let spawnMarkers = new Map(); // Map<playerId, THREE.Mesh> stores visual markers
let tempSpawnMarker = null; // Marker shown before confirmation

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Client...");
    gameModeIntent = sessionStorage.getItem('gameModeIntent') || 'single';
    console.log(`Client: Detected game mode intent: ${gameModeIntent}`);
    loadClientSettings();
    cacheDOMElements();
    const canvas = document.getElementById('game-canvas');
    if (!canvas) { console.error("Canvas element #game-canvas not found!"); return; }
    initScene(canvas); // Creates scene objects

    // +++ Get reference to island mesh AFTER scene setup +++
    // Ensure the island mesh in sceneSetup.js has the name 'island'
    islandMesh = scene.getObjectByName('island');
    if (!islandMesh) {
        console.error("Spawn Selection Error: Island mesh named 'island' not found in scene!");
    }
    // +++ Add listener for SPAWN SELECTION clicks +++
    // Use 'pointerup' for potentially better mobile compatibility
    canvas.addEventListener('pointerup', handleSpawnClick, false);


    console.log("Attempting to connect to server...");
    socket = io();
    setupSocketListeners();
    setupUIListeners(); // Includes lobby button listeners etc.
    updateUI();
    clearMessage();
    console.log("Client Initialization complete. Waiting for server connection...");
}

// --- Spawn Selection Click Handler ---
function handleSpawnClick(event) {
    const myState = getMyPlayerState();
    // Only allow clicking if in lobby and haven't chosen spawn yet
    if (gameState.gamePhase !== 'lobby' || !myState || myState.hasChosenSpawn || !islandMesh) {
        return;
    }
    // Prevent click if pointer lock is active (OrbitControls drag)
    if (document.pointerLockElement === renderer.domElement) {
        return;
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(islandMesh); // Intersect only with island

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        console.log('Island clicked at:', intersectionPoint);

        // Basic client-side check (optional, server MUST validate)
        const distanceToCenterSq = intersectionPoint.x**2 + intersectionPoint.z**2;
        const islandRadius = Config.ISLAND_RADIUS || 50;
        if (distanceToCenterSq > islandRadius * islandRadius) {
             showMessage("Cannot spawn outside the island!", "warning");
             return;
        }

        // Show temporary marker
        showTemporaryMarker(intersectionPoint);

        // Send coordinates to server
        if (socket && socket.connected) {
            console.log(`Client: Emitting selectSpawnPoint: { x: ${intersectionPoint.x.toFixed(2)}, z: ${intersectionPoint.z.toFixed(2)} }`);
            socket.emit('selectSpawnPoint', { x: intersectionPoint.x, z: intersectionPoint.z });
            // Optionally disable clicking briefly to prevent spam
            // canvas.removeEventListener('pointerup', handleSpawnClick);
            // setTimeout(() => canvas.addEventListener('pointerup', handleSpawnClick, false), 500);
        } else {
             showMessage("Not connected to server!", "error");
             removeTemporaryMarker(); // Remove temp marker if not connected
        }
    }
}

// --- Spawn Marker Visuals ---
const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16); // Small cylinder
const tempMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 }); // Yellow temp
const confirmedMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green confirmed (my marker)
const otherPlayerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 }); // Orange for others (changed from ff8800)

function showTemporaryMarker(position) {
    removeTemporaryMarker(); // Remove previous one if exists
    if (!tempSpawnMarker) { // Create if doesn't exist
         tempSpawnMarker = new THREE.Mesh(markerGeometry, tempMarkerMaterial);
         tempSpawnMarker.name = "tempSpawnMarker";
    }
    // Position slightly above the island surface using the island's base level
    tempSpawnMarker.position.set(position.x, (Config.ISLAND_LEVEL || 0.1) + 0.1, position.z);
    if (!tempSpawnMarker.parent) { // Add to scene only if not already added
        scene.add(tempSpawnMarker);
    }
}

function removeTemporaryMarker() {
     if (tempSpawnMarker) {
        if(tempSpawnMarker.parent) scene.remove(tempSpawnMarker);
        // Don't dispose geometry/material, reuse the mesh object
        // tempSpawnMarker = null; // Keep the object for reuse
    }
}

function addOrUpdateSpawnMarker(playerId, spawnPoint, isConfirmed) {
     let marker = spawnMarkers.get(playerId);
     if (!marker && isConfirmed) { // Only create confirmed markers
         // Choose material based on whether it's our marker or another player's
         const material = (playerId === gameState.myId) ? confirmedMarkerMaterial : otherPlayerMarkerMaterial;
         marker = new THREE.Mesh(markerGeometry.clone(), material); // Clone geometry, use specific material
         marker.name = `spawnMarker_${playerId}`;
         scene.add(marker);
         spawnMarkers.set(playerId, marker);
         // console.log(`Creating marker for ${playerId}`); // Debug
     }

     if (marker) { // Update position only if marker exists
         // Update position (slightly above island level)
          marker.position.set(spawnPoint.x, (Config.ISLAND_LEVEL || 0.1) + 0.1, spawnPoint.z);
          marker.visible = isConfirmed; // Ensure visibility matches confirmation
          // console.log(`Updating marker for ${playerId}, visible: ${isConfirmed}`); // Debug
     }
}


function removeSpawnMarker(playerId) {
     const marker = spawnMarkers.get(playerId);
     if (marker) {
         // console.log(`Removing marker for ${playerId}`); // Debug
         if(marker.parent) scene.remove(marker);
         marker.geometry.dispose(); // Dispose cloned geometry
         // Materials are shared or specific, don't dispose here unless cloned per marker
         spawnMarkers.delete(playerId);
     }
}

function removeAllSpawnMarkers() {
    // console.log("Removing all spawn markers"); // Debug
    spawnMarkers.forEach((marker, playerId) => {
        if(marker.parent) scene.remove(marker);
        marker.geometry.dispose();
    });
    spawnMarkers.clear();
    removeTemporaryMarker(); // Ensure temp one is gone too
}

// --- Socket Event Listener Setup ---
function setupSocketListeners() {
    socket.on('connect', () => {
        gameState.myId = socket.id;
        console.log(`Connected to server with ID: ${gameState.myId}`);
        showMessage(`Connected! Joining as ${gameModeIntent}...`, 'info');
        socket.emit('playerJoinRequest', { intent: gameModeIntent });
        sessionStorage.removeItem('gameModeIntent');
    });

    socket.on('disconnect', (reason) => { /* ... disconnect logic ... */
        console.log(`Disconnected from server: ${reason}`); showMessage("Disconnected!", "error");
        gameState.myId = null; gameState.initialStateReceived = false;
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null;
        disposeAllTrees(); removeAllSpawnMarkers();
    });

    socket.on('connect_error', (error) => { console.error('Connection Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler ---
    socket.on('gameStateUpdate', (serverState) => {
        const previousPhase = gameState.gamePhase;

        // Update local cache using Object.assign for brevity
        Object.assign(gameState, {
            day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex,
            isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor,
            isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer,
            serverTime: serverState.serverTime, players: serverState.players,
        });

        // --- First Time Setup ---
        if (!gameState.initialStateReceived) {
             console.log("First gameStateUpdate received. Setting up initial scene.");
             const myInitialState = getMyPlayerState();
             if (myInitialState && controls) { /* Set initial camera target */
                  const initialHeight = myInitialState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT;
                  const targetX = myInitialState.spawnPoint?.x ?? 0; const targetZ = myInitialState.spawnPoint?.z ?? 0;
                  const baseLevel = Config.ISLAND_LEVEL || 0;
                  controls.target.set(targetX, initialHeight / 2 + baseLevel, targetZ);
                  controls.update();
             }
             setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
             updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain();
             gameState.initialStateReceived = true;
             startGameLoop();
             setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
        } else if (gameState.gamePhase !== previousPhase) {
             console.log(`Client phase updated from ${previousPhase} to: ${gameState.gamePhase}`);
             showMessage(`Game state: ${gameState.gamePhase}`, 'info');
             // Clear markers if transitioning OUT of lobby/countdown
             if ((previousPhase === 'lobby' || previousPhase === 'countdown') && (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown')) {
                  console.log("Phase changed from lobby/countdown, removing markers.");
                  removeAllSpawnMarkers();
             }
        }

        // Update environment visuals smoothly
        const wasRaining = scene?.getObjectByName("rain")?.visible ?? false;
        setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining);
        if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();

        // --- Update Trees & Spawn Markers ---
        const receivedPlayerIds = new Set(Object.keys(serverState.players));
        const currentMarkerIds = new Set(spawnMarkers.keys());

        for (const playerId in serverState.players) {
            const playerData = serverState.players[playerId];
            // Update Trees (only needed if playing or maybe ended to show dead state?)
            if (gameState.gamePhase === 'playing' || gameState.gamePhase === 'ended') {
                 createOrUpdateTree(playerId, playerData);
            } else {
                 // If in lobby/countdown, ensure trees aren't visible yet
                 removeTree(playerId); // Remove any lingering tree meshes
            }

            // Update spawn markers based on lobby/countdown state
            if (gameState.gamePhase === 'lobby' || gameState.gamePhase === 'countdown') {
                addOrUpdateSpawnMarker(playerId, playerData.spawnPoint, playerData.hasChosenSpawn);
            }
        }
        // Remove trees & markers for disconnected players
        gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeTree(playerId); });
        spawnMarkers.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeSpawnMarker(playerId); });
        // If phase is not lobby/countdown, ensure all markers removed
         if (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown' && spawnMarkers.size > 0) {
              removeAllSpawnMarkers();
         }


        // Update Camera Target
        const myState = getMyPlayerState();
        if (myState && myState.isAlive && controls && gameState.playerTrees.has(gameState.myId)) { /* Lerp camera */
             const myTreeGroup = gameState.playerTrees.get(gameState.myId);
             const baseLevel = Config.ISLAND_LEVEL || 0;
             const targetPos = new THREE.Vector3(myTreeGroup.position.x, myState.trunkHeight / 2 + baseLevel, myTreeGroup.position.z);
             if (!controls.target.equals(targetPos)){ controls.target.lerp(targetPos, 0.1); }
        } else if (!myState?.isAlive && controls && gameState.gamePhase !== 'lobby') { // If not alive or state missing (and not in lobby)
             controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); // Gently move towards center island view
        }

    }); // End of gameStateUpdate handler

    // --- Spawn Point Confirmation Handlers ---
    socket.on('spawnPointConfirmed', (confirmedPoint) => {
         console.log("Client: Received spawnPointConfirmed", confirmedPoint);
         removeTemporaryMarker(); // Remove yellow marker
         const myId = gameState.myId;
         if (myId) {
             addOrUpdateSpawnMarker(myId, confirmedPoint, true); // Add green marker
             const myState = getMyPlayerState();
             if(myState) myState.hasChosenSpawn = true; // Update local state flag for immediate feedback
             showMessage("Spawn point confirmed!", "info");
             updateUI(); // Refresh UI to show lobby list change immediately
         }
    });

    socket.on('spawnPointInvalid', (data) => {
         console.log("Client: Received spawnPointInvalid", data);
         removeTemporaryMarker();
         showMessage(`Spawn invalid: ${data?.reason || 'Try again.'}`, "warning");
    });


    // --- Other handlers (disconnect, gameover) ---
    socket.on('playerDisconnected', (playerId) => {
         console.log(`Player ${playerId} disconnected.`);
         removeTree(playerId); removeSpawnMarker(playerId);
    });

    socket.on('gameOver', (data) => {
         console.log("Game Over event received:", data);
         gameState.gameOver = true; gameState.gameOverReason = data.reason || "The game has ended!"; gameState.winnerId = data.winnerId;
         removeAllSpawnMarkers(); showGameOverUI();
    });

} // End of setupSocketListeners

// --- Main Game Loop ---
function gameLoop() { /* ... render loop ... */
    animationFrameId = requestAnimationFrame(gameLoop); const deltaTime = clock.getDelta();
    updateEnvironmentVisuals(deltaTime); updateRain(deltaTime); updateUI();
    if (controls) controls.update(); if (renderer && scene && camera) renderer.render(scene, camera);
    else { console.error("Render components missing!"); stopGameLoop(); }
}
// --- Loop Helpers & Restart ---
function startGameLoop() { /* ... start loop ... */ if (animationFrameId !== null) return; console.log("MAIN: Starting client render loop."); clock = new THREE.Clock(); gameLoop(); }
function stopGameLoop() { /* ... stop loop ... */ if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("MAIN: Stopped client render loop."); } }
export function handleRestart() { /* ... reload page ... */ window.location.href = '/'; }

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);
// --- Export socket ---
export { socket };