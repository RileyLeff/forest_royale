// server/game/simulation.js
import * as Config from '../config.js';
// Import state getters/setters and player object reference
import { getGlobalState, getAllPlayers } from './GameState.js';
// Import game logic functions needed by the simulation
import { endGame } from './gameLogic.js'; // Import endGame to call it

let previousPeriodIndex = -2; // Internal state for weather change detection

/**
 * Updates the entire game state for one tick.
 * @param {number} deltaTime - Time elapsed since the last tick in seconds.
 * @param {object} io - The Socket.IO server instance (needed to pass to endGame).
 */
export function updateSimulationTick(deltaTime, io) {
    const globalState = getGlobalState(); // Get mutable global state object
    const players = getAllPlayers(); // Get mutable players object

    // Simulation should only run when 'playing'
    if (globalState.gamePhase !== 'playing') {
        return;
    }

    // --- 1. Update Global Time ---
    globalState.timeInCycle += deltaTime;

    // --- 2. Handle Cycle Transitions & Weather ---
    let enteringNewDay = false;
    if (globalState.timeInCycle >= Config.TOTAL_CYCLE_DURATION) {
        enteringNewDay = true;
        globalState.day++;
        globalState.timeInCycle -= Config.TOTAL_CYCLE_DURATION;
        globalState.currentPeriodIndex = 0;
        globalState.isNight = false;
        Object.values(players).forEach(p => { p.growthAppliedThisCycle = false; });
        // console.log(`SIM: --- START DAY ${globalState.day} ---`);
        previousPeriodIndex = -1; // Reset for weather generation on new day
    }

    // Determine current logical period index and night status
    let calculatedPeriodIndex;
    if (globalState.timeInCycle < Config.DAY_TOTAL_DURATION) {
        calculatedPeriodIndex = Math.floor(globalState.timeInCycle / Config.PERIOD_DURATION);
        globalState.isNight = false;
    } else {
        calculatedPeriodIndex = -1; // Night
        globalState.isNight = true;
    }

    // Check for Period/Phase Transitions & Generate Weather
    const periodChanged = calculatedPeriodIndex !== previousPeriodIndex;
    if (periodChanged) {
        // console.log(`SIM: Period changed. Old: ${previousPeriodIndex}, New: ${calculatedPeriodIndex}, NewDay: ${enteringNewDay}`);
        // Update internal tracker first
        previousPeriodIndex = calculatedPeriodIndex;

        if (!globalState.isNight) {
            // New Daytime Period
            const isCloudy = generatePeriodWeather(globalState); // Pass globalState to modify
            globalState.isRaining = isCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
            // console.log(`SIM: Day Period ${globalState.currentPeriodIndex}: Light=${globalState.currentLightMultiplier.toFixed(2)}, Drought=${globalState.currentDroughtFactor.toFixed(2)}, Raining=${globalState.isRaining}`);
        } else {
            // Entering Nighttime only needs weather generation once
             if (globalState.currentPeriodIndex === -1 && calculatedPeriodIndex === -1) { // Check if we just entered night
                generateNightWeather(globalState); // Pass globalState to modify
                Object.values(players).forEach(p => { p.foliarUptakeAppliedThisNight = false; });
                // console.log(`SIM: Entering Night: Raining=${globalState.isRaining}`);
            }
        }
        // Update the official index in global state AFTER generating weather based on transition
         globalState.currentPeriodIndex = calculatedPeriodIndex;

    }


    // --- 3. Update Each Player's State ---
    let playersAliveThisTick = 0;
    Object.values(players).forEach(playerState => {
        if (!playerState.isAlive) return; // Skip dead players

        // Apply physiological updates
        updatePlayerPhysiology(playerState, globalState, deltaTime);

        // Check Game Over Conditions for this player
        if ((playerState.carbonStorage <= 0 || playerState.hydraulicSafety <= 0) && playerState.isAlive) {
            console.log(`SIM: Player ${playerState.id} died. Carbon: ${playerState.carbonStorage.toFixed(1)}, Hydraulics: ${playerState.hydraulicSafety.toFixed(1)}`);
            playerState.isAlive = false; // Mark as dead
        } else if (playerState.isAlive) {
            playersAliveThisTick++; // Count if still alive
        }
    });

    // --- Check for Game End Condition ---
    const totalPlayers = Object.keys(players).length;
    if (playersAliveThisTick === 0 && totalPlayers > 0 && globalState.gamePhase === 'playing') {
         console.log("SIM: All players are dead condition met. Triggering endGame.");
         // Call endGame from gameLogic, passing io instance
         endGame(io, players, globalState);
    }
}


// --- Simulation Helper Functions ---

/**
 * Updates physiological state for a single player.
 * Modifies playerState directly.
 * @param {object} playerState - The state object for the player.
 * @param {object} globalState - The global game state.
 * @param {number} deltaTime - Time delta in seconds.
 */
function updatePlayerPhysiology(playerState, globalState, deltaTime) {
     const stomata = playerState.stomatalConductance;
     const effLA = Math.max(0, playerState.effectiveLA);
     const currentLA = Math.max(0, playerState.currentLA);
     const trunkVolume = Math.max(0, playerState.trunkWidth * playerState.trunkDepth * playerState.trunkHeight);

     // Photosynthesis (Day Only)
     let potentialCarbonGain = 0;
     if (!globalState.isNight) {
         potentialCarbonGain = Config.PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata * globalState.currentLightMultiplier;
     }

     // Respiration
     const respirationLoss = (Config.RESPIRATION_RATE_PER_LA * currentLA + Config.RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);

     // Hydraulics
     const waterLoss = Config.TRANSPIRATION_RATE_PER_LA * effLA * stomata * globalState.currentDroughtFactor;
     let currentRecoveryRate = Config.HYDRAULIC_RECOVERY_RATE;
     if (globalState.isRaining) {
         currentRecoveryRate *= Config.RAIN_RECOVERY_BONUS_MULT;
     }
     const hydraulicChange = (currentRecoveryRate * (1 - stomata)) - waterLoss;
     playerState.hydraulicSafety += hydraulicChange * deltaTime;

     // Apply Carbon Changes
     const potentialGainThisStep = potentialCarbonGain * deltaTime;
     const respirationLossThisStep = respirationLoss * deltaTime;
     const currentStorage = playerState.carbonStorage;
     const maxPossibleGain = Math.max(0, Config.MAX_CARBON - currentStorage);
     const actualGain = Math.min(potentialGainThisStep, maxPossibleGain);
     playerState.carbonStorage = currentStorage + actualGain - respirationLossThisStep;

     // Clamp Values
     playerState.carbonStorage = Math.max(0, playerState.carbonStorage);
     playerState.hydraulicSafety = Math.max(0, Math.min(playerState.maxHydraulic, playerState.hydraulicSafety));

     // Crown Dieback / Damage
     if (playerState.hydraulicSafety < Config.HYDRAULIC_DAMAGE_THRESHOLD) {
         const damageIncrease = Config.CROWN_DIEBACK_RATE * deltaTime;
         playerState.damagedLAPercentage = Math.min(1, playerState.damagedLAPercentage + damageIncrease);
         playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage);
     }

     // Night Events
     if (globalState.isNight) {
         // Foliar Uptake
         if (globalState.isRaining && !playerState.foliarUptakeAppliedThisNight) {
             const boostAmount = Config.NIGHT_RAIN_HYDRAULIC_BOOST;
             playerState.hydraulicSafety = Math.min(playerState.hydraulicSafety + boostAmount, playerState.maxHydraulic);
             playerState.foliarUptakeAppliedThisNight = true;
         }

         // Growth Allocation Trigger
         const timeIntoNight = globalState.timeInCycle - Config.DAY_TOTAL_DURATION;
         if (timeIntoNight >= Config.GROWTH_OFFSET_NIGHT && !playerState.growthAppliedThisCycle) {
             applyAllocation(playerState); // Modifies playerState
             playerState.growthAppliedThisCycle = true;
         }
     }
}


/**
 * Generates weather for a daytime period.
 * Modifies globalState directly.
 * @param {object} globalState - The global game state object.
 * @returns {boolean} True if the period is cloudy.
 */
function generatePeriodWeather(globalState) {
    const isSunny = Math.random() < Config.SUNNY_PROB;
    const isCloudy = !isSunny;
    globalState.currentLightMultiplier = isCloudy ? Config.LIGHT_MULT_CLOUDY : Config.LIGHT_MULT_SUNNY;
    const droughtVariation = (Math.random() * 2 - 1) * Config.DROUGHT_VARIATION;
    globalState.currentDroughtFactor = Math.max(0.1, Config.DROUGHT_MULT_BASE + droughtVariation);
    return isCloudy;
}

/**
 * Generates weather for the night phase.
 * Modifies globalState directly.
 * @param {object} globalState - The global game state object.
 */
function generateNightWeather(globalState) {
    const isConceptuallyCloudy = Math.random() >= Config.SUNNY_PROB;
    globalState.isRaining = isConceptuallyCloudy && (Math.random() < Config.RAIN_PROB_IF_CLOUDY);
    globalState.currentLightMultiplier = 0;
    globalState.currentDroughtFactor = Config.DROUGHT_MULT_BASE;
}

/**
 * Applies carbon allocation based on player's stored intentions.
 * Modifies playerState directly.
 * @param {object} playerState - The state object for the player.
 */
function applyAllocation(playerState) {
    const available = Math.floor(playerState.carbonStorage);
    if (available <= 0) return;

    const savingsPercent = Math.max(0, Math.min(100, playerState.lastSavingsPercent));
    const growthRatioPercent = Math.max(0, Math.min(100, playerState.lastGrowthRatioPercent));

    const carbonToSpend = Math.floor(available * (1 - savingsPercent / 100));
    const actualCarbonForGrowth = Math.floor(carbonToSpend * (growthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
    const seedsToMake = Math.floor(carbonForSeeds / Config.SEED_COST);
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    if (totalSpent > available + 0.01 || totalSpent < 0) {
        console.error(`SIM ALLOCATION ERROR for ${playerState.id}: Invalid spend (${totalSpent}) vs available (${available}). Skipping.`);
        return;
    }

    playerState.carbonStorage -= totalSpent;
    playerState.seedCount += seedsToMake;

    if (actualCarbonForGrowth > 0) {
        const currentTrunkVolume = (playerState.trunkWidth || 0.1) * (playerState.trunkDepth || 0.1) * (playerState.trunkHeight || 0.1);
        const currentBiomassEstimate = Math.max(1, playerState.currentLA + currentTrunkVolume);
        const biomassToAdd = actualCarbonForGrowth / Config.GROWTH_COST_PER_LA;
        const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

        playerState.currentLA *= growthFactor;
        playerState.trunkHeight *= growthFactor;
        playerState.trunkWidth = Math.sqrt(playerState.currentLA * Config.k_TA_LA_RATIO);
        playerState.trunkDepth = playerState.trunkWidth;
        playerState.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * playerState.currentLA;
        playerState.effectiveLA = playerState.currentLA * (1 - playerState.damagedLAPercentage);
    }
}