document.addEventListener('DOMContentLoaded', () => {
    const playerNameInput = document.getElementById('player-name');
    const leafColorInput = document.getElementById('leaf-color');
    const trunkColorInput = document.getElementById('trunk-color');
    const saveButton = document.getElementById('save-settings');

    // --- Load existing settings from localStorage ---
    function loadSettings() {
        const storedName = localStorage.getItem('playerName');
        const storedLeafColor = localStorage.getItem('leafColor');
        const storedTrunkColor = localStorage.getItem('trunkColor');

        if (playerNameInput) {
            playerNameInput.value = storedName || 'Treebard'; // Use default if not set
        }
        if (leafColorInput) {
            leafColorInput.value = storedLeafColor || '#228B22'; // Default green
        }
        if (trunkColorInput) {
            trunkColorInput.value = storedTrunkColor || '#8B4513'; // Default brown
        }
        console.log('Settings loaded from localStorage');
    }

    // --- Save current settings to localStorage ---
    function saveSettings() {
        if (playerNameInput) {
            localStorage.setItem('playerName', playerNameInput.value || 'Treebard');
        }
        if (leafColorInput) {
            localStorage.setItem('leafColor', leafColorInput.value);
        }
        if (trunkColorInput) {
            localStorage.setItem('trunkColor', trunkColorInput.value);
        }
        console.log('Settings saved to localStorage');
    }

    // --- Event Listener for Save Button ---
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            saveSettings();
            // Navigate back to the landing page
            window.location.href = 'landing.html';
        });
    }

    // --- Initial Load ---
    loadSettings();
});