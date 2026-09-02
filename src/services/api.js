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
    if (text.includes('not a participant')) return 'شما عضو این گفت‌وگو نیستید.'
    if (text.includes('access denied')) return 'به این گفت‌وگو دسترسی ندارید.'
    if (text.includes('invalid email or password')) return 'ایمیل یا رمز عبور نادرست است.'
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
      try {
        const body = await response.json()
        // Two shapes reach here: a ProblemDetails { title, detail } from ToApiResult(),
        // and a raw Result<T> { isSuccess, error: { code, message } } from the chat module.
        const raw = body.detail || body.error || body.message || body.title
        error = (raw && typeof raw === 'object' ? raw.message || raw.code : raw) || error
      } catch {
        const text = await response.text().catch(() => '')
        if (text) error = text
      }
      return { isSuccess: false, error, status: response.status }
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
  login: (email, password, tenantSlug) =>
    api.post('/api/identity/auth/login', { email, password, tenantSlug: tenantSlug || null }, { anonymous: true }),
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
  stakeholders: (projectId) =>
    api.get(`/api/project-management/stakeholders?${projectQuery({ projectId })}`),
  createStakeholder: (payload) => api.post('/api/project-management/stakeholders', payload),
  teamMembers: (projectId) =>
    api.get(`/api/project-management/team/members?${projectQuery({ projectId })}`),
  addTeamMember: (payload) => api.post('/api/project-management/team/members', payload),
  governanceRoles: (projectId) =>
    api.get(`/api/project-management/team/governance-roles?${projectQuery({ projectId })}`),
  createGovernanceRole: (payload) => api.post('/api/project-management/team/governance-roles', payload),
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
