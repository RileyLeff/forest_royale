// client/tree.js
import * as THREE from 'three';
import * as Config from './config.js';
import { scene } from './sceneSetup.js';
import { gameState } from './gameState.js';

// --- Shared Materials ---
// These might need to become non-shared if we implement player colors
let sharedTrunkMaterial = null;
let sharedCanopyMaterial = null;
function ensureSharedMaterials() {
    const leafColor = Config.DEFAULT_LEAF_COLOR; const trunkColor = Config.DEFAULT_TRUNK_COLOR;
    if (!sharedTrunkMaterial) sharedTrunkMaterial = new THREE.MeshStandardMaterial({ color: trunkColor, name: 'sharedTrunkMaterial' });
    // else sharedTrunkMaterial.color.set(trunkColor); // Don't reset if maybe customized later
    if (!sharedCanopyMaterial) sharedCanopyMaterial = new THREE.MeshStandardMaterial({ color: leafColor, name: 'sharedCanopyMaterial' });
    // else sharedCanopyMaterial.color.set(leafColor);
}

// --- Helper Functions ---
function shuffleArray(array) { /* Fisher-Yates */ for (let i=array.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [array[i],array[j]]=[array[j],array[i]]; } }

function calculateDimensions(playerData) {
    // Use currentLA if available and positive, otherwise fallback gracefully for calculations
    const currentLA = (playerData.currentLA > 0) ? playerData.currentLA : 0.0001; // Avoid zero/negative LA for calcs
    const effectiveLA = (playerData.effectiveLA > 0) ? playerData.effectiveLA : 0; // Used for damage viz?
    const trunkHeight = (playerData.trunkHeight > 0) ? playerData.trunkHeight : Config.INITIAL_TRUNK_HEIGHT;

    const canopyWidth = Math.sqrt(currentLA); // Base width on currentLA
    const trunkArea = currentLA * Config.k_TA_LA_RATIO;
    const trunkWidth = Math.sqrt(trunkArea);

    return {
        canopyWidth: canopyWidth,
        canopyDepth: canopyWidth, // Assuming square canopy
        trunkWidth: Math.max(0.1, trunkWidth), // Ensure minimum trunk dimension
        trunkDepth: Math.max(0.1, trunkWidth), // Ensure minimum trunk dimension
        trunkHeight: trunkHeight
    };
}

// --- Tree Creation/Update ---
export function createOrUpdateTree(playerId, playerData) {

    // +++ CRITICAL CHECK: Do not create/update trees for spectators/admins +++
    if (playerData.isSpectator) {
        // If a tree somehow exists for this spectator, remove it
        if (gameState.playerTrees.has(playerId)) {
            // console.log(`TREE: Removing existing tree for spectator ${playerId}`);
            removeTree(playerId);
        }
        return; // Stop processing for spectators
    }

    // If not a spectator, ensure materials exist
    ensureSharedMaterials();

    let treeMeshGroup = gameState.playerTrees.get(playerId);
    const dimensions = calculateDimensions(playerData);
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;

    // Determine target position using spawnPoint from server data
    // Fallback to 0,0 if spawnPoint is missing (shouldn't happen for non-spectators post-startGame)
    const targetPosition = new THREE.Vector3(
        playerData.spawnPoint?.x ?? 0,
        baseHeight,
        playerData.spawnPoint?.z ?? 0
    );

    if (!treeMeshGroup) {
        // --- Create New Tree (Only if NOT spectator) ---
        // console.log(`TREE: Creating new tree for player ${playerId}`);
        treeMeshGroup = new THREE.Group(); treeMeshGroup.name = `playerTree_${playerId}`;

        // Create Trunk
        const trunkGeometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth);
        const trunkMesh = new THREE.Mesh(trunkGeometry, sharedTrunkMaterial.clone()); // Clone for potential color change later
        trunkMesh.name = "trunk"; trunkMesh.position.y = (dimensions.trunkHeight / 2);
        trunkMesh.castShadow = true; trunkMesh.receiveShadow = true; treeMeshGroup.add(trunkMesh);

        // Create Canopy Group
        const canopyGroup = new THREE.Group(); canopyGroup.name = "canopyGroup"; const tiles = [];
        const gridSize = Config.CANOPY_TILE_GRID_SIZE; const totalTiles = gridSize * gridSize;
        // Use current dimensions for tile size calculation, not just initial
        const tileWidth = dimensions.canopyWidth / gridSize;
        const tileDepth = dimensions.canopyDepth / gridSize;
        const tileThickness = Config.CANOPY_TILE_THICKNESS;
        const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);
        for (let i = 0; i < gridSize; i++) { for (let j = 0; j < gridSize; j++) {
            const tileMesh = new THREE.Mesh(tileGeometry, sharedCanopyMaterial.clone()); // Clone for potential color change
            const xPos = (i-(gridSize-1)/2)*tileWidth; const zPos = (j-(gridSize-1)/2)*tileDepth;
            tileMesh.position.set(xPos, 0, zPos); tileMesh.castShadow=true; tileMesh.receiveShadow=true;
            tileMesh.name = `canopyTile_${i}_${j}`; canopyGroup.add(tileMesh); tiles.push(tileMesh); } }
        shuffleArray(tiles); canopyGroup.userData.tiles = tiles;
        // Store the width used to create these tiles for scaling calculations
        canopyGroup.userData.creationWidth = dimensions.canopyWidth;
        treeMeshGroup.add(canopyGroup);

        // Set initial position
        treeMeshGroup.position.copy(targetPosition);

        // Add to scene and map
        if (scene) scene.add(treeMeshGroup); else console.error("Scene not found for tree");
        gameState.playerTrees.set(playerId, treeMeshGroup);

        // Apply initial geometry/tiles update (redundant? updateTreeGeometry called below)
        // updateTreeGeometry(treeMeshGroup, playerData, dimensions);
        // updateCanopyTiles(treeMeshGroup, playerData); // updateCanopyTiles called below

    }

    // --- Update Existing Tree --- (Applies to newly created too)
    // Update position if necessary (e.g., if spawn point changed somehow, though unlikely)
    if (!treeMeshGroup.position.equals(targetPosition)) {
        treeMeshGroup.position.copy(targetPosition);
    }
    updateTreeGeometry(treeMeshGroup, playerData, dimensions);
    updateCanopyTiles(treeMeshGroup, playerData); // Handles damage and color

    // Set visibility based on server 'isAlive' state AND ensure not spectator
    // (Spectator check technically redundant due to initial return, but safe)
    treeMeshGroup.visible = playerData.isAlive && !playerData.isSpectator;
}

// --- Update Helpers ---
function updateTreeGeometry(treeMeshGroup, playerData, dimensions) {
    if (!treeMeshGroup) return;
    const trunkMesh = treeMeshGroup.getObjectByName("trunk");
    const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");

    // Update Trunk Geometry
    if (trunkMesh && trunkMesh.geometry) {
        const params = trunkMesh.geometry.parameters;
        // Check if dimensions changed significantly before creating new geometry
        if (Math.abs(params.width - dimensions.trunkWidth) > 0.01 ||
            Math.abs(params.height - dimensions.trunkHeight) > 0.01 ||
            Math.abs(params.depth - dimensions.trunkDepth) > 0.01)
        {
            trunkMesh.geometry.dispose();
            trunkMesh.geometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth);
        }
        // Always update position Y based on current height
        trunkMesh.position.y = dimensions.trunkHeight / 2;
    }

    // Update Canopy Position & Scale
    if (canopyGroup) {
        const tileThickness = Config.CANOPY_TILE_THICKNESS;
        canopyGroup.position.y = dimensions.trunkHeight + (tileThickness / 2); // Position above trunk

        // Scale the canopy based on current width relative to the width when tiles were created
        const creationWidth = canopyGroup.userData.creationWidth || dimensions.canopyWidth; // Fallback needed?
        const currentWidth = dimensions.canopyWidth;
        const scaleFactor = (creationWidth > 0.01) ? (currentWidth / creationWidth) : 0.01; // Avoid divide by zero

        if (Math.abs(canopyGroup.scale.x - scaleFactor) > 0.001) {
            canopyGroup.scale.set(scaleFactor, 1, scaleFactor); // Scale X and Z
        }
    }
}


function updateCanopyTiles(treeMeshGroup, playerData) {
    if (!treeMeshGroup) return;
    const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");
    if (!canopyGroup || !canopyGroup.userData.tiles) return;

    const tiles = canopyGroup.userData.tiles;
    const totalTiles = tiles.length;
    if (totalTiles === 0) return;

    // Update Tile Visibility (Damage)
    const damagePercent = playerData.damagedLAPercentage || 0;
    const hiddenTilesCount = Math.floor(totalTiles * damagePercent);
    for (let i = 0; i < totalTiles; i++) {
        tiles[i].visible = (i >= hiddenTilesCount);
    }

    // --- TODO: Update Tile Color ---
    // This requires the customization fix (Phase 2, Item 5)
    // For now, they use the cloned shared material.
    // Example (when customization data is available):
    const leafColor = playerData.leafColor || Config.DEFAULT_LEAF_COLOR;
    tiles.forEach(tile => {
        if (tile.material && tile.material.color) { // Check material exists
             // Only update color if it differs significantly
             if (!tile.material.color.equals(new THREE.Color(leafColor))) {
                 tile.material.color.set(leafColor);
             }
        } else {
             // Safety: Ensure material exists if somehow missing
             tile.material = sharedCanopyMaterial.clone();
             tile.material.color.set(leafColor);
        }
    });

    // --- TODO: Update Trunk Color ---
    const trunkMesh = treeMeshGroup.getObjectByName("trunk");
    const trunkColor = playerData.trunkColor || Config.DEFAULT_TRUNK_COLOR;
    if (trunkMesh && trunkMesh.material && trunkMesh.material.color) {
         if (!trunkMesh.material.color.equals(new THREE.Color(trunkColor))) {
            trunkMesh.material.color.set(trunkColor);
         }
    } else if (trunkMesh) {
        trunkMesh.material = sharedTrunkMaterial.clone();
        trunkMesh.material.color.set(trunkColor);
    }

}


// --- Removal & Disposal ---
export function removeTree(playerId) {
    const treeMeshGroup = gameState.playerTrees.get(playerId);
    if (treeMeshGroup) {
        // console.log(`TREE: Removing tree for player ${playerId}`); // Reduce noise
        disposeTreeGroup(treeMeshGroup);
        if (scene && treeMeshGroup.parent) scene.remove(treeMeshGroup);
        gameState.playerTrees.delete(playerId);
    }
}

function disposeTreeGroup(group) {
    if (!group) return;
    group.traverse((obj) => {
        if (obj.isMesh) {
            if (obj.geometry) obj.geometry.dispose();
            // Dispose of potentially cloned materials
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(material => material.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        }
    });
}


export function disposeAllTrees() {
    gameState.playerTrees.forEach(treeGroup => { disposeTreeGroup(treeGroup); if(scene && treeGroup.parent) scene.remove(treeGroup); });
    gameState.playerTrees.clear();
    disposeSharedTreeMaterials(); // Dispose shared materials if appropriate
    console.log("Disposed all player trees and shared materials.");
}

// Only dispose shared materials if they exist - maybe on full client shutdown/reset?
export function disposeSharedTreeMaterials() {
    if (sharedTrunkMaterial) { sharedTrunkMaterial.dispose(); sharedTrunkMaterial = null; }
    if (sharedCanopyMaterial) { sharedCanopyMaterial.dispose(); sharedCanopyMaterial = null; }
}