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
import { getGlobalState, getAllPlayers, setGamePhase, getPlayerState } from './game/GameState.js'; // Import state getters/setters
import { resetGame } from './game/gameLogic.js'; // Import resetGame
import * as Config from './config.js'; // Import server config for startGame

// --- Configuration & Setup ---
const PORT = process.env.PORT || 3000;
const TICK_RATE = 20; // Updates per second
const TICK_INTERVAL_MS = 1000 / TICK_RATE;

// ES Module path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPath = path.join(__dirname, '..', 'client'); // Path to client files

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

app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});
app.get('/game', (req, res) => {
    res.sendFile(path.join(clientPath, 'game.html'));
});
app.get('/settings', (req, res) => {
    res.sendFile(path.join(clientPath, 'settings.html'));
});
// TODO: Add /admin route later

// --- Socket.IO Setup ---
io.on('connection', (socket) => {
    handleConnection(socket, io); // Delegate connection handling
});

// --- Main Simulation Loop Function ---
function runGameTick() {
    const now = Date.now();
    // Prevent large deltaTime jumps if server lags or loop stops/restarts
    const deltaTime = Math.min((now - lastTickTime) / 1000.0, 1.0 / TICK_RATE * 5); // Max delta = 5 ticks
    lastTickTime = now;

    // Get current state
    const globalState = getGlobalState();
    const players = getAllPlayers();

    // 1. Update Game Simulation State (only if playing)
    if (globalState.gamePhase === 'playing') {
        updateSimulationTick(deltaTime, io); // Pass io instance
    }

    // 2. Broadcast Updated State to Clients (always broadcast to sync lobby/countdown/ended)
    broadcastGameState(io, players, globalState);
}

// --- Simulation Control Functions (Exported for use by other modules) ---

/**
 * Starts the main game simulation loop and transitions players to the playing state.
 * Called by gameLogic after countdown finishes.
 */
export function startGame() {
    const globalState = getGlobalState();
    const players = getAllPlayers();

    if (globalState.gamePhase !== 'countdown') {
        console.warn(`Server: startGame called but phase is not 'countdown' (Phase: ${globalState.gamePhase}). Aborting.`);
        // Maybe force phase back to lobby if something went wrong?
        // resetGame();
        return;
    }

    console.log("Server: Starting Game!");
    setGamePhase('playing'); // Set the final phase

    // Prepare players for the game start
    Object.values(players).forEach((p, index) => {
        // Only transition players who are still connected and haven't died somehow
        // Mark player as alive
        p.isAlive = true;
        // Assign spawn point (use default centered/offset logic for now)
        // TODO: Use player's chosen spawn point if available (Phase 4.2)
        const angle = (index / Object.keys(players).length) * Math.PI * 2;
        const radius = 5 + Math.random() * 5; // Add some randomness to radius
        const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
        p.spawnPoint = {
            x: radius * Math.cos(angle),
            y: baseHeight,
            z: radius * Math.sin(angle)
        };
         console.log(`Server: Player ${p.id} starting game. Spawn: ${p.spawnPoint.x.toFixed(1)}, ${p.spawnPoint.z.toFixed(1)}`);
        // Reset any per-round state if needed (e.g., maybe reset resources?) - currently done in initializePlayerState

    });


    // Start the simulation loop interval if not already running (shouldn't be)
    if (simulationInterval) {
        console.warn("Server: startGame called but simulationInterval already exists. Clearing old one.");
        clearInterval(simulationInterval);
    }
    console.log("Server: Starting simulation loop interval.");
    lastTickTime = Date.now(); // Reset timer for accurate first delta
    simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);

    // Broadcast the initial 'playing' state immediately
    broadcastGameState(io, players, globalState);
}

/** Stops the main game simulation loop. */
export function stopSimulation() {
    if (simulationInterval) {
        console.log("Server: Stopping simulation loop interval.");
        clearInterval(simulationInterval);
        simulationInterval = null;
    } else {
         console.log("Server: Simulation loop already stopped.");
    }
}

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Ensure game state is lobby on initial server start
    resetGame();
});