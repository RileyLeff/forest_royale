// client/index.js (Landing Page Logic)

document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('start-single-player');
    const multiPlayerButton = document.getElementById('start-multi-player');
    const settingsButton = document.getElementById('open-settings');

    // Function to set mode and navigate
    function startGame(mode) {
        console.log(`Index: Setting mode to ${mode} and navigating to /game`);
        sessionStorage.setItem('gameModeIntent', mode); // Store intent
        window.location.href = '/game'; // Navigate to the game page
    }

    if (singlePlayerButton) {
        singlePlayerButton.addEventListener('click', () => {
            startGame('single');
        });
    }

    if (multiPlayerButton) {
        // Enable the button now
        multiPlayerButton.disabled = false;
        multiPlayerButton.textContent = 'Multiplayer'; // Update text if needed

        multiPlayerButton.addEventListener('click', () => {
             startGame('multi');
        });
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("Navigating to Settings...");
            window.location.href = '/settings';
        });
    }
});