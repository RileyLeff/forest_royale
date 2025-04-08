// server/server.js (Main Entry Point)

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Server Modules
import { handleConnection } from './network/connection.js';
import { updateSimulationTick } from './game/simulation.js';
import { broadcastGameState, getFullGameStateSnapshot } from './network/stateBroadcaster.js';
import { getGlobalState, getAllPlayers, setGamePhase, getPlayerState } from './game/GameState.js';
import { resetGame } from './game/gameLogic.js';
import * as Config from './config.js';

// --- Configuration & Setup ---
const PORT = process.env.PORT || 3000;
const TICK_RATE = 20;
const TICK_INTERVAL_MS = 1000 / TICK_RATE;

// ES Module path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPath = path.join(__dirname, '..', 'client');

// Express and HTTP Server
const app = express();
const httpServer = http.createServer(app);

// Socket.IO Server
const io = new SocketIOServer(httpServer);

// --- Simulation Loop State ---
let simulationInterval = null;
let lastTickTime = Date.now();

// --- Express Routes & Static Files ---
console.log(`Serving static files from: ${clientPath}`);
app.use(express.static(clientPath));
app.get('/', (req, res) => { res.sendFile(path.join(clientPath, 'index.html')); });
app.get('/game', (req, res) => { res.sendFile(path.join(clientPath, 'game.html')); });
app.get('/settings', (req, res) => { res.sendFile(path.join(clientPath, 'settings.html')); });

// --- Socket.IO Setup ---
io.on('connection', (socket) => { handleConnection(socket, io); });

// --- Main Simulation Loop Function ---
function runGameTick() {
    const now = Date.now();
    const deltaTime = Math.min((now - lastTickTime) / 1000.0, 1.0 / TICK_RATE * 5);
    lastTickTime = now;
    const globalState = getGlobalState();
    const players = getAllPlayers();
    if (globalState.gamePhase === 'playing') {
        updateSimulationTick(deltaTime, io);
    }
    // Always broadcast state to keep lobby/countdown/ended phases synced
    broadcastGameState(io, players, globalState);
}

// --- Simulation Control Functions (Exported) ---

/** Starts the main game simulation loop and transitions players to the playing state. */
export function startGame() {
    const globalState = getGlobalState();
    const players = getAllPlayers();

    if (globalState.gamePhase !== 'countdown' && globalState.gamePhase !== 'playing') {
        console.warn(`Server: startGame called with invalid phase: ${globalState.gamePhase}. Aborting.`);
        return;
    }
    if (globalState.gamePhase === 'countdown') {
         console.log("Server: Starting game from countdown.");
         setGamePhase('playing');
    } else {
         console.log("Server: Starting game (phase already playing - likely single player).");
    }

    // Prepare players for the game start
    let playersToStartCount = 0;
    Object.values(players).forEach(p => {
        // Only start players who are currently connected (state exists)
        // And haven't somehow died before start
        if (getPlayerState(p.id)) { // Check player still exists in state map
             if (!p.hasChosenSpawn) {
                 console.warn(`Server: Player ${p.id} starting game without chosen spawn! Assigning default offset.`);
                 const index = Object.keys(players).indexOf(p.id);
                 const angle = (index / Object.keys(players).length) * Math.PI * 2;
                 const radius = 5 + Math.random() * 5;
                 const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 p.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) };
                 p.hasChosenSpawn = true;
             }
             // Ensure player is marked alive
             if (!p.isAlive) {
                 p.isAlive = true;
                 console.log(`Server: Marking player ${p.id} alive in startGame.`);
             }
             console.log(`Server: Player ${p.id} starting game at spawn: (${p.spawnPoint.x.toFixed(1)}, ${p.spawnPoint.z.toFixed(1)})`);
             playersToStartCount++;
        }
    });

    if (playersToStartCount === 0) {
        console.error("Server: startGame called, but no valid players found to start. Resetting to lobby.");
        resetGame();
        return;
    }

    // Start the simulation loop interval if not already running
    if (simulationInterval) {
        console.warn("Server: startGame called but simulationInterval already exists. Clearing old one.");
        clearInterval(simulationInterval); simulationInterval = null;
    }
    console.log("Server: Starting simulation loop interval.");
    lastTickTime = Date.now();
    simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);

    // Broadcast the initial 'playing' state immediately
    broadcastGameState(io, players, getGlobalState());
}

/** Stops the main game simulation loop. */
export function stopSimulation() {
    if (simulationInterval) { console.log("Server: Stopping simulation loop interval."); clearInterval(simulationInterval); simulationInterval = null; }
    // else { console.log("Server: Simulation loop already stopped."); } // Reduce noise
}

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    resetGame(); // Ensure initial state is lobby on server start
});