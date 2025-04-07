// environment.js
// Manages visual aspects of the game environment (lighting, sky, effects)

import * as THREE from 'three';
import { scene, sunLight, ambientLight, camera } from './sceneSetup.js';
import { gameState } from './gameState.js';

// --- Configuration ---
const skyColors = {
    day_sunny: new THREE.Color(0x87CEEB),
    day_cloudy: new THREE.Color(0xB0C4DE),
    night: new THREE.Color(0x000020),
};

const fogColors = {
    day_sunny: new THREE.Color(0x87CEEB),
    day_cloudy: new THREE.Color(0xA9A9A9),
    night: new THREE.Color(0x000010),
};

const FOG_DAY_NEAR = 50;
const FOG_DAY_FAR = 150;
const FOG_NIGHT_NEAR = 9999;
const FOG_NIGHT_FAR = 10000;

const ambientIntensity = { day_sunny: 0.6, day_cloudy: 0.4, night: 0.1 };
const sunIntensity = { day_sunny: 1.5, day_cloudy: 0.5, night: 0.0 };

const starCount = 7000;
const SMOOTHING_SPEED = 1.5;

// Rain Configuration
const RAIN_COUNT = 8000;
const RAIN_AREA_SIZE = 60;
const RAIN_HEIGHT = 40;
const RAIN_SPEED = 80;
const RAIN_COLOR = 0xAAAAFF;

// --- Module State for Lerping ---
let stars = null;
// ++ MOVED 'let' DECLARATIONS AFTER 'const' DEFINITIONS ++
let currentAmbientIntensity = ambientIntensity.day_sunny; // NOW VALID
let currentSunIntensity = sunIntensity.day_sunny;
let currentSkyColor = skyColors.day_sunny.clone();
let currentFogColor = fogColors.day_sunny.clone();
let currentFogNear = FOG_DAY_NEAR;
let currentFogFar = FOG_DAY_FAR;

let targetAmbientIntensity = currentAmbientIntensity;
let targetSunIntensity = currentSunIntensity;
let targetSkyColor = currentSkyColor.clone();
let targetFogColor = currentFogColor.clone();
let targetFogNear = currentFogNear;
let targetFogFar = currentFogFar;
let targetStarsVisible = false;
// ++ END MOVE ++

// Rain State
let rainParticles = null;
let rainGeometry = null;
let rainMaterial = null;
let rainPositions = null;
let rainVelocities = null;


// --- Initialization Functions ---

export function createStars() { // Logic remains the same
    if (stars) {
        if(stars.geometry) stars.geometry.dispose();
        if(stars.material) stars.material.dispose();
        if(scene) scene.remove(stars);
        stars = null;
    }
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF, size: 0.4, sizeAttenuation: true,
        transparent: true, opacity: 0.9, depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const radius = 500;
    for (let i = 0; i < starCount; i++) {
        const phi = Math.acos(-1 + (2 * Math.random()));
        const theta = Math.random() * Math.PI * 2;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        if (y > -radius * 0.05) starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = "stars"; stars.visible = false; stars.renderOrder = 1;
    if (scene) scene.add(stars);
    console.log("Stars created (Additive White) and added to scene.");
}

export function createRainSystem() { // Logic remains the same
    if (rainParticles) return;
    rainGeometry = new THREE.BufferGeometry();
    rainMaterial = new THREE.PointsMaterial({
        color: RAIN_COLOR, size: 0.15, transparent: true, opacity: 0.6,
        blending: THREE.NormalBlending, depthWrite: false
    });
    rainPositions = new Float32Array(RAIN_COUNT * 3);
    rainVelocities = new Array(RAIN_COUNT);
    const halfArea = RAIN_AREA_SIZE / 2;
    for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        rainPositions[i3 + 0] = Math.random() * RAIN_AREA_SIZE - halfArea;
        rainPositions[i3 + 1] = Math.random() * RAIN_HEIGHT;
        rainPositions[i3 + 2] = Math.random() * RAIN_AREA_SIZE - halfArea;
        rainVelocities[i] = -RAIN_SPEED * (0.8 + Math.random() * 0.4);
    }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    rainParticles = new THREE.Points(rainGeometry, rainMaterial);
    rainParticles.name = "rain"; rainParticles.visible = false;
    if (scene) scene.add(rainParticles);
    console.log("Rain particle system created.");
}

// --- Update Functions ---

export function setWeatherTargets(isNight, isCloudy, isRaining) { // Logic remains the same
    if (isNight) {
        targetAmbientIntensity = ambientIntensity.night; targetSunIntensity = sunIntensity.night;
        targetSkyColor = skyColors.night; targetFogColor = fogColors.night;
        targetFogNear = FOG_NIGHT_NEAR; targetFogFar = FOG_NIGHT_FAR;
        targetStarsVisible = !isRaining;
    } else {
        targetAmbientIntensity = isCloudy ? ambientIntensity.day_cloudy : ambientIntensity.day_sunny;
        targetSunIntensity = isCloudy ? sunIntensity.day_cloudy : sunIntensity.day_sunny;
        targetSkyColor = isCloudy ? skyColors.day_cloudy : skyColors.day_sunny;
        targetFogColor = isCloudy ? fogColors.day_cloudy : fogColors.day_sunny;
        targetFogNear = FOG_DAY_NEAR; targetFogFar = FOG_DAY_FAR;
        targetStarsVisible = false;
    }
     console.log(`ENV: Targets set - Night:${isNight}, Cloudy:${isCloudy}, Raining:${isRaining}, StarsTarget:${targetStarsVisible}`);
}


export function updateEnvironmentVisuals(deltaTime) { // Logic remains the same
    if (!scene || !scene.fog || !ambientLight || !sunLight) return;
    const lerpFactor = Math.min(1.0, deltaTime * SMOOTHING_SPEED);
    currentAmbientIntensity = THREE.MathUtils.lerp(currentAmbientIntensity, targetAmbientIntensity, lerpFactor);
    currentSunIntensity = THREE.MathUtils.lerp(currentSunIntensity, targetSunIntensity, lerpFactor);
    currentSkyColor.lerp(targetSkyColor, lerpFactor);
    currentFogColor.lerp(targetFogColor, lerpFactor);
    currentFogNear = THREE.MathUtils.lerp(currentFogNear, targetFogNear, lerpFactor);
    currentFogFar = THREE.MathUtils.lerp(currentFogFar, targetFogFar, lerpFactor);
    ambientLight.intensity = currentAmbientIntensity;
    sunLight.intensity = currentSunIntensity;
    scene.background = currentSkyColor;
    scene.fog.color = currentFogColor;
    scene.fog.near = currentFogNear;
    scene.fog.far = currentFogFar;
    if (stars && stars.visible !== targetStarsVisible) {
        stars.visible = targetStarsVisible;
        console.log(`ENV: Stars visibility set to ${targetStarsVisible}`);
    }
}

export function startRain() { // Logic remains the same
    if (rainParticles) {
        rainParticles.visible = true;
        console.log("ENV: Starting rain effect.");
    }
}

export function stopRain() { // Logic remains the same
     if (rainParticles) {
        rainParticles.visible = false;
        console.log("ENV: Stopping rain effect.");
    }
}

export function updateRain(deltaTime) { // Logic remains the same
    if (!rainParticles || !rainParticles.visible || !rainPositions || !rainVelocities) return;
    const positions = rainParticles.geometry.attributes.position.array;
    const halfArea = RAIN_AREA_SIZE / 2;
    for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        positions[i3 + 1] += rainVelocities[i] * deltaTime;
        if (positions[i3 + 1] < 0) {
            positions[i3 + 0] = Math.random() * RAIN_AREA_SIZE - halfArea;
            positions[i3 + 1] = RAIN_HEIGHT + Math.random() * 5;
            positions[i3 + 2] = Math.random() * RAIN_AREA_SIZE - halfArea;
        }
    }
    rainParticles.geometry.attributes.position.needsUpdate = true;
}