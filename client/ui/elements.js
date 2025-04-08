// client/ui/elements.js
export let uiElements = {};
export function cacheDOMElements() {
    console.log("UI: Caching DOM elements...");
    uiElements = {
        gameContainer: document.getElementById('game-container'),
        canvas: document.getElementById('game-canvas'),

        // +++ Add Back Button +++
        backButton: document.getElementById('back-to-menu-button'),

        // Top Left Elements
        dayCounterUI: document.getElementById('day-counter'),
        timeOfDayUI: document.getElementById('time-of-day'),
        weatherStatusUI: document.getElementById('weather-status'),
        cycleTimerUI: document.getElementById('cycle-timer'),
        messageLogUI: document.getElementById('message-log'),
        // Lobby Elements
        lobbyInfoPanel: document.getElementById('lobby-info'), // Container
        lobbyPlayerCountUI: document.getElementById('lobby-player-count'),
        lobbyInstructionUI: document.getElementById('lobby-instruction'), // Added previously
        countdownTimerDisplayUI: document.getElementById('countdown-timer-display'),
        startCountdownButton: document.getElementById('start-countdown-button'),

        // Top Right Elements
        leaderboardTitleUI: document.getElementById('leaderboard-title'),
        leaderboardListUI: document.getElementById('leaderboard-list'),

        // Bottom Left Elements
        bottomLeftStatus: document.getElementById('bottom-left-status'),
        carbonBar: document.getElementById('carbon-bar'),
        hydraulicBar: document.getElementById('hydraulic-bar'),
        carbonValueUI: document.getElementById('carbon-value'),
        hydraulicValueUI: document.getElementById('hydraulic-value'),
        seedCounterUI: document.getElementById('seed-counter'),

        // Bottom Right Controls
        controlPanelRight: document.getElementById('control-panel-right'),
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

        // Admin specific elements (might be null on game page)
        adminControls: document.getElementById('admin-controls'),
        adminCloseModalButton: document.getElementById('admin-close-modal'),
    };

     // Verification log
     let foundCount = 0; let missing = [];
     const isGamePage = !!document.getElementById('start-countdown-button');
     const isAdminPage = !!document.getElementById('admin-controls');

     for (const key in uiElements) {
         if (uiElements[key]) {
             foundCount++;
         } else {
             // Refined checks to reduce noise based on page context
             const isOptionalOnGame = ['adminControls', 'adminCloseModalButton'].includes(key);
             const isOptionalOnAdmin = [
                'lobbyInstructionUI', 'startCountdownButton', 'bottomLeftStatus', 'carbonBar', 'hydraulicBar',
                'carbonValueUI', 'hydraulicValueUI', 'seedCounterUI', 'controlPanelRight', 'stomataSlider',
                'stomataValueUI', 'savingsSlider', 'savingsPercentageUI', 'growthRatioSlider',
                'growthRatioPercentageUI', 'finalDayUI', 'finalSeedsUI', 'restartButton'
             ].includes(key);

             if (isGamePage && !isOptionalOnGame && !uiElements[key]) {
                 console.warn(`UI element not found (Game Page): ${key}`); missing.push(key);
             } else if (isAdminPage && !isOptionalOnAdmin && !uiElements[key]) {
                  console.warn(`UI element not found (Admin Page): ${key}`); missing.push(key);
             } else if (!isGamePage && !isAdminPage && key !== 'gameContainer' && key !== 'canvas'){
                 // Ignore missing elements on other pages (like index, settings)
             }
         }
     }
      if (isGamePage || isAdminPage) {
          console.log(`UI: Cached ${foundCount} DOM elements. Missing: ${missing.length > 0 ? missing.join(', ') : 'None'}`);
      } else {
          console.log(`UI: Cached ${foundCount} DOM elements (non-game/admin page).`);
      }
}