// client/socket.js
// This module initializes and exports the shared Socket.IO client instance.

// Import the socket.io client library.
// Assumes socket.io.js is loaded globally via <script> tag in HTML.
// If you were using a bundler like Webpack/Vite, you'd use: import { io } from 'socket.io-client';
// For this setup, we rely on the global 'io'. Make sure the <script src="/socket.io/socket.io.js"></script>
// in your HTML files comes *before* your module scripts.
if (typeof io === 'undefined') {
    console.error("Socket.IO client library (io) not found. Make sure socket.io.js is loaded before this script.");
    // Provide a dummy socket object to prevent further errors, though functionality will be broken.
    // This isn't ideal but prevents crashing other modules trying to import 'socket'.
    const dummySocket = {
        on: () => {},
        emit: () => { console.error("Socket not initialized (dummy)"); },
        disconnect: () => {},
        connected: false,
        id: null
    };
    alert("Critical Error: Socket.IO library missing. Please check the console."); // User notification
    // Export the dummy object
    // export const socket = dummySocket; // Uncomment this line if you want to export a dummy on failure
    throw new Error("Socket.IO client library (io) not found."); // More aggressive: stop script execution
}


console.log("[socket.js] Initializing socket connection...");
const socket = io({
    reconnection: true, // Enable default reconnection
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    // You might want to disable autoConnect initially if you need to wait
    // for user actions, but for this app, autoConnect is fine.
    // autoConnect: false,
});

// Add basic logging for core socket events right here for centralized debugging
socket.on('connect', () => {
    console.log(`[socket.js] Socket connected: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
     console.log(`[socket.js] Socket disconnected: ${reason}`);
     // You could potentially emit a custom event here for other modules if needed
     // document.dispatchEvent(new CustomEvent('socketDisconnected', { detail: reason }));
});

 socket.on('connect_error', (error) => {
     console.error('[socket.js] Socket Connection Error:', error);
 });

// Export the single, shared socket instance
export { socket };