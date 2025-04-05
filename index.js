document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('start-single-player');
    const multiPlayerButton = document.getElementById('start-multi-player');
    const settingsButton = document.getElementById('open-settings');

    if (singlePlayerButton) {
        singlePlayerButton.addEventListener('click', () => {
            console.log("Navigating to Single Player game...");
            window.location.href = 'game.html'; // Navigate to the main game page
        });
    }

    if (multiPlayerButton) {
        // Button is disabled, no action needed, but could add info tooltip
        multiPlayerButton.addEventListener('mouseover', () => {
           // Optional: Show a tooltip explaining it's disabled
        });
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("Navigating to Settings...");
            window.location.href = 'settings.html'; // Navigate to the settings page
        });
    }
});