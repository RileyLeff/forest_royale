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
// Import state getters/setters needed here
import { getGlobalState, getAllPlayers, setGamePhase, getPlayerState } from './game/GameState.js';
import { resetGame } from './game/gameLogic.js'; // Import resetGame
import * as Config from './config.js'; // Import server config for startGame

// --- Configuration & Setup ---
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "defaultAdminPass123"; // Use env var or fallback
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

// --- Admin Tracking (Simple Set for authorized socket IDs) ---
// Export so connection handler can potentially use it or add to it
export const adminSockets = new Set();

// --- Express Routes & Static Files ---
console.log(`Serving static files from: ${clientPath}`);
app.use(express.static(clientPath));

app.get('/', (req, res) => { res.sendFile(path.join(clientPath, 'index.html')); });
app.get('/game', (req, res) => { res.sendFile(path.join(clientPath, 'game.html')); });
app.get('/settings', (req, res) => { res.sendFile(path.join(clientPath, 'settings.html')); });

// +++ Admin Route +++
app.get('/admin', (req, res) => {
    const providedPassword = req.query.pw; // Get password from query param ?pw=...
    if (providedPassword && providedPassword === ADMIN_PASSWORD) {
        console.log("Admin access granted via HTTP route.");
        // Serve the admin HTML page
        res.sendFile(path.join(clientPath, 'admin.html'));
        // Note: We mark the socket as admin upon WebSocket authentication now
    } else {
        console.log("Admin access denied. Incorrect or missing password.");
        res.status(403).send('Forbidden: Incorrect Admin Password');
    }
});

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

    // 2. Broadcast Updated State to Clients (always broadcast)
    broadcastGameState(io, players, globalState);
}

// --- Simulation Control Functions (Exported for use by other modules) ---

/**
 * Starts the main game simulation loop and transitions players to the playing state.
 * Ensures players are marked alive and have spawn points assigned if needed.
 * Idempotent: safe to call even if game is already playing.
 */
export function startGame() {
    const globalState = getGlobalState();
    const players = getAllPlayers();

    // --- Phase Check & Set ---
    // Allow starting from 'lobby', 'countdown', or if already 'playing'
    if (!['lobby', 'countdown', 'playing'].includes(globalState.gamePhase)) {
        console.warn(`Server: startGame called with invalid phase: ${globalState.gamePhase}. Aborting.`);
        return;
    }
    // Ensure phase is set to 'playing'
    if (globalState.gamePhase !== 'playing') {
         console.log(`Server: startGame - Setting phase to 'playing' (was ${globalState.gamePhase}).`);
         setGamePhase('playing');
    } else {
        console.log("Server: startGame called when already playing (ensuring loop runs).");
    }

    // --- Prepare Players ---
    let playersToStartCount = 0;
    let activePlayersFound = false; // Track if we find anyone to actually start
    Object.values(players).forEach(p => {
        const playerState = getPlayerState(p.id); // Get potentially updated state
        if (playerState) {
            if (playerState.isSpectator) { // Skip spectators
                playerState.isAlive = false; return;
            }
            activePlayersFound = true; // Found at least one non-spectator

            // Assign spawn ONLY if they haven't chosen AND game wasn't already playing
            if (!playerState.hasChosenSpawn && globalState.gamePhase !== 'playing') { // Condition modified slightly, maybe not needed if logic ensures phase is now 'playing'? Let's keep for safety on first start.
                 console.warn(`Server: Player ${p.id} starting without chosen spawn! Assigning default offset.`);
                 const activePlayersList = Object.values(players).filter(pl => !pl.isSpectator);
                 const index = activePlayersList.findIndex(ap => ap.id === p.id);
                 const activePlayerCount = activePlayersList.length || 1;
                 const angle = (index / activePlayerCount) * Math.PI * 2; const radius = 5 + Math.random() * 5;
                 const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                 playerState.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) };
                 playerState.hasChosenSpawn = true;
             } else if (!playerState.spawnPoint) {
                 // Safety: If somehow spawnPoint is missing even if chosen, assign default
                 console.error(`Server: Player ${p.id} missing spawnPoint in startGame! Assigning default.`);
                  const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
                  playerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; // Fallback to center
             }

             // Mark player alive
             if (!playerState.isAlive) { playerState.isAlive = true; console.log(`Server: Marking player ${p.id} alive in startGame.`); }
             console.log(`Server: Player ${p.id} ready/starting at spawn: (${p.spawnPoint?.x?.toFixed(1)}, ${p.spawnPoint?.z?.toFixed(1)})`);
             playersToStartCount++;
        }
    });

    // --- Validation & Simulation Start ---
    if (!activePlayersFound && Object.keys(players).length > 0) { // If only spectators were connected
        console.log("Server: startGame - Only spectators present. Resetting to lobby.");
        resetGame(); return;
    }
    if (playersToStartCount === 0 && activePlayersFound) { // If active players exist but none ended up marked alive?
         console.error("Server: startGame - Active players found, but none started? Resetting.");
         resetGame(); return;
    }

    // Start the interval ONLY if it's not already running
    if (!simulationInterval) {
        console.log(`Server: Starting simulation loop interval for ${playersToStartCount} active players.`);
        lastTickTime = Date.now();
        simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);
    } else {
        console.log("Server: Simulation loop already running.");
    }

    // Broadcast the state immediately after setup
    broadcastGameState(io, players, getGlobalState());
}


/** Stops the main game simulation loop. */
export function stopSimulation() {
    if (simulationInterval) {
        console.log("Server: Stopping simulation loop interval.");
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    // else { console.log("Server: Simulation loop already stopped."); } // Reduce noise
}

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Admin access requires query param: ?pw=${ADMIN_PASSWORD}`); // Log hint
    resetGame(); // Ensure initial state is lobby on server start
});