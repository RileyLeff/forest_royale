// client/index.js (Landing Page Logic)

document.addEventListener('DOMContentLoaded', () => {
    const singlePlayerButton = document.getElementById('start-single-player');
    const multiPlayerButton = document.getElementById('start-multi-player');
    const spectateButton = document.getElementById('spectate-game');
    const settingsButton = document.getElementById('open-settings');
    const adminButton = document.getElementById('admin-panel-button'); // Get admin button

    // Function to set mode and navigate to game page
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

    // +++ Add listener for Admin Panel button +++
    if (adminButton) {
        adminButton.addEventListener('click', () => {
            console.log("Admin Panel button clicked.");
            // Use prompt() for simple password input
            const password = prompt("Enter Admin Password:", "");

            // Check if the user entered a password (prompt wasn't cancelled or left empty)
            if (password !== null && password !== "") {
                 console.log("Password entered, navigating to Admin Panel...");
                 // Navigate to the admin route with the password as a query parameter
                 window.location.href = `/admin?pw=${encodeURIComponent(password)}`;
            } else {
                 console.log("Admin password prompt cancelled or empty.");
                 // Optionally show a message or just do nothing
                 if (password === "") {
                     alert("Password cannot be empty.");
                 }
            }
        });
    }
});