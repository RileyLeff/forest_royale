// server/network/validation.js
// Type and shape checks for untrusted socket payloads.

export const VALID_INTENTS = ['single', 'multi', 'spectate'];
export const MAX_PLAYER_NAME_LENGTH = 24;
export const DEFAULT_LEAF_COLOR = '#228B22';
export const DEFAULT_TRUNK_COLOR = '#8B4513';

// ASCII/C1 control characters, line/paragraph separators, and bidi overrides.
const DISALLOWED_NAME_CHARS = /[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]/u;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Server-assigned admin names use this prefix; players must not claim it.
const RESERVED_NAME_PREFIX = 'ADMIN_';

const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validates a player name. Missing or blank names fall back to `fallback`.
 * Returns { ok: true, value } or { ok: false, reason }.
 */
export function validatePlayerName(name, fallback) {
    if (name === undefined || name === null) return { ok: true, value: fallback };
    if (typeof name !== 'string') return { ok: false, reason: 'playerName must be a string.' };
    const trimmed = name.trim();
    if (trimmed.length === 0) return { ok: true, value: fallback };
    if ([...trimmed].length > MAX_PLAYER_NAME_LENGTH) {
        return { ok: false, reason: `playerName must be at most ${MAX_PLAYER_NAME_LENGTH} characters.` };
    }
    if (DISALLOWED_NAME_CHARS.test(trimmed)) {
        return { ok: false, reason: 'playerName contains control characters.' };
    }
    if (trimmed.toUpperCase().startsWith(RESERVED_NAME_PREFIX)) {
        return { ok: false, reason: 'playerName uses a reserved prefix.' };
    }
    return { ok: true, value: trimmed };
}

function validateColor(color, fallback, field) {
    if (color === undefined || color === null || color === '') return { ok: true, value: fallback };
    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
        return { ok: false, reason: `${field} must be a #RRGGBB hex color.` };
    }
    return { ok: true, value: color };
}

/**
 * Validates a `playerJoinRequest` payload.
 * Returns { ok: true, intent, settings } or { ok: false, reason }.
 */
export function validateJoinRequest(data, socketId) {
    if (!isPlainObject(data)) return { ok: false, reason: 'Join payload must be an object.' };
    if (typeof data.intent !== 'string' || !VALID_INTENTS.includes(data.intent)) {
        return { ok: false, reason: 'Invalid intent.' };
    }
    const name = validatePlayerName(data.playerName, `Player_${String(socketId).substring(0, 4)}`);
    if (!name.ok) return name;
    const leaf = validateColor(data.leafColor, DEFAULT_LEAF_COLOR, 'leafColor');
    if (!leaf.ok) return leaf;
    const trunk = validateColor(data.trunkColor, DEFAULT_TRUNK_COLOR, 'trunkColor');
    if (!trunk.ok) return trunk;
    return {
        ok: true,
        intent: data.intent,
        settings: { playerName: name.value, leafColor: leaf.value, trunkColor: trunk.value },
    };
}

/** True for finite numbers only (rejects NaN, Infinity, and non-numbers). */
export const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
