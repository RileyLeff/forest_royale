// client/tree.js
import * as THREE from 'three';
import * as Config from './config.js';
import { scene } from './sceneSetup.js';
import { gameState } from './gameState.js';

// Shared Materials
let sharedTrunkMaterial = null;
let sharedCanopyMaterial = null;
function ensureSharedMaterials() {
    const leafColor = Config.DEFAULT_LEAF_COLOR;
    const trunkColor = Config.DEFAULT_TRUNK_COLOR;
    if (!sharedTrunkMaterial) sharedTrunkMaterial = new THREE.MeshStandardMaterial({ color: trunkColor, name: 'sharedTrunkMaterial' });
    if (!sharedCanopyMaterial) sharedCanopyMaterial = new THREE.MeshStandardMaterial({ color: leafColor, name: 'sharedCanopyMaterial' });
}

// Helper Functions
function shuffleArray(array) { for (let i=array.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [array[i],array[j]]=[array[j],array[i]]; } }
function calculateDimensions(playerData) {
    const currentLA = (playerData.currentLA > 0) ? playerData.currentLA : 0.0001;
    const trunkHeight = (playerData.trunkHeight > 0) ? playerData.trunkHeight : Config.INITIAL_TRUNK_HEIGHT;
    const canopyWidth = Math.sqrt(currentLA);
    const trunkArea = currentLA * (Config.k_TA_LA_RATIO !== undefined ? Config.k_TA_LA_RATIO : 0.01); // Use default if needed
    const trunkWidth = Math.sqrt(trunkArea);
    return { canopyWidth: canopyWidth, canopyDepth: canopyWidth, trunkWidth: Math.max(0.1, trunkWidth), trunkDepth: Math.max(0.1, trunkWidth), trunkHeight: trunkHeight };
}

// --- Tree Creation/Update ---
export function createOrUpdateTree(playerId, playerData) {

    // +++ CRITICAL CHECK: Do not create/update trees for spectators +++
    if (!playerData || playerData.isSpectator) { // Check if playerData exists and if spectator
        if (gameState.playerTrees.has(playerId)) {
             console.log(`TREE: Player ${playerId} is spectator or data invalid, removing existing tree.`);
             removeTree(playerId);
        }
        return; // Stop processing
    }

    // Player is NOT a spectator, proceed
    ensureSharedMaterials();

    let treeMeshGroup = gameState.playerTrees.get(playerId);
    const dimensions = calculateDimensions(playerData);
    const baseHeight = Config.ISLAND_LEVEL !== undefined ? Config.ISLAND_LEVEL : 0.1;
    const targetPosition = new THREE.Vector3(playerData.spawnPoint?.x ?? 0, baseHeight, playerData.spawnPoint?.z ?? 0);

    if (!treeMeshGroup) {
        // Create New Tree
        treeMeshGroup = new THREE.Group(); treeMeshGroup.name = `playerTree_${playerId}`;
        const trunkGeometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth);
        const trunkMat = sharedTrunkMaterial.clone(); // Clone for customization
        trunkMat.color.set(playerData.trunkColor || Config.DEFAULT_TRUNK_COLOR); // Set initial color
        const trunkMesh = new THREE.Mesh(trunkGeometry, trunkMat);
        trunkMesh.name = "trunk"; trunkMesh.position.y = (dimensions.trunkHeight / 2); trunkMesh.castShadow = true; trunkMesh.receiveShadow = true; treeMeshGroup.add(trunkMesh);

        const canopyGroup = new THREE.Group(); canopyGroup.name = "canopyGroup"; const tiles = [];
        const gridSize = Config.CANOPY_TILE_GRID_SIZE !== undefined ? Config.CANOPY_TILE_GRID_SIZE : 10; // Use default if needed
        const tileWidth = dimensions.canopyWidth / gridSize; const tileDepth = dimensions.canopyDepth / gridSize; const tileThickness = Config.CANOPY_TILE_THICKNESS !== undefined ? Config.CANOPY_TILE_THICKNESS : 0.1; // Use default if needed
        const tileGeometry = new THREE.BoxGeometry(tileWidth, tileThickness, tileDepth);
        const leafMatBase = sharedCanopyMaterial.clone(); // Clone base material
        leafMatBase.color.set(playerData.leafColor || Config.DEFAULT_LEAF_COLOR); // Set initial color

        for (let i = 0; i < gridSize; i++) { for (let j = 0; j < gridSize; j++) {
            // Assign the same cloned & colored material instance to all tiles initially
            const tileMesh = new THREE.Mesh(tileGeometry, leafMatBase);
            const xPos = (i-(gridSize-1)/2)*tileWidth; const zPos = (j-(gridSize-1)/2)*tileDepth;
            tileMesh.position.set(xPos, 0, zPos); tileMesh.castShadow=true; tileMesh.receiveShadow=true; tileMesh.name = `canopyTile_${i}_${j}`; canopyGroup.add(tileMesh); tiles.push(tileMesh); } }
        shuffleArray(tiles); canopyGroup.userData.tiles = tiles; canopyGroup.userData.creationWidth = dimensions.canopyWidth;
        treeMeshGroup.add(canopyGroup);
        treeMeshGroup.position.copy(targetPosition);
        if (scene) scene.add(treeMeshGroup); else console.error("Scene not found for tree");
        gameState.playerTrees.set(playerId, treeMeshGroup);
    }

    // Update Existing Tree (geometry, scale, visibility, colors)
    if (!treeMeshGroup.position.equals(targetPosition)) { treeMeshGroup.position.copy(targetPosition); }
    updateTreeGeometry(treeMeshGroup, playerData, dimensions);
    updateCanopyTiles(treeMeshGroup, playerData); // Handles damage and color updates
    treeMeshGroup.visible = playerData.isAlive; // Visibility based on alive status only (spectator check above)
}

// --- Update Helpers ---
function updateTreeGeometry(treeMeshGroup, playerData, dimensions) { if (!treeMeshGroup) return; const trunkMesh = treeMeshGroup.getObjectByName("trunk"); const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup"); if (trunkMesh && trunkMesh.geometry) { const params = trunkMesh.geometry.parameters; if (Math.abs(params.width - dimensions.trunkWidth) > 0.01 || Math.abs(params.height - dimensions.trunkHeight) > 0.01 || Math.abs(params.depth - dimensions.trunkDepth) > 0.01) { trunkMesh.geometry.dispose(); trunkMesh.geometry = new THREE.BoxGeometry(dimensions.trunkWidth, dimensions.trunkHeight, dimensions.trunkDepth); } trunkMesh.position.y = dimensions.trunkHeight / 2; } if (canopyGroup) { const tileThickness = Config.CANOPY_TILE_THICKNESS !== undefined ? Config.CANOPY_TILE_THICKNESS : 0.1; canopyGroup.position.y = dimensions.trunkHeight + (tileThickness / 2); const creationWidth = canopyGroup.userData.creationWidth || dimensions.canopyWidth; const currentWidth = dimensions.canopyWidth; const scaleFactor = (creationWidth > 0.01) ? (currentWidth / creationWidth) : 0.01; if (Math.abs(canopyGroup.scale.x - scaleFactor) > 0.001) { canopyGroup.scale.set(scaleFactor, 1, scaleFactor); } } }

function updateCanopyTiles(treeMeshGroup, playerData) {
    if (!treeMeshGroup) return;
    const canopyGroup = treeMeshGroup.getObjectByName("canopyGroup");
    if (!canopyGroup || !canopyGroup.userData.tiles) return;
    const tiles = canopyGroup.userData.tiles; const totalTiles = tiles.length; if (totalTiles === 0) return;

    // Update Tile Visibility (Damage)
    const damagePercent = playerData.damagedLAPercentage || 0;
    const hiddenTilesCount = Math.floor(totalTiles * damagePercent);
    for (let i = 0; i < totalTiles; i++) { tiles[i].visible = (i >= hiddenTilesCount); }

    // Update Tile Color (Uses the material instance shared by tiles in this group)
    const leafColor = playerData.leafColor || Config.DEFAULT_LEAF_COLOR;
    if (tiles[0] && tiles[0].material && tiles[0].material.color) { // Check material of first tile
        if (!tiles[0].material.color.equals(new THREE.Color(leafColor))) {
            tiles[0].material.color.set(leafColor); // Update color on the shared material instance
        }
    }

    // Update Trunk Color
    const trunkMesh = treeMeshGroup.getObjectByName("trunk");
    const trunkColor = playerData.trunkColor || Config.DEFAULT_TRUNK_COLOR;
    if (trunkMesh && trunkMesh.material && trunkMesh.material.color) {
         if (!trunkMesh.material.color.equals(new THREE.Color(trunkColor))) {
            trunkMesh.material.color.set(trunkColor);
         }
    }
}


// --- Removal & Disposal ---
export function removeTree(playerId) { const treeMeshGroup = gameState.playerTrees.get(playerId); if (treeMeshGroup) { disposeTreeGroup(treeMeshGroup); if (scene && treeMeshGroup.parent) scene.remove(treeMeshGroup); gameState.playerTrees.delete(playerId); } }
function disposeTreeGroup(group) { if (!group) return; group.traverse((obj) => { if (obj.isMesh) { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) { obj.material.forEach(material => material.dispose()); } else { obj.material.dispose(); } } } }); }
export function disposeAllTrees() { gameState.playerTrees.forEach(treeGroup => { disposeTreeGroup(treeGroup); if(scene && treeGroup.parent) scene.remove(treeGroup); }); gameState.playerTrees.clear(); disposeSharedTreeMaterials(); console.log("Disposed all player trees and shared materials."); }
export function disposeSharedTreeMaterials() { if (sharedTrunkMaterial) { sharedTrunkMaterial.dispose(); sharedTrunkMaterial = null; } if (sharedCanopyMaterial) { sharedCanopyMaterial.dispose(); sharedCanopyMaterial = null; } }