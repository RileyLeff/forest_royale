// environment.js
// Manages visual aspects of the game environment (lighting, sky, effects)

import * as THREE from 'three';
import { scene, sunLight, ambientLight } from './sceneSetup.js'; // Import necessary scene objects
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

// --- Module State for Lerping ---
let stars = null;
let currentAmbientIntensity = ambientIntensity.day_sunny; // Initial state
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
let targetStarsVisible = false; // Target visibility for stars

// --- Initialization Functions ---

export function createStars() {
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
    stars.name = "stars";
    stars.visible = false; // Start hidden
    stars.renderOrder = 1;

    if (scene) scene.add(stars);
    console.log("Stars created (Additive White) and added to scene.");
}

// --- Update Functions ---

/**
 * Sets the TARGET visual state based on weather conditions.
 * Called by simulation.js when a weather period/phase changes.
 * @param {boolean} isNight
 * @param {boolean} isCloudy - Only relevant if !isNight
 * @param {boolean} isRaining - Used for star visibility check
 */
export function setWeatherTargets(isNight, isCloudy, isRaining) {
    if (isNight) {
        targetAmbientIntensity = ambientIntensity.night;
        targetSunIntensity = sunIntensity.night;
        targetSkyColor = skyColors.night;
        targetFogColor = fogColors.night;
        targetFogNear = FOG_NIGHT_NEAR;
        targetFogFar = FOG_NIGHT_FAR;
        // ++ Conditional Star Visibility Target ++
        targetStarsVisible = !isRaining; // Stars visible only if NOT raining at night
    } else { // Daytime
        targetAmbientIntensity = isCloudy ? ambientIntensity.day_cloudy : ambientIntensity.day_sunny;
        targetSunIntensity = isCloudy ? sunIntensity.day_cloudy : sunIntensity.day_sunny;
        targetSkyColor = isCloudy ? skyColors.day_cloudy : skyColors.day_sunny;
        targetFogColor = isCloudy ? fogColors.day_cloudy : fogColors.day_sunny;
        targetFogNear = FOG_DAY_NEAR;
        targetFogFar = FOG_DAY_FAR;
        targetStarsVisible = false; // Stars never visible during day
    }
     console.log(`ENV: Targets set - Night:${isNight}, Cloudy:${isCloudy}, Raining:${isRaining}, StarsTarget:${targetStarsVisible}`);
}

/**
 * Updates the actual visual environment state via lerping towards targets.
 * Called every frame by the main game loop.
 * @param {number} deltaTime
 */
export function updateEnvironmentVisuals(deltaTime) {
    if (!scene || !scene.fog || !ambientLight || !sunLight) return; // Ensure scene objects exist

    const lerpFactor = Math.min(1.0, deltaTime * SMOOTHING_SPEED); // Prevent overshooting

    // Lerp intensities
    currentAmbientIntensity = THREE.MathUtils.lerp(currentAmbientIntensity, targetAmbientIntensity, lerpFactor);
    currentSunIntensity = THREE.MathUtils.lerp(currentSunIntensity, targetSunIntensity, lerpFactor);

    // Lerp colors
    currentSkyColor.lerp(targetSkyColor, lerpFactor);
    currentFogColor.lerp(targetFogColor, lerpFactor);

    // Lerp fog distances (optional, can make instant if lerping looks weird)
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
    if (stars) {
        if (stars.visible !== targetStarsVisible) {
             stars.visible = targetStarsVisible;
             console.log(`ENV: Stars visibility set to ${targetStarsVisible}`);
        }
    }
}

// NOTE: toggleStars function removed as logic moved into updateEnvironmentVisuals/setWeatherTargets

// TODO: Add Rain Particle System functions (Phase 3)