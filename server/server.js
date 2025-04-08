// server/server.js (Main Entry Point)

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Server Modules
import { handleConnection } from './network/connection.js';
// import { updateSimulationTick } from './game/simulation.js'; // Simulation logic now within GameInstance
// import { broadcastGameState, getFullGameStateSnapshot } from './network/stateBroadcaster.js'; // Broadcasting handled by GameInstance
// import { getGlobalState, getAllPlayers, setGamePhase, getPlayerState } from './game/GameState.js'; // State now managed by instances
// import { resetGame, cancelLobbyCountdown } from './game/gameLogic.js'; // Game logic now within GameInstance
import { GameInstanceManager } from './game/GameInstanceManager.js'; // <<< Import the Manager
import * as Config from './config.js';

// --- Configuration & Setup ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "defaultAdminPass123";
// const TICK_RATE = 20; // Tick rate is now a Config property used by GameInstance
// const TICK_INTERVAL_MS = 1000 / TICK_RATE; // Calculated within GameInstance

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
// let simulationInterval = null; // <<< REMOVED - Handled by GameInstance(s)
// let lastTickTime = Date.now(); // <<< REMOVED - Handled by GameInstance(s)

// --- Instantiate Game Instance Manager ---
const gameInstanceManager = new GameInstanceManager(io); // <<< Create the manager instance

// --- Admin Tracking ---
// This might still be useful globally or move into the manager? Keep global for now.
export const adminSockets = new Set();

// --- Express Routes & Static Files ---
console.log(`Serving static files from: ${clientPath}`);
app.use(express.static(clientPath));

app.get('/', (req, res) => { res.sendFile(path.join(clientPath, 'index.html')); });
app.get('/game', (req, res) => { res.sendFile(path.join(clientPath, 'game.html')); });
app.get('/settings', (req, res) => { res.sendFile(path.join(clientPath, 'settings.html')); });

app.get('/admin', (req, res) => {
    const providedPassword = req.query.pw;
    if (providedPassword && providedPassword === ADMIN_PASSWORD) {
        console.log("Admin access granted via HTTP route.");
        res.sendFile(path.join(clientPath, 'admin.html'));
    } else {
        console.log("Admin access denied. Incorrect or missing password.");
        res.status(403).send('Forbidden: Incorrect Admin Password');
    }
});

// --- Socket.IO Setup ---
io.on('connection', (socket) => {
    // Pass the instance manager to the connection handler
    handleConnection(socket, io, gameInstanceManager); // <<< Pass manager instance
});

// --- Main Simulation Loop Function ---
// function runGameTick() { ... } // <<< REMOVED - Logic moved to GameInstance.runTick()

// --- Simulation Control Functions ---
// These might become helper functions or move entirely into GameInstance/Manager
// For now, remove the export as they are not called globally anymore.
// export function startGame() { ... } // <<< REMOVED (or commented out)
// export function stopSimulation() { ... } // <<< REMOVED (or commented out)


// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Admin access requires query param: ?pw=${ADMIN_PASSWORD}`);
    // No global reset needed here, manager handles instance creation/state
    // resetGame(); // <<< REMOVED
});