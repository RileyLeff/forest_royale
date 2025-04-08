// client/ui/messageHandler.js
import { uiElements } from './elements.js';
// Import socket to listen for server messages
import { socket } from '../main.js'; // Assuming socket is exported from main

/** Shows a message in the message log area. */
export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        uiElements.messageLogUI.className = `message ${type}`;
     } else { console.warn(`Msg Log UI not found. (${type}): ${text}`); }
}

/** Clears the message log area. */
export function clearMessage() {
    if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = '';
        uiElements.messageLogUI.className = 'message';
    }
}

// --- Listen for messages broadcast from the server ---
// Ensure socket is available before adding listener
let messageListenerAttached = false;
function setupServerMessageListener() {
    if (socket && !messageListenerAttached) {
        socket.on('serverMessage', (data) => {
            console.log("Received server message:", data);
            showMessage(data.text, data.type || 'info');
        });
        messageListenerAttached = true;
         console.log("Message Handler: Server message listener attached.");
    } else if (!socket) {
        // Socket not ready yet, try again later?
         console.log("Message Handler: Socket not ready, will retry listener setup.");
        setTimeout(setupServerMessageListener, 500); // Retry after 500ms
    }
}

// Attempt to set up listener when module loads, will retry if socket not ready
setupServerMessageListener();