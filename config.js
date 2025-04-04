// Game Constants & Configuration

export const k_TA_LA_RATIO = 0.01; // Trunk cross-section area / Leaf Area ratio
export const INITIAL_LEAF_AREA = 5;
export const INITIAL_TRUNK_HEIGHT = 2;
export const INITIAL_CARBON = 100;
export const INITIAL_HYDRAULICS = 100;

export const MAX_CARBON = 200;
export const MAX_HYDRAULIC = 100;

export const PHOTOSYNTHESIS_RATE_PER_LA = 0.5; // Carbon gain per LA per second at max light & stomata=1
export const RESPIRATION_RATE_PER_LA = 0.02;   // Carbon loss per LA per second
export const RESPIRATION_RATE_PER_TRUNK_VOL = 0.01; // Carbon loss per trunk volume per second
export const TRANSPIRATION_RATE_PER_LA = 0.4; // Water loss rate per LA per sec at stomata=1, normal drought
export const HYDRAULIC_RECOVERY_RATE = 2;   // Safety gain per second if stomata closed & water available
export const HYDRAULIC_DAMAGE_THRESHOLD = 20; // Below this, start taking damage
export const CROWN_DIEBACK_RATE = 0.05;      // Proportion of canopy LA potentially lost per second below threshold

export const GROWTH_COST_PER_LA = 5;        // Carbon cost to add 1 unit of LA (includes implicit trunk cost)
export const SEED_COST = 10;                // Carbon cost per seed

export const DAY_DURATION_SECONDS = 20;     // Duration of daytime
export const NIGHT_DURATION_SECONDS = 8;     // Duration of nighttime

export const ISLAND_RADIUS = 50;
export const WATER_LEVEL = 0;
export const ISLAND_LEVEL = 0.1;

export const DEFAULT_LEAF_COLOR = '#228B22'; // Forest Green
export const DEFAULT_TRUNK_COLOR = '#8B4513'; // Saddle Brown

// UI Related (Optional - could also live in ui.js)
export const ALLOCATION_TIMER_DURATION = 5; // Seconds for allocation decision