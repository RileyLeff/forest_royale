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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "defaultAdminPass123"; // Use env var or fallback
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

// --- Admin Tracking (Simple Set for authorized socket IDs) ---
export const adminSockets = new Set(); // Export so connection handler can potentially use it

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
        // We'll handle associating the socket connection later
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
function runGameTick() { /* ... simulation tick logic ... */
    const now = Date.now(); const deltaTime = Math.min((now - lastTickTime) / 1000.0, 1.0 / TICK_RATE * 5); lastTickTime = now; const globalState = getGlobalState(); const players = getAllPlayers();
    if (globalState.gamePhase === 'playing') updateSimulationTick(deltaTime, io);
    broadcastGameState(io, players, globalState); // Always broadcast
}

// --- Simulation Control Functions (Exported) ---
/** Starts the main game simulation loop and transitions players to the playing state. */
export function startGame() { /* ... startGame logic (unchanged from previous step) ... */
    const globalState = getGlobalState(); const players = getAllPlayers();
    if (globalState.gamePhase !== 'countdown' && globalState.gamePhase !== 'playing') { console.warn(`Server: startGame called invalid phase: ${globalState.gamePhase}. Aborting.`); return; }
    if (globalState.gamePhase === 'countdown') { console.log("Server: Starting game from countdown."); setGamePhase('playing'); } else { console.log("Server: Starting game (phase already playing)."); }
    let playersToStartCount = 0;
    Object.values(players).forEach(p => { const playerState = getPlayerState(p.id); if (playerState) { if (playerState.isSpectator) { playerState.isAlive = false; return; } if (!playerState.hasChosenSpawn) { console.warn(`Server: Player ${p.id} starting without chosen spawn! Assigning default.`); const activePlayers=Object.values(players).filter(pl=>!pl.isSpectator); const index=activePlayers.findIndex(ap=>ap.id===p.id); const activePlayerCount=activePlayers.length||1; const angle=(index/activePlayerCount)*Math.PI*2; const radius=5+Math.random()*5; const baseHeight=Config.ISLAND_LEVEL!==undefined?Config.ISLAND_LEVEL:0.1; playerState.spawnPoint={x:radius*Math.cos(angle),y:baseHeight,z:radius*Math.sin(angle)}; playerState.hasChosenSpawn = true; } if (!playerState.isAlive) { playerState.isAlive = true; console.log(`Server: Marking player ${p.id} alive.`); } console.log(`Server: Player ${p.id} starting at spawn: (${p.spawnPoint.x.toFixed(1)}, ${p.spawnPoint.z.toFixed(1)})`); playersToStartCount++; } });
    if (playersToStartCount === 0 && !Object.values(players).some(p => p.isSpectator)) { console.error("Server: startGame called, no active players. Resetting."); resetGame(); return; }
    if (playersToStartCount === 0 && Object.values(players).some(p => p.isSpectator)) { console.log("Server: startGame called, only spectators present. Resetting."); resetGame(); return; }
    if (simulationInterval) { console.warn("Server: startGame clear old interval."); clearInterval(simulationInterval); simulationInterval = null; }
    console.log(`Server: Starting simulation loop interval for ${playersToStartCount} players.`); lastTickTime = Date.now(); simulationInterval = setInterval(runGameTick, TICK_INTERVAL_MS);
    broadcastGameState(io, players, getGlobalState());
}
/** Stops the main game simulation loop. */
export function stopSimulation() { /* ... stop logic ... */ if (simulationInterval) { console.log("Server: Stopping simulation loop interval."); clearInterval(simulationInterval); simulationInterval = null; } }

// --- Start HTTP Server ---
httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Admin access requires query param: ?pw=${ADMIN_PASSWORD}`); // Log hint
    resetGame(); // Ensure initial state is lobby on server start
});