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
const TICK_RATE = 20; // Updates per second
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
    broadcastGameState(io, players, globalState);
}

// --- Simulation Control Functions (Exported) ---

/**
 * Starts the main game simulation loop and ensures players are ready.
 * Called by gameLogic after countdown OR by connection handler for single player.
 */
export function startGame() {
    const globalState = getGlobalState();
    const players = getAllPlayers();

    // Allow starting if phase is 'countdown' (normal multiplayer flow)
    // OR if phase was just set to 'playing' (single-player start flow)
    if (globalState.gamePhase !== 'countdown' && globalState.gamePhase !== 'playing') {
        console.warn(`Server: startGame called with invalid phase: ${globalState.gamePhase}. Aborting.`);
        // Maybe force reset?
        // resetGame();
        return;
    }
    // If called during countdown, ensure phase is set to playing
    if (globalState.gamePhase === 'countdown') {
         console.log("Server: Starting game from countdown.");
         setGamePhase('playing');
    } else {
         console.log("Server: Starting game (phase already set to playing - likely single player).");
    }


    // Prepare players (ensure they are alive and have spawn points)
    // This might be slightly redundant if connection handler already did it, but safe to ensure
    Object.values(players).forEach((p, index) => {
        if (!p.isAlive) { // Only mark alive and assign spawn if not already done
            p.isAlive = true;
            console.log(`Server: Marking player ${p.id} alive in startGame.`);
            // Assign spawn point if missing (should have been set by connection handler ideally)
            if (!p.spawnPoint || p.spawnPoint.x === undefined) {
                 console.warn(`Server: Player ${p.id} missing spawn point in startGame, assigning default offset.`);
                 const angle = (index / Object.keys(players).length) * Math.PI * 2;
                 const radius = 5 + Math.random() * 5;
                 const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 p.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) };
            }
        }
    });

    // Start the simulation loop interval if not already running
    if (simulationInterval) {
        console.warn("Server: startGame called but simulationInterval already exists. Clearing old one.");
        clearInterval(simulationInterval);
        simulationInterval = null; // Ensure it's null before starting new one
    }
    console.log("Server: Starting simulation loop interval.");
    lastTickTime = Date.now();
    simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);

    // Broadcast the initial 'playing' state immediately
    // (Connection handler already sent one, but another ensures client has latest player setup)
    broadcastGameState(io, players, getGlobalState());
}

/** Stops the main game simulation loop. */
export function stopSimulation() {
    if (simulationInterval) {
        console.log("Server: Stopping simulation loop interval.");
        clearInterval(simulationInterval);
        simulationInterval = null;
    } else {
         // console.log("Server: Simulation loop already stopped."); // Reduce noise
    }
}

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    resetGame(); // Ensure initial state is lobby on server start
});