// UI Module: Handles DOM interactions, updates, and listeners

import { gameState } from './gameState.js';
import * as Config from './config.js';
// Only need setCanopyVisibility from tree.js for game over
import { setCanopyVisibility } from './tree.js';
import { handleRestart } from './main.js';
// No simulation imports needed now

// DOM Element References (cached)
let uiElements = {};

export function cacheDOMElements() {
    uiElements = {
        gameContainer: document.getElementById('game-container'), canvas: document.getElementById('game-canvas'),
        dayCounterUI: document.getElementById('day-counter'), timeOfDayUI: document.getElementById('time-of-day'),
        weatherStatusUI: document.getElementById('weather-status'), cycleTimerUI: document.getElementById('cycle-timer'),
        messageLogUI: document.getElementById('message-log'), leaderboardListUI: document.getElementById('leaderboard-list'),
        treeCountUI: document.getElementById('tree-count'), carbonBar: document.getElementById('carbon-bar'),
        hydraulicBar: document.getElementById('hydraulic-bar'), carbonValueUI: document.getElementById('carbon-value'),
        hydraulicValueUI: document.getElementById('hydraulic-value'), seedCounterUI: document.getElementById('seed-counter'),
        stomataSlider: document.getElementById('stomata-slider'), stomataValueUI: document.getElementById('stomata-value'),
        savingsSlider: document.getElementById('savings-slider'), savingsPercentageUI: document.getElementById('savings-percentage'),
        growthRatioSlider: document.getElementById('growth-ratio-slider'), growthRatioPercentageUI: document.getElementById('growth-ratio-percentage'),
        gameOverModal: document.getElementById('game-over-modal'), gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'), finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),
    };
     console.log("Checking DOM elements...");
     for (const key in uiElements) { if (!uiElements[key]) console.warn(`UI element not found: ${key}`); }
     console.log("DOM elements cached.");
}


// Event Listener Setup
export function setupUIListeners() {
    if (!uiElements.stomataSlider || !uiElements.restartButton || !uiElements.savingsSlider || !uiElements.growthRatioSlider) {
        console.error("Cannot set up UI listeners - essential controls missing."); return;
    }
    uiElements.stomataSlider.addEventListener('input', handleStomataChange);
    // Ensure restart button exists before adding listener
    if (uiElements.restartButton) {
        uiElements.restartButton.addEventListener('click', handleRestart); // Calls handler in main.js
    } else {
         console.error("Restart button not found!");
    }
    uiElements.savingsSlider.addEventListener('input', handleAllocationSliderChange);
    uiElements.growthRatioSlider.addEventListener('input', handleAllocationSliderChange);
}

// Event Handlers
function handleStomataChange(e) {
    gameState.stomatalConductance = parseFloat(e.target.value);
    if (uiElements.stomataValueUI) uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
}

function handleAllocationSliderChange() {
    if (!uiElements.savingsSlider || !uiElements.growthRatioSlider || !uiElements.savingsPercentageUI || !uiElements.growthRatioPercentageUI) return;
    const savingsPercent = parseInt(uiElements.savingsSlider.value) || 0;
    const growthRatioPercent = parseInt(uiElements.growthRatioSlider.value) || 0;
    uiElements.savingsPercentageUI.textContent = `${savingsPercent}%`;
    const seedRatioPercent = 100 - growthRatioPercent;
    uiElements.growthRatioPercentageUI.textContent = `${growthRatioPercent}%/${seedRatioPercent}%`;
    gameState.lastSavingsPercent = savingsPercent;
    gameState.lastGrowthRatioPercent = growthRatioPercent;
}


// --- UI Update Functions ---
export function updateUI() {
    if (!gameState) return;

    // Update Status Bars (Bottom Left)
    if (uiElements.carbonBar) uiElements.carbonBar.style.width = `${(gameState.carbonStorage / Config.MAX_CARBON) * 100}%`;
    if (uiElements.hydraulicBar) uiElements.hydraulicBar.style.width = `${(gameState.hydraulicSafety / Config.MAX_HYDRAULIC) * 100}%`;
    if (uiElements.carbonValueUI) uiElements.carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    if (uiElements.hydraulicValueUI) uiElements.hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);
    if (uiElements.seedCounterUI) uiElements.seedCounterUI.textContent = gameState.seedCount;

    // Update Info (Top Left)
    if (uiElements.dayCounterUI) uiElements.dayCounterUI.textContent = gameState.day;
    if (uiElements.timeOfDayUI) uiElements.timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);
    // Update Cycle Timer - showing time left until next allocation/day increment
    const allocationCycleLength = Config.DAY_DURATION_SECONDS;
    const timeSinceLastCycleStart = gameState.timeInCycle % allocationCycleLength;
    const timeLeftInCycle = Math.max(0, allocationCycleLength - timeSinceLastCycleStart);
    if (uiElements.cycleTimerUI) uiElements.cycleTimerUI.textContent = Math.floor(timeLeftInCycle);
    if (uiElements.weatherStatusUI) uiElements.weatherStatusUI.textContent = gameState.droughtFactor > 1.1 ? "Dry" : "Clear";


    // Update Controls (Bottom Bar) - Ensure sliders reflect gameState
    if (uiElements.stomataSlider && parseFloat(uiElements.stomataSlider.value) !== gameState.stomatalConductance) {
        uiElements.stomataSlider.value = gameState.stomatalConductance;
    }
    if (uiElements.stomataValueUI) uiElements.stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    if (uiElements.savingsSlider && parseInt(uiElements.savingsSlider.value) !== gameState.lastSavingsPercent) {
         uiElements.savingsSlider.value = gameState.lastSavingsPercent;
    }
     if (uiElements.savingsPercentageUI) uiElements.savingsPercentageUI.textContent = `${gameState.lastSavingsPercent}%`;
    if (uiElements.growthRatioSlider && parseInt(uiElements.growthRatioSlider.value) !== gameState.lastGrowthRatioPercent) {
        uiElements.growthRatioSlider.value = gameState.lastGrowthRatioPercent;
    }
     if (uiElements.growthRatioPercentageUI) {
        const seedRatioPercent = 100 - gameState.lastGrowthRatioPercent;
        uiElements.growthRatioPercentageUI.textContent = `${gameState.lastGrowthRatioPercent}%/${seedRatioPercent}%`;
     }

    // Update Leaderboard (Top Right - Basic for SP)
     if (uiElements.leaderboardListUI) { uiElements.leaderboardListUI.innerHTML = `<li>${gameState.playerName || 'Player'}: ${gameState.seedCount} Seeds</li>`; }
     if (uiElements.treeCountUI) { uiElements.treeCountUI.textContent = gameState.gameOver ? 0 : 1; }
}

export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) { uiElements.messageLogUI.textContent = text; uiElements.messageLogUI.className = `message ${type}`; }
     else { console.warn("Message log UI element not found:", text); }
}

export function clearMessage() {
    if (uiElements.messageLogUI) { uiElements.messageLogUI.textContent = ''; uiElements.messageLogUI.className = 'message'; }
}


// --- Game Over UI ---
export function showGameOverUI() {
    console.log("UI: showGameOverUI called.");
    if (!uiElements.gameOverModal) { console.error("UI ERROR: gameOverModal element not found!"); return; }
    if (!uiElements.gameOverReasonUI) { console.error("UI ERROR: gameOverReasonUI element not found!"); }
    console.log(`UI: Attempting to display reason: "${gameState.gameOverReason}"`);
    if(uiElements.gameOverReasonUI) { uiElements.gameOverReasonUI.textContent = gameState.gameOverReason; console.log("UI: gameOverReasonUI textContent set."); }
    else { console.log("UI: gameOverReasonUI element was missing."); }
    if(uiElements.finalDayUI) uiElements.finalDayUI.textContent = gameState.day;
    if(uiElements.finalSeedsUI) uiElements.finalSeedsUI.textContent = gameState.seedCount;
    setCanopyVisibility(false); // Assumes reads gameState directly
    uiElements.gameOverModal.classList.remove('hidden');
    console.log("UI: Game over modal made visible.");
}

// ++ NEW Exported function to hide the modal ++
export function hideGameOverModal() {
    if (uiElements.gameOverModal) {
        uiElements.gameOverModal.classList.add('hidden');
        console.log("UI: Game over modal hidden.");
    } else {
        console.warn("UI: Tried to hide game over modal, but element not found.");
    }
}