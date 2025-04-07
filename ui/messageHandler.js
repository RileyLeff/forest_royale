// ui/messageHandler.js
// Handles displaying and clearing messages in the UI message log.

// Import the cached UI elements
import { uiElements } from './elements.js';

/**
 * Shows a message in the message log area.
 * @param {string} text - The message text to display.
 * @param {string} [type='info'] - The type of message ('info', 'warning', 'error') for styling.
 */
export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        // Apply class based on type for CSS styling
        uiElements.messageLogUI.className = `message ${type}`;
     } else {
         // Fallback console log if UI element isn't found
         console.warn(`Message log UI element not found. Message (${type}): ${text}`);
     }
}

/**
 * Clears the message log area.
 */
export function clearMessage() {
    if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = '';
        // Reset class to default
        uiElements.messageLogUI.className = 'message';
    }
}