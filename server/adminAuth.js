// server/adminAuth.js
// Admin tools are off unless ADMIN_PASSWORD is set; there is no default.

import { createHash, timingSafeEqual } from 'crypto';

const password = process.env.ADMIN_PASSWORD || '';
export const adminEnabled = password.length > 0;

const digest = (value) => createHash('sha256').update(value).digest();

export function isAdminPassword(candidate) {
    if (!adminEnabled || typeof candidate !== 'string' || !candidate) return false;
    return timingSafeEqual(digest(candidate), digest(password));
}
