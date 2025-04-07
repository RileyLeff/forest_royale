import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Config from './config.js';
// Import environment initializers
import { createStars, createRainSystem } from './environment.js';

// Exports for use by other modules
export let scene;
export let camera; // Export camera for potential use (e.g., rain relative positioning)
export let renderer;
export let controls;
export let sunLight;
export let ambientLight;

export function initScene(canvas) {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // Initial color, environment.js will update
    scene.fog = new THREE.Fog(0x87ceeb, Config.FOG_DAY_NEAR, Config.FOG_DAY_FAR); // Use constants, environment.js will update

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
    const shadowCamSize = Config.ISLAND_RADIUS * 1.5;
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, Config.INITIAL_TRUNK_HEIGHT / 2, 0); // Initial target based on config
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 100;

    // Static Environment Meshes (Island, Water)
    createEnvironment();

    // Initialize Dynamic Environment Effects (Stars, Rain)
    createStars();
    createRainSystem();

    // Window Resize Listener
    window.addEventListener('resize', onWindowResize);

    console.log("Scene initialized (including stars and rain system placeholder)");
}

// Creates static meshes like island and water
function createEnvironment() {
    // Island
    const islandGeometry = new THREE.CylinderGeometry(Config.ISLAND_RADIUS, Config.ISLAND_RADIUS, Config.ISLAND_LEVEL * 2, 32);
    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 });
    const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    islandMesh.position.y = Config.ISLAND_LEVEL / 2; // Center it vertically slightly above water
    islandMesh.receiveShadow = true;
    scene.add(islandMesh);

    // Water
    const waterGeometry = new THREE.PlaneGeometry(Config.ISLAND_RADIUS * 4, Config.ISLAND_RADIUS * 4);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x4682B4, // Steel blue
        transparent: true,
        opacity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = Config.WATER_LEVEL; // At Y=0
    waterMesh.receiveShadow = true; // Water can receive shadows
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