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
    const potentialLA = Math.max(0.0001, playerData.currentLA || Config.INITIAL_LEAF_AREA);
    const canopyWidth = Math.sqrt(potentialLA); const trunkArea = potentialLA * Config.k_TA_LA_RATIO;
    const trunkWidth = Math.sqrt(trunkArea); const trunkHeight = playerData.trunkHeight || Config.INITIAL_TRUNK_HEIGHT;
    return { canopyWidth: canopyWidth, canopyDepth: canopyWidth, trunkWidth: trunkWidth, trunkDepth: trunkWidth, trunkHeight: trunkHeight };
}

// --- Tree Creation/Update ---
export function createOrUpdateTree(playerId, playerData) {
    ensureSharedMaterials();
    let treeMeshGroup = gameState.playerTrees.get(playerId);
    const dimensions = calculateDimensions(playerData);
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;

    // Determine target position using spawnPoint from server data
    // Fallback to 0,0 if spawnPoint is missing for some reason
    const targetPosition = new THREE.Vector3(
        playerData.spawnPoint?.x ?? 0,
        baseHeight,
        playerData.spawnPoint?.z ?? 0
    );

    if (!treeMeshGroup) {
        // --- Create New Tree ---
        // console.log(`TREE: Creating new tree for player ${playerId}`);
        treeMeshGroup = new THREE.Group(); treeMeshGroup.name = `playerTree_${playerId}`;

        // Create Trunk
        const trunkGeometry = new THREE.BoxGeometry(dimensions.trunkWidth || 0.1, dimensions.trunkHeight || 0.1, dimensions.trunkDepth || 0.1);
        const trunkMesh = new THREE.Mesh(trunkGeometry, sharedTrunkMaterial); // Use shared material
        trunkMesh.name = "trunk"; trunkMesh.position.y = (dimensions.trunkHeight / 2);
        trunkMesh.castShadow = true; trunkMesh.receiveShadow = true; treeMeshGroup.add(trunkMesh);

        // Create Canopy Group
        const canopyGroup = new THREE.Group(); canopyGroup.name = "canopyGroup"; const tiles = [];
        const gridSize = Config.CANOPY_TILE_GRID_SIZE; const totalTiles = gridSize * gridSize;
        const initialDims = calculateDimensions({ currentLA: Config.INITIAL_LEAF_AREA, trunkHeight: Config.INITIAL_TRUNK_HEIGHT });
        const tileWidth = initialDims.canopyWidth / gridSize; const tileDepth = initialDims.canopyDepth / gridSize;
        const tileThickness = Config.CANOPY_TILE_THICKNESS;
        const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);
        for (let i = 0; i < gridSize; i++) { for (let j = 0; j < gridSize; j++) {
            const tileMesh = new THREE.Mesh(tileGeometry, sharedCanopyMaterial); // Use shared material
            const xPos = (i-(gridSize-1)/2)*tileWidth; const zPos = (j-(gridSize-1)/2)*tileDepth;
            tileMesh.position.set(xPos, 0, zPos); tileMesh.castShadow=true; tileMesh.receiveShadow=true;
            tileMesh.name = `canopyTile_${i}_${j}`; canopyGroup.add(tileMesh); tiles.push(tileMesh); } }
        shuffleArray(tiles); canopyGroup.userData.tiles = tiles; canopyGroup.userData.initialWidth = initialDims.canopyWidth;
        treeMeshGroup.add(canopyGroup);

        // Set initial position
        treeMeshGroup.position.copy(targetPosition);

        // Add to scene and map
        if (scene) scene.add(treeMeshGroup); else console.error("Scene not found for tree");
        gameState.playerTrees.set(playerId, treeMeshGroup);

        // Apply initial geometry/tiles update
        updateTreeGeometry(treeMeshGroup, playerData, dimensions);
        updateCanopyTiles(treeMeshGroup, playerData);

    } else {
        // --- Update Existing Tree ---
        // Update position if necessary (e.g., if spawn point changed somehow, though unlikely)
        if (!treeMeshGroup.position.equals(targetPosition)) {
            treeMeshGroup.position.copy(targetPosition);
        }
        updateTreeGeometry(treeMeshGroup, playerData, dimensions);
        updateCanopyTiles(treeMeshGroup, playerData);
    }

    // Set visibility based on server 'isAlive' state
    // Ensure visibility reflects player status EVEN if tree object already existed
    treeMeshGroup.visible = playerData.isAlive;
}

// --- Update Helpers ---
function updateTreeGeometry(treeMeshGroup, playerData, dimensions) { /* ... geometry update logic ... */
    if (!treeMeshGroup) return; const trunkMesh = treeMeshGroup.getObjectByName("trunk"); const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");
    if (trunkMesh && trunkMesh.geometry) { const params = trunkMesh.geometry.parameters; const heightChanged = Math.abs(params.height - dimensions.trunkHeight)>0.01; if (Math.abs(params.width - dimensions.trunkWidth)>0.01 || heightChanged || Math.abs(params.depth - dimensions.trunkDepth)>0.01) { trunkMesh.geometry.dispose(); trunkMesh.geometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth); } trunkMesh.position.y = dimensions.trunkHeight / 2; } // Always update position Y
    if (canopyGroup) { const tileThickness = Config.CANOPY_TILE_THICKNESS; canopyGroup.position.y = dimensions.trunkHeight + (tileThickness / 2); const initialWidth = canopyGroup.userData.initialWidth || 1; const currentWidth = dimensions.canopyWidth; const scaleFactor = currentWidth > 0.01 ? currentWidth / initialWidth : 0.01; if (Math.abs(canopyGroup.scale.x - scaleFactor) > 0.001) { canopyGroup.scale.set(scaleFactor, 1, scaleFactor); } }
}

function updateCanopyTiles(treeMeshGroup, playerData) { /* ... tile visibility logic ... */
    if (!treeMeshGroup || !sharedCanopyMaterial) return; const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup"); if (!canopyGroup || !canopyGroup.userData.tiles) return; const tiles = canopyGroup.userData.tiles; const totalTiles = tiles.length; if (totalTiles === 0) return; const damagePercent = playerData.damagedLAPercentage || 0; const hiddenTilesCount = Math.floor(totalTiles * damagePercent); for (let i = 0; i < totalTiles; i++) { tiles[i].visible = (i >= hiddenTilesCount); }
    // --- TODO: Implement per-player tinting later ---
    const baseColor = new THREE.Color(Config.DEFAULT_LEAF_COLOR); sharedCanopyMaterial.color.set(baseColor);
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
    if (!group) return; group.traverse((obj) => { if (obj.isMesh && obj.geometry) obj.geometry.dispose(); });
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