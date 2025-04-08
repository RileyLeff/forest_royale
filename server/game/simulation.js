// server/game/simulation.js
import * as Config from '../config.js';
import { getGlobalState, getAllPlayers } from './GameState.js';
import { endGame } from './gameLogic.js';

let previousPeriodIndex = -2; // Internal state for weather change detection

/** Updates the entire game state for one tick. */
export function updateSimulationTick(deltaTime, io) {
    const globalState = getGlobalState();
    const players = getAllPlayers();

    if (globalState.gamePhase !== 'playing') { return; }

    // --- 1. Update Global Time ---
    globalState.timeInCycle += deltaTime;

    // --- 2. Handle Cycle Transitions & Weather ---
    let enteringNewDay = false;
    if (globalState.timeInCycle >= Config.TOTAL_CYCLE_DURATION) {
        enteringNewDay = true; globalState.day++; globalState.timeInCycle -= Config.TOTAL_CYCLE_DURATION;
        globalState.currentPeriodIndex = 0; globalState.isNight = false;
        Object.values(players).forEach(p => { p.growthAppliedThisCycle = false; });
        previousPeriodIndex = -1;
    }
    let calculatedPeriodIndex;
    if (globalState.timeInCycle < Config.DAY_TOTAL_DURATION) { calculatedPeriodIndex = Math.floor(globalState.timeInCycle / Config.PERIOD_DURATION); globalState.isNight = false; }
    else { calculatedPeriodIndex = -1; globalState.isNight = true; }

    const periodChanged = calculatedPeriodIndex !== previousPeriodIndex;
    if (periodChanged) {
        const oldPeriodIndex = previousPeriodIndex; // Store before updating tracker
        previousPeriodIndex = calculatedPeriodIndex; // Update tracker
        if (!globalState.isNight) {
            const isCloudy = generatePeriodWeather(globalState);
            globalState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
        } else {
             // Only generate night weather once when actually entering night phase
             if (oldPeriodIndex !== -1) { // Check if we weren't already in night
                 generateNightWeather(globalState);
                 Object.values(players).forEach(p => { p.foliarUptakeAppliedThisNight = false; });
             }
        }
         globalState.currentPeriodIndex = calculatedPeriodIndex; // Update official state index
    }

    // --- 3. Update Each Player's State ---
    let playersAliveThisTick = 0;
    Object.values(players).forEach(playerState => {
        // <<< This check correctly skips dead players AND spectators >>>
        if (!playerState.isAlive) return;

        updatePlayerPhysiology(playerState, globalState, deltaTime);

        if ((playerState.carbonStorage <= 0 || playerState.hydraulicSafety <= 0)) {
            console.log(`SIM: Player ${playerState.id} died.`);
            playerState.isAlive = false;
        } else {
            playersAliveThisTick++;
        }
    });

    // --- Check for Game End Condition ---
    const totalPlayers = Object.keys(players).length;
    // Check only active players (non-spectators)
    const activePlayers = Object.values(players).filter(p => !p.isSpectator).length;
    if (playersAliveThisTick === 0 && activePlayers > 0 && globalState.gamePhase === 'playing') {
         console.log("SIM: All active players are dead condition met. Triggering endGame.");
         endGame(io, players, globalState); // Pass necessary info
    }
}

// --- Simulation Helper Functions ---

/** Updates physiological state for a single player. */
function updatePlayerPhysiology(playerState, globalState, deltaTime) {
     const stomata = playerState.stomatalConductance; const effLA = Math.max(0, playerState.effectiveLA); const currentLA = Math.max(0, playerState.currentLA); const trunkVolume = Math.max(0, playerState.trunkWidth * playerState.trunkDepth * playerState.trunkHeight);
     let potentialCarbonGain = 0; if (!globalState.isNight) potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * globalState.currentLightMultiplier;
     const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
     const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * globalState.currentDroughtFactor; let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE; if (globalState.isRaining) currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT;
     const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss; playerState.hydraulicSafety += hydraulicChange * deltaTime;
     const potentialGainThisStep = potentialCarbonGain * deltaTime; const respirationLossThisStep = respirationLoss * deltaTime; const currentStorage = playerState.carbonStorage; const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage); const actualGain = Math.min(potentialGainThisStep, maxPossibleGain); playerState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;
     playerState.carbonStorage = Math.max(0, playerState.carbonStorage); playerState.hydraulicSafety = Math.max(0, Math.min(playerState.maxHydraulic, playerState.hydraulicSafety));
     if (playerState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) { const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime; playerState.damagedLAPercentage = Math.min(1, playerState.damagedLAPercentage + damageIncrease); playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage); }
     if (globalState.isNight) { if (globalState.isRaining && !playerState.foliarUptakeAppliedThisNight) { const boostAmount = Config.NIGHT_RAIN_HYDRAULIC_BOOST; playerState.hydraulicSafety = Math.min(playerState.hydraulicSafety + boostAmount, playerState.maxHydraulic); playerState.foliarUptakeAppliedThisNight = true; } const timeIntoNight = globalState.timeInCycle - Config.DAY_TOTAL_DURATION; if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !playerState.growthAppliedThisCycle) { applyAllocation(playerState); playerState.growthAppliedThisCycle = true; } }
}

/** Generates weather for a daytime period. */
function generatePeriodWeather(globalState) { const isSunny = Math.random() < Config.SUNNY_PROB; const isCloudy = !isSunny; globalState.currentLightMultiplier = isCloudy ? Config.LIGHT_MULT_CLOUDY : Config.LIGHT_MULT_SUNNY; const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION; globalState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation); return isCloudy; }
/** Generates weather for the night phase. */
function generateNightWeather(globalState) { const isConceptuallyCloudy = Math.random() >= Config.SUNNY_PROB; globalState.isRaining = isConceptuallyCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY); globalState.currentLightMultiplier = 0; globalState.currentDroughtFactor = Config.DROUGHT_MULT_BASE; }
/** Applies carbon allocation based on player's stored intentions. */
function applyAllocation(playerState) { const available = Math.floor(playerState.carbonStorage); if (available <= 0) return; const savingsPercent = Math.max(0, Math.min(100, playerState.lastSavingsPercent)); const growthRatioPercent = Math.max(0, Math.min(100, playerState.lastGrowthRatioPercent)); const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100)); const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100)); const carbonForSeeds = carbonToSpend - actualCarbonForGrowth; const seedsToMake = Math.floor(carbonForSeeds / Config.SEED_COST); const actualCarbonForSeeds = seedsToMake * Config.SEED_COST; const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds; if (totalSpent > available + 0.01 || totalSpent < 0) { console.error(`SIM ALLOC ERR for ${playerState.id}: Invalid spend (${totalSpent}) vs avail (${available}).`); return; } playerState.carbonStorage -= totalSpent; playerState.seedCount += seedsToMake; if (actualCarbonForGrowth > 0) { const currentTrunkVolume = (playerState.trunkWidth || 0.1) * (playerState.trunkDepth || 0.1) * (playerState.trunkHeight || 0.1); const currentBiomassEstimate = Math.max(1, playerState.currentLA + currentTrunkVolume); const biomassToAdd = actualCarbonForGrowth / Config.GROWTH_COST_PER_LA; const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate); playerState.currentLA *= growthFactor; playerState.trunkHeight *= growthFactor; playerState.trunkWidth = Math.sqrt(playerState.currentLA * Config.k_TA_LA_RATIO); playerState.trunkDepth = playerState.trunkWidth; playerState.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * playerState.currentLA; playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage); } }