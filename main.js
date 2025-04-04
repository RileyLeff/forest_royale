import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- DOM Elements ---
const gameContainer = document.getElementById('game-container');
const canvas = document.getElementById('game-canvas');
const carbonBar = document.getElementById('carbon-bar');
const hydraulicBar = document.getElementById('hydraulic-bar');
const carbonValueUI = document.getElementById('carbon-value');
const hydraulicValueUI = document.getElementById('hydraulic-value');
const stomataSlider = document.getElementById('stomata-slider');
const stomataValueUI = document.getElementById('stomata-value');
const dayCounterUI = document.getElementById('day-counter');
const seedCounterUI = document.getElementById('seed-counter');
const timeOfDayUI = document.getElementById('time-of-day');
const cycleTimerUI = document.getElementById('cycle-timer');
const messageLogUI = document.getElementById('message-log');
const allocationModal = document.getElementById('allocation-modal');
const allocationDayUI = document.getElementById('allocation-day');
const availableCarbonUI = document.getElementById('available-carbon');
const growthSlider = document.getElementById('growth-slider');
const growthPercentageUI = document.getElementById('growth-percentage');
const allocationGrowthCarbonUI = document.getElementById('allocation-growth-carbon');
const allocationSeedCarbonUI = document.getElementById('allocation-seed-carbon');
const allocationSeedCountUI = document.getElementById('allocation-seed-count');
const seedCostInfoUI = document.getElementById('seed-cost-info');
const submitAllocationButton = document.getElementById('submit-allocation');
const gameOverModal = document.getElementById('game-over-modal');
const gameOverReasonUI = document.getElementById('game-over-reason');
const finalDayUI = document.getElementById('final-day');
const finalSeedsUI = document.getElementById('final-seeds');
const restartButton = document.getElementById('restart-button');

// --- Game Constants ---
const k_TA_LA_RATIO = 0.01; // Trunk cross-section area / Leaf Area ratio
const INITIAL_LEAF_AREA = 5;
const INITIAL_TRUNK_HEIGHT = 2;
const MAX_CARBON = 200;
const MAX_HYDRAULIC = 100;
const PHOTOSYNTHESIS_RATE_PER_LA = 0.5; // Carbon gain per LA per second at max light & stomata=1
const RESPIRATION_RATE_PER_LA = 0.02;   // Carbon loss per LA per second
const RESPIRATION_RATE_PER_TRUNK_VOL = 0.01; // Carbon loss per trunk volume per second
const TRANSPIRATION_RATE_PER_LA = 0.4; // Water loss rate per LA per sec at stomata=1, normal drought
const HYDRAULIC_RECOVERY_RATE = 2;   // Safety gain per second if stomata closed & water available
const HYDRAULIC_DAMAGE_THRESHOLD = 20; // Below this, start taking damage
const CROWN_DIEBACK_RATE = 0.05;      // Proportion of canopy LA potentially lost per second below threshold
const CROWN_RECOVERY_DELAY = 10;     // Seconds a damaged segment stays brown before disappearing (placeholder)
const GROWTH_COST_PER_LA = 5;        // Carbon cost to add 1 unit of LA (includes implicit trunk cost)
const SEED_COST = 10;                // Carbon cost per seed
const DAY_DURATION_SECONDS = 20;     // Duration of daytime
const NIGHT_DURATION_SECONDS = 8;     // Duration of nighttime
const ISLAND_RADIUS = 50;
const WATER_LEVEL = 0;
const ISLAND_LEVEL = 0.1;

// --- Game State ---
let gameState = {};

// --- Three.js Variables ---
let scene, camera, renderer, controls, sunLight;
let clock = new THREE.Clock();

// --- Initialization ---

function init() {
    setupScene();
    initializeGameState();
    createEnvironment();
    createPlayerTree();
    setupUIListeners();
    updateUI(); // Initial UI state
    gameLoop(); // Start the loop
}

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Sky blue
    scene.fog = new THREE.Fog(0x87ceeb, 50, 150); // Add fog for distance effect

    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(15, 15, 15); // Start further out

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.5); // Brighter sun
    sunLight.position.set(30, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; // Higher res shadow map
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    // Adjust shadow camera bounds to cover the island area
    const shadowCamSize = ISLAND_RADIUS * 1.5;
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(sunLight);
    scene.add(sunLight.target); // Make sure target is added

    // Optional: Light helper
    // const helper = new THREE.DirectionalLightHelper(sunLight, 5);
    // scene.add(helper);
    // const shadowHelper = new THREE.CameraHelper(sunLight.shadow.camera);
    // scene.add(shadowHelper);


    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth camera movement
    controls.dampingFactor = 0.05;
    controls.target.set(0, 2, 0); // Look towards the base of potential trees
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera going below ground much
    controls.minDistance = 5;
    controls.maxDistance = 100;

    window.addEventListener('resize', onWindowResize);
}

function initializeGameState() {
    gameState = {
        carbonStorage: 100,
        hydraulicSafety: 100,
        currentLA: INITIAL_LEAF_AREA, // Total potential leaf area
        effectiveLA: INITIAL_LEAF_AREA, // Current photosynthesizing leaf area
        trunkHeight: INITIAL_TRUNK_HEIGHT,
        seedCount: 0,
        stomatalConductance: parseFloat(stomataSlider.value), // Get initial value from slider
        day: 1, // Start on Day 1
        timeOfDay: 'day',
        timeInCycle: 0,
        droughtFactor: 1.0, // 1.0 = normal, >1 more droughty, <1 less
        isPaused: false,    // For allocation modal
        gameOver: false,
        treeMeshGroup: null,
        // Dieback tracking (simple percentage for now)
        damagedLAPercentage: 0, // Proportion of LA currently brown/dead (0 to 1)
        // Derived dimensions (calculated in create/grow)
        trunkWidth: 0,
        trunkDepth: 0,
        canopyWidth: 0,
        canopyDepth: 0,
    };
    calculateDimensions(gameState); // Calculate initial derived dimensions
}

function createEnvironment() {
    // Island
    const islandGeometry = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, ISLAND_LEVEL * 2, 32);
    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 }); // Brownish
    const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    islandMesh.position.y = ISLAND_LEVEL / 2; // Center it vertically
    islandMesh.receiveShadow = true;
    scene.add(islandMesh);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(ISLAND_RADIUS * 4, ISLAND_RADIUS * 4);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x4682B4, // Steel blue
        transparent: true,
        opacity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = WATER_LEVEL;
    waterMesh.receiveShadow = true; // Water can receive shadows from trees
    scene.add(waterMesh);
}

// --- Tree Creation & Growth ---

function calculateDimensions(state) {
    // Canopy (assume square for simplicity)
    state.canopyWidth = Math.sqrt(state.currentLA);
    state.canopyDepth = state.canopyWidth;

    // Trunk (assume square cross-section)
    const trunkArea = state.currentLA * k_TA_LA_RATIO;
    state.trunkWidth = Math.sqrt(trunkArea);
    state.trunkDepth = state.trunkWidth;
}

function createPlayerTree() {
    if (gameState.treeMeshGroup) {
        scene.remove(gameState.treeMeshGroup); // Remove old tree if restarting
    }

    const trunkGeometry = new THREE.BoxGeometry(gameState.trunkWidth, gameState.trunkHeight, gameState.trunkDepth);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Saddle Brown
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = "trunk"; // For later reference
    trunkMesh.position.y = gameState.trunkHeight / 2 + ISLAND_LEVEL; // Place base on island
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    // Canopy (Thin Box for volume, easier to scale)
    const canopyThickness = 0.1;
    const canopyGeometry = new THREE.BoxGeometry(gameState.canopyWidth, canopyThickness, gameState.canopyDepth);
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 }); // Forest Green
    const canopyMesh = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopyMesh.name = "canopy";
    canopyMesh.position.y = gameState.trunkHeight + canopyThickness / 2 + ISLAND_LEVEL;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true; // Canopy can receive shadow from taller trees (in MP)

    gameState.treeMeshGroup = new THREE.Group();
    gameState.treeMeshGroup.add(trunkMesh);
    gameState.treeMeshGroup.add(canopyMesh);
    gameState.treeMeshGroup.position.set(0, 0, 0); // Place at origin for now

    // Store initial scale factors for reference during growth
    gameState.initialTrunkScale = { x: trunkMesh.scale.x, y: trunkMesh.scale.y, z: trunkMesh.scale.z };
    gameState.initialCanopyScale = { x: canopyMesh.scale.x, y: canopyMesh.scale.y, z: canopyMesh.scale.z };


    scene.add(gameState.treeMeshGroup);
    controls.target.copy(gameState.treeMeshGroup.position); // Focus camera
     controls.target.y = gameState.trunkHeight / 2; // Look at mid-trunk
}

function growTree(carbonForGrowth) {
    const currentTrunkVolume = gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight;

    // Simplification: Allocate growth proportionally to existing LA and Volume
    // This isn't strictly tied to cost yet, just a plausible growth pattern
    // A more rigorous approach would calculate new LA/Vol based on carbon cost exactly
    const currentBiomassEstimate = gameState.currentLA + currentTrunkVolume; // Rough estimate
    const biomassToAdd = carbonForGrowth / GROWTH_COST_PER_LA; // Assume cost is uniform for simplicity

    const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

    // Increase LA and Height, then recalculate dimensions based on ratio
    gameState.currentLA *= growthFactor;
    gameState.trunkHeight *= growthFactor; // Grow taller proportionally

    calculateDimensions(gameState); // Recalculate widths/depths based on new LA and ratio

    // Update effective LA if no damage
    if (gameState.damagedLAPercentage === 0) {
        gameState.effectiveLA = gameState.currentLA;
    } else {
        // If damaged, new growth is healthy, but old damage remains
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
    }


    // Update Mesh Scales (relative to their base geometry size)
    const trunkMesh = gameState.treeMeshGroup.getObjectByName("trunk");
    const canopyMesh = gameState.treeMeshGroup.getObjectByName("canopy");

    // Note: This assumes the base geometry was 1x1x1 or that we scale relative to initial size
    // For BoxGeometry(w,h,d), scale applies ON TOP of w,h,d.
    // It's often easier to create 1x1x1 geometry and use scale exclusively,
    // OR update geometry dimensions directly (more complex).
    // Let's try updating geometry dimensions directly for clarity here:

    // Dispose old geometry to prevent memory leaks
    trunkMesh.geometry.dispose();
    canopyMesh.geometry.dispose();

    // Create new geometry with updated dimensions
    trunkMesh.geometry = new THREE.BoxGeometry(gameState.trunkWidth, gameState.trunkHeight, gameState.trunkDepth);
    canopyMesh.geometry = new THREE.BoxGeometry(gameState.canopyWidth, 0.1, gameState.canopyDepth); // Keep thickness constant

    // Reposition meshes based on new dimensions
    trunkMesh.position.y = gameState.trunkHeight / 2 + ISLAND_LEVEL;
    canopyMesh.position.y = gameState.trunkHeight + 0.1 / 2 + ISLAND_LEVEL;

     // Update camera target height
     controls.target.y = gameState.trunkHeight / 2;
}


// --- Simulation Logic ---

function updateSimulation(deltaTime) {
    if (gameState.isPaused || gameState.gameOver) return;

    // --- Day/Night Cycle ---
    gameState.timeInCycle += deltaTime;
    let cycleDuration = gameState.timeOfDay === 'day' ? DAY_DURATION_SECONDS : NIGHT_DURATION_SECONDS;

    if (gameState.timeInCycle >= cycleDuration) {
        gameState.timeInCycle = 0; // Reset timer for the new phase
        if (gameState.timeOfDay === 'day') {
            // Transition to Night
            gameState.timeOfDay = 'night';
            sunLight.intensity = 0.2; // Dim sunlight for night
            sunLight.position.set(-30, 50, -20); // Move sun low/opposite?
            startNightAllocation(); // Trigger allocation modal
        } else {
            // Transition to Day
            gameState.timeOfDay = 'day';
            gameState.day++;
            sunLight.intensity = 1.5; // Restore sun intensity
             sunLight.position.set(30, 50, 20); // Reset sun position
            // Maybe add random drought factor changes per day?
            // gameState.droughtFactor = 1.0 + Math.random() * 0.5;
            // showMessage(`Day ${gameState.day} starting. Drought factor: ${gameState.droughtFactor.toFixed(1)}`);
             showMessage(`Day ${gameState.day} starting.`);
        }
    }

    // --- Run simulation only during the day ---
    if (gameState.timeOfDay === 'day') {
        const stomata = gameState.stomatalConductance;
        const effLA = gameState.effectiveLA;
        const trunkVolume = gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight;

        // Photosynthesis (simplified light = 1)
        const potentialCarbonGain = PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata;
        gameState.carbonStorage += potentialCarbonGain * deltaTime;

        // Respiration
        const respirationLoss = (RESPIRATION_RATE_PER_LA * gameState.currentLA + RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
        gameState.carbonStorage -= respirationLoss * deltaTime;

        // Transpiration & Hydraulics
        // Water loss increases with open stomata and drought factor
        const waterLoss = TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
        // Hydraulic safety decreases with water loss, increases slowly if stomata closed/low loss
        const hydraulicChange = (HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
        gameState.hydraulicSafety += hydraulicChange * deltaTime;

        // Clamp values
        gameState.carbonStorage = Math.max(0, Math.min(MAX_CARBON, gameState.carbonStorage));
        gameState.hydraulicSafety = Math.max(0, Math.min(MAX_HYDRAULIC, gameState.hydraulicSafety));

        // --- Crown Dieback ---
        if (gameState.hydraulicSafety < HYDRAULIC_DAMAGE_THRESHOLD) {
            // Increase damage percentage
            const damageRate = CROWN_DIEBACK_RATE * deltaTime;
            gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageRate); // Cap at 100% damage
            gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
            updateCanopyVisuals(); // Make canopy brown
             showMessage(`Hydraulic stress! Losing leaves! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
            // Potentially add slow recovery here if needed, or just stop damage
             // Clear warning message if stress is over
            if (messageLogUI.textContent.includes('Hydraulic stress')) {
                clearMessage();
            }
        }


        // --- Check Game Over Conditions ---
        if (gameState.carbonStorage <= 0) {
            triggerGameOver("Starvation! Ran out of carbon.");
        } else if (gameState.hydraulicSafety <= 0) {
            triggerGameOver("Desiccation! Hydraulic system failed.");
        }
    }
     // Update cycle timer display regardless of day/night
    cycleTimerUI.textContent = Math.floor(cycleDuration - gameState.timeInCycle);

}

function updateCanopyVisuals() {
    const canopyMesh = gameState.treeMeshGroup.getObjectByName("canopy");
    if (!canopyMesh) return;

    // Simple approach: tint the whole canopy based on damage %
    const green = new THREE.Color(0x228B22); // Forest Green
    const brown = new THREE.Color(0x8B4513); // Saddle Brown

    // Interpolate color from green to brown
    canopyMesh.material.color.lerpColors(green, brown, gameState.damagedLAPercentage);

    // TODO: Implement the texture-based or grid-based dieback for more detail later
}


// --- UI & Event Handling ---

function setupUIListeners() {
    stomataSlider.addEventListener('input', (e) => {
        gameState.stomatalConductance = parseFloat(e.target.value);
        stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    });

    growthSlider.addEventListener('input', updateAllocationPreview);
    submitAllocationButton.addEventListener('click', submitAllocation);
    restartButton.addEventListener('click', restartGame);
}

function updateUI() {
    if (!gameState || gameState.gameOver) return;

    // Bars
    carbonBar.style.width = `${(gameState.carbonStorage / MAX_CARBON) * 100}%`;
    hydraulicBar.style.width = `${(gameState.hydraulicSafety / MAX_HYDRAULIC) * 100}%`;
    carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);

    // Info text
    dayCounterUI.textContent = gameState.day;
    seedCounterUI.textContent = gameState.seedCount;
    timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1); // Capitalize
}

function showMessage(text, type = 'info') {
     messageLogUI.textContent = text;
     messageLogUI.className = `message ${type}`; // type can be 'info', 'warning', 'error'
     // Clear message after a few seconds?
     // setTimeout(clearMessage, 5000);
}

function clearMessage() {
     messageLogUI.textContent = '';
      messageLogUI.className = 'message';
}


function startNightAllocation() {
    if (gameState.gameOver) return;

    gameState.isPaused = true; // Pause simulation updates
    const availableCarbon = Math.floor(gameState.carbonStorage);
    availableCarbonUI.textContent = availableCarbon;
    allocationDayUI.textContent = gameState.day;
    growthSlider.max = availableCarbon; // Can't allocate more than available
    growthSlider.value = Math.floor(availableCarbon / 2); // Default to 50%
     seedCostInfoUI.textContent = SEED_COST;

    updateAllocationPreview(); // Show initial preview based on default slider value
    allocationModal.classList.remove('hidden');
}

function updateAllocationPreview() {
    const available = Math.floor(gameState.carbonStorage);
    const growthAllocation = parseInt(growthSlider.value);
    const growthPercent = available > 0 ? Math.round((growthAllocation / available) * 100) : 0;
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * SEED_COST;
    const actualCarbonForGrowth = available - actualCarbonForSeeds; // Adjust growth C based on seed cost granularity


    growthPercentageUI.textContent = growthPercent;
     allocationGrowthCarbonUI.textContent = actualCarbonForGrowth;
     allocationSeedCarbonUI.textContent = actualCarbonForSeeds;
     allocationSeedCountUI.textContent = seedsToMake;

     // Adjust slider value if granularity changes the growth amount
     growthSlider.value = actualCarbonForGrowth;
     growthSlider.max = available; // Ensure max is correct

}

function submitAllocation() {
    const available = Math.floor(gameState.carbonStorage);
    const growthAllocation = parseInt(growthSlider.value); // Use the potentially adjusted value
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * SEED_COST;
    const actualCarbonForGrowth = available - actualCarbonForSeeds;

    // Deduct carbon first
    gameState.carbonStorage -= (actualCarbonForGrowth + actualCarbonForSeeds);

    // Add seeds
    gameState.seedCount += seedsToMake;

    // Apply growth
    if (actualCarbonForGrowth > 0) {
        growTree(actualCarbonForGrowth);
    }

    // Hide modal and resume
    allocationModal.classList.add('hidden');
    gameState.isPaused = false;

     // Immediately update UI after allocation
    updateUI();

    // Simulation loop will handle transitioning to the next day
}

function triggerGameOver(reason) {
    if (gameState.gameOver) return; // Prevent multiple triggers

    gameState.gameOver = true;
    gameState.isPaused = true; // Ensure simulation stops

    gameOverReasonUI.textContent = reason;
    finalDayUI.textContent = gameState.day;
    finalSeedsUI.textContent = gameState.seedCount;

    gameOverModal.classList.remove('hidden');

     // Optional: Stop rendering loop? Not strictly necessary if simulation is paused.
     // cancelAnimationFrame(animationFrameId);
}

function restartGame() {
    gameOverModal.classList.add('hidden');
    clearMessage();

    // Re-initialize state and tree
    initializeGameState();
    createPlayerTree(); // Recreate the tree mesh
    setupUIListeners(); // Re-attach listeners if needed (though they should persist)
    updateUI(); // Update UI to initial state

    // Reset camera target
    controls.target.set(0, gameState.trunkHeight / 2, 0);

    // Ensure simulation restarts
    gameState.gameOver = false;
    gameState.isPaused = false;
    if (!animationFrameId) { // Restart loop if it was cancelled
        gameLoop();
    }
}

// --- Game Loop ---
let animationFrameId;
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop); // Request next frame

    const deltaTime = clock.getDelta();

    if (!gameState.gameOver) { // Only update simulation and controls if game is running
      updateSimulation(deltaTime);
      updateUI();
      controls.update(); // Update camera controls
    }


    renderer.render(scene, camera); // Render the scene
}

// --- Window Resize ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start ---
init();