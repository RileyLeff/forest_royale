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
import { getGlobalState, getAllPlayers } from './game/GameState.js'; // Import state getters

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
const httpServer = http.createServer(app); // Rename to avoid confusion with server concept

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
    const deltaTime = (now - lastTickTime) / 1000.0; // Delta time in seconds
    lastTickTime = now;

    // 1. Update Game Simulation State
    updateSimulationTick(deltaTime, io); // Pass io instance if needed (e.g., for endGame)

    // 2. Broadcast Updated State to Clients
    // Avoid broadcasting if not playing? Or broadcast always so clients see lobby/ended state? Broadcast always.
    broadcastGameState(io, getAllPlayers(), getGlobalState());
}

// --- Simulation Control Functions (Exported for use by other modules) ---

/** Starts the main game simulation loop. */
export function startGame() {
    if (simulationInterval) {
        console.log("Server: Simulation loop already running.");
        return;
    }
    console.log("Server: Starting simulation loop.");
    lastTickTime = Date.now(); // Reset start time for accurate delta on first tick
    simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);
}

/** Stops the main game simulation loop. */
export function stopSimulation() {
    if (simulationInterval) {
        console.log("Server: Stopping simulation loop.");
        clearInterval(simulationInterval);
        simulationInterval = null;
    } else {
         console.log("Server: Simulation loop already stopped.");
    }
}

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    // Simulation is NOT started automatically here.
    // It's started by the connection logic when the first player joins.
});