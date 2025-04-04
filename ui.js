// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js';
import * as Config from './config.js';
import { growTree, updateTreeColors, setCanopyVisibility } from './tree.js';
import { handleRestart } from './main.js';
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
        // ++ NEW Slider Elements ++
        savingsSlider: document.getElementById('savings-slider'),
        savingsPercentageUI: document.getElementById('savings-percentage'),
        growthRatioSlider: document.getElementById('growth-ratio-slider'),
        growthRatioPercentageUI: document.getElementById('growth-ratio-percentage'),
        seedCostInfoUI: document.getElementById('seed-cost-info'), // Keep
        // Allocation Summary Elements
        allocationSpentCarbonUI: document.getElementById('allocation-spent-carbon'),
        allocationGrowthResultUI: document.getElementById('allocation-growth-result'),
        allocationSeedsResultUI: document.getElementById('allocation-seeds-result'),
        allocationSavedCarbonUI: document.getElementById('allocation-saved-carbon'),
        // Submit Button
        submitAllocationButton: document.getElementById('submit-allocation'),

        // Game Over Elements
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     // Checks for elements
     if (!uiElements.savingsSlider) console.warn("UI element not found: savings-slider");
     if (!uiElements.growthRatioSlider) console.warn("UI element not found: growth-ratio-slider");
     if (!uiElements.allocationSection) console.error("Allocation section UI element not found!");
     // ... other checks
}


// Event Listener Setup
export function setupUIListeners() {
    if (!uiElements.stomataSlider || !uiElements.submitAllocationButton || !uiElements.restartButton) {
        console.error("Cannot set up UI listeners - essential elements missing.");
        return;
    }
    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.submitAllocationButton.addEventListener('click', handleSubmitAllocationManual);
    uiElements.restartButton.addEventListener('click', handleRestart);
    uiElements.leafColorPicker.addEventListener('input', handleLeafColorChange);
    uiElements.trunkColorPicker.addEventListener('input', handleTrunkColorChange);

    // ++ NEW: Add listeners to new sliders ++
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

function handleSubmitAllocationManual() {
    console.log("UI: Handling Manual Submit Click");
    clearAllocationTimer();
    submitAllocation(false); // Indicate manual submission
}


// --- UI Update Functions ---
export function updateUI() {
    if (!gameState || !uiElements.carbonBar) return;
    // Update Status Bars, Info Text, Controls (no changes here)
    if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(gameState.carbonStorage / Config.MAX_CARBON) * 100}%`;
    if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / Config.MAX_HYDRAULIC) * 100}%`;
    if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = gameState.day;
    if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = gameState.seedCount;
    if (uiElements.timeOfDayUI) uiElements.timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);
    const cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
    const timeLeftInCycle = Math.max(0, cycleDuration - gameState.timeInCycle);
    if (uiElements.cycleTimerUI) uiElements.cycleTimerUI.textContent = Math.floor(timeLeftInCycle);
    if (uiElements.stomataSlider) uiElements.stomataSlider.value = gameState.stomatalConductance;
    if (uiElements.stomataValueUI) uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    if (uiElements.leafColorPicker) uiElements.leafColorPicker.value = gameState.leafColor;
    if (uiElements.trunkColorPicker) uiElements.trunkColorPicker.value = gameState.trunkColor;
}
export function showMessage(text, type = 'info') { /* ... no changes ... */ }
export function clearMessage() { /* ... no changes ... */ }


// --- Allocation Section Handling ---

export function showAllocationSection() {
    if (gameState.gameOver || !uiElements.allocationSection || !uiElements.savingsSlider || !uiElements.growthRatioSlider) return;

    gameState.isPaused = true;
    const availableCarbon = Math.floor(gameState.carbonStorage);

    // Update static text
    if(uiElements.allocationAvailableCarbonUI) uiElements.allocationAvailableCarbonUI.textContent = availableCarbon;
    if(uiElements.allocationDayUI) uiElements.allocationDayUI.textContent = gameState.day;
    if(uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST;

    // ++ Set Sliders to LAST USED values from gameState ++
    uiElements.savingsSlider.value = gameState.lastSavingsPercent;
    uiElements.growthRatioSlider.value = gameState.lastGrowthRatioPercent;
    // Update slider max values based on available carbon (though they are 0-100%)
    // uiElements.savingsSlider.max = 100; // Fixed percentage
    // uiElements.growthRatioSlider.max = 100; // Fixed percentage

    updateAllocationPreview(); // Update percentage text and summary based on loaded slider values

    // Show section & start timer
    uiElements.allocationSection.classList.remove('hidden');
    startAllocationTimer(); // Starts the 10-second timer
}

export function hideAllocationSection() {
    if (uiElements.allocationSection) uiElements.allocationSection.classList.add('hidden');
    clearAllocationTimer();
    gameState.isPaused = false;
    if (!gameState.gameOver) startNewDay(); // Trigger next day immediately
}

// --- Rewritten Allocation Preview based on Sliders ---
function updateAllocationPreview() {
    // Ensure elements exist
    if (!uiElements.savingsSlider || !uiElements.growthRatioSlider ||
        !uiElements.savingsPercentageUI || !uiElements.growthRatioPercentageUI ||
        !uiElements.allocationAvailableCarbonUI || !uiElements.allocationSpentCarbonUI ||
        !uiElements.allocationGrowthResultUI || !uiElements.allocationSeedsResultUI ||
        !uiElements.allocationSavedCarbonUI)
    {
        console.warn("Missing UI elements for allocation preview.");
        return;
    }

    const availableCarbon = Math.floor(gameState.carbonStorage);

    // --- Read Slider Values ---
    const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
    const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;

    // --- Update Slider Percentage Displays ---
    uiElements.savingsPercentageUI.textContent = `${savingsPercent}%`;
    const seedRatioPercent = 100 - growthRatioPercent;
    uiElements.growthRatioPercentageUI.textContent = `${growthRatioPercent}% G / ${seedRatioPercent}% S`;

    // --- Perform Calculations ---
    // Clamp savingsPercent just in case
    const clampedSavingsPercent = Math.max(0, Math.min(100, savingsPercent));
    const carbonToSpend = Math.floor(availableCarbon * (1 - clampedSavingsPercent / 100));

    // Clamp growthRatioPercent just in case
    const clampedGrowthRatioPercent = Math.max(0, Math.min(100, growthRatioPercent));
    const carbonForGrowth = Math.floor(carbonToSpend * (clampedGrowthRatioPercent / 100));
    // Remainder goes to seeds
    const carbonForSeeds = carbonToSpend - carbonForGrowth;

    // Since SEED_COST = 1
    const seedsToMake = carbonForSeeds;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST; // = carbonForSeeds

    const actualCarbonForGrowth = carbonForGrowth; // Use calculated value

    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    const finalSavings = availableCarbon - totalSpent; // Should equal available * savings% (approx due to floor)

    // --- Update Summary Text ---
    uiElements.allocationSpentCarbonUI.textContent = totalSpent;
    uiElements.allocationGrowthResultUI.textContent = actualCarbonForGrowth;
    uiElements.allocationSeedsResultUI.textContent = seedsToMake;
    uiElements.allocationSavedCarbonUI.textContent = finalSavings;
}


// --- Timer Logic ---
function startAllocationTimer() {
    clearAllocationTimer();
    let timeLeft = Config.ALLOCATION_TIMER_DURATION; // Uses 10s
    if (uiElements.allocationTimerUI) { uiElements.allocationTimerUI.textContent = timeLeft; }
    else { console.warn("Allocation timer UI element missing."); }
    gameState.allocationTimerId = setInterval(() => {
        timeLeft--;
         if (uiElements.allocationTimerUI) { uiElements.allocationTimerUI.textContent = timeLeft; }
        if (timeLeft <= 0) { submitRandomAllocation(); } // Use RANDOM logic on timeout now
    }, 1000);
}

function clearAllocationTimer() {
    if (gameState.allocationTimerId !== null) {
        clearInterval(gameState.allocationTimerId);
        gameState.allocationTimerId = null;
    }
}

// --- Rewritten Allocation Submission Logic for Sliders ---
function submitAllocation(isRandom = false) {
    console.log(`UI: submitAllocation called (isRandom: ${isRandom})`);
    const available = Math.floor(gameState.carbonStorage);
    let actualCarbonForGrowth = 0;
    let seedsToMake = 0;
    let actualCarbonForSeeds = 0;

    if (isRandom) {
        // --- Random Allocation Strategy (on timeout) ---
        // Keep previous random logic: ~50% spend target, split 50/50 G/S
        // DO NOT update last slider values here
        const targetSpend = Math.floor(available * 0.5);
        const growthTarget = Math.floor(targetSpend * 0.5);
        const seedTarget = targetSpend - growthTarget;
        seedsToMake = Math.max(0, seedTarget); // Seeds = C since cost=1
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST; // = seedsToMake
        actualCarbonForGrowth = Math.max(0, targetSpend - actualCarbonForSeeds);
        actualCarbonForGrowth = Math.min(growthTarget, actualCarbonForGrowth);
        console.log("UI: Using RANDOM allocation strategy.");

    } else {
        // --- Manual Allocation Strategy (from sliders) ---
        if (!uiElements.savingsSlider || !uiElements.growthRatioSlider) {
            console.error("Allocation slider elements missing for manual submission!");
            hideAllocationSection(); return; // Exit if UI broken
        }
        // Read current slider values AT SUBMISSION TIME
        const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
        const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;

        // ** Store these values for next round **
        gameState.lastSavingsPercent = savingsPercent;
        gameState.lastGrowthRatioPercent = growthRatioPercent;
        console.log(`UI: Storing last slider values: Savings=${savingsPercent}%, GrowthRatio=${growthRatioPercent}%`);

        // Perform calculations based on these submitted slider values
        const clampedSavingsPercent = Math.max(0, Math.min(100, savingsPercent));
        const carbonToSpend = Math.floor(available * (1 - clampedSavingsPercent / 100));
        const clampedGrowthRatioPercent = Math.max(0, Math.min(100, growthRatioPercent));
        actualCarbonForGrowth = Math.floor(carbonToSpend * (clampedGrowthRatioPercent / 100));
        const carbonForSeeds = carbonToSpend - actualCarbonForGrowth;
        seedsToMake = carbonForSeeds; // Since cost = 1
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST; // = seedsToMake
        console.log("UI: Using MANUAL allocation from sliders.");
    }

    // --- Apply the final calculated allocation ---
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    console.log(`UI: Applying - Growth=${actualCarbonForGrowth}C, Seeds=${seedsToMake}, Spent=${totalSpent}C, Available=${available}C`);

    // Final sanity checks
    if (totalSpent > available + 0.01) { // Add small tolerance for potential floating point issues
        console.error(`CRITICAL ERROR: Calculated spend ${totalSpent} > Available ${available}. Aborting.`);
        showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else if (totalSpent < 0) {
         console.error(`CRITICAL ERROR: Calculated spend ${totalSpent} is negative. Aborting.`);
         showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else {
        // Deduct carbon
        gameState.carbonStorage -= totalSpent;
        // Add seeds
        gameState.seedCount += seedsToMake;
        // Apply growth
        if (actualCarbonForGrowth > 0) {
            growTree(gameState, actualCarbonForGrowth);
        }
        const finalSavings = available - totalSpent;
        console.log(`UI: Allocation Applied. Carbon Left=${gameState.carbonStorage.toFixed(1)}, Seeds Made=${seedsToMake}, Final Savings=${finalSavings}`);
    }

    // --- Finalize ---
    hideAllocationSection(); // Hides UI, clears timer, unpauses, calls startNewDay
    updateUI(); // Update status bars etc. immediately
}


// Called ONLY when the timer runs out
function submitRandomAllocation() {
    console.log("UI: submitRandomAllocation called by timer");
    clearAllocationTimer();
    if (gameState.isPaused && !gameState.gameOver) {
        console.log("UI: Proceeding with RANDOM allocation submit on timeout.");
        showMessage("Time's up! Allocating automatically.", "warning");
        submitAllocation(true); // Call core logic with 'isRandom' flag
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