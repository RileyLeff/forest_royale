// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js';
import * as Config from './config.js';
import { growTree, updateTreeColors, setCanopyVisibility } from './tree.js';
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
        savingsSlider: document.getElementById('savings-slider'),
        savingsPercentageUI: document.getElementById('savings-percentage'),
        growthRatioSlider: document.getElementById('growth-ratio-slider'),
        growthRatioPercentageUI: document.getElementById('growth-ratio-percentage'),
        seedCostInfoUI: document.getElementById('seed-cost-info'),
        allocationSpentCarbonUI: document.getElementById('allocation-spent-carbon'),
        allocationGrowthResultUI: document.getElementById('allocation-growth-result'),
        allocationSeedsResultUI: document.getElementById('allocation-seeds-result'),
        allocationSavedCarbonUI: document.getElementById('allocation-saved-carbon'),
        submitAllocationButton: document.getElementById('submit-allocation'),
        // Game Over Elements
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'), // Target paragraph for reason
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     // Checks for elements
     if (!uiElements.savingsSlider) console.warn("UI element not found: savings-slider");
     if (!uiElements.growthRatioSlider) console.warn("UI element not found: growth-ratio-slider");
     if (!uiElements.allocationSection) console.error("Allocation section UI element not found!");
     // ++ Added Check for Game Over Reason Element ++
     if (!uiElements.gameOverReasonUI) console.error("UI element not found: game-over-reason");
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
    if (uiElements.savingsSlider) {
        uiElements.savingsSlider.addEventListener('input', updateAllocationPreview);
    } else { console.warn("Savings slider listener not added."); }
    if (uiElements.growthRatioSlider) {
        uiElements.growthRatioSlider.addEventListener('input', updateAllocationPreview);
    } else { console.warn("Growth ratio slider listener not added."); }
}

// Event Handlers
function handleStomataChange(e) {
    gameState.stomatalConductance = parseFloat(e.target.value);
    if (uiElements.stomataValueUI) {
        uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    }
}
function handleLeafColorChange(e) { gameState.leafColor = e.target.value; updateTreeColors(gameState); }
function handleTrunkColorChange(e) { gameState.trunkColor = e.target.value; updateTreeColors(gameState); }

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
    const cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
    const timeLeftInCycle = Math.max(0, cycleDuration - gameState.timeInCycle);
    if (uiElements.cycleTimerUI) uiElements.cycleTimerUI.textContent = Math.floor(timeLeftInCycle);

    // Ensure controls reflect current state
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
    if (gameState.gameOver || !uiElements.allocationSection || !uiElements.savingsSlider || !uiElements.growthRatioSlider) return;
    gameState.isPaused = true;
    const availableCarbon = Math.floor(gameState.carbonStorage);
    if(uiElements.allocationAvailableCarbonUI) uiElements.allocationAvailableCarbonUI.textContent = availableCarbon;
    if(uiElements.allocationDayUI) uiElements.allocationDayUI.textContent = gameState.day;
    if(uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST;
    uiElements.savingsSlider.value = gameState.lastSavingsPercent;
    uiElements.growthRatioSlider.value = gameState.lastGrowthRatioPercent;
    updateAllocationPreview();
    uiElements.allocationSection.classList.remove('hidden');
    startAllocationTimer();
}

export function hideAllocationSection() {
    console.log("UI: Hiding Allocation Section..."); // Log
    if (uiElements.allocationSection) {
        uiElements.allocationSection.classList.add('hidden');
    }
    clearAllocationTimer();
    gameState.isPaused = false;
    console.log("UI: Game Unpaused. gameState.isPaused =", gameState.isPaused); // Log state
    if (!gameState.gameOver) {
        console.log("UI: Calling startNewDay()..."); // Log
        startNewDay();
    } else {
        console.log("UI: Game is over, not starting new day."); // Log
    }
}

// --- Updated Allocation Preview ---
function updateAllocationPreview() {
    if (!uiElements.savingsSlider || !uiElements.growthRatioSlider ||
        !uiElements.savingsPercentageUI || !uiElements.growthRatioPercentageUI ||
        !uiElements.allocationAvailableCarbonUI || !uiElements.allocationSpentCarbonUI ||
        !uiElements.allocationGrowthResultUI || !uiElements.allocationSeedsResultUI ||
        !uiElements.allocationSavedCarbonUI)
    { console.warn("Missing UI elements for allocation preview."); return; }

    const availableCarbon = Math.floor(gameState.carbonStorage);
    const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
    const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;

    uiElements.savingsPercentageUI.textContent = `${savingsPercent}%`;
    const seedRatioPercent = 100 - growthRatioPercent;
    uiElements.growthRatioPercentageUI.textContent = `${growthRatioPercent}% G / ${seedRatioPercent}% S`;

    const clampedSavingsPercent = Math.max(0, Math.min(100, savingsPercent));
    const carbonToSpend = Math.floor(availableCarbon * (1 - clampedSavingsPercent / 100));
    const clampedGrowthRatioPercent = Math.max(0, Math.min(100, growthRatioPercent));
    const carbonForGrowth = Math.floor(carbonToSpend * (clampedGrowthRatioPercent / 100));
    const carbonForSeeds = carbonToSpend - carbonForGrowth;
    const seedsToMake = carbonForSeeds;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const actualCarbonForGrowth = carbonForGrowth;
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    const finalSavings = availableCarbon - totalSpent;

    uiElements.allocationSpentCarbonUI.textContent = totalSpent;
    uiElements.allocationGrowthResultUI.textContent = actualCarbonForGrowth;
    uiElements.allocationSeedsResultUI.textContent = seedsToMake;
    uiElements.allocationSavedCarbonUI.textContent = finalSavings;
}


// --- Timer Logic ---
function startAllocationTimer() {
    clearAllocationTimer();
    let timeLeft = Config.ALLOCATION_TIMER_DURATION;
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
        // Random logic...
        const targetSpend = Math.floor(available * 0.5);
        const growthTarget = Math.floor(targetSpend * 0.5);
        const seedTarget = targetSpend - growthTarget;
        seedsToMake = Math.max(0, seedTarget);
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        actualCarbonForGrowth = Math.max(0, targetSpend - actualCarbonForSeeds);
        actualCarbonForGrowth = Math.min(growthTarget, actualCarbonForGrowth);
        console.log("UI: Using RANDOM allocation strategy.");
    } else {
        // Manual logic...
        if (!uiElements.savingsSlider || !uiElements.growthRatioSlider) {
             console.error("Allocation slider elements missing for manual submission!");
             hideAllocationSection(); return;
        }
        const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
        const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;
        gameState.lastSavingsPercent = savingsPercent; // Store last used values
        gameState.lastGrowthRatioPercent = growthRatioPercent;
        console.log(`UI: Storing last slider values: Savings=${savingsPercent}%, GrowthRatio=${growthRatioPercent}%`);
        const clampedSavingsPercent = Math.max(0, Math.min(100, savingsPercent));
        const carbonToSpend = Math.floor(available * (1 - clampedSavingsPercent / 100));
        const clampedGrowthRatioPercent = Math.max(0, Math.min(100, growthRatioPercent));
        actualCarbonForGrowth = Math.floor(carbonToSpend * (clampedGrowthRatioPercent / 100));
        const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
        seedsToMake = carbonForSeeds;
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        console.log("UI: Using MANUAL allocation from sliders.");
    }

    // Apply allocation...
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    console.log(`UI: Calculated - Growth=${actualCarbonForGrowth}, Seeds=${seedsToMake}, Spent=${totalSpent}, Available=${available}`); // Log amounts

    // Sanity checks...
    if (totalSpent > available + 0.01) {
        console.error(`UI CRITICAL ERROR: Spend ${totalSpent} > Available ${available}. Aborting allocation.`);
        showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else if (totalSpent < 0) {
         console.error(`UI CRITICAL ERROR: Spend ${totalSpent} is negative. Aborting allocation.`);
         showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else {
        // Apply changes if valid
        gameState.carbonStorage -= totalSpent;
        gameState.seedCount += seedsToMake;
        if (actualCarbonForGrowth > 0) { growTree(gameState, actualCarbonForGrowth); }
        console.log(`UI: Allocation Applied. State Updated.`); // Log success
    }

    // Finalize...
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
        console.log("UI: Proceeding with RANDOM allocation submit on timeout."); // Log
        // showMessage("Time's up! Allocating automatically.", "warning"); // Message shown by submitAllocation now
        submitAllocation(true); // Use random strategy
    } else {
        console.warn("UI: submitRandomAllocation called but game not in correct state.");
        hideAllocationSection();
    }
}


// --- Game Over UI ---
export function showGameOverUI() {
    // ++ Added Logs ++
    console.log("UI: showGameOverUI called."); // Log function start
    if (!uiElements.gameOverModal) {
        console.error("UI ERROR: gameOverModal element not found in showGameOverUI!");
        return;
    }
    if (!uiElements.gameOverReasonUI) {
        console.error("UI ERROR: gameOverReasonUI element not found in showGameOverUI!");
    }

    console.log(`UI: Attempting to display reason: "${gameState.gameOverReason}"`); // Log reason

    // Set text content, checking if elements exist
    if(uiElements.gameOverReasonUI) {
        uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
        console.log("UI: gameOverReasonUI textContent set."); // Log success
    } else {
        console.log("UI: gameOverReasonUI element was missing, couldn't set text."); // Log failure
    }
    if(uiElements.finalDayUI) uiElements.finalDayUI.textContent = gameState.day;
    if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.textContent = gameState.seedCount;

    // Canopy visibility is handled by simulation calling tree function

    // Show the modal
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible."); // Log modal shown
}