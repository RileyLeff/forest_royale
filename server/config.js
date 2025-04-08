// server/config.js
// Game Constants & Configuration
// (Content copied from root config.js)

export const k_TA_LA_RATIO = 0.01; // Trunk cross-section area / Leaf Area ratio
export const INITIAL_LEAF_AREA = 5;
export const INITIAL_TRUNK_HEIGHT = 2;
export const INITIAL_CARBON = 100;
export const INITIAL_HYDRAULICS = 100; // Starting hydraulic safety value

export const MAX_CARBON = 200; // Maximum carbon storage capacity

// Hydraulic Buffer Configuration
export const BASE_HYDRAULIC = 50; // Base hydraulic safety buffer independent of size
export const HYDRAULIC_SCALE_PER_LA = 10; // Additional buffer capacity per unit of currentLA

export const PHOTOSYNTHESIS_RATE_PER_LA = 0.5; // Carbon gain per LA per second at max light & stomata=1
export const RESPIRATION_RATE_PER_LA = 0.02;   // Carbon loss per LA per second
export const RESPIRATION_RATE_PER_TRUNK_VOL = 0.01; // Carbon loss per trunk volume per second
export const TRANSPIRATION_RATE_PER_LA = 0.4; // Water loss rate per LA per sec at stomata=1, normal drought
export const HYDRAULIC_RECOVERY_RATE = 2;   // Base safety gain per second if stomata closed & water available
export const HYDRAULIC_DAMAGE_THRESHOLD = 20; // Below this, start taking damage
export const CROWN_DIEBACK_RATE = 0.05;      // Proportion of canopy LA potentially lost per second below threshold

export const GROWTH_COST_PER_LA = 5;        // Carbon cost to add 1 unit of LA (includes implicit trunk cost)
export const SEED_COST = 1;                 // Carbon cost per seed

// Time Structure Constants
export const PERIOD_DURATION = 7.0;         // Duration of each daytime weather period (seconds)
export const NUM_DAY_PERIODS = 3;           // Number of weather periods per day
export const DAY_TOTAL_DURATION = PERIOD_DURATION * NUM_DAY_PERIODS; // Total duration of all day periods
export const NIGHT_DURATION = 3.0;          // Duration of nighttime (seconds)
export const TOTAL_CYCLE_DURATION = DAY_TOTAL_DURATION + NIGHT_DURATION; // Full day-night cycle length
export const GROWTH_OFFSET_NIGHT = 1.5;     // Time into night when growth allocation occurs (seconds)

// Weather Probabilities & Effects
export const SUNNY_PROB = 2.0 / 3.0;        // Probability of a period being sunny (vs cloudy)
export const RAIN_PROB_IF_CLOUDY = 0.5;     // Probability of rain if a period is cloudy

export const LIGHT_MULT_SUNNY = 1.0;        // Photosynthesis multiplier for sunny weather
export const LIGHT_MULT_CLOUDY = 0.4;       // Photosynthesis multiplier for cloudy weather

export const DROUGHT_MULT_BASE = 1.0;       // Base drought factor (normal conditions)
export const DROUGHT_VARIATION = 0.4;       // Max +/- variation around the base for random drought factor

export const RAIN_RECOVERY_BONUS_MULT = 3.0; // Multiplier for HYDRAULIC_RECOVERY_RATE during rain
export const NIGHT_RAIN_HYDRAULIC_BOOST = 20.0; // Absolute hydraulic units added during rainy night (foliar uptake)

// Canopy Tile Configuration (Client might still need this, but server sim doesn't directly)
// export const CANOPY_TILE_GRID_SIZE = 10;
// export const CANOPY_TILE_THICKNESS = 0.1;

// Island Configuration (Client primarily needs this, server might for spawn validation)
// export const ISLAND_RADIUS = 50;
// export const WATER_LEVEL = 0;
// export const ISLAND_LEVEL = 0.1;

// Default Colors (Client only)
// export const DEFAULT_LEAF_COLOR = '#228B22';
// export const DEFAULT_TRUNK_COLOR = '#8B4513';

// Fog constants (Client only)
// export const FOG_DAY_NEAR = 50;
// export const FOG_DAY_FAR = 150;
// export const FOG_NIGHT_NEAR = 9999;
// export const FOG_NIGHT_FAR = 10000;