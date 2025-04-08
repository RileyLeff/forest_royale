# FOREST ROYALE: A Plant Ecophysiology Game

## 1. Overview

**Forest Royale** (formerly Island Canopy Sim) is an interactive web-based simulation game designed to teach fundamental concepts of plant ecophysiology, specifically focusing on tree "decision-making" under environmental constraints. Developed as part of PhD research in plant ecophysiology, this project uses trees as a model system for studying resource allocation and survival strategies in sessile organisms facing dynamic environmental conditions.

The primary goal is to create an engaging, accessible (playable on web/mobile), and scientifically grounded experience. The game aims to translate complex physiological processes and trade-offs into intuitive game mechanics.

We approach trees not just as passive responders, but as agents making strategic "decisions" (e.g., stomatal aperture, carbon allocation) to maximize lifetime fitness (represented by reproductive output) within the bounds of physical and chemical laws governing water transport and photosynthesis, under a changing environment. The game now includes a client-server architecture to support multiplayer gameplay.

## 2. Core Concept

Players control an individual tree on a simulated island, competing against others (in multiplayer) or playing solo. The objective is to survive environmental challenges (dynamic light, drought, rain) and maximize lifetime seed production. This requires balancing competing demands:

*   **Growth:** Investing carbon into increasing height and leaf area can improve light capture but increases water demand and respiration costs.
*   **Reproduction:** Allocating carbon to seeds directly contributes to the player's score but detracts from growth and reserves.
*   **Survival (Savings & Safety):** Maintaining sufficient carbon reserves and hydraulic safety is essential to survive periods of stress (e.g., drought, low light, cloudy periods) and nightly respiration costs.

Players make real-time decisions (stomatal aperture) and periodic strategic decisions (carbon allocation) to navigate these trade-offs in response to fluctuating weather conditions, broadcast uniformly from a central server.

## 3. Scientific Principles Demonstrated

This simulation aims to illustrate key concepts in plant ecophysiology:

*   **Resource Allocation Trade-offs:** The fundamental conflict between allocating limited resources (carbon) towards growth, reproduction, storage (savings), and defense (implicit via survival).
*   **Photosynthesis-Transpiration Compromise:** The need to open stomata for CO2 uptake (photosynthesis) inevitably leads to water loss (transpiration), requiring players to manage stomatal aperture based on water availability (hydraulic safety) and carbon demand, influenced by current weather.
*   **Hydraulic Limits & Dynamics:** Demonstrating that exceeding the water transport capacity (represented by low `hydraulicSafety`) leads to physiological damage (canopy dieback) and potentially death. Hydraulic safety is dynamic, influenced by transpiration (affected by drought factor) and recovery (boosted by rain, potential night uptake). The maximum hydraulic buffer scales with tree size.
*   **Carbon Balance:** The dynamic interplay between carbon gain (photosynthesis, affected by light levels) and carbon loss (respiration, growth, reproduction), requiring players to manage reserves (capped at `MAX_CARBON`) to avoid starvation.
*   **Environmental Response:** How changing conditions (light intensity, drought factor, rain) broadcast by the server affect physiological processes and strategic decisions for all players simultaneously.
*   **Within-Generation Plasticity:** How a tree's "strategy" (control inputs) can change over its lifetime based on its state and environment.
*   **(Future) Competition:** How interactions with neighbors (e.g., shading) influence resource capture and survival.

## 4. Current Features & Architecture (As of this README update)

*   **Client-Server Architecture:**
    *   **Node.js Backend:** Uses Express for basic routing and Socket.IO for real-time WebSocket communication.
    *   **Authoritative Server:** The server manages the core game state (all players' resources, positions, time, weather), runs the simulation loop, and broadcasts state updates to all clients.
    *   **Client-Side Rendering:** The client receives state updates and renders the 3D scene (Three.js), updates UI, and sends user input back to the server.
*   **Game Modes & Flow:**
    *   **Single Player:** Accessed via dedicated button. Server detects single connection, bypasses lobby/countdown, and starts the game immediately.
    *   **Multiplayer (Lobby):** Accessed via dedicated button. Players join a shared lobby.
        *   **Spawn Selection:** Players click on the 3D island model during the lobby phase to select a starting location. Visual markers indicate chosen spots. Server validates positions (bounds, proximity to others). Players who don't choose are assigned a random offset position near the center at game start.
        *   **Countdown:** Any player in the lobby can initiate a short (e.g., 5s) countdown.
        *   **Game Start:** Game begins for all connected players after the countdown.
*   **Shared Environment:** All players experience the same synchronized day/night cycle and dynamic weather conditions (Sunny/Cloudy, Drought Factor, Rain) generated and broadcast by the server.
*   **Visuals & Effects:**
    *   3D island environment (Three.js).
    *   Synchronized sky color, fog, and lighting transitions.
    *   Rain particle effect during rainy periods.
    *   Starfield effect on clear nights.
*   **Core Tree Model:**
    *   Represents multiple player trees visually.
    *   Handles growth (trunk/canopy scaling) based on server state.
    *   Tiled canopy visually degrades based on `damagedLAPercentage` from server.
    *   Trees positioned according to chosen or assigned spawn points.
*   **Player Controls & State:**
    *   Real-time stomatal aperture slider input sent to server.
    *   Nightly allocation strategy (Savings %, Growth/Seed Ratio %) sliders' input sent to server.
    *   Server uses player inputs for its simulation calculations.
    *   Client UI displays player-specific resource bars (Carbon, Hydraulics) and seed count based on server data.
*   **Real-time Leaderboard:** UI panel displays all connected players, sorted by seed count (during game/end) or name (in lobby), indicating alive/dead status.
*   **Game Over:**
    *   Server detects when all players are dead (`isAlive=false`).
    *   Server determines winner (player with highest seed count).
    *   Server broadcasts `gameOver` event with reason and winner ID.
    *   Client displays a modal with results. "Play Again" button reloads client, returning to landing page. Server resets game state upon last player disconnect.
*   **Refactored Code Structure:**
    *   Client-side code moved into a `client/` directory.
    *   Server-side code moved into a `server/` directory, further modularized into `game/` (state, simulation, logic) and `network/` (connection, broadcast) sub-directories.
    *   Client and Server maintain separate `config.js` files for their respective needs.

## 5. Technology Stack

*   **Backend:** Node.js, Express, Socket.IO
*   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
*   **3D Rendering:** Three.js
*   **Camera Controls:** `OrbitControls`

## 6. Project Structure (Current)

```
.
├── .gitignore
├── README.md
├── client/
│   ├── config.js             # Client-specific configuration
│   ├── environment.js
│   ├── game.html
│   ├── gameState.js          # Client-side state cache
│   ├── index.html            # Landing page
│   ├── index.js              # Landing page script
│   ├── main.js               # Client entry point, game loop
│   ├── sceneSetup.js
│   ├── settings.html
│   ├── settings.js
│   ├── style.css
│   ├── tree.js               # Handles tree visuals
│   └── ui/                   # UI modules
│       ├── controlsHandlers.js
│       ├── elements.js
│       ├── gameOver.js
│       ├── leaderboard.js    # (Empty)
│       ├── messageHandler.js
│       ├── setupListeners.js
│       └── update.js
└── server/
    ├── config.js             # Server-specific configuration
    ├── game/
    │   ├── GameState.js      # Manages server game state
    │   ├── gameLogic.js      # High-level logic (start/end game, countdown)
    │   └── simulation.js     # Core physiological simulation tick
    ├── network/
    │   ├── connection.js     # Handles socket connections, disconnections, events
    │   └── stateBroadcaster.js # Creates and sends state snapshots
    ├── node_modules/
    ├── package-lock.json
    ├── package.json
    └── server.js             # Server entry point, Express/SocketIO setup, main loop interval
```

## 7. Getting Started / Running the Project

1.  **Clone Repository:** Get the project files.
2.  **Install Server Dependencies:** Navigate to the `server/` directory and run `npm install`.
3.  **Run the Server:** From the `server/` directory, run `node server.js`.
4.  **Open in Browser:** Navigate to `http://localhost:3000`.
5.  **Play:** Choose "Single Player" or "Multiplayer" (open multiple tabs/browsers for multiplayer testing).

## 8. Gameplay Mechanics (Multiplayer Focus)

*   **Objective:** Be the player with the most seeds when the game ends (currently when all players die).
*   **Lobby:** When joining multiplayer, you enter a lobby. Click on the island to choose your start location (green marker confirms your spot, orange markers show others'). Anyone can click "Start Game Countdown".
*   **Gameplay:** Once started, control your tree's stomata and allocation strategy. Monitor resources. All players experience the same weather. See other players' trees grow/die in real-time.
*   **Leaderboard:** Tracks seed counts and player status live.
*   **Game End:** Game ends when all trees are dead. A modal shows the winner.

## 9. Key Learnings & Decisions During Multiplayer Implementation

*   **Client-Server Split:** Clearly separated simulation logic (server) from rendering/input handling (client).
*   **Authoritative Server:** Server dictates all game state; client is a "dumb" renderer of that state.
*   **State Synchronization:** Using Socket.IO to broadcast regular state snapshots (`gameStateUpdate`). Key challenge is balancing data volume with update frequency.
*   **Input Handling:** Client immediately sends input (slider changes, button clicks) to server; server validates and updates its state, which is then reflected back in the next broadcast.
*   **Game Flow Management:** Server manages transitions between phases (lobby, countdown, playing, ended). Connection/disconnection logic needs careful handling to maintain correct state and trigger resets.
*   **Refactoring:** Moved server logic into modules (`game/`, `network/`) and client code into `client/` directory for better organization as complexity increased.
*   **Configuration:** Separated client (`client/config.js`) and server (`server/config.js`) configurations.
*   **Spawn Selection:** Implemented via raycasting on the client, validation and state update on the server, feedback via markers and state broadcasts. Default server-side assignment handles non-choosers.

## 10. Immediate Next Steps (Current Focus)

1.  **Spectator Mode:**
    *   Add "Spectate" button/intent.
    *   Server identifies spectators, excludes from gameplay logic.
    *   Client UI adjusts for spectators (hides controls/status).
2.  **Admin Panel:**
    *   Password-protected `/admin` route.
    *   Admin client page (`admin.html`, `admin.js`) with game view + control buttons.
    *   Server authentication for admin sockets.
    *   Server listeners for admin commands (Force Start/End, Reset Countdown) executing `gameLogic` functions.
3.  **Refine Spawn Markers:** Improve visual appearance/feedback for spawn markers.
4.  **Deployment:** Deploy the application to a suitable host (targeting PaaS like Render/Fly.io initially).

## 11. Future Directions / Longer Term Roadmap

*   **Environment Polish:** Improve visuals (rain, clouds, wind effects), add sound.
*   **Gameplay Balancing:** Tune rates, costs, weather probabilities based on playtesting.
*   **Player Interaction:** Implement shading effects between player trees.
*   **Climate Catastrophes:** Add rare server-triggered events.
*   **Persistence:** Leaderboards across multiple game rounds, potentially player accounts.
*   **Robustness:** Improve server stability, error handling, reconnection logic.
*   **Enhanced Scientific Accuracy:** More complex physiology models (water potential, nutrients).
*   **Educational Context:** In-game tooltips, links to concepts.
*   **(Maybe) Different Game Modes:** E.g., timed rounds, specific objectives.

## 12. Contributing

[Optional: Add guidelines if you plan for others to contribute]

## 13. License

[Optional: Add a license]

## 14. Contact

Developed by [Your Name/Alias], PhD Student in Plant Ecophysiology.
[Optional: Add contact email or link]