// environment.js
// Manages visual aspects of the game environment (lighting, sky, effects)

import * as THREE from 'three';
import { scene, sunLight, ambientLight } from './sceneSetup.js'; // Import necessary scene objects

// --- Configuration ---
const skyColors = {
    day_sunny: 0x87CEEB,    // Light Sky Blue
    day_cloudy: 0xB0C4DE,   // Light Steel Blue / Greyish
    night: 0x000020,       // Very Dark Blue
};

const fogColors = {
    day_sunny: 0x87CEEB,
    day_cloudy: 0xA9A9A9,   // Dark Grey
    night: 0x000010,       // Very Dark Blue/Black
};

const ambientIntensity = {
    day_sunny: 0.6,
    day_cloudy: 0.4,
    night: 0.1,
};

const sunIntensity = {
    day_sunny: 1.5,
    day_cloudy: 0.5,
    night: 0.05, // Keep a tiny bit for moonlight effect?
};

const starCount = 5000;
let stars = null;

// --- Initialization Functions ---

// Creates the star field (call once during setup)
export function createStars() {
    if (stars) return; // Already created

    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.1,
        sizeAttenuation: true, // Stars shrink with distance
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < starCount; i++) {
        // Position stars within a large sphere radius
        const radius = 150; // Should be outside the fog distance
        const phi = Math.acos(-1 + (2 * Math.random())); // Angle from y-axis
        const theta = Math.random() * Math.PI * 2;       // Angle around y-axis

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        // Ensure stars are mostly above the horizon (y > -radius*0.1)
        if (y > -radius * 0.1) {
             starVertices.push(x, y, z);
        }
    }

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = "stars";
    stars.visible = false; // Start hidden

    if (scene) {
        scene.add(stars);
        console.log("Stars created.");
    } else {
        console.error("Scene not available for adding stars.");
    }
}

// --- Update Functions ---

/**
 * Updates scene lighting based on time and weather.
 * @param {boolean} isNight
 * @param {boolean} isCloudy - Only relevant if !isNight
 */
export function updateLighting(isNight, isCloudy) {
    if (!sunLight || !ambientLight) return;

    let targetSunIntensity;
    let targetAmbientIntensity;

    if (isNight) {
        targetSunIntensity = sunIntensity.night;
        targetAmbientIntensity = ambientIntensity.night;
    } else { // Daytime
        if (isCloudy) {
            targetSunIntensity = sunIntensity.day_cloudy;
            targetAmbientIntensity = ambientIntensity.day_cloudy;
        } else { // Sunny
            targetSunIntensity = sunIntensity.day_sunny;
            targetAmbientIntensity = ambientIntensity.day_sunny;
        }
    }

    // Simple, direct update (can be smoothed later with lerp if needed)
    sunLight.intensity = targetSunIntensity;
    ambientLight.intensity = targetAmbientIntensity;
}

/**
 * Updates sky color, fog, and stars visibility.
 * @param {boolean} isNight
 * @param {boolean} isCloudy - Only relevant if !isNight
 */
export function updateSky(isNight, isCloudy) {
    if (!scene || !scene.fog) return;

    let targetSkyColor;
    let targetFogColor;

    if (isNight) {
        targetSkyColor = skyColors.night;
        targetFogColor = fogColors.night;
    } else { // Daytime
        if (isCloudy) {
            targetSkyColor = skyColors.day_cloudy;
            targetFogColor = fogColors.day_cloudy;
        } else { // Sunny
            targetSkyColor = skyColors.day_sunny;
            targetFogColor = fogColors.day_sunny;
        }
    }

    // Direct update
    scene.background = new THREE.Color(targetSkyColor);
    scene.fog.color.setHex(targetFogColor);

    // Update stars visibility
    toggleStars(isNight);
}

/**
 * Shows or hides the stars particle system.
 * @param {boolean} visible
 */
function toggleStars(visible) {
    if (stars) {
        stars.visible = visible;
    }
}

// TODO: Add Rain Particle System functions (Phase 3)
// export function createRainSystem() { ... }
// export function startRain() { ... }
// export function stopRain() { ... }
// export function updateRain(deltaTime) { ... }