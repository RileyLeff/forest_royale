// client/gameState.js
import * as Config from './config.js';

export const gameState = {
    // --- Server Synced State ---
    day: 1, timeInCycle: 0.0, currentPeriodIndex: -1, isNight: false,
    currentLightMultiplier: 1.0, currentDroughtFactor: Config.DROUGHT_MULT_BASE,
    isRaining: false, gamePhase: 'loading', players: {}, serverTime: Date.now(),
    countdownTimer: null,

    // --- Client-Specific State ---
    myId: null,
    isSpectator: false, // <<< Ensure this exists, defaults to false
    gameOver: false, gameOverReason: '', winnerId: null,
    playerTrees: new Map(),
    initialStateReceived: false,
};

export function loadClientSettings() {
    console.log("Client settings loaded (placeholder).");
}
loadClientSettings();

export function getMyPlayerState() {
    if (!gameState.myId || !gameState.players[gameState.myId]) return null;
    return gameState.players[gameState.myId];
}