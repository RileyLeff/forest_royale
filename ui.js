// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js';
import * as Config from './config.js';
import { growTree, updateTreeColors, setCanopyVisibility } from './tree.js';
import { handleRestart } from './main.js';

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
        // Allocation Section
        allocationSection: document.getElementById('allocation-section'),
        allocationDayUI: document.getElementById('allocation-day'),
        allocationTimerUI: document.getElementById('allocation-timer'),
        // Updated Available Carbon ID
        allocationAvailableCarbonUI: document.getElementById('allocation-available-carbon'),

        // NEW Allocation Inputs/Info
        growthInput: document.getElementById('growth-input'),
        seedInput: document.getElementById('seed-input'),
        seedCostInfoUI: document.getElementById('seed-cost-info'), // Keep this one

        // NEW Allocation Summary
        allocationSpentCarbonUI: document.getElementById('allocation-spent-carbon'),
        allocationGrowthResultUI: document.getElementById('allocation-growth-result'), // For summary text
        allocationSeedsResultUI: document.getElementById('allocation-seeds-result'),   // For summary text
        allocationSavedCarbonUI: document.getElementById('allocation-saved-carbon'),

        // Allocation Button
        submitAllocationButton: document.getElementById('submit-allocation'),
        // Game Over Modal
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     // Check new elements
     if (!uiElements.growthInput) console.warn("UI element not found: growth-input");
     if (!uiElements.seedInput) console.warn("UI element not found: seed-input");
     if (!uiElements.allocationAvailableCarbonUI) console.warn("UI element not found: allocation-available-carbon");
     if (!uiElements.allocationSpentCarbonUI) console.warn("UI element not found: allocation-spent-carbon");
     if (!uiElements.allocationSavedCarbonUI) console.warn("UI element not found: allocation-saved-carbon");
     if (!uiElements.allocationGrowthResultUI) console.warn("UI element not found: allocation-growth-result");
     if (!uiElements.allocationSeedsResultUI) console.warn("UI element not found: allocation-seeds-result");
}


// Event Listener Setup
export function setupUIListeners() {
    // Basic check
    if (!uiElements.stomataSlider || !uiElements.submitAllocationButton || !uiElements.restartButton) {
        console.error("Cannot set up UI listeners - essential elements missing.");
        return;
    }

    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.submitAllocationButton.addEventListener('click', handleSubmitAllocationManual);
    uiElements.restartButton.addEventListener('click', handleRestart);
    uiElements.leafColorPicker.addEventListener('input', handleLeafColorChange);
    uiElements.trunkColorPicker.addEventListener('input', handleTrunkColorChange);

    // NEW: Add listeners to new input fields
    if (uiElements.growthInput) {
        uiElements.growthInput.addEventListener('input', updateAllocationPreview);
    } else {
         console.warn("Growth input element not found, listener not added.");
    }
    if (uiElements.seedInput) {
        uiElements.seedInput.addEventListener('input', updateAllocationPreview);
    } else {
         console.warn("Seed input element not found, listener not added.");
    }
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
    updateTreeColors(gameState); // Update tree visuals immediately
}

function handleTrunkColorChange(e) {
    gameState.trunkColor = e.target.value;
    updateTreeColors(gameState); // Update tree visuals immediately
}

function handleSubmitAllocationManual() {
    clearAllocationTimer();
    submitAllocation(false); // Call core logic, indicating not random
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
        uiElements.messageLogUI.className = `message ${type}`; // Apply class for styling
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

    // Update UI display for the section
    if(uiElements.allocationAvailableCarbonUI) uiElements.allocationAvailableCarbonUI.textContent = availableCarbon;
    if(uiElements.allocationDayUI) uiElements.allocationDayUI.textContent = gameState.day;
    if(uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST;

    // Set initial state and constraints for the NEW input fields
    if(uiElements.growthInput) {
        uiElements.growthInput.value = 0; // Start at 0
        uiElements.growthInput.max = availableCarbon; // Set max dynamically
    } else {
        console.warn("Growth input missing in showAllocationSection.");
    }
     if(uiElements.seedInput) {
        uiElements.seedInput.value = 0; // Start at 0
        uiElements.seedInput.max = availableCarbon; // Set max dynamically
    } else {
        console.warn("Seed input missing in showAllocationSection.");
    }

    updateAllocationPreview(); // Update summary text based on initial 0 values

    // Show the section
    uiElements.allocationSection.classList.remove('hidden');

    startAllocationTimer();
}

export function hideAllocationSection() {
    if (uiElements.allocationSection) {
        uiElements.allocationSection.classList.add('hidden');
    }
    // Always clear timer when hiding
    clearAllocationTimer();
    gameState.isPaused = false; // Resume simulation
}

// --- Rewritten Allocation Preview ---
function updateAllocationPreview() {
    // Check if new inputs exist before proceeding
    if (!uiElements.growthInput || !uiElements.seedInput || !uiElements.allocationAvailableCarbonUI) return;

    const availableCarbon = Math.floor(gameState.carbonStorage);

    // Get intended values from input fields, default to 0
    let intendedGrowthCarbon = parseInt(uiElements.growthInput.value) || 0;
    let intendedSeedCarbon = parseInt(uiElements.seedInput.value) || 0;

    // Ensure non-negative values directly on read
    intendedGrowthCarbon = Math.max(0, intendedGrowthCarbon);
    intendedSeedCarbon = Math.max(0, intendedSeedCarbon);

    // Apply constraints: Total allocation cannot exceed available carbon
    let totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
    if (totalIntended > availableCarbon) {
        // Reduce proportionally (or other strategy)
        const excess = totalIntended - availableCarbon;
        const proportionGrowth = totalIntended > 0 ? intendedGrowthCarbon / totalIntended : 0.5;
        const proportionSeed = totalIntended > 0 ? intendedSeedCarbon / totalIntended : 0.5;

        intendedGrowthCarbon = Math.floor(intendedGrowthCarbon - excess * proportionGrowth);
        intendedSeedCarbon = Math.floor(intendedSeedCarbon - excess * proportionSeed);

        // Adjust if still over due to rounding
        totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
        if (totalIntended > availableCarbon) {
            intendedSeedCarbon -= (totalIntended - availableCarbon); // Take remainder from seeds
        }
        // Ensure non-negative again after adjustment
        intendedSeedCarbon = Math.max(0, intendedSeedCarbon);

        // Update input fields visually to reflect the constrained values
        uiElements.growthInput.value = intendedGrowthCarbon;
        uiElements.seedInput.value = intendedSeedCarbon;
    }

    // Calculate results based on constrained values
    const seedsToMake = Math.floor(intendedSeedCarbon / Config.SEED_COST);
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const actualCarbonForGrowth = intendedGrowthCarbon; // Use the (potentially constrained) growth value

    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;
    const carbonSaved = availableCarbon - totalSpent;

    // Update summary text elements, checking they exist
    if(uiElements.allocationSpentCarbonUI) uiElements.allocationSpentCarbonUI.textContent = totalSpent;
    if(uiElements.allocationGrowthResultUI) uiElements.allocationGrowthResultUI.textContent = actualCarbonForGrowth;
    if(uiElements.allocationSeedsResultUI) uiElements.allocationSeedsResultUI.textContent = seedsToMake;
    if(uiElements.allocationSavedCarbonUI) uiElements.allocationSavedCarbonUI.textContent = carbonSaved;
}


// --- Timer Logic ---
function startAllocationTimer() {
    clearAllocationTimer(); // Ensure no previous timer is running
    let timeLeft = Config.ALLOCATION_TIMER_DURATION;
    if (uiElements.allocationTimerUI) {
        uiElements.allocationTimerUI.textContent = timeLeft; // Set initial display
    } else { console.warn("Allocation timer UI element missing."); }

    gameState.allocationTimerId = setInterval(() => {
        timeLeft--;
         if (uiElements.allocationTimerUI) uiElements.allocationTimerUI.textContent = timeLeft;
        if (timeLeft <= 0) { submitRandomAllocation(); } // Timer finished
    }, 1000); // Tick every second
}

function clearAllocationTimer() {
    if (gameState.allocationTimerId !== null) {
        clearInterval(gameState.allocationTimerId);
        gameState.allocationTimerId = null;
    }
}

// --- Rewritten Allocation Submission Logic ---
function submitAllocation(isRandom = false) {
    const available = Math.floor(gameState.carbonStorage);
    let actualCarbonForGrowth = 0;
    let seedsToMake = 0;
    let actualCarbonForSeeds = 0;

    if (isRandom) {
        // --- Random Allocation Strategy ---
        const targetSpend = Math.floor(available * 0.5);
        const growthTarget = Math.floor(targetSpend * 0.5);
        const seedTarget = targetSpend - growthTarget;
        seedsToMake = seedTarget >= 0 ? Math.floor(seedTarget / Config.SEED_COST) : 0;
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        actualCarbonForGrowth = Math.max(0, targetSpend - actualCarbonForSeeds);
        actualCarbonForGrowth = Math.min(growthTarget, actualCarbonForGrowth);
    } else {
        // --- Manual Allocation Strategy (using new inputs) ---
        if (!uiElements.growthInput || !uiElements.seedInput) {
            console.error("Allocation input elements not found for manual submission!");
            hideAllocationSection(); return; // Exit if UI broken
        }
        let intendedGrowthCarbon = parseInt(uiElements.growthInput.value) || 0;
        let intendedSeedCarbon = parseInt(uiElements.seedInput.value) || 0;

        // Ensure non-negative
        intendedGrowthCarbon = Math.max(0, intendedGrowthCarbon);
        intendedSeedCarbon = Math.max(0, intendedSeedCarbon);

        // Re-apply constraints (same logic as preview)
        let totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
        if (totalIntended > available) {
            const excess = totalIntended - available;
            const proportionGrowth = totalIntended > 0 ? intendedGrowthCarbon / totalIntended : 0.5;
            const proportionSeed = totalIntended > 0 ? intendedSeedCarbon / totalIntended : 0.5;
            intendedGrowthCarbon = Math.floor(intendedGrowthCarbon - excess * proportionGrowth);
            intendedSeedCarbon = Math.floor(intendedSeedCarbon - excess * proportionSeed);
            totalIntended = intendedGrowthCarbon + intendedSeedCarbon;
            if (totalIntended > available) { intendedSeedCarbon -= (totalIntended - available); }
            intendedSeedCarbon = Math.max(0, intendedSeedCarbon); // Ensure non-negative after adjustment
        }

        // Calculate final values based on potentially constrained inputs
        seedsToMake = Math.floor(intendedSeedCarbon / Config.SEED_COST);
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
        actualCarbonForGrowth = intendedGrowthCarbon; // Use constrained value
    }

    // --- Apply the final calculated allocation ---
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    // Final sanity checks
    if (totalSpent > available) {
        console.error(`CRITICAL ERROR: Calculated spend ${totalSpent} C exceeds available ${available} C. Aborting allocation.`);
        showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else if (totalSpent < 0) {
         console.error(`CRITICAL ERROR: Calculated spend ${totalSpent} C is negative. Aborting allocation.`);
         showMessage("Error calculating allocation. Allocation cancelled.", "error");
    } else {
        // Deduct carbon (ONLY IF VALID)
        gameState.carbonStorage -= totalSpent;
        // Add seeds
        gameState.seedCount += seedsToMake;
        // Apply growth
        if (actualCarbonForGrowth > 0) {
            growTree(gameState, actualCarbonForGrowth);
        }
        console.log(`Allocated: Growth=${actualCarbonForGrowth}C, Seeds=${seedsToMake} (${actualCarbonForSeeds}C). Spent=${totalSpent}C. Saved=${available-totalSpent}C.`);
    }

    // --- Finalize ---
    hideAllocationSection(); // Hides UI, clears timer, unpauses
    updateUI(); // Update status bars etc. immediately
}


// Called ONLY when the timer runs out
function submitRandomAllocation() {
    clearAllocationTimer(); // Ensure timer is stopped before proceeding
    if (gameState.isPaused && !gameState.gameOver) { // Check state
        console.log("Allocation timer ran out! Making default choice.");
        showMessage("Time's up! Allocating automatically.", "warning");
        submitAllocation(true); // Call core logic with 'isRandom' flag
    } else {
        console.warn("submitRandomAllocation called but game not in correct state.");
        hideAllocationSection(); // Hide section anyway if visible
    }
}


// --- Game Over UI ---
export function showGameOverUI() {
    if (!uiElements.gameOverModal) return;
    if(uiElements.gameOverReasonUI) uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
    if(uiElements.finalDayUI) uiElements.finalDayUI.textContent = gameState.day;
    if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.textContent = gameState.seedCount;
    setCanopyVisibility(gameState, false); // Visual change
    uiElements.gameOverModal.classList.remove('hidden');
}