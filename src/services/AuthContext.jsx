import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthTokenStore } from './authStore'
import { identityApi, setUnauthorizedHandler, unwrap, PersianMessages } from './api'
import { startRealtime, stopRealtime } from './signalr'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => AuthTokenStore.getUser())
  // Two sets, deliberately:
  //   permissions        - EFFECTIVE. What was assigned plus the prerequisites the Core
  //                        unlocks (e.g. groups.manage_members implies users.view).
  //                        This is what the API will accept, so it gates actions.
  //   grantedPermissions - Only what an admin actually assigned. This gates navigation, so
  //                        a screen appears because someone meant to give access to it, not
  //                        because it happened to be a dependency of something else.
  const [permissions, setPermissions] = useState(() => AuthTokenStore.getPermissions())
  const [grantedPermissions, setGrantedPermissions] = useState(() => AuthTokenStore.getGrantedPermissions())
  const [booting, setBooting] = useState(true)

  const clearSession = useCallback(() => {
    AuthTokenStore.clear()
    setUser(null)
    setPermissions([])
    setGrantedPermissions([])
  }, [])

  const signOut = useCallback(async () => {
    // The Core exposes no logout endpoint; the session is token-based, so clearing the
    // client state plus dropping the hub connections is the complete logout.
    await stopRealtime()
    clearSession()
  }, [clearSession])

  // Any 401 that a refresh could not rescue drops the user back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession()
      stopRealtime()
    })
  }, [clearSession])

  const applySession = useCallback((payload, fallbackUser) => {
    const nextUser = payload?.user || fallbackUser
    const nextPermissions = payload?.permissions || []
    // Older Core builds returned only one list; fall back so nothing breaks.
    const nextGranted = payload?.grantedPermissions || nextPermissions

    AuthTokenStore.setUser(nextUser)
    AuthTokenStore.setPermissions(nextPermissions, nextGranted)
    setUser(nextUser)
    setPermissions(nextPermissions)
    setGrantedPermissions(nextGranted)
  }, [])

  // Session restore on reload: /me is the authority on identity + permissions.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!AuthTokenStore.getAccessToken()) {
        setBooting(false)
        return
      }
      const result = await identityApi.me()
      if (cancelled) return
      const payload = unwrap(result)
      if (payload?.user) {
        applySession(payload)
        startRealtime()
      } else {
        clearSession()
      }
      setBooting(false)
    })()
    return () => { cancelled = true }
  }, [applySession, clearSession])

  const signIn = useCallback(async (email, password, tenantSlug) => {
    const result = await identityApi.login(email, password, tenantSlug)
    if (!result.isSuccess) {
      return { ok: false, error: PersianMessages.error(result.error) }
    }

    const auth = result.value
    AuthTokenStore.setSession(auth)

    // Login does not return permissions; /me does.
    const payload = unwrap(await identityApi.me())
    applySession(payload, auth.user)

    await startRealtime()
    return { ok: true }
  }, [applySession])

  const value = useMemo(() => ({
    user,
    permissions,
    grantedPermissions,
    booting,
    isAuthenticated: Boolean(user),
    signIn,
    signOut,

    /** Can the user perform this action? Uses the effective set. */
    can: (permission) => !permission || permissions.includes(permission),
    canAny: (list) => !list?.length || list.some((p) => permissions.includes(p)),

    /**
     * Should this menu or tab be shown? Uses the granted set only.
     * Accepts a single permission or a list meaning "any of".
     */
    canReach: (wanted) => {
      if (!wanted) return true
      const list = Array.isArray(wanted) ? wanted : [wanted]
      return list.length === 0 || list.some((p) => grantedPermissions.includes(p))
    },
  }), [user, permissions, grantedPermissions, booting, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth باید داخل AuthProvider استفاده شود')
  return context
}

/** Renders children only when the permission is present in the effective set. */
export function Can({ permission, any, fallback = null, children }) {
  const { can, canAny } = useAuth()
  const allowed = any ? canAny(any) : can(permission)
  return allowed ? children : fallback
}
