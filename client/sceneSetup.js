// client/sceneSetup.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Config from './config.js';
import { createStars, createRainSystem } from './environment.js';

export let scene;
export let camera;
export let renderer;
export let controls;
export let sunLight;
export let ambientLight;

export function initScene(canvas) {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Initial color, environment.js will update

    // Fog setup - Use client config values if available, otherwise provide defaults
    // Note: Config constants FOG_DAY_NEAR/FAR are commented out in client/config.js, so provide defaults here.
    const fogNear = Config.FOG_DAY_NEAR !== undefined ? Config.FOG_DAY_NEAR : 50;
    const fogFar = Config.FOG_DAY_FAR !== undefined ? Config.FOG_DAY_FAR : 150;
    scene.fog = new THREE.Fog(0x87ceeb, fogNear, fogFar); // environment.js will update color and distances

    // Camera setup
    const aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000); // Far plane at 1000
    camera.position.set(15, 15, 15);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting setup
    ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Initial intensity
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.5); // Initial intensity
    sunLight.position.set(30, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    // Use client config for shadow camera size calculation
    const shadowCamSize = (Config.ISLAND_RADIUS || 50) * 1.5; // Use fallback if config missing
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(sunLight);
    scene.add(sunLight.target); // Target is needed for directional light shadows

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // Use client config for initial target height
    controls.target.set(0, (Config.INITIAL_TRUNK_HEIGHT || 2) / 2, 0); // Use fallback
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent looking straight down/up too far
    controls.minDistance = 5;  // Prevent zooming too close
    controls.maxDistance = 100; // Prevent zooming too far out

    // Static Environment Meshes (Island, Water)
    createEnvironment(); // <<< This function creates the island

    // Initialize Dynamic Environment Effects (Stars, Rain)
    createStars();
    createRainSystem();

    // Window Resize Listener
    window.addEventListener('resize', onWindowResize);

    console.log("Scene initialized (including stars and rain system placeholder)");
}

// Creates static meshes like island and water
function createEnvironment() {
    // Use client config values with fallbacks for safety
    const islandRadius = Config.ISLAND_RADIUS || 50;
    const islandLevel = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
    const waterLevel = Config.WATER_LEVEL !== undefined ? Config.WATER_LEVEL : 0;

    // Island
    const islandGeometry = new THREE.CylinderGeometry(islandRadius, islandRadius, islandLevel * 2, 32);
    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 }); // Brownish color
    const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    islandMesh.position.y = islandLevel / 2; // Center it vertically around islandLevel
    islandMesh.receiveShadow = true;
    // +++ Assign the name property +++
    islandMesh.name = 'island'; // <<< ENSURE THIS LINE IS PRESENT
    // ++++++++++++++++++++++++++++++++
    scene.add(islandMesh);
    console.log(`SCENESETUP: Island mesh created and added with name: ${islandMesh.name}`); // Add log

    // Water
    console.log(`SCENESETUP: Creating water with radius factor based on ISLAND_RADIUS: ${islandRadius}`);
    const waterGeometry = new THREE.PlaneGeometry(islandRadius * 4, islandRadius * 4); // Large plane
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x4682B4, // Steel blue
        transparent: true,
        opacity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2; // Rotate flat
    waterMesh.position.y = waterLevel;   // Position at water level
    console.log(`SCENESETUP: Water mesh Y position: ${waterMesh.position.y}`);
    waterMesh.receiveShadow = true; // Water can receive shadows (e.g., from trees)
    scene.add(waterMesh);
}

// Handles window resize events
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}