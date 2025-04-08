// client/ui/messageHandler.js
import { uiElements } from './elements.js';
// Import socket reference - it might be null initially
import { socket } from '../main.js';

let listenerAttached = false; // Module-level flag

/** Shows a message in the message log area. */
export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        uiElements.messageLogUI.className = `message ${type}`;
     } else {
         // console.warn(`Msg Log UI not found. (${type}): ${text}`); // Reduce noise
     }
}

/** Clears the message log area. */
export function clearMessage() {
    if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = '';
        uiElements.messageLogUI.className = 'message';
    }
}

/**
 * Attaches the listener for the 'serverMessage' event.
 * Should be called once the socket connection is established.
 */
export function attachServerMessageListener() {
    // Prevent attaching multiple times and ensure socket exists
    if (!socket || listenerAttached) {
        if(listenerAttached) console.log("Message Handler: Listener already attached.");
        if(!socket) console.warn("Message Handler: attach called but socket is not ready.");
        return;
    }

    socket.on('serverMessage', (data) => {
        console.log("Received server message:", data);
        showMessage(data.text, data.type || 'info');
    });

    listenerAttached = true;
    console.log("Message Handler: Server message listener attached.");
}

// --- DO NOT CALL setup automatically on load ---
// setupServerMessageListener(); // REMOVED - Call attachServerMessageListener from main.js instead