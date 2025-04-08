// client/ui/messageHandler.js
import { uiElements } from './elements.js';
// Import socket reference from the new dedicated module
import { socket } from '../socket.js'; // <<< UPDATED PATH

let listenerAttached = false; // Module-level flag to prevent attaching multiple times

/** Shows a message in the message log area. */
export function showMessage(text, type = 'info') {
     if (uiElements.messageLogUI) {
        uiElements.messageLogUI.textContent = text;
        uiElements.messageLogUI.className = `message ${type}`;
     } else {
         // console.warn(`Msg Log UI not found. (${type}): ${text}`);
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
 * Attaches the listener for the 'serverMessage' event to the shared socket.
 * Should be called once the socket connection is logically established
 * (e.g., after connect event and initial handshake/auth).
 */
export function attachServerMessageListener() {
    // Prevent attaching multiple times and ensure socket exists
    if (listenerAttached) {
        // console.log("Message Handler: Listener already attached."); // Reduce noise
        return;
    }
    // The socket import itself might fail if socket.js has issues,
    // but we assume socket.js handles that. Here we check if the imported socket looks valid.
    if (!socket || typeof socket.on !== 'function') {
        console.warn("Message Handler: attach called but socket is not ready or invalid.");
        return;
    }

    socket.on('serverMessage', (data) => {
        console.log("Received server message:", data);
        showMessage(data.text, data.type || 'info');
    });

    listenerAttached = true;
    console.log("Message Handler: Server message listener attached.");
}

// Call this function externally (from main.js/admin.js) after connection setup
// export function detachServerMessageListener() { // Optional: if needed for cleanup
//    if (listenerAttached && socket) {
//        socket.off('serverMessage'); // Remove specific listener if possible
//        listenerAttached = false;
//        console.log("Message Handler: Server message listener detached.");
//    }
// }