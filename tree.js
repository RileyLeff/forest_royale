import * as THREE from 'three';
import * as Config from './config.js';
import { scene } from './sceneSetup.js';
import { gameState } from './gameState.js';

// Module-level variables for materials (shared)
let trunkMaterial = null;
let canopyMaterial = null; // Shared material for all canopy tiles

// Helper function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

// Calculates derived dimensions based on LA and height in gameState
export function calculateDimensions() {
    const state = gameState;
    const potentialLA = Math.max(0.0001, state.currentLA); // Use currentLA for potential size

    // Potential Canopy dimensions (overall area the tiles represent)
    state.canopyWidth = Math.sqrt(potentialLA);
    state.canopyDepth = state.canopyWidth;

    // Trunk dimensions remain based on potential LA for structure
    const trunkArea = potentialLA * Config.k_TA_LA_RATIO;
    state.trunkWidth = Math.sqrt(trunkArea);
    state.trunkDepth = state.trunkWidth;
}

// Creates or recreates the player's tree mesh group with a tiled canopy
export function createPlayerTree() {
    const state = gameState;
    // --- Cleanup existing tree if any ---
    if (state.treeMeshGroup) {
        disposeTreeGroup(state.treeMeshGroup);
        if (scene) scene.remove(state.treeMeshGroup);
        state.treeMeshGroup = null;
    }
    disposeTreeMaterials(); // Dispose module-level materials

    // --- Initialize Materials ---
    trunkMaterial = new THREE.MeshStandardMaterial({ color: state.trunkColor });
    canopyMaterial = new THREE.MeshStandardMaterial({ color: state.leafColor });

    // --- Calculate Initial Dimensions ---
    calculateDimensions();
    const initialCanopyWidth = state.canopyWidth || 0.1; // Store initial width

    // --- Create Trunk ---
    const trunkGeometry = new THREE.BoxGeometry(state.trunkWidth || 0.1, state.trunkHeight || 0.1, state.trunkDepth || 0.1);
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = "trunk";
    trunkMesh.position.y = (state.trunkHeight / 2) + Config.ISLAND_LEVEL;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    // --- Create Tiled Canopy ---
    const canopyGroup = new THREE.Group();
    canopyGroup.name = "canopyGroup";
    const tiles = [];
    const gridSize = Config.CANOPY_TILE_GRID_SIZE;
    const totalTiles = gridSize * gridSize;
    // Calculate tile size based on *initial* canopy dimensions
    const tileWidth = initialCanopyWidth / gridSize;
    const tileDepth = (state.canopyDepth || 0.1) / gridSize; // state.canopyDepth == initialCanopyWidth here
    const tileThickness = Config.CANOPY_TILE_THICKNESS;

    const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const tileMesh = new THREE.Mesh(tileGeometry, canopyMaterial);
            const xPos = (i - (gridSize - 1) / 2) * tileWidth;
            const zPos = (j - (gridSize - 1) / 2) * tileDepth;
            tileMesh.position.set(xPos, 0, zPos);
            tileMesh.castShadow = true;
            tileMesh.receiveShadow = true;
            tileMesh.name = `canopyTile_${i}_${j}`;
            canopyGroup.add(tileMesh);
            tiles.push(tileMesh);
        }
    }

    shuffleArray(tiles);
    canopyGroup.userData.tiles = tiles;
    // ++ Store initial width for scaling calculation ++
    canopyGroup.userData.initialWidth = initialCanopyWidth;

    // Position the whole canopy group above the trunk
    canopyGroup.position.y = state.trunkHeight + (tileThickness / 2) + Config.ISLAND_LEVEL;

    // --- Create Main Tree Group ---
    state.treeMeshGroup = new THREE.Group();
    state.treeMeshGroup.add(trunkMesh);
    state.treeMeshGroup.add(canopyGroup);
    state.treeMeshGroup.position.set(0, 0, 0);

    if (scene) {
        scene.add(state.treeMeshGroup);
    } else {
        console.error("Scene not available in createPlayerTree");
    }

    // --- Initial Visual Update ---
    updateCanopyTiles(); // Update tile visibility/color based on potential initial damage
    updateTreeGeometry(); // Apply initial scale to canopy group

    console.log(`Player tree created/recreated. Tiles: ${totalTiles}, Initial Canopy Width: ${initialCanopyWidth.toFixed(2)}`);
}

// Applies growth - updates trunk geometry, positions canopy group, and scales canopy group
export function growTree(carbonForGrowth) {
    const state = gameState;
    if (!state.treeMeshGroup || carbonForGrowth <= 0) return;

    // --- Calculate Growth ---
    const currentTrunkVolume = (state.trunkWidth || 0.1) * (state.trunkDepth || 0.1) * (state.trunkHeight || 0.1);
    const currentBiomassEstimate = Math.max(1, state.currentLA + currentTrunkVolume);
    const biomassToAdd = carbonForGrowth / Config.GROWTH_COST_PER_LA;
    const growthFactor = 1 + (biomassToAdd / currentBiomassEstimate);

    // --- Update State ---
    state.currentLA *= growthFactor;
    state.trunkHeight *= growthFactor;
    state.maxHydraulic = Config.BASE_HYDRAULIC + Config.HYDRAULIC_SCALE_PER_LA * state.currentLA;
    calculateDimensions(); // Update potential canopy size and trunk dimensions
    state.effectiveLA = state.currentLA * (1 - state.damagedLAPercentage);

    // --- Update 3D Model ---
    updateTreeGeometry(); // Resize trunk, reposition AND SCALE canopy group

    console.log(`growTree: C_in=${carbonForGrowth.toFixed(1)}, Factor=${growthFactor.toFixed(4)}, LA=${state.currentLA.toFixed(2)}, H=${state.trunkHeight.toFixed(2)}`);
}

// Updates the geometry of the trunk and repositions/scales the canopy group
export function updateTreeGeometry() {
    const state = gameState;
    if (!state.treeMeshGroup) return;

    const trunkMesh = state.treeMeshGroup.getObjectByName("trunk");
    const canopyGroup = state.treeMeshGroup.getObjectByName("canopyGroup");

    // Update Trunk Geometry & Position
    if (trunkMesh && trunkMesh.geometry) {
        trunkMesh.geometry.dispose();
        trunkMesh.geometry = new THREE.BoxGeometry(state.trunkWidth, state.trunkHeight, state.trunkDepth);
        trunkMesh.position.y = state.trunkHeight / 2 + Config.ISLAND_LEVEL;
    }

    // Reposition and Scale Canopy Group
    if (canopyGroup) {
        // Reposition based on new trunk height
        canopyGroup.position.y = state.trunkHeight + (Config.CANOPY_TILE_THICKNESS / 2) + Config.ISLAND_LEVEL;

        // ++ Calculate and apply scale ++
        const initialWidth = canopyGroup.userData.initialWidth || state.canopyWidth || 1; // Fallback needed?
        const currentWidth = state.canopyWidth || 0.1;
        // Calculate scale factor relative to the initial size when tiles were made
        const scaleFactor = currentWidth / initialWidth;
        // Scale uniformly in X and Z, keep Y scale at 1 (no stretching thickness)
        canopyGroup.scale.set(scaleFactor, 1, scaleFactor);
    }
    // console.log(`Updated geometry: Trunk(${state.trunkWidth.toFixed(2)}x${state.trunkHeight.toFixed(2)}), CanopyScale: ${canopyGroup ? canopyGroup.scale.x.toFixed(2) : 'N/A'}`);
}


// Updates canopy tile visibility and color based on damage percentage
export function updateCanopyTiles() {
    const state = gameState;
    if (!state.treeMeshGroup || !canopyMaterial) return;

    const canopyGroup = state.treeMeshGroup.getObjectByName("canopyGroup");
    if (!canopyGroup || !canopyGroup.userData.tiles) return;

    const tiles = canopyGroup.userData.tiles;
    const totalTiles = tiles.length;
    if (totalTiles === 0) return;

    const damagePercent = state.damagedLAPercentage;
    const hiddenTilesCount = Math.floor(totalTiles * damagePercent);

    // Update tile visibility
    for (let i = 0; i < totalTiles; i++) {
        tiles[i].visible = (i >= hiddenTilesCount);
    }

    // Update color tint of the shared material based on damage
    const baseColor = new THREE.Color(state.leafColor);
    const brown = new THREE.Color(0x8B4513);
    const damageLerp = Math.max(0, Math.min(1, damagePercent));
    canopyMaterial.color.lerpColors(baseColor, brown, damageLerp);

    // console.log(`Updated canopy tiles: Damage=${(damagePercent * 100).toFixed(1)}%, Hidden=${hiddenTilesCount}/${totalTiles}`);
}


// Sets the visibility of the entire canopy group
export function setCanopyVisibility(isVisible) {
    const state = gameState;
     if (state.treeMeshGroup) {
        const canopyGroup = state.treeMeshGroup.getObjectByName("canopyGroup");
        if (canopyGroup) {
            canopyGroup.visible = isVisible;
             console.log(`Set canopy group visibility to: ${isVisible}`);
        }
    }
}

// Helper function to dispose of materials stored at module level
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

// Helper function to dispose geometries within a tree group before removing it
function disposeTreeGroup(group) {
    if (!group) return;
    group.traverse((object) => {
        if (object.isMesh) {
            if (object.geometry) {
                object.geometry.dispose();
            }
        }
    });
     console.log("Disposed geometries in tree group.");
}