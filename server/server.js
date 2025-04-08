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
import { resetGame, cancelLobbyCountdown } from './game/gameLogic.js'; // Import resetGame & cancelLobbyCountdown
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
    let players = getAllPlayers(); // Get latest player list

    // --- Phase Check & Set ---
    const wasCountdown = globalState.gamePhase === 'countdown';
    if (wasCountdown) {
        cancelLobbyCountdown(); // Ensure countdown interval is stopped if we came from countdown
    }

    if (!['lobby', 'countdown', 'playing'].includes(globalState.gamePhase)) {
        console.warn(`Server: startGame called with invalid phase: ${globalState.gamePhase}. Aborting.`);
        return;
    }

    console.log(`Server: startGame - Setting phase to 'playing' (was ${globalState.gamePhase}).`);
    setGamePhase('playing'); // Set phase definitively

    // --- Prepare Players ---
    let activePlayersFound = false; // Track if we find anyone to actually start playing
    let playersMarkedAliveCount = 0;

    // Refetch players just in case state changed during phase set? Unlikely but safe.
    players = getAllPlayers();

    Object.values(players).forEach(playerState => {
        // *** CRITICAL: Skip spectators and admins entirely ***
        if (playerState.isSpectator) {
            playerState.isAlive = false; // Ensure spectators are marked dead
            console.log(`Server/startGame: Skipping spectator/admin ${playerState.id}.`);
            return; // Move to next player
        }

        // If we reach here, it's a potential active player
        activePlayersFound = true;

        // Assign spawn ONLY if they haven't chosen one yet
        if (!playerState.hasChosenSpawn) {
             console.warn(`Server/startGame: Player ${playerState.id} starting without chosen spawn! Assigning default offset.`);
             // Use a deterministic but varied approach based on existing players
             const activePlayersList = Object.values(players).filter(pl => !pl.isSpectator);
             const index = activePlayersList.findIndex(ap => ap.id === playerState.id);
             const activePlayerCount = activePlayersList.length || 1; // Avoid division by zero
             const angle = (index / activePlayerCount) * Math.PI * 2 + Math.random()*0.1; // Add slight randomness
             const radius = 5 + Math.random() * 5;
             const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
             playerState.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) };
             playerState.hasChosenSpawn = true; // Mark as chosen now
         } else if (!playerState.spawnPoint) {
             // Safety: If somehow spawnPoint is missing even if chosen, assign default
             console.error(`Server/startGame: Player ${playerState.id} missing spawnPoint but hasChosenSpawn=true! Assigning default.`);
              const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
              playerState.spawnPoint = { x: 0, y: baseHeight, z: 0 }; // Fallback to center
         }

         // Mark player alive if they aren't already
         // This handles players joining lobby -> countdown -> playing
         if (!playerState.isAlive) {
             playerState.isAlive = true;
             console.log(`Server/startGame: Marking player ${playerState.id} alive.`);
             playersMarkedAliveCount++;
         } else {
              console.log(`Server/startGame: Player ${playerState.id} was already alive.`);
              playersMarkedAliveCount++; // Still counts as an active player starting
         }

         // Reset per-cycle flags
         playerState.growthAppliedThisCycle = false;
         playerState.foliarUptakeAppliedThisNight = false;

         console.log(`Server/startGame: Player ${playerState.id} ready/starting at spawn: (${playerState.spawnPoint?.x?.toFixed(1)}, ${playerState.spawnPoint?.z?.toFixed(1)})`);
    });

    // --- Validation & Simulation Start ---
    if (!activePlayersFound) {
        console.log("Server/startGame: No active (non-spectator) players found. Resetting to lobby.");
        resetGame(); // This sets phase to lobby and broadcasts
        return; // Stop startGame execution
    }

    // Start the interval ONLY if it's not already running
    if (!simulationInterval) {
        console.log(`Server: Starting simulation loop interval for ${playersMarkedAliveCount} active players.`);
        lastTickTime = Date.now();
        simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);
    } else {
        console.log("Server: Simulation loop already running.");
    }

    // Broadcast the 'playing' state immediately after setup
    // Need latest state as player isAlive/spawnPoint might have changed
    broadcastGameState(io, getAllPlayers(), getGlobalState());
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