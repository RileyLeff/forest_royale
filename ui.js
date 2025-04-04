// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js';
import * as Config from './config.js';
import { growTree, updateTreeColors, setCanopyVisibility } from './tree.js';
// We will import startNewDay from simulation.js in the next step
import { handleRestart } from './main.js';
// Import startNewDay function from simulation.js
import { startNewDay } from './simulation.js';


// DOM Element References (cached)
let uiElements = {};

export function cacheDOMElements() {
    uiElements = {
        gameContainer: document.getElementById('game-container'),
        canvas: document.getElementById('game-canvas'),
        // Status
        carbonBar: document.getElementById('carbon-bar'),
        hydraulicBar: document.getElementById('hydraulic-bar'),
        carbonValueUI: document.getElementById('carbon-value'),
        hydraulicValueUI: document.getElementById('hydraulic-value'),
        // Controls
        stomataSlider: document.getElementById('stomata-slider'),
        stomataValueUI: document.getElementById('stomata-value'),
        leafColorPicker: document.getElementById('leaf-color-picker'),
        trunkColorPicker: document.getElementById('trunk-color-picker'),
        // Info
        dayCounterUI: document.getElementById('day-counter'),
        seedCounterUI: document.getElementById('seed-counter'),
        timeOfDayUI: document.getElementById('time-of-day'),
        cycleTimerUI: document.getElementById('cycle-timer'),
        messageLogUI: document.getElementById('message-log'),
        // Allocation Section Elements
        allocationSection: document.getElementById('allocation-section'),
        allocationDayUI: document.getElementById('allocation-day'),
        allocationTimerUI: document.getElementById('allocation-timer'),
        allocationAvailableCarbonUI: document.getElementById('allocation-available-carbon'),
        growthInput: document.getElementById('growth-input'),
        seedInput: document.getElementById('seed-input'),
        // Make sure seedCostInfoUI is cached
        seedCostInfoUI: document.getElementById('seed-cost-info'),
        allocationSpentCarbonUI: document.getElementById('allocation-spent-carbon'),
        allocationGrowthResultUI: document.getElementById('allocation-growth-result'),
        allocationSeedsResultUI: document.getElementById('allocation-seeds-result'),
        allocationSavedCarbonUI: document.getElementById('allocation-saved-carbon'),
        submitAllocationButton: document.getElementById('submit-allocation'),
        // Game Over Elements
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     // Add checks for potentially missed elements
     if (!uiElements.seedCostInfoUI) console.warn("UI element not found: seed-cost-info");
     if (!uiElements.growthInput) console.warn("UI element not found: growth-input");
     if (!uiElements.seedInput) console.warn("UI element not found: seed-input");
     if (!uiElements.allocationSection) console.error("Allocation section UI element not found!");
}


// Event Listener Setup
export function setupUIListeners() {
    if (!uiElements.stomataSlider || !uiElements.submitAllocationButton || !uiElements.restartButton) {
        console.error("Cannot set up UI listeners - essential elements missing.");
        return;
    }
    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.submitAllocationButton.addEventListener('click', handleSubmitAllocationManual);
    uiElements.restartButton.addEventListener('click', handleRestart); // Calls handler in main.js
    uiElements.leafColorPicker.addEventListener('input', handleLeafColorChange);
    uiElements.trunkColorPicker.addEventListener('input', handleTrunkColorChange);

    // Listeners for allocation inputs
    if (uiElements.growthInput) {
        uiElements.growthInput.addEventListener('input', updateAllocationPreview);
    } else { console.warn("Growth input listener not added."); }
    if (uiElements.seedInput) {
        uiElements.seedInput.addEventListener('input', updateAllocationPreview);
    } else { console.warn("Seed input listener not added."); }
}

// Event Handlers
function handleStomataChange(e) {
    gameState.stomatalConductance = parseFloat(e.target.value);
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    }
}

function handleLeafColorChange(e) {
    gameState.leafColor = e.target.value;
    updateTreeColors(gameState);
}

function handleTrunkColorChange(e) {
    gameState.trunkColor = e.target.value;
    updateTreeColors(gameState);
}

// Handler for the manual submit button click
function handleSubmitAllocationManual() {
    console.log("UI: Handling Manual Submit Click"); // Log
    clearAllocationTimer();
    submitAllocation(false); // Indicate manual submission
}


// --- UI Update Functions ---
export function updateUI() {
    if (!gameState || !uiElements.carbonBar) return; // Basic check

    // Update Status Bars
    if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(gameState.carbonStorage / Config.MAX_CARBON) * 100}%`;
    if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / Config.MAX_HYDRAULIC) * 100}%`;
    if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);

    // Update Info Text
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = gameState.day;
    if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = gameState.seedCount;
    if (uiElements.timeOfDayUI) uiElements.timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);

    // Update Time Left in Cycle
    // Use DAY duration if day, use NIGHT duration conceptually if night (even though we skip idle)
    const cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
    const timeLeftInCycle = Math.max(0, cycleDuration - gameState.timeInCycle); // Avoid negative time
    if (uiElements.cycleTimerUI) uiElements.cycleTimerUI.textContent = Math.floor(timeLeftInCycle);


    // Ensure controls reflect current state (useful on restart/init)
    if (uiElements.stomataSlider) uiElements.stomataSlider.value = gameState.stomatalConductance;
    if (uiElements.stomataValueUI) uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    if (uiElements.leafColorPicker) uiElements.leafColorPicker.value = gameState.leafColor;
    if (uiElements.trunkColorPicker) uiElements.trunkColorPicker.value = gameState.trunkColor;
}

export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        uiElements.messageLogUI.className = `message ${type}`;
     }
}

export function clearMessage() {
    if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = '';
        uiElements.messageLogUI.className = 'message';
    }
}


// --- Allocation Section Handling ---

export function showAllocationSection() {
    if (gameState.gameOver || !uiElements.allocationSection) return;
    gameState.isPaused = true;
    const availableCarbon = Math.floor(gameState.carbonStorage);
    if(uiElements.allocationAvailableCarbonUI) uiElements.allocationAvailableCarbonUI.textContent = availableCarbon;
    if(uiElements.allocationDayUI) uiElements.allocationDayUI.textContent = gameState.day;
    if(uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST; // Shows '1'
    if(uiElements.growthInput) { uiElements.growthInput.value = 0; uiElements.growthInput.max = availableCarbon; }
    if(uiElements.seedInput) { uiElements.seedInput.value = 0; uiElements.seedInput.max = availableCarbon; }
    updateAllocationPreview();
    uiElements.allocationSection.classList.remove('hidden');
    startAllocationTimer(); // Starts the 7-second timer
}

// Updated hideAllocationSection
export function hideAllocationSection() {
    console.log("UI: Hiding Allocation Section..."); // Log
    if (uiElements.allocationSection) {
        uiElements.allocationSection.classList.add('hidden');
    }
    clearAllocationTimer();
    gameState.isPaused = false; // Resume simulation logic flow
    console.log("UI: Game Unpaused. gameState.isPaused =", gameState.isPaused); // Log state

    // Immediately start the next day
    if (!gameState.gameOver) {
        console.log("UI: Calling startNewDay()..."); // Log
        startNewDay(); // Function imported from simulation.js
    } else {
        console.log("UI: Game is over, not starting new day."); // Log
    }
}

// --- Updated Allocation Preview ---
function updateAllocationPreview() {
    if (!uiElements.growthInput || !uiElements.seedInput || !uiElements.allocationAvailableCarbonUI) return;
    const availableCarbon = Math.floor(gameState.carbonStorage);
    let intendedGrowthCarbon = Math.max(0, parseInt(uiElements.growthInput.value) || 0);
    let intendedSeedCarbon = Math.max(0, parseInt(uiElements.seedInput.value) || 0);
    let totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
    if (totalIntended > availableCarbon) {
        const excess = totalIntended - availableCarbon;
        const proportionGrowth = totalIntended > 0 ? intendedGrowthCarbon / totalIntended : 0.5;
        const proportionSeed = totalIntended > 0 ? intendedSeedCarbon / totalIntended : 0.5;
        intendedGrowthCarbon = Math.floor(intendedGrowthCarbon - excess * proportionGrowth);
        intendedSeedCarbon = Math.floor(intendedSeedCarbon - excess * proportionSeed);
        totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
        if (totalIntended > availableCarbon) { intendedSeedCarbon -= (totalIntended - availableCarbon); }
        intendedSeedCarbon = Math.max(0, intendedSeedCarbon);
        uiElements.growthInput.value = intendedGrowthCarbon;
        uiElements.seedInput.value = intendedSeedCarbon;
    }
    const seedsToMake = intendedSeedCarbon;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const actualCarbonForGrowth = intendedGrowthCarbon;
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    const carbonSaved = availableCarbon - totalSpent;
    if(uiElements.allocationSpentCarbonUI) uiElements.allocationSpentCarbonUI.textContent = totalSpent;
    if(uiElements.allocationGrowthResultUI) uiElements.allocationGrowthResultUI.textContent = actualCarbonForGrowth;
    if(uiElements.allocationSeedsResultUI) uiElements.allocationSeedsResultUI.textContent = seedsToMake;
    if(uiElements.allocationSavedCarbonUI) uiElements.allocationSavedCarbonUI.textContent = carbonSaved;
}


// --- Timer Logic ---
function startAllocationTimer() {
    clearAllocationTimer();
    let timeLeft = Config.ALLOCATION_TIMER_DURATION; // Uses updated 7s
    if (uiElements.allocationTimerUI) { uiElements.allocationTimerUI.textContent = timeLeft; }
    else { console.warn("Allocation timer UI element missing."); }
    gameState.allocationTimerId = setInterval(() => {
        timeLeft--;
         if (uiElements.allocationTimerUI) { uiElements.allocationTimerUI.textContent = timeLeft; }
        if (timeLeft <= 0) { submitRandomAllocation(); }
    }, 1000);
}

function clearAllocationTimer() {
    if (gameState.allocationTimerId !== null) {
        clearInterval(gameState.allocationTimerId);
        gameState.allocationTimerId = null;
    }
}

// --- Updated Allocation Submission Logic ---
function submitAllocation(isRandom = false) {
    console.log(`UI: submitAllocation called (isRandom: ${isRandom})`); // Log
    const available = Math.floor(gameState.carbonStorage);
    let actualCarbonForGrowth = 0;
    let seedsToMake = 0;
    let actualCarbonForSeeds = 0;

    if (isRandom) {
        // --- Random Allocation Strategy ---
        const targetSpend = Math.floor(available * 0.5);
        const growthTarget = Math.floor(targetSpend * 0.5);
        const seedTarget = targetSpend - growthTarget;
        seedsToMake = Math.max(0, seedTarget);
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        actualCarbonForGrowth = Math.max(0, targetSpend - actualCarbonForSeeds);
        actualCarbonForGrowth = Math.min(growthTarget, actualCarbonForGrowth);
    } else {
        // --- Manual Allocation Strategy ---
        if (!uiElements.growthInput || !uiElements.seedInput) {
            console.error("Allocation input elements not found for manual submission!");
            // Important: Still hide section even on error!
            hideAllocationSection();
            updateUI();
            return; // Stop execution here
        }
        let intendedGrowthCarbon = Math.max(0, parseInt(uiElements.growthInput.value) || 0);
        let intendedSeedCarbon = Math.max(0, parseInt(uiElements.seedInput.value) || 0);
        // Re-apply constraints
        let totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
        if (totalIntended > available) {
            const excess = totalIntended - available;
            const proportionGrowth = totalIntended > 0 ? intendedGrowthCarbon / totalIntended : 0.5;
            const proportionSeed = totalIntended > 0 ? intendedSeedCarbon / totalIntended : 0.5;
            intendedGrowthCarbon = Math.floor(intendedGrowthCarbon - excess * proportionGrowth);
            intendedSeedCarbon = Math.floor(intendedSeedCarbon - excess * proportionSeed);
            totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
            if (totalIntended > available) { intendedSeedCarbon -= (totalIntended - available); }
            intendedSeedCarbon = Math.max(0, intendedSeedCarbon);
        }
        seedsToMake = intendedSeedCarbon;
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        actualCarbonForGrowth = intendedGrowthCarbon;
    }

    // --- Apply the final calculated allocation ---
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    console.log(`UI: Calculated - Growth=${actualCarbonForGrowth}, Seeds=${seedsToMake}, Spent=${totalSpent}, Available=${available}`); // Log amounts

    // Final sanity checks
    if (totalSpent > available) {
        console.error(`UI CRITICAL ERROR: Spend ${totalSpent} > Available ${available}. Aborting allocation.`);
        showMessage("Error calculating allocation. Allocation cancelled.", "error");
        // **Important:** Need to still hide section even on error!
        hideAllocationSection();
        updateUI(); // Update UI to show error message possibly
        return; // Stop execution here
    } else if (totalSpent < 0) {
         console.error(`UI CRITICAL ERROR: Spend ${totalSpent} is negative. Aborting allocation.`);
         showMessage("Error calculating allocation. Allocation cancelled.", "error");
         // **Important:** Need to still hide section even on error!
         hideAllocationSection();
         updateUI();
         return; // Stop execution here
    } else {
        // Deduct carbon (ONLY IF VALID)
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) { growTree(gameState, actualCarbonForGrowth); }
        console.log(`UI: Allocation Applied. State Updated.`); // Log success
    }

    // --- Finalize ---
    console.log("UI: Calling hideAllocationSection from submitAllocation..."); // Log before call
    hideAllocationSection(); // Hides UI, clears timer, unpauses, calls startNewDay
    updateUI(); // Update status bars etc. immediately
    console.log("UI: submitAllocation finished."); // Log finish
}


// Called ONLY when the timer runs out
function submitRandomAllocation() {
    console.log("UI: submitRandomAllocation called by timer"); // Log
    clearAllocationTimer();
    if (gameState.isPaused && !gameState.gameOver) {
        console.log("UI: Proceeding with random allocation submit."); // Log
        // showMessage("Time's up! Allocating automatically.", "warning"); // Message shown by submitAllocation now
        submitAllocation(true);
    } else {
        console.warn("UI: submitRandomAllocation called but game not in correct state.");
        hideAllocationSection(); // Hide section anyway if visible
    }
}


// --- Game Over UI ---
export function showGameOverUI() {
    if (!uiElements.gameOverModal) return;
    if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
    if(uiElements.finalDayUI) uiElements.finalDayUI.textContent = gameState.day;
    if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.textContent = gameState.seedCount;
    setCanopyVisibility(gameState, false);
    uiElements.gameOverModal.classList.remove('hidden');
}