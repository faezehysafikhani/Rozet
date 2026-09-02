import { API_BASE_URL } from './config'

// Storage keys are deliberately identical to the Core reference client so both front-ends
// can share a browser profile without stepping on each other.
const ACCESS_TOKEN_KEY = 'nexus_access_token'
const REFRESH_TOKEN_KEY = 'nexus_refresh_token'
const USER_ID_KEY = 'nexus_user_id'
const EXPIRES_KEY = 'nexus_access_token_expires'
const USER_KEY = 'nexus_user'
const PERMISSIONS_KEY = 'nexus_permissions'
const GRANTED_PERMISSIONS_KEY = 'nexus_granted_permissions'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readJson(key) {
  const raw = read(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const AuthTokenStore = {
  getAccessToken: () => read(ACCESS_TOKEN_KEY),
  getRefreshToken: () => read(REFRESH_TOKEN_KEY),
  getUserId: () => read(USER_ID_KEY),
  getUser: () => readJson(USER_KEY),
  getPermissions: () => readJson(PERMISSIONS_KEY) || [],
  // Only what was actually assigned - prerequisites unlocked by the Core are excluded.
  getGrantedPermissions: () => readJson(GRANTED_PERMISSIONS_KEY) || readJson(PERMISSIONS_KEY) || [],

  // The Core issues a 30-minute access token by default (Jwt:AccessTokenMinutes).
  isExpired(skewSeconds = 30) {
    const raw = read(EXPIRES_KEY)
    if (!raw) return false
    const expiresAt = Date.parse(raw)
    if (Number.isNaN(expiresAt)) return false
    return Date.now() + skewSeconds * 1000 >= expiresAt
  },

  setSession(auth) {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, auth.accessToken)
      if (auth.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, auth.refreshToken)
      if (auth.accessTokenExpiresAtUtc) localStorage.setItem(EXPIRES_KEY, auth.accessTokenExpiresAtUtc)
      if (auth.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(auth.user))
        localStorage.setItem(USER_ID_KEY, auth.user.id)
      }
    } catch (e) {
      console.warn('ذخیره توکن ناموفق بود', e)
    }
  },

  setPermissions(permissions, grantedPermissions) {
    try {
      localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(permissions || []))
      localStorage.setItem(GRANTED_PERMISSIONS_KEY, JSON.stringify(grantedPermissions || permissions || []))
    } catch (e) {
      console.warn('ذخیره دسترسی‌ها ناموفق بود', e)
    }
  },

  setUser(user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      if (user?.id) localStorage.setItem(USER_ID_KEY, user.id)
    } catch (e) {
      console.warn('ذخیره کاربر ناموفق بود', e)
    }
  },

  clear() {
    ;[ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_ID_KEY, EXPIRES_KEY, USER_KEY, PERMISSIONS_KEY, GRANTED_PERMISSIONS_KEY].forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    })
  },
}

// Raw refresh call. Kept outside apiRequest so the refresh itself can never recurse.
export async function refreshAccessToken() {
  const refreshToken = AuthTokenStore.getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/api/identity/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) return false
    const auth = await response.json()
    if (!auth?.accessToken) return false
    AuthTokenStore.setSession(auth)
    return true
  } catch {
    return false
  }
}
