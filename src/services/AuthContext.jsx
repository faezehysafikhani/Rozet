import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AuthTokenStore } from './authStore'
import { identityApi, setUnauthorizedHandler, unwrap, PersianMessages } from './api'
import { startRealtime, stopRealtime } from './signalr'

const AuthContext = createContext(null)

// Core error codes of the sign-in endpoint (ProblemDetails.title).
const CAPTCHA_CODES = ['unauthorized.captcha_required', 'captcha.required', 'captcha.invalid']
const LOGIN_ERRORS = {
  'unauthorized.captcha_required': 'نام کاربری یا رمز عبور نادرست است. برای تلاش بعدی کد امنیتی را وارد کنید.',
  'captcha.required': 'برای ادامه، کد امنیتی را وارد کنید.',
  'captcha.invalid': 'کد امنیتی نادرست یا منقضی شده است.',
  'too_many_requests': 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.',
  'account.disabled': 'این حساب غیرفعال شده است؛ با مدیر سامانه تماس بگیرید.',
}

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
    // The Core revokes the refresh token on logout; the call is best-effort, because the
    // local session must end even when the Core cannot be reached.
    const refreshToken = AuthTokenStore.getRefreshToken()
    if (refreshToken) await identityApi.logout(refreshToken)
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

  /**
   * identifier: username or mobile number. After a failed attempt the Core wants a CAPTCHA
   * with the next one: the result then says captchaRequired and the caller supplies
   * `captcha` = { id, answer } on the retry.
   */
  const signIn = useCallback(async (identifier, password, captcha, tenantSlug) => {
    const result = await identityApi.login(identifier, password, tenantSlug, captcha)
    if (!result.isSuccess) {
      const message = LOGIN_ERRORS[result.code]
      return {
        ok: false,
        error: message || PersianMessages.error(result.error),
        captchaRequired: CAPTCHA_CODES.includes(result.code),
      }
    }

    const auth = result.value
    AuthTokenStore.setSession(auth)

    // Login does not return permissions; /me does.
    const payload = unwrap(await identityApi.me())
    applySession(payload, auth.user)

    await startRealtime()
    return { ok: true }
  }, [applySession])

  // Re-reads /me after a self-service profile change, so the topbar/profile page reflect it
  // without a full page reload.
  const refreshMe = useCallback(async () => {
    const payload = unwrap(await identityApi.me())
    if (payload?.user) applySession(payload)
  }, [applySession])

  const value = useMemo(() => ({
    user,
    permissions,
    grantedPermissions,
    booting,
    isAuthenticated: Boolean(user),
    signIn,
    signOut,
    refreshMe,

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
  }), [user, permissions, grantedPermissions, booting, signIn, signOut, refreshMe])

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
