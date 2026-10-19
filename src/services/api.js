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
    // Contracts, addenda, invoices and payments.
    if (text.includes('contract that is pending approval cannot be')) return 'قراردادی که در انتظار تأیید است نمی‌تواند ویرایش یا حذف شود.'
    if (text.includes('contract with approved or pending addenda cannot be deleted')) return 'قراردادی که الحاقیه‌ی تأییدشده یا در انتظار تأیید دارد حذف نمی‌شود.'
    if (text.includes('contract with invoices cannot be deleted')) return 'قراردادی که صورت‌وضعیت دارد حذف نمی‌شود.'
    if (text.includes('terminated contract cannot be amended')) return 'قرارداد فسخ‌شده الحاقیه نمی‌گیرد.'
    if (text.includes('terminated contract cannot be invoiced')) return 'برای قرارداد فسخ‌شده صورت‌وضعیت ثبت نمی‌شود.'
    if (text.includes('addenda can only be added to an approved contract')) return 'الحاقیه فقط به قراردادِ تأییدشده اضافه می‌شود.'
    if (text.includes('invoices can only be raised against an approved contract')) return 'صورت‌وضعیت فقط برای قراردادِ تأییدشده ثبت می‌شود.'
    if (text.includes('only an approved contract can leave draft')) return 'قرارداد تا تأیید نشده در وضعیت پیش‌نویس می‌ماند.'
    if (text.includes('addendum that is pending approval or approved cannot be')) return 'الحاقیه‌ی در انتظار تأیید یا تأییدشده ویرایش یا حذف نمی‌شود.'
    if (text.includes('invoice that is pending approval or approved cannot be edited')) return 'صورت‌وضعیتِ در انتظار تأیید یا تأییدشده ویرایش نمی‌شود.'
    if (text.includes('invoice that is pending approval, approved or paid cannot be deleted')) return 'صورت‌وضعیتِ در انتظار تأیید، تأییدشده یا پرداخت‌شده حذف نمی‌شود.'
    if (text.includes('payments can only be recorded against an approved invoice')) return 'پرداخت فقط برای صورت‌وضعیتِ تأییدشده ثبت می‌شود.'
    if (text.includes('addendum has already been submitted')) return 'این الحاقیه قبلاً برای تأیید ارسال شده است.'
    if (text.includes('contract has already been submitted')) return 'این قرارداد قبلاً برای تأیید ارسال شده است.'
    if (text.includes('invoice has already been submitted')) return 'این صورت‌وضعیت قبلاً برای تأیید ارسال شده است.'
    if (text.includes('addendum would reduce the contract below the amount already invoiced')) return 'این الحاقیه مبلغ قرارداد را از مبلغ صورت‌حساب‌شده کمتر می‌کند.'
    if (text.includes('amount of an approved contract can only change through an addendum')) return 'مبلغ قراردادِ تأییدشده فقط با الحاقیه تغییر می‌کند.'
    if (text.includes('contract already has an invoice with this number')) return 'در این قرارداد صورت‌وضعیتی با این شماره هست.'
    if (text.includes('invoice would take the total invoiced above the contract amount')) return 'جمع صورت‌وضعیت‌ها از مبلغ قرارداد بیشتر می‌شود.'
    if (text.includes('project already has a contract with this number')) return 'در این پروژه قراردادی با این شماره هست.'
    if (text.includes('addendum not found')) return 'الحاقیه پیدا نشد.'
    if (text.includes('contract not found')) return 'قرارداد پیدا نشد.'
    if (text.includes('invoice not found')) return 'صورت‌وضعیت پیدا نشد.'
    if (text.includes('addendum must change the amount')) return 'الحاقیه باید مبلغ یا مدت (یا هر دو) را تغییر دهد.'
    if (text.includes('end date cannot be before the start date')) return 'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.'
    if (text.includes('extension must be within')) return 'تمدید حداکثر ۳۶٬۵۰۰ روز است.'
    if (text.includes('the other party is required')) return 'طرف قرارداد را وارد کنید.'
    if (text.includes('paid amount must be between 0 and the invoice amount')) return 'مبلغ پرداخت‌شده باید بین صفر و مبلغ صورت‌وضعیت باشد.'
    if (text.includes('payment date cannot be before the invoice date')) return 'تاریخ پرداخت نمی‌تواند قبل از تاریخ صورت‌وضعیت باشد.'
    if (text.includes('payment date is required')) return 'تاریخ پرداخت را وارد کنید.'
    if (text.includes('contract number is required')) return 'شماره‌ی قرارداد را وارد کنید (حداکثر ۱۰۰ نویسه).'
    if (text.includes('invoice number is required')) return 'شماره‌ی صورت‌وضعیت را وارد کنید (حداکثر ۱۰۰ نویسه).'
    if (text.includes('the amount must be')) return 'مبلغ باید بالاتر از صفر و در محدوده‌ی مجاز (ریال) باشد.'
    if (text.includes('the amount change must be within')) return 'تغییر مبلغ از حد مجاز بیشتر است.'
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

export const usersApi = {
  // pageNumber/pageSize are non-nullable ints on the Core side - always send them.
  list: ({ tenantId, pageNumber = 1, pageSize = 50, search = '' } = {}) => {
    const query = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
    if (tenantId) query.set('tenantId', tenantId)
    if (search) query.set('search', search)
    return api.get(`/api/identity/users/?${query.toString()}`)
  },
  create: (payload) => api.post('/api/identity/users/', payload),
  update: (userId, payload) => api.put(`/api/identity/users/${userId}`, payload),
  detail: (userId) => api.get(`/api/identity/users/${userId}`),
  updateProfile: (userId, profile) => api.put(`/api/identity/users/${userId}/profile`, profile),
  assignRoles: (userId, roleIds) => api.put(`/api/identity/users/${userId}/roles`, { roleIds }),
  permissions: (userId) => api.get(`/api/identity/users/${userId}/permissions`),
  assignPermissions: (userId, permissionIds) =>
    api.put(`/api/identity/users/${userId}/permissions`, { permissionIds }),
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
  auditLogs: ({ tenantId, pageNumber = 1, pageSize = 30 } = {}) => {
    const query = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) })
    if (tenantId) query.set('tenantId', tenantId)
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

/**
 * Contracts, their addenda and invoices (project_contracts). Money is whole rials. Nothing counts as money until it is
 * approved, and the Core refuses edits to anything pending or approved - the screens mirror those rules but the Core decides.
 */
const contractsBase = '/api/project-management/contracts'
export const contractsApi = {
  // Every contract of the projects, each with its addenda and invoices, in one call: [{ contract, addenda, invoices }].
  forProjects: (projectIds) => api.post(`${contractsBase}/for-projects`, { projectIds }),
  summary: (projectId) => api.get(`${contractsBase}/summary?${projectQuery({ projectId })}`),
  create: (payload) => api.post(contractsBase, payload),
  update: (id, payload) => api.put(`${contractsBase}/${id}`, payload),
  // Draft = 0, Active = 1, Completed = 2, Terminated = 3; only an approved contract can leave Draft.
  setStatus: (id, status) => api.put(`${contractsBase}/${id}/status`, { status }),
  remove: (id) => api.delete(`${contractsBase}/${id}`),
  submit: (id) => api.post(`${contractsBase}/${id}/submit-for-approval`),
  createAddendum: (contractId, payload) => api.post(`${contractsBase}/${contractId}/addenda`, payload),
  updateAddendum: (contractId, id, payload) => api.put(`${contractsBase}/${contractId}/addenda/${id}`, payload),
  deleteAddendum: (contractId, id) => api.delete(`${contractsBase}/${contractId}/addenda/${id}`),
  submitAddendum: (contractId, id) => api.post(`${contractsBase}/${contractId}/addenda/${id}/submit-for-approval`),
  createInvoice: (contractId, payload) => api.post(`${contractsBase}/${contractId}/invoices`, payload),
  updateInvoice: (contractId, id, payload) => api.put(`${contractsBase}/${contractId}/invoices/${id}`, payload),
  deleteInvoice: (contractId, id) => api.delete(`${contractsBase}/${contractId}/invoices/${id}`),
  submitInvoice: (contractId, id) => api.post(`${contractsBase}/${contractId}/invoices/${id}/submit-for-approval`),
  // paidAmount is the invoice's TOTAL paid so far (not an increment); paymentDate is the date of the latest payment.
  recordPayment: (contractId, id, { paidAmount, paymentDate }) =>
    api.put(`${contractsBase}/${contractId}/invoices/${id}/payment`, { paidAmount, paymentDate }),
  // Milestones (NotStarted = 0, InProgress = 1, Completed = 2) and obligations (party Supplier = 0, Employer = 1; status Open = 0,
  // Fulfilled = 1, Breached = 2) of a contract. Reading needs Contracts.View, changing them Contracts.Edit.
  milestones: (contractId) => api.get(`${contractsBase}/${contractId}/milestones`),
  createMilestone: (contractId, payload) => api.post(`${contractsBase}/${contractId}/milestones`, payload),
  updateMilestone: (contractId, id, payload) => api.put(`${contractsBase}/${contractId}/milestones/${id}`, payload),
  deleteMilestone: (contractId, id) => api.delete(`${contractsBase}/${contractId}/milestones/${id}`),
  obligations: (contractId) => api.get(`${contractsBase}/${contractId}/obligations`),
  createObligation: (contractId, payload) => api.post(`${contractsBase}/${contractId}/obligations`, payload),
  updateObligation: (contractId, id, payload) => api.put(`${contractsBase}/${contractId}/obligations/${id}`, payload),
  deleteObligation: (contractId, id) => api.delete(`${contractsBase}/${contractId}/obligations/${id}`),
  // Links from the contract, one of its milestones or one of its obligations to a project document (kind 0) or an action (kind 1).
  // subjectType: Contract = 0, Milestone = 1, Obligation = 2 (subjectId is the milestone's / obligation's id; omit it for the contract).
  // The title is the target's name, kept as it was when linked.
  links: (contractId) => api.get(`${contractsBase}/${contractId}/links`),
  createLink: (contractId, payload) => api.post(`${contractsBase}/${contractId}/links`, payload),
  deleteLink: (contractId, id) => api.delete(`${contractsBase}/${contractId}/links/${id}`),
}

/** Actions of a project (the Actions module), to link them to a contract as evidence. */
export const actionsApi = {
  list: (projectId) => api.get(`/api/actions?${projectQuery({ projectId })}`),
}

/**
 * Suppliers (contractors, suppliers, consultants), kept once per tenant; a contract points at one. Category: Contractor = 0,
 * Supplier = 1, Consultant = 2, Other = 3; status: Active = 0, Inactive = 1. The list carries each supplier's figures
 * (approved contracts only); get adds its contracts. A supplier with contracts cannot be deleted.
 */
const suppliersBase = '/api/project-management/suppliers'
export const suppliersApi = {
  list: () => api.get(suppliersBase),
  // Every supplier across all projects with its figures, late items, scores and attention reasons (names such as 'LowScore').
  dashboard: () => api.get(`${suppliersBase}/dashboard`),
  get: (id) => api.get(`${suppliersBase}/${id}`),
  create: (payload) => api.post(suppliersBase, payload),
  update: (id, payload) => api.put(`${suppliersBase}/${id}`, payload),
  remove: (id) => api.delete(`${suppliersBase}/${id}`),
  // Periodic evaluations: four scores 1-5 (quality, timeliness, compliance, cooperation) for a period, optionally for one contract.
  // metrics is what the records say about that period (milestones due / late, obligations due / missed), shown before scoring.
  evaluations: (id) => api.get(`${suppliersBase}/${id}/evaluations`),
  evaluationMetrics: (id, { from, to, contractId }) => api.get(`${suppliersBase}/${id}/evaluation-metrics?${projectQuery({ from, to, contractId })}`),
  createEvaluation: (id, payload) => api.post(`${suppliersBase}/${id}/evaluations`, payload),
  updateEvaluation: (id, evaluationId, payload) => api.put(`${suppliersBase}/${id}/evaluations/${evaluationId}`, payload),
  deleteEvaluation: (id, evaluationId) => api.delete(`${suppliersBase}/${id}/evaluations/${evaluationId}`),
}

/** Cost against progress of one project (earned value) and the physical S-curve. */
export const costReportApi = {
  // Reporting.ViewAll sees any project; others see the projects they are a team member of, and need Contracts.View.
  // Budget = Project.Cost, actual cost = approved invoices; indexes are null when they cannot be worked out.
  performance: (projectId, asOf) =>
    api.get(`/api/reporting/projects/${projectId}/performance${asOf ? `?asOf=${asOf}` : ''}`),
  // PV / EV / AC over time (money), same access as performance.
  costCurve: (projectId, stepDays) =>
    api.get(`/api/reporting/projects/${projectId}/cost-curve${stepDays ? `?stepDays=${stepDays}` : ''}`),
  sCurve: (projectId, stepDays) =>
    api.get(`/api/project-management/waterfall/s-curve?${projectQuery({ projectId, stepDays })}`),
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
