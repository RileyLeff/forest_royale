import * as THREE from 'three';
import * as Config from './config.js';
import { scene } from './sceneSetup.js';
// ++ Import gameState directly ++
import { gameState } from './gameState.js';

let trunkMaterial = null;
let canopyMaterial = null;

// Calculates derived dimensions based on LA and height in gameState
// Pass state or read directly? Reading directly simplifies calls.
export function calculateDimensions(/* state */) {
    const state = gameState; // Use imported gameState
    const safeLA = Math.max(0.0001, state.currentLA);
    state.canopyWidth = Math.sqrt(safeLA);
    state.canopyDepth = state.canopyWidth;
    const trunkArea = safeLA * Config.k_TA_LA_RATIO;
    state.trunkWidth = Math.sqrt(trunkArea);
    state.trunkDepth = state.trunkWidth;
}

// Creates or recreates the player's tree mesh group
export function createPlayerTree(/* state */) { // Reads directly from gameState module
    const state = gameState; // Use imported gameState
    if (state.treeMeshGroup) {
        if (scene) scene.remove(state.treeMeshGroup);
        disposeTreeMaterials();
        state.treeMeshGroup = null;
    }
    // Calculate dimensions if needed (e.g., after state init)
    // Note: This will be replaced/augmented later when we add updateTreeGeometry
    if ((state.trunkWidth <= 0 || state.canopyWidth <= 0) && state.currentLA > 0) {
         calculateDimensions(); // Uses imported gameState
    }

    // Read colors directly from gameState
    trunkMaterial = new THREE.MeshStandardMaterial({ color: state.trunkColor });
    canopyMaterial = new THREE.MeshStandardMaterial({ color: state.leafColor });

    // Create geometries using gameState dimensions
    // Note: Geometry creation will be centralized in updateTreeGeometry later
    const trunkGeometry = new THREE.BoxGeometry(state.trunkWidth || 0.1, state.trunkHeight || 0.1, state.trunkDepth || 0.1);
    const canopyThickness = 0.1;
    const canopyGeometry = new THREE.BoxGeometry(state.canopyWidth || 0.1, canopyThickness, state.canopyDepth || 0.1);
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

    state.treeMeshGroup = new THREE.Group();
    state.treeMeshGroup.add(trunkMesh);
    state.treeMeshGroup.add(canopyMesh);
    state.treeMeshGroup.position.set(0, 0, 0);
    if (scene) scene.add(state.treeMeshGroup);
    else console.error("Scene not available in createPlayerTree");

    // updateCanopyVisuals(); // This will be replaced by updateCanopyMaterial/updateTreeGeometry later
    // Initial update will happen later when geometry/material functions are added

    console.log("Player tree created/recreated using saved colors.");
}

// Applies growth based on carbon investment
// Pass state explicitly OR read from module? Reading is simpler here.
export function growTree(carbonForGrowth) {
    const state = gameState; // Use imported gameState
    if (!state.treeMeshGroup || carbonForGrowth <= 0) return;

    const currentTrunkVolume = state.trunkWidth * state.trunkDepth * state.trunkHeight;
    const currentBiomassEstimate = Math.max(1, state.currentLA + currentTrunkVolume);
    const biomassToAdd = carbonForGrowth / Config.GROWTH_COST_PER_LA;
    const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

    state.currentLA *= growthFactor;
    state.trunkHeight *= growthFactor;

    // ++ NEW: Recalculate max hydraulic buffer based on new size ++
    state.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * state.currentLA;
    // ++ END NEW ++

    // Note: These calls will be replaced/modified when updateTreeGeometry is added
    calculateDimensions(); // Uses imported gameState
    state.effectiveLA = state.currentLA * (1 - state.damagedLAPercentage);

    const trunkMesh = state.treeMeshGroup.getObjectByName("trunk");
    const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");
    if (trunkMesh) {
        trunkMesh.geometry.dispose();
        trunkMesh.geometry = new THREE.BoxGeometry(state.trunkWidth, state.trunkHeight, state.trunkDepth);
        trunkMesh.position.y = state.trunkHeight / 2 + Config.ISLAND_LEVEL;
    }
    if (canopyMesh) {
        canopyMesh.geometry.dispose();
        const canopyThickness = 0.1;
        canopyMesh.geometry = new THREE.BoxGeometry(state.canopyWidth, canopyThickness, state.canopyDepth);
        canopyMesh.position.y = state.trunkHeight + canopyThickness / 2 + Config.ISLAND_LEVEL;
    }
}

// Updates the canopy color based on damage percentage and base leaf color
// Note: This will be renamed to updateCanopyMaterial later
export function updateCanopyVisuals(/* state */) { // Reads directly from gameState
    const state = gameState; // Use imported gameState
    if (!canopyMaterial || !state.treeMeshGroup) return;
    const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");
    if (!canopyMesh || !canopyMesh.visible) return; // Will change later
    const baseColor = new THREE.Color(state.leafColor);
    const brown = new THREE.Color(0x8B4513);
    const damageLerp = Math.max(0, Math.min(1, state.damagedLAPercentage));
    canopyMaterial.color.lerpColors(baseColor, brown, damageLerp);
}

// Helper function to dispose of materials
export function disposeTreeMaterials() {
    if (trunkMaterial) { trunkMaterial.dispose(); trunkMaterial = null; }
    if (canopyMaterial) { canopyMaterial.dispose(); canopyMaterial = null; }
}

// Sets the visibility of the canopy mesh
// Pass state OR read from module? Reading avoids passing it everywhere.
export function setCanopyVisibility(isVisible) {
    const state = gameState; // Use imported gameState
     if (state.treeMeshGroup) {
        const canopyMesh = state.treeMeshGroup.getObjectByName("canopy");
        if (canopyMesh) {
            canopyMesh.visible = isVisible;
        }
    }
}

// Note: Further changes (updateTreeGeometry, updateCanopyMaterial) will be added later.