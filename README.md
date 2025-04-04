# FOREST ROYALE: A Plant Ecophysiology Game

## 1. Overview

**Island Canopy Sim** is an interactive web-based simulation game designed to teach fundamental concepts of plant ecophysiology, specifically focusing on tree "decision-making" under environmental constraints. Developed as part of PhD research in plant ecophysiology at [Your University/Institution - Optional], this project uses trees as a model system for studying resource allocation and survival strategies in sessile organisms facing gradual environmental change (like climate change).

The primary goal is to create an engaging, accessible (playable on web/mobile), and scientifically grounded experience, initially targeted for a high school science fair audience, but with potential for broader educational use. The game aims to translate complex physiological processes and trade-offs into intuitive game mechanics.

We approach trees not just as passive responders, but as agents making strategic "decisions" (e.g., stomatal aperture, carbon allocation) to maximize lifetime fitness (represented by reproductive output) within the bounds of physical and chemical laws governing water transport and photosynthesis.

## 2. Core Concept

Players control an individual tree on a shared island map (currently single-player). The objective is to survive environmental challenges (like drought) and maximize lifetime seed production. This requires balancing competing demands:

*   **Growth:** Investing carbon into increasing height and leaf area can improve light capture but increases water demand and respiration costs.
*   **Reproduction:** Allocating carbon to seeds directly contributes to the player's score but detracts from growth and reserves.
*   **Survival (Savings & Safety):** Maintaining sufficient carbon reserves and hydraulic safety is essential to survive periods of stress (e.g., drought, low light) and nightly respiration costs.

Players make real-time decisions (stomatal aperture) and periodic strategic decisions (carbon allocation) to navigate these trade-offs.

## 3. Scientific Principles Demonstrated

This simulation aims to illustrate key concepts in plant ecophysiology:

*   **Resource Allocation Trade-offs:** The fundamental conflict between allocating limited resources (carbon) towards growth, reproduction, storage (savings), and defense (implicit via survival).
*   **Photosynthesis-Transpiration Compromise:** The need to open stomata for CO2 uptake (photosynthesis) inevitably leads to water loss (transpiration), requiring players to manage stomatal aperture based on water availability (hydraulic safety) and carbon demand.
*   **Hydraulic Limits:** Demonstrating that exceeding the water transport capacity (represented by low `hydraulicSafety`) leads to physiological damage (canopy dieback) and potentially death. (Currently modeled linearly with thresholds).
*   **Carbon Balance:** The dynamic interplay between carbon gain (photosynthesis) and carbon loss (respiration, growth, reproduction), requiring players to manage reserves to avoid starvation.
*   **Environmental Response:** How changing conditions (light - future, water/drought - basic implementation) affect physiological processes and strategic decisions.
*   **Within-Generation Plasticity:** How a tree's "strategy" can change over its lifetime based on its state and environment, distinct from evolutionary adaptation.
*   **(Future) Competition:** How interactions with neighbors (e.g., shading) influence resource capture and survival.

## 4. Current Features (As of this README update)

*   **Single-Player Mode:** One player controls one tree.
*   **3D Environment:** Simple island map using Three.js (flat cylinder island, water plane). Basic directional lighting simulating the sun. OrbitControls for camera interaction.
*   **Core Tree Model:** Rectangular prism trunk + thin rectangular canopy geometry. Trunk-to-leaf area ratio maintained during growth.
*   **Player Customization:** Leaf and trunk color selectable via color pickers in the UI.
*   **Resource Meters:**
    *   **Carbon Storage:** Increases with photosynthesis, decreases with respiration and allocation. Max capacity (`MAX_CARBON`). Death if <= 0.
    *   **Hydraulic Safety:** Decreases with transpiration (linked to stomata & drought factor), recovers slowly when stomata are closed. Max capacity (`MAX_HYDRAULIC`).
*   **Real-Time Control:** Stomatal aperture controlled via a UI slider (0-100%).
*   **Day/Night Cycle:** Defined durations for day (simulation active) and night (allocation phase).
*   **Allocation Phase (Nightly):**
    *   **Two-Slider UI:** Controls allocation via "Savings %" and "Growth/Seed Ratio %".
    *   **10-Second Timer:** Visible countdown for making the allocation decision.
    *   **Default/Timeout:** If the timer expires, the allocation proceeds based on the *current state* of the sliders (allowing implicit choice). *(Correction based on user request - previous version used a fixed random strategy)*.
    *   **Persistence:** The slider positions from the last *manual* submission are remembered and used as the default starting position for the *next* allocation phase. Random timeout allocations do not update the remembered state.
    *   **Savings Allowed:** Players can explicitly save carbon by adjusting the "Savings %" slider.
    *   **Seed Cost:** Simplified to 1 Carbon per seed.
    *   **Immediate Transition:** After allocation submission (manual or timeout), the game immediately transitions to the next day (no idle night period).
*   **Physiological Consequences:**
    *   **Canopy Damage:** If `hydraulicSafety` drops below `HYDRAULIC_DAMAGE_THRESHOLD`, `damagedLAPercentage` increases, reducing effective leaf area for photosynthesis and visually tinting the canopy brown.
    *   **Death:** Occurs if `hydraulicSafety <= 0` (Desiccation) or `carbonStorage <= 0` (Starvation). Dead trees lose their canopy visually.
*   **Growth:** Spending carbon on growth increases tree height and leaf area (updating geometry).
*   **Modular Code Structure:** Code is organized into JavaScript modules (`config.js`, `gameState.js`, `sceneSetup.js`, `tree.js`, `ui.js`, `simulation.js`, `main.js`).

## 5. Technology Stack

*   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
*   **3D Rendering:** [Three.js](https://threejs.org/) library (via CDN)
*   **Camera Controls:** `OrbitControls` (from Three.js examples)
*   **Local Development Server:** Any simple static server (e.g., `npx serve`, Python's `http.server`, VS Code Live Server)

## 6. Project Structure

The project code is organized into the following JavaScript modules:

*   `main.js`: Main application entry point. Initializes modules, sets up the core game loop (`requestAnimationFrame`). Handles overall application flow like restart.
*   `config.js`: Stores all game constants (rates, costs, durations, initial values, thresholds, colors, etc.).
*   `gameState.js`: Defines and manages the central `gameState` object, including initialization logic. Stores all dynamic variables of the simulation.
*   `sceneSetup.js`: Initializes and manages the Three.js `scene`, `camera`, `renderer`, `lights`, and `OrbitControls`. Creates the static environment (island, water). Handles window resizing. Exports key Three.js objects.
*   `tree.js`: Handles all aspects of the player's tree object: geometry creation (`createPlayerTree`), dimension calculations (`calculateDimensions`), growth logic (`growTree`), material/color updates (`updateTreeColors`, `updateCanopyVisuals`), visibility (`setCanopyVisibility`), and resource disposal (`disposeTreeMaterials`).
*   `simulation.js`: Contains the core simulation logic run each frame (`updateSimulation`). Handles the day/night cycle transitions, calculation of photosynthesis, respiration, transpiration, hydraulic changes, damage accumulation, and checking for game over conditions. Includes logic to start a new day (`startNewDay`).
*   `ui.js`: Manages all interactions with the HTML Document Object Model (DOM). Caches element references (`cacheDOMElements`), sets up event listeners (`setupUIListeners`), updates UI displays based on `gameState` (`updateUI`), handles showing/hiding the allocation section (`showAllocationSection`, `hideAllocationSection`), manages the allocation timer and preview (`startAllocationTimer`, `clearAllocationTimer`, `updateAllocationPreview`), handles allocation submission (`submitAllocation`), displays messages (`showMessage`, `clearMessage`), and manages the game over screen UI (`showGameOverUI`).

## 7. Getting Started / Running the Project

1.  **Clone or Download:** Get the project files onto your local machine. If using git:
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install a Simple Web Server (if needed):** If you don't have one, Node.js is recommended. Install Node.js (which includes `npm`), then you can use `npx`:
    ```bash
    # No installation needed if you have Node.js >= 16 approx.
    ```
3.  **Run the Server:** Navigate to the project's root directory in your terminal and run:
    ```bash
    npx serve
    ```
    Alternatively, use Python (if installed):
    ```bash
    python -m http.server
    ```
    Or use the Live Server extension in VS Code.
4.  **Open in Browser:** The server will typically output a local address (e.g., `http://localhost:3000` or `http://localhost:8000`). Open this address in a modern web browser (Chrome, Firefox, Edge recommended).

The game should load and start running.

## 8. Gameplay Mechanics (Detailed)

*   **Objective:** Survive as long as possible and produce the maximum number of seeds (`gameState.seedCount`).
*   **Camera:** Use the mouse (left-click drag to orbit, right-click drag to pan, scroll wheel to zoom) to view your tree and the environment.
*   **Stomata Control:** Use the "Stomata Openness" slider in the UI. Higher values increase photosynthesis potential but also increase water loss (`hydraulicSafety` decrease). Lower values conserve water but reduce carbon gain.
*   **Color Customization:** Use the color pickers to change the appearance of your tree's trunk and leaves at any time.
*   **Status Meters:** Monitor your `Carbon Storage` and `Hydraulic Safety` bars. Keep them above critical levels.
*   **Day Phase:** The simulation runs. Photosynthesis adds carbon, respiration consumes carbon. Transpiration consumes hydraulic safety. Hydraulic safety recovers slowly if stomata are closed. If hydraulic safety drops below the threshold (`HYDRAULIC_DAMAGE_THRESHOLD`), the canopy visually darkens, and `effectiveLA` decreases, reducing photosynthesis.
*   **Night Phase (Allocation):** At the end of the day, the game pauses, and the "Night Allocation" panel appears.
    *   You have **10 seconds** (indicated by the timer) to decide.
    *   **Savings % Slider:** Sets the percentage of *currently available* carbon you wish to keep in reserve.
    *   **Growth/Seed Ratio % Slider:** Determines how the *remaining non-saved carbon* will be split between growth investment and seed production.
    *   **Preview:** The summary text below the sliders updates in real-time to show the calculated carbon amounts for growth, the number of seeds produced (costing 1 C each), and the final amount of carbon saved.
    *   **Persistence:** The slider positions will default to the values you *manually submitted* in the previous round.
    *   **Submission:** Click "Allocate & Start New Day" to confirm your choice *before* the timer runs out.
    *   **Timeout:** If the timer reaches zero, the allocation is automatically submitted based on the *current positions* of the sliders.
*   **End of Allocation:** The allocation panel disappears, the chosen amounts are spent (or saved), the seed count updates, the tree grows (if applicable), and the simulation immediately transitions to the start of the next day.
*   **Game Over:** If Carbon Storage hits 0 (Starvation) or Hydraulic Safety hits 0 (Desiccation), the game ends. The canopy disappears, and a modal shows your final score (days survived, seeds produced). Click "Play Again" to restart.

## 9. Simulation Model Details (Internal Logic)

*   **Carbon Balance:**
    *   `Gain (Photosynthesis) = PHOTOSYNTHESIS_RATE_PER_LA * effectiveLA * stomatalConductance * deltaTime` (Light is currently assumed constant max during day).
    *   `Loss (Respiration) = (RESPIRATION_RATE_PER_LA * currentLA + RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume) * deltaTime`.
    *   `Loss (Allocation) = actualCarbonForGrowth + actualCarbonForSeeds` (occurs instantly at night).
*   **Hydraulics:**
    *   `Water Loss Rate = TRANSPIRATION_RATE_PER_LA * effectiveLA * stomatalConductance * droughtFactor`.
    *   `Recovery Rate = HYDRAULIC_RECOVERY_RATE * (1 - stomatalConductance)`.
    *   `Hydraulic Change = (Recovery Rate - Water Loss Rate) * deltaTime`.
    *   `hydraulicSafety` is clamped between 0 and `MAX_HYDRAULIC`.
    *   **No PLC Curve:** This is a simplified linear "safety buffer" model, not a direct simulation of water potential or Percentage Loss of Conductivity based on a vulnerability curve.
*   **Growth:**
    *   Calculates `biomassToAdd` based on `carbonForGrowth` and `GROWTH_COST_PER_LA`.
    *   Calculates a `growthFactor` based on the ratio of `biomassToAdd` to an estimated current biomass.
    *   Increases `currentLA` and `trunkHeight` by this factor.
    *   Recalculates `trunkWidth`, `trunkDepth`, `canopyWidth`, `canopyDepth` using `calculateDimensions` based on the new `currentLA` and the fixed `k_TA_LA_RATIO`.
    *   Updates the `geometry` of the trunk and canopy meshes (disposing of old geometry).
*   **Damage:**
    *   If `hydraulicSafety < HYDRAULIC_DAMAGE_THRESHOLD`: `damagedLAPercentage += CROWN_DIEBACK_RATE * deltaTime` (capped at 1).
    *   `effectiveLA = currentLA * (1 - damagedLAPercentage)`.
    *   Visuals: `canopyMaterial` color is linearly interpolated between `leafColor` and brown based on `damagedLAPercentage`.
*   **Allocation (Sliders):**
    *   `carbonToSpend = floor(availableCarbon * (1 - savingsPercent / 100))`
    *   `carbonForGrowth = floor(carbonToSpend * (growthRatioPercent / 100))`
    *   `carbonForSeeds = carbonToSpend - carbonForGrowth`
    *   `seedsMade = carbonForSeeds` (since `SEED_COST` = 1)
    *   `totalSpent = carbonForGrowth + carbonForSeeds`
    *   `finalSavings = availableCarbon - totalSpent`

## 10. Development Roadmap & Future Directions

This project is actively under development. Key areas for future work include:

1.  **Troubleshooting & Polish:**
    *   Address any remaining bugs in the current single-player implementation (e.g., allocation UI behavior if issues persist).
    *   Refine UI layout and visual feedback (e.g., clearer indication of low resources, visual effect for allocation/sunrise).
    *   Refactor `ui.js` into smaller modules for better maintainability.
2.  **Refining Game Logic & Mechanics:**
    *   Introduce more sophisticated interactions (e.g., how does canopy damage affect respiration? Does growth cost change with tree size? Does low carbon affect hydraulic recovery?).
    *   Consider adding defense allocation/costs (e.g., against pests/disease - maybe abstractly linked to maintaining high carbon reserves?).
    *   Fine-tune balancing based on the 1C seed cost and other parameters through playtesting.
3.  **Environment & Weather Representation:**
    *   Implement dynamic `droughtFactor`: Vary water availability randomly or seasonally.
    *   Introduce light variation: Simulate daily light changes, potentially add cloud cover effects.
    *   (Future) Add seasons affecting temperature (respiration), light, water.
4.  **Multiplayer Implementation:**
    *   **Backend:** Set up a Node.js server with WebSockets (e.g., Socket.IO).
    *   **Spawning:** Implement the "Fortnite-style" drop and landing spot selection.
    *   **State Synchronization:** Reliably sync tree positions, sizes, states, and environmental conditions.
    *   **Interaction:** Implement shading calculations between players (server-side calculation likely needed for fairness/performance).
    *   **Scalability:** Optimize for target player count (e.g., 50 players).
5.  **Enhancing Scientific Accuracy (Longer Term):**
    *   Optionally replace linear hydraulics with a model incorporating water potential and a PLC curve.
    *   Refine photosynthesis model (e.g., light response curves).
    *   More detailed biomass/respiration modeling.
6.  **Educational Context:**
    *   Add tooltips or info panels explaining the scientific concepts behind game mechanics.
    *   Potentially link game events or parameters to real-world climate change scenarios or data.

## 11. Contributing

[Optional: Add guidelines if you plan for others to contribute - e.g., how to report bugs, suggest features, coding style.]

## 12. License

[Optional: Add a license, e.g., MIT, Apache 2.0, or specify if it's proprietary.]

## 13. Contact

Developed by [Your Name/Alias], PhD Student in Plant Ecophysiology.
[Optional: Add contact email or link]