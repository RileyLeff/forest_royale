// config.js (Project Root - Client-Side Config)

// --- UI & Display Constants ---
export const MAX_CARBON = 200; // Used for UI bar calculation
export const BASE_HYDRAULIC = 50; // Fallback for UI bar if player state not ready

// --- Rendering & Visual Defaults ---
export const INITIAL_TRUNK_HEIGHT = 2; // Used as fallback for camera target
export const ISLAND_RADIUS = 50; // <<-- Ensure this is present and correct
export const WATER_LEVEL = 0; // <<-- Ensure this is present and correct
export const ISLAND_LEVEL = 0.1; // Needed for positioning trees? Check tree.js usage.
export const DEFAULT_LEAF_COLOR = '#228B22'; // Forest Green - Used if server doesn't send color? Or for material fallback.
export const DEFAULT_TRUNK_COLOR = '#8B4513'; // Saddle Brown - Used if server doesn't send color? Or for material fallback.

// --- Canopy Tile Configuration (Client needs for rendering) ---
export const CANOPY_TILE_GRID_SIZE = 10;
export const CANOPY_TILE_THICKNESS = 0.1;

// --- Tree Structure Ratio (Client needs for rendering calculations) ---
export const k_TA_LA_RATIO = 0.01; // Trunk cross-section area / Leaf Area ratio
export const INITIAL_LEAF_AREA = 5; // Used in tree.js for calculating initial tile size

// --- Environment Visuals (Client needs for environment.js defaults/calcs) ---
export const PERIOD_DURATION = 7.0;
export const NUM_DAY_PERIODS = 3;
export const DAY_TOTAL_DURATION = PERIOD_DURATION * NUM_DAY_PERIODS;
export const NIGHT_DURATION = 3.0;
export const TOTAL_CYCLE_DURATION = DAY_TOTAL_DURATION + NIGHT_DURATION;
export const LIGHT_MULT_SUNNY = 1.0;
export const LIGHT_MULT_CLOUDY = 0.4;
export const DROUGHT_MULT_BASE = 1.0;
export const DROUGHT_VARIATION = 0.4;


// NOTE: Simulation rates, costs, probabilities, etc., are now primarily server-side
// in server/config.js and should NOT be duplicated here unless specifically
// needed for some client-side prediction or display logic (which we currently don't have).