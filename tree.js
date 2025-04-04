import * as THREE from 'three';
import * as Config from './config.js';
import { scene } from './sceneSetup.js'; // Import scene to add/remove tree

// Store material references within this module
let trunkMaterial = null;
let canopyMaterial = null;

// Calculates derived dimensions based on LA and height in gameState
// Modifies the passed state object directly.
export function calculateDimensions(state) {
    // Ensure LA is positive to avoid sqrt(negative)
    const safeLA = Math.max(0.0001, state.currentLA); // Use tiny minimum to avoid 0 width/depth
    state.canopyWidth = Math.sqrt(safeLA);
    state.canopyDepth = state.canopyWidth;

    const trunkArea = safeLA * Config.k_TA_LA_RATIO;
    state.trunkWidth = Math.sqrt(trunkArea);
    state.trunkDepth = state.trunkWidth;
}

// Creates or recreates the player's tree mesh group
export function createPlayerTree(state) {
    // Clean up old tree if it exists
    if (state.treeMeshGroup) {
        scene.remove(state.treeMeshGroup);
        disposeTreeMaterials(); // Dispose materials
        state.treeMeshGroup = null;
    }
     // Ensure dimensions are calculated if state was just reset or invalid
     if ((state.trunkWidth <= 0 || state.canopyWidth <= 0) && state.currentLA > 0) {
          calculateDimensions(state);
     }


    // Create new materials using colors from state
    trunkMaterial = new THREE.MeshStandardMaterial({ color: state.trunkColor });
    canopyMaterial = new THREE.MeshStandardMaterial({ color: state.leafColor }); // Base color

    // Create geometries using calculated dimensions
    const trunkGeometry = new THREE.BoxGeometry(state.trunkWidth || 0.1, state.trunkHeight || 0.1, state.trunkDepth || 0.1); // Use fallback size if 0
    const canopyThickness = 0.1;
    const canopyGeometry = new THREE.BoxGeometry(state.canopyWidth || 0.1, canopyThickness, state.canopyDepth || 0.1); // Use fallback size if 0

    // Create meshes
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = "trunk";
    trunkMesh.position.y = state.trunkHeight / 2 + Config.ISLAND_LEVEL;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    const canopyMesh = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopyMesh.name = "canopy";
    canopyMesh.position.y = state.trunkHeight + canopyThickness / 2 + Config.ISLAND_LEVEL;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;

    // Create group and add meshes
    state.treeMeshGroup = new THREE.Group();
    state.treeMeshGroup.add(trunkMesh);
    state.treeMeshGroup.add(canopyMesh);
    state.treeMeshGroup.position.set(0, 0, 0); // Position group at origin

    // Add the group to the main scene
    scene.add(state.treeMeshGroup);

    // Apply initial damage tinting if necessary
    updateCanopyVisuals(state);

    console.log("Player tree created/recreated.");
}

// Applies growth based on carbon investment
export function growTree(state, carbonForGrowth) {
    if (!state.treeMeshGroup || carbonForGrowth <= 0) return; // No tree or no C

    const currentTrunkVolume = state.trunkWidth * state.trunkDepth * state.trunkHeight;
    // Avoid division by zero if biomass is somehow zero
    const currentBiomassEstimate = Math.max(1, state.currentLA + currentTrunkVolume); // Rough estimate, ensure > 0
    const biomassToAdd = carbonForGrowth / Config.GROWTH_COST_PER_LA;

    // Calculate growth factor based on biomass increase
    const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

    // Increase core parameters
    state.currentLA *= growthFactor;
    state.trunkHeight *= growthFactor; // Example: grow taller proportionally

    // Recalculate derived dimensions
    calculateDimensions(state);

    // Update effective LA based on damage
    state.effectiveLA = state.currentLA * (1 - state.damagedLAPercentage);

    // Update meshes
    const trunkMesh = state.treeMeshGroup.getObjectByName("trunk");
    const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");

    // Important: Dispose old geometry before assigning new one!
    if (trunkMesh) {
        trunkMesh.geometry.dispose();
        trunkMesh.geometry = new THREE.BoxGeometry(state.trunkWidth, state.trunkHeight, state.trunkDepth);
        trunkMesh.position.y = state.trunkHeight / 2 + Config.ISLAND_LEVEL; // Reposition based on new height
    }
    if (canopyMesh) {
        canopyMesh.geometry.dispose();
        const canopyThickness = 0.1;
        canopyMesh.geometry = new THREE.BoxGeometry(state.canopyWidth, canopyThickness, state.canopyDepth);
        canopyMesh.position.y = state.trunkHeight + canopyThickness / 2 + Config.ISLAND_LEVEL; // Reposition based on new height
    }
    // console.log("Tree grew:", state.currentLA.toFixed(2), state.trunkHeight.toFixed(2));
}

// Updates the canopy color based on damage percentage and base leaf color
export function updateCanopyVisuals(state) {
    if (!canopyMaterial || !state.treeMeshGroup) return;

    // Make sure canopy mesh exists and is visible before trying to update color
    const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");
    if (!canopyMesh || !canopyMesh.visible) return;

    const baseColor = new THREE.Color(state.leafColor); // Use the player's chosen leaf color
    const brown = new THREE.Color(0x8B4513); // Damage color (SaddleBrown)

    // Interpolate color from base leaf color to brown based on damage
    // Ensure damagedLAPercentage is clamped between 0 and 1
    const damageLerp = Math.max(0, Math.min(1, state.damagedLAPercentage));
    canopyMaterial.color.lerpColors(baseColor, brown, damageLerp);
}

// Updates tree colors based on state, specifically handling canopy tinting
export function updateTreeColors(state) {
    if (trunkMaterial) {
        trunkMaterial.color.set(state.trunkColor);
    }
    // For canopy, call updateCanopyVisuals which handles the base color + damage tint
    updateCanopyVisuals(state);
}

// Helper function to dispose of materials
export function disposeTreeMaterials() {
    if (trunkMaterial) {
        trunkMaterial.dispose();
        trunkMaterial = null;
    }
    if (canopyMaterial) {
        canopyMaterial.dispose();
        canopyMaterial = null;
    }
}

// Sets the visibility of the canopy mesh
export function setCanopyVisibility(state, isVisible) {
     if (state.treeMeshGroup) {
        const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");
        if (canopyMesh) {
            canopyMesh.visible = isVisible;
        }
    }
}