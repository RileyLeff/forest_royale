// tree.js
import * as THREE from 'three';
import * as Config from './config.js'; // Still need some constants like ratios
import { scene } from './sceneSetup.js';
import { gameState } from './gameState.js'; // Need access to the playerTrees map

// Module-level variables for materials (shared) - Now need arrays or Maps if colors differ per player
// Let's simplify for now: Assume all trees use the same initial material colors,
// but we'll need to handle custom colors later, likely by creating materials per tree.
let sharedTrunkMaterial = null;
let sharedCanopyMaterial = null;

function ensureSharedMaterials() {
    // Use default colors for now, customize later
    const leafColor = Config.DEFAULT_LEAF_COLOR;
    const trunkColor = Config.DEFAULT_TRUNK_COLOR;

    if (!sharedTrunkMaterial) {
        sharedTrunkMaterial = new THREE.MeshStandardMaterial({ color: trunkColor });
    } else {
        sharedTrunkMaterial.color.set(trunkColor); // Ensure color is up-to-date if default changes?
    }
    if (!sharedCanopyMaterial) {
        sharedCanopyMaterial = new THREE.MeshStandardMaterial({ color: leafColor });
    } else {
        sharedCanopyMaterial.color.set(leafColor);
    }
}

// Helper function to shuffle an array (Fisher-Yates algorithm) - Keep for canopy tiles
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
}

// Calculates derived dimensions based on SERVER data for a SPECIFIC player
// Returns an object, doesn't modify global state
function calculateDimensions(playerData) {
    const potentialLA = Math.max(0.0001, playerData.currentLA);
    const canopyWidth = Math.sqrt(potentialLA);
    const trunkArea = potentialLA * Config.k_TA_LA_RATIO;
    const trunkWidth = Math.sqrt(trunkArea);

    return {
        canopyWidth: canopyWidth,
        canopyDepth: canopyWidth, // Assuming square canopy base
        trunkWidth: trunkWidth,
        trunkDepth: trunkWidth, // Assuming square trunk base
        trunkHeight: playerData.trunkHeight, // Use height directly from server data
    };
}

/**
 * Creates a new tree mesh group for a player or updates an existing one.
 * @param {string} playerId - The ID of the player.
 * @param {object} playerData - The state data for this player from the server.
 */
export function createOrUpdateTree(playerId, playerData) {
    ensureSharedMaterials(); // Make sure materials exist

    let treeMeshGroup = gameState.playerTrees.get(playerId);
    const dimensions = calculateDimensions(playerData); // Calculate target dimensions

    if (!treeMeshGroup) {
        // --- Create New Tree ---
        console.log(`TREE: Creating new tree for player ${playerId}`);
        treeMeshGroup = new THREE.Group();
        treeMeshGroup.name = `playerTree_${playerId}`;

        // --- Create Trunk ---
        // Use calculated dimensions, provide small fallback for safety
        const trunkGeometry = new THREE.BoxGeometry(dimensions.trunkWidth || 0.1, dimensions.trunkHeight || 0.1, dimensions.trunkDepth || 0.1);
        const trunkMesh = new THREE.Mesh(trunkGeometry, sharedTrunkMaterial); // Use shared material for now
        trunkMesh.name = "trunk";
        trunkMesh.position.y = (dimensions.trunkHeight / 2); // Position relative to group base
        trunkMesh.castShadow = true;
        trunkMesh.receiveShadow = true;
        treeMeshGroup.add(trunkMesh);

        // --- Create Tiled Canopy ---
        const canopyGroup = new THREE.Group();
        canopyGroup.name = "canopyGroup";
        const tiles = [];
        const gridSize = Config.CANOPY_TILE_GRID_SIZE; // Use constant for grid density
        const totalTiles = gridSize * gridSize;
        // Calculate tile size based on *initial* canopy dimensions (when LA was INITIAL_LEAF_AREA)
        // We need a consistent base size for tiles before scaling the group
        const initialDimensionsForTileSize = calculateDimensions({ currentLA: Config.INITIAL_LEAF_AREA, trunkHeight: Config.INITIAL_TRUNK_HEIGHT });
        const tileWidth = initialDimensionsForTileSize.canopyWidth / gridSize;
        const tileDepth = initialDimensionsForTileSize.canopyDepth / gridSize;
        const tileThickness = Config.CANOPY_TILE_THICKNESS;

        const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                // Use shared canopy material for now
                const tileMesh = new THREE.Mesh(tileGeometry, sharedCanopyMaterial);
                const xPos = (i - (gridSize - 1) / 2) * tileWidth;
                const zPos = (j - (gridSize - 1) / 2) * tileDepth;
                tileMesh.position.set(xPos, 0, zPos); // Position relative to canopyGroup center
                tileMesh.castShadow = true;
                tileMesh.receiveShadow = true;
                tileMesh.name = `canopyTile_${i}_${j}`;
                canopyGroup.add(tileMesh);
                tiles.push(tileMesh);
            }
        }

        shuffleArray(tiles); // Shuffle for random dieback pattern
        canopyGroup.userData.tiles = tiles;
        // Store the width used for tile creation to calculate scale factor later
        canopyGroup.userData.initialWidth = initialDimensionsForTileSize.canopyWidth;
        treeMeshGroup.add(canopyGroup);

        // Add to scene and map
        // Position the entire group at the player's spawn point (or current position from server later)
        // For now, use a temporary position - this needs spawnPoint data!
        const spawnPos = playerData.spawnPoint || { x: Math.random() * 20 - 10, y: Config.ISLAND_LEVEL, z: Math.random() * 20 - 10 }; // Use server spawnPoint when available
        treeMeshGroup.position.set(spawnPos.x, spawnPos.y, spawnPos.z); // Set base position

        if (scene) {
            scene.add(treeMeshGroup);
        } else {
            console.error("Scene not available in createOrUpdateTree");
        }
        gameState.playerTrees.set(playerId, treeMeshGroup);

        // Apply initial geometry/tiles update after creation
        updateTreeGeometry(treeMeshGroup, playerData, dimensions);
        updateCanopyTiles(treeMeshGroup, playerData); // Pass player data for damage %

    } else {
        // --- Update Existing Tree ---
        // console.log(`TREE: Updating tree for player ${playerId}`); // Reduce log spam
        updateTreeGeometry(treeMeshGroup, playerData, dimensions);
        updateCanopyTiles(treeMeshGroup, playerData);
    }

     // Set visibility based on server 'isAlive' state
     treeMeshGroup.visible = playerData.isAlive;
}


// Updates the geometry of the trunk and repositions/scales the canopy group for a specific tree
function updateTreeGeometry(treeMeshGroup, playerData, dimensions) {
    if (!treeMeshGroup) return;

    const trunkMesh = treeMeshGroup.getObjectByName("trunk");
    const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");

    // Update Trunk Geometry & Position (relative to group base)
    if (trunkMesh && trunkMesh.geometry) {
        // Check if dimensions actually changed to avoid unnecessary geometry creation
        const currentGeomParams = trunkMesh.geometry.parameters;
        if (Math.abs(currentGeomParams.width - dimensions.trunkWidth) > 0.01 ||
            Math.abs(currentGeomParams.height - dimensions.trunkHeight) > 0.01 ||
            Math.abs(currentGeomParams.depth - dimensions.trunkDepth) > 0.01)
        {
            trunkMesh.geometry.dispose();
            trunkMesh.geometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth);
            trunkMesh.position.y = dimensions.trunkHeight / 2; // Center vertically relative to base
        } else {
             // Only update position if height changed slightly but geometry didn't refresh
             trunkMesh.position.y = dimensions.trunkHeight / 2;
        }
    }

    // Reposition and Scale Canopy Group
    if (canopyGroup) {
        // Reposition based on new trunk height (relative to group base)
        const tileThickness = Config.CANOPY_TILE_THICKNESS; // Use constant
        canopyGroup.position.y = dimensions.trunkHeight + (tileThickness / 2);

        // Calculate and apply scale relative to the initial tile geometry size
        const initialWidth = canopyGroup.userData.initialWidth || 1; // Get width used at creation
        const currentWidth = dimensions.canopyWidth;
        const scaleFactor = currentWidth > 0.01 ? currentWidth / initialWidth : 0.01; // Avoid zero/negative scale

        // Check if scale changed significantly
        if (Math.abs(canopyGroup.scale.x - scaleFactor) > 0.001) {
             canopyGroup.scale.set(scaleFactor, 1, scaleFactor); // Uniform XZ scale
        }
    }
}


// Updates canopy tile visibility and color based on damage percentage for a specific tree
function updateCanopyTiles(treeMeshGroup, playerData) {
    if (!treeMeshGroup || !sharedCanopyMaterial) return; // Check shared material

    const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");
    if (!canopyGroup || !canopyGroup.userData.tiles) return;

    const tiles = canopyGroup.userData.tiles;
    const totalTiles = tiles.length;
    if (totalTiles === 0) return;

    const damagePercent = playerData.damagedLAPercentage || 0;
    const hiddenTilesCount = Math.floor(totalTiles * damagePercent);

    // Update tile visibility
    let visibilityChanged = false;
    for (let i = 0; i < totalTiles; i++) {
        const shouldBeVisible = (i >= hiddenTilesCount);
        if (tiles[i].visible !== shouldBeVisible) {
             tiles[i].visible = shouldBeVisible;
             visibilityChanged = true;
        }
    }
    // if(visibilityChanged) console.log(`Updated canopy tiles for ${playerData.id}: Hidden=${hiddenTilesCount}/${totalTiles}`);

    // Update color tint of the shared material based on damage
    // !!! PROBLEM: This tints ALL trees using the shared material !!!
    // TODO: Implement per-tree material cloning or shader uniforms for individual color tinting.
    // For now, we'll skip the tinting to avoid affecting all trees.
    const baseColor = new THREE.Color(Config.DEFAULT_LEAF_COLOR); // Use default for now
    // const brown = new THREE.Color(0x8B4513);
    // const damageLerp = Math.max(0, Math.min(1, damagePercent));
    // sharedCanopyMaterial.color.lerpColors(baseColor, brown, damageLerp); // <-- Incorrect for shared material
    sharedCanopyMaterial.color.set(baseColor); // Just set to base color for now

    // To handle individual colors/tints later:
    // 1. When creating a tree, clone the shared material: tileMesh.material = sharedCanopyMaterial.clone();
    // 2. Store this cloned material reference (e.g., canopyGroup.userData.material = tileMesh.material)
    // 3. In this function, get the specific material from userData and tint it.
    // 4. Need proper disposal when tree is removed.
}

// Removes the tree mesh from the scene and the map
export function removeTree(playerId) {
    const treeMeshGroup = gameState.playerTrees.get(playerId);
    if (treeMeshGroup) {
        console.log(`TREE: Removing tree for player ${playerId}`);
        disposeTreeGroup(treeMeshGroup); // Dispose geometry first
        if (scene) {
            scene.remove(treeMeshGroup);
        }
        gameState.playerTrees.delete(playerId);
    }
}

// Sets the visibility of a specific player's tree canopy group (e.g., for game over)
// Note: createOrUpdateTree now sets visibility based on isAlive, so this might be less needed.
export function setCanopyVisibility(playerId, isVisible) {
    const treeMeshGroup = gameState.playerTrees.get(playerId);
     if (treeMeshGroup) {
        const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");
        if (canopyGroup) {
            canopyGroup.visible = isVisible;
             // console.log(`Set canopy group visibility for ${playerId} to: ${isVisible}`);
        }
    }
}

// Helper function to dispose of materials (only shared ones for now)
export function disposeSharedTreeMaterials() {
    if (sharedTrunkMaterial) {
        sharedTrunkMaterial.dispose();
        sharedTrunkMaterial = null;
    }
    if (sharedCanopyMaterial) {
        sharedCanopyMaterial.dispose();
        sharedCanopyMaterial = null;
    }
}

// Helper function to dispose geometries AND materials within a specific tree group
function disposeTreeGroup(group) {
    if (!group) return;
    group.traverse((object) => {
        if (object.isMesh) {
            if (object.geometry) {
                object.geometry.dispose();
            }
            // If we implement per-tree materials later, dispose them here:
            // if (object.material) {
            //     if (Array.isArray(object.material)) {
            //         object.material.forEach(mat => mat.dispose());
            //     } else {
            //         object.material.dispose();
            //     }
            // }
        }
    });
     // console.log(`Disposed geometries in tree group ${group.name}.`);
}

// Dispose all tracked tree groups and shared materials (e.g., on full restart/cleanup)
export function disposeAllTrees() {
    gameState.playerTrees.forEach(treeGroup => {
         disposeTreeGroup(treeGroup);
         if(scene) scene.remove(treeGroup);
    });
    gameState.playerTrees.clear();
    disposeSharedTreeMaterials();
    console.log("Disposed all player trees and shared materials.");
}