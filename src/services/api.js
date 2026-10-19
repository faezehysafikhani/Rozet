import { API_BASE_URL } from './config'
import { AuthTokenStore, refreshAccessToken } from './authStore'

// Called when the Core rejects the session and a refresh cannot rescue it.
let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export const PersianMessages = {
  error(message) {
    if (!message) return 'عملیات انجام نشد. لطفاً دوباره تلاش کنید.'
    // Failed Result<T> bodies carry an Error object ({ code, message }), not a string.
    if (typeof message === 'object') message = message.message || message.detail || message.code || ''
    const text = String(message).toLowerCase()
    // SMS panel - before the generic rules ("disabled", "required") that would misread them.
    if (text.includes('sms delivery is disabled')) return 'ارسال پیامک غیرفعال است؛ ابتدا یک سرویس‌دهنده را فعال کنید.'
    if (text.includes('sms settings are incomplete')) return 'تنظیمات پنل پیامکی کامل نیست.'
    if (text.includes('enabled sms panel needs an api key')) return 'برای فعال کردن پنل پیامکی، کلید API را وارد کنید.'
    if (text.includes('sender number must be digits only')) return 'شماره فرستنده باید فقط شامل رقم (حداکثر ۲۰ رقم) باشد.'
    if (text.includes('valid mobile number for the test message')) return 'برای پیامک آزمایشی یک شماره تلفن همراه معتبر وارد کنید.'
    if (text.includes('test message is too long')) return 'متن پیامک آزمایشی نباید بیشتر از ۵۰۰ کاراکتر باشد.'
    if (text.includes('the sms section is required')) return 'تنظیمات پیامک ارسال نشده است.'
    if (text.includes('unknown sms template')) return 'این متن پیامک در این سامانه قابل ویرایش نیست.'
    {
      const sms = String(message).match(/^The text of '(.+)' (cannot be empty|is longer than (\d+) characters|uses unknown placeholders: (.+?)|must contain (.+?))\.?$/i)
      if (sms) {
        if (/cannot be empty/i.test(sms[2])) return `متن پیامک «${sms[1]}» نمی‌تواند خالی باشد.`
        if (sms[3]) return `متن پیامک «${sms[1]}» نباید بیشتر از ${sms[3]} کاراکتر باشد.`
        if (sms[4]) return `متن پیامک «${sms[1]}» عبارت ناشناخته دارد: ${sms[4]}`
        if (sms[5]) return `متن پیامک «${sms[1]}» باید ${sms[5]} را داشته باشد.`
      }
    }
    // Work teams - checked first, before the generic "not found" / "required" rules below.
    if (text.includes('already have a team with this name')) return 'شما قبلاً تیمی با این نام ساخته‌اید.'
    if (text.includes('team name is required')) return 'نام تیم را وارد کنید.'
    if (text.includes('team name must be at most')) return 'نام تیم نباید بیشتر از ۱۲۸ کاراکتر باشد.'
    if (text.includes('team was not found')) return 'تیم یافت نشد.'
    if (text.includes('team is still in use')) return 'این تیم هنوز در حال استفاده است (مثلاً فعالیت‌هایی به آن واگذار شده). ابتدا آن‌ها را به تیم دیگری واگذار کنید.'
    if (text.includes('only members of your own deputy')) return 'فقط همکاران معاونت خودتان را می‌توانید به تیم اضافه کنید.'
    if (text.includes('one or more users do not exist')) return 'یک یا چند کاربر انتخاب‌شده وجود ندارد.'
    // User administration - also before the generic "disabled" / "not found" / "already exists" rules.
    if (text.includes('built-in system administrator cannot be disabled')) return 'مدیر اصلی سیستم را نمی‌توان غیرفعال کرد.'
    if (text.includes('built-in system administrator cannot be changed')) return 'مشخصات مدیر اصلی سیستم از این بخش قابل تغییر نیست؛ او رمز خود را از «تنظیمات» تغییر می‌دهد.'
    if (text.includes('built-in system administrator cannot be deleted')) return 'مدیر اصلی سیستم قابل حذف نیست.'
    if (text.includes('access of the built-in system administrator')) return 'دسترسی مدیر اصلی سیستم قابل تغییر نیست.'
    if (text.includes('cannot disable your own account')) return 'نمی‌توانید حساب خودتان را غیرفعال کنید.'
    if (text.includes('cannot delete your own account')) return 'نمی‌توانید حساب خودتان را حذف کنید.'
    if (text.includes('cannot change your own roles or permissions')) return 'نمی‌توانید نقش‌ها یا دسترسی‌های خودتان را تغییر دهید.'
    if (text.includes('username must be a national code')) return 'نام کاربری باید کد ملی ۱۰ رقمی باشد (فقط عدد).'
    if (text.includes('user with this username already exists')) return 'کاربری با این نام کاربری (کد ملی) قبلاً ثبت شده است.'
    if (text.includes('user with this mobile number already exists')) return 'کاربری با این شماره موبایل قبلاً ثبت شده است.'
    if (text.includes('user with this email already exists')) return 'کاربری با این ایمیل قبلاً ثبت شده است.'
    if (text.includes('needs the users.change_status permission')) return 'برای فعال یا غیرفعال کردن کاربران، دسترسی «تغییر وضعیت کاربر» لازم است.'
    if (text.includes('one or more roles do not exist')) return 'یک یا چند نقش انتخاب‌شده وجود ندارد.'
    if (text.includes('you can only assign roles whose permissions')) return 'فقط نقش‌هایی را می‌توانید واگذار کنید که همه‌ی دسترسی‌هایشان را خودتان دارید.'
    if (text.includes('you can only grant permissions you have yourself')) return 'فقط دسترسی‌هایی را می‌توانید بدهید یا منع کنید که خودتان دارید.'
    if (text.includes('both granted and denied')) return 'یک دسترسی نمی‌تواند هم‌زمان داده و منع شود.'
    if (text.includes('permissions do not exist')) return 'یک یا چند دسترسی انتخاب‌شده وجود ندارد.'
    if (text.includes('not managed in this product')) return 'برخی از دسترسی‌های انتخاب‌شده در این محصول قابل مدیریت نیستند.'
    if (text.includes('user was not found')) return 'کاربر پیدا نشد.'
    // Risks, stakeholders and the project team.
    if (text.includes('risk that is pending approval cannot be deleted')) return 'ریسکی که در انتظار تأیید است حذف نمی‌شود.'
    if (text.includes('stakeholder that is pending approval cannot be deleted')) return 'ذینفعی که در انتظار تأیید است حذف نمی‌شود.'
    if (text.includes('earlier report for this risk is still waiting')) return 'گزارش قبلی این ریسک هنوز منتظر بررسی است.'
    if (text.includes('only an approved risk has a response')) return 'فقط برای ریسکِ تأییدشده می‌توان گزارش پاسخ ثبت کرد.'
    if (text.includes('response already has that status')) return 'پاسخ ریسک هم‌اکنون همین وضعیت را دارد.'
    if (text.includes('settings are not available in this deployment')) return 'این بخش در این نسخه از سامانه فعال نیست.'
    if (text.includes('risk not found')) return 'ریسک پیدا نشد.'
    if (text.includes('stakeholder not found')) return 'ذینفع پیدا نشد.'
    if (text.includes('already a member of the project')) return 'این کاربر قبلاً عضو پروژه است.'
    if (text.includes('project member not found')) return 'عضو پروژه پیدا نشد.'
    if (text.includes('governance role not found')) return 'نقش حاکمیتی پیدا نشد.'
    if (text.includes('description is required')) return 'شرح را وارد کنید.'
    if (text.includes('name is required')) return 'نام را وارد کنید.'
    if (text.includes('title is required')) return 'عنوان را وارد کنید.'
    if (text.includes('colour must be green, yellow or red')) return 'رنگ هر خانه باید سبز، زرد یا قرمز باشد.'
    if (text.includes('colour for each of the nine cells')) return 'برای هر نُه خانه‌ی ماتریس یک رنگ تعیین کنید.'
    if (text.includes('definition for each of the six bands')) return 'برای هر شش سطح (احتمال و اثر) یک تعریف بنویسید.'
    if (text.includes('not a participant')) return 'شما عضو این گفت‌وگو نیستید.'
    if (text.includes('access denied')) return 'به این گفت‌وگو دسترسی ندارید.'
    if (text.includes('invalid username') || text.includes('invalid email or password')) return 'نام کاربری یا رمز عبور نادرست است.'
    if (text.includes('disabled')) return 'این حساب غیرفعال شده است؛ با مدیر سامانه تماس بگیرید.'
    if (text.includes('too many') || text.includes('429')) return 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.'
    if (text.includes('unauthorized') || text.includes('authentication is required') || text.includes('401'))
      return 'برای انجام این عملیات ابتدا وارد شوید.'
    if (text.includes('forbidden') || text.includes('403')) return 'شما دسترسی لازم برای این عملیات را ندارید.'
    if (text.includes('not found') || text.includes('404')) return 'رکورد موردنظر پیدا نشد.'
    if (text.includes('already exists') || text.includes('conflict') || text.includes('409'))
      return 'رکوردی با این مشخصات قبلاً ثبت شده است.'
    if (text.includes('valid mobile number')) return 'شماره تلفن همراه معتبر نیست (مثال: 09121234567).'
    if (text.includes('mobile number cannot be used')) return 'این شماره تلفن همراه قابل استفاده نیست؛ شماره دیگری وارد کنید.'
    if (text.includes('avatar image is too large')) return 'حجم تصویر آواتار بیش از حد مجاز است.'
    if (text.includes('identity details cannot be changed')) return 'نام و مشخصات هویتی از پروفایل شخصی قابل تغییر نیست.'
    if (text.includes('invalid, expired or has already been used'))
      return 'لینک بازیابی نامعتبر یا منقضی شده است. لطفاً دوباره درخواست دهید.'
    if (text.includes('validation') || text.includes('required') || text.includes('400'))
      return 'اطلاعات واردشده معتبر نیست. لطفاً فیلدها را بررسی کنید.'
    if (text.includes('failed to fetch')) return 'ارتباط با سرور برقرار نشد. آدرس API و اجرای Core را بررسی کنید.'
    return message
  },
}

async function rawRequest(endpoint, options, token) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const url = /^https?:\/\//.test(endpoint)
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  return fetch(url, { ...options, headers })
}

/**
 * Thin wrapper over the Core's minimal APIs.
 * Returns { isSuccess, value, error, status } - it never throws.
 */
export async function apiRequest(endpoint, options = {}, { anonymous = false, retry = true } = {}) {
  try {
    let token = anonymous ? null : AuthTokenStore.getAccessToken()

    // Proactive refresh: the access token lives 30 minutes by default.
    if (!anonymous && token && AuthTokenStore.isExpired() && retry) {
      if (await refreshAccessToken()) token = AuthTokenStore.getAccessToken()
    }

    let response = await rawRequest(endpoint, options, token)

    // Reactive refresh: token rejected server-side (clock skew, key rotation, restart).
    if (!anonymous && response.status === 401 && retry) {
      if (await refreshAccessToken()) {
        response = await rawRequest(endpoint, options, AuthTokenStore.getAccessToken())
      }
    }

    if (response.status === 401 && !anonymous) {
      AuthTokenStore.clear()
      if (onUnauthorized) onUnauthorized()
      return { isSuccess: false, error: 'unauthorized', status: 401 }
    }

    if (!response.ok) {
      let error = `خطای سرور (${response.status})`
      let code = null
      const text = await response.text().catch(() => '')
      try {
        const body = JSON.parse(text)
        // Two shapes reach here: a ProblemDetails { title, detail } from ToApiResult()
        // (title carries the Core's error code, e.g. "captcha.required"), and a raw
        // Result<T> { isSuccess, error: { code, message } } from the chat module.
        const raw = body.detail || body.error || body.message || body.title
        error = (raw && typeof raw === 'object' ? raw.message || raw.code : raw) || error
        code = (body.error && typeof body.error === 'object' ? body.error.code : body.title) || null
      } catch {
        if (text) error = text
      }
      return { isSuccess: false, error, code, status: response.status }
    }

    if (response.status === 204) return { isSuccess: true, value: null, status: 204 }

    const text = await response.text()
    return { isSuccess: true, value: text ? JSON.parse(text) : null, status: response.status }
  } catch (err) {
    return { isSuccess: false, error: err?.message || 'خطا در برقراری ارتباط با سرور', status: 0 }
  }
}

const body = (value) => (value !== undefined ? JSON.stringify(value) : undefined)

export const api = {
  get: (url, opts) => apiRequest(url, { method: 'GET' }, opts),
  post: (url, value, opts) => apiRequest(url, { method: 'POST', body: body(value) }, opts),
  put: (url, value, opts) => apiRequest(url, { method: 'PUT', body: body(value) }, opts),
  patch: (url, value, opts) => apiRequest(url, { method: 'PATCH', body: body(value) }, opts),
  delete: (url, opts) => apiRequest(url, { method: 'DELETE' }, opts),
}

/* ------------------------------------------------------------------ *
 * Endpoint map - every call below targets an EXISTING Core endpoint.  *
 * ------------------------------------------------------------------ */

export const identityApi = {
  // identifier is a username or a mobile number (not an e-mail). After a failed attempt the Core
  // asks for a CAPTCHA: send the id and the typed answer back with the next attempt.
  login: (identifier, password, tenantSlug, captcha) =>
    api.post('/api/identity/auth/login', {
      identifier,
      password,
      tenantSlug: tenantSlug || null,
      captchaId: captcha?.id || null,
      captchaAnswer: captcha?.answer || null,
    }, { anonymous: true }),
  captcha: () => api.post('/api/identity/auth/captcha', undefined, { anonymous: true }),
  logout: (refreshToken) => api.post('/api/identity/auth/logout', { refreshToken }, { anonymous: true }),
  refresh: (refreshToken) => api.post('/api/identity/auth/refresh', { refreshToken }, { anonymous: true }),
  me: () => api.get('/api/identity/auth/me'),
  forgotPassword: (email, tenantSlug) =>
    api.post('/api/identity/auth/forgot-password', { email, tenantSlug: tenantSlug || null }, { anonymous: true }),
  resetPassword: (token, newPassword) =>
    api.post('/api/identity/auth/reset-password', { token, newPassword }, { anonymous: true }),
}

/** The signed-in user's own account (self-service: no admin permission needed). */
export const accountApi = {
  // displayName is required by the Core even when unchanged - callers always send the current one.
  updateProfile: ({ displayName, avatarUrl, phoneNumber, notifySms }) =>
    api.put('/api/identity/auth/me/profile', { displayName, avatarUrl, phoneNumber, notifySms }),
  changePassword: (currentPassword, newPassword) =>
    api.put('/api/identity/auth/me/password', { currentPassword, newPassword }),
  // The Core replaces all three - callers send the current value of any they do not change.
  // theme = background pattern id, colorPalette = accent palette id, themeMode = light/dark.
  updatePreferences: ({ theme, colorPalette, themeMode }) =>
    api.put('/api/identity/auth/me/preferences', { theme: theme || null, colorPalette: colorPalette || null, themeMode: themeMode || null }),
}

/**
 * «پنل پیامکی»: the SMS provider settings, the system's SMS texts and a test message
 * (sms_settings.view / .update / .test). Secrets are write-only - the Core never sends them back,
 * only "...Configured" flags, and keeps the stored value when a save leaves them empty.
 */
export const smsPanelApi = {
  settings: () => api.get('/api/platform/notification-channels'),
  providers: () => api.get('/api/platform/notification-channels/providers'),
  saveSettings: (sms) => api.put('/api/platform/notification-channels', { sms }),
  templates: () => api.get('/api/platform/notification-channels/templates'),
  saveTemplates: (templates) => api.put('/api/platform/notification-channels/templates', { templates }),
  test: (phoneNumber, message) => api.post('/api/platform/notification-channels/test-sms', { phoneNumber, message: message || null }),
}

/** System-wide upload limit (Settings → «ظاهر سامانه»; changing it needs settings.update). */
export const uploadPolicyApi = {
  get: () => api.get('/api/platform/upload-policy'),
  setMaxFileSizeKb: (kb) =>
    api.put('/api/platform/settings', { tenantId: null, key: 'Uploads.MaxFileSizeKb', value: String(kb), scope: 'System' }),
}

export const usersApi = {
  // pageNumber/pageSize are non-nullable ints on the Core side - always send them.
  list: ({ tenantId, pageNumber = 1, pageSize = 50, search = '' } = {}) => {
    const query = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
    if (tenantId) query.set('tenantId', tenantId)
    if (search) query.set('search', search)
    return api.get(`/api/identity/users/?${query.toString()}`)
  },
  create: (payload) => api.post('/api/identity/users/', payload),
  // firstName / lastName / username (national code) / phoneNumber / email / password are optional:
  // a field left out keeps its current value (an empty email clears it).
  update: (userId, payload) => api.put(`/api/identity/users/${userId}`, payload),
  // Enable / disable an account (users.change_status) - not the system administrator, not yourself.
  setStatus: (userId, isActive) => api.patch(`/api/identity/users/${userId}/status`, { isActive }),
  assignRoles: (userId, roleIds) => api.put(`/api/identity/users/${userId}/roles`, { roleIds }),
  permissions: (userId) => api.get(`/api/identity/users/${userId}/permissions`),
  // deniedPermissionIds: left out keeps the user's current denials; a denial beats roles and groups.
  assignPermissions: (userId, permissionIds, deniedPermissionIds) =>
    api.put(`/api/identity/users/${userId}/permissions`, { permissionIds, deniedPermissionIds }),
}

export const rolesApi = {
  list: (tenantId) => api.get(`/api/identity/roles/${tenantId ? `?tenantId=${tenantId}` : ''}`),
  create: (payload) => api.post('/api/identity/roles/', payload),
  update: (roleId, payload) => api.put(`/api/identity/roles/${roleId}`, payload),
  assignPermissions: (roleId, permissionIds) =>
    api.put(`/api/identity/roles/${roleId}/permissions`, { permissionIds }),
}

/**
 * Optional user-group feature. When Features:UserGroups:Enabled is false in the Core,
 * these routes are not mapped and every call returns 404 - the UI hides the tab.
 */
export const groupsApi = {
  list: (tenantId) => api.get(`/api/identity/groups/${tenantId ? `?tenantId=${tenantId}` : ''}`),
  get: (groupId) => api.get(`/api/identity/groups/${groupId}`),
  create: (payload) => api.post('/api/identity/groups/', payload),
  update: (groupId, payload) => api.put(`/api/identity/groups/${groupId}`, payload),
  assignPermissions: (groupId, permissionIds) =>
    api.put(`/api/identity/groups/${groupId}/permissions`, { permissionIds }),
  assignMembers: (groupId, userIds) =>
    api.put(`/api/identity/groups/${groupId}/members`, { userIds }),
}

/**
 * The signed-in user's own work teams («تیم کاری من»). Listing needs only a session; building
 * and editing need groups.manage_own. The owner comes from the token and always stays a member.
 */
export const myTeamsApi = {
  list: () => api.get('/api/identity/groups/mine'),
  // Whom the caller may add: { limited, allowedUserIds, scopeName } (limited=false: anyone).
  memberScope: () => api.get('/api/identity/groups/mine/member-scope'),
  create: (name) => api.post('/api/identity/groups/mine', { name }),
  setMembers: (teamId, userIds) => api.put(`/api/identity/groups/mine/${teamId}/members`, { userIds }),
  remove: (teamId) => api.delete(`/api/identity/groups/mine/${teamId}`),
}

export const orgChartApi = {
  get: (tenantId) => api.get(`/api/identity/org-chart${tenantId ? `?tenantId=${tenantId}` : ''}`),
}

export const permissionsApi = {
  listGrouped: () => api.get('/api/identity/permissions'),
}

export const portfolioApi = {
  // The projects the caller may see (Portfolio.View); archived ones only on request.
  projects: ({ status, search, includeArchived = false } = {}) => {
    const query = new URLSearchParams()
    if (status) query.set('status', status)
    if (search) query.set('search', search)
    if (includeArchived) query.set('includeArchived', 'true')
    const qs = query.toString()
    return api.get(`/api/portfolio/projects${qs ? `?${qs}` : ''}`)
  },
}

export const reportingApi = {
  // Own dashboard (Reporting.View).
  me: () => api.get('/api/reporting/me'),
  // Organisation-wide summary (Reporting.ViewAll).
  summary: (organizationUnitId) =>
    api.get(`/api/reporting/summary${organizationUnitId ? `?organizationUnitId=${organizationUnitId}` : ''}`),
}

export const platformApi = {
  // action: a prefix the Core filters on (e.g. "identity.login" = successful and failed sign-ins).
  auditLogs: ({ tenantId, pageNumber = 1, pageSize = 30, action, search, sort } = {}) => {
    const query = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
    if (tenantId) query.set('tenantId', tenantId)
    if (action) query.set('action', action)
    if (search) query.set('search', search)
    if (sort) query.set('sort', sort)
    return api.get(`/api/platform/audit-logs?${query.toString()}`)
  },
}

/**
 * Persian labels for the Core permission catalogue. The Core stores English
 * descriptions; this map keeps the UI readable without changing the backend.
 * Unknown keys fall back to the Core description.
 */
export const permissionLabels = {
  'users.view': 'مشاهده فهرست کاربران',
  'users.create': 'ایجاد کاربر جدید',
  'users.update': 'ویرایش و فعال/غیرفعال کردن کاربر',
  'users.assign_roles': 'اختصاص سمت سازمانی به کاربر',
  'users.assign_permissions': 'اختصاص دسترسی مستقیم به کاربر',
  'roles.view': 'مشاهده سمت‌های سازمانی',
  'roles.create': 'ایجاد سمت سازمانی',
  'roles.update': 'ویرایش سمت سازمانی',
  'roles.assign_permissions': 'تعیین دسترسی‌های سمت سازمانی',
  'permissions.view': 'مشاهده فهرست دسترسی‌ها',
  'org_chart.view': 'مشاهده چارت سازمانی',
  'groups.view': 'مشاهده گروه‌های کاربری',
  'groups.create': 'ایجاد گروه کاربری',
  'groups.update': 'ویرایش گروه کاربری',
  'groups.assign_permissions': 'تعیین دسترسی‌های گروه',
  'groups.manage_members': 'افزودن و حذف اعضای گروه',
  'tenants.view': 'مشاهده سازمان‌ها',
  'tenants.create': 'ایجاد سازمان',
  'audit_logs.view': 'مشاهده گزارش رویدادها و تاریخچه ورود',
  'settings.view': 'مشاهده تنظیمات سامانه',
  'settings.update': 'تغییر تنظیمات سامانه',
}

export const moduleLabels = {
  Identity: 'کاربران و دسترسی‌ها',
  Platform: 'سامانه و گزارش‌ها',
}

export const labelForPermission = (permission) =>
  permissionLabels[permission?.name] || permission?.description || permission?.name || ''

export const labelForModule = (module) => moduleLabels[module] || module

export const chatApi = {
  conversations: () => api.get('/api/chat/conversations/'),
  messages: (conversationId, page = 1, pageSize = 50) =>
    api.get(`/api/chat/conversations/${conversationId}/messages?page=${page}&pageSize=${pageSize}`),
  createDirect: (otherUserId) => api.post('/api/chat/conversations/direct', { otherUserId }),
  createGroup: (title, participantIds) =>
    api.post('/api/chat/conversations/group', { title, participantIds }),
  unreadCount: () => api.get('/api/chat/conversations/unread-count'),
  send: (conversationId, text) => api.post('/api/chat/messages', { conversationId, text, senderUserId: null }),
}

export const notificationsApi = {
  list: (pageNumber = 1, pageSize = 20) =>
    api.get(`/api/notifications/?pageNumber=${pageNumber}&pageSize=${pageSize}`),
  unreadCount: () => api.get('/api/notifications/unread-count'),
  markAsRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllAsRead: () => api.put('/api/notifications/read-all'),
}

const projectQuery = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  return query.toString()
}

export const projectManagementApi = {
  projects: ({ tenantId, pageNumber = 1, pageSize = 20, search = '', type, status, organizationUnitId, managerUserId, sortBy, sortDescending } = {}) =>
    api.get(`/api/project-management/projects?${projectQuery({ tenantId, pageNumber, pageSize, search, type, status, organizationUnitId, managerUserId, sortBy, sortDescending })}`),
  createProject: (payload) => api.post('/api/project-management/projects', payload),
  project: (id) => api.get(`/api/project-management/projects/${id}`),
  agileTasks: ({ projectId, sprintNumber } = {}) =>
    api.get(`/api/project-management/agile/tasks?${projectQuery({ projectId, sprintNumber })}`),
  createAgileTask: (payload) => api.post('/api/project-management/agile/tasks', payload),
  waterfallActivities: (projectId) =>
    api.get(`/api/project-management/waterfall/activities?${projectQuery({ projectId })}`),
  createWaterfallActivity: (payload) => api.post('/api/project-management/waterfall/activities', payload),
  progressUpdates: (projectId) =>
    api.get(`/api/project-management/progress-updates?${projectQuery({ projectId })}`),
  createProgressUpdate: (payload) => api.post('/api/project-management/progress-updates', payload),
  documents: (projectId) =>
    api.get(`/api/project-management/documents?${projectQuery({ projectId })}`),
  uploadDocument: ({ file, tenantId, projectId, description, documentType }) => {
    const form = new FormData()
    form.append('file', file)
    const query = projectQuery({ tenantId, projectId, description, documentType })
    return apiRequest(`/api/project-management/documents?${query}`, { method: 'POST', body: form })
  },
  deliverables: (projectId) =>
    api.get(`/api/project-management/deliverables?${projectQuery({ projectId })}`),
  createDeliverable: (payload) => api.post('/api/project-management/deliverables', payload),
  kpis: ({ projectId, deliverableId } = {}) =>
    api.get(`/api/project-management/kpis?${projectQuery({ projectId, deliverableId })}`),
  createKpi: (payload) => api.post('/api/project-management/kpis', payload),
  risks: (projectId) =>
    api.get(`/api/project-management/risks?${projectQuery({ projectId })}`),
  createRisk: (payload) => api.post('/api/project-management/risks', payload),
  updateRisk: (id, payload) => api.put(`/api/project-management/risks/${id}`, payload),
  deleteRisk: (id) => api.delete(`/api/project-management/risks/${id}`),
  submitRisk: (id) => api.post(`/api/project-management/risks/${id}/submit-for-approval`),
  // Where answering the risk stands (Planning / InProgress / OnHold / Completed = 0..3).
  setRiskResponseStatus: (id, status) => api.put(`/api/project-management/risks/${id}/response-status`, { status }),
  // The project's own wording of the six bands and colours of the 3x3 matrix (empty list = back to default).
  riskSettings: (projectId) => api.get(`/api/project-management/risks/settings?${projectQuery({ projectId })}`),
  saveRiskSettings: (payload) => api.put('/api/project-management/risks/settings', payload),
  // Reports on the answer to an approved risk (RiskResponse.Submit); a report waits for verification.
  riskResponseSubmissions: (riskId) => api.get(`/api/project-management/risks/response-submissions?${projectQuery({ riskId })}`),
  submitRiskResponse: (payload) => api.post('/api/project-management/risks/response-submissions', payload),
  stakeholders: (projectId) =>
    api.get(`/api/project-management/stakeholders?${projectQuery({ projectId })}`),
  createStakeholder: (payload) => api.post('/api/project-management/stakeholders', payload),
  updateStakeholder: (id, payload) => api.put(`/api/project-management/stakeholders/${id}`, payload),
  deleteStakeholder: (id) => api.delete(`/api/project-management/stakeholders/${id}`),
  submitStakeholder: (id) => api.post(`/api/project-management/stakeholders/${id}/submit-for-approval`),
  stakeholderSettings: (projectId) => api.get(`/api/project-management/stakeholders/settings?${projectQuery({ projectId })}`),
  saveStakeholderSettings: (payload) => api.put('/api/project-management/stakeholders/settings', payload),
  teamMembers: (projectId) =>
    api.get(`/api/project-management/team/members?${projectQuery({ projectId })}`),
  addTeamMember: (payload) => api.post('/api/project-management/team/members', payload),
  updateTeamMember: (id, payload) => api.put(`/api/project-management/team/members/${id}`, payload),
  removeTeamMember: (id) => api.delete(`/api/project-management/team/members/${id}`),
  // The whole team in one go: people left out are removed, new ones join without a role title.
  setTeam: (payload) => api.put('/api/project-management/team/members/set', payload),
  // The users the caller may put on this project's team.
  availableTeamUsers: (projectId) => api.get(`/api/project-management/team/members/available-users?${projectQuery({ projectId })}`),
  governanceRoles: (projectId) =>
    api.get(`/api/project-management/team/governance-roles?${projectQuery({ projectId })}`),
  createGovernanceRole: (payload) => api.post('/api/project-management/team/governance-roles', payload),
  updateGovernanceRole: (id, payload) => api.put(`/api/project-management/team/governance-roles/${id}`, payload),
  deleteGovernanceRole: (id) => api.delete(`/api/project-management/team/governance-roles/${id}`),
  myDashboard: (tenantId) =>
    api.get(`/api/reporting/me?${projectQuery({ tenantId })}`),
  projectDashboard: (projectId) =>
    api.get(`/api/reporting/projects/${projectId}`),
}

// Core returns Result<T> for these; unwrap to the payload.
export const unwrap = (result, fallback = null) => {
  if (!result?.isSuccess) return fallback
  const value = result.value
  if (value && typeof value === 'object' && 'isSuccess' in value && 'value' in value) {
    return value.isSuccess ? value.value : fallback
  }
  return value ?? fallback
}
