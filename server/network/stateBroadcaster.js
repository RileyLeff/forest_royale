// server/network/stateBroadcaster.js

function getSimplifiedGameStateSnapshot(players, globalState) {
    const playersSnapshot = {};
    Object.values(players).forEach(p => {
        playersSnapshot[p.id] = {
            id: p.id,
            playerName: p.playerName,
            isAlive: p.isAlive,
            hasChosenSpawn: p.hasChosenSpawn, // Include spawn status for lobby UI
            carbonStorage: p.carbonStorage,
            hydraulicSafety: p.hydraulicSafety,
            maxHydraulic: p.maxHydraulic,
            currentLA: p.currentLA,
            trunkHeight: p.trunkHeight,
            damagedLAPercentage: p.damagedLAPercentage,
            seedCount: p.seedCount,
            spawnPoint: p.spawnPoint
        };
    });

    return {
        // Global environment
        day: globalState.day,
        timeInCycle: globalState.timeInCycle,
        currentPeriodIndex: globalState.currentPeriodIndex,
        isNight: globalState.isNight,
        currentLightMultiplier: globalState.currentLightMultiplier,
        currentDroughtFactor: globalState.currentDroughtFactor,
        isRaining: globalState.isRaining,
        // Game Phase & Countdown
        gamePhase: globalState.gamePhase,
        countdownTimer: globalState.countdownTimer, // Include countdown timer
        // Player states
        players: playersSnapshot,
        serverTime: Date.now()
    };
}

export function getFullGameStateSnapshot(players, globalState) {
    return getSimplifiedGameStateSnapshot(players, globalState);
}

export function broadcastGameState(io, players, globalState) {
    const snapshot = getSimplifiedGameStateSnapshot(players, globalState);
    io.emit('gameStateUpdate', snapshot);
}