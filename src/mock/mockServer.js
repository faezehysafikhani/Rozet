import { AuthTokenStore } from '../services/authStore'
import { emit } from './bus'
import { getDb, newId, saveDb } from './db'

/**
 * In-browser replacement for the Core API. services/api.js hands every request here when
 * USE_MOCK is on, and gets back the same { isSuccess, value, error, status } envelope.
 * State lives in localStorage (see db.js); nothing leaves the browser.
 */

const ok = (value, status = 200) => ({ isSuccess: true, value, status })
const fail = (status, error) => ({ isSuccess: false, error, status })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const nowIso = () => new Date().toISOString()
const pick = (list) => list[Math.floor(Math.random() * list.length)]

/* ------------------------------ auth / permissions ------------------------------ */

const tokenFor = (userId) => `mock.${userId}`

function sessionUser(db) {
  const match = /^mock\.(.+)$/.exec(AuthTokenStore.getAccessToken() || '')
  if (!match) return null
  const user = db.users.find((u) => u.id === match[1])
  return user && user.isActive ? user : null
}

// Same idea as the Core: holding an "edit" permission silently unlocks the "view" screens it needs.
const IMPLIED = {
  'users.create': ['users.view'],
  'users.update': ['users.view'],
  'users.assign_roles': ['users.view', 'roles.view'],
  'users.assign_permissions': ['users.view', 'permissions.view'],
  'roles.create': ['roles.view'],
  'roles.update': ['roles.view'],
  'roles.assign_permissions': ['roles.view', 'permissions.view'],
  'groups.create': ['groups.view'],
  'groups.update': ['groups.view'],
  'groups.assign_permissions': ['groups.view', 'permissions.view'],
  'groups.manage_members': ['groups.view', 'users.view'],
}

/** Per permission name: which sources (roles / groups / direct) grant it to this user. */
function grantSources(db, user) {
  const sources = new Map() // name -> { roles:Set, groups:Set, direct:bool }
  const entry = (name) => {
    if (!sources.has(name)) sources.set(name, { roles: new Set(), groups: new Set(), direct: false })
    return sources.get(name)
  }
  for (const role of db.roles.filter((r) => user.roleIds.includes(r.id))) {
    role.permissions.forEach((name) => entry(name).roles.add(role.name))
  }
  for (const group of db.groups.filter((g) => g.isActive && g.memberIds.includes(user.id))) {
    group.permissionIds
      .map((pid) => db.permissions.find((p) => p.id === pid)?.name)
      .filter(Boolean)
      .forEach((name) => entry(name).groups.add(group.name))
  }
  for (const pid of user.directPermissionIds) {
    const name = db.permissions.find((p) => p.id === pid)?.name
    if (name) entry(name).direct = true
  }
  return sources
}

function permissionsOf(db, user) {
  const granted = [...grantSources(db, user).keys()]
  const effective = new Set(granted)
  granted.forEach((name) => (IMPLIED[name] || []).forEach((implied) => effective.add(implied)))
  return { granted, effective: [...effective] }
}

const roleNamesOf = (db, user) => db.roles.filter((r) => user.roleIds.includes(r.id)).map((r) => r.name)

const sessionUserDto = (db, user) => ({
  id: user.id, tenantId: user.tenantId, email: user.email, displayName: user.displayName,
  isActive: user.isActive, roles: roleNamesOf(db, user),
})

const listUserDto = (db, user) => ({ ...sessionUserDto(db, user), lastLoginAtUtc: user.lastLoginAtUtc })

function audit(db, action, userId, details = null) {
  db.auditLogs.unshift({
    id: newId(), tenantId: db.tenant.id, action, userId, occurredAtUtc: nowIso(),
    ipAddress: `192.168.100.${10 + Math.floor(Math.random() * 80)}`, details,
  })
  db.auditLogs.length = Math.min(db.auditLogs.length, 300)
}

const REPLIES = [
  'سلام، دریافت شد 👍', 'ممنون از اطلاع‌رسانی؛ بررسی می‌کنم و خبر می‌دهم.', 'باشه، تا پایان روز هماهنگ می‌کنم.',
  'عالیه! لطفاً فایل نهایی را هم ارسال کنید.', 'در جلسه فردا درباره‌اش صحبت می‌کنیم.', 'متوجه شدم، پیگیری می‌کنم.',
]

/* ------------------------------ helpers ------------------------------ */

function paged(items, query) {
  const pageNumber = Math.max(1, Number(query.get('pageNumber')) || 1)
  const pageSize = Math.max(1, Number(query.get('pageSize')) || 20)
  const start = (pageNumber - 1) * pageSize
  return { items: items.slice(start, start + pageSize), totalCount: items.length, pageNumber, pageSize }
}

const matches = (text, term) => String(text || '').toLowerCase().includes(term.toLowerCase())

/* ------------------------------ routes ------------------------------ */

function buildRouter() {
  const routes = []
  // route('GET', '/api/identity/users/:id', (ctx) => ...) - ':x' segments become ctx.params.x
  const route = (method, pattern, handler, { anonymous = false } = {}) => {
    const keys = []
    const regex = new RegExp(`^${pattern.replace(/:([a-zA-Z]+)/g, (_m, key) => { keys.push(key); return '([^/]+)' })}$`)
    routes.push({ method, regex, keys, handler, anonymous })
  }

  /* ---------------- identity: auth ---------------- */

  route('POST', '/api/identity/auth/login', ({ db, body }) => {
    const email = String(body.email || '').trim().toLowerCase()
    const user = db.users.find((u) => u.email.toLowerCase() === email)
    if (!user || user.password !== body.password) {
      if (user) audit(db, 'identity.login_failed', user.id, 'رمز عبور نادرست')
      return fail(401, 'Invalid email or password')
    }
    if (!user.isActive) return fail(401, 'حساب کاربری شما غیرفعال شده است.')
    user.lastLoginAtUtc = nowIso()
    audit(db, 'identity.login', user.id, 'ورود به سامانه')
    return ok({
      accessToken: tokenFor(user.id),
      refreshToken: `mock-refresh.${user.id}`,
      accessTokenExpiresAtUtc: null,
      user: sessionUserDto(db, user),
    })
  }, { anonymous: true })

  route('POST', '/api/identity/auth/refresh', ({ db, body }) => {
    const match = /^mock-refresh\.(.+)$/.exec(body.refreshToken || '')
    const user = match && db.users.find((u) => u.id === match[1] && u.isActive)
    if (!user) return fail(401, 'Invalid refresh token')
    return ok({ accessToken: tokenFor(user.id), refreshToken: body.refreshToken, accessTokenExpiresAtUtc: null, user: sessionUserDto(db, user) })
  }, { anonymous: true })

  route('GET', '/api/identity/auth/me', ({ db, me }) => {
    const { granted, effective } = permissionsOf(db, me)
    return ok({ user: sessionUserDto(db, me), permissions: effective, grantedPermissions: granted })
  })

  route('POST', '/api/identity/auth/forgot-password', ({ db, body }) => {
    const email = String(body.email || '').trim().toLowerCase()
    const user = db.users.find((u) => u.email.toLowerCase() === email)
    // Like the Core: never reveal whether the account exists. In demo mode the token is echoed
    // back (PasswordReset:ReturnTokenInResponse) so the flow works without a mail server.
    if (!user) return ok({})
    const resetToken = `demo-${newId().slice(0, 8)}`
    db.resetTokens[resetToken] = user.id
    audit(db, 'identity.forgot_password', user.id, 'درخواست بازیابی رمز عبور')
    return ok({ resetToken })
  }, { anonymous: true })

  route('POST', '/api/identity/auth/reset-password', ({ db, body }) => {
    const userId = db.resetTokens[body.token]
    const user = userId && db.users.find((u) => u.id === userId)
    if (!user) return fail(400, 'The token is invalid, expired or has already been used.')
    if (String(body.newPassword || '').length < 8) return fail(400, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
    user.password = body.newPassword
    delete db.resetTokens[body.token]
    audit(db, 'identity.reset_password', user.id, 'تغییر رمز عبور')
    return ok(null, 204)
  }, { anonymous: true })

  /* ---------------- identity: users ---------------- */

  const guard = (me, db, permission) => {
    if (!permission) return null
    return permissionsOf(db, me).effective.includes(permission) ? null : fail(403, 'Forbidden')
  }

  route('GET', '/api/identity/users', ({ db, me, query }) => {
    const denied = guard(me, db, 'users.view'); if (denied) return denied
    const term = (query.get('search') || '').trim()
    const items = db.users
      .filter((u) => !term || matches(u.displayName, term) || matches(u.email, term))
      .map((u) => listUserDto(db, u))
    return ok(paged(items, query))
  })

  route('POST', '/api/identity/users', ({ db, me, body }) => {
    const denied = guard(me, db, 'users.create'); if (denied) return denied
    const email = String(body.email || '').trim()
    if (!email || !String(body.displayName || '').trim()) return fail(400, 'ایمیل و نام نمایشی الزامی است.')
    if (String(body.password || '').length < 8) return fail(400, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return fail(409, 'User already exists')
    const [firstName, ...rest] = body.displayName.trim().split(' ')
    const user = {
      id: newId(), tenantId: body.tenantId || db.tenant.id, email, displayName: body.displayName.trim(), password: body.password,
      isActive: body.isActive ?? true, roleIds: [], directPermissionIds: [], lastLoginAtUtc: null,
      profile: {
        firstName, lastName: rest.join(' '), nationalCode: '', birthDate: null, mobileNumber: '', phoneNumber: '',
        emergencyContactName: '', emergencyContactPhone: '', address: '', employeeCode: '', jobTitle: '', department: '',
        officeLocation: '', hireDate: null, employmentType: '', language: 'fa', timeZone: 'Asia/Tehran', notes: '',
      },
    }
    db.users.push(user)
    audit(db, 'users.create', me.id, `ایجاد کاربر ${user.displayName}`)
    return ok(listUserDto(db, user), 201)
  })

  route('GET', '/api/identity/users/:id', ({ db, me, params }) => {
    const denied = guard(me, db, 'users.view'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    return ok({ ...listUserDto(db, user), roleIds: user.roleIds, profile: user.profile })
  })

  route('PUT', '/api/identity/users/:id', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'users.update'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    if (!String(body.displayName || '').trim()) return fail(400, 'نام نمایشی نمی‌تواند خالی باشد.')
    if (user.id === me.id && body.isActive === false) return fail(400, 'نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.')
    user.displayName = body.displayName.trim()
    user.isActive = Boolean(body.isActive)
    audit(db, 'users.update', me.id, `ویرایش کاربر ${user.displayName}`)
    return ok(listUserDto(db, user))
  })

  route('PUT', '/api/identity/users/:id/profile', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'users.update'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    user.profile = { ...user.profile, ...body }
    return ok(user.profile)
  })

  route('PUT', '/api/identity/users/:id/roles', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'users.assign_roles'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    user.roleIds = (body.roleIds || []).filter((rid) => db.roles.some((r) => r.id === rid))
    audit(db, 'users.assign_roles', me.id, `تغییر سمت «${user.displayName}»`)
    return ok(null, 204)
  })

  route('GET', '/api/identity/users/:id/permissions', ({ db, me, params }) => {
    const denied = guard(me, db, 'permissions.view'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    const sources = grantSources(db, user)
    return ok({
      userId: user.id, displayName: user.displayName, email: user.email, roles: roleNamesOf(db, user),
      permissions: db.permissions.map((p) => {
        const source = sources.get(p.name)
        return {
          permissionId: p.id, name: p.name, description: p.description, module: p.module,
          grantedDirectly: Boolean(source?.direct),
          grantedByRole: Boolean(source?.roles.size), grantingRoles: [...(source?.roles || [])],
          grantedByGroup: Boolean(source?.groups.size), grantingGroups: [...(source?.groups || [])],
        }
      }),
    })
  })

  route('PUT', '/api/identity/users/:id/permissions', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'users.assign_permissions'); if (denied) return denied
    const user = db.users.find((u) => u.id === params.id)
    if (!user) return fail(404, 'User not found')
    user.directPermissionIds = (body.permissionIds || []).filter((pid) => db.permissions.some((p) => p.id === pid))
    audit(db, 'users.assign_permissions', me.id, `تغییر دسترسی مستقیم «${user.displayName}»`)
    return ok(null, 204)
  })

  /* ---------------- identity: roles ---------------- */

  const roleDto = (role) => ({ ...role })

  // A role may not become its own ancestor.
  const createsCycle = (db, roleId, parentId) => {
    let cursor = parentId
    while (cursor) {
      if (cursor === roleId) return true
      cursor = db.roles.find((r) => r.id === cursor)?.parentRoleId
    }
    return false
  }

  route('GET', '/api/identity/roles', ({ db, me }) => {
    const denied = guard(me, db, 'roles.view'); if (denied) return denied
    return ok(db.roles.map(roleDto))
  })

  route('POST', '/api/identity/roles', ({ db, me, body }) => {
    const denied = guard(me, db, 'roles.create'); if (denied) return denied
    const name = String(body.name || '').trim()
    if (!name) return fail(400, 'عنوان سمت الزامی است.')
    if (db.roles.some((r) => r.name === name)) return fail(409, 'Role already exists')
    const role = { id: newId(), tenantId: db.tenant.id, name, description: body.description || null, parentRoleId: body.parentRoleId || null, isSystem: false, permissions: [] }
    db.roles.push(role)
    audit(db, 'roles.create', me.id, `ایجاد سمت «${name}»`)
    return ok(roleDto(role), 201)
  })

  route('PUT', '/api/identity/roles/:id', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'roles.update'); if (denied) return denied
    const role = db.roles.find((r) => r.id === params.id)
    if (!role) return fail(404, 'Role not found')
    if (role.isSystem) return fail(400, 'سمت سیستمی قابل ویرایش نیست.')
    const name = String(body.name || '').trim()
    if (!name) return fail(400, 'عنوان سمت الزامی است.')
    if (body.parentRoleId && createsCycle(db, role.id, body.parentRoleId)) return fail(400, 'سمت بالادستی نمی‌تواند خودِ سمت یا زیرمجموعه‌ی آن باشد.')
    Object.assign(role, { name, description: body.description || null, parentRoleId: body.parentRoleId || null })
    audit(db, 'roles.update', me.id, `ویرایش سمت «${name}»`)
    return ok(roleDto(role))
  })

  route('PUT', '/api/identity/roles/:id/permissions', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'roles.assign_permissions'); if (denied) return denied
    const role = db.roles.find((r) => r.id === params.id)
    if (!role) return fail(404, 'Role not found')
    if (role.isSystem) return fail(400, 'دسترسی‌های سمت سیستمی قابل تغییر نیست.')
    role.permissions = (body.permissionIds || []).map((pid) => db.permissions.find((p) => p.id === pid)?.name).filter(Boolean)
    audit(db, 'roles.assign_permissions', me.id, `تغییر دسترسی‌های «${role.name}»`)
    return ok(null, 204)
  })

  /* ---------------- identity: groups ---------------- */

  const groupDto = (db, group) => ({
    id: group.id, tenantId: group.tenantId, name: group.name, description: group.description, isActive: group.isActive,
    memberCount: group.memberIds.length, permissionIds: group.permissionIds,
    members: group.memberIds.map((uid) => db.users.find((u) => u.id === uid)).filter(Boolean)
      .map((u) => ({ userId: u.id, displayName: u.displayName, email: u.email })),
  })

  route('GET', '/api/identity/groups', ({ db, me }) => {
    const denied = guard(me, db, 'groups.view'); if (denied) return denied
    return ok(db.groups.map((g) => groupDto(db, g)))
  })

  route('GET', '/api/identity/groups/:id', ({ db, me, params }) => {
    const denied = guard(me, db, 'groups.view'); if (denied) return denied
    const group = db.groups.find((g) => g.id === params.id)
    return group ? ok(groupDto(db, group)) : fail(404, 'Group not found')
  })

  route('POST', '/api/identity/groups', ({ db, me, body }) => {
    const denied = guard(me, db, 'groups.create'); if (denied) return denied
    const name = String(body.name || '').trim()
    if (!name) return fail(400, 'نام گروه الزامی است.')
    if (db.groups.some((g) => g.name === name)) return fail(409, 'Group already exists')
    const group = { id: newId(), tenantId: db.tenant.id, name, description: body.description || null, isActive: true, permissionIds: [], memberIds: [] }
    db.groups.push(group)
    return ok(groupDto(db, group), 201)
  })

  route('PUT', '/api/identity/groups/:id', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'groups.update'); if (denied) return denied
    const group = db.groups.find((g) => g.id === params.id)
    if (!group) return fail(404, 'Group not found')
    if (!String(body.name || '').trim()) return fail(400, 'نام گروه الزامی است.')
    Object.assign(group, { name: body.name.trim(), description: body.description || null, isActive: body.isActive ?? group.isActive })
    return ok(groupDto(db, group))
  })

  route('PUT', '/api/identity/groups/:id/permissions', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'groups.assign_permissions'); if (denied) return denied
    const group = db.groups.find((g) => g.id === params.id)
    if (!group) return fail(404, 'Group not found')
    group.permissionIds = (body.permissionIds || []).filter((pid) => db.permissions.some((p) => p.id === pid))
    return ok(null, 204)
  })

  route('PUT', '/api/identity/groups/:id/members', ({ db, me, params, body }) => {
    const denied = guard(me, db, 'groups.manage_members'); if (denied) return denied
    const group = db.groups.find((g) => g.id === params.id)
    if (!group) return fail(404, 'Group not found')
    group.memberIds = (body.userIds || []).filter((uid) => db.users.some((u) => u.id === uid))
    return ok(null, 204)
  })

  /* ---------------- identity: org chart, permissions, audit ---------------- */

  route('GET', '/api/identity/org-chart', ({ db, me }) => {
    const denied = guard(me, db, 'org_chart.view'); if (denied) return denied
    const memberDto = (u) => ({
      userId: u.id, displayName: u.displayName, email: u.email, isActive: u.isActive,
      jobTitle: u.profile.jobTitle || null, department: u.profile.department || null,
    })
    const build = (role) => {
      const members = db.users.filter((u) => u.roleIds.includes(role.id)).map(memberDto)
      return {
        roleId: role.id, name: role.name, description: role.description, memberCount: members.length, members,
        children: db.roles.filter((r) => r.parentRoleId === role.id).map(build),
      }
    }
    const roleIds = new Set(db.roles.map((r) => r.id))
    const roots = db.roles.filter((r) => !r.parentRoleId || !roleIds.has(r.parentRoleId)).map(build)
    return ok({
      tenantName: db.tenant.name,
      totalRoles: db.roles.length,
      totalMembers: db.users.filter((u) => u.roleIds.length).length,
      roots,
      unassigned: db.users.filter((u) => !u.roleIds.length).map(memberDto),
    })
  })

  route('GET', '/api/identity/permissions', ({ db, me }) => {
    const denied = guard(me, db, 'permissions.view'); if (denied) return denied
    const byModule = new Map()
    db.permissions.forEach((p) => {
      if (!byModule.has(p.module)) byModule.set(p.module, [])
      byModule.get(p.module).push({ id: p.id, name: p.name, description: p.description, module: p.module })
    })
    return ok([...byModule].map(([module, permissions]) => ({ module, permissions })))
  })

  route('GET', '/api/platform/audit-logs', ({ db, me, query }) => {
    const denied = guard(me, db, 'audit_logs.view'); if (denied) return denied
    return ok(paged(db.auditLogs, query))
  })

  /* ---------------- chat ---------------- */

  const myConversations = (db, me) => db.conversations.filter((c) => c.participantIds.includes(me.id))
  const unreadIn = (db, me, conversationId) =>
    db.messages.filter((m) => m.conversationId === conversationId && m.senderUserId !== me.id && !m.readBy.includes(me.id)).length

  route('GET', '/api/chat/conversations', ({ db, me }) => ok(
    myConversations(db, me)
      .sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)))
      .map((c) => ({ ...c, unreadCount: unreadIn(db, me, c.id) })),
  ))

  route('GET', '/api/chat/conversations/unread-count', ({ db, me }) =>
    ok(myConversations(db, me).reduce((sum, c) => sum + unreadIn(db, me, c.id), 0)))

  route('GET', '/api/chat/conversations/:id/messages', ({ db, me, params, query }) => {
    const conversation = db.conversations.find((c) => c.id === params.id)
    if (!conversation) return fail(404, 'Conversation not found')
    if (!conversation.participantIds.includes(me.id)) return fail(403, 'You are not a participant of this conversation')
    const page = Math.max(1, Number(query.get('page')) || 1)
    const pageSize = Math.max(1, Number(query.get('pageSize')) || 50)
    const all = db.messages.filter((m) => m.conversationId === conversation.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt))
    all.forEach((m) => { if (!m.readBy.includes(me.id)) m.readBy.push(me.id) })
    return ok(all.slice(Math.max(0, all.length - page * pageSize), all.length - (page - 1) * pageSize).map((m) => ({
      id: m.id, senderUserId: m.senderUserId, text: m.text, sentAt: m.sentAt,
      isOwnMessage: m.senderUserId === me.id, isRead: m.readBy.length > 1,
    })))
  })

  route('POST', '/api/chat/conversations/direct', ({ db, me, body }) => {
    const other = db.users.find((u) => u.id === body.otherUserId)
    if (!other) return fail(404, 'User not found')
    const existing = myConversations(db, me).find((c) => c.participantIds.includes(other.id))
    if (existing) return ok(existing.id)
    const conversation = { id: newId(), type: 'Direct', title: null, participantIds: [me.id, other.id], lastMessage: '', lastMessageAt: null }
    db.conversations.push(conversation)
    return ok(conversation.id, 201)
  })

  route('POST', '/api/chat/conversations/group', () => fail(400, 'گفت‌وگوی گروهی در حالت نمایشی پشتیبانی نمی‌شود.'))

  route('POST', '/api/chat/messages', ({ db, me, body }) => {
    const conversation = db.conversations.find((c) => c.id === body.conversationId)
    if (!conversation) return fail(404, 'Conversation not found')
    if (!conversation.participantIds.includes(me.id)) return fail(403, 'You are not a participant of this conversation')
    const text = String(body.text || '').trim()
    if (!text) return fail(400, 'متن پیام نمی‌تواند خالی باشد.')

    const message = { id: newId(), conversationId: conversation.id, senderUserId: me.id, text, sentAt: nowIso(), readBy: [me.id] }
    db.messages.push(message)
    conversation.lastMessage = text
    conversation.lastMessageAt = message.sentAt

    // Server push to the sender's own tabs/devices (the hook de-duplicates by id).
    emit('chat', 'MessageReceived', { id: message.id, conversationId: conversation.id, senderUserId: me.id, text, sentAt: message.sentAt })
    scheduleReply(conversation.id, me.id)
    return ok(message.id, 201)
  })

  /* ---------------- notifications ---------------- */

  const myNotifications = (db, me) => db.notifications
    .filter((n) => n.userId === me.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  route('GET', '/api/notifications', ({ db, me, query }) => ok(paged(myNotifications(db, me), query).items))
  route('GET', '/api/notifications/unread-count', ({ db, me }) => ok(myNotifications(db, me).filter((n) => !n.isRead).length))
  route('PUT', '/api/notifications/read-all', ({ db, me }) => {
    myNotifications(db, me).forEach((n) => { n.isRead = true })
    return ok(null, 204)
  })
  route('PUT', '/api/notifications/:id/read', ({ db, me, params }) => {
    const notification = db.notifications.find((n) => n.id === params.id && n.userId === me.id)
    if (!notification) return fail(404, 'Notification not found')
    notification.isRead = true
    return ok(null, 204)
  })

  /* ---------------- project management ---------------- */

  const pm = '/api/project-management'
  const byProject = (list, query) => {
    const projectId = query.get('projectId')
    return projectId ? list.filter((item) => item.projectId === projectId) : list
  }
  const requireProject = (db, body) => (db.projects.some((p) => p.id === body.projectId) ? null : fail(404, 'Project not found'))

  /** Registers GET (list, filtered by projectId) + POST (create) for a simple project child collection. */
  const collection = (path, key, { prepare, label, customList = false } = {}) => {
    if (!customList) route('GET', `${pm}/${path}`, ({ db, query }) => ok(byProject(db[key], query)))
    route('POST', `${pm}/${path}`, ({ db, me, body }) => {
      const missing = requireProject(db, body); if (missing) return missing
      const item = { ...(prepare ? prepare(body, db) : body), id: newId(), tenantId: body.tenantId || db.tenant.id, createdBy: me.id }
      db[key].push(item)
      if (label) audit(db, `project.${key}.create`, me.id, `${label}: ${item.title || item.name || item.description || ''}`.slice(0, 120))
      return ok(item, 201)
    })
  }

  route('GET', `${pm}/projects`, ({ db, query }) => {
    const term = (query.get('search') || '').trim()
    const type = query.get('type'); const status = query.get('status')
    let items = db.projects.filter((p) =>
      (!term || matches(p.name, term) || matches(p.code, term)) &&
      (type === null || String(p.type) === type) &&
      (status === null || String(p.status) === status))
    if (query.get('sortBy')) {
      const field = query.get('sortBy'); const dir = query.get('sortDescending') === 'true' ? -1 : 1
      items = [...items].sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * dir)
    }
    return ok(paged(items, query))
  })
  route('POST', `${pm}/projects`, ({ db, me, body }) => {
    if (!String(body.name || '').trim() || !String(body.code || '').trim()) return fail(400, 'نام و کد پروژه الزامی است.')
    if (db.projects.some((p) => p.code.toLowerCase() === body.code.trim().toLowerCase())) return fail(409, 'Project code already exists')
    const project = {
      ...body, id: newId(), tenantId: body.tenantId || db.tenant.id, name: body.name.trim(), code: body.code.trim(),
      status: 0, managerUserId: body.managerUserId || me.id, ownerUserId: body.ownerUserId || me.id, createdAt: nowIso(),
    }
    db.projects.push(project)
    audit(db, 'project.create', me.id, `ایجاد پروژه ${project.name}`)
    return ok(project, 201)
  })
  route('GET', `${pm}/projects/:id`, ({ db, params }) => {
    const project = db.projects.find((p) => p.id === params.id)
    return project ? ok(project) : fail(404, 'Project not found')
  })

  collection('agile/tasks', 'tasks', { prepare: (b) => ({ ...b, status: 0, createdAt: nowIso() }), label: 'وظیفه', customList: true })
  route('GET', `${pm}/agile/tasks`, ({ db, query }) => {
    const sprint = query.get('sprintNumber')
    return ok(byProject(db.tasks, query).filter((t) => sprint === null || String(t.sprintNumber) === sprint))
  })
  collection('waterfall/activities', 'activities', { prepare: (b) => ({ ...b, plannedProgress: 0, actualProgress: 0 }), label: 'فعالیت' })
  collection('progress-updates', 'progressUpdates', {
    prepare: (b) => {
      const deviation = Math.round((Number(b.actualProgress) - Number(b.plannedProgress)) * 10) / 10
      return { ...b, deviation, performanceClassification: deviation >= -2 ? 0 : deviation > -10 ? 1 : 2 }
    },
    label: 'گزارش پیشرفت',
  })
  collection('deliverables', 'deliverables', { prepare: (b) => ({ ...b, status: 0 }), label: 'خروجی' })
  collection('kpis', 'kpis', { label: 'KPI', customList: true })
  route('GET', `${pm}/kpis`, ({ db, query }) => {
    const deliverableId = query.get('deliverableId')
    return ok(byProject(db.kpis, query).filter((k) => !deliverableId || k.deliverableId === deliverableId))
  })
  collection('risks', 'risks', {
    prepare: (b) => ({ ...b, rpn: Number(b.probabilityScore) * Number(b.severityScore) * Number(b.impactScore) }),
    label: 'ریسک',
  })
  collection('stakeholders', 'stakeholders', { label: 'ذینفع' })
  collection('team/members', 'teamMembers')
  collection('team/governance-roles', 'governanceRoles')

  route('GET', `${pm}/documents`, ({ db, query }) => ok(byProject(db.documents, query)))
  route('POST', `${pm}/documents`, ({ db, me, query, body }) => {
    const projectId = query.get('projectId')
    if (!db.projects.some((p) => p.id === projectId)) return fail(404, 'Project not found')
    const file = body instanceof FormData ? body.get('file') : null
    if (!file) return fail(400, 'فایل سند الزامی است.')
    // Only the metadata is kept: file bytes would blow through the localStorage quota.
    const document = {
      id: newId(), tenantId: query.get('tenantId') || db.tenant.id, projectId,
      description: query.get('description') || file.name, documentType: Number(query.get('documentType') || 0),
      fileName: file.name, sizeBytes: file.size, registerDate: nowIso().slice(0, 10), approvalStatus: 0,
    }
    db.documents.push(document)
    audit(db, 'project.documents.create', me.id, `آپلود سند ${file.name}`)
    return ok(document, 201)
  })

  // Dashboards are not rendered anywhere yet; return a small summary so the endpoints exist.
  route('GET', '/api/reporting/me', ({ db, me }) => ok({
    openTasks: db.tasks.filter((t) => t.responsibleUserId === me.id && t.status !== 2).length,
    projects: db.projects.filter((p) => p.managerUserId === me.id).length,
  }))
  route('GET', '/api/reporting/projects/:id', ({ db, params }) => {
    const project = db.projects.find((p) => p.id === params.id)
    if (!project) return fail(404, 'Project not found')
    return ok({ project, tasks: db.tasks.filter((t) => t.projectId === project.id).length, risks: db.risks.filter((r) => r.projectId === project.id).length })
  })

  return routes
}

const routes = buildRouter()

/* ------------------------------ simulated colleague ------------------------------ */

function scheduleReply(conversationId, senderId) {
  setTimeout(() => {
    const db = getDb()
    const conversation = db.conversations.find((c) => c.id === conversationId)
    const peerId = conversation?.participantIds.find((id) => id !== senderId)
    const peer = db.users.find((u) => u.id === peerId)
    // Only a still-signed-in sender gets an answer, and never from a deactivated colleague.
    if (!peer || !peer.isActive || sessionUser(db)?.id !== senderId) return

    const reply = { id: newId(), conversationId, senderUserId: peer.id, text: pick(REPLIES), sentAt: nowIso(), readBy: [peer.id] }
    db.messages.push(reply)
    conversation.lastMessage = reply.text
    conversation.lastMessageAt = reply.sentAt

    const notification = {
      id: newId(), userId: senderId, title: `پیام جدید از ${peer.displayName}`, message: reply.text, isRead: false, createdAt: reply.sentAt,
    }
    db.notifications.unshift(notification)
    saveDb()

    emit('chat', 'MessageReceived', { id: reply.id, conversationId, senderUserId: peer.id, text: reply.text, sentAt: reply.sentAt })
    emit('notifications', 'NotificationReceived', {
      id: notification.id, title: notification.title, message: notification.message, isRead: false, createdAt: notification.createdAt,
    })
  }, 1800 + Math.random() * 1700)
}

/** Handy for a live demo: pops a notification into the bell of whoever is signed in. */
export function pushDemoNotification(title = 'اعلان آزمایشی', message = 'این یک اعلان نمایشی است.') {
  const db = getDb()
  const me = sessionUser(db)
  if (!me) return null
  const notification = { id: newId(), userId: me.id, title, message, isRead: false, createdAt: nowIso() }
  db.notifications.unshift(notification)
  saveDb()
  emit('notifications', 'NotificationReceived', { id: notification.id, title, message, isRead: false, createdAt: notification.createdAt })
  return notification
}

/* ------------------------------ entry point ------------------------------ */

export async function mockRequest(endpoint, options = {}, { anonymous = false } = {}) {
  await wait(80 + Math.random() * 120) // a little latency so loading states are visible

  const url = new URL(endpoint, 'http://mock.local')
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = (options.method || 'GET').toUpperCase()

  let body = options.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  body = body ?? {}

  for (const candidate of routes) {
    if (candidate.method !== method) continue
    const match = candidate.regex.exec(path)
    if (!match) continue

    const db = getDb()
    const me = sessionUser(db)
    if (!candidate.anonymous && !anonymous && !me) return fail(401, 'unauthorized')

    const params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]))
    try {
      const result = candidate.handler({ db, me, params, query: url.searchParams, body })
      if (method !== 'GET') saveDb()
      return result
    } catch (error) {
      console.error('Mock API error', method, path, error)
      return fail(500, 'خطای داخلی در حالت نمایشی')
    }
  }

  return fail(404, `Not found: ${method} ${path}`)
}
