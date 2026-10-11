import { DB_VERSION, buildSeed } from './seed'

// The whole fake backend lives under this single localStorage key.
// Session tokens use the regular nexus_* keys (see services/authStore.js).
const STORAGE_KEY = 'rozet_mock_db'

let db = null

function persist(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch (e) {
    // Private mode / quota: the demo keeps working from memory, it just won't survive a reload.
    console.warn('ذخیره داده‌های نمایشی در localStorage ناموفق بود', e)
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.__version === DB_VERSION) return parsed
    }
  } catch {
    /* corrupted or unavailable - fall through and reseed */
  }
  const fresh = buildSeed()
  persist(fresh)
  return fresh
}

export function getDb() {
  if (!db) db = load()
  return db
}

export function saveDb() {
  if (db) persist(db)
}

/** Drops every change and goes back to the seeded demo data. */
export function resetDb() {
  db = buildSeed()
  persist(db)
  return db
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-a000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
}
