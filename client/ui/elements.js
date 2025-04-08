// ui/elements.js
// Caches and exports references to all UI DOM elements.

// Object to hold all element references
export let uiElements = {};

// Function to grab all necessary DOM elements once
export function cacheDOMElements() {
    console.log("UI: Caching DOM elements..."); // Log caching start
    uiElements = {
        gameContainer: document.getElementById('game-container'),
        canvas: document.getElementById('game-canvas'),

        // Top Left Elements
        dayCounterUI: document.getElementById('day-counter'),
        timeOfDayUI: document.getElementById('time-of-day'),
        weatherStatusUI: document.getElementById('weather-status'),
        cycleTimerUI: document.getElementById('cycle-timer'),
        messageLogUI: document.getElementById('message-log'),

        // Top Right Elements
        leaderboardListUI: document.getElementById('leaderboard-list'),
        treeCountUI: document.getElementById('tree-count'),

        // Bottom Left Elements
        carbonBar: document.getElementById('carbon-bar'),
        hydraulicBar: document.getElementById('hydraulic-bar'),
        carbonValueUI: document.getElementById('carbon-value'),
        hydraulicValueUI: document.getElementById('hydraulic-value'),
        seedCounterUI: document.getElementById('seed-counter'),

        // Bottom Bar Controls
        stomataSlider: document.getElementById('stomata-slider'),
        stomataValueUI: document.getElementById('stomata-value'),
        savingsSlider: document.getElementById('savings-slider'),
        savingsPercentageUI: document.getElementById('savings-percentage'),
        growthRatioSlider: document.getElementById('growth-ratio-slider'),
        growthRatioPercentageUI: document.getElementById('growth-ratio-percentage'),

        // Game Over Elements
        gameOverModal: document.getElementById('game-over-modal'),
        gameOverReasonUI: document.getElementById('game-over-reason'),
        finalDayUI: document.getElementById('final-day'),
        finalSeedsUI: document.getElementById('final-seeds'),
        restartButton: document.getElementById('restart-button'),

        // Add any other elements referenced elsewhere if needed
        // (e.g., if specific info spans inside allocation summary were kept)
    };

     // Verification log
     let foundCount = 0;
     let missing = [];
     for (const key in uiElements) {
         if (uiElements[key]) {
             foundCount++;
         } else {
             console.warn(`UI element not found: ${key}`);
             missing.push(key);
         }
     }
     console.log(`UI: Cached ${foundCount} DOM elements. Missing: ${missing.length > 0 ? missing.join(', ') : 'None'}`);
     // Could add a stricter check here if needed:
     // if (missing.length > 0) throw new Error("Critical UI elements missing!");
}

// Note: cacheDOMElements() needs to be called once at startup (e.g., in main.js)