import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- DOM Elements ---
// (No changes needed here)
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
const leafColorPicker = document.getElementById('leaf-color-picker');
const trunkColorPicker = document.getElementById('trunk-color-picker');

// --- Game Constants ---
// (No changes needed here)
const k_TA_LA_RATIO = 0.01;
const INITIAL_LEAF_AREA = 5;
const INITIAL_TRUNK_HEIGHT = 2;
const MAX_CARBON = 200;
const MAX_HYDRAULIC = 100;
const PHOTOSYNTHESIS_RATE_PER_LA = 0.5;
const RESPIRATION_RATE_PER_LA = 0.02;
const RESPIRATION_RATE_PER_TRUNK_VOL = 0.01;
const TRANSPIRATION_RATE_PER_LA = 0.4;
const HYDRAULIC_RECOVERY_RATE = 2;
const HYDRAULIC_DAMAGE_THRESHOLD = 20;
const CROWN_DIEBACK_RATE = 0.05;
const GROWTH_COST_PER_LA = 5;
const SEED_COST = 10;
const DAY_DURATION_SECONDS = 20;
const NIGHT_DURATION_SECONDS = 8;
const ISLAND_RADIUS = 50;
const WATER_LEVEL = 0;
const ISLAND_LEVEL = 0.1;
const DEFAULT_LEAF_COLOR = '#228B22';
const DEFAULT_TRUNK_COLOR = '#8B4513';

// --- Game State ---
let gameState = {};

// --- Three.js Variables ---
let scene, camera, renderer, controls, sunLight;
let clock = new THREE.Clock();
let trunkMaterial, canopyMaterial;

// --- Initialization ---
// (No changes needed in init, setupScene, initializeGameState, createEnvironment)
function init() {
    setupScene();
    initializeGameState();
    createEnvironment();
    createPlayerTree();
    setupUIListeners();
    updateUI();
    gameLoop();
}

function setupScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
    camera.position.set(15, 15, 15);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(30, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const shadowCamSize = ISLAND_RADIUS * 1.5;
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(sunLight);
    scene.add(sunLight.target);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 2, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 100;

    window.addEventListener('resize', onWindowResize);
}

function initializeGameState() {
    gameState = {
        carbonStorage: 100,
        hydraulicSafety: 100,
        currentLA: INITIAL_LEAF_AREA,
        effectiveLA: INITIAL_LEAF_AREA,
        trunkHeight: INITIAL_TRUNK_HEIGHT,
        seedCount: 0,
        stomatalConductance: parseFloat(stomataSlider.value),
        day: 1,
        timeOfDay: 'day',
        timeInCycle: 0,
        droughtFactor: 1.0,
        isPaused: false,
        gameOver: false,
        treeMeshGroup: null,
        damagedLAPercentage: 0,
        trunkWidth: 0,
        trunkDepth: 0,
        canopyWidth: 0,
        canopyDepth: 0,
        leafColor: DEFAULT_LEAF_COLOR,
        trunkColor: DEFAULT_TRUNK_COLOR,
    };
    calculateDimensions(gameState);
    leafColorPicker.value = gameState.leafColor;
    trunkColorPicker.value = gameState.trunkColor;
}

function createEnvironment() {
    // Island
    const islandGeometry = new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS, ISLAND_LEVEL * 2, 32);
    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 });
    const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    islandMesh.position.y = ISLAND_LEVEL / 2;
    islandMesh.receiveShadow = true;
    scene.add(islandMesh);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(ISLAND_RADIUS * 4, ISLAND_RADIUS * 4);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x4682B4,
        transparent: true,
        opacity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = WATER_LEVEL;
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);
}


// --- Tree Creation & Growth ---
// (No changes needed in calculateDimensions, createPlayerTree, growTree)

function calculateDimensions(state) {
    state.canopyWidth = Math.sqrt(state.currentLA);
    state.canopyDepth = state.canopyWidth;
    const trunkArea = state.currentLA * k_TA_LA_RATIO;
    state.trunkWidth = Math.sqrt(trunkArea);
    state.trunkDepth = state.trunkWidth;
}

function createPlayerTree() {
    if (gameState.treeMeshGroup) {
        scene.remove(gameState.treeMeshGroup);
        if (trunkMaterial) trunkMaterial.dispose();
        if (canopyMaterial) canopyMaterial.dispose();
    }

    const trunkGeometry = new THREE.BoxGeometry(gameState.trunkWidth, gameState.trunkHeight, gameState.trunkDepth);
    trunkMaterial = new THREE.MeshStandardMaterial({ color: gameState.trunkColor });
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = "trunk";
    trunkMesh.position.y = gameState.trunkHeight / 2 + ISLAND_LEVEL;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    const canopyThickness = 0.1;
    const canopyGeometry = new THREE.BoxGeometry(gameState.canopyWidth, canopyThickness, gameState.canopyDepth);
    canopyMaterial = new THREE.MeshStandardMaterial({ color: gameState.leafColor });
    const canopyMesh = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopyMesh.name = "canopy";
    canopyMesh.position.y = gameState.trunkHeight + canopyThickness / 2 + ISLAND_LEVEL;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;

    gameState.treeMeshGroup = new THREE.Group();
    gameState.treeMeshGroup.add(trunkMesh);
    gameState.treeMeshGroup.add(canopyMesh);
    gameState.treeMeshGroup.position.set(0, 0, 0);

    scene.add(gameState.treeMeshGroup);
    controls.target.copy(gameState.treeMeshGroup.position);
    controls.target.y = gameState.trunkHeight / 2;

    updateCanopyVisuals();
}

function growTree(carbonForGrowth) {
    const currentTrunkVolume = gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight;
    const currentBiomassEstimate = gameState.currentLA + currentTrunkVolume;
    const biomassToAdd = carbonForGrowth / GROWTH_COST_PER_LA;
    const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

    gameState.currentLA *= growthFactor;
    gameState.trunkHeight *= growthFactor;

    calculateDimensions(gameState);

    if (gameState.damagedLAPercentage === 0) {
        gameState.effectiveLA = gameState.currentLA;
    } else {
        gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
    }

    const trunkMesh = gameState.treeMeshGroup.getObjectByName("trunk");
    const canopyMesh = gameState.treeMeshGroup.getObjectByName("canopy");

    if (trunkMesh) {
        trunkMesh.geometry.dispose();
        trunkMesh.geometry = new THREE.BoxGeometry(gameState.trunkWidth, gameState.trunkHeight, gameState.trunkDepth);
        trunkMesh.position.y = gameState.trunkHeight / 2 + ISLAND_LEVEL;
    }
    if (canopyMesh) {
        canopyMesh.geometry.dispose();
        canopyMesh.geometry = new THREE.BoxGeometry(gameState.canopyWidth, 0.1, gameState.canopyDepth);
        canopyMesh.position.y = gameState.trunkHeight + 0.1 / 2 + ISLAND_LEVEL;
    }

    controls.target.y = gameState.trunkHeight / 2;
}


// --- Simulation Logic ---
// (No changes needed in updateSimulation, updateCanopyVisuals)

function updateSimulation(deltaTime) {
    if (gameState.isPaused || gameState.gameOver) return;

    // Day/Night Cycle
    gameState.timeInCycle += deltaTime;
    let cycleDuration = gameState.timeOfDay === 'day' ? DAY_DURATION_SECONDS : NIGHT_DURATION_SECONDS;

    if (gameState.timeInCycle >= cycleDuration) {
        gameState.timeInCycle = 0;
        if (gameState.timeOfDay === 'day') {
            gameState.timeOfDay = 'night';
            sunLight.intensity = 0.2;
            sunLight.position.set(-30, 50, -20);
            startNightAllocation();
        } else {
            gameState.timeOfDay = 'day';
            gameState.day++;
            sunLight.intensity = 1.5;
            sunLight.position.set(30, 50, 20);
            showMessage(`Day ${gameState.day} starting.`);
        }
         cycleTimerUI.textContent = Math.floor(cycleDuration);
    } else {
         cycleTimerUI.textContent = Math.floor(cycleDuration - gameState.timeInCycle);
    }


    if (gameState.timeOfDay === 'day') {
        const stomata = gameState.stomatalConductance;
        const effLA = gameState.effectiveLA;
        const trunkVolume = gameState.trunkWidth * gameState.trunkDepth * gameState.trunkHeight;

        const potentialCarbonGain = PHOTOSYNTHESIS_RATE_PER_LA * effLA * stomata;
        gameState.carbonStorage += potentialCarbonGain * deltaTime;

        const respirationLoss = (RESPIRATION_RATE_PER_LA * gameState.currentLA + RESPIRATION_RATE_PER_TRUNK_VOL * trunkVolume);
        gameState.carbonStorage -= respirationLoss * deltaTime;

        const waterLoss = TRANSPIRATION_RATE_PER_LA * effLA * stomata * gameState.droughtFactor;
        const hydraulicChange = (HYDRAULIC_RECOVERY_RATE * (1 - stomata)) - waterLoss;
        gameState.hydraulicSafety += hydraulicChange * deltaTime;

        gameState.carbonStorage = Math.max(0, Math.min(MAX_CARBON, gameState.carbonStorage));
        gameState.hydraulicSafety = Math.max(0, Math.min(MAX_HYDRAULIC, gameState.hydraulicSafety));

        if (gameState.hydraulicSafety < HYDRAULIC_DAMAGE_THRESHOLD) {
            const damageRate = CROWN_DIEBACK_RATE * deltaTime;
            gameState.damagedLAPercentage = Math.min(1, gameState.damagedLAPercentage + damageRate);
            gameState.effectiveLA = gameState.currentLA * (1 - gameState.damagedLAPercentage);
            updateCanopyVisuals();
             showMessage(`Hydraulic stress! Canopy damage! Safety: ${gameState.hydraulicSafety.toFixed(0)}`, 'warning');
        } else {
            if (messageLogUI.textContent.includes('Hydraulic stress')) {
                clearMessage();
            }
            if(gameState.damagedLAPercentage === 0 && canopyMaterial && canopyMaterial.color.getHexString() !== gameState.leafColor.substring(1)) {
                 updateCanopyVisuals();
            }
        }

        if (gameState.carbonStorage <= 0) {
            triggerGameOver("Starvation! Ran out of carbon.");
        } else if (gameState.hydraulicSafety <= 0) {
            triggerGameOver("Desiccation! Hydraulic system failed.");
        }
    }
}

function updateCanopyVisuals() {
    if (!canopyMaterial || !gameState.treeMeshGroup) return;

    const baseColor = new THREE.Color(gameState.leafColor);
    const brown = new THREE.Color(0x8B4513);

    // Only apply tint if canopy is supposed to be visible (not game over)
    if (!gameState.gameOver || !gameState.treeMeshGroup.getObjectByName("canopy")?.visible === false) {
         canopyMaterial.color.lerpColors(baseColor, brown, gameState.damagedLAPercentage);
    }
}


// --- UI & Event Handling ---
// (No changes needed in setupUIListeners, updateUI, showMessage, clearMessage, startNightAllocation, updateAllocationPreview, submitAllocation)

function setupUIListeners() {
    stomataSlider.addEventListener('input', (e) => {
        gameState.stomatalConductance = parseFloat(e.target.value);
        stomataValueUI.textContent = `${Math.round(gameState.stomatalConductance * 100)}%`;
    });

    growthSlider.addEventListener('input', updateAllocationPreview);
    submitAllocationButton.addEventListener('click', submitAllocation);
    restartButton.addEventListener('click', restartGame);

    leafColorPicker.addEventListener('input', (e) => {
        gameState.leafColor = e.target.value;
        if (canopyMaterial) {
            updateCanopyVisuals();
        }
    });

    trunkColorPicker.addEventListener('input', (e) => {
        gameState.trunkColor = e.target.value;
        if (trunkMaterial) {
            trunkMaterial.color.set(gameState.trunkColor);
        }
    });
}

function updateUI() {
    if (!gameState || gameState.gameOver) return;

    carbonBar.style.width = `${(gameState.carbonStorage / MAX_CARBON) * 100}%`;
    hydraulicBar.style.width = `${(gameState.hydraulicSafety / MAX_HYDRAULIC) * 100}%`;
    carbonValueUI.textContent = Math.floor(gameState.carbonStorage);
    hydraulicValueUI.textContent = Math.floor(gameState.hydraulicSafety);

    dayCounterUI.textContent = gameState.day;
    seedCounterUI.textContent = gameState.seedCount;
    timeOfDayUI.textContent = gameState.timeOfDay.charAt(0).toUpperCase() + gameState.timeOfDay.slice(1);

    leafColorPicker.value = gameState.leafColor;
    trunkColorPicker.value = gameState.trunkColor;
}

function showMessage(text, type = 'info') {
     messageLogUI.textContent = text;
     messageLogUI.className = `message ${type}`;
}

function clearMessage() {
     messageLogUI.textContent = '';
     messageLogUI.className = 'message';
}

function startNightAllocation() {
    if (gameState.gameOver) return;

    gameState.isPaused = true;
    const availableCarbon = Math.floor(gameState.carbonStorage);
    availableCarbonUI.textContent = availableCarbon;
    allocationDayUI.textContent = gameState.day;
    growthSlider.max = availableCarbon;
    growthSlider.value = Math.min(availableCarbon, Math.floor(availableCarbon / 2));
    seedCostInfoUI.textContent = SEED_COST;

    updateAllocationPreview();
    allocationModal.classList.remove('hidden');
}

function updateAllocationPreview() {
    const available = Math.floor(gameState.carbonStorage);
    let growthAllocation = 0;
     if(document.getElementById('growth-slider')){
        growthAllocation = parseInt(document.getElementById('growth-slider').value) || 0;
     } else {
         console.warn("Growth slider not found during preview update.");
         growthAllocation = Math.floor(available / 2);
     }

     growthAllocation = Math.min(available, growthAllocation);
     if(document.getElementById('growth-slider')) {
          document.getElementById('growth-slider').value = growthAllocation;
          document.getElementById('growth-slider').max = available;
     }

    const growthPercent = available > 0 ? Math.round((growthAllocation / available) * 100) : 0;
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * SEED_COST;
    const actualCarbonForGrowth = available - actualCarbonForSeeds;

    const growthPercentElem = document.getElementById('growth-percentage');
    const growthCarbonElem = document.getElementById('allocation-growth-carbon');
    const seedCarbonElem = document.getElementById('allocation-seed-carbon');
    const seedCountElem = document.getElementById('allocation-seed-count');

    if(growthPercentElem) growthPercentElem.textContent = growthPercent;
    if(growthCarbonElem) growthCarbonElem.textContent = actualCarbonForGrowth;
    if(seedCarbonElem) seedCarbonElem.textContent = actualCarbonForSeeds;
    if(seedCountElem) seedCountElem.textContent = seedsToMake;

     if(document.getElementById('growth-slider')) {
        document.getElementById('growth-slider').value = actualCarbonForGrowth;
     }
}


function submitAllocation() {
    const available = Math.floor(gameState.carbonStorage);
     let growthAllocation = 0;
     if(document.getElementById('growth-slider')){
         growthAllocation = parseInt(document.getElementById('growth-slider').value) || 0;
     } else {
         console.error("Growth slider not found on submit!");
         allocationModal.classList.add('hidden');
         gameState.isPaused = false;
         updateUI();
         return;
     }

    growthAllocation = Math.min(available, growthAllocation);
    const carbonForSeeds = available - growthAllocation;
    const seedsToMake = carbonForSeeds >= 0 ? Math.floor(carbonForSeeds / SEED_COST) : 0;
    const actualCarbonForSeeds = seedsToMake * SEED_COST;
    const actualCarbonForGrowth = available - actualCarbonForSeeds;

    gameState.carbonStorage -= (actualCarbonForGrowth + actualCarbonForSeeds);
    gameState.seedCount += seedsToMake;

    if (actualCarbonForGrowth > 0) {
        growTree(actualCarbonForGrowth);
    }

    allocationModal.classList.add('hidden');
    gameState.isPaused = false;
    updateUI();
}

// --- Game Over & Restart ---

function triggerGameOver(reason) {
    if (gameState.gameOver) return; // Prevent multiple triggers

    gameState.gameOver = true;
    gameState.isPaused = true; // Ensure simulation stops

    gameOverReasonUI.textContent = reason;
    finalDayUI.textContent = gameState.day;
    finalSeedsUI.textContent = gameState.seedCount;

    // ++ NEW: Hide the canopy mesh ++
    if (gameState.treeMeshGroup) {
        const canopyMesh = gameState.treeMeshGroup.getObjectByName("canopy");
        if (canopyMesh) {
            canopyMesh.visible = false; // Make canopy invisible
        }
    }
    // ++ END NEW ++

    gameOverModal.classList.remove('hidden'); // Show the game over message box
}

function restartGame() {
    gameOverModal.classList.add('hidden');
    clearMessage();

    // Ensure canopy mesh is potentially re-added or made visible
    // The easiest way is just to recreate the tree entirely during initialize
    // (which we already do). We just need to ensure the old one is gone.
    if (gameState.treeMeshGroup) {
         scene.remove(gameState.treeMeshGroup);
         if (trunkMaterial) trunkMaterial.dispose();
         if (canopyMaterial) canopyMaterial.dispose();
         trunkMaterial = null; // Clear references
         canopyMaterial = null;
         gameState.treeMeshGroup = null;
    }


    initializeGameState(); // Resets state, including gameOver flag
    createPlayerTree();    // Creates a new tree with visible canopy
    updateUI();            // Resets UI elements

    controls.target.set(0, gameState.trunkHeight / 2, 0);

    gameState.isPaused = false; // Ensure simulation can run
    if (!animationFrameId) { // Should not be needed if loop isn't stopped
        gameLoop();
    }
}

// --- Game Loop ---
let animationFrameId;
function gameLoop() {
    animationFrameId = requestAnimationFrame(gameLoop);

    const deltaTime = clock.getDelta();

    // Check specifically if the game is NOT over before updating
    if (!gameState.gameOver) {
      updateSimulation(deltaTime); // Includes check for isPaused internally
      updateUI();                // Update UI unless game is over
      controls.update();         // Allow camera movement even if paused, but maybe not if game over?
    } else {
        // Optionally keep updating controls even on game over screen
         controls.update();
    }


    renderer.render(scene, camera);
}

// --- Window Resize ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start ---
init();