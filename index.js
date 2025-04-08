// index.js (in project root)

document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('start-single-player');
    const multiPlayerButton = document.getElementById('start-multi-player');
    const settingsButton = document.getElementById('open-settings');

    if (singlePlayerButton) {
        singlePlayerButton.addEventListener('click', () => {
            console.log("Navigating to Single Player game...");
            // Navigate to the /game ROUTE, not the file directly
            window.location.href = '/game';
        });
    }

    if (multiPlayerButton) {
        // Button is disabled, no action needed, but could add info tooltip
        multiPlayerButton.addEventListener('mouseover', () => {
           // Optional: Show a tooltip explaining it's disabled
        });
        // Make sure it stays disabled if needed
        multiPlayerButton.disabled = true;
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("Navigating to Settings...");
             // Navigate to the /settings ROUTE
            window.location.href = '/settings';
        });
    }
});