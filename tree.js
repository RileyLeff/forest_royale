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
// Canopy dimensions now represent the *potential* total area
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
        // Dispose geometries and materials associated with the old group
        disposeTreeGroup(state.treeMeshGroup); // New helper function for this
        if (scene) scene.remove(state.treeMeshGroup);
        state.treeMeshGroup = null;
    }
    // Ensure module materials are reset if they existed
    disposeTreeMaterials(); // Disposes module-level material vars

    // --- Initialize Materials ---
    // Use colors directly from gameState (loaded during init)
    trunkMaterial = new THREE.MeshStandardMaterial({ color: state.trunkColor });
    canopyMaterial = new THREE.MeshStandardMaterial({ color: state.leafColor });

    // --- Calculate Initial Dimensions ---
    // Ensures trunk/canopy width/depth are calculated based on initial LA
    calculateDimensions();

    // --- Create Trunk ---
    const trunkGeometry = new THREE.BoxGeometry(state.trunkWidth || 0.1, state.trunkHeight || 0.1, state.trunkDepth || 0.1);
    const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunkMesh.name = "trunk";
    trunkMesh.position.y = (state.trunkHeight / 2) + Config.ISLAND_LEVEL;
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;

    // --- Create Tiled Canopy ---
    const canopyGroup = new THREE.Group();
    canopyGroup.name = "canopyGroup"; // Reference the group
    const tiles = []; // Array to hold references to tile meshes
    const gridSize = Config.CANOPY_TILE_GRID_SIZE;
    const totalTiles = gridSize * gridSize;
    const tileWidth = (state.canopyWidth || 0.1) / gridSize;
    const tileDepth = (state.canopyDepth || 0.1) / gridSize;
    const tileThickness = Config.CANOPY_TILE_THICKNESS;

    // Create tile geometry once, reuse for all tiles
    const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const tileMesh = new THREE.Mesh(tileGeometry, canopyMaterial); // Use shared material
            // Calculate position relative to the center of the canopy grid
            const xPos = (i - (gridSize - 1) / 2) * tileWidth;
            const zPos = (j - (gridSize - 1) / 2) * tileDepth;
            tileMesh.position.set(xPos, 0, zPos); // Y position relative to group origin
            tileMesh.castShadow = true;
            tileMesh.receiveShadow = true; // Tiles can receive shadows from trunk/other things
            tileMesh.name = `canopyTile_${i}_${j}`; // Optional naming

            canopyGroup.add(tileMesh);
            tiles.push(tileMesh); // Store reference
        }
    }

    // Shuffle the tile array once for more random-looking damage patterns
    shuffleArray(tiles);
    canopyGroup.userData.tiles = tiles; // Attach the shuffled array to the group

    // Position the whole canopy group above the trunk
    canopyGroup.position.y = state.trunkHeight + (tileThickness / 2) + Config.ISLAND_LEVEL;

    // --- Create Main Tree Group ---
    state.treeMeshGroup = new THREE.Group();
    state.treeMeshGroup.add(trunkMesh);
    state.treeMeshGroup.add(canopyGroup);
    state.treeMeshGroup.position.set(0, 0, 0); // Position tree at origin

    if (scene) {
        scene.add(state.treeMeshGroup);
    } else {
        console.error("Scene not available in createPlayerTree");
    }

    // --- Initial Visual Update ---
    // Apply initial damage state (if any, e.g., on restart with previous damage)
    updateCanopyTiles(); // Update tile visibility/color
    // Geometry is set initially, updateTreeGeometry mainly for growth/trunk changes

    console.log(`Player tree created/recreated. Tiles: ${totalTiles}, Tile Size: ${tileWidth.toFixed(2)}x${tileDepth.toFixed(2)}`);
}

// Applies growth based on carbon investment - Updates trunk geometry and positions canopy group
export function growTree(carbonForGrowth) {
    const state = gameState;
    if (!state.treeMeshGroup || carbonForGrowth <= 0) return;

    const oldHeight = state.trunkHeight; // Store old height for canopy repositioning

    // --- Calculate Growth ---
    const currentTrunkVolume = (state.trunkWidth || 0.1) * (state.trunkDepth || 0.1) * (state.trunkHeight || 0.1); // Use dimensions or fallback
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
    updateTreeGeometry(); // Resize trunk, reposition canopy group
    // Canopy tile visibility/color is handled by updateCanopyTiles, called separately if damage changes

     console.log(`growTree: C_in=${carbonForGrowth.toFixed(1)}, Factor=${growthFactor.toFixed(4)}, LA=${state.currentLA.toFixed(2)}, H=${state.trunkHeight.toFixed(2)}`);
}

// Updates the geometry of the trunk and repositions the canopy group
export function updateTreeGeometry() {
    const state = gameState;
    if (!state.treeMeshGroup) return;

    const trunkMesh = state.treeMeshGroup.getObjectByName("trunk");
    const canopyGroup = state.treeMeshGroup.getObjectByName("canopyGroup");

    // Update Trunk Geometry & Position
    if (trunkMesh && trunkMesh.geometry) {
        trunkMesh.geometry.dispose(); // Dispose old geometry!
        trunkMesh.geometry = new THREE.BoxGeometry(state.trunkWidth, state.trunkHeight, state.trunkDepth);
        trunkMesh.position.y = state.trunkHeight / 2 + Config.ISLAND_LEVEL;
    }

    // Reposition Canopy Group based on new trunk height
    if (canopyGroup) {
        canopyGroup.position.y = state.trunkHeight + (Config.CANOPY_TILE_THICKNESS / 2) + Config.ISLAND_LEVEL;
        // Note: We are NOT resizing individual tiles or the group scale here.
        // Growth increases *potential* LA, reflected in trunk size.
        // The visual canopy area change comes from tile visibility via damage.
    }
     // console.log(`Updated geometry: Trunk(${state.trunkWidth.toFixed(2)}x${state.trunkHeight.toFixed(2)})`);
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
        tiles[i].visible = (i >= hiddenTilesCount); // Tiles at the start of the shuffled list are hidden first
    }

    // Update color tint of the shared material based on damage
    const baseColor = new THREE.Color(state.leafColor);
    const brown = new THREE.Color(0x8B4513); // Saddle Brown
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
        // Since canopyMaterial is shared by tiles, dispose it here
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
                 // console.log(`Disposed geometry for ${object.name || 'unnamed mesh'}`);
            }
            // Materials are disposed separately via disposeTreeMaterials as they might be shared
        }
    });
     console.log("Disposed geometries in tree group.");
}