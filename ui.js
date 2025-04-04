// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js'; // Don't need initializeGameState here directly
import * as Config from './config.js';
import { growTree, updateTreeColors, setCanopyVisibility } from './tree.js'; // Need growTree for random allocation
import { handleRestart } from './main.js'; // Import restart handler from main

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
        availableCarbonUI: document.getElementById('available-carbon'),
        // Timer Element
        allocationTimerUI: document.getElementById('allocation-timer'),
        // Legacy Allocation Controls (will be replaced)
        growthSlider: document.getElementById('growth-slider'),
        growthPercentageUI: document.getElementById('growth-percentage'),
        allocationGrowthCarbonUI: document.getElementById('allocation-growth-carbon'),
        allocationSeedCarbonUI: document.getElementById('allocation-seed-carbon'),
        allocationSeedCountUI: document.getElementById('allocation-seed-count'),
        seedCostInfoUI: document.getElementById('seed-cost-info'),
        // Allocation Button
        submitAllocationButton: document.getElementById('submit-allocation'),
        // Game Over Modal
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     // Simple check if timer exists
     if (!uiElements.allocationTimerUI) console.warn("UI element not found: allocation-timer");
     // Check other critical elements
     if (!uiElements.allocationSection) console.error("Allocation section UI element not found!");
}


// Event Listener Setup
export function setupUIListeners() {
    // Basic check
    if (!uiElements.stomataSlider || !uiElements.submitAllocationButton || !uiElements.restartButton) {
        console.error("Cannot set up UI listeners - essential elements missing.");
        return;
    }

    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    // Rename handler for clarity
    uiElements.submitAllocationButton.addEventListener('click', handleSubmitAllocationManual);
    uiElements.restartButton.addEventListener('click', handleRestart); // Call main restart handler
    uiElements.leafColorPicker.addEventListener('input', handleLeafColorChange);
    uiElements.trunkColorPicker.addEventListener('input', handleTrunkColorChange);

    // Listener for legacy growth slider (will be removed/changed in Step 5)
    if (uiElements.growthSlider) {
        uiElements.growthSlider.addEventListener('input', updateAllocationPreview);
    } else {
        console.warn("Legacy growth slider not found - preview update disabled.");
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

// Renamed: Handles manual click on the submit button
function handleSubmitAllocationManual() {
    // Always clear the timer when submitting manually
    clearAllocationTimer();
    // Proceed with the allocation logic
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

    gameState.isPaused = true; // Pause simulation when allocation starts
    const availableCarbon = Math.floor(gameState.carbonStorage);

    // Update UI elements within the allocation section
    if(uiElements.availableCarbonUI) uiElements.availableCarbonUI.textContent = availableCarbon;
    if(uiElements.allocationDayUI) uiElements.allocationDayUI.textContent = gameState.day;

    // Setup legacy slider (will change in Step 5)
    if (uiElements.growthSlider) {
        uiElements.growthSlider.max = availableCarbon;
        // Default slider value, ensuring it's not more than available
        uiElements.growthSlider.value = Math.min(availableCarbon, Math.floor(availableCarbon / 2));
    } else {
        console.warn("Legacy growth slider not found in showAllocationSection.");
    }
    if (uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST;

    updateAllocationPreview(); // Update text based on initial slider value

    // Show the section
    uiElements.allocationSection.classList.remove('hidden');

    // Start Allocation Timer
    startAllocationTimer();
}

export function hideAllocationSection() {
    if (uiElements.allocationSection) {
        uiElements.allocationSection.classList.add('hidden');
    }
    // Always clear timer when hiding (might be hidden manually or via submit)
    clearAllocationTimer();
    gameState.isPaused = false; // Resume simulation
}

// Updates the text preview based on allocation choices (Legacy version)
function updateAllocationPreview() {
    if (!uiElements.growthSlider) return; // Only run if legacy elements exist

    const available = Math.floor(gameState.carbonStorage);
    let growthAllocation = parseInt(uiElements.growthSlider.value) || 0;

    // Clamp value and update slider visually if needed
    growthAllocation = Math.max(0, Math.min(available, growthAllocation));
    uiElements.growthSlider.value = growthAllocation;
    uiElements.growthSlider.max = available; // Update max in case available C changed

    const growthPercent = available > 0 ? Math.round((growthAllocation / available) * 100) : 0;
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / Config.SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    // Growth gets whatever is left after integer seeds are paid for
    const actualCarbonForGrowth = available - actualCarbonForSeeds;

    // Update UI text elements
    if(uiElements.growthPercentageUI) uiElements.growthPercentageUI.textContent = growthPercent;
    if(uiElements.allocationGrowthCarbonUI) uiElements.allocationGrowthCarbonUI.textContent = actualCarbonForGrowth;
    if(uiElements.allocationSeedCarbonUI) uiElements.allocationSeedCarbonUI.textContent = actualCarbonForSeeds;
    if(uiElements.allocationSeedCountUI) uiElements.allocationSeedCountUI.textContent = seedsToMake;

     // Re-adjust slider if seed granularity changed the growth amount available
     if(uiElements.growthSlider.value != actualCarbonForGrowth) {
          uiElements.growthSlider.value = actualCarbonForGrowth;
     }
}


// --- Timer Logic ---

function startAllocationTimer() {
    clearAllocationTimer(); // Ensure no previous timer is running

    let timeLeft = Config.ALLOCATION_TIMER_DURATION;
    if (uiElements.allocationTimerUI) {
        uiElements.allocationTimerUI.textContent = timeLeft; // Set initial display
    } else {
        console.warn("Allocation timer UI element missing.");
    }


    gameState.allocationTimerId = setInterval(() => {
        timeLeft--;
         if (uiElements.allocationTimerUI) {
            uiElements.allocationTimerUI.textContent = timeLeft;
         }

        if (timeLeft <= 0) {
            // Timer finished, trigger random allocation
            submitRandomAllocation();
        }
    }, 1000); // Tick every second
}

function clearAllocationTimer() {
    if (gameState.allocationTimerId !== null) {
        clearInterval(gameState.allocationTimerId);
        gameState.allocationTimerId = null;
    }
}

// --- Allocation Submission (Core Logic, used by manual & random) ---

// This function contains the logic to actually process an allocation decision
function submitAllocation(isRandom = false) {
     // --- Determine Allocation Amounts ---
     const available = Math.floor(gameState.carbonStorage);
     let actualCarbonForGrowth = 0;
     let seedsToMake = 0;
     let actualCarbonForSeeds = 0; // Initialize here

     if (isRandom) {
        // --- Random (Default) Allocation Strategy ---
        // Example: Spend ~50% total, split ~equally between growth/seeds, save the rest
        const targetSpend = Math.floor(available * 0.5);
        // Prioritize growth slightly? Or seeds? Let's try splitting the target spend.
        const growthTarget = Math.floor(targetSpend * 0.5);
        const seedTarget = targetSpend - growthTarget;

        seedsToMake = seedTarget >= 0 ? Math.floor(seedTarget / Config.SEED_COST) : 0;
        actualCarbonForSeeds = seedsToMake * Config.SEED_COST;

        // Growth gets the remaining part of the target spend, make sure it's not negative
        actualCarbonForGrowth = Math.max(0, targetSpend - actualCarbonForSeeds);
        // Ensure we don't somehow spend more than allocated growth target (due to seed cost granularity)
        actualCarbonForGrowth = Math.min(growthTarget, actualCarbonForGrowth);


     } else {
         // --- Manual Allocation Strategy (using legacy slider for now) ---
         if(uiElements.growthSlider){
             const growthAllocationSlider = parseInt(uiElements.growthSlider.value) || 0;
             // Clamp slider value to what's available
             const growthAllocationClamped = Math.min(available, growthAllocationSlider);
             const carbonForSeeds = available - growthAllocationClamped;
             seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / Config.SEED_COST) : 0;
             actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
             // Growth gets exactly what's left after seeds are paid for
             actualCarbonForGrowth = available - actualCarbonForSeeds;
         } else {
              console.error("Growth slider not found for manual allocation!");
              // Fallback: Allocate nothing if UI is broken
              seedsToMake = 0;
              actualCarbonForGrowth = 0;
              actualCarbonForSeeds = 0;
         }
     }

    // --- Apply the calculated allocation ---
    const totalSpent = actualCarbonForGrowth + actualCarbonForSeeds;

    // Sanity check: ensure we don't spend more than available
    if (totalSpent > available) {
        console.error(`Attempted to spend ${totalSpent} C, but only ${available} available. Resetting allocation.`);
        actualCarbonForGrowth = 0;
        actualCarbonForSeeds = 0;
        seedsToMake = 0;
    } else {
        // Deduct carbon
        gameState.carbonStorage -= totalSpent;

        // Add seeds
        gameState.seedCount += seedsToMake;

        // Apply growth visually/logically
        if (actualCarbonForGrowth > 0) {
            growTree(gameState, actualCarbonForGrowth);
        }
    }


    // --- Finalize ---
    // Hide UI and resume simulation (hideAllocationSection handles this)
    hideAllocationSection();
    updateUI(); // Update status bars etc. immediately
}


// Called ONLY when the timer runs out
function submitRandomAllocation() {
    clearAllocationTimer(); // Ensure timer is stopped before proceeding
    // Double check we are in the right state (paused for allocation, game not over)
    if (gameState.isPaused && !gameState.gameOver) {
        console.log("Allocation timer ran out! Making default choice.");
        showMessage("Time's up! Allocating automatically.", "warning");
        submitAllocation(true); // Call core logic with 'isRandom' flag
    } else {
        // This case shouldn't normally happen if logic is correct
        console.warn("submitRandomAllocation called but game not in paused allocation state.");
        hideAllocationSection(); // Hide section anyway if it was somehow visible
    }
}


// --- Game Over UI ---
export function showGameOverUI() {
    if (!uiElements.gameOverModal) return;

    uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
    uiElements.finalDayUI.textContent = gameState.day;
    uiElements.finalSeedsUI.textContent = gameState.seedCount;

    // Hide the canopy (visual change handled by simulation calling tree.js function)
    setCanopyVisibility(gameState, false);

    uiElements.gameOverModal.classList.remove('hidden');
}