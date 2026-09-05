// Single source of truth for the Core base URL.
// Mirrors the reference client shipped inside the Core (src/services/api.ts).
export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'http://10.132.108.240:5151'
).replace(/\/+$/, '')

// The Core seeds this tenant on first run (DefaultDataSeeder).
export const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111'
