// Single source of truth for the Core base URL.
// Mirrors the reference client shipped inside the Core (src/services/api.ts).
export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  'https://192.168.100.64:8282'
).replace(/\/+$/, '')

// The Core seeds this tenant on first run (DefaultDataSeeder).
export const DEFAULT_TENANT_ID = '11111111-1111-1111-1111-111111111111'

// Demo mode: every API call and SignalR hub is served by src/mock from the browser's
// localStorage - nothing ever reaches the Core. This feature branch turns it on by default;
// set VITE_USE_MOCK=false to talk to the real backend again.
export const USE_MOCK = !(
  typeof import.meta !== 'undefined' && import.meta.env && String(import.meta.env.VITE_USE_MOCK) === 'false'
)

// Shared password of every seeded demo account.
export const DEMO_PASSWORD = 'Demo@1234'
