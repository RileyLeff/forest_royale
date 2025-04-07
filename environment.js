// environment.js
// Manages visual aspects of the game environment (lighting, sky, effects)

import * as THREE from 'three';
import { scene, sunLight, ambientLight, camera } from './sceneSetup.js'; // Import camera needed for rain positioning
import { gameState } from './gameState.js'; // Import gameState to check rain status

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
const FOG_NIGHT_NEAR = 9999; // Effectively disable fog at night
const FOG_NIGHT_FAR = 10000;

const ambientIntensity = { day_sunny: 0.6, day_cloudy: 0.4, night: 0.1 };
const sunIntensity = { day_sunny: 1.5, day_cloudy: 0.5, night: 0.0 };

const starCount = 7000;
const SMOOTHING_SPEED = 1.5; // How fast transitions occur (higher is faster)

// Rain Configuration
const RAIN_COUNT = 7000; // Slightly reduced count? Adjust if needed.
const RAIN_AREA_SIZE = 60; // Area around the center where rain can fall
const RAIN_HEIGHT = 50;    // Increased from 40, starts rain higher
const RAIN_SPEED = 80;     // How fast raindrops fall (units per second)
const RAIN_COLOR = 0xAAAAFF; // Bluish-white tint

// --- Module State for Lerping ---
let stars = null;
let currentAmbientIntensity = ambientIntensity.day_sunny;
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

// Rain State
let rainParticles = null;
let rainGeometry = null;
let rainMaterial = null;
let rainPositions = null; // Float32Array for particle positions
let rainVelocities = null; // Simple array for y-velocities

// --- Initialization Functions ---

export function createStars() {
    // Cleanup if called again
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

// Creates the Rain Particle System
export function createRainSystem() {
    if (rainParticles) return; // Already exists

    rainGeometry = new THREE.BufferGeometry();
    rainMaterial = new THREE.PointsMaterial({
        color: RAIN_COLOR,
        // ++ REDUCED BASE SIZE ++
        size: 0.08, // Reduced from 0.15
        sizeAttenuation: true, // Ensure this is true (default)
        transparent: true,
        opacity: 0.6,
        blending: THREE.NormalBlending, // Normal blending for rain
        depthWrite: false // Often good for transparent particles
    });

    rainPositions = new Float32Array(RAIN_COUNT * 3);
    rainVelocities = new Array(RAIN_COUNT);

    const halfArea = RAIN_AREA_SIZE / 2;

    for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        // Initial random position within the rain area volume
        rainPositions[i3 + 0] = Math.random() * RAIN_AREA_SIZE - halfArea; // X
        // Use the UPDATED RAIN_HEIGHT for initial spawn
        rainPositions[i3 + 1] = Math.random() * RAIN_HEIGHT;             // Y
        rainPositions[i3 + 2] = Math.random() * RAIN_AREA_SIZE - halfArea; // Z

        // Assign a slightly varied downward velocity
        rainVelocities[i] = -RAIN_SPEED * (0.8 + Math.random() * 0.4); // Y velocity
    }

    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

    rainParticles = new THREE.Points(rainGeometry, rainMaterial);
    rainParticles.name = "rain";
    rainParticles.visible = false; // Start hidden

    if (scene) {
        scene.add(rainParticles);
        console.log("Rain particle system created.");
    } else {
        console.error("Scene not available for adding rain system.");
    }
}


// --- Update Functions ---

// Sets the TARGET visual state based on weather conditions
export function setWeatherTargets(isNight, isCloudy, isRaining) {
    if (isNight) {
        targetAmbientIntensity = ambientIntensity.night; targetSunIntensity = sunIntensity.night;
        targetSkyColor = skyColors.night; targetFogColor = fogColors.night;
        targetFogNear = FOG_NIGHT_NEAR; targetFogFar = FOG_NIGHT_FAR;
        targetStarsVisible = !isRaining;
    } else { // Daytime
        targetAmbientIntensity = isCloudy ? ambientIntensity.day_cloudy : ambientIntensity.day_sunny;
        targetSunIntensity = isCloudy ? sunIntensity.day_cloudy : sunIntensity.day_sunny;
        targetSkyColor = isCloudy ? skyColors.day_cloudy : skyColors.day_sunny;
        targetFogColor = isCloudy ? fogColors.day_cloudy : fogColors.day_sunny;
        targetFogNear = FOG_DAY_NEAR; targetFogFar = FOG_DAY_FAR;
        targetStarsVisible = false;
    }
     // console.log(`ENV: Targets set - Night:${isNight}, Cloudy:${isCloudy}, Raining:${isRaining}, StarsTarget:${targetStarsVisible}`);
}

// Updates the actual visual environment state via lerping towards targets
export function updateEnvironmentVisuals(deltaTime) {
    if (!scene || !scene.fog || !ambientLight || !sunLight) return; // Ensure scene objects exist

    const lerpFactor = Math.min(1.0, deltaTime * SMOOTHING_SPEED); // Prevent overshooting

    // Lerp intensities
    currentAmbientIntensity = THREE.MathUtils.lerp(currentAmbientIntensity, targetAmbientIntensity, lerpFactor);
    currentSunIntensity = THREE.MathUtils.lerp(currentSunIntensity, targetSunIntensity, lerpFactor);

    // Lerp colors
    currentSkyColor.lerp(targetSkyColor, lerpFactor);
    currentFogColor.lerp(targetFogColor, lerpFactor);

    // Lerp fog distances
    currentFogNear = THREE.MathUtils.lerp(currentFogNear, targetFogNear, lerpFactor);
    currentFogFar = THREE.MathUtils.lerp(currentFogFar, targetFogFar, lerpFactor);

    // Apply current values
    ambientLight.intensity = currentAmbientIntensity;
    sunLight.intensity = currentSunIntensity;
    scene.background = currentSkyColor;
    scene.fog.color = currentFogColor; // Assigning the color object directly
    scene.fog.near = currentFogNear;
    scene.fog.far = currentFogFar;

    // Update star visibility (instant change is fine)
    if (stars && stars.visible !== targetStarsVisible) {
        stars.visible = targetStarsVisible;
        console.log(`ENV: Stars visibility set to ${targetStarsVisible}`);
    }
}

// Makes rain visible
export function startRain() {
    if (rainParticles) {
        rainParticles.visible = true;
        console.log("ENV: Starting rain effect.");
    }
}

// Makes rain invisible
export function stopRain() {
     if (rainParticles) {
        rainParticles.visible = false;
        console.log("ENV: Stopping rain effect.");
    }
}

// Animates the raindrops
export function updateRain(deltaTime) {
    if (!rainParticles || !rainParticles.visible || !rainPositions || !rainVelocities) {
        return; // Don't update if not raining or not initialized
    }

    const positions = rainParticles.geometry.attributes.position.array;
    const halfArea = RAIN_AREA_SIZE / 2;

    for (let i = 0; i < RAIN_COUNT; i++) {
        const i3 = i * 3;
        // Update Y position based on velocity and delta time
        positions[i3 + 1] += rainVelocities[i] * deltaTime;

        // Check if particle has fallen below ground (y=0)
        // Reset particle to the top using the UPDATED RAIN_HEIGHT
        if (positions[i3 + 1] < 0) {
            positions[i3 + 0] = Math.random() * RAIN_AREA_SIZE - halfArea;
            positions[i3 + 1] = RAIN_HEIGHT + Math.random() * 5; // Reset to top (using new height)
            positions[i3 + 2] = Math.random() * RAIN_AREA_SIZE - halfArea;
        }
    }

    // VERY IMPORTANT: Mark the position attribute as needing update
    rainParticles.geometry.attributes.position.needsUpdate = true;
}