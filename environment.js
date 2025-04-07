// environment.js
// Manages visual aspects of the game environment (lighting, sky, effects)

import * as THREE from 'three';
import { scene, sunLight, ambientLight } from './sceneSetup.js'; // Import necessary scene objects

// --- Configuration ---
const skyColors = {
    day_sunny: 0x87CEEB,
    day_cloudy: 0xB0C4DE,
    night: 0x000020,
};

const fogColors = {
    day_sunny: 0x87CEEB,
    day_cloudy: 0xA9A9A9,
    night: 0x000010,
};

// Store original fog distances from sceneSetup
const FOG_DAY_NEAR = 50;
const FOG_DAY_FAR = 150;
// Define "infinity" for night fog disable
const FOG_NIGHT_NEAR = 9999;
const FOG_NIGHT_FAR = 10000;


const ambientIntensity = { // Keep previous values
    day_sunny: 0.6,
    day_cloudy: 0.4,
    night: 0.1,
};

const sunIntensity = { // Keep previous values
    day_sunny: 1.5,
    day_cloudy: 0.5,
    night: 0.0,
};

const starCount = 7000;
let stars = null;

// --- Initialization Functions ---

export function createStars() { // Keep previous version of createStars
    if (stars) {
        if(stars.geometry) stars.geometry.dispose();
        if(stars.material) stars.material.dispose();
        if(scene) scene.remove(stars);
        stars = null;
        console.log("Removed old stars object.");
    }

    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    const starMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.4,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < starCount; i++) {
        const radius = 500; // Keep large radius
        const phi = Math.acos(-1 + (2 * Math.random()));
        const theta = Math.random() * Math.PI * 2;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        if (y > -radius * 0.05) {
             starVertices.push(x, y, z);
        }
    }
    console.log(`Generated ${starVertices.length / 3} star vertices.`);

    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    stars = new THREE.Points(starGeometry, starMaterial);
    stars.name = "stars";
    stars.visible = false; // Start hidden
    stars.renderOrder = 1;

    if (scene) {
        scene.add(stars);
        console.log("Stars created (Additive White) and added to scene.");
    } else {
        console.error("Scene not available for adding stars.");
    }
}

// --- Update Functions ---

export function updateLighting(isNight, isCloudy) { // Keep previous version
    if (!sunLight || !ambientLight) return;
    let targetSunIntensity;
    let targetAmbientIntensity;
    if (isNight) {
        targetSunIntensity = sunIntensity.night;
        targetAmbientIntensity = ambientIntensity.night;
    } else {
        if (isCloudy) {
            targetSunIntensity = sunIntensity.day_cloudy;
            targetAmbientIntensity = ambientIntensity.day_cloudy;
        } else {
            targetSunIntensity = sunIntensity.day_sunny;
            targetAmbientIntensity = ambientIntensity.day_sunny;
        }
    }
    sunLight.intensity = targetSunIntensity;
    ambientLight.intensity = targetAmbientIntensity;
}

/**
 * Updates sky color, fog properties (color, distance), and stars visibility logic.
 * @param {boolean} isNight
 * @param {boolean} isCloudy - Only relevant if !isNight
 */
export function updateSky(isNight, isCloudy) {
    if (!scene || !scene.fog) {
        console.error("Scene or scene.fog not found in updateSky");
        return;
    }

    let targetSkyColor;
    let targetFogColor;
    let targetFogNear;
    let targetFogFar;

    if (isNight) {
        targetSkyColor = skyColors.night;
        targetFogColor = fogColors.night;
        // ++ Push fog very far away at night ++
        targetFogNear = FOG_NIGHT_NEAR;
        targetFogFar = FOG_NIGHT_FAR;
        console.log("ENV: Setting night sky/fog (Fog Near/Far pushed out)");
    } else { // Daytime
        if (isCloudy) {
            targetSkyColor = skyColors.day_cloudy;
            targetFogColor = fogColors.day_cloudy;
        } else { // Sunny
            targetSkyColor = skyColors.day_sunny;
            targetFogColor = fogColors.day_sunny;
        }
        // ++ Restore normal day fog distances ++
        targetFogNear = FOG_DAY_NEAR;
        targetFogFar = FOG_DAY_FAR;
        console.log(`ENV: Setting day sky/fog (Cloudy: ${isCloudy})`);
    }

    // Apply updates
    scene.background = new THREE.Color(targetSkyColor);
    scene.fog.color.setHex(targetFogColor);
    scene.fog.near = targetFogNear;
    scene.fog.far = targetFogFar;

    console.log(`ENV: updateSky called. isNight = ${isNight}. Calling toggleStars.`);
    toggleStars(isNight);
}

/**
 * Shows or hides the stars particle system.
 * @param {boolean} visible
 */
function toggleStars(visible) { // Keep previous version
    if (stars) {
        stars.visible = visible;
        console.log(`ENV: toggleStars called. Setting stars visibility to: ${visible}`);
    } else {
         console.error("Attempted to toggle stars, but stars object is null.");
    }
}

// TODO: Add Rain Particle System functions (Phase 3)