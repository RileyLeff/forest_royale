// server/game/GameInstance.js
import { v4 as uuidv4 } from 'uuid';
import * as Config from '../config.js'; // Import the config

// *** Constants (Keep as before) ***
const TICK_RATE = Config.TICK_RATE !== undefined ? Config.TICK_RATE : 20;
const COUNTDOWN_DURATION = Config.COUNTDOWN_DURATION !== undefined ? Config.COUNTDOWN_DURATION : 5;
const ISLAND_LEVEL = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
const INITIAL_LEAF_AREA = Config.INITIAL_LEAF_AREA !== undefined ? Config.INITIAL_LEAF_AREA : 5;
const BASE_HYDRAULIC = Config.BASE_HYDRAULIC !== undefined ? Config.BASE_HYDRAULIC : 50;
const HYDRAULIC_SCALE_PER_LA = Config.HYDRAULIC_SCALE_PER_LA !== undefined ? Config.HYDRAULIC_SCALE_PER_LA : 10;
const INITIAL_CARBON = Config.INITIAL_CARBON !== undefined ? Config.INITIAL_CARBON : 100;
const INITIAL_HYDRAULICS = Config.INITIAL_HYDRAULICS !== undefined ? Config.INITIAL_HYDRAULICS : 100;
const INITIAL_TRUNK_HEIGHT = Config.INITIAL_TRUNK_HEIGHT !== undefined ? Config.INITIAL_TRUNK_HEIGHT : 2;
const k_TA_LA_RATIO = Config.k_TA_LA_RATIO !== undefined ? Config.k_TA_LA_RATIO : 0.01;
const MAX_CARBON = Config.MAX_CARBON !== undefined ? Config.MAX_CARBON : 200;
const PHOTOSYNTHESIS_RATE_PER_LA = Config.PHOTOSYNTHESIS_RATE_PER_LA !== undefined ? Config.PHOTOSYNTHESIS_RATE_PER_LA : 0.5;
const RESPIRATION_RATE_PER_LA = Config.RESPIRATION_RATE_PER_LA !== undefined ? Config.RESPIRATION_RATE_PER_LA : 0.02;
const RESPIRATION_RATE_PER_TRUNK_VOL = Config.RESPIRATION_RATE_PER_TRUNK_VOL !== undefined ? Config.RESPIRATION_RATE_PER_TRUNK_VOL : 0.01;
const TRANSPIRATION_RATE_PER_LA = Config.TRANSPIRATION_RATE_PER_LA !== undefined ? Config.TRANSPIRATION_RATE_PER_LA : 0.4;
const HYDRAULIC_RECOVERY_RATE = Config.HYDRAULIC_RECOVERY_RATE !== undefined ? Config.HYDRAULIC_RECOVERY_RATE : 2;
const RAIN_RECOVERY_BONUS_MULT = Config.RAIN_RECOVERY_BONUS_MULT !== undefined ? Config.RAIN_RECOVERY_BONUS_MULT : 3.0;
const HYDRAULIC_DAMAGE_THRESHOLD = Config.HYDRAULIC_DAMAGE_THRESHOLD !== undefined ? Config.HYDRAULIC_DAMAGE_THRESHOLD : 20;
const CROWN_DIEBACK_RATE = Config.CROWN_DIEBACK_RATE !== undefined ? Config.CROWN_DIEBACK_RATE : 0.05;
const NIGHT_RAIN_HYDRAULIC_BOOST = Config.NIGHT_RAIN_HYDRAULIC_BOOST !== undefined ? Config.NIGHT_RAIN_HYDRAULIC_BOOST : 20.0;
const GROWTH_OFFSET_NIGHT = Config.GROWTH_OFFSET_NIGHT !== undefined ? Config.GROWTH_OFFSET_NIGHT : 1.5;
const SEED_COST = Config.SEED_COST !== undefined ? Config.SEED_COST : 1;
const GROWTH_COST_PER_LA = Config.GROWTH_COST_PER_LA !== undefined ? Config.GROWTH_COST_PER_LA : 5;
const TOTAL_CYCLE_DURATION = Config.TOTAL_CYCLE_DURATION !== undefined ? Config.TOTAL_CYCLE_DURATION : 24.0;
const DAY_TOTAL_DURATION = Config.DAY_TOTAL_DURATION !== undefined ? Config.DAY_TOTAL_DURATION : 21.0;
const PERIOD_DURATION = Config.PERIOD_DURATION !== undefined ? Config.PERIOD_DURATION : 7.0;
const SUNNY_PROB = Config.SUNNY_PROB !== undefined ? Config.SUNNY_PROB : 2.0/3.0;
const RAIN_PROB_IF_CLOUDY = Config.RAIN_PROB_IF_CLOUDY !== undefined ? Config.RAIN_PROB_IF_CLOUDY : 0.5;
const LIGHT_MULT_SUNNY = Config.LIGHT_MULT_SUNNY !== undefined ? Config.LIGHT_MULT_SUNNY : 1.0;
const LIGHT_MULT_CLOUDY = Config.LIGHT_MULT_CLOUDY !== undefined ? Config.LIGHT_MULT_CLOUDY : 0.4;
const DROUGHT_MULT_BASE = Config.DROUGHT_MULT_BASE !== undefined ? Config.DROUGHT_MULT_BASE : 1.0;
const DROUGHT_VARIATION = Config.DROUGHT_VARIATION !== undefined ? Config.DROUGHT_VARIATION : 0.4;


// --- Functions (createInitialPlayerState, createInitialInstanceState - unchanged) ---
function createInitialPlayerState(socketId) {
    const initialLA = INITIAL_LEAF_AREA; const baseHeight = ISLAND_LEVEL; const maxHydraulic = BASE_HYDRAULIC + HYDRAULIC_SCALE_PER_LA * initialLA;
    return {
        id: socketId,
        playerName: `Player_${socketId.substring(0, 4)}`,
        leafColor: '#228B22', trunkColor: '#8B4513',
        spawnPoint: { x: 0, y: baseHeight, z: 0 },
        isAlive: false, hasChosenSpawn: false, isSpectator: false, isAI: false,
        carbonStorage: INITIAL_CARBON,
        hydraulicSafety: Math.min(INITIAL_HYDRAULICS, maxHydraulic),
        maxHydraulic: maxHydraulic,
        currentLA: initialLA, effectiveLA: initialLA,
        trunkHeight: INITIAL_TRUNK_HEIGHT,
        trunkWidth: Math.sqrt(initialLA * k_TA_LA_RATIO), trunkDepth: Math.sqrt(initialLA * k_TA_LA_RATIO),
        seedCount: 0, damagedLAPercentage: 0,
        stomatalConductance: 0.5, lastSavingsPercent: 50, lastGrowthRatioPercent: 50,
        foliarUptakeAppliedThisNight: false, growthAppliedThisCycle: false,
    };
}
function createInitialInstanceState() {
   return {
       instanceId: uuidv4(), roomId: null, mode: 'none',
       simulationIntervalId: null, countdownIntervalId: null, lastTickTime: Date.now(),
       day: 1, timeInCycle: 0.0, currentPeriodIndex: -1, isNight: false,
       currentLightMultiplier: LIGHT_MULT_SUNNY, currentDroughtFactor: DROUGHT_MULT_BASE,
       isRaining: false, gamePhase: 'lobby', countdownTimer: null,
       allowPlayerCountdownStart: true, players: new Map(),
       _previousPeriodIndexForWeather: -2,
    };
}


export class GameInstance {
   constructor(mode = 'multi', io) {
       this.state = createInitialInstanceState();
       this.state.mode = mode;
       this.state.roomId = this.state.instanceId;
       this.io = io;
       console.log(`GameInstance created: ID=${this.state.instanceId}, Mode=${this.state.mode}, Room=${this.state.roomId}`);
   }

   // --- Player Management (unchanged) ---
   addPlayer(socket) { if (!socket || this.state.players.has(socket.id)) { return null; } const playerState = createInitialPlayerState(socket.id); this.state.players.set(socket.id, playerState); socket.join(this.state.roomId); return playerState; }
   removePlayer(socketId) { if (this.state.players.has(socketId)) { this.state.players.delete(socketId); return true; } return false; }
   getPlayerState(socketId) { return this.state.players.get(socketId) || null; }
   getAllPlayers() { return this.state.players; }
   getNonSpectatorPlayers() { return Array.from(this.state.players.values()).filter(p => !p.isSpectator && !p.playerName.startsWith('ADMIN_')); }

   // --- State Access/Modification (unchanged) ---
   getSnapshot() {
       const playersSnapshot = {};
       this.state.players.forEach((playerData, playerId) => {
           playersSnapshot[playerId] = {
               id: playerData.id, playerName: playerData.playerName,
               isAlive: playerData.isAlive, hasChosenSpawn: playerData.hasChosenSpawn, isSpectator: playerData.isSpectator,
               carbonStorage: playerData.carbonStorage, hydraulicSafety: playerData.hydraulicSafety, maxHydraulic: playerData.maxHydraulic,
               currentLA: playerData.currentLA, trunkHeight: playerData.trunkHeight, damagedLAPercentage: playerData.damagedLAPercentage,
               seedCount: playerData.seedCount, spawnPoint: playerData.spawnPoint,
               leafColor: playerData.leafColor, trunkColor: playerData.trunkColor
            };
       });
       return {
           instanceId: this.state.instanceId, mode: this.state.mode,
           day: this.state.day, timeInCycle: this.state.timeInCycle, currentPeriodIndex: this.state.currentPeriodIndex,
           isNight: this.state.isNight, currentLightMultiplier: this.state.currentLightMultiplier, currentDroughtFactor: this.state.currentDroughtFactor,
           isRaining: this.state.isRaining, gamePhase: this.state.gamePhase, countdownTimer: this.state.countdownTimer,
           allowPlayerCountdownStart: this.state.allowPlayerCountdownStart,
           players: playersSnapshot, serverTime: Date.now()
        };
   }
   setGamePhase(phase) { if (['lobby', 'countdown', 'playing', 'ended'].includes(phase)) { if (this.state.gamePhase !== phase) { console.log(`GameInstance ${this.state.instanceId}: Changing phase from ${this.state.gamePhase} to ${phase}`); this.state.gamePhase = phase; if (phase !== 'countdown') this.state.countdownTimer = null; if (phase !== 'countdown' && this.state.countdownIntervalId) { this.stopCountdown(); } } } else { console.error(`GameInstance ${this.state.instanceId}: Invalid phase: ${phase}`); } }
   updateStateProperty(key, value) { if (key in this.state) { this.state[key] = value; } else { console.warn(`GameInstance ${this.state.instanceId}: Tried to update unknown property ${key}`); } }

   // --- Simulation Loop Control ---
   startSimulationLoop() {
       if (this.state.simulationIntervalId) {
           // Keep this log, useful for preventing double loops
           console.log(`GameInstance ${this.state.instanceId}: Simulation loop ALREADY running (ID: ${this.state.simulationIntervalId}).`);
           return;
       }
       console.log(`GameInstance ${this.state.instanceId}: === Starting simulation loop ===`); // Keep: Important event
       this.state.lastTickTime = Date.now();
       const tickIntervalMs = 1000 / TICK_RATE;
       this.state.simulationIntervalId = setInterval(() => this.runTick(), tickIntervalMs);
       // Keep this log, useful for confirming start
       console.log(`GameInstance ${this.state.instanceId}: Simulation interval created with ID: ${this.state.simulationIntervalId}, Interval (ms): ${tickIntervalMs}`);
   }

   stopSimulationLoop() {
       // Keep these logs, they show the call stack for unexpected stops
       console.log(`Instance ${this.state.instanceId}: stopSimulationLoop called. Current Interval ID: ${this.state.simulationIntervalId}`);
       const stack = new Error().stack;
       console.log("Call Stack:", stack.substring(stack.indexOf('\n') + 1));

       if (this.state.simulationIntervalId) {
           console.log(`Instance ${this.state.instanceId}: === Stopping simulation loop (ID: ${this.state.simulationIntervalId}) ===`); // Keep: Important event
           clearInterval(this.state.simulationIntervalId);
           this.state.simulationIntervalId = null;
       } else {
            console.log(`Instance ${this.state.instanceId}: stopSimulationLoop called but no active interval ID found.`); // Keep: Informative
       }
   }

   // --- Core Game Logic ---
   runTick() {
       const now = Date.now();
       const prevTickTime = this.state.lastTickTime || now;
       const deltaTime = Math.min((now - prevTickTime) / 1000.0, 1.0 / TICK_RATE * 5);
       const currentPhase = this.state.gamePhase;

       // --- REMOVE/COMMENT OUT Tick Core Values Log ---
       // console.log(`Instance ${this.state.instanceId}: runTick - Phase: ${currentPhase}, Now: ${now}, PrevTick: ${prevTickTime}, Delta: ${deltaTime.toFixed(5)}, IntervalID: ${this.state.simulationIntervalId}`);

       this.state.lastTickTime = now;

       if (deltaTime <= 0 && currentPhase === 'playing') {
           // Keep this warning, it indicates a problem
           console.warn(`Instance ${this.state.instanceId}: runTick DeltaTime is <= 0! (${deltaTime.toFixed(5)}) Skipping tick logic.`);
           return;
       }

       if (currentPhase !== 'playing') {
           // Don't log spam, just return
           return;
       }

       // Store time before update (needed for logic below)
       const timeBeforeUpdate = this.state.timeInCycle;

       // Update global time state
       this.state.timeInCycle += deltaTime;

       this.updateTimeAndWeather(); // Call the update function

       // --- REMOVE/COMMENT OUT Time After Update Log ---
       // console.log(`Instance ${this.state.instanceId}: Time updated from ${timeBeforeUpdate.toFixed(3)} to ${this.state.timeInCycle.toFixed(3)}`);

       // Update player physiology...
       let playersAliveThisTick = 0;
       this.state.players.forEach(playerState => {
           if (!playerState.isAlive || playerState.isSpectator || playerState.playerName.startsWith('ADMIN_')) return;
           this._updatePlayerPhysiology(playerState, deltaTime);
           if ((playerState.carbonStorage <= 0 || playerState.hydraulicSafety <= 0)) {
                playerState.isAlive = false;
           } else {
               playersAliveThisTick++;
           }
       });

        // Check for game end condition
       const activePlayersCount = this.getNonSpectatorPlayers().length;
       if (playersAliveThisTick === 0 && activePlayersCount > 0 && this.state.gamePhase === 'playing') {
            console.log(`Instance ${this.state.instanceId} Tick: All active players dead condition met. Ending game.`); // Keep: Important event
            this.endGame("All trees have perished!");
            return;
       }

       this.broadcastState();
   }

   updateTimeAndWeather() {
       let enteringNewDay = false;
       // Keep this check for bad config values
       if (typeof TOTAL_CYCLE_DURATION !== 'number' || TOTAL_CYCLE_DURATION <= 0 ||
           typeof DAY_TOTAL_DURATION !== 'number' || DAY_TOTAL_DURATION < 0 ||
           typeof PERIOD_DURATION !== 'number' || PERIOD_DURATION <= 0) {
           console.error(`INSTANCE ${this.state.instanceId} ERROR: Invalid time duration constants! Stopping simulation.`, {
               TOTAL_CYCLE_DURATION, DAY_TOTAL_DURATION, PERIOD_DURATION
           });
           this.stopSimulationLoop();
           return;
       }

       const previousTimeInCycle = this.state.timeInCycle; // Still needed for day change logic below

       if (this.state.timeInCycle >= TOTAL_CYCLE_DURATION) {
           enteringNewDay = true;
           this.state.day++;
           this.state.timeInCycle -= TOTAL_CYCLE_DURATION;
           this.state.currentPeriodIndex = 0;
           this.state.isNight = false;
           this.state.players.forEach(p => { p.growthAppliedThisCycle = false; });
           this.state._previousPeriodIndexForWeather = -1;
           console.log(`--- Instance ${this.state.instanceId}: NEW DAY ${this.state.day} Started ---`); // Keep: Important event
       }

       let calculatedPeriodIndex;
       if (this.state.timeInCycle < DAY_TOTAL_DURATION) {
           calculatedPeriodIndex = Math.floor(this.state.timeInCycle / PERIOD_DURATION);
           this.state.isNight = false;
       } else {
           calculatedPeriodIndex = -1; // Night
           this.state.isNight = true;
       }

       const periodChanged = calculatedPeriodIndex !== this.state._previousPeriodIndexForWeather;

       // --- REMOVE/COMMENT OUT Time Advancement Log ---
       // console.log(`Instance ${this.state.instanceId}: updateTime - Time: ${this.state.timeInCycle.toFixed(3)}. Calc Period: ${calculatedPeriodIndex}. State Period: ${this.state.currentPeriodIndex}. Prev Sent Weather Period: ${this.state._previousPeriodIndexForWeather}. Period Changed: ${periodChanged}`);


       if (periodChanged) {
           console.log(`--- Instance ${this.state.instanceId}: Period Changed! New Index: ${calculatedPeriodIndex} (was ${this.state._previousPeriodIndexForWeather}) ---`); // Keep: Important event

           const oldPeriodIndex = this.state._previousPeriodIndexForWeather;
           this.state._previousPeriodIndexForWeather = calculatedPeriodIndex; // Update internal tracker

           // Generate weather for the new period
           if (!this.state.isNight) {
               const isCloudy = this._generatePeriodWeather();
                this.state.isRaining = isCloudy && (Math.random() < RAIN_PROB_IF_CLOUDY);
                // Keep this weather summary log - happens only on change
                console.log(`Instance ${this.state.instanceId}: Day ${this.state.day}, Period ${calculatedPeriodIndex+1} Weather - Cloudy: ${isCloudy}, Raining: ${this.state.isRaining}, Light: ${this.state.currentLightMultiplier.toFixed(2)}, Drought: ${this.state.currentDroughtFactor.toFixed(2)}`);
           } else {
                // Generate night weather only once when transitioning into night
                if (oldPeriodIndex !== -1) {
                   this._generateNightWeather();
                   this.state.players.forEach(p => { p.foliarUptakeAppliedThisNight = false; });
                   console.log(`Instance ${this.state.instanceId}: Entering Night Weather - Raining: ${this.state.isRaining}`); // Keep: Informative
                }
           }
           this.state.currentPeriodIndex = calculatedPeriodIndex;
       }
   }

   // --- Physiology, Weather Gen, Allocation (Internal Helpers - unchanged) ---
   _updatePlayerPhysiology(playerState, deltaTime) {
       const stomata = playerState.stomatalConductance; const effLA = Math.max(0, playerState.effectiveLA); const currentLA = Math.max(0, playerState.currentLA); const trunkVolume = Math.max(0, playerState.trunkWidth * playerState.trunkDepth * playerState.trunkHeight); let potentialCarbonGain = 0; if (!this.state.isNight) { potentialCarbonGain = PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * this.state.currentLightMultiplier; } const respirationLoss = (RESPIRATION_RATE_PER_LA * currentLA + RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume); const waterLoss = TRANSPIRATION_RATE_PER_LA * effLA * stomata * this.state.currentDroughtFactor; let currentRecoveryRate = HYDRAULIC_RECOVERY_RATE; if (this.state.isRaining) { currentRecoveryRate *= RAIN_RECOVERY_BONUS_MULT; } const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss; playerState.hydraulicSafety += hydraulicChange * deltaTime; const potentialGainThisStep = potentialCarbonGain * deltaTime; const respirationLossThisStep = respirationLoss * deltaTime; const currentStorage = playerState.carbonStorage; const maxPossibleGain = Math.max(0, MAX_CARBON - currentStorage); const actualGain = Math.min(potentialGainThisStep, maxPossibleGain); playerState.carbonStorage = currentStorage + actualGain - respirationLossThisStep; playerState.carbonStorage = Math.max(0, playerState.carbonStorage); playerState.hydraulicSafety = Math.max(0, Math.min(playerState.maxHydraulic, playerState.hydraulicSafety)); if (playerState.hydraulicSafety < HYDRAULIC_DAMAGE_THRESHOLD) { const damageIncrease = CROWN_DIEBACK_RATE * deltaTime; playerState.damagedLAPercentage = Math.min(1, playerState.damagedLAPercentage + damageIncrease); playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage); } if (this.state.isNight) { if (this.state.isRaining && !playerState.foliarUptakeAppliedThisNight) { const boostAmount = NIGHT_RAIN_HYDRAULIC_BOOST; playerState.hydraulicSafety = Math.min(playerState.hydraulicSafety + boostAmount, playerState.maxHydraulic); playerState.foliarUptakeAppliedThisNight = true; } const timeIntoNight = this.state.timeInCycle - DAY_TOTAL_DURATION; if (timeIntoNight >= GROWTH_OFFSET_NIGHT && !playerState.growthAppliedThisCycle) { this._applyAllocation(playerState); playerState.growthAppliedThisCycle = true; } }
    }
   _generatePeriodWeather() { const isSunny = Math.random() < SUNNY_PROB; const isCloudy = !isSunny; this.state.currentLightMultiplier = isCloudy ? LIGHT_MULT_CLOUDY : LIGHT_MULT_SUNNY; const droughtVariation = (Math.random() * 2 - 1) * DROUGHT_VARIATION; this.state.currentDroughtFactor = Math.max(0.1, DROUGHT_MULT_BASE + droughtVariation); return isCloudy; }
   _generateNightWeather() { const isConceptuallyCloudy = Math.random() >= SUNNY_PROB; this.state.isRaining = isConceptuallyCloudy && (Math.random() < RAIN_PROB_IF_CLOUDY); this.state.currentLightMultiplier = 0; this.state.currentDroughtFactor = DROUGHT_MULT_BASE; }
   _applyAllocation(playerState) {
       const available = Math.floor(playerState.carbonStorage); if (available <= 0) return; const savingsPercent = Math.max(0, Math.min(100, playerState.lastSavingsPercent)); const growthRatioPercent = Math.max(0, Math.min(100, playerState.lastGrowthRatioPercent)); const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100)); if (carbonToSpend <= 0) return; const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100)); const carbonForSeeds = carbonToSpend - actualCarbonForGrowth; const seedsToMake = Math.floor(carbonForSeeds / SEED_COST); const actualCarbonForSeeds = seedsToMake * Config.SEED_COST; const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds; if (totalSpent > available + 0.01 || totalSpent < 0) { return; } playerState.carbonStorage -= totalSpent; playerState.seedCount += seedsToMake; if (actualCarbonForGrowth > 0) { const currentTrunkVolume = (playerState.trunkWidth || 0.1) * (playerState.trunkDepth || 0.1) * (playerState.trunkHeight || 0.1); const currentBiomassEstimate = Math.max(1, playerState.currentLA + currentTrunkVolume); const biomassToAdd = actualCarbonForGrowth / GROWTH_COST_PER_LA; const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate); playerState.currentLA *= growthFactor; playerState.trunkHeight *= growthFactor; playerState.trunkWidth = Math.sqrt(playerState.currentLA * k_TA_LA_RATIO); playerState.trunkDepth = playerState.trunkWidth; playerState.maxHydraulic = BASE_HYDRAULIC + HYDRAULIC_SCALE_PER_LA * playerState.currentLA; playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage); }
    }

   // --- Countdown Logic (unchanged) ---
   startCountdown() { if (this.state.gamePhase !== 'lobby' || this.state.countdownIntervalId) { return; } if (this.state.mode !== 'multi') { return; } const activePlayerCount = this.getNonSpectatorPlayers().length; if (activePlayerCount === 0) { console.log(`GameInstance ${this.state.instanceId}: Cannot start countdown, no active players.`); return; } console.log(`GameInstance ${this.state.instanceId}: Starting ${COUNTDOWN_DURATION}s countdown...`); this.setGamePhase('countdown'); this.state.countdownTimer = COUNTDOWN_DURATION; this.broadcastState(); this.state.countdownIntervalId = setInterval(() => { if (this.state.gamePhase !== 'countdown' || this.state.countdownTimer === null) { this.stopCountdown(); return; } const currentActivePlayers = this.getNonSpectatorPlayers().length; if (currentActivePlayers === 0) { console.log(`GameInstance ${this.state.instanceId}: Countdown cancelled, no active players remaining.`); this.stopCountdown(); this.setGamePhase('lobby'); this.broadcastState(); return; } const newTime = this.state.countdownTimer - 1; this.state.countdownTimer = newTime; this.broadcastState(); if (newTime <= 0) { this.stopCountdown(); this._prepareAndStartGame(); } }, 1000); }
   stopCountdown() { if (this.state.countdownIntervalId) { clearInterval(this.state.countdownIntervalId); this.state.countdownIntervalId = null; } }

   // --- Start Game Helper (unchanged) ---
   _prepareAndStartGame() {
       this.stopCountdown();
       if (this.state.gamePhase === 'playing') {
            console.warn(`GameInstance ${this.state.instanceId}: _prepareAndStartGame called but already in 'playing' phase.`);
            return;
        }
       console.log(`GameInstance ${this.state.instanceId}: Preparing players and starting game...`);
       this.setGamePhase('playing');
       let playersMarkedAliveCount = 0;
       this.state.players.forEach(playerState => {
           if (playerState.isSpectator || playerState.isAI || playerState.playerName.startsWith('ADMIN_')) {
               playerState.isAlive = false;
               return;
           }
           if (!playerState.hasChosenSpawn) {
                console.log(`_prepareAndStartGame: Assigning default spawn for ${playerState.id}`);
                this._assignDefaultSpawn(playerState);
           } else if (!playerState.spawnPoint || typeof playerState.spawnPoint.x !== 'number') {
                console.log(`_prepareAndStartGame: Player ${playerState.id} had chosen spawn but point invalid, assigning default.`);
                this._assignDefaultSpawn(playerState);
           }
           if (!playerState.isAlive) {
                playerState.isAlive = true;
                playersMarkedAliveCount++;
           } else {
                playersMarkedAliveCount++;
           }
           playerState.growthAppliedThisCycle = false;
           playerState.foliarUptakeAppliedThisNight = false;
       });
       if (playersMarkedAliveCount === 0 && this.state.players.size > 0) {
           console.log(`_prepareAndStartGame: No active players found after checks, resetting to lobby.`);
           this.resetGame();
           this.broadcastState();
           return;
       }
       console.log(`GameInstance ${this.state.instanceId}: Marked ${playersMarkedAliveCount} players alive.`);
       this.broadcastState();
       console.log(`GameInstance ${this.state.instanceId}: === Calling startSimulationLoop from _prepareAndStartGame ===`); // Keep this log
       this.startSimulationLoop();
   }
   _assignDefaultSpawn(playerState) { const nonSpectatorPlayers = this.getNonSpectatorPlayers(); const index = nonSpectatorPlayers.findIndex(ap => ap.id === playerState.id); const activePlayerCount = nonSpectatorPlayers.length || 1; const angle = (index / activePlayerCount) * Math.PI * 2 + Math.random()*0.1; const radius = 5 + Math.random() * 5; const baseHeight = ISLAND_LEVEL; playerState.spawnPoint = { x: radius * Math.cos(angle), y: baseHeight, z: radius * Math.sin(angle) }; playerState.hasChosenSpawn = true; }

   // --- Reset & End Game (unchanged) ---
   resetGame() { console.log(`GameInstance ${this.state.instanceId}: Resetting game...`); this.stopSimulationLoop(); this.stopCountdown(); Object.assign(this.state, { day: 1, timeInCycle: 0.0, currentPeriodIndex: -1, isNight: false, currentLightMultiplier: LIGHT_MULT_SUNNY, currentDroughtFactor: DROUGHT_MULT_BASE, isRaining: false, gamePhase: 'lobby', countdownTimer: null, allowPlayerCountdownStart: true }); this.state.players.forEach(p => { const initialLA = INITIAL_LEAF_AREA; const maxHydraulic = BASE_HYDRAULIC + HYDRAULIC_SCALE_PER_LA * initialLA; p.isAlive = false; p.hasChosenSpawn = false; p.spawnPoint = { x: 0, y: ISLAND_LEVEL, z: 0 }; p.carbonStorage = INITIAL_CARBON; p.hydraulicSafety = Math.min(INITIAL_HYDRAULICS, maxHydraulic); p.maxHydraulic = maxHydraulic; p.currentLA = initialLA; p.effectiveLA = initialLA; p.trunkHeight = INITIAL_TRUNK_HEIGHT; p.trunkWidth = Math.sqrt(initialLA * k_TA_LA_RATIO); p.trunkDepth = p.trunkWidth; p.seedCount = 0; p.damagedLAPercentage = 0; p.stomatalConductance = 0.5; p.lastSavingsPercent = 50; p.lastGrowthRatioPercent = 50; p.foliarUptakeAppliedThisNight = false; p.growthAppliedThisCycle = false; }); console.log(`GameInstance ${this.state.instanceId}: Reset complete. Phase: ${this.state.gamePhase}`); }
   endGame(reason = "Game ended.") { console.log(`GameInstance ${this.state.instanceId}: endGame called. Reason: ${reason}`); this.stopSimulationLoop(); this.stopCountdown(); this.setGamePhase('ended'); let winnerId = null; let maxSeeds = -1; this.state.players.forEach(p => { if (!p.isSpectator && !p.playerName.startsWith('ADMIN_') && p.seedCount > maxSeeds) { maxSeeds = p.seedCount; winnerId = p.id; } }); console.log(`GameInstance ${this.state.instanceId}: Winner: ${winnerId || 'None'} with ${maxSeeds} seeds.`); this.io.to(this.state.roomId).emit('gameOver', { reason: reason, winnerId: winnerId }); this.broadcastState(); setTimeout(() => { this.resetGame(); this.broadcastState(); }, 2000); }

   // --- Broadcasting (unchanged) ---
   broadcastState() { const snapshot = this.getSnapshot(); this.io.to(this.state.roomId).emit('gameStateUpdate', snapshot); }

   // --- Utility (unchanged) ---
   findSocket(socketId) { const socket = this.io.sockets.sockets.get(socketId); return socket; }
}