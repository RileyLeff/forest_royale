// client/main.js

import * as THREE from 'three';
import { gameState, loadClientSettings, getMyPlayerState } from './gameState.js';
import * as Config from './config.js';
import { initScene, renderer, camera, controls, scene } from './sceneSetup.js';
import { createOrUpdateTree, removeTree, disposeAllTrees } from './tree.js';
import { cacheDOMElements } from './ui/elements.js';
import { setupUIListeners } from './ui/setupListeners.js';
import { updateUI } from './ui/update.js';
// Import specific functions from messageHandler
import { showMessage, clearMessage, attachServerMessageListener } from './ui/messageHandler.js'; // Import attach function
import { hideGameOverModal, showGameOverUI } from './ui/gameOver.js';
import { updateEnvironmentVisuals, updateRain, setWeatherTargets, startRain, stopRain } from './environment.js';

// --- Global Variables ---
let clock = new THREE.Clock(); let animationFrameId = null; let socket = null;
let raycaster = new THREE.Raycaster(); let mouse = new THREE.Vector2();
let islandMesh = null; let spawnMarkers = new Map(); let tempSpawnMarker = null;

// --- Initialization Function ---
function initializeApp() {
    console.log("Initializing Island Canopy Sim Client...");
    const intent = sessionStorage.getItem('gameModeIntent') || 'single';
    gameState.isSpectator = (intent === 'spectate');
    console.log(`Client: Detected intent: ${intent}, Is Spectator: ${gameState.isSpectator}`);
    loadClientSettings(); cacheDOMElements();
    const canvas = document.getElementById('game-canvas'); if (!canvas) { return; } initScene(canvas);
    islandMesh = scene.getObjectByName('island'); if (!islandMesh) console.error("Spawn Error: Island mesh 'island' not found!");
    canvas.addEventListener('pointerup', handleSpawnClick, false);
    console.log("Attempting to connect to server...");
    socket = io(); // Define socket here
    setupSocketListeners(intent); // Setup listeners AFTER socket defined
    setupUIListeners(); updateUI(); clearMessage();
    console.log("Client Initialization complete. Waiting for server connection...");
}

// --- Spawn Selection Click Handler ---
// (handleSpawnClick remains the same as previous complete version)
function handleSpawnClick(event) { const myState = getMyPlayerState(); if (gameState.gamePhase !== 'lobby' || gameState.isSpectator || !myState || myState.hasChosenSpawn || !islandMesh) { return; } if (document.pointerLockElement === renderer.domElement) return; mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = - (event.clientY / window.innerHeight) * 2 + 1; raycaster.setFromCamera(mouse, camera); const intersects = raycaster.intersectObject(islandMesh); if (intersects.length > 0) { const intersectionPoint = intersects[0].point; const islandRadius = Config.ISLAND_RADIUS || 50; if (intersectionPoint.x**2 + intersectionPoint.z**2 > islandRadius*islandRadius) { showMessage("Cannot spawn outside island!", "warning"); return; } showTemporaryMarker(intersectionPoint); if (socket && socket.connected) { console.log(`Client: Emitting selectSpawnPoint: { x: ${intersectionPoint.x.toFixed(2)}, z: ${intersectionPoint.z.toFixed(2)} }`); socket.emit('selectSpawnPoint', { x: intersectionPoint.x, z: intersectionPoint.z }); } else { showMessage("Not connected!", "error"); removeTemporaryMarker(); } } }

// --- Spawn Marker Visuals ---
// (marker functions remain the same as previous complete version)
const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16); const tempMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 }); const confirmedMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); const otherPlayerMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500 });
function showTemporaryMarker(position) { removeTemporaryMarker(); if (!tempSpawnMarker) { tempSpawnMarker = new THREE.Mesh(markerGeometry, tempMarkerMaterial); tempSpawnMarker.name = "tempSpawnMarker"; } tempSpawnMarker.position.set(position.x, (Config.ISLAND_LEVEL || 0.1) + 0.1, position.z); if (!tempSpawnMarker.parent) scene.add(tempSpawnMarker); }
function removeTemporaryMarker() { if (tempSpawnMarker) { if(tempSpawnMarker.parent) scene.remove(tempSpawnMarker); } }
function addOrUpdateSpawnMarker(playerId, spawnPoint, isConfirmed) { let marker = spawnMarkers.get(playerId); if (!marker && isConfirmed) { const material = (playerId === gameState.myId && !gameState.isSpectator) ? confirmedMarkerMaterial : otherPlayerMarkerMaterial; marker = new THREE.Mesh(markerGeometry.clone(), material); marker.name = `spawnMarker_${playerId}`; scene.add(marker); spawnMarkers.set(playerId, marker); } if (marker) { marker.position.set(spawnPoint.x, (Config.ISLAND_LEVEL || 0.1) + 0.1, spawnPoint.z); marker.visible = isConfirmed; } }
function removeSpawnMarker(playerId) { const marker = spawnMarkers.get(playerId); if (marker) { if(marker.parent) scene.remove(marker); marker.geometry.dispose(); spawnMarkers.delete(playerId); } }
function removeAllSpawnMarkers() { spawnMarkers.forEach((marker) => { if(marker.parent) scene.remove(marker); marker.geometry.dispose(); }); spawnMarkers.clear(); removeTemporaryMarker(); }

// --- Socket Event Listener Setup ---
function setupSocketListeners(intent) {
    socket.on('connect', () => {
        gameState.myId = socket.id;
        console.log(`Connected to server with ID: ${gameState.myId}`);
        showMessage(`Connected! Joining as ${intent}...`, 'info');
        socket.emit('playerJoinRequest', { intent: intent });
        sessionStorage.removeItem('gameModeIntent');

        // +++ Attach server message listener AFTER connection +++
        attachServerMessageListener();

    });

    socket.on('disconnect', (reason) => { /* ... disconnect logic ... */ console.log(`Disconnected: ${reason}`); showMessage("Disconnected!", "error"); gameState.myId = null; gameState.initialStateReceived = false; gameState.isSpectator = false; if (animationFrameId !== null) cancelAnimationFrame(animationFrameId); animationFrameId = null; disposeAllTrees(); removeAllSpawnMarkers(); });
    socket.on('connect_error', (error) => { /* ... */ console.error('Conn Error:', error); showMessage("Connection failed!", "error"); });

    // --- Game State Update Handler ---
    socket.on('gameStateUpdate', (serverState) => { /* ... gameState update logic ... */
         const previousPhase = gameState.gamePhase; Object.assign(gameState, { day: serverState.day, timeInCycle: serverState.timeInCycle, currentPeriodIndex: serverState.currentPeriodIndex, isNight: serverState.isNight, currentLightMultiplier: serverState.currentLightMultiplier, currentDroughtFactor: serverState.currentDroughtFactor, isRaining: serverState.isRaining, gamePhase: serverState.gamePhase, countdownTimer: serverState.countdownTimer, serverTime: serverState.serverTime, players: serverState.players, }); const myServerState = serverState.players[gameState.myId]; gameState.isSpectator = myServerState?.isSpectator ?? gameState.isSpectator;
         if (!gameState.initialStateReceived) { /* ... First time setup ... */ console.log("First gameStateUpdate received."); const myInitialState = getMyPlayerState(); if (myInitialState && controls) { const initialHeight = myInitialState.trunkHeight || Config.INITIAL_TRUNK_HEIGHT; const targetX = myInitialState.spawnPoint?.x ?? 0; const targetZ = myInitialState.spawnPoint?.z ?? 0; const baseLevel = Config.ISLAND_LEVEL || 0; if(gameState.isSpectator) { controls.target.set(0, 5, 0); } else { controls.target.set(targetX, initialHeight / 2 + baseLevel, targetZ); } controls.update(); } setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); updateEnvironmentVisuals(1000); if(gameState.isRaining) startRain(); else stopRain(); gameState.initialStateReceived = true; startGameLoop(); setTimeout(() => showMessage(`Game state: ${gameState.gamePhase}`, 'info'), 100);
         } else if (gameState.gamePhase !== previousPhase) { /* ... Phase change update ... */ console.log(`Client phase updated from ${previousPhase} to: ${gameState.gamePhase}`); showMessage(`Game state: ${gameState.gamePhase}`, 'info'); if ((previousPhase === 'lobby' || previousPhase === 'countdown') && (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown')) { removeAllSpawnMarkers();} }
         /* Update Environment */ const wasRaining = scene?.getObjectByName("rain")?.visible ?? false; setWeatherTargets(gameState.isNight, gameState.currentLightMultiplier < Config.LIGHT_MULT_SUNNY - 0.1, gameState.isRaining); if (gameState.isRaining && !wasRaining) startRain(); else if (!gameState.isRaining && wasRaining) stopRain();
         /* Update Trees & Markers */ const receivedPlayerIds = new Set(Object.keys(serverState.players)); for (const playerId in serverState.players) { const playerData = serverState.players[playerId]; if (playerId === gameState.myId && gameState.isSpectator) { removeTree(playerId); continue; } if (gameState.gamePhase === 'playing' || gameState.gamePhase === 'ended' || gameState.isSpectator) { createOrUpdateTree(playerId, playerData); } else { removeTree(playerId); } if (gameState.gamePhase === 'lobby' || gameState.gamePhase === 'countdown') { addOrUpdateSpawnMarker(playerId, playerData.spawnPoint, playerData.hasChosenSpawn); } } gameState.playerTrees.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeTree(playerId); }); spawnMarkers.forEach((_, playerId) => { if (!receivedPlayerIds.has(playerId)) removeSpawnMarker(playerId); }); if (gameState.gamePhase !== 'lobby' && gameState.gamePhase !== 'countdown' && spawnMarkers.size > 0) { removeAllSpawnMarkers(); }
         /* Update Camera Target */ const myState = getMyPlayerState(); if (myState && myState.isAlive && !gameState.isSpectator && controls && gameState.playerTrees.has(gameState.myId)) { const myTreeGroup = gameState.playerTrees.get(gameState.myId); const baseLevel = Config.ISLAND_LEVEL || 0; const targetPos = new THREE.Vector3(myTreeGroup.position.x, myState.trunkHeight / 2 + baseLevel, myTreeGroup.position.z); if (!controls.target.equals(targetPos)){ controls.target.lerp(targetPos, 0.1); } } else if (controls && gameState.gamePhase !== 'lobby') { controls.target.lerp(new THREE.Vector3(0, 5, 0), 0.05); }
     }); // End gameStateUpdate

    // --- Spawn Handlers ---
    socket.on('spawnPointConfirmed', (confirmedPoint) => { if(gameState.isSpectator) return; console.log("Client: Spawn Confirmed", confirmedPoint); removeTemporaryMarker(); const myId = gameState.myId; if (myId) { addOrUpdateSpawnMarker(myId, confirmedPoint, true); const myState = getMyPlayerState(); if(myState) myState.hasChosenSpawn = true; showMessage("Spawn confirmed!", "info"); updateUI(); } });
    socket.on('spawnPointInvalid', (data) => { if(gameState.isSpectator) return; console.log("Client: Spawn Invalid", data); removeTemporaryMarker(); showMessage(`Spawn invalid: ${data?.reason || 'Try again.'}`, "warning"); });
    // --- Other handlers ---
    socket.on('playerDisconnected', (playerId) => { console.log(`Player ${playerId} disconnected.`); removeTree(playerId); removeSpawnMarker(playerId); });
    socket.on('gameOver', (data) => { console.log("Game Over received:", data); gameState.gameOver = true; gameState.gameOverReason = data.reason || "Game Ended!"; gameState.winnerId = data.winnerId; removeAllSpawnMarkers(); showGameOverUI(); });

} // End of setupSocketListeners

// --- Main Game Loop & Helpers ---
function gameLoop() { animationFrameId=requestAnimationFrame(gameLoop); const dt=clock.getDelta(); updateEnvironmentVisuals(dt); updateRain(dt); updateUI(); if(controls)controls.update(); if(renderer&&scene&&camera)renderer.render(scene,camera); else{console.error("Render components missing!");stopGameLoop();} }
function startGameLoop() { if(animationFrameId!==null)return; console.log("MAIN: Starting client render loop."); clock=new THREE.Clock(); gameLoop(); }
function stopGameLoop() { if(animationFrameId!==null){cancelAnimationFrame(animationFrameId); animationFrameId=null; console.log("MAIN: Stopped client render loop.");} }
export function handleRestart() { window.location.href = '/'; }

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);
// --- Export socket ---
export { socket }; // Export for other modules like messageHandler, controlsHandlers