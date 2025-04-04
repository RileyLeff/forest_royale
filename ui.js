// UI Module: Handles DOM interactions, updates, and listeners

import { gameState, initializeGameState } from './gameState.js';
import * as Config from './config.js';
import { growTree, updateTreeColors, createPlayerTree, setCanopyVisibility, disposeTreeMaterials } from './tree.js';
import { scene, controls } from './sceneSetup.js'; // Need controls for resetting target

// --- DOM Element References ---
let uiElements = {}; // Object to hold all element references

// Function to grab all necessary DOM elements once
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
        // Allocation Section (and elements inside)
        allocationSection: document.getElementById('allocation-section'),
        allocationDayUI: document.getElementById('allocation-day'),
        availableCarbonUI: document.getElementById('available-carbon'),
        growthSlider: document.getElementById('growth-slider'), // Legacy
        growthPercentageUI: document.getElementById('growth-percentage'), // Legacy
        allocationGrowthCarbonUI: document.getElementById('allocation-growth-carbon'), // Legacy
        allocationSeedCarbonUI: document.getElementById('allocation-seed-carbon'), // Legacy
        allocationSeedCountUI: document.getElementById('allocation-seed-count'), // Legacy
        seedCostInfoUI: document.getElementById('seed-cost-info'), // Legacy
        submitAllocationButton: document.getElementById('submit-allocation'),
        // Game Over Modal
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
    // Check if all essential elements were found (optional)
    for (const key in uiElements) {
        if (!uiElements[key]) {
            console.warn(`UI element not found: ${key}`);
        }
    }
}


// --- Event Listener Setup ---
export function setupUIListeners() {
    if (!uiElements.stomataSlider) return; // Basic check

    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    uiElements.submitAllocationButton.addEventListener('click', handleSubmitAllocation);
    uiElements.restartButton.addEventListener('click', handleRestartGame);
    uiElements.leafColorPicker.addEventListener('input', handleLeafColorChange);
    uiElements.trunkColorPicker.addEventListener('input', handleTrunkColorChange);

    // Listener for legacy growth slider (will be removed/changed in Step 5)
    if (uiElements.growthSlider) {
        uiElements.growthSlider.addEventListener('input', updateAllocationPreview);
    }
}

// --- Event Handlers ---
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

function handleSubmitAllocation() {
    // Clear timer if active (will be added in Step 4)
     if (gameState.allocationTimerId) {
         clearInterval(gameState.allocationTimerId);
         gameState.allocationTimerId = null;
     }

    // --- Logic using legacy slider (will be replaced in Step 5) ---
    const available = Math.floor(gameState.carbonStorage);
    let growthAllocation = 0;
    if(uiElements.growthSlider){
        growthAllocation = parseInt(uiElements.growthSlider.value) || 0;
    } else {
        console.error("Growth slider not found on submit!");
        hideAllocationSection(); // Hide section even if error
        return;
    }
    growthAllocation = Math.min(available, growthAllocation); // Ensure valid amount
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / Config.SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * Config.SEED_COST;
    const actualCarbonForGrowth = available - actualCarbonForSeeds; // Growth gets remainder
    // --- End Legacy Logic ---

    // Apply changes to gameState
    gameState.carbonStorage -= (actualCarbonForGrowth + actualCarbonForSeeds);
    gameState.seedCount += seedsToMake;

    // Apply growth visually
    if (actualCarbonForGrowth > 0) {
        growTree(gameState, actualCarbonForGrowth);
    }

    hideAllocationSection();
    updateUI(); // Update status bars etc. after allocation
}

function handleRestartGame() {
    uiElements.gameOverModal.classList.add('hidden');
    clearMessage();

    // Clean up old tree resources explicitly
    if (gameState.treeMeshGroup) {
         scene.remove(gameState.treeMeshGroup);
         disposeTreeMaterials();
         gameState.treeMeshGroup = null;
    }

    // Reset game state logic
    initializeGameState();
    // Create new tree visuals
    createPlayerTree(gameState);
    // Reset UI display
    updateUI();
    // Reset camera target
    if (controls) {
        controls.target.set(0, gameState.trunkHeight / 2, 0);
    }
     // Ensure simulation is unpaused
     gameState.isPaused = false;
     gameState.gameOver = false;

     console.log("Game Restarted");
}


// --- UI Update Functions ---

// Updates all relevant UI elements based on gameState
export function updateUI() {
    if (!gameState || !uiElements.carbonBar) return; // Basic check

    // Update Status Bars
    uiElements.carbonBar.style.width = `${(gameState.carbonStorage / Config.MAX_CARBON) * 100}%`;
    uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / Config.MAX_HYDRAULIC) * 100}%`;
    uiElements.carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    uiElements.hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);

    // Update Info Text
    uiElements.dayCounterUI.textContent = gameState.day;
    uiElements.seedCounterUI.textContent = gameState.seedCount;
    uiElements.timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);

    // Update Time Left (handled also in simulation loop for countdown)
     const cycleDuration = gameState.timeOfDay === 'day' ? Config.DAY_DURATION_SECONDS : Config.NIGHT_DURATION_SECONDS;
     uiElements.cycleTimerUI.textContent = Math.floor(cycleDuration - gameState.timeInCycle);


    // Ensure controls reflect current state (useful on restart/init)
    uiElements.stomataSlider.value = gameState.stomatalConductance;
    uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    uiElements.leafColorPicker.value = gameState.leafColor;
    uiElements.trunkColorPicker.value = gameState.trunkColor;
}

// Shows a message in the log area
export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        uiElements.messageLogUI.className = `message ${type}`; // Apply class for styling
     }
}

// Clears the message log
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
    uiElements.availableCarbonUI.textContent = availableCarbon;
    uiElements.allocationDayUI.textContent = gameState.day;

    // Setup legacy slider (will change in Step 5)
    if (uiElements.growthSlider) {
        uiElements.growthSlider.max = availableCarbon;
        // Default slider value, ensuring it's not more than available
        uiElements.growthSlider.value = Math.min(availableCarbon, Math.floor(availableCarbon / 2));
    }
    if (uiElements.seedCostInfoUI) uiElements.seedCostInfoUI.textContent = Config.SEED_COST;

    updateAllocationPreview(); // Update text based on initial slider value

    // Show the section
    uiElements.allocationSection.classList.remove('hidden');

    // Start timer (will be added in Step 4)
     // startAllocationTimer();
}

export function hideAllocationSection() {
    if (uiElements.allocationSection) {
        uiElements.allocationSection.classList.add('hidden');
    }
    gameState.isPaused = false; // Resume simulation
}

// Updates the text preview based on allocation choices (Legacy version)
// This will be rewritten in Step 5
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
     // This avoids confusion if slider seems stuck while only seed C changes
     if(uiElements.growthSlider.value != actualCarbonForGrowth) {
          uiElements.growthSlider.value = actualCarbonForGrowth;
     }
}


// --- Game Over UI ---
export function showGameOverUI() {
    if (!uiElements.gameOverModal) return;

    uiElements.gameOverReasonUI.textContent = gameState.gameOverReason;
    uiElements.finalDayUI.textContent = gameState.day;
    uiElements.finalSeedsUI.textContent = gameState.seedCount;

    // Visuals (like hiding canopy) should be triggered elsewhere (e.g., tree.js)
    // setCanopyVisibility(gameState, false); // Or called from simulation logic

    uiElements.gameOverModal.classList.remove('hidden');
}