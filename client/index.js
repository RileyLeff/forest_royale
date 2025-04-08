// client/index.js (Landing Page Logic)

document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('start-single-player');
    const multiPlayerButton = document.getElementById('start-multi-player');
    const spectateButton = document.getElementById('spectate-game'); // Get spectate button
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
        multiPlayerButton.disabled = false; // Ensure enabled
        multiPlayerButton.textContent = 'Multiplayer';
        multiPlayerButton.addEventListener('click', () => {
             startGame('multi');
        });
    }

    // Add listener for spectate button
    if (spectateButton) {
         spectateButton.addEventListener('click', () => {
             startGame('spectate');
         });
    }

    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            console.log("Navigating to Settings...");
            window.location.href = '/settings';
        });
    }
});