// client/ui/elements.js
// Caches and exports references to all UI DOM elements.

export let uiElements = {};

export function cacheDOMElements() {
    console.log("UI: Caching DOM elements...");
    uiElements = {
        gameContainer: document.getElementById('game-container'),
        canvas: document.getElementById('game-canvas'),

        // Top Left Elements
        dayCounterUI: document.getElementById('day-counter'),
        timeOfDayUI: document.getElementById('time-of-day'),
        weatherStatusUI: document.getElementById('weather-status'),
        cycleTimerUI: document.getElementById('cycle-timer'),
        messageLogUI: document.getElementById('message-log'),
        // Lobby Elements
        lobbyInfoPanel: document.getElementById('lobby-info'), // Container
        lobbyPlayerCountUI: document.getElementById('lobby-player-count'),
        countdownTimerDisplayUI: document.getElementById('countdown-timer-display'),
        startCountdownButton: document.getElementById('start-countdown-button'),


        // Top Right Elements
        leaderboardTitleUI: document.getElementById('leaderboard-title'), // Title element
        leaderboardListUI: document.getElementById('leaderboard-list'),
        treeCountUI: document.getElementById('tree-count'), // Inside title now

        // Bottom Left Elements
        carbonBar: document.getElementById('carbon-bar'),
        hydraulicBar: document.getElementById('hydraulic-bar'),
        carbonValueUI: document.getElementById('carbon-value'),
        hydraulicValueUI: document.getElementById('hydraulic-value'),
        seedCounterUI: document.getElementById('seed-counter'),

        // Bottom Right Controls
        controlPanelRight: document.getElementById('control-panel-right'), // Container
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
    };

     // Verification log
     let foundCount = 0;
     let missing = [];
     for (const key in uiElements) {
         if (uiElements[key]) {
             foundCount++;
         } else {
             // Only warn for elements expected to exist on game page
             if (document.getElementById('game-canvas')) { // Simple check if we are on game page
                 console.warn(`UI element not found: ${key}`);
                 missing.push(key);
             }
         }
     }
     if (document.getElementById('game-canvas')) {
         console.log(`UI: Cached ${foundCount} game DOM elements. Missing: ${missing.length > 0 ? missing.join(', ') : 'None'}`);
     } else {
          console.log(`UI: Cached ${foundCount} DOM elements (non-game page).`);
     }
}