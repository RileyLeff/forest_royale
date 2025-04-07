# FOREST ROYALE: A Plant Ecophysiology Game

## 1. Overview

**Island Canopy Sim** is an interactive web-based simulation game designed to teach fundamental concepts of plant ecophysiology, specifically focusing on tree "decision-making" under environmental constraints. Developed as part of PhD research in plant ecophysiology, this project uses trees as a model system for studying resource allocation and survival strategies in sessile organisms facing dynamic environmental conditions.

The primary goal is to create an engaging, accessible (playable on web/mobile), and scientifically grounded experience. The game aims to translate complex physiological processes and trade-offs into intuitive game mechanics.

We approach trees not just as passive responders, but as agents making strategic "decisions" (e.g., stomatal aperture, carbon allocation) to maximize lifetime fitness (represented by reproductive output) within the bounds of physical and chemical laws governing water transport and photosynthesis, under a changing environment.

## 2. Core Concept

Players control an individual tree on a simulated island. The objective is to survive environmental challenges (dynamic light, drought, rain) and maximize lifetime seed production. This requires balancing competing demands:

*   **Growth:** Investing carbon into increasing height and leaf area can improve light capture but increases water demand and respiration costs.
*   **Reproduction:** Allocating carbon to seeds directly contributes to the player's score but detracts from growth and reserves.
*   **Survival (Savings & Safety):** Maintaining sufficient carbon reserves and hydraulic safety is essential to survive periods of stress (e.g., drought, low light, cloudy periods) and nightly respiration costs.

Players make real-time decisions (stomatal aperture) and periodic strategic decisions (carbon allocation) to navigate these trade-offs in response to fluctuating weather conditions.

## 3. Scientific Principles Demonstrated

This simulation aims to illustrate key concepts in plant ecophysiology:

*   **Resource Allocation Trade-offs:** The fundamental conflict between allocating limited resources (carbon) towards growth, reproduction, storage (savings), and defense (implicit via survival).
*   **Photosynthesis-Transpiration Compromise:** The need to open stomata for CO2 uptake (photosynthesis) inevitably leads to water loss (transpiration), requiring players to manage stomatal aperture based on water availability (hydraulic safety) and carbon demand, influenced by current weather.
*   **Hydraulic Limits & Dynamics:** Demonstrating that exceeding the water transport capacity (represented by low `hydraulicSafety`) leads to physiological damage (canopy dieback) and potentially death. Hydraulic safety is now dynamic, influenced by transpiration (affected by drought factor) and recovery (boosted by rain, potential night uptake). The maximum hydraulic buffer scales with tree size.
*   **Carbon Balance:** The dynamic interplay between carbon gain (photosynthesis, affected by light levels) and carbon loss (respiration, growth, reproduction), requiring players to manage reserves (capped at `MAX_CARBON`) to avoid starvation.
*   **Environmental Response:** How changing conditions (light intensity, drought factor, rain) during short weather periods affect physiological processes and strategic decisions.
*   **Within-Generation Plasticity:** How a tree's "strategy" can change over its lifetime based on its state and environment.
*   **(Future) Competition:** How interactions with neighbors (e.g., shading) influence resource capture and survival.

## 4. Current Features (As of this README update)

*   **Single-Player Mode:** One player controls one tree.
*   **3D Environment:** Simple island map using Three.js. OrbitControls for camera interaction.
*   **Dynamic Environment:**
    *   **Day/Night Cycle:** Structured cycle with 3 daytime periods (7s each) followed by a night period (3s). Total cycle: 24s.
    *   **Weather System:** Weather (Sunny/Cloudy, Drought Factor, Rain Chance) is dynamically generated for each 7s daytime period and for the night phase.
    *   **Visual Effects:**
        *   Sky color, fog color/density, and lighting (ambient & sun intensity) transition smoothly between sunny, cloudy, and night states.
        *   Stars appear on clear nights (not raining).
        *   Rain particle system activates visually during rainy periods (day or night).
    *   **Physiological Effects:**
        *   Light level (sunny/cloudy) directly affects photosynthesis rate.
        *   Drought factor (randomly varies per period) affects transpiration rate.
        *   Rain boosts hydraulic recovery rate during the day.
        *   Rain during the night provides a one-time hydraulic boost (foliar uptake).
*   **Core Tree Model:**
    *   Rectangular prism trunk.
    *   Tiled Canopy: Canopy represented by a grid of tiles (e.g., 10x10).
    *   Growth: Increases trunk size and scales the overall canopy group size.
    *   Trunk-to-leaf area ratio maintained conceptually for resource calculations.
*   **Player Customization:** Leaf and trunk color selectable via settings page.
*   **Resource Meters:**
    *   **Carbon Storage:** Increases with photosynthesis (light-dependent), decreases with respiration and allocation. Capped at `MAX_CARBON`. Death if <= 0.
    *   **Hydraulic Safety:** Decreases with transpiration (drought-dependent), recovers slowly when stomata are closed (boosted by rain). Max capacity scales with tree leaf area. Death if <= 0.
*   **Real-Time Control:** Stomatal aperture controlled via a UI slider (0-100%).
*   **Allocation Phase (Nightly):**
    *   Occurs automatically 1.5 seconds into the 3-second night phase based on current slider positions.
    *   **Two-Slider UI:** Controls allocation via "Savings %" and "Growth/Seed Ratio %". Player adjusts these *during the day* in anticipation of the night allocation.
    *   **Persistence:** Slider positions are remembered.
    *   **Savings Allowed:** Explicit carbon saving via "Savings %" slider.
    *   **Seed Cost:** 1 Carbon per seed.
*   **Physiological Consequences:**
    *   **Canopy Damage:** If `hydraulicSafety` drops below `HYDRAULIC_DAMAGE_THRESHOLD`, `damagedLAPercentage` increases. This reduces effective leaf area (affecting photo/transpiration) and visually removes tiles from the canopy grid (starting randomly) while tinting remaining tiles brown. Damage is persistent.
    *   **Death:** Occurs if `hydraulicSafety <= 0` (Desiccation) or `carbonStorage <= 0` (Starvation). A game over modal appears.
*   **UI:** Displays Day, Current Day Period/Night status, Time left in period/night, Weather status (Sunny/Cloudy, Raining, Dry/Wet indicator), resource bars, seed count.
*   **Modular Code Structure:** Code organized into JavaScript modules (`config.js`, `gameState.js`, `sceneSetup.js`, `tree.js`, `simulation.js`, `environment.js`, `main.js`, `ui/` submodules).

## 5. Technology Stack

*   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
*   **3D Rendering:** [Three.js](https://threejs.org/) library
*   **Camera Controls:** `OrbitControls` (from Three.js examples)
*   **Local Development Server:** Any simple static server (e.g., `npx serve`, Python's `http.server`, VS Code Live Server)

## 6. Project Structure

The project code is organized into the following JavaScript modules:

*   `main.js`: Main application entry point. Initializes modules, sets up the core game loop (`requestAnimationFrame`), calls simulation and visual updates. Handles overall application flow like restart.
*   `config.js`: Stores all game constants (rates, costs, durations, initial values, thresholds, colors, weather probabilities, etc.).
*   `gameState.js`: Defines and manages the central `gameState` object, including initialization logic and current dynamic variables (resources, time, weather state).
*   `sceneSetup.js`: Initializes and manages the Three.js `scene`, `camera`, `renderer`, `lights`, and `OrbitControls`. Creates the static environment (island, water). Calls initial setup for dynamic environment effects.
*   `tree.js`: Handles all aspects of the player's tree object: geometry creation (trunk, tiled canopy), dimension calculations, growth logic (updating trunk/scaling canopy), damage visualization (tile removal/tinting), material management, visibility, and resource disposal.
*   `simulation.js`: Contains the core simulation logic run each frame (`updateSimulation`). Manages time progression (periods, night), generates weather dynamically, calculates physiological changes (photosynthesis, respiration, transpiration, hydraulics, damage), handles allocation trigger, and checks for game over conditions. Calls functions to set visual targets.
*   `environment.js`: Manages dynamic visual aspects of the environment. Creates and updates stars, rain particles. Handles smooth transitions (lerping) for lighting, sky color, and fog based on targets set by the simulation.
*   `ui/` folder: Contains submodules for managing DOM interactions:
    *   `elements.js`: Caches DOM element references.
    *   `update.js`: Updates UI display based on `gameState`.
    *   `setupListeners.js`: Attaches event listeners to controls.
    *   `controlsHandlers.js`: Handles input events from sliders.
    *   `messageHandler.js`: Displays status/warning messages.
    *   `gameOver.js`: Manages the game over modal.
    *   `leaderboard.js`: (Currently empty - for future use).
*   `index.html` / `index.js`: Landing page.
*   `game.html`: Main game page structure.
*   `settings.html` / `settings.js`: Settings page for player name/colors.
*   `style.css`: Shared CSS styles.

## 7. Getting Started / Running the Project

1.  **Clone or Download:** Get the project files.
2.  **Install a Simple Web Server (if needed):** Node.js `npx serve` or Python `http.server`.
3.  **Run the Server:** From the project's root directory (`npx serve` or `python -m http.server`).
4.  **Open in Browser:** Navigate to the local address provided by the server (e.g., `http://localhost:3000` or `http://localhost:8000`).

## 8. Gameplay Mechanics (Detailed)

*   **Objective:** Survive as long as possible and produce the maximum number of seeds (`gameState.seedCount`).
*   **Camera:** Use the mouse (left-click drag to orbit, right-click drag to pan, scroll wheel to zoom).
*   **Stomata Control:** Use the "Stomatal Openness" slider. Higher values increase photosynthesis potential (good in sun) but also increase water loss (risky in drought). Lower values conserve water but reduce carbon gain. Adapt based on current weather shown in UI!
*   **Allocation Control:** Use the "Savings %" and "Invest % Grow/Seeds" sliders *during the day* to set your strategy for the *next* automatic night allocation.
*   **Status Meters:** Monitor your `Carbon Storage` and `Hydraulic Safety` bars. Keep them above critical levels. Note that max hydraulic safety increases as your tree grows larger.
*   **Weather & Time:** The game cycles through 3 daytime periods (7s each) and a night phase (3s). The UI shows the current period/phase and time remaining. Weather changes each period:
    *   **Sunny/Cloudy:** Affects light intensity and thus carbon gain.
    *   **Drought Factor:** Randomly varies, affecting water loss rate.
    *   **Raining:** Occurs sometimes when cloudy. Boosts hydraulic recovery rate, prevents stars from showing at night.
*   **Night Phase:**
    *   Visuals change (dark, stars if clear).
    *   **Foliar Uptake:** If raining, gain a +20 hydraulic safety boost once.
    *   **Allocation Trigger:** 1.5s into the night, carbon is automatically allocated based on your slider settings (Growth/Seeds/Savings). Growth occurs instantly if carbon is allocated.
*   **Canopy Damage:** If hydraulic safety drops too low, canopy tiles start disappearing visually, and remaining tiles turn brown. This damage reduces photosynthesis/transpiration effectiveness and is permanent.
*   **Game Over:** If Carbon hits 0 (Starvation) or Hydraulic Safety hits 0 (Desiccation), the game ends. A modal shows your final score. Click "Play Again" to restart.

## 9. Simulation Model Details (Internal Logic)

*   **Time:** 24s cycle (3x7s day periods, 3s night). `timeInCycle` tracks progress. Allocation occurs 1.5s into night.
*   **Weather:** Generated dynamically per period/night phase. `gameState` stores `currentLightMultiplier`, `currentDroughtFactor`, `isRaining`.
*   **Carbon Balance:**
    *   `Gain (Photosynthesis) = PHOTOSYNTHESIS_RATE_PER_LA * effectiveLA * stomatalConductance * currentLightMultiplier * deltaTime` (Gain capped by `MAX_CARBON` - `currentStorage`).
    *   `Loss (Respiration) = (RESPIRATION_RATE_PER_LA * currentLA + RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume) * deltaTime`.
    *   `Loss (Allocation) = actualCarbonForGrowth + actualCarbonForSeeds`.
*   **Hydraulics:**
    *   `Max Hydraulics = BASE_HYDRAULIC + HYDRAULIC_SCALE_PER_LA * currentLA`.
    *   `Recovery Rate = HYDRAULIC_RECOVERY_RATE * (isRaining ? RAIN_RECOVERY_BONUS_MULT : 1)`.
    *   `Water Loss Rate = TRANSPIRATION_RATE_PER_LA * effectiveLA * stomatalConductance * currentDroughtFactor`.
    *   `Hydraulic Change = (Recovery Rate * (1 - stomatalConductance) - Water Loss Rate) * deltaTime`.
    *   `Foliar Uptake (Night Rain): +NIGHT_RAIN_HYDRAULIC_BOOST` (once per rainy night, capped by max).
    *   `hydraulicSafety` clamped between 0 and `maxHydraulic`.
*   **Growth:**
    *   Calculates `growthFactor` based on allocated carbon and current biomass estimate.
    *   Increases `currentLA` and `trunkHeight`. Recalculates `maxHydraulic`.
    *   Updates trunk geometry. Scales the `canopyGroup` size.
*   **Damage:**
    *   If `hydraulicSafety < HYDRAULIC_DAMAGE_THRESHOLD`: `damagedLAPercentage += CROWN_DIEBACK_RATE * deltaTime` (capped at 1).
    *   `effectiveLA = currentLA * (1 - damagedLAPercentage)`.
    *   Visuals: `updateCanopyTiles` hides `floor(totalTiles * damagedLAPercentage)` tiles and tints the shared canopy material brown.
*   **Visual Transitions:** `environment.js` uses `lerp` in `updateEnvironmentVisuals` (called each frame) to smoothly change light intensity, sky/fog color, and fog distance towards targets set by `setWeatherTargets` (called on period/phase change). Star visibility changes instantly based on night/rain status.

## 10. Development Roadmap & Future Directions

This project is actively under development. Key areas for future work include:

1.  **Environment Polish:**
    *   Refine rain particle appearance (e.g., texture, velocity variation).
    *   Add visual cloud representation (e.g., moving textured planes).
    *   Add subtle wind effects? (Swaying tree - complex).
    *   Sound effects (rain, wind?).
2.  **Gameplay & Balancing:**
    *   Fine-tune weather probabilities, effect multipliers, costs, rates based on playtesting. Is the game too easy/hard? Is rain too powerful/rare?
    *   Consider adding defense allocation/costs.
    *   Refine UI feedback (e.g., clearer indication of low resources, drought level).
3.  **Climate Catastrophes:**
    *   Implement system for rare, high-impact events (wildfire, flood) triggered with increasing probability over time.
    *   Define specific conditions and effects for each catastrophe (potentially player-subset specific for multiplayer).
4.  **Multiplayer Implementation:**
    *   **Backend:** Set up a Node.js server with WebSockets (e.g., Socket.IO).
    *   **Spawning:** Implement player joining and initial placement.
    *   **State Synchronization:** Sync tree/player states and crucial environmental state.
    *   **Interaction:** Implement shading calculations between players.
    *   **Scalability:** Optimize for target player count.
5.  **Enhancing Scientific Accuracy (Longer Term):**
    *   More complex hydraulic model (water potential, PLC).
    *   Refined photosynthesis (light response, temperature).
    *   Nutrient limitations.
    *   More detailed biomass/respiration.
6.  **Educational Context:**
    *   Add tooltips or info panels explaining scientific concepts.
    *   Link game events to real-world scenarios.

## 11. Contributing

[Optional: Add guidelines if you plan for others to contribute]

## 12. License

[Optional: Add a license]

## 13. Contact

Developed by [Your Name/Alias], PhD Student in Plant Ecophysiology.
[Optional: Add contact email or link]