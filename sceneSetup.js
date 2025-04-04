import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as Config from './config.js';

export let scene;
export let camera;
export let renderer;
export let controls;
export let sunLight;

export function initScene(canvas) {
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

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
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
    scene.add(sunLight.target); // Ensure target is added for potential updates

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, Config.INITIAL_TRUNK_HEIGHT / 2, 0); // Initial target
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    controls.minDistance = 5;
    controls.maxDistance = 100;

    // Environment Meshes
    createEnvironment();

    // Resize Listener
    window.addEventListener('resize', onWindowResize);

    console.log("Scene initialized");
}

function createEnvironment() {
    // Island
    const islandGeometry = new THREE.CylinderGeometry(Config.ISLAND_RADIUS, Config.ISLAND_RADIUS, Config.ISLAND_LEVEL * 2, 32);
    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0x967969 }); // Brownish
    const islandMesh = new THREE.Mesh(islandGeometry, islandMaterial);
    islandMesh.position.y = Config.ISLAND_LEVEL / 2; // Center it vertically
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
    waterMesh.position.y = Config.WATER_LEVEL;
    waterMesh.receiveShadow = true; // Water can receive shadows from trees
    scene.add(waterMesh);
}


function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}