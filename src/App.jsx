import { useEffect, useMemo, useRef, useState } from 'react'
import { apiBlobRequest, knowledgeApi, reportingApi } from './services/api'
import {
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  CheckCircle2,
  CheckCheck,
  CheckSquare2,
  ChevronLeft,
  CircleDollarSign,
  CircleDashed,
  CircleHelp,
  Clock3,
  Columns3,
  Eye,
  EyeOff,
  FileChartColumn,
  FileText,
  Filter,
  FolderOpen,
  Handshake,
  History,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  MessagesSquare,
  MessageCircle,
  MoreHorizontal,
  Network,
  Plus,
  Paperclip,
  Pencil,
  Presentation,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Truck,
  UserRound,
  UserCog,
  UserPlus,
  Users,
  Users2,
  UsersRound,
  Video,
  WalletCards,
  Workflow,
  X,
  Mail,
  Smartphone,
  SlidersHorizontal,
  Smile,
  LockKeyhole,
} from 'lucide-react'
import { AuthProvider, Can, useAuth } from './services/AuthContext'
import { PersianMessages, groupsApi, identityApi, labelForModule, labelForPermission, orgChartApi, permissionsApi, platformApi, projectManagementApi, rolesApi, unwrap, usersApi } from './services/api'
import { DEFAULT_TENANT_ID } from './services/config'
import { useChat } from './hooks/useChat'
import { useNotifications } from './hooks/useNotifications'
import { useDashboard } from './hooks/useDashboard'

// A sidebar entry is a container for several sections, so it is shown when ANY of the
// permissions below was granted - not just one hard-coded permission. Entries not listed
// here are always visible. Backend authorization is enforced independently of this map.
const menuPermissions = {
  'مدیریت کاربران': [
    'users.view', 'users.create', 'users.update', 'users.assign_roles', 'users.assign_permissions',
    'roles.view', 'roles.create', 'roles.update', 'roles.assign_permissions',
    'groups.view', 'groups.create', 'groups.update', 'groups.assign_permissions', 'groups.manage_members',
    'permissions.view', 'audit_logs.view', 'org_chart.view',
  ],
}

// Which granted permissions surface each section of the user-management screen.
const sectionPermissions = {
  users: ['users.view', 'users.create', 'users.update', 'users.assign_roles'],
  loginHistory: ['audit_logs.view'],
  access: [
    'roles.view', 'roles.create', 'roles.update', 'roles.assign_permissions',
    'groups.view', 'groups.create', 'groups.update', 'groups.assign_permissions', 'groups.manage_members',
    'permissions.view', 'users.assign_permissions',
  ],
  accessRole: ['roles.view', 'roles.create', 'roles.update', 'roles.assign_permissions'],
  accessGroup: ['groups.view', 'groups.create', 'groups.update', 'groups.assign_permissions', 'groups.manage_members'],
  accessUser: ['permissions.view', 'users.assign_permissions'],
  orgChart: ['org_chart.view'],
}

/** Shared pager for the user-management tables. */
function Pagination({ pageNumber, pageSize, totalCount, onChange }) {
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize))
  if (!totalCount) return null
  const from = (pageNumber - 1) * pageSize + 1
  const to = Math.min(pageNumber * pageSize, totalCount)

  return (
    <div className="table-pager">
      <span>نمایش {from} تا {to} از {totalCount} رکورد</span>
      <div>
        <button type="button" disabled={pageNumber <= 1} onClick={() => onChange(pageNumber - 1)}>قبلی</button>
        <b>صفحه {pageNumber} از {totalPages}</b>
        <button type="button" disabled={pageNumber >= totalPages} onClick={() => onChange(pageNumber + 1)}>بعدی</button>
      </div>
    </div>
  )
}

function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/)
  if (!parts[0]) return '؟'
  return parts.length > 1 ? `${parts[0][0]}\u200c${parts[1][0]}` : parts[0].slice(0, 2)
}

function formatDateTime(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(value)
  }
}

// Chat timestamps come from the Core as DateTime (UTC) with no timezone suffix, which
// JavaScript would otherwise read as local time. Only used by the chat page.
function formatTime(value) {
  if (!value) return ''
  try {
    const normalized = typeof value === 'string' && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(value)
      ? `${value}Z`
      : value
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

const taskSubmenus = [
  { label: 'داشبورد وظایف', icon: LayoutDashboard },
  { label: 'همه وظایف', icon: ListTodo },
  { label: 'برد کانبان', icon: Columns3 },
  { label: 'جلسات و صورت‌جلسات', icon: Presentation },
  { label: 'گردش کار و الگوها', icon: Workflow },
  { label: 'ماتریس مسئولیت‌ها (RACI)', icon: Network },
]

const projectSubmenus = [
  { label: 'برنامه‌ریزی پروژه', icon: CalendarRange },
  { label: 'تقویم پروژه', icon: CalendarDays },
  { label: 'کنترل پیشرفت پروژه', icon: TrendingUp },
  { label: 'مدیریت مستندات', icon: FolderOpen },
  { label: 'مدیریت استراتژیک پروژه‌ها', icon: Target },
]

const controlSubmenus = [
  { label: 'مدیریت ریسک', icon: TriangleAlert },
  { label: 'مدیریت منابع', icon: Users },
  { label: 'مدیریت هزینه', icon: CircleDollarSign },
  { label: 'مدیریت ذینفعان', icon: Handshake },
  { label: 'مدیریت تأمین‌کنندگان', icon: Truck },
  { label: 'مدیریت تغییرات', icon: RefreshCw },
]

const governanceSubmenus = [
  { label: '\u062F\u0627\u0634\u0628\u0648\u0631 \u06AF\u0632\u0627\u0631\u0634\u0627\u062A', icon: ChartNoAxesCombined },
  { label: 'مدیریت دانش', icon: BookOpen },
]

const systemSubmenus = [
  { label: 'چت و گفت‌وگوی آنلاین', icon: MessagesSquare },
  { label: 'مدیریت کاربران', icon: UsersRound },
  { label: 'تنظیمات', icon: Settings },
]

const menuItems = [
  { label: 'داشبورد اصلی', icon: LayoutDashboard },
  { label: 'مدیریت پروژه', icon: CalendarRange, children: projectSubmenus },
  { label: 'مدیریت وظایف', icon: CheckSquare2, children: taskSubmenus },
  { label: 'کنترل و اجرا', icon: SlidersHorizontal, children: controlSubmenus },
  { label: 'راهبری و دانش', icon: Target, children: governanceSubmenus },
  { label: 'ارتباطات و سیستم', icon: Settings, children: systemSubmenus },
]

const dashboardLabel = 'داشبورد اصلی'
const userProfileLabel = 'پروفایل کاربر'
const submenuLabels = menuItems.flatMap((item) => item.children || []).map((item) => item.label)

function isMenuItemActive(item, active) {
  return active === item.label || item.children?.some((child) => child.label === active)
}

function menuItemIsVisible(item, canReach) {
  if (item.children) return item.children.some((child) => canReach(menuPermissions[child.label]))
  return canReach(menuPermissions[item.label])
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`}>
      <img src="/assets/rozet-logo.png" alt="لوگو گروه اقتصادی روزت" />
      {!compact && <span>سامانه مدیریت یکپارچه</span>}
    </div>
  )
}

function Login({ onForgotPassword }) {
  const { signIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  // The Core signs in with a username or a mobile number (LoginRequest.Identifier), not an e-mail.
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // After a failed attempt the Core wants a CAPTCHA with the next one; each attempt uses it up.
  const [captcha, setCaptcha] = useState(null)
  const [captchaAnswer, setCaptchaAnswer] = useState('')

  async function loadCaptcha() {
    const result = await identityApi.captcha()
    const challenge = unwrap(result)
    if (challenge?.captchaId) {
      setCaptcha({ id: challenge.captchaId, image: challenge.imageDataUrl })
      setCaptchaAnswer('')
    } else {
      setCaptcha(null)
      setError(PersianMessages.error(result.error))
    }
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const result = await signIn(username.trim(), password, captcha ? { id: captcha.id, answer: captchaAnswer.trim() } : null)
    if (!result.ok) {
      setError(result.error)
      if (result.captchaRequired || captcha) await loadCaptcha()
    }
    setBusy(false)
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-visual" aria-label="معرفی سامانه روزت">
  <img
    src="/login-visual2.png"
    alt="سامانه روزت"
    className="login-visual-image"
  />
</section>

      <section className="login-panel">
        <div className="login-box">
          <Brand />
          <div className="login-heading">
            <h2>خوش آمدید</h2>
            <span>برای ادامه وارد حساب کاربری خود شوید.</span>
          </div>

          <form onSubmit={submit}>
            <label htmlFor="username">نام کاربری یا شماره موبایل</label>
            <div className="input-wrap">
              <UserRound size={20} />
              <input id="username" type="text" value={username} onChange={(event) => { setUsername(event.target.value); setError('') }} autoComplete="username" placeholder="نام کاربری یا شماره موبایل" required />
            </div>

            <div className="password-label">
              <label htmlFor="password">رمز عبور</label>
            </div>
            <div className="input-wrap">
              <ShieldCheck size={20} />
              <input id="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="رمز عبور" required />
              <button className="eye-btn" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="نمایش یا مخفی کردن رمز عبور">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {captcha && (
              <>
                <label htmlFor="captcha">کد امنیتی</label>
                <div className="captcha-row">
                  <div className="input-wrap">
                    <ShieldCheck size={20} />
                    <input id="captcha" value={captchaAnswer} onChange={(event) => { setCaptchaAnswer(event.target.value); setError('') }} autoComplete="off" maxLength={16} placeholder="کد داخل تصویر" required />
                  </div>
                  <img className="captcha-image" src={captcha.image} alt="تصویر کد امنیتی" />
                  <button className="captcha-refresh" type="button" onClick={loadCaptcha} aria-label="دریافت کد امنیتی جدید"><RefreshCw size={18} /></button>
                </div>
              </>
            )}

            <label className="check-row">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>مرا به خاطر بسپار</span>
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-btn" type="submit" disabled={busy}>{busy ? 'در حال ورود...' : 'ورود'}</button>
            <div className="login-divider"><span>یا</span></div>
            <button className="forgot-link" type="button" onClick={onForgotPassword}>رمز عبور خود را فراموش کرده‌اید؟</button>
          </form>
        </div>
      </section>
    </main>
  )
}

/** Shared chrome for the two password screens; reuses the login page styling. */
function AuthShell({ title, subtitle, children, onBack }) {
  return (
    <main className="login-page" dir="rtl">
      <section className="login-visual" aria-label="معرفی سامانه روزت">
        <section className="login-visual" aria-label="معرفی سامانه روزت">
  <img
    src="/login-visual2.png"
    alt="سامانه روزت"
    className="login-visual-image"
  />
</section>  
      </section>
      <section className="login-panel">
        <div className="login-box">
          <Brand />
          <div className="login-heading"><p>سامانه روزت</p><h2>{title}</h2><span>{subtitle}</span></div>
          {children}
          <p className="support-copy"><button type="button" onClick={onBack}>بازگشت به صفحه ورود</button></p>
        </div>
      </section>
    </main>
  )
}

function ForgotPassword({ onBack, onTokenIssued }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true); setError(''); setMessage('')
    const result = await identityApi.forgotPassword(email.trim())
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setMessage('در صورت وجود حساب، لینک بازیابی ارسال شد.')
    // Development convenience: the Core echoes the token when PasswordReset:ReturnTokenInResponse
    // is enabled, so the flow is testable without a mail server.
    if (result.value?.resetToken) onTokenIssued(result.value.resetToken)
  }

  return (
    <AuthShell title="بازیابی رمز عبور" subtitle="ایمیل حساب خود را وارد کنید." onBack={onBack}>
      <form onSubmit={submit}>
        <label htmlFor="reset-email">ایمیل</label>
        <div className="input-wrap">
          <Mail size={20} />
          <input id="reset-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} placeholder="name@company.ir" required />
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        {message && <p className="login-notice" role="status">{message}</p>}
        <button className="login-btn" type="submit" disabled={busy}>{busy ? 'در حال ارسال...' : 'ارسال لینک بازیابی'} <ChevronLeft size={20} /></button>
      </form>
    </AuthShell>
  )
}

function ResetPassword({ initialToken = '', onBack }) {
  const [token, setToken] = useState(initialToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (password !== confirm) { setError('رمز عبور و تکرار آن یکسان نیستند.'); return }
    if (password.length < 8) { setError('رمز عبور باید حداقل ۸ کاراکتر باشد.'); return }
    setBusy(true); setError('')
    const result = await identityApi.resetPassword(token.trim(), password)
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setDone(true)
  }

  if (done) {
    return (
      <AuthShell title="رمز عبور تغییر کرد" subtitle="اکنون می‌توانید با رمز جدید وارد شوید." onBack={onBack}>
        <p className="login-notice" role="status"><CheckCircle2 size={17} /> تمام نشست‌های قبلی شما باطل شدند.</p>
        <button className="login-btn" type="button" onClick={onBack}>ورود به سامانه <ChevronLeft size={20} /></button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="تعیین رمز عبور جدید" subtitle="توکن دریافتی و رمز جدید را وارد کنید." onBack={onBack}>
      <form onSubmit={submit}>
        <label htmlFor="reset-token">توکن بازیابی</label>
        <div className="input-wrap"><KeyRound size={20} /><input id="reset-token" value={token} onChange={(e) => { setToken(e.target.value); setError('') }} required /></div>
        <label htmlFor="new-password">رمز عبور جدید</label>
        <div className="input-wrap"><LockKeyhole size={20} /><input id="new-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} minLength={8} required /></div>
        <label htmlFor="confirm-password">تکرار رمز عبور</label>
        <div className="input-wrap"><LockKeyhole size={20} /><input id="confirm-password" type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError('') }} minLength={8} required /></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-btn" type="submit" disabled={busy}>{busy ? 'در حال ثبت...' : 'ثبت رمز جدید'} <ChevronLeft size={20} /></button>
      </form>
    </AuthShell>
  )
}

function Sidebar({ active, onSelect, open, onClose }) {
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(
    menuItems.filter((item) => item.children?.some((child) => child.label === active)).map((item) => [item.label, true])
  ))
  const { canReach, user } = useAuth()
  // Hiding an entry is a convenience only - the Core still refuses the call without the permission.
  const visibleItems = menuItems.filter((item) => menuItemIsVisible(item, canReach))
  const primaryRole = user?.roles?.[0] || 'بدون نقش'

  useEffect(() => {
    const activeParent = menuItems.find((item) => item.children?.some((child) => child.label === active))
    if (activeParent) setOpenGroups((current) => ({ ...current, [activeParent.label]: true }))
  }, [active])

  return (
    <>
      <button className={`sidebar-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-label="بستن منو" />
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-top"><Brand /><button className="sidebar-close" onClick={onClose}><X size={21} /></button></div>
        <div className="sidebar-account">
          <span className="avatar">{initialsOf(user?.displayName || user?.email)}</span>
          <div>
            <strong>{user?.displayName || 'کاربر روزت'}</strong>
            <small>{primaryRole}</small>
          </div>
        </div>
        <nav className="side-nav" aria-label="منوی اصلی">
          {visibleItems.map(({ label, icon: Icon, badge, children }) => (
            <div className="nav-group" key={label}>
              <button
                className={isMenuItemActive({ label, children }, active) ? 'active' : ''}
                onClick={() => {
                  if (children) {
                    setOpenGroups((current) => ({ ...current, [label]: !current[label] }))
                  } else {
                    onSelect(label)
                    onClose()
                  }
                }}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{label}</span>
                {badge && <em>{badge}</em>}
                {children && !badge && <ChevronLeft className={`nav-arrow ${openGroups[label] ? 'is-open' : ''}`} size={17} />}
              </button>
              {children && openGroups[label] && (
                <div className="sub-nav">
                  {children.filter((child) => canReach(menuPermissions[child.label])).map(({ label: childLabel, icon: ChildIcon }) => (
                    <button key={childLabel} className={active === childLabel ? 'active' : ''} onClick={() => { onSelect(childLabel); onClose() }}>
                      <ChildIcon size={16} />
                      <span>{childLabel}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

const sampleTasks = [
  { title: 'تکمیل برنامه زمان‌بندی فاز دوم', project: 'پروژه توسعه مرکز تجاری', owner: 'علی رضایی', due: '۵ شهریور ۱۴۰۵', priority: 'بالا', status: 'در حال انجام', progress: 65 },
  { title: 'بررسی و تأیید نقشه‌های اجرایی', project: 'پروژه برج اداری روزت', owner: 'مریم احمدی', due: '۷ شهریور ۱۴۰۵', priority: 'متوسط', status: 'نیازمند بررسی', progress: 80 },
  { title: 'تهیه گزارش هفتگی پیشرفت', project: 'پروژه مجتمع مسکونی آفتاب', owner: 'سینا محمدی', due: '۸ شهریور ۱۴۰۵', priority: 'بالا', status: 'برای انجام', progress: 20 },
  { title: 'هماهنگی جلسه با پیمانکار تأسیسات', project: 'پروژه توسعه مرکز تجاری', owner: 'زهرا کریمی', due: '۱۰ شهریور ۱۴۰۵', priority: 'کم', status: 'تکمیل شده', progress: 100 },
]

const enumLabel = (value, labels, fallback = 'نامشخص') => labels[value] ?? labels[String(value)] ?? fallback
const projectStatusLabels = { 0: 'پیش‌نویس', 1: 'فعال', 2: 'متوقف', 3: 'تکمیل شده', 4: 'آرشیو', Draft: 'پیش‌نویس', Active: 'فعال', OnHold: 'متوقف', Completed: 'تکمیل شده', Archived: 'آرشیو' }
const projectTypeLabels = { 0: 'آبشاری', 1: 'چابک', Waterfall: 'آبشاری', Agile: 'چابک' }
const agileStatusLabels = { 0: 'برای انجام', 1: 'در حال انجام', 2: 'تکمیل شده', ToDo: 'برای انجام', InProgress: 'در حال انجام', Done: 'تکمیل شده' }
const agilePriorityLabels = { 0: 'کم', 1: 'متوسط', 2: 'بالا', 3: 'بحرانی', Low: 'کم', Medium: 'متوسط', High: 'بالا', Critical: 'بحرانی' }
const approvalLabels = { 0: 'ثبت اولیه', 1: 'در انتظار تأیید', 2: 'تأیید شده', 3: 'رد شده', NotSubmitted: 'ثبت اولیه', PendingApproval: 'در انتظار تأیید', Approved: 'تأیید شده', Rejected: 'رد شده' }
const performanceLabels = { 0: 'طبق برنامه', 1: 'در معرض ریسک', 2: 'عقب‌افتاده', OnTrack: 'طبق برنامه', AtRisk: 'در معرض ریسک', Behind: 'عقب‌افتاده' }
const documentTypeLabels = { 0: 'گزارش', 1: 'نامه', 2: 'صورت‌جلسه', 3: 'سایر', Report: 'گزارش', Letter: 'نامه', MeetingMinutes: 'صورت‌جلسه', Other: 'سایر' }
const deliverableStatusLabels = { 0: 'باز', 1: 'در حال انجام', 2: 'تحویل شده', 3: 'پذیرفته شده', Open: 'باز', InProgress: 'در حال انجام', Delivered: 'تحویل شده', Accepted: 'پذیرفته شده' }
const stakeholderLevelLabels = { 0: 'کم', 1: 'متوسط', 2: 'زیاد', Low: 'کم', Medium: 'متوسط', High: 'زیاد' }
const kpiTypeLabels = { 0: 'کیفی', 1: 'کمی', Quality: 'کیفی', Quantity: 'کمی' }
const compactEnumLabel = (value, labels) => enumLabel(value, labels, value === undefined || value === null || value === '' ? '—' : String(value))

function arrayPayload(result) {
  const payload = unwrap(result)
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

function totalPayload(result, items) {
  const payload = unwrap(result)
  return payload?.totalCount ?? payload?.total ?? items.length
}

function formatDateOnly(value) {
  if (!value) return '—'
  try {
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('fa-IR')
  } catch {
    return String(value)
  }
}

function projectDisplayName(project) {
  if (!project) return '—'
  if (project.name && project.name !== 'string') return project.name
  if (project.code && project.code !== 'string') return `پروژه ${project.code}`
  return 'پروژه ثبت‌شده'
}

function formatBytes(value) {
  const size = Number(value || 0)
  if (!size) return '—'
  if (size < 1024) return `${size.toLocaleString('fa-IR')} بایت`
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString('fa-IR')} کیلوبایت`
  return `${(size / 1024 / 1024).toFixed(1).replace('.', '/')} مگابایت`
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function emptyToNull(value) {
  return value === undefined || value === null || value === '' ? null : value
}

function numberOrNull(value) {
  return value === undefined || value === null || value === '' ? null : Number(value)
}

function taskProgress(status) {
  const label = enumLabel(status, agileStatusLabels)
  if (label === 'تکمیل شده') return 100
  if (label === 'در حال انجام') return 55
  return 10
}

function useProjectManagementData() {
  const { user } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [activities, setActivities] = useState([])
  const [progressUpdates, setProgressUpdates] = useState([])
  const [documents, setDocuments] = useState([])
  const [risks, setRisks] = useState([])
  const [stakeholders, setStakeholders] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [governanceRoles, setGovernanceRoles] = useState([])
  const [deliverables, setDeliverables] = useState([])
  const [kpis, setKpis] = useState([])
  const [projectTotal, setProjectTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      const [projectResult, userResult] = await Promise.all([
        projectManagementApi.projects({ tenantId, pageNumber: 1, pageSize: 50 }),
        usersApi.list({ tenantId, pageNumber: 1, pageSize: 200 }),
      ])
      if (cancelled) return
      if (!projectResult.isSuccess) setError(PersianMessages.error(projectResult.error))
      const projectItems = arrayPayload(projectResult)
      setProjects(projectItems)
      setProjectTotal(totalPayload(projectResult, projectItems))
      setUsers(arrayPayload(userResult))
      setSelectedProjectId((current) => current && projectItems.some((p) => p.id === current) ? current : projectItems[0]?.id || '')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [tenantId, refreshKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!projects.length) {
        setTasks([])
        return
      }
      const results = await Promise.all(projects.map((project) => projectManagementApi.agileTasks({ projectId: project.id })))
      if (cancelled) return
      setTasks(results.flatMap((result, index) => arrayPayload(result).map((task) => ({ ...task, projectName: projectDisplayName(projects[index]) }))))
    })()
    return () => { cancelled = true }
  }, [projects])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!selectedProjectId) {
        setActivities([]); setProgressUpdates([]); setDocuments([]); setRisks([])
        setStakeholders([]); setTeamMembers([]); setGovernanceRoles([]); setDeliverables([]); setKpis([])
        return
      }
      setLoadingDetails(true)
      const [activityResult, progressResult, documentResult, riskResult, stakeholderResult, memberResult, governanceResult, deliverableResult, kpiResult] = await Promise.all([
        projectManagementApi.waterfallActivities(selectedProjectId),
        projectManagementApi.progressUpdates(selectedProjectId),
        projectManagementApi.documents(selectedProjectId),
        projectManagementApi.risks(selectedProjectId),
        projectManagementApi.stakeholders(selectedProjectId),
        projectManagementApi.teamMembers(selectedProjectId),
        projectManagementApi.governanceRoles(selectedProjectId),
        projectManagementApi.deliverables(selectedProjectId),
        projectManagementApi.kpis({ projectId: selectedProjectId }),
      ])
      if (cancelled) return
      setActivities(arrayPayload(activityResult))
      setProgressUpdates(arrayPayload(progressResult))
      setDocuments(arrayPayload(documentResult))
      setRisks(arrayPayload(riskResult))
      setStakeholders(arrayPayload(stakeholderResult))
      setTeamMembers(arrayPayload(memberResult))
      setGovernanceRoles(arrayPayload(governanceResult))
      setDeliverables(arrayPayload(deliverableResult))
      setKpis(arrayPayload(kpiResult))
      setLoadingDetails(false)
    })()
    return () => { cancelled = true }
  }, [selectedProjectId, refreshKey])

  const userName = useMemo(() => {
    const map = new Map(users.map((item) => [item.id, item.displayName || item.email]))
    return (id) => map.get(id) || '—'
  }, [users])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null

  return {
    tenantId, projects, projectTotal, selectedProject, selectedProjectId, setSelectedProjectId, users,
    tasks, activities, progressUpdates, documents, risks, stakeholders, teamMembers,
    governanceRoles, deliverables, kpis, userName, loading, loadingDetails, error,
    refresh: () => setRefreshKey((value) => value + 1),
  }
}

function ProjectSelector({ data }) {
  if (!data.projects.length) return null
  return (
    <select className="project-selector" value={data.selectedProjectId} onChange={(event) => data.setSelectedProjectId(event.target.value)}>
      {data.projects.map((project) => <option key={project.id} value={project.id}>{projectDisplayName(project)}</option>)}
    </select>
  )
}

function DataState({ loading, error, empty, children }) {
  if (loading) return <p className="data-state">در حال دریافت اطلاعات از Nexus Core...</p>
  if (error) return <p className="data-state data-state--error">{error}</p>
  if (empty) return <p className="data-state">داده‌ای برای نمایش وجود ندارد.</p>
  return children
}

function FormField({ label, children, wide = false }) {
  return <label className="ue-field" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span>{children}</label>
}

function UserSelect({ data, value, onChange, required = false }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">انتخاب نشده</option>
      {data.users.map((item) => <option key={item.id} value={item.id}>{item.displayName || item.email}</option>)}
    </select>
  )
}

const creationTitles = {
  project: 'ایجاد پروژه',
  task: 'ایجاد وظیفه',
  activity: 'افزودن فعالیت برنامه‌ریزی',
  progress: 'ثبت گزارش پیشرفت',
  document: 'آپلود سند پروژه',
  deliverable: 'تعریف خروجی پروژه',
  kpi: 'تعریف KPI',
  risk: 'ثبت ریسک',
  stakeholder: 'ثبت ذینفع',
  member: 'افزودن عضو پروژه',
  governance: 'تعریف نقش حاکمیتی',
}

const creationInitialState = (kind, data) => ({
  project: { name: '', code: '', type: '1', startDate: '', endDate: '', cost: '', goal: '', description: '' },
  task: { title: '', description: '', responsibleUserId: '', approverUserId: '', dueDate: '', priority: '1', sprintNumber: '' },
  activity: { name: '', description: '', responsibleUserId: '', approverUserId: '', startDate: '', endDate: '', durationDays: '', manHours: '', weight: '1' },
  progress: { statusDescription: '', registerDate: todayInputValue(), plannedProgress: '0', actualProgress: '0', delayReasons: '' },
  document: { description: '', documentType: '0', file: null },
  deliverable: { title: '', description: '', acceptanceCriteria: '', responsibleUserId: '', targetDate: '' },
  kpi: { deliverableId: data.deliverables[0]?.id || '', type: '1', description: '', formula: '', targetValue: '' },
  risk: { description: '', probabilityScore: '1', severityScore: '1', impactScore: '1', responsePlan: '', riskOwnerUserId: '' },
  stakeholder: { name: '', isInternal: 'true', expectations: '', notes: '', power: '1', interest: '1', engagementStrategy: '', requirements: '' },
  member: { userId: '', roleTitle: '' },
  governance: { title: '', userId: '', personnelNumber: '', phone: '', email: '', serviceLocation: '' },
}[kind] || {})

function CreateProjectItemModal({ kind, data, onClose }) {
  const [form, setForm] = useState(() => creationInitialState(kind, data))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedProjectId = data.selectedProjectId
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (kind !== 'project' && !selectedProjectId) {
      setError('ابتدا یک پروژه انتخاب کنید.')
      return
    }
    if (kind === 'kpi' && !form.deliverableId) {
      setError('برای تعریف KPI ابتدا باید یک خروجی پروژه بسازید.')
      return
    }
    if (kind === 'document' && !form.file) {
      setError('فایل سند را انتخاب کنید.')
      return
    }
    setBusy(true)
    setError('')
    const base = { tenantId: data.tenantId, projectId: selectedProjectId }
    const result = await ({
      project: () => projectManagementApi.createProject({
        tenantId: data.tenantId,
        name: form.name,
        code: form.code,
        type: Number(form.type),
        managerUserId: null,
        ownerUserId: null,
        organizationUnitId: null,
        workCalendarId: null,
        startDate: emptyToNull(form.startDate),
        endDate: emptyToNull(form.endDate),
        cost: numberOrNull(form.cost),
        goal: emptyToNull(form.goal),
        requirements: null,
        constraints: null,
        assumptions: null,
        description: emptyToNull(form.description),
        charter: null,
      }),
      task: () => projectManagementApi.createAgileTask({
        ...base,
        title: form.title,
        description: emptyToNull(form.description),
        responsibleUserId: emptyToNull(form.responsibleUserId),
        approverUserId: emptyToNull(form.approverUserId),
        dueDate: emptyToNull(form.dueDate),
        priority: Number(form.priority),
        sprintNumber: numberOrNull(form.sprintNumber),
      }),
      activity: () => projectManagementApi.createWaterfallActivity({
        ...base,
        parentActivityId: null,
        name: form.name,
        description: emptyToNull(form.description),
        deliverableId: null,
        responsibleUserId: emptyToNull(form.responsibleUserId),
        approverUserId: emptyToNull(form.approverUserId),
        startDate: emptyToNull(form.startDate),
        endDate: emptyToNull(form.endDate),
        durationDays: numberOrNull(form.durationDays),
        manHours: numberOrNull(form.manHours),
        weight: Number(form.weight || 1),
      }),
      progress: () => projectManagementApi.createProgressUpdate({
        ...base,
        statusDescription: emptyToNull(form.statusDescription),
        registerDate: form.registerDate,
        plannedProgress: Number(form.plannedProgress || 0),
        actualProgress: Number(form.actualProgress || 0),
        delayReasons: emptyToNull(form.delayReasons),
      }),
      document: () => projectManagementApi.uploadDocument({
        ...base,
        description: form.description,
        documentType: Number(form.documentType),
        file: form.file,
      }),
      deliverable: () => projectManagementApi.createDeliverable({
        ...base,
        title: form.title,
        description: emptyToNull(form.description),
        acceptanceCriteria: emptyToNull(form.acceptanceCriteria),
        responsibleUserId: emptyToNull(form.responsibleUserId),
        targetDate: emptyToNull(form.targetDate),
      }),
      kpi: () => projectManagementApi.createKpi({
        ...base,
        deliverableId: form.deliverableId,
        type: Number(form.type),
        description: form.description,
        formula: emptyToNull(form.formula),
        targetValue: numberOrNull(form.targetValue),
      }),
      risk: () => projectManagementApi.createRisk({
        ...base,
        description: form.description,
        probabilityScore: Number(form.probabilityScore),
        severityScore: Number(form.severityScore),
        impactScore: Number(form.impactScore),
        responsePlan: emptyToNull(form.responsePlan),
        riskOwnerUserId: emptyToNull(form.riskOwnerUserId),
      }),
      stakeholder: () => projectManagementApi.createStakeholder({
        ...base,
        name: form.name,
        isInternal: form.isInternal === 'true',
        expectations: emptyToNull(form.expectations),
        notes: emptyToNull(form.notes),
        power: Number(form.power),
        interest: Number(form.interest),
        engagementStrategy: emptyToNull(form.engagementStrategy),
        requirements: emptyToNull(form.requirements),
      }),
      member: () => projectManagementApi.addTeamMember({
        ...base,
        userId: form.userId,
        roleTitle: emptyToNull(form.roleTitle),
      }),
      governance: () => projectManagementApi.createGovernanceRole({
        ...base,
        title: form.title,
        userId: emptyToNull(form.userId),
        personnelNumber: emptyToNull(form.personnelNumber),
        phone: emptyToNull(form.phone),
        email: emptyToNull(form.email),
        serviceLocation: emptyToNull(form.serviceLocation),
      }),
    }[kind])()
    setBusy(false)
    if (!result.isSuccess) {
      setError(PersianMessages.error(result.error))
      return
    }
    data.refresh()
    onClose()
  }

  return (
    <div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ue-backdrop">
      <form className="ue-modal pm-modal" onSubmit={submit}>
        <header className="ue-head">
          <div className="ue-head-title"><strong>{creationTitles[kind]}</strong><small>{kind === 'project' ? 'ثبت در Projects API' : projectDisplayName(data.selectedProject)}</small></div>
          <button className="ue-close" type="button" onClick={onClose}><X size={17} /></button>
        </header>
        <div className="ue-body"><div className="ue-grid">
          {kind === 'project' && <>
            <FormField label="نام پروژه"><input value={form.name} onChange={(event) => set('name', event.target.value)} required /></FormField>
            <FormField label="کد پروژه"><input value={form.code} onChange={(event) => set('code', event.target.value)} required /></FormField>
            <FormField label="نوع پروژه"><select value={form.type} onChange={(event) => set('type', event.target.value)}><option value="1">چابک</option><option value="0">آبشاری</option></select></FormField>
            <FormField label="هزینه اولیه"><input type="number" min="0" value={form.cost} onChange={(event) => set('cost', event.target.value)} /></FormField>
            <FormField label="تاریخ شروع"><input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} /></FormField>
            <FormField label="تاریخ پایان"><input type="date" value={form.endDate} onChange={(event) => set('endDate', event.target.value)} /></FormField>
            <FormField label="هدف پروژه" wide><textarea rows="2" value={form.goal} onChange={(event) => set('goal', event.target.value)} /></FormField>
            <FormField label="توضیحات" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} /></FormField>
          </>}
          {kind === 'task' && <>
            <FormField label="عنوان وظیفه"><input value={form.title} onChange={(event) => set('title', event.target.value)} required /></FormField>
            <FormField label="اولویت"><select value={form.priority} onChange={(event) => set('priority', event.target.value)}><option value="0">کم</option><option value="1">متوسط</option><option value="2">بالا</option><option value="3">بحرانی</option></select></FormField>
            <FormField label="مسئول"><UserSelect data={data} value={form.responsibleUserId} onChange={(value) => set('responsibleUserId', value)} /></FormField>
            <FormField label="تأییدکننده"><UserSelect data={data} value={form.approverUserId} onChange={(value) => set('approverUserId', value)} /></FormField>
            <FormField label="موعد انجام"><input type="date" value={form.dueDate} onChange={(event) => set('dueDate', event.target.value)} /></FormField>
            <FormField label="شماره اسپرینت"><input type="number" min="1" value={form.sprintNumber} onChange={(event) => set('sprintNumber', event.target.value)} /></FormField>
            <FormField label="توضیحات" wide><textarea rows="3" value={form.description} onChange={(event) => set('description', event.target.value)} /></FormField>
          </>}
          {kind === 'activity' && <>
            <FormField label="نام فعالیت"><input value={form.name} onChange={(event) => set('name', event.target.value)} required /></FormField>
            <FormField label="وزن"><input type="number" min="0" step="0.1" value={form.weight} onChange={(event) => set('weight', event.target.value)} required /></FormField>
            <FormField label="مسئول"><UserSelect data={data} value={form.responsibleUserId} onChange={(value) => set('responsibleUserId', value)} /></FormField>
            <FormField label="تأییدکننده"><UserSelect data={data} value={form.approverUserId} onChange={(value) => set('approverUserId', value)} /></FormField>
            <FormField label="تاریخ شروع"><input type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} /></FormField>
            <FormField label="تاریخ پایان"><input type="date" value={form.endDate} onChange={(event) => set('endDate', event.target.value)} /></FormField>
            <FormField label="مدت روز"><input type="number" min="0" value={form.durationDays} onChange={(event) => set('durationDays', event.target.value)} /></FormField>
            <FormField label="نفرساعت"><input type="number" min="0" step="0.1" value={form.manHours} onChange={(event) => set('manHours', event.target.value)} /></FormField>
            <FormField label="توضیحات" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} /></FormField>
          </>}
          {kind === 'progress' && <>
            <FormField label="تاریخ ثبت"><input type="date" value={form.registerDate} onChange={(event) => set('registerDate', event.target.value)} required /></FormField>
            <FormField label="پیشرفت برنامه‌ای"><input type="number" min="0" max="100" step="0.1" value={form.plannedProgress} onChange={(event) => set('plannedProgress', event.target.value)} required /></FormField>
            <FormField label="پیشرفت واقعی"><input type="number" min="0" max="100" step="0.1" value={form.actualProgress} onChange={(event) => set('actualProgress', event.target.value)} required /></FormField>
            <FormField label="شرح وضعیت" wide><textarea rows="2" value={form.statusDescription} onChange={(event) => set('statusDescription', event.target.value)} /></FormField>
            <FormField label="دلایل تأخیر" wide><textarea rows="2" value={form.delayReasons} onChange={(event) => set('delayReasons', event.target.value)} /></FormField>
          </>}
          {kind === 'document' && <>
            <FormField label="نوع سند"><select value={form.documentType} onChange={(event) => set('documentType', event.target.value)}><option value="0">گزارش</option><option value="1">نامه</option><option value="2">صورت‌جلسه</option><option value="3">سایر</option></select></FormField>
            <FormField label="فایل"><input type="file" onChange={(event) => set('file', event.target.files?.[0] || null)} required /></FormField>
            <FormField label="توضیح سند" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} required /></FormField>
          </>}
          {kind === 'deliverable' && <>
            <FormField label="عنوان خروجی"><input value={form.title} onChange={(event) => set('title', event.target.value)} required /></FormField>
            <FormField label="مسئول"><UserSelect data={data} value={form.responsibleUserId} onChange={(value) => set('responsibleUserId', value)} /></FormField>
            <FormField label="تاریخ هدف"><input type="date" value={form.targetDate} onChange={(event) => set('targetDate', event.target.value)} /></FormField>
            <FormField label="توضیحات" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} /></FormField>
            <FormField label="معیار پذیرش" wide><textarea rows="2" value={form.acceptanceCriteria} onChange={(event) => set('acceptanceCriteria', event.target.value)} /></FormField>
          </>}
          {kind === 'kpi' && <>
            <FormField label="خروجی پروژه"><select value={form.deliverableId} onChange={(event) => set('deliverableId', event.target.value)} required>{data.deliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></FormField>
            <FormField label="نوع KPI"><select value={form.type} onChange={(event) => set('type', event.target.value)}><option value="1">کمی</option><option value="0">کیفی</option></select></FormField>
            <FormField label="هدف عددی"><input type="number" step="0.1" value={form.targetValue} onChange={(event) => set('targetValue', event.target.value)} /></FormField>
            <FormField label="شرح شاخص" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} required /></FormField>
            <FormField label="فرمول" wide><textarea rows="2" value={form.formula} onChange={(event) => set('formula', event.target.value)} /></FormField>
          </>}
          {kind === 'risk' && <>
            <FormField label="احتمال"><input type="number" min="1" max="5" value={form.probabilityScore} onChange={(event) => set('probabilityScore', event.target.value)} required /></FormField>
            <FormField label="شدت"><input type="number" min="1" max="5" value={form.severityScore} onChange={(event) => set('severityScore', event.target.value)} required /></FormField>
            <FormField label="اثر"><input type="number" min="1" max="5" value={form.impactScore} onChange={(event) => set('impactScore', event.target.value)} required /></FormField>
            <FormField label="مالک ریسک"><UserSelect data={data} value={form.riskOwnerUserId} onChange={(value) => set('riskOwnerUserId', value)} /></FormField>
            <FormField label="شرح ریسک" wide><textarea rows="2" value={form.description} onChange={(event) => set('description', event.target.value)} required /></FormField>
            <FormField label="برنامه پاسخ" wide><textarea rows="2" value={form.responsePlan} onChange={(event) => set('responsePlan', event.target.value)} /></FormField>
          </>}
          {kind === 'stakeholder' && <>
            <FormField label="نام ذینفع"><input value={form.name} onChange={(event) => set('name', event.target.value)} required /></FormField>
            <FormField label="نوع"><select value={form.isInternal} onChange={(event) => set('isInternal', event.target.value)}><option value="true">داخلی</option><option value="false">خارجی</option></select></FormField>
            <FormField label="قدرت"><select value={form.power} onChange={(event) => set('power', event.target.value)}><option value="0">کم</option><option value="1">متوسط</option><option value="2">زیاد</option></select></FormField>
            <FormField label="علاقه"><select value={form.interest} onChange={(event) => set('interest', event.target.value)}><option value="0">کم</option><option value="1">متوسط</option><option value="2">زیاد</option></select></FormField>
            <FormField label="انتظارات" wide><textarea rows="2" value={form.expectations} onChange={(event) => set('expectations', event.target.value)} /></FormField>
            <FormField label="استراتژی تعامل" wide><textarea rows="2" value={form.engagementStrategy} onChange={(event) => set('engagementStrategy', event.target.value)} /></FormField>
          </>}
          {kind === 'member' && <>
            <FormField label="کاربر"><UserSelect data={data} value={form.userId} onChange={(value) => set('userId', value)} required /></FormField>
            <FormField label="نقش در پروژه"><input value={form.roleTitle} onChange={(event) => set('roleTitle', event.target.value)} /></FormField>
          </>}
          {kind === 'governance' && <>
            <FormField label="عنوان نقش"><input value={form.title} onChange={(event) => set('title', event.target.value)} required /></FormField>
            <FormField label="کاربر"><UserSelect data={data} value={form.userId} onChange={(value) => set('userId', value)} /></FormField>
            <FormField label="شماره پرسنلی"><input value={form.personnelNumber} onChange={(event) => set('personnelNumber', event.target.value)} /></FormField>
            <FormField label="تلفن"><input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></FormField>
            <FormField label="ایمیل"><input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></FormField>
            <FormField label="محل خدمت"><input value={form.serviceLocation} onChange={(event) => set('serviceLocation', event.target.value)} /></FormField>
          </>}
        </div></div>
        <footer className="ue-foot">
          {error && <span className="ue-error">{error}</span>}
          <div className="ue-foot-actions"><button className="ue-cancel" type="button" onClick={onClose}>انصراف</button><button className="ue-save" type="submit" disabled={busy}>{busy ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </footer>
      </form>
</div>
    </div>
  )
}

function CreateButton({ kind, data, label, disabled = false }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} disabled={disabled}><Plus size={18} />{label || creationTitles[kind]}</button>
      {open && <CreateProjectItemModal kind={kind} data={data} onClose={() => setOpen(false)} />}
    </>
  )
}

function normalizeTask(task, userName) {
  const status = enumLabel(task.status, agileStatusLabels)
  const priority = enumLabel(task.priority, agilePriorityLabels)
  return {
    id: task.id,
    title: task.title,
    project: task.projectName || '—',
    owner: userName(task.responsibleUserId),
    due: formatDateOnly(task.dueDate),
    priority,
    status,
    progress: taskProgress(task.status),
    sprintNumber: task.sprintNumber,
  }
}

function TaskPageHeader({ title, description, action = 'ایجاد وظیفه جدید', actionNode, children }) {
  return (
    <div className="task-page-header">
      <div><span>مدیریت وظایف / {title}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="task-head-actions">{children}{actionNode || (action ? <button type="button"><Plus size={18} />{action}</button> : null)}</div>
    </div>
  )
}

function TaskDashboard({ data }) {
  const normalized = data.tasks.map((task) => normalizeTask(task, data.userName))
  const done = normalized.filter((task) => task.status === 'تکمیل شده').length
  const doing = normalized.filter((task) => task.status === 'در حال انجام').length
  const overdue = data.tasks.filter((task) => task.dueDate && new Date(`${task.dueDate}T23:59:59`) < new Date() && enumLabel(task.status, agileStatusLabels) !== 'تکمیل شده').length
  const projectRows = data.projects.slice(0, 5).map((project) => {
    const projectTasks = normalized.filter((task) => task.project === project.name)
    const projectDone = projectTasks.filter((task) => task.status === 'تکمیل شده').length
    const percent = projectTasks.length ? Math.round((projectDone / projectTasks.length) * 100) : 0
    return [projectDisplayName(project), percent, `${projectDone.toLocaleString('fa-IR')} از ${projectTasks.length.toLocaleString('fa-IR')} وظیفه`]
  })

  return (
    <>
      <TaskPageHeader title="داشبورد وظایف" description="نمای کلی وضعیت وظایف متصل به Nexus Core" actionNode={<CreateButton kind="task" data={data} label="ایجاد وظیفه جدید" />}>
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
      <div className="task-kpis">
        <article><span className="task-kpi-icon navy"><ListTodo size={21} /></span><div><small>کل وظایف</small><strong>{normalized.length.toLocaleString('fa-IR')}</strong><p>در {data.projectTotal.toLocaleString('fa-IR')} پروژه</p></div></article>
        <article><span className="task-kpi-icon blue"><Clock3 size={21} /></span><div><small>در حال انجام</small><strong>{doing.toLocaleString('fa-IR')}</strong><p>از Agile Tasks</p></div></article>
        <article><span className="task-kpi-icon green"><CheckCircle2 size={21} /></span><div><small>تکمیل شده</small><strong>{done.toLocaleString('fa-IR')}</strong><p>{normalized.length ? Math.round((done / normalized.length) * 100).toLocaleString('fa-IR') : '۰'}٪ از کل</p></div></article>
        <article><span className="task-kpi-icon red"><TriangleAlert size={21} /></span><div><small>دارای تأخیر</small><strong>{overdue.toLocaleString('fa-IR')}</strong><p>براساس موعد انجام</p></div></article>
      </div>
      <div className="task-dashboard-grid">
        <section className="task-panel project-progress">
          <div className="task-panel-title"><div><h3>پیشرفت وظایف پروژه‌ها</h3><p>درصد وظایف تکمیل‌شده به تفکیک پروژه مرجع</p></div><button>مشاهده همه</button></div>
          {projectRows.length ? projectRows.map(([name, percent, count]) => <div className="progress-row" key={name}><div><strong>{name}</strong><span>{count}</span></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><em>{percent}٪</em></div>) : <p className="data-state">هنوز وظیفه‌ای برای پروژه‌ها ثبت نشده است.</p>}
        </section>
        <section className="task-panel workload-panel">
          <div className="task-panel-title"><div><h3>توزیع حجم کار تیم</h3><p>وظایف فعال اعضای پروژه</p></div><MoreHorizontal size={18} /></div>
          {Object.entries(normalized.reduce((map, task) => {
            if (task.owner !== '—' && task.status !== 'تکمیل شده') map[task.owner] = (map[task.owner] || 0) + 1
            return map
          }, {})).slice(0, 5).map(([name, count], index) => <div className="workload-row" key={name}><span className={`mini-avatar tone-${index}`}>{initialsOf(name)}</span><div><strong>{name}</strong><small>عضو تیم پروژه</small></div><b>{count.toLocaleString('fa-IR')} وظیفه</b></div>)}
          {!normalized.length && <p className="data-state">برای محاسبه حجم کار، وظیفه‌ای ثبت نشده است.</p>}
        </section>
      </div>
      <TaskList compact data={data} />
      </DataState>
    </>
  )
}

function StatusPill({ status }) {
  const type = status === 'تکمیل شده' ? 'done' : status === 'در حال انجام' ? 'doing' : status === 'نیازمند بررسی' ? 'review' : 'todo'
  return <span className={`status-pill ${type}`}>{status}</span>
}

function TaskList({ compact = false, data }) {
  const [search, setSearch] = useState('')
  const tasks = (data?.tasks || []).map((task) => normalizeTask(task, data.userName))
  const shownTasks = tasks
    .filter((task) => !search || task.title.includes(search) || task.project.includes(search) || task.owner.includes(search))
    .slice(0, compact ? 5 : 100)
  return (
    <section className={`task-panel task-table-panel ${compact ? 'compact' : ''}`}>
      <div className="task-panel-title"><div><h3>{compact ? 'وظایف نزدیک به موعد' : 'فهرست وظایف'}</h3><p>{compact ? 'وظایفی که از API وظایف دریافت شده‌اند' : 'مدیریت، فیلتر و پیگیری وظایف پروژه‌ها از Nexus Core'}</p></div>{compact ? <button>مشاهده همه</button> : <div className="table-actions"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی وظیفه..." /></label><button><Filter size={16} />فیلترها</button></div>}</div>
      <DataState loading={data?.loading} error={data?.error} empty={!shownTasks.length}>
      <div className="table-scroll"><table><thead><tr><th>عنوان وظیفه</th><th>پروژه مرجع</th><th>مسئول</th><th>مهلت انجام</th><th>اولویت</th><th>وضعیت</th><th>پیشرفت</th><th /></tr></thead><tbody>
        {shownTasks.map((task) => <tr key={task.id}><td><span className="task-check" /><strong>{task.title}</strong></td><td>{task.project}</td><td><span className="owner-cell"><i>{initialsOf(task.owner).slice(0, 1)}</i>{task.owner}</span></td><td>{task.due}</td><td><span className={`priority ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'high' : task.priority === 'متوسط' ? 'medium' : 'low'}`}>{task.priority}</span></td><td><StatusPill status={task.status} /></td><td><span className="inline-progress"><i><b style={{ width: `${task.progress}%` }} /></i>{task.progress.toLocaleString('fa-IR')}٪</span></td><td><MoreHorizontal size={17} /></td></tr>)}
      </tbody></table></div>
      </DataState>
    </section>
  )
}

function AllTasks({ data }) {
  return <><TaskPageHeader title="همه وظایف" description="مشاهده و مدیریت وظایف دریافت شده از Agile Tasks API" actionNode={<CreateButton kind="task" data={data} label="ایجاد وظیفه جدید" />}><ProjectSelector data={data} /></TaskPageHeader><div className="view-switch"><button className="active"><ListTodo size={16} />نمای لیستی</button><button><Network size={16} />نمای درختی</button><button><UserRound size={16} />وظایف من</button></div><TaskList data={data} /></>
}

const kanbanColumns = [
  { title: 'برای انجام', count: 4, tone: 'gray', tasks: [sampleTasks[2], { ...sampleTasks[0], title: 'جمع‌آوری مستندات قرارداد' }] },
  { title: 'در حال انجام', count: 3, tone: 'blue', tasks: [sampleTasks[0], { ...sampleTasks[1], title: 'به‌روزرسانی برنامه کنترل پروژه' }] },
  { title: 'نیازمند بررسی', count: 2, tone: 'gold', tasks: [sampleTasks[1]] },
  { title: 'تکمیل شده', count: 6, tone: 'green', tasks: [sampleTasks[3]] },
]

function KanbanBoard({ data }) {
  const normalized = data.tasks.map((task) => normalizeTask(task, data.userName))
  const columns = [
    { title: 'برای انجام', tone: 'gray' },
    { title: 'در حال انجام', tone: 'blue' },
    { title: 'تکمیل شده', tone: 'green' },
  ].map((column) => ({ ...column, tasks: normalized.filter((task) => task.status === column.title) }))
  return <><TaskPageHeader title="برد کانبان" description="نمای دیداری وضعیت وظایف موجود در Nexus Core" actionNode={<CreateButton kind="task" data={data} label="ایجاد وظیفه جدید" />}><ProjectSelector data={data} /></TaskPageHeader><div className="kanban-toolbar"><div className="view-switch"><button className="active">کانبان</button><button>اسکرامبان</button></div></div><DataState loading={data.loading} error={data.error} empty={!normalized.length}><div className="kanban-board">{columns.map((column) => <section className="kanban-column" key={column.title}><header><div><i className={column.tone} /><strong>{column.title}</strong><span>{column.tasks.length.toLocaleString('fa-IR')}</span></div></header>{column.tasks.map((task) => <article className="kanban-card" key={task.id}><div><span className={`priority ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'high' : task.priority === 'متوسط' ? 'medium' : 'low'}`}>{task.priority}</span><MoreHorizontal size={16} /></div><h4>{task.title}</h4><p>{task.project}</p><footer><span><Clock3 size={14} />{task.due}</span><i>{initialsOf(task.owner).slice(0, 1)}</i></footer></article>)}</section>)}</div></DataState></>
}

function ProjectCalendar({ data }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const leading = (firstDay.getDay() + 1) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((leading + daysInMonth) / 7) * 7 }, (_, index) => index < leading || index >= leading + daysInMonth ? null : index - leading + 1)
  const byDay = data.tasks.reduce((map, task) => {
    if (!task.dueDate) return map
    const date = new Date(`${task.dueDate}T00:00:00`)
    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate()
      if (!map[day]) map[day] = []
      map[day].push(normalizeTask(task, data.userName))
    }
    return map
  }, {})
  return <><TaskPageHeader title="تقویم پروژه" description="تقویم موعد وظایف؛ Core هنوز endpoint رویداد پروژه مستقل ندارد" action={null}><ProjectSelector data={data} /></TaskPageHeader><div className="calendar-toolbar"><button>امروز</button><div><ChevronLeft size={18} /><strong>{today.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}</strong><ChevronLeft className="flip" size={18} /></div></div><DataState loading={data.loading} error={data.error} empty={!data.tasks.length}><section className="calendar-card"><div className="calendar-weekdays">{['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => <div className={day === today.getDate() ? 'today' : ''} key={index}>{day && <b>{day.toLocaleString('fa-IR')}</b>}{(byDay[day] || []).slice(0, 3).map((task) => <span className={`event ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'gold' : task.status === 'تکمیل شده' ? 'green' : 'blue'}`} key={task.id}>{task.title}</span>)}</div>)}</div></section></DataState></>
}

function ProjectPlanning({ data }) {
  const project = data.selectedProject
  return (
    <>
      <TaskPageHeader title="برنامه‌ریزی پروژه" description="فهرست پروژه‌ها و فعالیت‌های WBS متصل به Core" actionNode={<CreateButton kind="project" data={data} label="ایجاد پروژه" />}>
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        <section className="stats-grid project-summary-grid">
          <article className="stat-card"><span>پروژه‌های ثبت‌شده</span><div className="stat-value"><strong>{data.projectTotal.toLocaleString('fa-IR')}</strong><small>پروژه</small></div><p>از Projects API</p></article>
          <article className="stat-card"><span>وضعیت پروژه منتخب</span><div className="stat-value"><strong>{enumLabel(project?.status, projectStatusLabels)}</strong></div><p>{enumLabel(project?.type, projectTypeLabels)}</p></article>
          <article className="stat-card"><span>بازه زمانی</span><div className="stat-value"><strong>{formatDateOnly(project?.startDate)}</strong></div><p>تا {formatDateOnly(project?.endDate)}</p></article>
          <article className="stat-card"><span>بودجه/هزینه</span><div className="stat-value"><strong>{project?.cost ? Number(project.cost).toLocaleString('fa-IR') : '—'}</strong></div><p>فیلد کلی Cost در Core</p></article>
        </section>
        <section className="task-panel task-table-panel">
          <div className="task-panel-title"><div><h3>فعالیت‌های برنامه</h3><p>داده‌های Waterfall Activities برای پروژه منتخب</p></div><CreateButton kind="activity" data={data} label="افزودن فعالیت" /></div>
          <DataState loading={data.loadingDetails} empty={!data.activities.length}>
            <div className="table-scroll"><table><thead><tr><th>فعالیت</th><th>مسئول</th><th>شروع</th><th>پایان</th><th>مدت</th><th>پیشرفت برنامه‌ای</th><th>پیشرفت واقعی</th></tr></thead><tbody>
              {data.activities.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{data.userName(item.responsibleUserId)}</td><td>{formatDateOnly(item.startDate)}</td><td>{formatDateOnly(item.endDate)}</td><td>{item.durationDays || '—'}</td><td>{Number(item.plannedProgress || 0).toLocaleString('fa-IR')}٪</td><td>{Number(item.actualProgress || 0).toLocaleString('fa-IR')}٪</td></tr>)}
            </tbody></table></div>
          </DataState>
        </section>
      </DataState>
    </>
  )
}

function knowledgeArrayFromResult(result) {
  let value = result?.value

  for (let i = 0; i < 4; i += 1) {
    if (Array.isArray(value)) return value

    if (!value || typeof value !== 'object') return []

    if (Array.isArray(value.items)) return value.items
    if (Array.isArray(value.data)) return value.data

    if ('value' in value) {
      value = value.value
      continue
    }

    return []
  }

  return []
}

function knowledgeErrorMessage(result) {
  const error = result?.error

  if (typeof error === 'string') return error
  if (error?.message) return error.message

  return 'درخواست ناموفق بود. پاسخ سرور را بررسی کنید.'
}

function knowledgeDocumentTypeLabel(value) {
  const labels = {
    0: 'کتاب',
    1: 'نرم‌افزار',
    2: 'یادداشت',
    3: 'سایر',
    4: 'جزوه',
    5: 'درس‌آموخته',
    6: 'قالب',
    7: 'تصمیم',
    Book: 'کتاب',
    Software: 'نرم‌افزار',
    Notes: 'یادداشت',
    Other: 'سایر',
    Pamphlet: 'جزوه',
    LessonLearned: 'درس‌آموخته',
    Template: 'قالب',
    Decision: 'تصمیم',
  }

  return labels[value] ?? value ?? '—'
}

function knowledgeDocumentTypeValue(value) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value)
  }

  const values = {
    Book: '0',
    Software: '1',
    Notes: '2',
    Other: '3',
    Pamphlet: '4',
    LessonLearned: '5',
    Template: '6',
    Decision: '7',
  }

  return values[value] ?? '2'
}

function KnowledgeManagement() {
  const [documents, setDocuments] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedTypeFilter, setAppliedTypeFilter] = useState('')

  const [subjectType, setSubjectType] = useState('Project')
  const [subjectId, setSubjectId] = useState('')
  const [activeSubject, setActiveSubject] = useState(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState('2')
  const [file, setFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const [editingDocument, setEditingDocument] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDocumentType, setEditDocumentType] = useState('2')

  const [loading, setLoading] = useState(true)
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [linkError, setLinkError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [columnFilterOpen, setColumnFilterOpen] = useState('')
  const [columnFilters, setColumnFilters] = useState({

    documentType: '',
    fileName: '',
    minSize: '',
    maxSize: '',
    dateFrom: '',
    dateTo: '',
    linkedStatus: '',
  })
  const [columnSort, setColumnSort] = useState({ key: '', direction: 'asc' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      setLinkError('')
      setLoadingLinks(Boolean(activeSubject))

      const result = await knowledgeApi.list({
        search: appliedSearch,
        documentType: appliedTypeFilter,
      })

      if (cancelled) return

      if (!result.isSuccess) {
        setError(knowledgeErrorMessage(result))
        setDocuments([])
        setLinkedIds(new Set())
        setLoading(false)
        setLoadingLinks(false)
        return
      }

      setDocuments(knowledgeArrayFromResult(result))

      if (activeSubject) {
        const linksResult = await knowledgeApi.list({
          search: appliedSearch,
          subjectType: activeSubject.subjectType,
          subjectId: activeSubject.subjectId,
        })

        if (cancelled) return

        if (linksResult.isSuccess) {
          const ids = knowledgeArrayFromResult(linksResult)
            .map((item) => item.id)
            .filter(Boolean)

          setLinkedIds(new Set(ids))
        } else {
          setLinkedIds(new Set())
          setLinkError(knowledgeErrorMessage(linksResult))
        }
      } else {
        setLinkedIds(new Set())
      }

      if (!cancelled) {
        setLoading(false)
        setLoadingLinks(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [appliedSearch, appliedTypeFilter, activeSubject, reloadKey])

  const visibleDocuments = useMemo(() => {

    const fileNeedle = columnFilters.fileName.trim().toLocaleLowerCase()

    const filtered = documents.filter((document) => {

      const fileValue = String(document.fileName || '')
      const typeValue = knowledgeDocumentTypeValue(document.documentType)
      const sizeValue = Number(document.sizeBytes ?? 0)
      const dateValue = String(document.createdAtUtc || '').slice(0, 10)
      const isLinked = linkedIds.has(document.id)

      let statusMatches = true

      if (columnFilters.linkedStatus === 'none') {
        statusMatches = !activeSubject
      } else if (columnFilters.linkedStatus === 'linked') {
        statusMatches = Boolean(activeSubject) && isLinked
      } else if (columnFilters.linkedStatus === 'unlinked') {
        statusMatches = Boolean(activeSubject) && !isLinked
      }

      return (

        (columnFilters.documentType === '' ||
          typeValue === columnFilters.documentType) &&
        fileValue.toLocaleLowerCase().includes(fileNeedle) &&
        (columnFilters.minSize === '' ||
          sizeValue >= Number(columnFilters.minSize) * 1024) &&
        (columnFilters.maxSize === '' ||
          sizeValue <= Number(columnFilters.maxSize) * 1024) &&
        (columnFilters.dateFrom === '' ||
          (dateValue !== '' && dateValue >= columnFilters.dateFrom)) &&
        (columnFilters.dateTo === '' ||
          (dateValue !== '' && dateValue <= columnFilters.dateTo)) &&
        statusMatches
      )
    })

    if (!columnSort.key) return filtered

    return filtered.sort((left, right) => {
      let leftValue
      let rightValue

      switch (columnSort.key) {
        case 'title':
          leftValue = left.title || ''
          rightValue = right.title || ''
          break
        case 'documentType':
          leftValue = knowledgeDocumentTypeLabel(left.documentType)
          rightValue = knowledgeDocumentTypeLabel(right.documentType)
          break
        case 'fileName':
          leftValue = left.fileName || ''
          rightValue = right.fileName || ''
          break
        case 'sizeBytes':
          leftValue = Number(left.sizeBytes ?? 0)
          rightValue = Number(right.sizeBytes ?? 0)
          break
        case 'createdAtUtc':
          leftValue = Date.parse(left.createdAtUtc || '') || 0
          rightValue = Date.parse(right.createdAtUtc || '') || 0
          break
        case 'linkedStatus':
          leftValue = activeSubject ? (linkedIds.has(left.id) ? 1 : 0) : -1
          rightValue = activeSubject ? (linkedIds.has(right.id) ? 1 : 0) : -1
          break
        default:
          return 0
      }

      let comparison

      if (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number'
      ) {
        comparison = leftValue - rightValue
      } else {
        comparison = String(leftValue ?? '').localeCompare(
          String(rightValue ?? ''),
          'fa',
          { numeric: true, sensitivity: 'base' },
        )
      }

      return columnSort.direction === 'desc'
        ? -comparison
        : comparison
    })
  }, [
    documents,
    linkedIds,
    activeSubject,
    columnFilters,
    columnSort,
  ])

  const hasKnowledgeColumnFilter = (key) => {
    if (key === 'size') {
      return columnFilters.minSize !== '' || columnFilters.maxSize !== ''
    }

    if (key === 'date') {
      return columnFilters.dateFrom !== '' || columnFilters.dateTo !== ''
    }

    return Boolean(columnFilters[key])
  }

  const clearKnowledgeColumnFilter = (key) => {
    setColumnFilters((current) => {
      const next = { ...current }

      if (key === 'size') {
        next.minSize = ''
        next.maxSize = ''
      } else if (key === 'date') {
        next.dateFrom = ''
        next.dateTo = ''
      } else {
        next[key] = ''
      }

      return next
    })

    setColumnFilterOpen('')
  }

  const clearAllKnowledgeColumnFilters = () => {
    setColumnFilters({
      documentType: '',
      fileName: '',
      minSize: '',
      maxSize: '',
      dateFrom: '',
      dateTo: '',
      linkedStatus: '',
    })
    setColumnSort({ key: '', direction: 'asc' })
    setColumnFilterOpen('')
    setSearch('')
    setTypeFilter('')
    setAppliedSearch('')
    setAppliedTypeFilter('')
  }
  const renderKnowledgeColumnHeader = (
    key,
    label,
    filterControl,
    clearKey = key,
  ) => (
    <th className="knowledge-filterable-th" key={key}>
      <div className="knowledge-column-heading">
        <span>{label}</span>

        <button
          className={
            'knowledge-column-filter-button' +
            (
              columnFilterOpen === key ||
              columnSort.key === key ||
              hasKnowledgeColumnFilter(clearKey)
                ? ' is-active'
                : ''
            )
          }
          type="button"
          aria-label={`${label} - \u0641\u06cc\u0644\u062a\u0631 \u0648 \u0645\u0631\u062a\u0628\u200c\u0633\u0627\u0632\u06cc`}
          aria-expanded={columnFilterOpen === key}
          title={`${label} - \u0641\u06cc\u0644\u062a\u0631 \u0648 \u0645\u0631\u062a\u0628\u200c\u0633\u0627\u0632\u06cc`}
          onClick={() =>
            setColumnFilterOpen((current) => current === key ? '' : key)
          }
        >
          <Filter size={15} />
        </button>

        {columnFilterOpen === key && (
          <div
            className="knowledge-column-menu"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="knowledge-column-menu-filter">
              {filterControl}
            </div>

            <div className="knowledge-column-menu-sort">
              <button
                type="button"
                onClick={() => {
                  setColumnSort({ key, direction: 'asc' })
                  setColumnFilterOpen('')
                }}
              >
                {'\u0635\u0639\u0648\u062f\u06cc'} {'\u2191'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setColumnSort({ key, direction: 'desc' })
                  setColumnFilterOpen('')
                }}
              >
                {'\u0646\u0632\u0648\u0644\u06cc'} {'\u2193'}
              </button>
            </div>

            <button
              className="knowledge-column-menu-clear"
              type="button"
              onClick={() => clearKnowledgeColumnFilter(clearKey)}
            >
              {'\u067e\u0627\u06a9 \u06a9\u0631\u062f\u0646 \u0641\u06cc\u0644\u062a\u0631'}
            </button>
          </div>
        )}
      </div>
    </th>
  )

  async function handleUpload(event) {
    event.preventDefault()
    setActionError('')
    setNotice('')

    if (!file) {
      setActionError('ابتدا فایل سند را انتخاب کنید.')
      return
    }

    setBusyAction('upload')

    try {
      const result = await knowledgeApi.upload({
        file,
        title,
        description,
        documentType,
      })

      if (!result.isSuccess) {
        setActionError(knowledgeErrorMessage(result))
        return
      }

      setNotice('سند با موفقیت ثبت شد.')
      setTitle('')
      setDescription('')
      setFile(null)
      setFileInputKey((key) => key + 1)
      setReloadKey((key) => key + 1)
    } catch {
      setActionError('هنگام ثبت سند خطای غیرمنتظره‌ای رخ داد.')
    } finally {
      setBusyAction('')
    }
  }

  function beginEditDocument(document) {
    setEditingDocument(document)
    setEditTitle(document.title || '')
    setEditDescription(document.description || '')
    setEditDocumentType(knowledgeDocumentTypeValue(document.documentType))
    setActionError('')
    setNotice('')
  }

  async function handleUpdateDocument(event) {
    event.preventDefault()

    if (!editingDocument) return

    const cleanTitle = editTitle.trim()
    if (!cleanTitle) {
      setActionError('عنوان سند الزامی است.')
      return
    }

    setActionError('')
    setNotice('')
    setBusyAction(`update:${editingDocument.id}`)

    try {
      const result = await knowledgeApi.update(editingDocument.id, {
        title: cleanTitle,
        description: editDescription.trim() || null,
        documentType: Number(editDocumentType),
      })

      if (!result.isSuccess) {
        setActionError(knowledgeErrorMessage(result))
        return
      }

      setNotice('مشخصات سند با موفقیت به‌روزرسانی شد.')
      setEditingDocument(null)
      setReloadKey((key) => key + 1)
    } catch {
      setActionError('هنگام ویرایش سند خطای غیرمنتظره‌ای رخ داد.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDownloadDocument(document) {
    setActionError('')
    setNotice('')
    setBusyAction(`download:${document.id}`)

    try {
      const result = await knowledgeApi.download(document.id)

      if (!result.isSuccess) {
        setActionError(knowledgeErrorMessage(result))
        return
      }

      const url = window.URL.createObjectURL(result.value)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = document.fileName || document.title || 'knowledge-document'
      anchor.style.display = 'none'

      window.document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)

      setNotice('دانلود سند آغاز شد.')
    } catch {
      setActionError('هنگام دانلود سند خطای غیرمنتظره‌ای رخ داد.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDeleteDocument(document) {
    const name = document.title || document.fileName || 'این سند'
    if (!window.confirm(`آیا از حذف «${name}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`)) {
      return
    }

    setActionError('')
    setNotice('')
    setBusyAction(`delete:${document.id}`)

    try {
      const result = await knowledgeApi.remove(document.id)

      if (!result.isSuccess) {
        setActionError(knowledgeErrorMessage(result))
        return
      }

      if (editingDocument?.id === document.id) {
        setEditingDocument(null)
      }

      setNotice('سند با موفقیت حذف شد.')
      setReloadKey((key) => key + 1)
    } catch {
      setActionError('هنگام حذف سند خطای غیرمنتظره‌ای رخ داد.')
    } finally {
      setBusyAction('')
    }
  }

  function handleSubjectSubmit(event) {
    event.preventDefault()
    setActionError('')
    setNotice('')

    const id = subjectId.trim()
    const guidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!subjectType.trim()) {
      setActionError('نوع آیتم را وارد کنید.')
      return
    }

    if (!guidPattern.test(id)) {
      setActionError('شناسه آیتم باید یک GUID معتبر باشد.')
      return
    }

    setActiveSubject({
      subjectType: subjectType.trim(),
      subjectId: id,
    })
    setNotice('آیتم انتخاب شد؛ اکنون می‌توانید اسناد را به آن متصل کنید.')
  }

  async function toggleDocumentLink(document) {
    if (!activeSubject) {
      setActionError('ابتدا یک آیتم معتبر انتخاب کنید.')
      return
    }

    setActionError('')
    setNotice('')

    const isLinked = linkedIds.has(document.id)
    setBusyAction(`link:${document.id}`)

    try {
      const result = isLinked
        ? await knowledgeApi.removeLink(document.id, activeSubject)
        : await knowledgeApi.addLink(document.id, {
            subjectType: activeSubject.subjectType,
            subjectId: activeSubject.subjectId,
          })

      if (!result.isSuccess) {
        setActionError(knowledgeErrorMessage(result))
        return
      }

      setNotice(
        isLinked
          ? 'ارتباط سند با آیتم حذف شد.'
          : 'سند با موفقیت به آیتم متصل شد.',
      )
      setReloadKey((key) => key + 1)
    } catch {
      setActionError('هنگام تغییر ارتباط سند خطای غیرمنتظره‌ای رخ داد.')
    } finally {
      setBusyAction('')
    }
  }

  function handleSearch(event) {
    event.preventDefault()
    setAppliedSearch(search.trim())
    setAppliedTypeFilter(typeFilter)
  }

  return (
    <>
      <TaskPageHeader
        title="مدیریت دانش"
        description="مدیریت اسناد و اتصال آن‌ها به پروژه‌ها و سایر آیتم‌های سامانه"
        action={null}
      />

      {actionError && (
        <p className="knowledge-message knowledge-message--error">
          {actionError}
        </p>
      )}

      {linkError && (
        <p className="knowledge-message knowledge-message--error">
          دریافت وضعیت ارتباط‌ها ناموفق بود: {linkError}
        </p>
      )}

      {notice && (
        <p className="knowledge-message knowledge-message--success">
          {notice}
        </p>
      )}

      <div className="knowledge-layout">
        <section className="task-panel">
          <div className="task-panel-title">
            <div>
              <h3>ثبت سند جدید</h3>
              <p>فایل را بارگذاری و مشخصات سند را ثبت کنید.</p>
            </div>
          </div>

          <form className="knowledge-form" onSubmit={handleUpload}>
            <FormField label="عنوان سند">
              <input
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="عنوان سند"
              />
            </FormField>

            <FormField label="نوع سند">
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
              >
                <option value="0">کتاب</option>
                <option value="1">نرم‌افزار</option>
                <option value="2">یادداشت</option>
                <option value="3">سایر</option>
                <option value="4">جزوه</option>
                <option value="5">درس‌آموخته</option>
                <option value="6">قالب</option>
                <option value="7">تصمیم</option>
              </select>
            </FormField>

            <FormField label="توضیحات" wide>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="توضیحات اختیاری"
              />
            </FormField>

            <FormField label="فایل سند" wide>
              <input
                key={fileInputKey}
                type="file"
                required
                onChange={(event) =>
                  setFile(event.target.files?.[0] || null)
                }
              />
            </FormField>

            <div className="knowledge-form-actions">
              <button
                className="knowledge-button"
                type="submit"
                disabled={busyAction === 'upload'}
              >
                {busyAction === 'upload' ? 'در حال بارگذاری...' : 'ثبت سند'}
              </button>
            </div>
          </form>
        </section>

        <section className="task-panel">
          <div className="task-panel-title">
            <div>
              <h3>انتخاب آیتم مرتبط</h3>
              <p>شناسه آیتم را وارد کنید تا امکان اتصال و قطع ارتباط فعال شود.</p>
            </div>
          </div>

          <form className="knowledge-form" onSubmit={handleSubjectSubmit}>
            <FormField label="نوع آیتم">
              <input
                required
                value={subjectType}
                onChange={(event) => setSubjectType(event.target.value)}
                placeholder="Project، Task یا Risk"
              />
            </FormField>

            <FormField label="شناسه آیتم (GUID)">
              <input
                required
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </FormField>

            <div className="knowledge-form-actions">
              <button className="knowledge-button" type="submit">
                انتخاب آیتم
              </button>
            </div>
          </form>

          {activeSubject && (
            <div className="knowledge-active-subject">
              <strong>آیتم فعال برای ارتباط:</strong>
              <span>{activeSubject.subjectType}</span>
              <code>{activeSubject.subjectId}</code>
            </div>
          )}
        </section>
      </div>

      {editingDocument && (
        <section className="task-panel knowledge-edit-panel">
          <div className="task-panel-title">
            <div>
              <h3>ویرایش سند</h3>
              <p>{editingDocument.fileName}</p>
            </div>
          </div>

          <form className="knowledge-form" onSubmit={handleUpdateDocument}>
            <FormField label="عنوان سند">
              <input
                required
                maxLength={200}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </FormField>

            <FormField label="نوع سند">
              <select
                value={editDocumentType}
                onChange={(event) => setEditDocumentType(event.target.value)}
              >
                <option value="0">کتاب</option>
                <option value="1">نرم‌افزار</option>
                <option value="2">یادداشت</option>
                <option value="3">سایر</option>
                <option value="4">جزوه</option>
                <option value="5">درس‌آموخته</option>
                <option value="6">قالب</option>
                <option value="7">تصمیم</option>
              </select>
            </FormField>

            <FormField label="توضیحات" wide>
              <textarea
                rows={3}
                maxLength={2000}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </FormField>

            <div className="knowledge-form-actions">
              <button
                className="knowledge-button"
                type="submit"
                disabled={busyAction === `update:${editingDocument.id}`}
              >
                {busyAction === `update:${editingDocument.id}` ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
              <button
                className="knowledge-button knowledge-button--secondary"
                type="button"
                disabled={busyAction === `update:${editingDocument.id}`}
                onClick={() => setEditingDocument(null)}
              >
                انصراف
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="task-panel task-table-panel">
        <div className="task-panel-title knowledge-list-heading">
          <div>
            <h3>فهرست اسناد</h3>
            <p>
              {visibleDocuments.length.toLocaleString('fa-IR')} سند
              {activeSubject ? ' — وضعیت ارتباط با آیتم فعال نمایش داده می‌شود.' : ''}
            </p>
          </div>

          <form className="knowledge-searchbar" onSubmit={handleSearch}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جست‌وجو در عنوان و توضیحات"
              aria-label="جست‌وجوی اسناد"
            />

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="فیلتر نوع سند"
            >
              <option value="">همه انواع</option>
              <option value="0">کتاب</option>
              <option value="1">نرم‌افزار</option>
              <option value="2">یادداشت</option>
              <option value="3">سایر</option>
              <option value="4">جزوه</option>
                <option value="5">درس‌آموخته</option>
                <option value="6">قالب</option>
                <option value="7">تصمیم</option>
            </select>

            <button className="knowledge-button" type="submit">
              جست‌وجو
            </button>
          </form>
        </div>

        {(Object.values(columnFilters).some((value) => value !== '') || Boolean(columnSort.key)) && (
          <div className="knowledge-filter-reset-bar">
            <span>{'\u0641\u06cc\u0644\u062a\u0631 \u06cc\u0627 \u0645\u0631\u062a\u0628\u200c\u0633\u0627\u0632\u06cc \u0641\u0639\u0627\u0644 \u0627\u0633\u062a.'}</span>
            <button
              className="knowledge-button knowledge-button--secondary"
              type="button"
              onClick={clearAllKnowledgeColumnFilters}
            >
              {'\u067e\u0627\u06a9 \u06a9\u0631\u062f\u0646 \u0647\u0645\u0647 \u0641\u06cc\u0644\u062a\u0631\u0647\u0627'}
            </button>
          </div>
        )}
        <DataState
          loading={loading}
          error={error}
          empty={!documents.length}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{'\u0639\u0646\u0648\u0627\u0646 \u0633\u0646\u062f'}</th>
                  {renderKnowledgeColumnHeader(
                    'documentType',
                    '\u0646\u0648\u0639',
                    <select
                      value={columnFilters.documentType}
                      onChange={(event) => setColumnFilters((current) => ({ ...current, documentType: event.target.value }))}
                      aria-label={'\u0641\u06cc\u0644\u062a\u0631 \u0646\u0648\u0639 \u0633\u0646\u062f'}
                    >
                      <option value="">{'\u0647\u0645\u0647 \u0627\u0646\u0648\u0627\u0639'}</option>
                      <option value="0">{'\u06a9\u062a\u0627\u0628'}</option>
                      <option value="1">{'\u0646\u0631\u0645\u200c\u0627\u0641\u0632\u0627\u0631'}</option>
                      <option value="2">{'\u06cc\u0627\u062f\u062f\u0627\u0634\u062a'}</option>
                      <option value="3">{'\u0633\u0627\u06cc\u0631'}</option>
                      <option value="4">{'\u062c\u0632\u0648\u0647'}</option>
                      <option value="5">{'\u062f\u0631\u0633\u200c\u0622\u0645\u0648\u062e\u062a\u0647'}</option>
                      <option value="6">{'\u0642\u0627\u0644\u0628'}</option>
                      <option value="7">{'\u062a\u0635\u0645\u06cc\u0645'}</option>
                    </select>,
                  )}

                  {renderKnowledgeColumnHeader(
                    'fileName',
                    '\u0646\u0627\u0645 \u0641\u0627\u06cc\u0644',
                    <input
                      type="search"
                      value={columnFilters.fileName}
                      onChange={(event) => setColumnFilters((current) => ({ ...current, fileName: event.target.value }))}
                      placeholder={'\u0641\u06cc\u0644\u062a\u0631 \u0646\u0627\u0645 \u0641\u0627\u06cc\u0644'}
                      aria-label={'\u0641\u06cc\u0644\u062a\u0631 \u0646\u0627\u0645 \u0641\u0627\u06cc\u0644'}
                    />,
                  )}

                  {renderKnowledgeColumnHeader(
                    'sizeBytes',
                    '\u062d\u062c\u0645',
                    <div className="knowledge-size-filter-grid">
                      <label>
                        <span>{'\u062d\u062f\u0627\u0642\u0644 \u062d\u062c\u0645 (KB)'}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={columnFilters.minSize}
                          onChange={(event) => setColumnFilters((current) => ({ ...current, minSize: event.target.value }))}
                          aria-label={'\u062d\u062f\u0627\u0642\u0644 \u062d\u062c\u0645 \u0628\u0647 \u06a9\u06cc\u0644\u0648\u0628\u0627\u06cc\u062a'}
                        />
                      </label>

                      <label>
                        <span>{'\u062d\u062f\u0627\u06a9\u062b\u0631 \u062d\u062c\u0645 (KB)'}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={columnFilters.maxSize}
                          onChange={(event) => setColumnFilters((current) => ({ ...current, maxSize: event.target.value }))}
                          aria-label={'\u062d\u062f\u0627\u06a9\u062b\u0631 \u062d\u062c\u0645 \u0628\u0647 \u06a9\u06cc\u0644\u0648\u0628\u0627\u06cc\u062a'}
                        />
                      </label>
                    </div>,
                    'size',
                  )}

                  {renderKnowledgeColumnHeader(
                    'createdAtUtc',
                    '\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a',
                    <div className="knowledge-date-filter-grid">
                      <label>
                        <span>{'\u0627\u0632 \u062a\u0627\u0631\u06cc\u062e'}</span>
                        <input
                          type="date"
                          value={columnFilters.dateFrom}
                          onChange={(event) => setColumnFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                          aria-label={'\u0627\u0632 \u062a\u0627\u0631\u06cc\u062e'}
                        />
                      </label>

                      <label>
                        <span>{'\u062a\u0627 \u062a\u0627\u0631\u06cc\u062e'}</span>
                        <input
                          type="date"
                          value={columnFilters.dateTo}
                          onChange={(event) => setColumnFilters((current) => ({ ...current, dateTo: event.target.value }))}
                          aria-label={'\u062a\u0627 \u062a\u0627\u0631\u06cc\u062e'}
                        />
                      </label>
                    </div>,
                    'date',
                  )}

                  {renderKnowledgeColumnHeader(
                    'linkedStatus',
                    '\u0648\u0636\u0639\u06cc\u062a \u0627\u0631\u062a\u0628\u0627\u0637',
                    <select
                      value={columnFilters.linkedStatus}
                      onChange={(event) => setColumnFilters((current) => ({ ...current, linkedStatus: event.target.value }))}
                      aria-label={'\u0641\u06cc\u0644\u062a\u0631 \u0648\u0636\u0639\u06cc\u062a \u0627\u0631\u062a\u0628\u0627\u0637'}
                    >
                      <option value="">{'\u0647\u0645\u0647 \u0648\u0636\u0639\u06cc\u062a\u200c\u0647\u0627'}</option>

                      {activeSubject ? (
                        <>
                          <option value="linked">{'\u0645\u0631\u062a\u0628\u0637'}</option>
                          <option value="unlinked">{'\u0646\u0627\u0645\u0631\u062a\u0628\u0637'}</option>
                        </>
                      ) : (
                        <option value="none">{'\u0622\u06cc\u062a\u0645\u06cc \u0627\u0646\u062a\u062e\u0627\u0628 \u0646\u0634\u062f\u0647'}</option>
                      )}
                    </select>,
                  )}

                  <th>{'\u0639\u0645\u0644\u06cc\u0627\u062a'}</th>
                </tr>
              </thead>
              <tbody>
                {visibleDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="knowledge-filter-empty">
                      <span>{'\u0647\u06cc\u0686 \u0633\u0646\u062f\u06cc \u0628\u0627 \u0641\u06cc\u0644\u062a\u0631\u0647\u0627\u06cc \u0641\u0639\u0644\u06cc \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</span>
                      <button
                        className="knowledge-button knowledge-button--secondary"
                        type="button"
                        onClick={clearAllKnowledgeColumnFilters}
                      >
                        {'\u067e\u0627\u06a9 \u06a9\u0631\u062f\u0646 \u0647\u0645\u0647 \u0641\u06cc\u0644\u062a\u0631\u0647\u0627'}
                      </button>
                    </td>
                  </tr>
                ) : visibleDocuments.map((document) => {
                  const isLinked = linkedIds.has(document.id)
                  const actionBusy = busyAction.endsWith(`:${document.id}`)

                  return (
                    <tr key={document.id}>
                      <td>
                        <strong>{document.title || 'بدون عنوان'}</strong>
                        {document.description && (
                          <small className="knowledge-description">
                            {document.description}
                          </small>
                        )}
                      </td>
                      <td>
                        {knowledgeDocumentTypeLabel(document.documentType)}
                      </td>
                      <td>{document.fileName || '—'}</td>
                      <td>{formatBytes(document.sizeBytes)}</td>
                      <td>{formatDateTime(document.createdAtUtc)}</td>
                      <td>
                        {!activeSubject
                          ? 'آیتمی انتخاب نشده'
                          : loadingLinks
                            ? 'در حال بررسی...'
                            : isLinked
                              ? 'مرتبط'
                              : 'نامرتبط'}
                      </td>
                      <td>
                        <div className="knowledge-row-actions">
                          <button
                            className="knowledge-button knowledge-button--secondary"
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleDownloadDocument(document)}
                          >
                            {busyAction === `download:${document.id}` ? 'در حال دانلود...' : 'دانلود'}
                          </button>

                          <button
                            className="knowledge-button knowledge-button--secondary"
                            type="button"
                            disabled={actionBusy}
                            onClick={() => beginEditDocument(document)}
                          >
                            ویرایش
                          </button>

                          <button
                            className="knowledge-button knowledge-button--danger"
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleDeleteDocument(document)}
                          >
                            {busyAction === `delete:${document.id}` ? 'در حال حذف...' : 'حذف'}
                          </button>

                          <button
                            className={
                              isLinked
                                ? 'knowledge-button knowledge-button--danger'
                                : 'knowledge-button knowledge-button--secondary'
                            }
                            type="button"
                            disabled={!activeSubject || loadingLinks || actionBusy}
                            onClick={() => toggleDocumentLink(document)}
                          >
                            {busyAction === `link:${document.id}`
                              ? 'در حال انجام...'
                              : isLinked
                                ? 'قطع ارتباط'
                                : 'اتصال به آیتم'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>
    </>
  )
}

function ProjectDocuments({ data }) {
  return (
    <>
      <TaskPageHeader title="مدیریت مستندات" description="لیست مستندات پروژه از Project Documents API" actionNode={<CreateButton kind="document" data={data} label="آپلود سند" />}>
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <section className="task-panel task-table-panel">
        <DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.documents.length}>
          <div className="table-scroll"><table><thead><tr><th>عنوان/توضیح</th><th>نوع</th><th>فایل</th><th>حجم</th><th>تاریخ ثبت</th><th>وضعیت تأیید</th></tr></thead><tbody>
            {data.documents.map((item) => <tr key={item.id}><td><strong>{item.description}</strong></td><td>{enumLabel(item.documentType, documentTypeLabels)}</td><td>{item.fileName}</td><td>{formatBytes(item.sizeBytes)}</td><td>{formatDateOnly(item.registerDate)}</td><td>{enumLabel(item.approvalStatus, approvalLabels)}</td></tr>)}
          </tbody></table></div>
        </DataState>
      </section>
    </>
  )
}

function ProjectProgress({ data }) {
  const latest = [...data.progressUpdates].sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate)))[0]
  return (
    <>
      <TaskPageHeader title="کنترل پیشرفت پروژه" description="گزارش‌های پیشرفت ثبت‌شده در Core" actionNode={<CreateButton kind="progress" data={data} label="ثبت گزارش پیشرفت" />}>
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.selectedProject}>
        <div className="task-kpis">
          <article><span className="task-kpi-icon navy"><TrendingUp size={21} /></span><div><small>پیشرفت برنامه‌ای</small><strong>{Number(latest?.plannedProgress || 0).toLocaleString('fa-IR')}٪</strong><p>آخرین گزارش</p></div></article>
          <article><span className="task-kpi-icon green"><CheckCircle2 size={21} /></span><div><small>پیشرفت واقعی</small><strong>{Number(latest?.actualProgress || 0).toLocaleString('fa-IR')}٪</strong><p>{enumLabel(latest?.performanceClassification, performanceLabels)}</p></div></article>
          <article><span className="task-kpi-icon red"><TriangleAlert size={21} /></span><div><small>انحراف</small><strong>{Number(latest?.deviation || 0).toLocaleString('fa-IR')}٪</strong><p>Actual - Planned</p></div></article>
          <article><span className="task-kpi-icon blue"><FileText size={21} /></span><div><small>تعداد گزارش‌ها</small><strong>{data.progressUpdates.length.toLocaleString('fa-IR')}</strong><p>Progress Updates</p></div></article>
        </div>
        <section className="task-panel task-table-panel">
          <div className="task-panel-title"><div><h3>تاریخچه گزارش پیشرفت</h3><p>داده‌های ثبت‌شده برای پروژه منتخب</p></div></div>
          <DataState loading={data.loadingDetails} empty={!data.progressUpdates.length}>
            <div className="table-scroll"><table><thead><tr><th>تاریخ</th><th>شرح وضعیت</th><th>برنامه‌ای</th><th>واقعی</th><th>انحراف</th><th>طبقه‌بندی</th><th>دلایل تأخیر</th></tr></thead><tbody>
              {data.progressUpdates.map((item) => <tr key={item.id}><td>{formatDateOnly(item.registerDate)}</td><td><strong>{item.statusDescription || '—'}</strong></td><td>{Number(item.plannedProgress || 0).toLocaleString('fa-IR')}٪</td><td>{Number(item.actualProgress || 0).toLocaleString('fa-IR')}٪</td><td>{Number(item.deviation || 0).toLocaleString('fa-IR')}٪</td><td>{enumLabel(item.performanceClassification, performanceLabels)}</td><td>{item.delayReasons || '—'}</td></tr>)}
            </tbody></table></div>
          </DataState>
        </section>
      </DataState>
    </>
  )
}

function ProjectStrategic({ data }) {
  return (
    <>
      <TaskPageHeader title="مدیریت استراتژیک پروژه‌ها" description="نمای خلاصه پروژه، خروجی‌ها و KPIهای موجود در Core" actionNode={<CreateButton kind="deliverable" data={data} label="تعریف خروجی" />}>
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.selectedProject}>
        <section className="task-dashboard-grid">
          <div className="task-panel task-table-panel">
            <div className="task-panel-title"><div><h3>خروجی‌های پروژه</h3><p>Deliverables API</p></div><CreateButton kind="deliverable" data={data} label="تعریف خروجی" /></div>
            <DataState loading={data.loadingDetails} empty={!data.deliverables.length}>
              <div className="table-scroll"><table><thead><tr><th>خروجی</th><th>وضعیت</th><th>مسئول</th></tr></thead><tbody>{data.deliverables.map((item) => <tr key={item.id}><td><strong>{item.title || item.name || item.description || item.id}</strong></td><td>{compactEnumLabel(item.status, deliverableStatusLabels)}</td><td>{data.userName(item.responsibleUserId)}</td></tr>)}</tbody></table></div>
            </DataState>
          </div>
          <div className="task-panel task-table-panel">
            <div className="task-panel-title"><div><h3>KPIها</h3><p>KPI API</p></div><CreateButton kind="kpi" data={data} label="تعریف KPI" /></div>
            <DataState loading={data.loadingDetails} empty={!data.kpis.length}>
              <div className="table-scroll"><table><thead><tr><th>شاخص</th><th>نوع</th><th>هدف</th><th>فرمول</th></tr></thead><tbody>{data.kpis.map((item) => <tr key={item.id}><td><strong>{item.description || item.name || item.title || item.id}</strong></td><td>{compactEnumLabel(item.type, kpiTypeLabels)}</td><td>{item.targetValue ?? item.target ?? '—'}</td><td>{item.formula || '—'}</td></tr>)}</tbody></table></div>
            </DataState>
          </div>
        </section>
      </DataState>
    </>
  )
}

function Meetings() {
  const meetings = [
    ['جلسه هفتگی کنترل پروژه', 'پروژه توسعه مرکز تجاری', 'امروز، ساعت ۱۴:۰۰', 'اتاق جلسات شماره ۲', 'در پیش رو'],
    ['بررسی نقشه‌های فاز اجرایی', 'برج اداری روزت', 'دوشنبه، ساعت ۱۰:۳۰', 'جلسه آنلاین', 'در پیش رو'],
    ['هماهنگی پیمانکاران تأسیسات', 'مجتمع مسکونی آفتاب', '۲۸ مرداد ۱۴۰۵', 'دفتر کارگاه', 'برگزار شده'],
  ]
  return <><TaskPageHeader title="جلسات و صورت‌جلسات" description="برنامه‌ریزی جلسات، ثبت صورت‌جلسه و تخصیص بندهای اجرایی" action={null} /><div className="meeting-summary"><article><CalendarDays size={22} /><div><strong>۵</strong><span>جلسه پیش رو</span></div></article><article><FileText size={22} /><div><strong>۱۲</strong><span>بند اجرایی باز</span></div></article><article><CheckCircle2 size={22} /><div><strong>۸</strong><span>صورت‌جلسه نهایی‌شده</span></div></article></div><section className="task-panel meetings-list"><div className="task-panel-title"><div><h3>جلسات اخیر و پیش رو</h3><p>فهرست جلسات مرتبط با پروژه‌های شما</p></div><div className="view-switch"><button className="active">همه</button><button>پیش رو</button><button>گذشته</button></div></div>{meetings.map(([title, project, time, location, status]) => <article key={title}><span className="meeting-date"><b>{time.split(' ')[0]}</b><small>{time.replace(time.split(' ')[0], '')}</small></span><div className="meeting-info"><h4>{title}</h4><p>{project}</p><span>{location === 'جلسه آنلاین' ? <Video size={14} /> : <Users2 size={14} />}{location}</span></div><div className="meeting-meta"><StatusPill status={status === 'برگزار شده' ? 'تکمیل شده' : 'در حال انجام'} /><button>{status === 'برگزار شده' ? 'مشاهده صورت‌جلسه' : 'ورود به جلسه'}</button></div></article>)}</section></>
}

function Workflows() {
  const flows = [['گردش کار وظایف اجرایی','پیش‌نویس، در حال انجام، بازبینی، تأیید نهایی','۳ پروژه','فعال'],['فرآیند بررسی مستندات','ثبت، بررسی کارشناس، اصلاح، تأیید مدیر','۲ پروژه','فعال'],['الگوی درخواست تغییر','ثبت درخواست، ارزیابی اثر، کمیته تغییر، اجرا','تمام پروژه‌ها','پیش‌نویس']]
  return <><TaskPageHeader title="گردش کار و الگوها" description="تعریف مراحل و قوانین گردش وظایف به تفکیک پروژه" action={null} /><section className="workflow-help"><Workflow size={28} /><div><h3>فرآیندهای کاری را با پروژه خود هماهنگ کنید</h3><p>وضعیت‌ها، مسئول هر مرحله و قوانین انتقال را بدون نیاز به کدنویسی تعریف کنید.</p></div><button>راهنمای طراحی گردش کار</button></section><div className="workflow-grid">{flows.map(([title, steps, projects, status], index) => <article key={title}><header><span className={`workflow-icon tone-${index}`}><Workflow size={20} /></span><MoreHorizontal size={18} /></header><h3>{title}</h3><p>{steps}</p><div className="flow-steps">{[1,2,3,4].map((step) => <i key={step} />)}</div><footer><span>{projects}</span><StatusPill status={status === 'فعال' ? 'تکمیل شده' : 'برای انجام'} /></footer></article>)}</div></>
}

function RaciMatrix({ data }) {
  const people = data.governanceRoles.length ? data.governanceRoles : data.teamMembers.map((member) => ({ id: member.id, title: member.roleTitle || 'عضو تیم', userId: member.userId }))
  const rows = [...data.activities, ...data.deliverables].slice(0, 8)
  return <><TaskPageHeader title="ماتریس مسئولیت‌ها (RACI)" description="Core نقش‌های حاکمیتی دارد، ولی RACI واقعی به‌عنوان endpoint مستقل ندارد" actionNode={<CreateButton kind="activity" data={data} label="افزودن فعالیت" />}><ProjectSelector data={data} /></TaskPageHeader><div className="raci-legend"><span><i className="r">R</i>مسئول اجرا</span><span><i className="a">A</i>پاسخگو</span><span><i className="c">C</i>مشاور</span><span><i className="i">I</i>مطلع</span></div><section className="task-panel raci-table"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!rows.length || !people.length}><div className="table-scroll"><table><thead><tr><th>فعالیت / خروجی</th>{people.slice(0, 5).map((person) => <th key={person.id}><span className="person-head"><i>{initialsOf(data.userName(person.userId)).slice(0, 1)}</i>{data.userName(person.userId)}<small>{person.title}</small></span></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || row.title || row.description || row.id}</strong></td>{people.slice(0, 5).map((person, index) => <td key={person.id}><span className={`raci-role ${index === 0 ? 'a' : row.responsibleUserId === person.userId ? 'r' : index === 1 ? 'c' : 'i'}`}>{index === 0 ? 'A' : row.responsibleUserId === person.userId ? 'R' : index === 1 ? 'C' : 'I'}</span></td>)}</tr>)}</tbody></table></div></DataState></section></>
}

function RisksPage({ data }) {
  return <><TaskPageHeader title="مدیریت ریسک" description="ریسک‌های پروژه از Risks API" actionNode={<CreateButton kind="risk" data={data} label="ثبت ریسک" />}><ProjectSelector data={data} /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.risks.length}><div className="table-scroll"><table><thead><tr><th>ریسک</th><th>احتمال</th><th>شدت</th><th>اثر</th><th>RPN</th><th>مالک</th><th>برنامه پاسخ</th></tr></thead><tbody>{data.risks.map((risk) => <tr key={risk.id}><td><strong>{risk.description}</strong></td><td>{risk.probabilityScore}</td><td>{risk.severityScore}</td><td>{risk.impactScore}</td><td>{risk.rpn}</td><td>{data.userName(risk.riskOwnerUserId)}</td><td>{risk.responsePlan || '—'}</td></tr>)}</tbody></table></div></DataState></section></>
}

function ResourcesPage({ data }) {
  return <><TaskPageHeader title="مدیریت منابع" description="منابع انسانی فعلاً از Project Team API پوشش داده می‌شود" actionNode={<CreateButton kind="member" data={data} label="افزودن عضو" />}><ProjectSelector data={data} /><CreateButton kind="governance" data={data} label="تعریف نقش حاکمیتی" /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.teamMembers.length}><div className="table-scroll"><table><thead><tr><th>نام عضو</th><th>نقش پروژه</th><th>شناسه کاربر</th></tr></thead><tbody>{data.teamMembers.map((member) => <tr key={member.id}><td><span className="owner-cell"><i>{initialsOf(data.userName(member.userId)).slice(0, 1)}</i><strong>{data.userName(member.userId)}</strong></span></td><td>{member.roleTitle || '—'}</td><td>{member.userId}</td></tr>)}</tbody></table></div></DataState></section></>
}

function StakeholdersPage({ data }) {
  return <><TaskPageHeader title="مدیریت ذینفعان" description="ذینفعان پروژه از Stakeholders API" actionNode={<CreateButton kind="stakeholder" data={data} label="ثبت ذینفع" />}><ProjectSelector data={data} /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.stakeholders.length}><div className="table-scroll"><table><thead><tr><th>نام</th><th>نوع</th><th>قدرت</th><th>علاقه</th><th>انتظارات</th><th>استراتژی تعامل</th></tr></thead><tbody>{data.stakeholders.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.isInternal ? 'داخلی' : 'خارجی'}</td><td>{compactEnumLabel(item.power, stakeholderLevelLabels)}</td><td>{compactEnumLabel(item.interest, stakeholderLevelLabels)}</td><td>{item.expectations || '—'}</td><td>{item.engagementStrategy || '—'}</td></tr>)}</tbody></table></div></DataState></section></>
}

function CostPage({ data }) {
  return <><TaskPageHeader title="مدیریت هزینه" description="Core فعلاً فقط Cost کلی پروژه را پوشش می‌دهد" action={null}><ProjectSelector data={data} /></TaskPageHeader><section className="empty-page"><div><WalletCards size={38} /></div><h1>{data.selectedProject?.cost ? Number(data.selectedProject.cost).toLocaleString('fa-IR') : 'هزینه ثبت نشده'}</h1><p>برای مدیریت هزینه واقعی، endpointهای بودجه، هزینه واقعی، پیش‌بینی و آیتم‌های هزینه لازم است.</p></section></>
}

function UnsupportedProjectArea({ title, message }) {
  return <section className="empty-page"><div><Boxes size={38} /></div><h1>{title}</h1><p>{message}</p></section>
}

function TaskManagement({ active, data }) {
  if (active === 'همه وظایف') return <AllTasks data={data} />
  if (active === 'برد کانبان') return <KanbanBoard data={data} />
  if (active === 'تقویم پروژه') return <ProjectCalendar data={data} />
  if (active === 'جلسات و صورت‌جلسات') return <Meetings />
  if (active === 'گردش کار و الگوها') return <Workflows />
  if (active === 'ماتریس مسئولیت‌ها (RACI)') return <RaciMatrix data={data} />
  return <TaskDashboard data={data} />
}

function ProjectManagement({ active, data }) {
  if (active === 'برنامه‌ریزی پروژه') return <ProjectPlanning data={data} />
  if (active === 'مدیریت مستندات') return <ProjectDocuments data={data} />
  if (active === 'کنترل پیشرفت پروژه') return <ProjectProgress data={data} />
  if (active === 'مدیریت استراتژیک پروژه‌ها') return <ProjectStrategic data={data} />
  return <ProjectPlanning data={data} />
}

function ControlManagement({ active, data }) {
  if (active === 'مدیریت ریسک') return <RisksPage data={data} />
  if (active === 'مدیریت منابع') return <ResourcesPage data={data} />
  if (active === 'مدیریت هزینه') return <CostPage data={data} />
  if (active === 'مدیریت ذینفعان') return <StakeholdersPage data={data} />
  if (active === 'مدیریت تأمین‌کنندگان') return <UnsupportedProjectArea title={active} message="در Core فعلی endpoint مستقلی برای تأمین‌کنندگان پروژه پیدا نشد." />
  if (active === 'مدیریت تغییرات') return <UnsupportedProjectArea title={active} message="در Core فعلی endpoint مستقلی برای change request یا مدیریت تغییرات پیدا نشد." />
  return null
}

/* ------------------------------------------------------------------ *
 * Chat - direct conversations only.                                   *
 * Uses its own `rz-chat` class namespace so the layout does not depend *
 * on the original mock's fixed-row grid, which could not scroll.       *
 * ------------------------------------------------------------------ */

const CHAT_TONES = 5

function chatDayLabel(value) {
  if (!value) return ''
  const normalized = typeof value === 'string' && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? `${value}Z` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(date, today)) return 'امروز'
  if (sameDay(date, yesterday)) return 'دیروز'
  try {
    return date.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

function ChatPage() {
  const {
    conversations, directory, directoryError,
    activeId, setActiveId, messages,
    connection, loadingConversations, loadingMessages, sending,
    error, setError, sendMessage, startDirect, refresh,
  } = useChat(true)

  const { user } = useAuth()
  const [draft, setDraft] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [mobilePane, setMobilePane] = useState('list')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const nameOf = useMemo(() => {
    const map = new Map(directory.map((u) => [u.id, u.displayName]))
    return (id) => map.get(id) || 'کاربر'
  }, [directory])

  // A direct conversation carries no Title; its label is the other participant.
  const decorated = useMemo(() => conversations.map((c) => {
    const counterpartId = (c.participantIds || []).find((id) => id !== user?.id)
    return {
      ...c,
      counterpartId,
      displayTitle: c.title || (counterpartId ? nameOf(counterpartId) : 'گفت‌وگوی مستقیم'),
    }
  }), [conversations, nameOf, user?.id])

  const visible = useMemo(
    () => decorated.filter((c) => !listSearch || c.displayTitle.includes(listSearch)),
    [decorated, listSearch],
  )

  const selected = decorated.find((c) => c.id === activeId) || null

  const shown = useMemo(
    () => (messageSearch ? messages.filter((m) => m.text?.includes(messageSearch)) : messages),
    [messages, messageSearch],
  )

  // Insert a day separator whenever the calendar day changes.
  const timeline = useMemo(() => {
    const rows = []
    let lastDay = null
    for (const message of shown) {
      const day = chatDayLabel(message.sentAt)
      if (day && day !== lastDay) {
        rows.push({ kind: 'day', id: `day-${day}-${message.id}`, label: day })
        lastDay = day
      }
      rows.push({ kind: 'message', id: message.id, message })
    }
    return rows
  }, [shown])

  const availableContacts = useMemo(() => directory
    .filter((u) => u.id !== user?.id)
    .filter((u) => !pickerSearch || u.displayName?.includes(pickerSearch) || u.email?.includes(pickerSearch)),
    [directory, user?.id, pickerSearch])

  const status = connection === 'connected'
    ? { label: 'برخط', tone: 'online' }
    : connection === 'reconnecting' || connection === 'connecting'
      ? { label: 'در حال اتصال', tone: 'pending' }
      : { label: 'اتصال بی‌درنگ برقرار نیست', tone: 'offline' }

  // Stick to the newest message, unless the user is reading search results.
  useEffect(() => {
    if (messageSearch) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [timeline.length, activeId, messageSearch])

  function openConversation(id) {
    setActiveId(id)
    setMessageSearch('')
    setSearchOpen(false)
    setMobilePane('conversation')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function handleSend(event) {
    event?.preventDefault()
    const text = draft
    if (!text.trim() || sending) return
    setDraft('')
    const ok = await sendMessage(text)
    if (!ok) setDraft(text)
    inputRef.current?.focus()
  }

  function handleKeyDown(event) {
    // Enter sends, Shift+Enter is reserved for a future multi-line composer.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  async function pickContact(contactId) {
    const id = await startDirect(contactId)
    setPickerOpen(false)
    setPickerSearch('')
    if (id) openConversation(id)
  }

  return (
    <div className="rz-chat">
      <header className="rz-chat__heading">
        <div>
          <span>ارتباطات سازمانی</span>
          <h1>چت و گفت‌وگوی آنلاین</h1>
          <p>گفت‌وگوی مستقیم و امن با همکاران</p>
        </div>
        <div className="rz-chat__heading-actions">
          <span className={`rz-chat__status rz-chat__status--${status.tone}`}><i />{status.label}</span>
          <button type="button" onClick={refresh} title="به‌روزرسانی"><RefreshCw size={16} />به‌روزرسانی</button>
        </div>
      </header>

      <div className={`rz-chat__shell rz-chat__shell--${mobilePane}`}>
        {/* ---------- conversation list ---------- */}
        <aside className="rz-chat__sidebar">
          <div className="rz-chat__sidebar-head">
            <div>
              <h3>گفت‌وگوها</h3>
              <small>{visible.length} مورد</small>
            </div>
            <button
              type="button"
              className={`rz-chat__new ${pickerOpen ? 'is-open' : ''}`}
              onClick={() => { setPickerOpen((v) => !v); setPickerSearch('') }}
              title={pickerOpen ? 'بستن' : 'گفت‌وگوی جدید'}
            >
              {pickerOpen ? <X size={18} /> : <Plus size={18} />}
            </button>
          </div>

          <label className="rz-chat__search">
            <Search size={16} />
            <input value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="جست‌وجوی گفت‌وگو..." />
            {listSearch && <button type="button" onClick={() => setListSearch('')}><X size={14} /></button>}
          </label>

          {pickerOpen ? (
            <div className="rz-chat__picker">
              <label className="rz-chat__search rz-chat__search--inner">
                <Search size={16} />
                <input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="نام یا ایمیل همکار..." />
              </label>
              <div className="rz-chat__scroll">
                {availableContacts.map((contact, index) => (
                  <button type="button" key={contact.id} className="rz-chat__row" onClick={() => pickContact(contact.id)}>
                    <span className={`rz-chat__avatar tone-${index % CHAT_TONES}`}>{initialsOf(contact.displayName)}</span>
                    <span className="rz-chat__row-body">
                      <strong>{contact.displayName}</strong>
                      <small>{contact.email}</small>
                    </span>
                  </button>
                ))}
                {!availableContacts.length && (
                  <p className="rz-chat__empty">{directoryError || 'همکاری برای شروع گفت‌وگو یافت نشد.'}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rz-chat__scroll">
              {loadingConversations && <p className="rz-chat__empty">در حال بارگذاری...</p>}
              {!loadingConversations && visible.map((conversation, index) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={`rz-chat__row ${activeId === conversation.id ? 'is-active' : ''}`}
                  onClick={() => openConversation(conversation.id)}
                >
                  <span className={`rz-chat__avatar tone-${index % CHAT_TONES}`}>{initialsOf(conversation.displayTitle)}</span>
                  <span className="rz-chat__row-body">
                    <strong>{conversation.displayTitle}</strong>
                    <small>{conversation.lastMessage || 'هنوز پیامی رد و بدل نشده'}</small>
                  </span>
                  <time>{formatTime(conversation.lastMessageAt)}</time>
                </button>
              ))}
              {!loadingConversations && !visible.length && (
                <div className="rz-chat__empty rz-chat__empty--cta">
                  <MessageCircle size={30} />
                  <p>{listSearch ? 'گفت‌وگویی با این نام پیدا نشد.' : 'هنوز گفت‌وگویی ندارید.'}</p>
                  {!listSearch && <button type="button" onClick={() => setPickerOpen(true)}><Plus size={16} />شروع گفت‌وگوی جدید</button>}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* ---------- conversation ---------- */}
        <section className="rz-chat__main">
          {selected ? (
            <>
              <header className="rz-chat__main-head">
                <button type="button" className="rz-chat__back" onClick={() => setMobilePane('list')} title="بازگشت"><ChevronLeft size={20} /></button>
                <span className="rz-chat__avatar tone-0">{initialsOf(selected.displayTitle)}</span>
                <div className="rz-chat__main-title">
                  <strong>{selected.displayTitle}</strong>
                  <small>گفت‌وگوی مستقیم · {status.label}</small>
                </div>
                <button
                  type="button"
                  className={`rz-chat__icon ${searchOpen ? 'is-active' : ''}`}
                  onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setMessageSearch('') }}
                  title="جست‌وجو در پیام‌ها"
                >
                  <Search size={18} />
                </button>
              </header>

              {searchOpen && (
                <div className="rz-chat__msg-search">
                  <Search size={16} />
                  <input autoFocus value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="جست‌وجو در این گفت‌وگو..." />
                  <small>{messageSearch ? `${shown.length} نتیجه` : `${messages.length} پیام`}</small>
                  <button type="button" onClick={() => { setMessageSearch(''); setSearchOpen(false) }}><X size={16} /></button>
                </div>
              )}

              <div className="rz-chat__messages" ref={scrollRef}>
                {loadingMessages && <p className="rz-chat__empty">در حال بارگذاری پیام‌ها...</p>}

                {!loadingMessages && timeline.map((row) => row.kind === 'day' ? (
                  <span className="rz-chat__day" key={row.id}>{row.label}</span>
                ) : (
                  <article className={`rz-chat__bubble ${row.message.isOwnMessage ? 'is-mine' : ''}`} key={row.id}>
                    {!row.message.isOwnMessage && (
                      <span className="rz-chat__bubble-avatar">{initialsOf(nameOf(row.message.senderUserId)).slice(0, 1)}</span>
                    )}
                    <div className="rz-chat__bubble-body">
                      {!row.message.isOwnMessage && <strong>{nameOf(row.message.senderUserId)}</strong>}
                      <p>{row.message.text}</p>
                      <time>{formatTime(row.message.sentAt)}{row.message.isOwnMessage && <CheckCheck size={13} />}</time>
                    </div>
                  </article>
                ))}

                {!loadingMessages && !messages.length && (
                  <div className="rz-chat__empty rz-chat__empty--cta">
                    <MessageCircle size={30} />
                    <p>اولین پیام را بفرستید.</p>
                  </div>
                )}
                {!loadingMessages && messages.length > 0 && messageSearch && !shown.length && (
                  <p className="rz-chat__empty">پیامی با این عبارت یافت نشد.</p>
                )}
              </div>

              {error && (
                <p className="rz-chat__error" role="alert">
                  <TriangleAlert size={15} />{error}
                  <button type="button" onClick={() => setError('')}><X size={14} /></button>
                </p>
              )}

              <form className="rz-chat__composer" onSubmit={handleSend}>
                <button type="button" className="rz-chat__icon" title="پیوست (به‌زودی)" disabled><Paperclip size={18} /></button>
                <button type="button" className="rz-chat__icon" title="ایموجی (به‌زودی)" disabled><Smile size={18} /></button>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`پیام به ${selected.displayTitle}...`}
                  aria-label="متن پیام"
                />
                <button type="submit" className="rz-chat__send" disabled={!draft.trim() || sending}>
                  <Send size={17} />{sending ? 'در حال ارسال' : 'ارسال'}
                </button>
              </form>
            </>
          ) : (
            <div className="rz-chat__placeholder">
              <MessageCircle size={44} />
              <h3>گفت‌وگویی انتخاب نشده است</h3>
              <p>از فهرست کنار یک گفت‌وگو را باز کنید یا یک گفت‌وگوی تازه شروع کنید.</p>
              <button type="button" onClick={() => { setPickerOpen(true); setMobilePane('list') }}><Plus size={16} />شروع گفت‌وگوی جدید</button>
              {error && <p className="rz-chat__error" role="alert"><TriangleAlert size={15} />{error}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * User management - all data comes from /api/identity/*                *
 * ------------------------------------------------------------------ */

function UsersTable() {
  const { user: currentUser } = useAuth()
  const tenantId = currentUser?.tenantId || DEFAULT_TENANT_ID
  const PAGE_SIZE = 10
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [rolesFor, setRolesFor] = useState(null)
  const { can } = useAuth()

  async function load(targetPage = page) {
    setLoading(true)
    const result = await usersApi.list({ tenantId, pageNumber: targetPage, pageSize: PAGE_SIZE, search })
    if (!result.isSuccess) setError(PersianMessages.error(result.error))
    else setError('')
    const paged = unwrap(result)
    setUsers(paged?.items || [])
    setTotal(paged?.totalCount || 0)
    setLoading(false)
  }

  // Any new search starts from the first page.
  useEffect(() => { setPage(1) }, [search])
  useEffect(() => { load(page) }, [page, search])
  useEffect(() => {
    if (!can('roles.view')) return
    rolesApi.list(tenantId).then((r) => setRoles(unwrap(r, []) || []))
  }, [tenantId])

  const activeCount = users.filter((u) => u.isActive).length

  async function toggleActive(user) {
    const result = await usersApi.update(user.id, { displayName: user.displayName, isActive: !user.isActive })
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    load(page)
  }

  async function saveRoles(userId, roleIds) {
    const result = await usersApi.assignRoles(userId, roleIds)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setRolesFor(null)
    load(page)
  }

  return (
    <section className="users-card">
      <div className="users-toolbar">
        <div><span className="active-count">فعال در این صفحه: {activeCount}</span><span className="inactive-count">غیرفعال: {users.length - activeCount}</span></div>
        <div>
          <label><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی کاربر..." /></label>
          <button onClick={() => load(page)}><RefreshCw size={16} />به‌روزرسانی</button>
        </div>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="table-scroll">
        <table className="users-table">
          <thead><tr><th>کاربر</th><th>ایمیل</th><th>آخرین ورود</th><th>سمت سازمانی</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id}>
                <td><span className={`user-identity tone-${index % 5}`}><i>{initialsOf(user.displayName)}</i><span><strong>{user.displayName}</strong><small>{user.id.slice(0, 8)}</small></span></span></td>
                <td>{user.email}</td>
                <td>{formatDateTime(user.lastLoginAtUtc)}</td>
                <td>{(user.roles || []).map((role) => <span className="access-badge" key={role}><Shield size={13} />{role}</span>)}</td>
                <td><span className={`user-status ${user.isActive ? 'active' : ''}`}><i />{user.isActive ? 'فعال' : 'غیرفعال'}</span></td>
                <td>
                  <span className="row-actions">
                    <Can permission="users.update"><button title="ویرایش" onClick={() => setEditing(user)}><Pencil size={15} /></button></Can>
                    <Can permission="users.assign_roles"><button title="سمت سازمانی" onClick={() => setRolesFor(user)}><KeyRound size={15} /></button></Can>
                    <Can permission="users.update"><button title={user.isActive ? 'غیرفعال کردن' : 'فعال کردن'} onClick={() => toggleActive(user)}>{user.isActive ? <EyeOff size={15} /> : <Eye size={15} />}</button></Can>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && !users.length && <tr><td colSpan={6}>کاربری یافت نشد.</td></tr>}
            {loading && <tr><td colSpan={6}>در حال بارگذاری...</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pageNumber={page} pageSize={PAGE_SIZE} totalCount={total} onChange={setPage} />
      {/* The Core exposes no delete-user endpoint, so no delete action is offered. */}
      {editing && <UserEditor user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={() => load(page)} />}
      {rolesFor && <RoleAssigner user={rolesFor} roles={roles} onClose={() => setRolesFor(null)} onSave={saveRoles} />}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Full user editor - four tabs over the Core's identity + profile APIs *
 * ------------------------------------------------------------------ */

const EMPLOYMENT_TYPES = ['تمام‌وقت', 'پاره‌وقت', 'قراردادی', 'پیمانکار', 'کارآموز']
const UI_LANGUAGES = [['fa', 'فارسی'], ['en', 'English'], ['ar', 'العربية']]
const TIME_ZONES = ['Asia/Tehran', 'Asia/Dubai', 'Asia/Baku', 'Europe/Istanbul', 'UTC']

const EMPTY_PROFILE = {
  firstName: '', lastName: '', nationalCode: '', birthDate: '',
  mobileNumber: '', phoneNumber: '', emergencyContactName: '', emergencyContactPhone: '', address: '',
  employeeCode: '', jobTitle: '', department: '', officeLocation: '', hireDate: '', employmentType: '',
  language: '', timeZone: '', notes: '',
}

/** The Core returns DateOnly as "YYYY-MM-DD", which is exactly what <input type="date"> wants. */
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '')
const fromDateInput = (value) => (value ? value : null)

function Field({ label, children, hint }) {
  return (
    <label className="ue-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function UserEditor({ user, roles, onClose, onSaved }) {
  const { can } = useAuth()
  const [tab, setTab] = useState('پایه')
  const [displayName, setDisplayName] = useState(user.displayName)
  const [isActive, setIsActive] = useState(user.isActive)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  const [roleIds, setRoleIds] = useState([])
  const [initialRoleIds, setInitialRoleIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canEdit = can('users.update')
  const canEditRoles = can('users.assign_roles')

  // One round trip gives identity fields, current roles and the extended profile.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await usersApi.detail(user.id)
      if (cancelled) return
      if (!result.isSuccess) {
        setError(PersianMessages.error(result.error))
        setLoading(false)
        return
      }
      const detail = unwrap(result)
      setDisplayName(detail.displayName)
      setIsActive(detail.isActive)
      setRoleIds(detail.roleIds || [])
      setInitialRoleIds(detail.roleIds || [])
      setProfile({
        ...EMPTY_PROFILE,
        ...Object.fromEntries(Object.entries(detail.profile || {}).map(([k, v]) => [k, v ?? ''])),
        birthDate: toDateInput(detail.profile?.birthDate),
        hireDate: toDateInput(detail.profile?.hireDate),
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user.id])

  const set = (key) => (event) => setProfile((current) => ({ ...current, [key]: event.target.value }))

  const rolesChanged = useMemo(() => {
    const a = [...roleIds].sort().join(',')
    const b = [...initialRoleIds].sort().join(',')
    return a !== b
  }, [roleIds, initialRoleIds])

  function toggleRole(roleId) {
    setRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId])
  }

  async function save() {
    setBusy(true)
    setError('')
    setMessage('')

    // Three independent Core endpoints, each guarded by its own permission.
    if (canEdit) {
      const identityResult = await usersApi.update(user.id, { displayName: displayName.trim(), isActive })
      if (!identityResult.isSuccess) { setError(PersianMessages.error(identityResult.error)); setBusy(false); return }

      const profileResult = await usersApi.updateProfile(user.id, {
        ...profile,
        birthDate: fromDateInput(profile.birthDate),
        hireDate: fromDateInput(profile.hireDate),
      })
      if (!profileResult.isSuccess) { setError(PersianMessages.error(profileResult.error)); setBusy(false); return }
    }

    if (canEditRoles && rolesChanged) {
      const rolesResult = await usersApi.assignRoles(user.id, roleIds)
      if (!rolesResult.isSuccess) { setError(PersianMessages.error(rolesResult.error)); setBusy(false); return }
      setInitialRoleIds(roleIds)
    }

    setBusy(false)
    setMessage('تغییرات ذخیره شد.')
    onSaved()
  }

  const tabs = [
    { key: 'پایه', label: 'اطلاعات پایه', icon: UserRound },
    { key: 'تماس', label: 'اطلاعات تماس', icon: Smartphone },
    { key: 'سازمانی', label: 'اطلاعات سازمانی', icon: Building2 },
    { key: 'تنظیمات', label: 'تنظیمات و یادداشت', icon: SlidersHorizontal },
  ]

  return (
    <div className="ue-backdrop" role="dialog" aria-modal="true">
      <div className="ue-modal">
        <header className="ue-head">
          <span className="user-identity tone-0"><i>{initialsOf(displayName || user.displayName)}</i></span>
          <div className="ue-head-title">
            <strong>{displayName || user.displayName}</strong>
            <small>{user.email}</small>
          </div>
          <span className={`user-status ${isActive ? 'active' : ''}`}><i />{isActive ? 'فعال' : 'غیرفعال'}</span>
          <button type="button" className="ue-close" onClick={onClose} aria-label="بستن"><X size={19} /></button>
        </header>

        <nav className="ue-tabs">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>

        <div className="ue-body">
          {loading && <p className="rz-chat__empty">در حال بارگذاری اطلاعات کاربر...</p>}

          {!loading && tab === 'پایه' && (
            <>
              <div className="ue-grid">
                <Field label="نام"><input value={profile.firstName} onChange={set('firstName')} disabled={!canEdit} /></Field>
                <Field label="نام خانوادگی"><input value={profile.lastName} onChange={set('lastName')} disabled={!canEdit} /></Field>
                <Field label="نام نمایشی" hint="این نام در سراسر سامانه دیده می‌شود.">
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!canEdit} />
                </Field>
                <Field label="ایمیل" hint="ایمیل شناسه ورود است و از این صفحه قابل تغییر نیست.">
                  <input value={user.email} disabled readOnly />
                </Field>
                <Field label="کد ملی"><input value={profile.nationalCode} onChange={set('nationalCode')} disabled={!canEdit} inputMode="numeric" /></Field>
                <Field label="تاریخ تولد"><input type="date" value={profile.birthDate} onChange={set('birthDate')} disabled={!canEdit} /></Field>
              </div>
              <label className="ue-switch">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} disabled={!canEdit} />
                <span><strong>حساب کاربری فعال باشد</strong><small>کاربر غیرفعال نمی‌تواند وارد سامانه شود.</small></span>
              </label>
              <p className="ue-meta"><Clock3 size={14} />آخرین ورود: {formatDateTime(user.lastLoginAtUtc)}</p>
            </>
          )}

          {!loading && tab === 'تماس' && (
            <div className="ue-grid">
              <Field label="تلفن همراه"><input value={profile.mobileNumber} onChange={set('mobileNumber')} disabled={!canEdit} inputMode="tel" /></Field>
              <Field label="تلفن ثابت / داخلی"><input value={profile.phoneNumber} onChange={set('phoneNumber')} disabled={!canEdit} inputMode="tel" /></Field>
              <Field label="نام فرد رابط اضطراری"><input value={profile.emergencyContactName} onChange={set('emergencyContactName')} disabled={!canEdit} /></Field>
              <Field label="تلفن رابط اضطراری"><input value={profile.emergencyContactPhone} onChange={set('emergencyContactPhone')} disabled={!canEdit} inputMode="tel" /></Field>
              <Field label="نشانی" hint="نشانی کامل محل سکونت یا مکاتبه.">
                <textarea rows={3} value={profile.address} onChange={set('address')} disabled={!canEdit} />
              </Field>
            </div>
          )}

          {!loading && tab === 'سازمانی' && (
            <>
              <div className="ue-grid">
                <Field label="کد پرسنلی"><input value={profile.employeeCode} onChange={set('employeeCode')} disabled={!canEdit} /></Field>
                <Field label="عنوان شغلی"><input value={profile.jobTitle} onChange={set('jobTitle')} disabled={!canEdit} /></Field>
                <Field label="واحد / دپارتمان"><input value={profile.department} onChange={set('department')} disabled={!canEdit} /></Field>
                <Field label="محل استقرار"><input value={profile.officeLocation} onChange={set('officeLocation')} disabled={!canEdit} /></Field>
                <Field label="تاریخ استخدام"><input type="date" value={profile.hireDate} onChange={set('hireDate')} disabled={!canEdit} /></Field>
                <Field label="نوع همکاری">
                  <select value={profile.employmentType} onChange={set('employmentType')} disabled={!canEdit}>
                    <option value="">انتخاب کنید</option>
                    {EMPLOYMENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
              </div>

              <div className="ue-section">
                <h4><Shield size={16} />سمت سازمانی</h4>
                <p>سمت سازمانی تعیین می‌کند کاربر چه دسترسی‌هایی دارد و در کجای چارت سازمانی قرار می‌گیرد.</p>
                {roles.length ? (
                  <ul className="ue-roles">
                    {roles.map((role) => (
                      <li key={role.id}>
                        <label className={canEditRoles ? '' : 'is-locked'}>
                          <input type="checkbox" checked={roleIds.includes(role.id)} disabled={!canEditRoles} onChange={() => toggleRole(role.id)} />
                          <span className="access-check"><CheckCheck size={13} /></span>
                          <span className="access-text">
                            <strong>{role.name}</strong>
                            <code>{role.description || `${(role.permissions || []).length} دسترسی`}</code>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rz-chat__empty">برای مشاهده سمت‌های سازمانی به دسترسی «مشاهده سمت‌های سازمانی» نیاز دارید.</p>
                )}
              </div>
            </>
          )}

          {!loading && tab === 'تنظیمات' && (
            <>
              <div className="ue-grid">
                <Field label="زبان رابط کاربری">
                  <select value={profile.language} onChange={set('language')} disabled={!canEdit}>
                    <option value="">پیش‌فرض سامانه</option>
                    {UI_LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                </Field>
                <Field label="منطقه زمانی">
                  <select value={profile.timeZone} onChange={set('timeZone')} disabled={!canEdit}>
                    <option value="">پیش‌فرض سامانه</option>
                    {TIME_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="یادداشت داخلی" hint="این یادداشت فقط برای مدیران سامانه قابل مشاهده است.">
                <textarea rows={5} value={profile.notes} onChange={set('notes')} disabled={!canEdit} />
              </Field>
            </>
          )}
        </div>

        <footer className="ue-foot">
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          {!error && message && <span className="ue-ok"><CheckCircle2 size={15} />{message}</span>}
          {!error && !message && !canEdit && <span className="ue-hint"><LockKeyhole size={14} />فقط مشاهده — دسترسی ویرایش ندارید.</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="button" className="ue-save" onClick={save} disabled={loading || busy || (!canEdit && !canEditRoles)}>
              {busy ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function RoleAssigner({ user, roles, onClose, onSave }) {
  const [selected, setSelected] = useState(() => roles.filter((r) => (user.roles || []).includes(r.name)).map((r) => r.id))

  return (
    <aside className="notification-drawer">
      <header><div><KeyRound size={19} /><h3>نقش‌های کاربر</h3></div><button onClick={onClose}><X size={18} /></button></header>
      <p>{user.displayName}</p>
      <div className="notify-methods">
        <strong>نقش‌های موجود</strong>
        {roles.map((role) => (
          <label key={role.id}>
            <input type="checkbox" checked={selected.includes(role.id)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} />
            <span><Shield size={16} />{role.name}</span>
          </label>
        ))}
        {!roles.length && <p>برای مشاهده نقش‌ها به دسترسی roles.view نیاز دارید.</p>}
      </div>
      <button className="drawer-save" onClick={() => onSave(user.id, selected)}>ذخیره نقش‌ها</button>
    </aside>
  )
}

/** Login history is derived from the platform audit log (identity.login / identity.login_failed). */
function LoginHistory() {
  const { user } = useAuth()
  const PAGE_SIZE = 10
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [onlyLogins, setOnlyLogins] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(targetPage = page) {
    setLoading(true)
    const result = await platformApi.auditLogs({ tenantId: user?.tenantId, pageNumber: targetPage, pageSize: PAGE_SIZE })
    if (!result.isSuccess) setError(PersianMessages.error(result.error))
    else setError('')
    const paged = unwrap(result)
    setLogs(paged?.items || [])
    setTotal(paged?.totalCount || 0)
    setLoading(false)
  }

  useEffect(() => { load(page) }, [page])

  // The Core has no server-side action filter, so the toggle narrows the current page only.
  const shown = onlyLogins ? logs.filter((log) => log.action.startsWith('identity.login')) : logs

  const actionLabels = {
    'identity.login': 'ورود موفق',
    'identity.login_failed': 'ورود ناموفق',
    'identity.forgot_password': 'درخواست بازیابی رمز',
    'identity.reset_password': 'تغییر رمز عبور',
    'users.create': 'ایجاد کاربر',
    'users.update': 'ویرایش کاربر',
    'users.assign_roles': 'تغییر سمت سازمانی',
    'users.assign_permissions': 'تغییر دسترسی کاربر',
    'roles.create': 'ایجاد سمت سازمانی',
    'roles.update': 'ویرایش سمت سازمانی',
    'roles.assign_permissions': 'تغییر دسترسی سمت سازمانی',
  }

  return (
    <section className="users-card">
      <div className="history-notice">
        <History size={21} />
        <div><strong>گزارش ورود و رویدادهای امنیتی</strong><p>سوابق از سرویس platform/audit-logs دریافت می‌شود.</p></div>
        <button onClick={() => load(page)}>به‌روزرسانی</button>
      </div>
      <div className="users-toolbar">
        <label className="check-row"><input type="checkbox" checked={onlyLogins} onChange={(e) => setOnlyLogins(e.target.checked)} /><span>فقط رویدادهای ورود</span></label>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <div className="table-scroll">
        <table className="users-table">
          <thead><tr><th>رویداد</th><th>تاریخ و زمان</th><th>نشانی IP</th><th>کاربر</th><th>وضعیت</th></tr></thead>
          <tbody>
            {shown.map((log) => (
              <tr key={log.id}>
                <td><strong>{actionLabels[log.action] || log.action}</strong></td>
                <td>{formatDateTime(log.occurredAtUtc)}</td>
                <td><code>{log.ipAddress || '—'}</code></td>
                <td>{log.details || '—'}</td>
                <td>
                  {log.action === 'identity.login' && <span className="login-result success">موفق</span>}
                  {log.action === 'identity.login_failed' && <span className="login-result failed">ناموفق</span>}
                  {!log.action.startsWith('identity.login') && <span>—</span>}
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan={5}>در حال بارگذاری...</td></tr>}
            {!loading && !shown.length && <tr><td colSpan={5}>رکوردی در این صفحه یافت نشد.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pageNumber={page} pageSize={PAGE_SIZE} totalCount={total} onChange={setPage} />
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Organisation chart - drawn from roles (سمت سازمانی).                 *
 * Hierarchy comes from Role.ParentRoleId; clicking a position shows    *
 * the people who hold it. Gated by the org_chart.view permission.      *
 * ------------------------------------------------------------------ */

function OrgNode({ node, selectedId, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = (node.children || []).length > 0

  return (
    <li className="oc-node">
      <div className={`oc-card ${selectedId === node.roleId ? 'is-selected' : ''}`}>
        <button type="button" className="oc-card-main" onClick={() => onSelect(node)}>
          <span className="oc-card-icon"><Shield size={17} /></span>
          <span className="oc-card-body">
            <strong>{node.name}</strong>
            <small>{node.memberCount} نفر{node.description ? ` · ${node.description}` : ''}</small>
          </span>
        </button>
        {hasChildren && (
          <button type="button" className="oc-toggle" onClick={() => setOpen((v) => !v)} title={open ? 'بستن زیرمجموعه' : 'باز کردن زیرمجموعه'}>
            {open ? '−' : '+'}
          </button>
        )}
      </div>
      {hasChildren && open && (
        <ul className="oc-children">
          {node.children.map((child) => (
            <OrgNode key={child.roleId} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

function OrgChart() {
  const { user } = useAuth()
  const [chart, setChart] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const result = await orgChartApi.get(user?.tenantId || DEFAULT_TENANT_ID)
    if (!result.isSuccess) {
      setError(PersianMessages.error(result.error))
      setLoading(false)
      return
    }
    setError('')
    setChart(unwrap(result))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Keep the detail panel in sync after a reload.
  useEffect(() => {
    if (!selected || !chart) return
    const find = (nodes) => {
      for (const node of nodes) {
        if (node.roleId === selected.roleId) return node
        const hit = find(node.children || [])
        if (hit) return hit
      }
      return null
    }
    setSelected(find(chart.roots || []))
  }, [chart])

  if (loading) return <section className="org-card"><div className="org-note"><Network size={18} />در حال بارگذاری چارت سازمانی...</div></section>
  if (error) return <section className="org-card"><div className="org-note"><TriangleAlert size={18} />{error}</div></section>

  const hasChart = Boolean(chart?.roots?.length)

  return (
    <section className="oc-wrap">
      <header className="oc-head">
        <div>
          <strong>{chart?.tenantName || 'سازمان'}</strong>
          <small>{chart?.totalRoles || 0} سمت سازمانی · {chart?.totalMembers || 0} نفر دارای سمت</small>
        </div>
        <button type="button" onClick={load}><RefreshCw size={15} />به‌روزرسانی</button>
      </header>

      <div className="oc-layout">
        <div className="oc-tree">
          {hasChart ? (
            <ul className="oc-root">
              {chart.roots.map((node) => (
                <OrgNode key={node.roleId} node={node} selectedId={selected?.roleId} onSelect={setSelected} />
              ))}
            </ul>
          ) : (
            <p className="rz-chat__empty">هنوز سمت سازمانی تعریف نشده است. از بخش «نقش‌ها و دسترسی‌ها» سمت بسازید و سمت بالادستی هرکدام را مشخص کنید.</p>
          )}

          {Boolean(chart?.unassigned?.length) && (
            <div className="oc-unassigned">
              <h5><CircleDashed size={15} />بدون سمت سازمانی ({chart.unassigned.length} نفر)</h5>
              <div className="oc-chips">
                {chart.unassigned.map((member) => (
                  <span key={member.userId} className="oc-chip">{member.displayName}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="oc-detail">
          {selected ? (
            <>
              <header>
                <span className="oc-card-icon"><Shield size={18} /></span>
                <div>
                  <strong>{selected.name}</strong>
                  <small>{selected.description || 'بدون توضیح'}</small>
                </div>
              </header>
              <p className="oc-detail-count"><UsersRound size={15} />{selected.memberCount} نفر این سمت را دارند</p>
              <ul className="oc-members">
                {(selected.members || []).map((member, index) => (
                  <li key={member.userId}>
                    <span className={`user-identity tone-${index % 5}`}><i>{initialsOf(member.displayName)}</i></span>
                    <div>
                      <strong>{member.displayName}</strong>
                      <small>{member.jobTitle || member.email}</small>
                      {member.department && <small>{member.department}</small>}
                    </div>
                    {!member.isActive && <span className="oc-inactive">غیرفعال</span>}
                  </li>
                ))}
                {!(selected.members || []).length && <li className="oc-empty">هیچ کاربری این سمت را ندارد.</li>}
              </ul>
            </>
          ) : (
            <div className="oc-placeholder">
              <Network size={38} />
              <p>روی یک سمت سازمانی کلیک کنید تا افراد آن را ببینید.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Access control - two independent axes:                              *
 *   1. سمت سازمانی (role)  -> /api/identity/roles/{id}/permissions     *
 *   2. کاربر (direct)      -> /api/identity/users/{id}/permissions     *
 * Effective access = role permissions UNION direct grants.            *
 * ------------------------------------------------------------------ */

/** Groups the flat permission catalogue by module, with Persian labels. */
function usePermissionCatalogue() {
  const [groups, setGroups] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    permissionsApi.listGrouped().then((result) => {
      if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
      setGroups(unwrap(result, []) || [])
    })
  }, [])

  return { groups, error }
}

function AccessControl() {
  const { canReach } = useAuth()
  const [mode, setMode] = useState('')
  // The Core only maps /api/identity/groups when Features:UserGroups:Enabled is true.
  // A 404 means the feature is off for this deployment, so the tab is hidden entirely.
  const [groupsEnabled, setGroupsEnabled] = useState(null)

  useEffect(() => {
    groupsApi.list().then((result) => {
      setGroupsEnabled(result.isSuccess || (result.status !== 404 && result.status !== 0))
    })
  }, [])

  const modes = [
    { key: 'نقش', label: 'بر اساس سمت سازمانی', icon: Building2, visible: canReach(sectionPermissions.accessRole) },
    { key: 'گروه', label: 'بر اساس گروه', icon: Users2, visible: Boolean(groupsEnabled) && canReach(sectionPermissions.accessGroup) },
    { key: 'کاربر', label: 'بر اساس کاربر', icon: UserRound, visible: canReach(sectionPermissions.accessUser) },
  ].filter((item) => item.visible)

  // Open the first axis the user can actually manage rather than always defaulting to roles.
  useEffect(() => {
    if (modes.length && !modes.some((item) => item.key === mode)) setMode(modes[0].key)
  }, [modes, mode])

  const axes = groupsEnabled
    ? 'سمت سازمانی، گروه کاربری، و دسترسی مستقیم'
    : 'سمت سازمانی و دسترسی مستقیم'

  return (
    <>
      <div className="permission-summary">
        <div>
          <ShieldCheck size={24} />
          <span>
            <strong>تعیین سطح دسترسی</strong>
            <small>دسترسی نهایی هر فرد مجموع این مسیرهاست: {axes}.</small>
          </span>
        </div>
      </div>
      {modes.length > 1 && (
        <nav className="user-tabs access-mode-tabs">
          {modes.map(({ key, label, icon: Icon }) => (
            <button key={key} className={mode === key ? 'active' : ''} onClick={() => setMode(key)}><Icon size={17} />{label}</button>
          ))}
        </nav>
      )}
      {mode === 'نقش' && <RoleAccessPanel />}
      {mode === 'گروه' && <GroupAccessPanel />}
      {mode === 'کاربر' && <UserAccessPanel />}
      {!modes.length && <p className="chat-empty">برای مدیریت سطح دسترسی، مجوز لازم به شما داده نشده است.</p>}
    </>
  )
}

/** Axis 1 - permissions attached to an organisational position (role). */
function RoleAccessPanel() {
  const { user, can } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const { groups, error: catalogueError } = usePermissionCatalogue()
  const [roles, setRoles] = useState([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [draft, setDraft] = useState(new Set())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editingRole, setEditingRole] = useState(null)

  const byName = useMemo(
    () => new Map(groups.flatMap((g) => g.permissions).map((p) => [p.name, p.id])),
    [groups],
  )

  async function loadRoles(preferredId) {
    const result = await rolesApi.list(tenantId)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    const list = unwrap(result, []) || []
    setRoles(list)
    const next = preferredId || selectedRoleId || list[0]?.id || ''
    setSelectedRoleId(next)
  }

  useEffect(() => { loadRoles() }, [tenantId])

  // Role DTOs carry permission NAMES; the assign endpoint expects permission IDS.
  useEffect(() => {
    const role = roles.find((r) => r.id === selectedRoleId)
    if (!role) { setDraft(new Set()); return }
    setDraft(new Set((role.permissions || []).map((name) => byName.get(name)).filter(Boolean)))
  }, [selectedRoleId, roles, byName])

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null
  const locked = !selectedRole || selectedRole.isSystem || !can('roles.assign_permissions')

  function toggle(permissionId) {
    setDraft((current) => {
      const next = new Set(current)
      if (next.has(permissionId)) next.delete(permissionId); else next.add(permissionId)
      return next
    })
  }

  async function save() {
    if (!selectedRole) return
    setBusy(true); setError(''); setMessage('')
    const result = await rolesApi.assignPermissions(selectedRole.id, Array.from(draft))
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setMessage('دسترسی‌های این سمت ذخیره شد. کاربران دارای این سمت باید یک‌بار خارج و دوباره وارد شوند.')
    loadRoles(selectedRole.id)
  }

  return (
    <section className="access-panel">
      <aside className="access-side">
        <header>
          <h4>سمت‌های سازمانی</h4>
          <Can permission="roles.create"><button type="button" onClick={() => setCreating(true)}><Plus size={16} /></button></Can>
        </header>
        <div className="access-side-list">
          {roles.map((role) => (
            <button key={role.id} type="button" className={role.id === selectedRoleId ? 'active' : ''} onClick={() => setSelectedRoleId(role.id)}>
              <strong>{role.name}</strong>
              <small>
                {role.isSystem ? 'سمت سیستمی — غیرقابل تغییر' : `${(role.permissions || []).length} دسترسی`}
                {role.parentRoleId && ` · زیرمجموعه ${roles.find((r) => r.id === role.parentRoleId)?.name || '—'}`}
              </small>
            </button>
          ))}
          {!roles.length && <p className="chat-empty">سمتی تعریف نشده است.</p>}
        </div>
      </aside>

      <div className="access-main">
        {(error || catalogueError) && <p className="login-error" role="alert">{error || catalogueError}</p>}
        {message && <p className="login-notice" role="status">{message}</p>}

        {selectedRole ? (
          <>
            <div className="access-main-head">
              <div><strong>{selectedRole.name}</strong><small>{selectedRole.description || 'بدون توضیح'} · {draft.size} دسترسی انتخاب شده</small></div>
              <div className="access-head-actions">
                {selectedRole.isSystem && <span className="access-badge"><LockKeyhole size={13} />سمت سیستمی</span>}
                <Can permission="roles.update"><button type="button" onClick={() => setEditingRole(selectedRole)}><Pencil size={14} />ویرایش سمت</button></Can>
              </div>
            </div>

            {groups.map((group) => (
              <div className="access-group" key={group.module}>
                <h5>{labelForModule(group.module)}</h5>
                <ul>
                  {group.permissions.map((permission) => (
                    <li key={permission.id}>
                      <label className={locked ? 'is-locked' : ''}>
                        <input type="checkbox" checked={draft.has(permission.id)} disabled={locked} onChange={() => toggle(permission.id)} />
                        <span className="access-check"><CheckCheck size={13} /></span>
                        <span className="access-text"><strong>{labelForPermission(permission)}</strong><code>{permission.name}</code></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!groups.length && <p className="chat-empty">برای مشاهده فهرست دسترسی‌ها به مجوز «مشاهده فهرست دسترسی‌ها» نیاز دارید.</p>}

            <footer className="access-footer">
              <span><LockKeyhole size={15} />سمت‌های سیستمی قابل تغییر نیستند. همه تغییرات در گزارش رویدادها ثبت می‌شود.</span>
              <button type="button" onClick={save} disabled={locked || busy}>{busy ? 'در حال ذخیره...' : 'ذخیره دسترسی‌های سمت'}</button>
            </footer>
          </>
        ) : (
          <p className="chat-empty">یک سمت سازمانی را انتخاب کنید.</p>
        )}
      </div>

      {creating && <RoleEditor tenantId={tenantId} roles={roles} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); loadRoles(id) }} />}
      {editingRole && <RoleEditor tenantId={tenantId} roles={roles} role={editingRole} onClose={() => setEditingRole(null)} onSaved={(id) => { setEditingRole(null); loadRoles(id) }} />}
    </section>
  )
}

/** Create or edit a position. The parent selector is what gives the org chart its shape. */
function RoleEditor({ tenantId, roles, role, onClose, onSaved }) {
  const [name, setName] = useState(role?.name || '')
  const [description, setDescription] = useState(role?.description || '')
  const [parentRoleId, setParentRoleId] = useState(role?.parentRoleId || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // A role cannot be its own parent. Deeper loops are rejected by the Core.
  const parentOptions = (roles || []).filter((item) => item.id !== role?.id)

  async function save() {
    setBusy(true); setError('')
    const payload = { name: name.trim(), description: description.trim() || null, parentRoleId: parentRoleId || null }
    const result = role
      ? await rolesApi.update(role.id, payload)
      : await rolesApi.create({ tenantId, ...payload })
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved(result.value?.id || role?.id)
  }

  return (
    <aside className="notification-drawer">
      <header><div><Shield size={19} /><h3>{role ? 'ویرایش سمت سازمانی' : 'سمت سازمانی جدید'}</h3></div><button onClick={onClose}><X size={18} /></button></header>
      <label>عنوان سمت<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً مدیر پروژه" disabled={role?.isSystem} /></label>
      <label>توضیح<input value={description} onChange={(e) => setDescription(e.target.value)} disabled={role?.isSystem} /></label>
      <label>
        سمت بالادستی
        <select value={parentRoleId} onChange={(e) => setParentRoleId(e.target.value)}>
          <option value="">— بدون بالادست (سطح اول چارت) —</option>
          {parentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <p className="ue-hint" style={{ margin: '0 0 4px' }}><Network size={14} />این انتخاب فقط جایگاه سمت را در چارت سازمانی تعیین می‌کند و روی دسترسی‌ها اثری ندارد.</p>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="drawer-save" onClick={save} disabled={busy || !name.trim()}>{busy ? 'در حال ذخیره...' : role ? 'ذخیره تغییرات' : 'ایجاد سمت'}</button>
    </aside>
  )
}

/**
 * Axis 3 (optional) - user groups.
 * A group carries a permission set; every member inherits it. Hidden entirely when the
 * Core has Features:UserGroups:Enabled turned off.
 */
function GroupAccessPanel() {
  const { user, can, canReach } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const { groups: catalogue, error: catalogueError } = usePermissionCatalogue()

  const [groups, setGroups] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [tab, setTab] = useState('')
  const [permissionDraft, setPermissionDraft] = useState(new Set())
  const [memberDraft, setMemberDraft] = useState(new Set())
  const [users, setUsers] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadGroups(preferredId) {
    const result = await groupsApi.list(tenantId)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setError('')
    const list = unwrap(result, []) || []
    setGroups(list)
    setSelectedId((current) => preferredId || current || list[0]?.id || '')
  }

  useEffect(() => { loadGroups() }, [tenantId])

  useEffect(() => {
    if (!can('users.view')) return
    usersApi.list({ tenantId, pageSize: 200 }).then((result) => {
      setUsers(unwrap(result)?.items || [])
    })
  }, [tenantId])

  useEffect(() => {
    const group = groups.find((g) => g.id === selectedId) || null
    setDetail(group)
    setPermissionDraft(new Set(group?.permissionIds || []))
    setMemberDraft(new Set((group?.members || []).map((m) => m.userId)))
    setMessage('')
  }, [selectedId, groups])

  const canEditPermissions = can('groups.assign_permissions')
  const canEditMembers = can('groups.manage_members')
  // Only offer the subtabs this user was actually given. Someone granted just
  // groups.manage_members should land straight on the member list.
  const subtabs = [
    { key: 'دسترسی', visible: canReach(['groups.assign_permissions', 'groups.view']) && can('permissions.view') },
    { key: 'اعضا', visible: canReach(['groups.manage_members', 'groups.view']) },
  ].filter((item) => item.visible)

  useEffect(() => {
    if (subtabs.length && !subtabs.some((item) => item.key === tab)) setTab(subtabs[0].key)
  }, [subtabs, tab])

  const visibleUsers = useMemo(
    () => users.filter((u) => !memberSearch || u.displayName?.includes(memberSearch) || u.email?.includes(memberSearch)),
    [users, memberSearch],
  )

  function togglePermission(permissionId) {
    setPermissionDraft((current) => {
      const next = new Set(current)
      if (next.has(permissionId)) next.delete(permissionId); else next.add(permissionId)
      return next
    })
  }

  function toggleMember(userId) {
    setMemberDraft((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  async function savePermissions() {
    if (!detail) return
    setBusy(true); setError(''); setMessage('')
    const result = await groupsApi.assignPermissions(detail.id, Array.from(permissionDraft))
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setMessage('دسترسی‌های گروه ذخیره شد. اعضای گروه باید یک‌بار خارج و دوباره وارد شوند.')
    loadGroups(detail.id)
  }

  async function saveMembers() {
    if (!detail) return
    setBusy(true); setError(''); setMessage('')
    const result = await groupsApi.assignMembers(detail.id, Array.from(memberDraft))
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setMessage('اعضای گروه ذخیره شد. کاربران تازه‌افزوده باید یک‌بار خارج و دوباره وارد شوند.')
    loadGroups(detail.id)
  }

  return (
    <section className="access-panel">
      <aside className="access-side">
        <header>
          <h4>گروه‌های کاربری</h4>
          <Can permission="groups.create"><button type="button" onClick={() => setCreating(true)} title="گروه جدید"><Plus size={16} /></button></Can>
        </header>
        <div className="access-side-list">
          {groups.map((group) => (
            <button key={group.id} type="button" className={group.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(group.id)}>
              <strong>{group.name}{!group.isActive && ' (غیرفعال)'}</strong>
              <small>{group.memberCount} عضو · {(group.permissionIds || []).length} دسترسی</small>
            </button>
          ))}
          {!groups.length && <p className="chat-empty">هنوز گروهی ساخته نشده است.</p>}
        </div>
      </aside>

      <div className="access-main">
        {/* The catalogue only matters on the permissions subtab; do not nag about it otherwise. */}
        {(error || (catalogueError && tab === 'دسترسی')) && <p className="login-error" role="alert">{error || catalogueError}</p>}
        {message && <p className="login-notice" role="status">{message}</p>}

        {detail ? (
          <>
            <div className="access-main-head">
              <div>
                <strong>{detail.name}</strong>
                <small>{detail.description || 'بدون توضیح'} · {detail.memberCount} عضو</small>
              </div>
              <div className="access-head-actions">
                {!detail.isActive && <span className="access-badge"><EyeOff size={13} />غیرفعال</span>}
                <Can permission="groups.update"><button type="button" onClick={() => setEditing(true)}><Pencil size={14} />ویرایش</button></Can>
              </div>
            </div>

            <p className="access-hint">
              <CircleHelp size={15} />
              هر کاربری که عضو این گروه شود، <b>همه‌ی دسترسی‌های زیر</b> را علاوه بر دسترسی‌های سمت سازمانی و مستقیم خودش دریافت می‌کند.
            </p>

            {subtabs.length > 1 && (
              <nav className="access-subtabs">
                <button type="button" className={tab === 'دسترسی' ? 'active' : ''} onClick={() => setTab('دسترسی')}><ShieldCheck size={15} />دسترسی‌های گروه</button>
                <button type="button" className={tab === 'اعضا' ? 'active' : ''} onClick={() => setTab('اعضا')}><UsersRound size={15} />اعضای گروه ({memberDraft.size})</button>
              </nav>
            )}

            {tab === 'دسترسی' && (
              <>
                {catalogue.map((group) => (
                  <div className="access-group" key={group.module}>
                    <h5>{labelForModule(group.module)}</h5>
                    <ul>
                      {group.permissions.map((permission) => (
                        <li key={permission.id}>
                          <label className={canEditPermissions ? '' : 'is-locked'}>
                            <input type="checkbox" checked={permissionDraft.has(permission.id)} disabled={!canEditPermissions} onChange={() => togglePermission(permission.id)} />
                            <span className="access-check"><CheckCheck size={13} /></span>
                            <span className="access-text"><strong>{labelForPermission(permission)}</strong><code>{permission.name}</code></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {!catalogue.length && <p className="chat-empty">برای مشاهده فهرست دسترسی‌ها به مجوز «مشاهده فهرست دسترسی‌ها» نیاز دارید.</p>}
                <footer className="access-footer">
                  <span><LockKeyhole size={15} />{permissionDraft.size} دسترسی برای این گروه انتخاب شده است.</span>
                  <button type="button" onClick={savePermissions} disabled={!canEditPermissions || busy}>{busy ? 'در حال ذخیره...' : 'ذخیره دسترسی‌های گروه'}</button>
                </footer>
              </>
            )}

            {tab === 'اعضا' && (
              <>
                <label className="chat-search access-member-search">
                  <Search size={16} />
                  <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="جست‌وجوی کاربر..." />
                </label>
                <div className="access-group">
                  <ul>
                    {visibleUsers.map((member) => (
                      <li key={member.id}>
                        <label className={canEditMembers ? '' : 'is-locked'}>
                          <input type="checkbox" checked={memberDraft.has(member.id)} disabled={!canEditMembers} onChange={() => toggleMember(member.id)} />
                          <span className="access-check"><CheckCheck size={13} /></span>
                          <span className="access-text"><strong>{member.displayName}</strong><code>{member.email}</code></span>
                          {(member.roles || []).length > 0 && <span className="access-inherited"><ShieldCheck size={13} />{member.roles.join('، ')}</span>}
                        </label>
                      </li>
                    ))}
                    {!visibleUsers.length && <p className="chat-empty">کاربری یافت نشد.</p>}
                  </ul>
                </div>
                <footer className="access-footer">
                  <span><LockKeyhole size={15} />{memberDraft.size} کاربر عضو این گروه خواهند بود.</span>
                  <button type="button" onClick={saveMembers} disabled={!canEditMembers || busy}>{busy ? 'در حال ذخیره...' : 'ذخیره اعضای گروه'}</button>
                </footer>
              </>
            )}
          </>
        ) : (
          <p className="chat-empty">یک گروه را انتخاب کنید یا با دکمه + گروه تازه بسازید.</p>
        )}
      </div>

      {creating && <GroupEditor tenantId={tenantId} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); loadGroups(id) }} />}
      {editing && detail && <GroupEditor tenantId={tenantId} group={detail} onClose={() => setEditing(false)} onSaved={(id) => { setEditing(false); loadGroups(id) }} />}
    </section>
  )
}

function GroupEditor({ tenantId, group, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [isActive, setIsActive] = useState(group?.isActive ?? true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setError('')
    const result = group
      ? await groupsApi.update(group.id, { name: name.trim(), description: description.trim() || null, isActive })
      : await groupsApi.create({ tenantId, name: name.trim(), description: description.trim() || null })
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved(result.value?.id || group?.id)
  }

  return (
    <aside className="notification-drawer">
      <header><div><Users2 size={19} /><h3>{group ? 'ویرایش گروه' : 'گروه کاربری جدید'}</h3></div><button onClick={onClose}><X size={18} /></button></header>
      <label>نام گروه<input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً تیم مالی" /></label>
      <label>توضیح<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {group && (
        <label className="check-row">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          <span>گروه فعال باشد (گروه غیرفعال هیچ دسترسی‌ای به اعضا نمی‌دهد)</span>
        </label>
      )}
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="drawer-save" onClick={save} disabled={busy || !name.trim()}>{busy ? 'در حال ذخیره...' : group ? 'ذخیره تغییرات' : 'ایجاد گروه'}</button>
    </aside>
  )
}

/** Axis 2 - permissions granted directly to one user, on top of their role. */
function UserAccessPanel() {
  const { user: currentUser, can } = useAuth()
  const tenantId = currentUser?.tenantId || DEFAULT_TENANT_ID
  const PAGE_SIZE = 10
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [detail, setDetail] = useState(null)
  const [draft, setDraft] = useState(new Set())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setPage(1) }, [search])

  useEffect(() => {
    usersApi.list({ tenantId, pageNumber: page, pageSize: PAGE_SIZE, search }).then((result) => {
      if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
      const paged = unwrap(result)
      setUsers(paged?.items || [])
      setTotal(paged?.totalCount || 0)
    })
  }, [tenantId, page, search])

  async function loadDetail(userId) {
    setSelectedUserId(userId)
    setDetail(null)
    setMessage('')
    const result = await usersApi.permissions(userId)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setError('')
    const payload = unwrap(result)
    setDetail(payload)
    setDraft(new Set((payload?.permissions || []).filter((p) => p.grantedDirectly).map((p) => p.permissionId)))
  }

  function toggle(permissionId) {
    setDraft((current) => {
      const next = new Set(current)
      if (next.has(permissionId)) next.delete(permissionId); else next.add(permissionId)
      return next
    })
  }

  async function save() {
    if (!detail) return
    setBusy(true); setError(''); setMessage('')
    const result = await usersApi.assignPermissions(detail.userId, Array.from(draft))
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setMessage('دسترسی‌های مستقیم این کاربر ذخیره شد. کاربر باید یک‌بار خارج و دوباره وارد شود.')
    loadDetail(detail.userId)
  }

  // Regroup the flat entry list returned by the Core.
  const grouped = useMemo(() => {
    const map = new Map()
    for (const entry of detail?.permissions || []) {
      if (!map.has(entry.module)) map.set(entry.module, [])
      map.get(entry.module).push(entry)
    }
    return Array.from(map, ([module, permissions]) => ({ module, permissions }))
  }, [detail])

  const locked = !can('users.assign_permissions')

  return (
    <section className="access-panel">
      <aside className="access-side">
        <header><h4>کاربران</h4></header>
        <label className="chat-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی کاربر..." /></label>
        <div className="access-side-list">
          {users.map((user) => (
            <button key={user.id} type="button" className={user.id === selectedUserId ? 'active' : ''} onClick={() => loadDetail(user.id)}>
              <strong>{user.displayName}</strong>
              <small>{(user.roles || []).join('، ') || 'بدون سمت سازمانی'}</small>
            </button>
          ))}
          {!users.length && <p className="chat-empty">کاربری یافت نشد.</p>}
        </div>
        <Pagination pageNumber={page} pageSize={PAGE_SIZE} totalCount={total} onChange={setPage} />
      </aside>

      <div className="access-main">
        {error && <p className="login-error" role="alert">{error}</p>}
        {message && <p className="login-notice" role="status">{message}</p>}

        {detail ? (
          <>
            <div className="access-main-head">
              <div><strong>{detail.displayName}</strong><small>{detail.email} · سمت: {(detail.roles || []).join('، ') || 'ندارد'}</small></div>
            </div>
            <p className="access-hint">
              <CircleHelp size={15} />
              برچسب‌های سبز یعنی دسترسی از <b>سمت سازمانی</b> یا <b>گروه کاربری</b> به ارث رسیده و اینجا قابل حذف نیست؛
              برای تغییرشان به تب مربوطه بروید. تیک قابل انتخاب یعنی دسترسی <b>مستقیم</b> به این کاربر.
            </p>

            {grouped.map((group) => (
              <div className="access-group" key={group.module}>
                <h5>{labelForModule(group.module)}</h5>
                <ul>
                  {group.permissions.map((entry) => (
                    <li key={entry.permissionId}>
                      <label className={locked ? 'is-locked' : ''}>
                        <input type="checkbox" checked={draft.has(entry.permissionId)} disabled={locked} onChange={() => toggle(entry.permissionId)} />
                        <span className="access-check"><CheckCheck size={13} /></span>
                        <span className="access-text">
                          <strong>{labelForPermission(entry)}</strong>
                          <code>{entry.name}</code>
                        </span>
                        <span className="access-inherited-wrap">
                          {entry.grantedByRole && (
                            <span className="access-inherited" title={`از طریق سمت: ${entry.grantingRoles.join('، ')}`}>
                              <ShieldCheck size={13} />سمت: {entry.grantingRoles.join('، ')}
                            </span>
                          )}
                          {entry.grantedByGroup && (
                            <span className="access-inherited access-inherited--group" title={`از طریق گروه: ${entry.grantingGroups.join('، ')}`}>
                              <Users2 size={13} />گروه: {entry.grantingGroups.join('، ')}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <footer className="access-footer">
              <span><LockKeyhole size={15} />دسترسی نهایی = دسترسی سمت سازمانی + دسترسی مستقیم.</span>
              <button type="button" onClick={save} disabled={locked || busy}>{busy ? 'در حال ذخیره...' : 'ذخیره دسترسی‌های مستقیم'}</button>
            </footer>
          </>
        ) : (
          <p className="chat-empty">یک کاربر را از فهرست انتخاب کنید.</p>
        )}
      </div>
    </section>
  )
}

function UserCreator({ onClose, onCreated }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true); setError('')
    const result = await usersApi.create({
      tenantId: user?.tenantId || DEFAULT_TENANT_ID,
      email: email.trim(),
      displayName: displayName.trim(),
      password,
      isActive: true,
    })
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onCreated()
  }

  return (
    <aside className="notification-drawer">
      <header><div><UserPlus size={19} /><h3>کاربر جدید</h3></div><button onClick={onClose}><X size={18} /></button></header>
      <label>ایمیل<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>نام نمایشی<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <label>رمز عبور (حداقل ۸ کاراکتر)<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button className="drawer-save" onClick={save} disabled={busy}>{busy ? 'در حال ایجاد...' : 'ایجاد کاربر'}</button>
    </aside>
  )
}

function UserManagement() {
  const [tab, setTab] = useState('کاربران')
  const [creating, setCreating] = useState(false)
  const { canReach } = useAuth()
  const tabs = [
    { label: 'کاربران', icon: UsersRound, permissions: sectionPermissions.users },
    { label: 'تاریخچه ورود', icon: History, permissions: sectionPermissions.loginHistory },
    { label: 'نقش‌ها و دسترسی‌ها', icon: KeyRound, permissions: sectionPermissions.access },
    { label: 'چارت سازمانی', icon: Network, permissions: sectionPermissions.orgChart },
  ].filter((item) => canReach(item.permissions))

  // Land on a tab the user can actually open.
  useEffect(() => {
    if (tabs.length && !tabs.some((item) => item.label === tab)) setTab(tabs[0].label)
  }, [tabs, tab])
  return <div className="user-management"><div className="task-page-header"><div><span>تنظیمات سازمانی</span><h1>مدیریت کاربران</h1><p>مدیریت حساب‌ها، ساختار سازمانی و سطوح دسترسی</p></div>{tab === 'کاربران' && <Can permission="users.create"><button onClick={() => setCreating(true)}><UserPlus size={18} />کاربر جدید</button></Can>}</div><nav className="user-tabs">{tabs.map(({label,icon:Icon}) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={17} />{label}</button>)}</nav>{tab === 'کاربران' && <UsersTable />}{tab === 'تاریخچه ورود' && <LoginHistory />}{tab === 'چارت سازمانی' && <OrgChart />}{tab === 'نقش‌ها و دسترسی‌ها' && <AccessControl />}{creating && <UserCreator onClose={() => setCreating(false)} onCreated={() => { setCreating(false); setTab('کاربران') }} />}</div>
}

function UserProfile() {
  const { user } = useAuth()
  const fields = [
    ['نام کاربر', user?.displayName || 'ثبت نشده'],
    ['ایمیل', user?.email || 'ثبت نشده'],
    ['نقش اصلی', user?.roles?.[0] || 'بدون نقش'],
    ['همه نقش‌ها', user?.roles?.join('، ') || 'بدون نقش'],
    ['شناسه کاربر', user?.id || 'ثبت نشده'],
    ['شناسه سازمان', user?.tenantId || DEFAULT_TENANT_ID],
  ]

  return (
    <section className="profile-page">
      <div className="task-page-header">
        <div><span>حساب کاربری</span><h1>پروفایل کاربر</h1><p>مشخصات نشست فعلی و نقش‌های اختصاص داده شده</p></div>
      </div>
      <div className="profile-hero">
        <span className="avatar">{initialsOf(user?.displayName || user?.email)}</span>
        <div>
          <h2>{user?.displayName || 'کاربر روزت'}</h2>
          <p>{user?.email || 'ایمیل ثبت نشده'}</p>
        </div>
        <small>{user?.roles?.[0] || 'بدون نقش'}</small>
      </div>
      <div className="profile-grid">
        {fields.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function TopbarUserMenu({ onProfile, onSignOut }) {
  const { user } = useAuth()
  return (
    <div className="profile-menu">
      <button className="profile-chip">
        <span className="avatar">{initialsOf(user?.displayName || user?.email)}</span>
        <div><strong>{user?.displayName || 'کاربر'}</strong><small>{(user?.roles || [])[0] || user?.email}</small></div>
        <ChevronLeft size={16} />
      </button>
      <div className="profile-dropdown">
        <button type="button" onClick={onProfile}><UserCog size={17} />پروفایل</button>
        <button type="button" onClick={onSignOut}><LogOut size={17} />خروج</button>
      </div>
    </div>
  )
}

/** Bell + dropdown, fed by /api/notifications and the notifications hub. */
function NotificationBell() {
  const { items, unread, markAsRead, markAllAsRead, refresh } = useNotifications(true)
  const [open, setOpen] = useState(false)

  return (
    <div className="notification-bell">
      <button className="icon-button" onClick={() => { setOpen((v) => !v); if (!open) refresh() }} aria-label="اعلان‌ها">
        <Bell size={20} />
        {unread > 0 && <i className="has-unread">{unread > 9 ? '۹+' : unread}</i>}
      </button>
      {open && (
        <div className="notification-popover">
          <header>
            <h4>اعلان‌ها {unread > 0 && <span>({unread} خوانده‌نشده)</span>}</h4>
            <div>
              {unread > 0 && <button onClick={markAllAsRead}><CheckCheck size={15} />همه خوانده شد</button>}
              <button onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
          </header>
          <ul>
            {items.map((notification) => (
              <li key={notification.id} className={notification.isRead ? '' : 'unread'}>
                <button onClick={() => !notification.isRead && markAsRead(notification.id)}>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <time>{formatDateTime(notification.createdAt)}</time>
                </button>
              </li>
            ))}
            {!items.length && <li className="empty">اعلانی وجود ندارد.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

const JALALI_MONTH_NAMES = [
  '\u0641\u0631\u0648\u0631\u062F\u06CC\u0646', '\u0627\u0631\u062F\u06CC\u0628\u0647\u0634\u062A',
  '\u062E\u0631\u062F\u0627\u062F', '\u062A\u06CC\u0631', '\u0645\u0631\u062F\u0627\u062F', '\u0634\u0647\u0631\u06CC\u0648\u0631',
  '\u0645\u0647\u0631', '\u0622\u0628\u0627\u0646', '\u0622\u0630\u0631', '\u062F\u06CC', '\u0628\u0647\u0645\u0646', '\u0627\u0633\u0641\u0646\u062F',
]
const JALALI_WEEKDAYS = [
  { label: '\u0634', full: '\u0634\u0646\u0628\u0647' },
  { label: '\u06CC', full: '\u06CC\u06A9\u0634\u0646\u0628\u0647' },
  { label: '\u062F', full: '\u062F\u0648\u0634\u0646\u0628\u0647' },
  { label: '\u0633', full: '\u0633\u0647\u200C\u0634\u0646\u0628\u0647' },
  { label: '\u0686', full: '\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647' },
  { label: '\u067E', full: '\u067E\u0646\u062C\u0634\u0646\u0628\u0647' },
  { label: '\u062C', full: '\u062C\u0645\u0639\u0647' },
]
const JALALI_DIGITS = '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9'
const JALALI_DAY_MS = 86400000
const JALALI_FORMATTER = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
})

function jalaliPartsFromDate(date) {
  const parts = JALALI_FORMATTER.formatToParts(date)
  const part = type => parts.find(item => item.type === type)?.value
  return {
    jy: Number.parseInt(part('year') || part('relatedYear'), 10),
    jm: Number.parseInt(part('month'), 10),
    jd: Number.parseInt(part('day'), 10),
  }
}

function jalaliPartsFromISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  return jalaliPartsFromDate(new Date(`${value}T12:00:00Z`))
}

function jalaliTodayISO() {
  const date = new Date()
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function jalaliToGregorianISO(jy, jm, jd) {
  const start = Date.UTC(jy + 621, 2, 15, 12)

  for (let offset = 0; offset < 390; offset += 1) {
    const candidate = new Date(start + offset * JALALI_DAY_MS)
    const parts = jalaliPartsFromDate(candidate)

    if (parts.jy === jy && parts.jm === jm && parts.jd === jd) {
      return [
        String(candidate.getUTCFullYear()).padStart(4, '0'),
        String(candidate.getUTCMonth() + 1).padStart(2, '0'),
        String(candidate.getUTCDate()).padStart(2, '0'),
      ].join('-')
    }
  }

  return ''
}

function jalaliDigits(value, minLength = 1) {
  return String(value).padStart(minLength, '0')
    .replace(/[0-9]/g, digit => JALALI_DIGITS[Number(digit)])
}

function JalaliDatePicker({ value, onChange }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const todayISO = useMemo(() => jalaliTodayISO(), [])
  const todayParts = useMemo(() => jalaliPartsFromISO(todayISO), [todayISO])
  const selectedParts = useMemo(() => jalaliPartsFromISO(value), [value])
  const [view, setView] = useState(() => {
    const initial = jalaliPartsFromISO(value) || jalaliPartsFromISO(jalaliTodayISO())
    return { jy: initial.jy, jm: initial.jm }
  })

  useEffect(() => {
    if (selectedParts) setView({ jy: selectedParts.jy, jm: selectedParts.jm })
  }, [value])

  useEffect(() => {
    if (!open) return undefined
    const outside = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const shiftMonth = amount => setView(current => {
    let jy = current.jy
    let jm = current.jm + amount
    if (jm < 1) { jy -= 1; jm = 12 }
    if (jm > 12) { jy += 1; jm = 1 }
    return { jy, jm }
  })

  const nextMonth = view.jm === 12
    ? { jy: view.jy + 1, jm: 1 }
    : { jy: view.jy, jm: view.jm + 1 }

  const firstISO = jalaliToGregorianISO(view.jy, view.jm, 1)
  const nextISO = jalaliToGregorianISO(nextMonth.jy, nextMonth.jm, 1)
  const firstDate = new Date(`${firstISO}T12:00:00Z`)
  const daysInMonth = Math.round(
    (Date.parse(`${nextISO}T12:00:00Z`) - Date.parse(`${firstISO}T12:00:00Z`)) / JALALI_DAY_MS
  )
  const firstOffset = (firstDate.getUTCDay() + 1) % 7
  const cellCount = Math.ceil((firstOffset + daysInMonth) / 7) * 7
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const day = i - firstOffset + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  const displayDate = selectedParts
    ? `${jalaliDigits(selectedParts.jy, 4)}/${jalaliDigits(selectedParts.jm, 2)}/${jalaliDigits(selectedParts.jd, 2)}`
    : '\u0627\u0646\u062A\u062E\u0627\u0628 \u062A\u0627\u0631\u06CC\u062E \u0634\u0645\u0633\u06CC'

  return (
    <div className="jalali-date-picker" ref={rootRef}>
      <div className="jalali-date-picker__controls">
        <button type="button" className="jalali-date-picker__trigger"
          onClick={() => setOpen(current => !current)}
          aria-haspopup="dialog" aria-expanded={open}>
          <CalendarDays size={18} />
          <span>{displayDate}</span>
        </button>
        {value && (
          <button type="button" className="jalali-date-picker__clear"
            onClick={() => onChange('')}
            aria-label={'\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u062A\u0627\u0631\u06CC\u062E'}
            title={'\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u062A\u0627\u0631\u06CC\u062E'}>
            {'\u00D7'}
          </button>
        )}
      </div>

      {open && (
        <div className="jalali-calendar" role="dialog"
          aria-label={'\u062A\u0642\u0648\u06CC\u0645 \u0634\u0645\u0633\u06CC'}>
          <div className="jalali-calendar__header">
            <button type="button" onClick={() => shiftMonth(-1)}
              aria-label={'\u0645\u0627\u0647 \u0642\u0628\u0644'}>{'\u2039'}</button>
            <strong>{JALALI_MONTH_NAMES[view.jm - 1]} {jalaliDigits(view.jy)}</strong>
            <button type="button" onClick={() => shiftMonth(1)}
              aria-label={'\u0645\u0627\u0647 \u0628\u0639\u062F'}>{'\u203A'}</button>
          </div>

          <div className="jalali-calendar__grid jalali-calendar__weekdays">
            {JALALI_WEEKDAYS.map(day => <span key={day.full} title={day.full}>{day.label}</span>)}
          </div>

          <div className="jalali-calendar__grid">
            {cells.map((day, index) => {
              if (day === null) {
                return <span key={`empty-${index}`} className="jalali-calendar__empty" aria-hidden="true" />
              }

              const selected = selectedParts?.jy === view.jy &&
                selectedParts?.jm === view.jm && selectedParts?.jd === day
              const today = todayParts.jy === view.jy &&
                todayParts.jm === view.jm && todayParts.jd === day

              return (
                <button key={day} type="button"
                  className={[
                    'jalali-calendar__day',
                    selected ? 'is-selected' : '',
                    today ? 'is-today' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    const iso = jalaliToGregorianISO(view.jy, view.jm, day)
                    if (iso) onChange(iso)
                    setOpen(false)
                  }}
                  aria-pressed={Boolean(selected)}
                  aria-label={`${day} ${JALALI_MONTH_NAMES[view.jm - 1]} ${view.jy}`}>
                  {jalaliDigits(day)}
                </button>
              )
            })}
          </div>

          <div className="jalali-calendar__footer">
            <button type="button" onClick={() => {
              onChange(todayISO)
              setView({ jy: todayParts.jy, jm: todayParts.jm })
              setOpen(false)
            }}>{'\u0627\u0645\u0631\u0648\u0632'}</button>
            <button type="button" onClick={() => setOpen(false)}>{'\u0628\u0633\u062A\u0646'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const REPORTING_EXPORT_OPTIONS = [
  { key: 'unit-performance', label: 'عملکرد واحدهای سازمانی', description: 'گزارش عملکرد در سطح واحدهای سازمانی' },
  { key: 'unit-status-matrix', label: 'ماتریس وضعیت واحدها', description: 'نمای وضعیت پروژه‌ها به تفکیک واحد' },
  { key: 'project-managers', label: 'ارزیابی مدیران پروژه', description: 'گزارش ارزیابی عملکرد مدیران پروژه' },
  { key: 'strategy-alignment', label: 'هم‌راستایی راهبردی', description: 'ماتریس هم‌راستایی پروژه‌ها با راهبردها' },
  { key: 'health', label: 'سلامت پروژه‌ها', description: 'نمای مدیریتی سلامت پروژه‌ها' },
  { key: 'attention', label: 'موارد نیازمند توجه', description: 'مواردی که نیازمند پیگیری مدیریتی هستند' },
  { key: 'risks', label: 'نمای کلی ریسک‌ها', description: 'خلاصه ریسک‌های ثبت‌شده و ریسک‌های مهم' },
  { key: 'kpis', label: 'نمای کلی شاخص‌های کلیدی', description: 'گزارش خلاصه KPIها و شاخص‌های عملکرد' },
]

const REPORTING_VALUE_LABELS = Object.freeze({
  Green: 'مناسب',
  Amber: 'نیازمند توجه',
  Red: 'بحرانی',
  Unknown: 'نامشخص',
  Excellent: 'عالی',
  Good: 'خوب',
  NeedsImprovement: 'نیازمند بهبود',
  NoPerformanceData: 'بدون داده عملکردی',
  Active: 'در جریان',
  OnHold: 'متوقف',
  Completed: 'تکمیل‌شده',
  Draft: 'پیش‌نویس',
  Archived: 'بایگانی‌شده',
  OnTrack: 'طبق برنامه',
  AtRisk: 'در معرض ریسک',
  Behind: 'عقب‌افتاده',
  High: 'زیاد',
  Medium: 'متوسط',
  Low: 'کم',
  None: 'بدون هم‌راستایی',
  Quality: 'کیفی',
  Quantity: 'کمی',
  ProjectOverdue: 'پروژه عقب‌افتاده',
  ProjectRed: 'پروژه با وضعیت بحرانی',
  ProjectAtRisk: 'پروژه در معرض ریسک',
  RiskWithoutResponsePlan: 'ریسک بدون برنامه پاسخ',
  ActionOverdue: 'اقدام عقب‌افتاده',
  HighRisk: 'دارای ریسک بازِ بالا',
  NoOpenHighRisk: 'بدون ریسک بازِ بالا',
  Aligned: 'دارای هم‌راستایی',
  Unaligned: 'بدون هم‌راستایی',
  NoProjects: 'بدون پروژه',
})

const reportingValueLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return REPORTING_VALUE_LABELS[String(value)] || String(value)
}

const reportingFormatValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'

  if (typeof value === 'boolean') return value ? 'بله' : 'خیر'

  if (typeof value === 'number') {
    return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(value)
  }

  if (Array.isArray(value)) {
    return value.length ? value.map(reportingFormatValue).join('، ') : '—'
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('fa-IR')
  }

  return reportingValueLabel(value)
}

const reportingList = (value) => Array.isArray(value) ? value : []

const makeReportingItem = (id, title, subtitle, category, entries, source) => {
  const details = entries.map(([label, value]) => ({ label, value }))
  const searchText = [
    title,
    subtitle,
    category,
    ...details.flatMap((detail) => [
      detail.label,
      reportingFormatValue(detail.value),
    ]),
  ].filter((value) => value !== null && value !== undefined)
    .join(' ')
    .toLocaleLowerCase()

  return {
    id: String(id ?? title ?? Math.random()),
    title: String(title ?? 'بدون عنوان'),
    subtitle: subtitle ? String(subtitle) : '',
    category: category || 'Unknown',
    details,
    source,
    searchText,
  }
}

const reportingRating = (rating, average) =>
  rating || (
    average === null || average === undefined
      ? 'NoPerformanceData'
      : average >= 90
        ? 'Excellent'
        : average >= 70
          ? 'Good'
          : 'NeedsImprovement'
  )

function buildReportingView(report, data) {
  const items = []
  const metrics = []
  const addMetrics = (entries) => {
    entries.forEach(([label, value]) => metrics.push({ label, value }))
  }

  if (!data || typeof data !== 'object') {
    return { items, metrics, chartTitle: 'توزیع رکوردهای گزارش' }
  }

  switch (report) {
    case 'unit-performance': {
      const summary = data.summary || {}

      addMetrics([
        ['تعداد پروژه‌ها', summary.projectCount],
        ['پروژه‌های در جریان', summary.runningProjects],
        ['پروژه‌های تأخیردار', summary.delayedProjects],
        ['میانگین عملکرد (%)', summary.averagePerformance],
      ])

      reportingList(data.units).forEach((row) => {
        const category = reportingRating(row.rating, row.averagePerformance)
        items.push(makeReportingItem(
          row.unitId ?? row.unitName,
          row.unitName,
          row.unitCode || `سطح ${row.level ?? '—'}`,
          category,
          [
            ['شناسه واحد', row.unitId],
            ['کد واحد', row.unitCode],
            ['سطح سازمانی', row.level],
            ['تعداد پروژه‌ها', row.projectCount],
            ['پروژه‌های در جریان', row.runningProjects],
            ['پروژه‌های تکمیل‌شده', row.completedProjects],
            ['پروژه‌های عقب‌افتاده', row.overdueProjects],
            ['بودجه کل', row.totalBudget],
            ['پروژه‌های دارای داده پیشرفت', row.projectsWithProgress],
            ['میانگین پیشرفت برنامه‌ای (%)', row.averagePlannedProgress],
            ['میانگین پیشرفت واقعی (%)', row.averageActualProgress],
            ['میانگین انحراف', row.averageDeviation],
            ['طبق برنامه', row.onTrack],
            ['در معرض ریسک', row.atRisk],
            ['عقب‌افتاده بر اساس عملکرد', row.behind],
            ['تعداد پروژه‌های تأخیردار', row.delayedProjects],
            ['میانگین عملکرد (%)', row.averagePerformance],
            ['ارزیابی', row.rating],
            ['شناسه پروژه‌های واحد', row.projectIds],
          ],
          row,
        ))
      })
      break
    }

    case 'unit-status-matrix': {
      const statuses = reportingList(data.statuses)

      addMetrics([
        ['تعداد واحدها', reportingList(data.rows).length],
        ['مجموع پروژه‌ها', data.total],
      ])

      reportingList(data.rows).forEach((row) => {
        const counts = reportingList(row.counts)
        let dominantIndex = -1
        let dominantCount = 0

        counts.forEach((count, index) => {
          if (Number(count || 0) > dominantCount) {
            dominantCount = Number(count || 0)
            dominantIndex = index
          }
        })

        const category = dominantIndex >= 0
          ? statuses[dominantIndex]
          : 'NoProjects'

        const statusDetails = statuses.map((status, index) => [
          `تعداد ${reportingValueLabel(status)}`,
          counts[index] ?? 0,
        ])

        items.push(makeReportingItem(
          row.unitId ?? row.unitName,
          row.unitName,
          row.unitCode || '',
          category,
          [
            ['شناسه واحد', row.unitId],
            ['کد واحد', row.unitCode],
            ['مجموع پروژه‌ها', row.total],
            ...statusDetails,
          ],
          row,
        ))
      })
      break
    }

    case 'project-managers': {
      const managers = reportingList(data.managers)

      addMetrics([
        ['تعداد مدیران', managers.length],
        ['کل پروژه‌ها', managers.reduce((sum, row) => sum + Number(row.projectCount || 0), 0)],
        ['پروژه‌های تأخیردار', managers.reduce((sum, row) => sum + Number(row.delayedProjects || 0), 0)],
      ])

      managers.forEach((row) => {
        const category = reportingRating(row.rating, row.averagePerformance)
        const id = row.managerUserId
        items.push(makeReportingItem(
          id || `manager-${items.length}`,
          id ? `مدیر پروژه · ${String(id).slice(0, 8)}` : 'مدیر بدون شناسه',
          '',
          category,
          [
            ['شناسه مدیر', id],
            ['تعداد پروژه‌ها', row.projectCount],
            ['پروژه‌های در جریان', row.runningProjects],
            ['پروژه‌های تکمیل‌شده', row.completedProjects],
            ['پروژه‌های عقب‌افتاده', row.overdueProjects],
            ['بودجه کل', row.totalBudget],
            ['پروژه‌های دارای داده پیشرفت', row.projectsWithProgress],
            ['میانگین پیشرفت برنامه‌ای (%)', row.averagePlannedProgress],
            ['میانگین پیشرفت واقعی (%)', row.averageActualProgress],
            ['میانگین انحراف', row.averageDeviation],
            ['طبق برنامه', row.onTrack],
            ['در معرض ریسک', row.atRisk],
            ['عقب‌افتاده بر اساس عملکرد', row.behind],
            ['سهم طبق برنامه (%)', row.onTrackShare],
            ['اقدام‌های باز', row.openActions],
            ['پروژه‌های تأخیردار', row.delayedProjects],
            ['میانگین عملکرد (%)', row.averagePerformance],
            ['ارزیابی', row.rating],
            ['شناسه پروژه‌ها', row.projectIds],
          ],
          row,
        ))
      })
      break
    }

    case 'strategy-alignment': {
      const strategies = reportingList(data.strategies)
      const projects = reportingList(data.projects)

      addMetrics([
        ['تعداد راهبردها', strategies.length],
        ['تعداد پروژه‌ها', projects.length],
        ['پروژه‌های بدون هم‌راستایی', reportingList(data.unalignedProjectIds).length],
        ['راهبردهای بدون پروژه مرتبط', reportingList(data.uncoveredStrategyIds).length],
      ])

      projects.forEach((row) => {
        const cells = reportingList(row.cells)
        const cellDetails = cells.map((cell, index) => {
          const strategyName = strategies[index]?.name || `راهبرد ${index + 1}`
          const suffix = cell.percentage === null || cell.percentage === undefined
            ? ''
            : ` · ${cell.percentage}%`
          return [`هم‌راستایی با ${strategyName}`, `${reportingValueLabel(cell.level)}${suffix}`]
        })

        const category = Number(row.alignedStrategies || 0) > 0 ? 'Aligned' : 'Unaligned'

        items.push(makeReportingItem(
          row.projectId,
          row.name,
          row.code || '',
          category,
          [
            ['شناسه پروژه', row.projectId],
            ['کد پروژه', row.code],
            ['تعداد راهبردهای هم‌راستا', row.alignedStrategies],
            ['میانگین هم‌راستایی (%)', row.averagePercentage],
            ['هم‌راستایی وزنی (%)', row.weightedPercentage],
            ...cellDetails,
          ],
          row,
        ))
      })
      break
    }

    case 'health': {
      const projects = reportingList(data.projects)

      addMetrics([
        ['تعداد پروژه‌ها', data.projectCount ?? projects.length],
        ...reportingList(data.counts).map((entry) => [
          `سلامت: ${reportingValueLabel(entry.name)}`,
          entry.count,
        ]),
      ])

      projects.forEach((row) => {
        items.push(makeReportingItem(
          row.projectId,
          row.name,
          row.code || '',
          row.health || 'Unknown',
          [
            ['شناسه پروژه', row.projectId],
            ['کد پروژه', row.code],
            ['وضعیت پروژه', row.status],
            ['شناسه واحد سازمانی', row.organizationUnitId],
            ['شناسه مدیر پروژه', row.managerUserId],
            ['وضعیت سلامت', row.health],
            ['پیشرفت برنامه‌ای (%)', row.plannedProgress],
            ['پیشرفت واقعی (%)', row.actualProgress],
            ['شاخص عملکرد زمان (SPI)', row.spi],
            ['شاخص عملکرد هزینه (CPI)', row.cpi],
            ['تأخیر پیش‌بینی‌شده (روز)', row.forecastDelayDays],
            ['عقب‌افتاده', row.isOverdue],
          ],
          row,
        ))
      })
      break
    }

    case 'attention': {
      const rows = reportingList(data.items)

      addMetrics([
        ['کل موارد شناسایی‌شده', data.total],
        ['موارد قابل نمایش', rows.length],
        ['گزارش ناقص به علت سقف نمایش', data.truncated ? 'بله' : 'خیر'],
        ['بررسی ریسک‌ها فعال است', data.risksIncluded ? 'بله' : 'خیر'],
      ])

      rows.forEach((row, index) => {
        items.push(makeReportingItem(
          row.subjectId || `attention-${index}`,
          row.title,
          row.projectName || row.subjectType || '',
          row.kind || 'Unknown',
          [
            ['نوع مورد', row.kind],
            ['شدت', row.severity],
            ['نوع موضوع', row.subjectType],
            ['شناسه موضوع', row.subjectId],
            ['شناسه پروژه', row.projectId],
            ['نام پروژه', row.projectName],
            ['عنوان', row.title],
            ['تاریخ سررسید', row.dueDate],
            ['تعداد روزهای تأخیر', row.daysLate],
            ['شناسه مسئول', row.ownerUserId],
          ],
          row,
        ))
      })
      break
    }

    case 'risks': {
      const projects = reportingList(data.projects)
      const topRisks = reportingList(data.topRisks)

      addMetrics([
        ['کل ریسک‌های تأییدشده', data.total],
        ['ریسک‌های زیاد', data.high],
        ['ریسک‌های متوسط', data.medium],
        ['ریسک‌های کم', data.low],
        ['ریسک‌های زیادِ باز', data.openHigh],
        ['ریسک‌های زیاد بدون برنامه پاسخ', data.openHighWithoutResponsePlan],
      ])

      if (projects.length) {
        projects.forEach((row) => {
          const relatedRisks = topRisks
            .filter((risk) => risk.projectId === row.projectId)
            .map((risk) => `${risk.description} · RPN: ${risk.rpn}`)

          items.push(makeReportingItem(
            row.projectId,
            row.name,
            row.code || '',
            Number(row.openHigh || 0) > 0 ? 'HighRisk' : 'NoOpenHighRisk',
            [
              ['شناسه پروژه', row.projectId],
              ['کد پروژه', row.code],
              ['مجموع ریسک‌های این پروژه', row.total],
              ['ریسک‌های زیاد', row.high],
              ['ریسک‌های متوسط', row.medium],
              ['ریسک‌های کم', row.low],
              ['ریسک‌های زیادِ باز', row.openHigh],
              ['ریسک‌های مهم موجود در فهرست ۱۰ مورد برتر', relatedRisks],
            ],
            row,
          ))
        })
      } else {
        topRisks.forEach((row) => {
          items.push(makeReportingItem(
            row.riskId,
            row.description,
            row.projectName || '',
            row.level || 'Unknown',
            [
              ['شناسه ریسک', row.riskId],
              ['شناسه پروژه', row.projectId],
              ['نام پروژه', row.projectName],
              ['شرح ریسک', row.description],
              ['امتیاز احتمال', row.probabilityScore],
              ['امتیاز اثر', row.impactScore],
              ['امتیاز RPN', row.rpn],
              ['سطح ریسک', row.level],
              ['وضعیت پاسخ', row.responseStatus],
              ['شناسه مالک ریسک', row.riskOwnerUserId],
              ['برنامه پاسخ ثبت شده', row.hasResponsePlan],
            ],
            row,
          ))
        })
      }
      break
    }

    case 'kpis': {
      const kpis = reportingList(data.kpis)

      addMetrics([
        ['کل شاخص‌ها', data.kpiCount],
        ['شاخص‌های دارای مقدار', data.withValues],
        ['شاخص‌های بدون مقدار', data.withoutValues],
        ['عالی', data.excellent],
        ['خوب', data.good],
        ['نیازمند بهبود', data.needsImprovement],
        ['میانگین تحقق هدف (%)', data.averageAchievement],
      ])

      kpis.forEach((row) => {
        const trend = reportingList(row.trend).map(
          (point) => `${reportingFormatValue(point.measuredOn)}: ${reportingFormatValue(point.value)}`
        )

        items.push(makeReportingItem(
          row.kpiId,
          row.description || `شاخص ${row.projectCode || ''}`,
          row.projectName || row.projectCode || '',
          row.type || 'Unknown',
          [
            ['شناسه شاخص', row.kpiId],
            ['شناسه پروژه', row.projectId],
            ['نام پروژه', row.projectName],
            ['کد پروژه', row.projectCode],
            ['شناسه تحویل‌دادنی', row.deliverableId],
            ['نوع شاخص', row.type],
            ['شرح شاخص', row.description],
            ['فرمول', row.formula],
            ['مقدار هدف', row.targetValue],
            ['آخرین مقدار ثبت‌شده', row.latestValue],
            ['تاریخ آخرین اندازه‌گیری', row.latestMeasuredOn],
            ['تعداد اندازه‌گیری‌ها', row.measurementCount],
            ['درصد تحقق هدف', row.achievementPercent],
            ['ارزیابی عملکرد', row.rating],
            ['روند اندازه‌گیری‌ها', trend],
          ],
          row,
        ))
      })
      break
    }

    default:
      break
  }

  const chartTitles = {
    'unit-performance': 'توزیع واحدها بر اساس ارزیابی عملکرد',
    'unit-status-matrix': 'توزیع وضعیت پروژه‌ها در واحدهای انتخاب‌شده',
    'project-managers': 'توزیع مدیران بر اساس ارزیابی عملکرد',
    'strategy-alignment': 'توزیع سطح هم‌راستایی راهبردی',
    health: 'توزیع پروژه‌ها بر اساس سلامت',
    attention: 'توزیع موارد بر اساس نوع',
    risks: 'توزیع پروژه‌ها بر اساس ریسک بازِ بالا',
    kpis: 'توزیع شاخص‌ها بر اساس نوع',
  }

  return {
    items,
    metrics,
    chartTitle: chartTitles[report] || 'توزیع رکوردهای گزارش',
  }
}

const REPORTING_CHART_COLORS = [
  '#2563eb',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#dc2626',
  '#64748b',
  '#db2777',
  '#0d9488',
]

function reportingDonutPath(start, end) {
  const cx = 160
  const cy = 160
  const outer = 112
  const inner = 66

  const point = (radius, angle) => ({
    x: cx + radius * Math.cos(angle - Math.PI / 2),
    y: cy + radius * Math.sin(angle - Math.PI / 2),
  })

  const p1 = point(outer, start)
  const p2 = point(outer, end)
  const p3 = point(inner, end)
  const p4 = point(inner, start)
  const large = end - start > Math.PI ? 1 : 0

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ')
}

function ReportingPieChart({ title, slices, zoom, setZoom, onExpand }) {
  const total = slices.reduce((sum, slice) => sum + Number(slice.count || 0), 0)
  let accumulated = 0

  const segments = slices
    .filter((slice) => Number(slice.count || 0) > 0)
    .map((slice, index) => {
      const start = accumulated / (total || 1) * Math.PI * 2
      accumulated += Number(slice.count || 0)
      const end = accumulated / (total || 1) * Math.PI * 2

      return {
        ...slice,
        color: REPORTING_CHART_COLORS[index % REPORTING_CHART_COLORS.length],
        path: reportingDonutPath(start, end),
        percentage: total ? Number(slice.count) / total * 100 : 0,
      }
    })

  return (
    <div className="reporting-pie-content">
      <div className="reporting-pie-toolbar">
        <div className="reporting-pie-zoom-controls">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.2).toFixed(1))))}
            disabled={zoom <= 0.7}
            aria-label="کوچک‌نمایی نمودار"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}٪</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2, Number((value + 0.2).toFixed(1))))}
            disabled={zoom >= 2}
            aria-label="بزرگ‌نمایی نمودار"
          >
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>اندازه عادی</button>
        </div>

        {onExpand && (
          <button type="button" onClick={onExpand}>
            نمایش بزرگ
          </button>
        )}
      </div>

      <div className="reporting-pie-stage">
        <svg
          className="reporting-pie-svg"
          viewBox="0 0 320 320"
          role="img"
          aria-label={title}
          style={{ transform: `scale(${zoom})` }}
        >
          <title>{title}</title>

          {segments.length === 1 ? (
            <circle
              cx="160"
              cy="160"
              r="112"
              fill={segments[0].color}
            />
          ) : (
            segments.map((segment) => (
              <path
                key={segment.label}
                d={segment.path}
                fill={segment.color}
                stroke="#ffffff"
                strokeWidth="2"
              />
            ))
          )}

          <circle cx="160" cy="160" r="64" fill="#ffffff" />
          <text
            x="160"
            y="153"
            textAnchor="middle"
            className="reporting-pie-total"
          >
            {reportingFormatValue(total)}
          </text>
          <text
            x="160"
            y="180"
            textAnchor="middle"
            className="reporting-pie-center-label"
          >
            تعداد
          </text>
        </svg>
      </div>

      {segments.length ? (
        <div className="reporting-pie-legend">
          {segments.map((segment) => (
            <div className="reporting-pie-legend-item" key={segment.label}>
              <span
                className="reporting-pie-swatch"
                style={{ backgroundColor: segment.color }}
              />
              <span className="reporting-pie-legend-label">
                {reportingValueLabel(segment.label)}
              </span>
              <strong>{reportingFormatValue(segment.count)}</strong>
              <small>{reportingFormatValue(Number(segment.percentage.toFixed(1)))}٪</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="reporting-empty-state">برای نمایش نمودار، داده‌ای وجود ندارد.</p>
      )}
    </div>
  )
}

function reportingChartSlices(report, items, payload) {
  if (report === 'unit-status-matrix') {
    const statuses = reportingList(payload?.statuses)
    return statuses.map((status, index) => ({
      label: status,
      count: items.reduce(
        (sum, item) => sum + Number(item.source?.counts?.[index] || 0),
        0,
      ),
    })).filter((slice) => slice.count > 0)
  }

  if (report === 'strategy-alignment') {
    const counts = new Map()

    items.forEach((item) => {
      reportingList(item.source?.cells).forEach((cell) => {
        const level = cell?.level || 'Unknown'
        counts.set(level, (counts.get(level) || 0) + 1)
      })
    })

    const preferredOrder = ['High', 'Medium', 'Low', 'None', 'Unknown']
    const remaining = [...counts.keys()].filter((key) => !preferredOrder.includes(key))

    return [...preferredOrder, ...remaining]
      .filter((key) => counts.has(key))
      .map((key) => ({ label: key, count: counts.get(key) }))
      .filter((slice) => slice.count > 0)
  }

  const counts = new Map()
  items.forEach((item) => {
    const category = item.category || 'Unknown'
    counts.set(category, (counts.get(category) || 0) + 1)
  })

  return [...counts.entries()].map(([label, count]) => ({ label, count }))
}

const reportingRequestError = (result) => {
  if (result?.status === 401) {
    return 'نشست شما معتبر نیست. دوباره وارد سامانه شوید.'
  }

  if (result?.status === 403) {
    return 'برای مشاهده این گزارش، دسترسی سازمانی Reporting.ViewAll لازم است.'
  }

  if (result?.status === 409) {
    return 'این گزارش در حال حاضر قابل تولید نیست؛ فعال بودن ماژول‌های وابسته و داده‌های لازم را بررسی کنید.'
  }

  const raw = result?.error
  if (typeof raw === 'string' && raw) return raw
  if (raw?.detail) return raw.detail
  if (raw?.message) return raw.message
  if (raw?.title) return raw.title

  return 'دریافت گزارش ناموفق بود. وضعیت API و دسترسی خود را بررسی کنید.'
}

function createFakeReportingPayload(report, asOf) {
  const date = asOf || '2026-10-19'
  const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const projectIds = (first, count) => Array.from({ length: count }, (_, i) => id(first + i))

  switch (report) {
    case 'unit-performance':
      return {
        level: 2, maxLevel: 5, asOf: date,
        summary: {
          projectCount: 42, runningProjects: 28, delayedProjects: 9,
          averagePerformance: 76.4, rating: 'Good',
        },
        units: [
          {
            unitId: id(101), unitName: 'فناوری اطلاعات', unitCode: 'IT', level: 2,
            projectCount: 12, runningProjects: 8, completedProjects: 4, overdueProjects: 1,
            totalBudget: 8400000000, projectsWithProgress: 10,
            averagePlannedProgress: 68, averageActualProgress: 72, averageDeviation: 4,
            onTrack: 7, atRisk: 2, behind: 1, delayedProjects: 1,
            averagePerformance: 91, rating: 'Excellent', projectIds: projectIds(1001, 12),
          },
          {
            unitId: id(102), unitName: 'امور مالی', unitCode: 'FIN', level: 2,
            projectCount: 9, runningProjects: 6, completedProjects: 3, overdueProjects: 3,
            totalBudget: 6300000000, projectsWithProgress: 8,
            averagePlannedProgress: 74, averageActualProgress: 58, averageDeviation: -16,
            onTrack: 3, atRisk: 2, behind: 3, delayedProjects: 3,
            averagePerformance: 61, rating: 'NeedsImprovement', projectIds: projectIds(1101, 9),
          },
          {
            unitId: id(103), unitName: 'عملیات و پشتیبانی', unitCode: 'OPS', level: 2,
            projectCount: 15, runningProjects: 10, completedProjects: 5, overdueProjects: 4,
            totalBudget: 12500000000, projectsWithProgress: 13,
            averagePlannedProgress: 62, averageActualProgress: 60, averageDeviation: -2,
            onTrack: 8, atRisk: 3, behind: 2, delayedProjects: 4,
            averagePerformance: 78, rating: 'Good', projectIds: projectIds(1201, 15),
          },
          {
            unitId: id(104), unitName: 'برنامه‌ریزی راهبردی', unitCode: 'STR', level: 2,
            projectCount: 6, runningProjects: 4, completedProjects: 2, overdueProjects: 1,
            totalBudget: 4100000000, projectsWithProgress: 2,
            averagePlannedProgress: null, averageActualProgress: null, averageDeviation: null,
            onTrack: 0, atRisk: 0, behind: 0, delayedProjects: 1,
            averagePerformance: null, rating: null, projectIds: projectIds(1301, 6),
          },
        ],
      }

    case 'unit-status-matrix':
      return {
        level: 2,
        statuses: ['Draft', 'Active', 'OnHold', 'Completed', 'Archived'],
        rows: [
          { unitId: id(101), unitName: 'فناوری اطلاعات', unitCode: 'IT', counts: [2, 7, 1, 4, 0], total: 14 },
          { unitId: id(102), unitName: 'امور مالی', unitCode: 'FIN', counts: [1, 6, 2, 3, 0], total: 12 },
          { unitId: id(103), unitName: 'عملیات و پشتیبانی', unitCode: 'OPS', counts: [0, 4, 1, 2, 0], total: 7 },
          { unitId: id(104), unitName: 'برنامه‌ریزی راهبردی', unitCode: 'STR', counts: [0, 2, 1, 1, 1], total: 5 },
        ],
        columnTotals: [3, 19, 5, 10, 1],
        total: 38,
      }

    case 'project-managers':
      return {
        asOf: date,
        managers: [
          {
            managerUserId: id(201), projectCount: 6, runningProjects: 4, completedProjects: 2,
            overdueProjects: 0, totalBudget: 4200000000, projectsWithProgress: 5,
            averagePlannedProgress: 62, averageActualProgress: 67, averageDeviation: 5,
            onTrack: 4, atRisk: 1, behind: 0, onTrackShare: 80, openActions: 3,
            delayedProjects: 0, averagePerformance: 93, rating: 'Excellent', projectIds: projectIds(2001, 6),
          },
          {
            managerUserId: id(202), projectCount: 5, runningProjects: 3, completedProjects: 2,
            overdueProjects: 2, totalBudget: 7800000000, projectsWithProgress: 4,
            averagePlannedProgress: 77, averageActualProgress: 59, averageDeviation: -18,
            onTrack: 1, atRisk: 1, behind: 2, onTrackShare: 25, openActions: 8,
            delayedProjects: 2, averagePerformance: 57, rating: 'NeedsImprovement', projectIds: projectIds(2101, 5),
          },
          {
            managerUserId: id(203), projectCount: 8, runningProjects: 6, completedProjects: 2,
            overdueProjects: 1, totalBudget: 9100000000, projectsWithProgress: 7,
            averagePlannedProgress: 58, averageActualProgress: 61, averageDeviation: 3,
            onTrack: 5, atRisk: 1, behind: 1, onTrackShare: 71, openActions: 4,
            delayedProjects: 1, averagePerformance: 79, rating: 'Good', projectIds: projectIds(2201, 8),
          },
          {
            managerUserId: id(204), projectCount: 3, runningProjects: 2, completedProjects: 1,
            overdueProjects: 0, totalBudget: 1700000000, projectsWithProgress: 0,
            averagePlannedProgress: null, averageActualProgress: null, averageDeviation: null,
            onTrack: 0, atRisk: 0, behind: 0, onTrackShare: null, openActions: 1,
            delayedProjects: 0, averagePerformance: null, rating: null, projectIds: projectIds(2301, 3),
          },
        ],
      }

    case 'strategy-alignment':
      return {
        strategies: [
          {
            strategyId: id(301), name: 'تحول دیجیتال', parentStrategyId: null,
            depth: 1, weight: 3, directProjects: 4, projectsIncludingChildren: 6,
            highAlignedProjects: 3, averagePercentage: 78,
          },
          {
            strategyId: id(302), name: 'بهبود کیفیت خدمات', parentStrategyId: null,
            depth: 1, weight: 2, directProjects: 3, projectsIncludingChildren: 3,
            highAlignedProjects: 2, averagePercentage: 71,
          },
          {
            strategyId: id(303), name: 'توسعه سرمایه انسانی', parentStrategyId: null,
            depth: 1, weight: 1, directProjects: 1, projectsIncludingChildren: 1,
            highAlignedProjects: 0, averagePercentage: 42,
          },
        ],
        projects: [
          {
            projectId: id(310), name: 'سامانه خدمات غیرحضوری', code: 'PR-101',
            cells: [{ level: 'High', percentage: 92 }, { level: 'High', percentage: 85 }, { level: 'None', percentage: null }],
            alignedStrategies: 2, averagePercentage: 88.5, weightedPercentage: 89,
          },
          {
            projectId: id(311), name: 'نوسازی زیرساخت', code: 'PR-102',
            cells: [{ level: 'High', percentage: 88 }, { level: 'Medium', percentage: 65 }, { level: 'Low', percentage: 38 }],
            alignedStrategies: 3, averagePercentage: 63.7, weightedPercentage: 75,
          },
          {
            projectId: id(312), name: 'ارتقای امنیت اطلاعات', code: 'PR-103',
            cells: [{ level: 'High', percentage: 95 }, { level: 'None', percentage: null }, { level: 'None', percentage: null }],
            alignedStrategies: 1, averagePercentage: 95, weightedPercentage: 95,
          },
          {
            projectId: id(313), name: 'آموزش مدیران', code: 'PR-104',
            cells: [{ level: 'None', percentage: null }, { level: 'Medium', percentage: 58 }, { level: 'High', percentage: 87 }],
            alignedStrategies: 2, averagePercentage: 72.5, weightedPercentage: 69,
          },
          {
            projectId: id(314), name: 'بهینه‌سازی فرایندها', code: 'PR-105',
            cells: [{ level: 'Low', percentage: 33 }, { level: 'High', percentage: 91 }, { level: 'None', percentage: null }],
            alignedStrategies: 2, averagePercentage: 62, weightedPercentage: 56,
          },
        ],
        uncoveredStrategyIds: [],
        unalignedProjectIds: [id(315)],
      }

    case 'health':
      return {
        asOf: date,
        projectCount: 8,
        counts: [
          { name: 'Green', count: 3 },
          { name: 'Amber', count: 2 },
          { name: 'Red', count: 2 },
          { name: 'Unknown', count: 1 },
        ],
        projects: [
          { projectId: id(401), name: 'سامانه اتوماسیون', code: 'HE-01', status: 'Active', organizationUnitId: id(101), managerUserId: id(201), health: 'Green', plannedProgress: 72, actualProgress: 75, spi: 1.04, cpi: 1.02, forecastDelayDays: 0, isOverdue: false },
          { projectId: id(402), name: 'پرتال مشتریان', code: 'HE-02', status: 'Active', organizationUnitId: id(101), managerUserId: id(202), health: 'Amber', plannedProgress: 68, actualProgress: 55, spi: 0.81, cpi: 0.96, forecastDelayDays: 12, isOverdue: true },
          { projectId: id(403), name: 'یکپارچه‌سازی داده', code: 'HE-03', status: 'OnHold', organizationUnitId: id(103), managerUserId: id(203), health: 'Red', plannedProgress: 80, actualProgress: 43, spi: 0.54, cpi: 0.72, forecastDelayDays: 37, isOverdue: true },
          { projectId: id(404), name: 'ارتقای شبکه', code: 'HE-04', status: 'Active', organizationUnitId: id(101), managerUserId: id(201), health: 'Green', plannedProgress: 51, actualProgress: 54, spi: 1.06, cpi: 1.08, forecastDelayDays: 0, isOverdue: false },
          { projectId: id(405), name: 'سامانه مدیریت قرارداد', code: 'HE-05', status: 'Active', organizationUnitId: id(102), managerUserId: id(202), health: 'Red', plannedProgress: 75, actualProgress: 49, spi: 0.65, cpi: 0.83, forecastDelayDays: 24, isOverdue: true },
          { projectId: id(406), name: 'بهبود پشتیبانی', code: 'HE-06', status: 'Active', organizationUnitId: id(103), managerUserId: id(203), health: 'Amber', plannedProgress: 66, actualProgress: 62, spi: 0.94, cpi: 1.01, forecastDelayDays: 5, isOverdue: false },
          { projectId: id(407), name: 'داشبورد مدیران', code: 'HE-07', status: 'Completed', organizationUnitId: id(104), managerUserId: id(201), health: 'Green', plannedProgress: 100, actualProgress: 100, spi: 1, cpi: 1, forecastDelayDays: 0, isOverdue: false },
          { projectId: id(408), name: 'مطالعات اولیه', code: 'HE-08', status: 'Active', organizationUnitId: id(104), managerUserId: id(204), health: 'Unknown', plannedProgress: null, actualProgress: null, spi: null, cpi: null, forecastDelayDays: null, isOverdue: false },
        ],
      }

    case 'attention':
      return {
        asOf: date, total: 7, truncated: false, risksIncluded: true,
        countsByKind: [
          { name: 'ProjectOverdue', count: 2 },
          { name: 'ProjectRed', count: 1 },
          { name: 'ProjectAtRisk', count: 1 },
          { name: 'RiskWithoutResponsePlan', count: 1 },
          { name: 'ActionOverdue', count: 2 },
        ],
        items: [
          { kind: 'ProjectOverdue', severity: 'High', subjectType: 'Project', subjectId: id(501), projectId: id(401), projectName: 'پرتال مشتریان', title: 'تأخیر در تکمیل فاز دوم', dueDate: '2026-10-05', daysLate: 14, ownerUserId: id(202) },
          { kind: 'ProjectOverdue', severity: 'High', subjectType: 'Project', subjectId: id(502), projectId: id(402), projectName: 'سامانه قراردادها', title: 'عبور از تاریخ پایان برنامه', dueDate: '2026-10-10', daysLate: 9, ownerUserId: id(203) },
          { kind: 'ProjectRed', severity: 'High', subjectType: 'Project', subjectId: id(503), projectId: id(403), projectName: 'یکپارچه‌سازی داده', title: 'وضعیت سلامت بحرانی', dueDate: date, daysLate: null, ownerUserId: id(203) },
          { kind: 'ProjectAtRisk', severity: 'Medium', subjectType: 'Project', subjectId: id(504), projectId: id(404), projectName: 'بهبود پشتیبانی', title: 'احتمال انحراف از برنامه', dueDate: date, daysLate: null, ownerUserId: id(201) },
          { kind: 'RiskWithoutResponsePlan', severity: 'High', subjectType: 'Risk', subjectId: id(505), projectId: id(405), projectName: 'سامانه قراردادها', title: 'ریسک امنیت اطلاعات بدون برنامه پاسخ', dueDate: '2026-10-15', daysLate: 4, ownerUserId: id(202) },
          { kind: 'ActionOverdue', severity: 'Medium', subjectType: 'Action', subjectId: id(506), projectId: id(406), projectName: 'بهبود پشتیبانی', title: 'بازبینی مستندات فنی', dueDate: '2026-10-12', daysLate: 7, ownerUserId: id(204) },
          { kind: 'ActionOverdue', severity: 'Medium', subjectType: 'Action', subjectId: id(507), projectId: id(407), projectName: 'داشبورد مدیران', title: 'تکمیل گزارش جلسه', dueDate: '2026-10-14', daysLate: 5, ownerUserId: id(201) },
        ],
      }

    case 'risks':
      return {
        asOf: date, total: 18, high: 5, medium: 8, low: 5,
        openHigh: 3, openHighWithoutResponsePlan: 1,
        byResponseStatus: [
          { name: 'Planning', count: 4 },
          { name: 'InProgress', count: 5 },
          { name: 'OnHold', count: 2 },
          { name: 'Completed', count: 7 },
        ],
        projects: [
          { projectId: id(601), name: 'سامانه قراردادها', code: 'RK-01', total: 5, high: 2, medium: 2, low: 1, openHigh: 2 },
          { projectId: id(602), name: 'پرتال مشتریان', code: 'RK-02', total: 4, high: 1, medium: 2, low: 1, openHigh: 1 },
          { projectId: id(603), name: 'شبکه سازمانی', code: 'RK-03', total: 3, high: 1, medium: 1, low: 1, openHigh: 0 },
          { projectId: id(604), name: 'مدیریت منابع', code: 'RK-04', total: 3, high: 1, medium: 1, low: 1, openHigh: 0 },
          { projectId: id(605), name: 'آموزش سازمانی', code: 'RK-05', total: 3, high: 0, medium: 2, low: 1, openHigh: 0 },
        ],
        topRisks: [
          { riskId: id(611), projectId: id(601), projectName: 'سامانه قراردادها', description: 'افشای اطلاعات حساس', probabilityScore: 4, impactScore: 5, rpn: 20, level: 'High', responseStatus: 'Planning', riskOwnerUserId: id(202), hasResponsePlan: false },
          { riskId: id(612), projectId: id(602), projectName: 'پرتال مشتریان', description: 'تأخیر سرویس بر اثر بار زیاد', probabilityScore: 4, impactScore: 4, rpn: 16, level: 'High', responseStatus: 'InProgress', riskOwnerUserId: id(203), hasResponsePlan: true },
          { riskId: id(613), projectId: id(601), projectName: 'سامانه قراردادها', description: 'وابستگی به سامانه بیرونی', probabilityScore: 3, impactScore: 5, rpn: 15, level: 'High', responseStatus: 'Planning', riskOwnerUserId: id(202), hasResponsePlan: true },
          { riskId: id(614), projectId: id(603), projectName: 'شبکه سازمانی', description: 'کمبود نیروی متخصص', probabilityScore: 3, impactScore: 3, rpn: 9, level: 'Medium', responseStatus: 'Completed', riskOwnerUserId: id(201), hasResponsePlan: true },
        ],
      }

    case 'kpis':
      return {
        asOf: date, kpiCount: 6, withValues: 5, withoutValues: 1,
        excellent: 2, good: 2, needsImprovement: 1, averageAchievement: 83.6,
        kpis: [
          { kpiId: id(701), projectId: id(401), projectName: 'سامانه اتوماسیون', projectCode: 'KP-01', deliverableId: id(801), type: 'Quantity', description: 'درصد تکمیل فرایندها', formula: 'تکمیل‌شده / کل × ۱۰۰', targetValue: 90, latestValue: 96, latestMeasuredOn: date, measurementCount: 5, achievementPercent: 100, rating: 'Excellent', trend: [{ measuredOn: '2026-08-01', value: 72 }, { measuredOn: '2026-09-01', value: 84 }, { measuredOn: date, value: 96 }] },
          { kpiId: id(702), projectId: id(402), projectName: 'پرتال مشتریان', projectCode: 'KP-02', deliverableId: id(802), type: 'Quality', description: 'رضایت کاربران', formula: 'میانگین امتیاز نظرسنجی', targetValue: 85, latestValue: 88, latestMeasuredOn: date, measurementCount: 4, achievementPercent: 100, rating: 'Excellent', trend: [{ measuredOn: '2026-08-01', value: 75 }, { measuredOn: '2026-09-01', value: 82 }, { measuredOn: date, value: 88 }] },
          { kpiId: id(703), projectId: id(403), projectName: 'یکپارچه‌سازی داده', projectCode: 'KP-03', deliverableId: id(803), type: 'Quantity', description: 'پوشش سامانه‌های متصل', formula: 'اتصال موفق / برنامه', targetValue: 80, latestValue: 65, latestMeasuredOn: date, measurementCount: 3, achievementPercent: 81.3, rating: 'Good', trend: [{ measuredOn: '2026-08-01', value: 52 }, { measuredOn: '2026-09-01', value: 60 }, { measuredOn: date, value: 65 }] },
          { kpiId: id(704), projectId: id(404), projectName: 'بهبود پشتیبانی', projectCode: 'KP-04', deliverableId: id(804), type: 'Quality', description: 'پاسخ‌گویی در SLA', formula: 'پاسخ در زمان / کل × ۱۰۰', targetValue: 95, latestValue: 86, latestMeasuredOn: date, measurementCount: 4, achievementPercent: 90.5, rating: 'Good', trend: [{ measuredOn: '2026-08-01', value: 79 }, { measuredOn: '2026-09-01', value: 82 }, { measuredOn: date, value: 86 }] },
          { kpiId: id(705), projectId: id(405), projectName: 'سامانه قراردادها', projectCode: 'KP-05', deliverableId: id(805), type: 'Quantity', description: 'کاهش خطاهای ثبت', formula: 'کاهش نسبت به دوره قبل', targetValue: 50, latestValue: 24, latestMeasuredOn: date, measurementCount: 2, achievementPercent: 48, rating: 'NeedsImprovement', trend: [{ measuredOn: '2026-09-01', value: 18 }, { measuredOn: date, value: 24 }] },
          { kpiId: id(706), projectId: id(406), projectName: 'پایش عملیات', projectCode: 'KP-06', deliverableId: id(806), type: 'Quality', description: 'پایداری سرویس', formula: null, targetValue: null, latestValue: null, latestMeasuredOn: null, measurementCount: 0, achievementPercent: null, rating: null, trend: [] },
        ],
      }

    default:
      return {}
  }
}

function reportingXYFields(report, items, payload) {
  const direct = (key, label) => ({
    key,
    label,
    getValue: (item) => item.source?.[key],
  })

  let fields = []

  switch (report) {
    case 'unit-performance':
      fields = [
        direct('projectCount', 'تعداد پروژه‌ها'),
        direct('runningProjects', 'پروژه‌های در جریان'),
        direct('completedProjects', 'پروژه‌های تکمیل‌شده'),
        direct('overdueProjects', 'پروژه‌های عقب‌افتاده'),
        direct('totalBudget', 'بودجه کل'),
        direct('averagePlannedProgress', 'میانگین پیشرفت برنامه‌ای (%)'),
        direct('averageActualProgress', 'میانگین پیشرفت واقعی (%)'),
        direct('averageDeviation', 'میانگین انحراف'),
        direct('onTrack', 'طبق برنامه'),
        direct('atRisk', 'در معرض ریسک'),
        direct('behind', 'عقب‌افتاده'),
        direct('averagePerformance', 'میانگین عملکرد (%)'),
        direct('delayedProjects', 'پروژه‌های تأخیردار'),
      ]
      break

    case 'unit-status-matrix':
      fields = [
        direct('total', 'مجموع پروژه‌ها'),
        ...reportingList(payload?.statuses).map((status, index) => ({
          key: `status-${index}`,
          label: `تعداد ${reportingValueLabel(status)}`,
          getValue: (item) => item.source?.counts?.[index],
        })),
      ]
      break

    case 'project-managers':
      fields = [
        direct('projectCount', 'تعداد پروژه‌ها'),
        direct('runningProjects', 'پروژه‌های در جریان'),
        direct('completedProjects', 'پروژه‌های تکمیل‌شده'),
        direct('overdueProjects', 'پروژه‌های عقب‌افتاده'),
        direct('totalBudget', 'بودجه کل'),
        direct('averagePlannedProgress', 'میانگین پیشرفت برنامه‌ای (%)'),
        direct('averageActualProgress', 'میانگین پیشرفت واقعی (%)'),
        direct('averageDeviation', 'میانگین انحراف'),
        direct('onTrack', 'طبق برنامه'),
        direct('atRisk', 'در معرض ریسک'),
        direct('behind', 'عقب‌افتاده'),
        direct('onTrackShare', 'سهم طبق برنامه (%)'),
        direct('openActions', 'اقدام‌های باز'),
        direct('averagePerformance', 'میانگین عملکرد (%)'),
      ]
      break

    case 'strategy-alignment':
      fields = [
        direct('alignedStrategies', 'تعداد راهبردهای هم‌راستا'),
        direct('averagePercentage', 'میانگین هم‌راستایی (%)'),
        direct('weightedPercentage', 'هم‌راستایی وزنی (%)'),
        ...reportingList(payload?.strategies).map((strategy, index) => ({
          key: `strategy-${index}`,
          label: `درصد هم‌راستایی · ${strategy.name}`,
          getValue: (item) => item.source?.cells?.[index]?.percentage,
        })),
      ]
      break

    case 'health':
      fields = [
        direct('plannedProgress', 'پیشرفت برنامه‌ای (%)'),
        direct('actualProgress', 'پیشرفت واقعی (%)'),
        direct('spi', 'شاخص عملکرد زمان (SPI)'),
        direct('cpi', 'شاخص عملکرد هزینه (CPI)'),
        direct('forecastDelayDays', 'تأخیر پیش‌بینی‌شده (روز)'),
      ]
      break

    case 'attention':
      fields = [
        direct('daysLate', 'تعداد روزهای تأخیر'),
        {
          key: 'severityScore',
          label: 'شدت عددی (زیاد=3، متوسط=2)',
          getValue: (item) => {
            if (item.source?.severity === 'High') return 3
            if (item.source?.severity === 'Medium') return 2
            return null
          },
        },
      ]
      break

    case 'risks':
      fields = [
        direct('total', 'مجموع ریسک‌ها'),
        direct('high', 'ریسک‌های زیاد'),
        direct('medium', 'ریسک‌های متوسط'),
        direct('low', 'ریسک‌های کم'),
        direct('openHigh', 'ریسک‌های زیادِ باز'),
      ]
      break

    case 'kpis':
      fields = [
        direct('targetValue', 'مقدار هدف'),
        direct('latestValue', 'آخرین مقدار ثبت‌شده'),
        direct('measurementCount', 'تعداد اندازه‌گیری‌ها'),
        direct('achievementPercent', 'درصد تحقق هدف'),
      ]
      break

    default:
      fields = []
  }

  return fields.filter((field) =>
    reportingList(items).some((item) => {
      const value = field.getValue(item)
      return typeof value === 'number' && Number.isFinite(value)
    })
  )
}

function ReportingXYChart({ title, points, xLabel, yLabel, zoom, setZoom }) {
  const width = 820
  const height = 460
  const left = 85
  const top = 30
  const plotWidth = 680
  const plotHeight = 325

  const validPoints = reportingList(points).filter(
    (point) =>
      typeof point.x === 'number' &&
      Number.isFinite(point.x) &&
      typeof point.y === 'number' &&
      Number.isFinite(point.y)
  )

  const valuesX = validPoints.map((point) => point.x)
  const valuesY = validPoints.map((point) => point.y)

  const rawMinX = valuesX.length ? Math.min(...valuesX) : 0
  const rawMaxX = valuesX.length ? Math.max(...valuesX) : 1
  const rawMinY = valuesY.length ? Math.min(...valuesY) : 0
  const rawMaxY = valuesY.length ? Math.max(...valuesY) : 1

  const rangeX = rawMaxX - rawMinX || Math.max(Math.abs(rawMinX) * 0.1, 1)
  const rangeY = rawMaxY - rawMinY || Math.max(Math.abs(rawMinY) * 0.1, 1)

  const minX = rawMinX - rangeX * 0.08
  const maxX = rawMaxX + rangeX * 0.08
  const minY = rawMinY - rangeY * 0.08
  const maxY = rawMaxY + rangeY * 0.08

  const pointX = (value) => left + ((value - minX) / (maxX - minX)) * plotWidth
  const pointY = (value) => top + plotHeight - ((value - minY) / (maxY - minY)) * plotHeight

  const tickValues = Array.from({ length: 5 }, (_, index) => ({
    x: minX + ((maxX - minX) * index) / 4,
    y: maxY - ((maxY - minY) * index) / 4,
    index,
  }))

  return (
    <div className="reporting-xy-content">
      <div className="reporting-xy-toolbar">
        <div>
          <strong>{title}</strong>
          <span>{validPoints.length.toLocaleString('fa-IR')} نقطه معتبر</span>
        </div>

        <div className="reporting-pie-zoom-controls">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.2).toFixed(1))))}
            disabled={zoom <= 0.7}
            aria-label="کوچک‌نمایی نمودار X/Y"
          >
            −
          </button>
          <span>{Math.round(zoom * 100)}٪</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(2, Number((value + 0.2).toFixed(1))))}
            disabled={zoom >= 2}
            aria-label="بزرگ‌نمایی نمودار X/Y"
          >
            +
          </button>
          <button type="button" onClick={() => setZoom(1)}>اندازه عادی</button>
        </div>
      </div>

      {!validPoints.length ? (
        <div className="reporting-empty-state">
          برای محورهای انتخاب‌شده، دو مقدار عددی معتبر و هم‌زمان در دسترس نیست.
        </div>
      ) : (
        <div className="reporting-xy-stage">
          <svg
            className="reporting-xy-svg"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={title}
            style={{ transform: `scale(${zoom})` }}
          >
            <title>{title}</title>

            {tickValues.map((tick) => {
              const y = top + (plotHeight * tick.index) / 4
              const x = left + (plotWidth * tick.index) / 4

              return (
                <g key={`tick-${tick.index}`}>
                  <line
                    x1={left}
                    y1={y}
                    x2={left + plotWidth}
                    y2={y}
                    stroke="#e5eaf1"
                    strokeWidth="1"
                  />
                  <text
                    x={left - 12}
                    y={y + 4}
                    textAnchor="end"
                    className="reporting-xy-tick"
                  >
                    {reportingFormatValue(Number(tick.y.toFixed(2)))}
                  </text>
                  <line
                    x1={x}
                    y1={top}
                    x2={x}
                    y2={top + plotHeight}
                    stroke="#eef1f5"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={top + plotHeight + 23}
                    textAnchor="middle"
                    className="reporting-xy-tick"
                  >
                    {reportingFormatValue(Number(tick.x.toFixed(2)))}
                  </text>
                </g>
              )
            })}

            <line
              x1={left}
              y1={top + plotHeight}
              x2={left + plotWidth}
              y2={top + plotHeight}
              stroke="#98a2b3"
              strokeWidth="1.5"
            />
            <line
              x1={left}
              y1={top}
              x2={left}
              y2={top + plotHeight}
              stroke="#98a2b3"
              strokeWidth="1.5"
            />

            {validPoints.map((point, index) => (
              <circle
                key={`${point.id}-${index}`}
                cx={pointX(point.x)}
                cy={pointY(point.y)}
                r="6"
                fill={REPORTING_CHART_COLORS[index % REPORTING_CHART_COLORS.length]}
                stroke="#ffffff"
                strokeWidth="1.5"
              >
                <title>
                  {`${point.label}: ${xLabel}=${reportingFormatValue(point.x)}؛ ${yLabel}=${reportingFormatValue(point.y)}`}
                </title>
              </circle>
            ))}

            <text
              x={left + plotWidth / 2}
              y={height - 20}
              textAnchor="middle"
              className="reporting-xy-axis-label"
            >
              {xLabel}
            </text>

            <text
              x="20"
              y={top + plotHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90 20 ${top + plotHeight / 2})`}
              className="reporting-xy-axis-label"
            >
              {yLabel}
            </text>
          </svg>
        </div>
      )}
    </div>
  )
}

function ReportingExportPage() {
  const [report, setReport] = useState('health')
  const [level, setLevel] = useState('2')
  const [asOf, setAsOf] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [chartExpanded, setChartExpanded] = useState(false)
  const [chartZoom, setChartZoom] = useState(1)
  const [xField, setXField] = useState('')
  const [yField, setYField] = useState('')
  const [xyZoom, setXyZoom] = useState(1)

  const selectedReport = REPORTING_EXPORT_OPTIONS.find((item) => item.key === report)
  const isUnitReport = report === 'unit-performance' || report === 'unit-status-matrix'
  const supportsAsOf = !['unit-status-matrix', 'strategy-alignment'].includes(report)
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === '1'

  useEffect(() => {
    let active = true

    if (isDemoMode) {
      setLoading(false)
      setError('')
      setPayload(createFakeReportingPayload(report, asOf))
      setMessage('حالت نمایشی فعال است؛ داده‌ها ساختگی‌اند و از API یا پایگاه‌داده دریافت نمی‌شوند.')
      return () => {
        active = false
      }
    }

    const loadReport = async () => {
      setLoading(true)
      setError('')
      setMessage('')
      setPayload(null)

      try {
        let result

        switch (report) {
          case 'unit-performance':
            result = await reportingApi.unitPerformance({
              level: Number(level),
              asOf: asOf || undefined,
            })
            break

          case 'unit-status-matrix':
            result = await reportingApi.unitStatusMatrix(Number(level))
            break

          case 'project-managers':
            result = await reportingApi.projectManagers({ asOf: asOf || undefined })
            break

          case 'strategy-alignment':
            result = await reportingApi.strategyAlignmentMatrix()
            break

          case 'health':
            result = await reportingApi.healthBoard({ asOf: asOf || undefined })
            break

          case 'attention':
            result = await reportingApi.attentionBoard({ asOf: asOf || undefined })
            break

          case 'risks':
            result = await reportingApi.riskOverview({ asOf: asOf || undefined })
            break

          case 'kpis':
            result = await reportingApi.kpiOverview({ asOf: asOf || undefined })
            break

          default:
            throw new Error('نوع گزارش انتخاب‌شده پشتیبانی نمی‌شود.')
        }

        if (!result?.isSuccess) {
          throw new Error(reportingRequestError(result))
        }

        let value = result.value

        // Accommodate endpoints that may return a nested Result<T>.
        if (
          value &&
          typeof value === 'object' &&
          'isSuccess' in value &&
          'value' in value
        ) {
          if (!value.isSuccess) {
            throw new Error(reportingRequestError(value))
          }
          value = value.value
        }

        if (!value || typeof value !== 'object') {
          throw new Error('پاسخ API ساختار مورد انتظار گزارش را ندارد.')
        }

        if (active) setPayload(value)
      } catch (err) {
        if (active) {
          setPayload(null)
          setError(err?.message || 'دریافت داده‌های گزارش با خطا مواجه شد.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReport()

    return () => {
      active = false
    }
  }, [report, level, asOf, reloadKey, isDemoMode])

  const view = useMemo(
    () => buildReportingView(report, payload),
    [report, payload],
  )

  const categories = useMemo(
    () => [...new Set(view.items.map((item) => item.category).filter(Boolean))],
    [view.items],
  )

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()

    return view.items.filter((item) => {
      const matchesSearch = !normalizedSearch || item.searchText.includes(normalizedSearch)
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [view.items, search, categoryFilter])

  const chartSlices = useMemo(
    () => reportingChartSlices(report, filteredItems, payload),
    [report, filteredItems, payload],
  )

  const xyFields = useMemo(
    () => reportingXYFields(report, view.items, payload),
    [report, view.items, payload],
  )

  useEffect(() => {
    if (!xyFields.length) {
      if (xField) setXField('')
      if (yField) setYField('')
      return
    }

    const nextX = xyFields.some((field) => field.key === xField)
      ? xField
      : xyFields[0].key

    const nextY = xyFields.some((field) => field.key === yField)
      ? yField
      : (xyFields.find((field) => field.key !== nextX)?.key || nextX)

    if (nextX !== xField) setXField(nextX)
    if (nextY !== yField) setYField(nextY)
  }, [xyFields, xField, yField])

  const xyPoints = useMemo(() => {
    const xDefinition = xyFields.find((field) => field.key === xField)
    const yDefinition = xyFields.find((field) => field.key === yField)

    if (!xDefinition || !yDefinition) return []

    return filteredItems
      .map((item) => ({
        id: item.id,
        label: item.title,
        category: item.category,
        x: xDefinition.getValue(item),
        y: yDefinition.getValue(item),
      }))
      .filter(
        (point) =>
          typeof point.x === 'number' &&
          Number.isFinite(point.x) &&
          typeof point.y === 'number' &&
          Number.isFinite(point.y)
      )
  }, [filteredItems, xyFields, xField, yField])
  const requestOptions = () => ({
    level: Number(level),
    asOf: asOf || undefined,
  })

  const downloadExcel = async () => {
    setError('')
    setMessage('')
    setBusy('xlsx')

    try {
      const result = await reportingApi.exportFile(report, {
        ...requestOptions(),
        format: 'xlsx',
      })

      if (!result?.isSuccess) {
        setError(reportingRequestError(result))
        return
      }

      if (!(result.value instanceof Blob)) {
        setError('پاسخ سرور فایل Excel معتبری نبود.')
        return
      }

      const url = URL.createObjectURL(result.value)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${report}${asOf ? `-${asOf}` : ''}.xlsx`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)

      setMessage('دریافت فایل Excel آغاز شد.')
    } catch (err) {
      setError(err?.message || 'هنگام دریافت فایل Excel خطایی رخ داد.')
    } finally {
      setBusy('')
    }
  }

  const openPrintableReport = () => {
    setError('')
    setMessage('')

    // Must open synchronously from this click to avoid popup blocking.
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('مرورگر پنجره جدید را مسدود کرد. اجازه بازشدن پنجره جدید را فعال کنید.')
      return
    }

    setBusy('html')

    try {
      const escapeHtml = (value) =>
        String(value ?? '—')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')

      const safeText = (value) => escapeHtml(reportingFormatValue(value))
      const pieTotal = chartSlices.reduce((sum, slice) => sum + Number(slice.count || 0), 0)

      const metricsHtml = view.metrics.map((metric) => `
        <article class="metric">
          <span>${escapeHtml(metric.label)}</span>
          <strong>${safeText(metric.value)}</strong>
        </article>
      `).join('')

      let pieAngle = 0
      const positiveSlices = chartSlices.filter((slice) => Number(slice.count || 0) > 0)

      const piePaths = positiveSlices.map((slice, index) => {
        const start = pieAngle
        pieAngle += Number(slice.count || 0) / (pieTotal || 1) * Math.PI * 2
        const end = pieAngle
        return `<path d="${reportingDonutPath(start, end)}" fill="${REPORTING_CHART_COLORS[index % REPORTING_CHART_COLORS.length]}"><title>${escapeHtml(reportingValueLabel(slice.label))}: ${safeText(slice.count)}</title></path>`
      }).join('')

      const singlePie = positiveSlices.length === 1
        ? `<circle cx="160" cy="160" r="112" fill="${REPORTING_CHART_COLORS[0]}"/>`
        : piePaths

      const pieHtml = pieTotal > 0
        ? `
          <svg class="pie-svg" viewBox="0 0 320 320" role="img" aria-label="${escapeHtml(view.chartTitle)}">
            ${singlePie}
            <circle cx="160" cy="160" r="64" fill="#fff"/>
            <text x="160" y="153" text-anchor="middle" class="pie-total">${safeText(pieTotal)}</text>
            <text x="160" y="180" text-anchor="middle" class="pie-center-label">تعداد</text>
          </svg>
        `
        : '<p>داده‌ای برای رسم نمودار وجود ندارد.</p>'

      const pieLegendHtml = positiveSlices.map((slice, index) => {
        const percentage = pieTotal > 0 ? Number(slice.count) / pieTotal * 100 : 0
        return `
          <tr>
            <td><span class="swatch" style="background:${REPORTING_CHART_COLORS[index % REPORTING_CHART_COLORS.length]}"></span>${escapeHtml(reportingValueLabel(slice.label))}</td>
            <td>${safeText(slice.count)}</td>
            <td>${safeText(Number(percentage.toFixed(1)))}٪</td>
          </tr>
        `
      }).join('')

      const xLabel = xyFields.find((field) => field.key === xField)?.label || 'X'
      const yLabel = xyFields.find((field) => field.key === yField)?.label || 'Y'

      const validPoints = xyPoints.filter(
        (point) =>
          typeof point.x === 'number' && Number.isFinite(point.x) &&
          typeof point.y === 'number' && Number.isFinite(point.y)
      )

      const plot = { left: 85, top: 25, width: 680, height: 325 }
      const xs = validPoints.map((point) => point.x)
      const ys = validPoints.map((point) => point.y)
      const rawMinX = xs.length ? Math.min(...xs) : 0
      const rawMaxX = xs.length ? Math.max(...xs) : 1
      const rawMinY = ys.length ? Math.min(...ys) : 0
      const rawMaxY = ys.length ? Math.max(...ys) : 1
      const rangeX = rawMaxX - rawMinX || Math.max(Math.abs(rawMinX) * 0.1, 1)
      const rangeY = rawMaxY - rawMinY || Math.max(Math.abs(rawMinY) * 0.1, 1)
      const minX = rawMinX - rangeX * 0.08
      const maxX = rawMaxX + rangeX * 0.08
      const minY = rawMinY - rangeY * 0.08
      const maxY = rawMaxY + rangeY * 0.08

      const px = (value) => plot.left + ((value - minX) / (maxX - minX)) * plot.width
      const py = (value) => plot.top + plot.height - ((value - minY) / (maxY - minY)) * plot.height

      const gridX = []
      const gridY = []

      for (let i = 0; i < 5; i += 1) {
        const x = plot.left + plot.width * i / 4
        const y = plot.top + plot.height * i / 4
        const xValue = minX + (maxX - minX) * i / 4
        const yValue = maxY - (maxY - minY) * i / 4

        gridX.push(`
          <line x1="${x}" y1="${plot.top}" x2="${x}" y2="${plot.top + plot.height}" stroke="#eef1f5"/>
          <text x="${x}" y="${plot.top + plot.height + 22}" text-anchor="middle" class="tick">${safeText(Number(xValue.toFixed(2)))}</text>
        `)

        gridY.push(`
          <line x1="${plot.left}" y1="${y}" x2="${plot.left + plot.width}" y2="${y}" stroke="#e5eaf1"/>
          <text x="${plot.left - 10}" y="${y + 4}" text-anchor="end" class="tick">${safeText(Number(yValue.toFixed(2)))}</text>
        `)
      }

      const xyDots = validPoints.map((point, index) => `
        <circle
          cx="${px(point.x)}"
          cy="${py(point.y)}"
          r="5"
          fill="${REPORTING_CHART_COLORS[index % REPORTING_CHART_COLORS.length]}"
          stroke="#fff"
          stroke-width="1.5"
        >
          <title>${escapeHtml(point.label)}: ${escapeHtml(xLabel)}=${safeText(point.x)}؛ ${escapeHtml(yLabel)}=${safeText(point.y)}</title>
        </circle>
      `).join('')

      const xyHtml = validPoints.length
        ? `
          <svg class="xy-svg" viewBox="0 0 820 430" role="img" aria-label="نمودار X/Y">
            ${gridX.join('')}
            ${gridY.join('')}
            <line x1="${plot.left}" y1="${plot.top + plot.height}" x2="${plot.left + plot.width}" y2="${plot.top + plot.height}" stroke="#98a2b3" stroke-width="1.5"/>
            <line x1="${plot.left}" y1="${plot.top}" x2="${plot.left}" y2="${plot.top + plot.height}" stroke="#98a2b3" stroke-width="1.5"/>
            ${xyDots}
            <text x="${plot.left + plot.width / 2}" y="415" text-anchor="middle" class="axis-label">${escapeHtml(xLabel)}</text>
            <text x="18" y="${plot.top + plot.height / 2}" text-anchor="middle" transform="rotate(-90 18 ${plot.top + plot.height / 2})" class="axis-label">${escapeHtml(yLabel)}</text>
          </svg>
        `
        : '<p>برای محورهای انتخاب‌شده، داده عددی کافی برای رسم نمودار وجود ندارد.</p>'

      const xyTableHtml = validPoints.map((point) => `
        <tr>
          <td>${escapeHtml(point.label)}</td>
          <td>${safeText(point.x)}</td>
          <td>${safeText(point.y)}</td>
        </tr>
      `).join('')

      const recordsHtml = filteredItems.map((item) => `
        <article class="record">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="subtitle">${escapeHtml(item.subtitle || '')} · ${escapeHtml(reportingValueLabel(item.category))}</p>
          <table class="details-table">
            <tbody>
              ${item.details.map((detail) => `
                <tr>
                  <th>${escapeHtml(detail.label)}</th>
                  <td>${safeText(detail.value)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </article>
      `).join('')

      const filterSummary = [
        `تاریخ مبنا: ${supportsAsOf && asOf ? reportingFormatValue(asOf) : '—'}`,
        isUnitReport ? `سطح سازمانی: ${level}` : '',
        `جست‌وجو: ${search || 'بدون جست‌وجو'}`,
        `گروه: ${categoryFilter === 'all' ? 'همه گروه‌ها' : reportingValueLabel(categoryFilter)}`,
        `تعداد رکورد: ${filteredItems.length}`,
      ].filter(Boolean).map(escapeHtml).join(' · ')

      const printableHtml = `
        <!doctype html>
        <html lang="fa" dir="rtl">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>${escapeHtml(selectedReport?.label || 'گزارش')}</title>
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">
            <style>
              * { box-sizing: border-box; }
              body { margin: 0; padding: 20px; color: #172033; font: 13px/1.8 Tahoma, Arial, sans-serif; background: #fff; }
              h1 { font-size: 22px; margin: 0 0 6px; }
              h2 { font-size: 17px; margin: 18px 0 10px; }
              h3 { font-size: 15px; margin: 0 0 4px; }
              p { margin: 4px 0 12px; }
              .muted, .subtitle { color: #667085; }
              .toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; border-bottom:2px solid #dce3ec; padding-bottom:12px; }
              #print-action { border:1px solid #94a3b8; border-radius:8px; background:#f8fafc; padding:9px 14px; color:#172033; font:inherit; cursor:pointer; }
              .filter-summary { margin:12px 0; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; }
              .metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
              .metric { padding:10px; border:1px solid #e0e5ed; border-radius:8px; min-width:0; }
              .metric span { display:block; color:#667085; font-size:11px; }
              .metric strong { display:block; margin-top:4px; font-size:15px; overflow-wrap:anywhere; }
              .charts { display:grid; grid-template-columns:minmax(0,0.8fr) minmax(0,1.2fr); gap:16px; align-items:start; }
              .chart-box { border:1px solid #e0e5ed; border-radius:10px; padding:10px; min-width:0; page-break-inside:avoid; }
              .pie-svg { display:block; width:min(100%,300px); margin:0 auto; }
              .xy-svg { width:100%; height:auto; display:block; }
              .pie-total { fill:#172033; font-size:29px; font-weight:700; }
              .pie-center-label, .tick { fill:#667085; font-size:11px; }
              .axis-label { fill:#344054; font-size:12px; }
              .swatch { display:inline-block; width:9px; height:9px; border-radius:2px; margin-left:6px; }
              table { width:100%; border-collapse:collapse; }
              th, td { border:1px solid #e0e5ed; text-align:right; padding:6px 8px; vertical-align:top; overflow-wrap:anywhere; }
              th { background:#f8fafc; font-weight:600; }
              .record { border:1px solid #dce3ec; border-radius:9px; padding:10px; margin:10px 0; break-inside:avoid-page; page-break-inside:avoid; }
              .details-table th { width:28%; }
              .chart-data-table { margin-top:8px; font-size:11px; }
              @page { size:A4 landscape; margin:10mm; }
              @media print {
                body { padding:0; }
                .no-print { display:none !important; }
                .metric, .chart-box { break-inside:avoid; }
                .record { page-break-inside:avoid; }
              }
              @media screen and (max-width:760px) {
                .toolbar { align-items:flex-start; flex-direction:column; }
                .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
                .charts { grid-template-columns:minmax(0,1fr); }
              }
            </style>
          </head>
          <body>
            <header class="toolbar">
              <div>
                <h1>${escapeHtml(selectedReport?.label || 'گزارش')}</h1>
                <p class="muted">${escapeHtml(selectedReport?.description || '')}</p>
              </div>
              <button type="button" id="print-action" class="no-print">چاپ / ذخیره به صورت PDF</button>
            </header>

            <div class="filter-summary">${filterSummary}</div>

            <section>
              <h2>خلاصه گزارش</h2>
              <div class="metrics">${metricsHtml || '<p>خلاصه‌ای در دسترس نیست.</p>'}</div>
            </section>

            <section>
              <h2>نمودارها</h2>
              <div class="charts">
                <div class="chart-box">
                  <h3>${escapeHtml(view.chartTitle)}</h3>
                  ${pieHtml}
                  <table class="chart-data-table">
                    <thead><tr><th>گروه</th><th>تعداد</th><th>درصد</th></tr></thead>
                    <tbody>${pieLegendHtml}</tbody>
                  </table>
                </div>
                <div class="chart-box">
                  <h3>نمودار X/Y</h3>
                  <p class="muted">محور X: ${escapeHtml(xLabel)} · محور Y: ${escapeHtml(yLabel)}</p>
                  ${xyHtml}
                  <table class="chart-data-table">
                    <thead><tr><th>رکورد</th><th>X</th><th>Y</th></tr></thead>
                    <tbody>${xyTableHtml}</tbody>
                  </table>
                </div>
              </div>
            </section>

            <section>
              <h2>فهرست جزئیات (${filteredItems.length})</h2>
              ${recordsHtml || '<p>رکوردی برای نمایش وجود ندارد.</p>'}
            </section>
          </body>
        </html>
      `

      printWindow.document.open()
      printWindow.document.write(printableHtml)
      printWindow.document.close()

      const printButton = printWindow.document.getElementById('print-action')
      if (printButton) {
        printButton.addEventListener('click', (event) => {
          event.preventDefault()

          try {
            printWindow.focus()
            printWindow.print()
          } catch {
            setError('\u0686\u0627\u067e \u0627\u062c\u0631\u0627 \u0646\u0634\u062f. \u062f\u0631 \u0647\u0645\u0627\u0646 \u062a\u0628 \u0627\u0632 Ctrl+P \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u06a9\u0646\u06cc\u062f.')
          }
        })
      }
      printWindow.opener = null
      setMessage('نسخه چاپی شامل نمودارها و جزئیات تمام رکوردهای فیلترشده باز شد. برای چاپ از دکمه داخل تب یا Ctrl+P استفاده کنید.')
    } catch (err) {
      if (!printWindow.closed) printWindow.close()
      setError(err?.message || 'هنگام آماده‌سازی گزارش چاپی خطایی رخ داد.')
    } finally {
      setBusy('')
    }
  }
  const clearLocalFilters = () => {
    setSearch('')
    setCategoryFilter('all')
  }

  const renderChart = (expanded = false) => (
    <ReportingPieChart
      title={view.chartTitle}
      slices={chartSlices}
      zoom={chartZoom}
      setZoom={setChartZoom}
      onExpand={expanded ? null : () => setChartExpanded(true)}
    />
  )

  return (
    <section className="reporting-dashboard-page" dir="rtl">
      <header className="reporting-dashboard-header">
        <div>
          <span className="reporting-dashboard-eyebrow">گزارش‌گیری سازمانی</span>
          <h1>داشبورد گزارشات</h1>
          <p>
            گزارش را انتخاب کنید، داده‌ها را فیلتر کنید و جزئیات هر رکورد را ببینید.
          </p>
        </div>

        <div className="reporting-dashboard-header-actions">
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading || Boolean(busy)}
          >
            {loading ? 'در حال دریافت…' : 'به‌روزرسانی داده‌ها'}
          </button>
        </div>
      </header>

      {isDemoMode && (
        <div className="reporting-demo-banner" role="status">
          <div>
            <strong>حالت نمایشی فعال است</strong>
            <span>تمام رکوردها ساختگی هستند و در پایگاه داده ذخیره نمی‌شوند. Excel غیرفعال است؛ نسخه PDF همین داده‌های نمایشی و جزئیات فیلترشده را چاپ می‌کند.</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const url = new URL(window.location.href)
              url.searchParams.delete('demo')
              window.location.assign(url.toString())
            }}
          >
            بازگشت به داده‌های واقعی
          </button>
        </div>
      )}
      <section className="reporting-dashboard-filter-card">
        <div className="reporting-dashboard-section-heading">
          <div>
            <h2>فیلتر و جست‌وجوی گزارش</h2>
            <p>
              فیلدها بر اساس نوع گزارش انتخاب‌شده تغییر می‌کنند.
            </p>
          </div>
        </div>

        <div className="reporting-dashboard-filter-grid">
          <label className="reporting-dashboard-field">
            <span>نوع گزارش</span>
            <select
              value={report}
              onChange={(event) => {
                setReport(event.target.value)
                setCategoryFilter('all')
                setSearch('')
              }}
            >
              {REPORTING_EXPORT_OPTIONS.map((option) => (
                <option value={option.key} key={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {supportsAsOf && (
            <div className="reporting-dashboard-field">
              <span>تاریخ مبنا</span>
              <JalaliDatePicker value={asOf} onChange={setAsOf} />
            </div>
          )}

          {isUnitReport && (
            <label className="reporting-dashboard-field">
              <span>سطح سازمانی</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="1">سطح ۱ · بالاترین سطح</option>
                <option value="2">سطح ۲</option>
                <option value="3">سطح ۳</option>
                <option value="4">سطح ۴</option>
                <option value="5">سطح ۵</option>
              </select>
            </label>
          )}

          <label className="reporting-dashboard-field">
            <span>جست‌وجو در جزئیات</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="نام، کد، وضعیت یا مقدار…"
            />
          </label>

          {categories.length > 0 && (
            <label className="reporting-dashboard-field">
              <span>فیلتر بر اساس گروه</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="all">همه گروه‌ها</option>
                {categories.map((category) => (
                  <option value={category} key={category}>
                    {reportingValueLabel(category)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="reporting-dashboard-filter-footer">
          <p>{selectedReport?.description || ''}</p>
          <button type="button" className="reporting-dashboard-secondary" onClick={clearLocalFilters}>
            پاک‌کردن جست‌وجو و فیلتر گروه
          </button>
        </div>
      </section>

      {error && (
        <p className="reporting-export-message reporting-export-message--error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="reporting-export-message" role="status">
          {message}
        </p>
      )}

      {view.metrics.length > 0 && (
        <section className="reporting-dashboard-metrics" aria-label="خلاصه گزارش">
          {view.metrics.map((metric) => (
            <article className="reporting-dashboard-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{reportingFormatValue(metric.value)}</strong>
            </article>
          ))}
        </section>
      )}

      <div className={'reporting-dashboard-charts-row' + (xyFields.length > 0 ? '' : ' reporting-dashboard-charts-row--single')}>
      <section className="reporting-dashboard-chart-card">
        <div className="reporting-dashboard-section-heading">
          <div>
            <h2>نمودار تحلیلی</h2>
            <p>{view.chartTitle}</p>
          </div>
          <span className="reporting-dashboard-count">
            {reportingFormatValue(filteredItems.length)} رکورد فیلترشده
          </span>
        </div>

        {loading ? (
          <div className="reporting-dashboard-loading">در حال دریافت داده‌های گزارش…</div>
        ) : (
          renderChart()
        )}
      </section>

      {xyFields.length > 0 && (
        <section className="reporting-dashboard-chart-card reporting-xy-chart-card">
          <div className="reporting-dashboard-section-heading">
            <div>
              <h2>نمودار X/Y</h2>
              <p>دو متغیر عددی را انتخاب کنید تا رابطه آن‌ها بین رکوردهای فعلی مقایسه شود.</p>
            </div>
            <span className="reporting-dashboard-count">
              {reportingFormatValue(xyPoints.length)} نقطه قابل رسم
            </span>
          </div>

          <div className="reporting-xy-filter-row">
            <label className="reporting-dashboard-field">
              <span>محور X</span>
              <select
                value={xField}
                onChange={(event) => {
                  const next = event.target.value
                  setXField(next)
                  if (next === yField) {
                    setYField(xyFields.find((field) => field.key !== next)?.key || next)
                  }
                }}
              >
                {xyFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </label>

            <label className="reporting-dashboard-field">
              <span>محور Y</span>
              <select
                value={yField}
                onChange={(event) => {
                  const next = event.target.value
                  setYField(next)
                  if (next === xField) {
                    setXField(xyFields.find((field) => field.key !== next)?.key || next)
                  }
                }}
              >
                {xyFields.map((field) => (
                  <option key={field.key} value={field.key}>{field.label}</option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="reporting-dashboard-loading">در حال دریافت داده‌ها…</div>
          ) : (
            <ReportingXYChart
              title={`${xyFields.find((field) => field.key === xField)?.label || 'X'} / ${xyFields.find((field) => field.key === yField)?.label || 'Y'}`}
              points={xyPoints}
              xLabel={xyFields.find((field) => field.key === xField)?.label || 'X'}
              yLabel={xyFields.find((field) => field.key === yField)?.label || 'Y'}
              zoom={xyZoom}
              setZoom={setXyZoom}
            />
          )}
        </section>
      )}
      </div>
      <section className="reporting-dashboard-list-card">
        <div className="reporting-dashboard-section-heading">
          <div>
            <h2>فهرست جزئیات گزارش</h2>
            <p>تمام جزئیات هر رکورد مستقیماً در فهرست نمایش داده می‌شود.</p>
          </div>
          <span className="reporting-dashboard-count">
            {reportingFormatValue(filteredItems.length)} از {reportingFormatValue(view.items.length)}
          </span>
        </div>

        {loading ? (
          <div className="reporting-dashboard-loading">در حال بارگذاری فهرست…</div>
        ) : filteredItems.length === 0 ? (
          <div className="reporting-empty-state">
            {error
              ? 'به علت خطا، داده‌ای برای نمایش در دسترس نیست.'
              : 'رکوردی مطابق فیلترهای فعلی پیدا نشد.'}
          </div>
        ) : (
          <div className="reporting-dashboard-record-list">
            {filteredItems.map((item, index) => (
              <article
                className="reporting-dashboard-record"
                key={`${item.id}-${index}`}
              >
                <div className="reporting-dashboard-record-heading">
                  <div className="reporting-dashboard-record-title">
                    <strong>{item.title}</strong>
                    {item.subtitle && <span>{item.subtitle}</span>}
                  </div>
                  <span className="reporting-dashboard-record-category">
                    {reportingValueLabel(item.category)}
                  </span>
                </div>

                <dl className="reporting-dashboard-detail-grid">
                  {item.details.map((detail, detailIndex) => (
                    <div key={`${detail.label}-${detailIndex}`}>
                      <dt>{detail.label}</dt>
                      <dd>{reportingFormatValue(detail.value)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="reporting-dashboard-export-card">
        <div>
          <h2>دریافت خروجی</h2>
          <p>
            خروجی Excel و نسخه چاپی از سرویس گزارش‌گیری فعلی ساخته می‌شوند.
          </p>
        </div>

        <div className="reporting-export-actions">
          <button type="button" onClick={downloadExcel} disabled={Boolean(busy) || loading || isDemoMode}>
            <FileChartColumn size={19} />
            {busy === 'xlsx' ? 'در حال ساخت Excel…' : 'دریافت فایل Excel'}
          </button>
          <button
            type="button"
            className="reporting-export-print"
            onClick={openPrintableReport}
            disabled={Boolean(busy) || loading}
          >
            <FileText size={19} />
            {busy === 'html' ? 'در حال آماده‌سازی…' : 'نسخه چاپی / PDF'}
          </button>
        </div>
      </section>

      {chartExpanded && (
        <div
          className="reporting-chart-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="نمودار بزرگ‌شده"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChartExpanded(false)
          }}
        >
          <div className="reporting-chart-modal">
            <div className="reporting-chart-modal-header">
              <div>
                <h2>{view.chartTitle}</h2>
                <p>برای بزرگ‌نمایی بیشتر از کنترل‌های + و − استفاده کنید.</p>
              </div>
              <button type="button" onClick={() => setChartExpanded(false)}>
                بستن ✕
              </button>
            </div>
            {renderChart(true)}
          </div>
        </div>
      )}
    </section>
  )
}

const CHART_STATUS_ORDER = ['Draft', 'Active', 'OnHold', 'Completed', 'Archived']

function statusKey(value) {
  return typeof value === 'number' ? CHART_STATUS_ORDER[value] : value
}

/** Main dashboard: the caller's numbers and the organisation's, read from the Core. */
function DashboardHome({ onOpenProjects }) {
  const { user } = useAuth()
  const { loading, error, mine, summary, projects, canMine, canAll, canProjects } = useDashboard()

  const today = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const name = user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(' ')

  const cards = summary
    ? [
        { label: 'کل پروژه‌ها', value: summary.projectCount, unit: 'پروژه', note: 'همه پروژه‌های سازمان', icon: FolderOpen, tone: 'gold' },
        { label: 'پروژه‌های در جریان', value: summary.runningProjectCount, unit: 'پروژه', note: mine ? `از این تعداد ${Number(mine.myRunningProjectCount).toLocaleString('fa-IR')} پروژه با شما است` : 'فعال یا متوقف', icon: TrendingUp, tone: 'blue' },
        { label: 'کل اقدام‌ها', value: summary.actionCount, unit: 'اقدام', note: 'همه اقدام‌های سازمان', icon: ListTodo, tone: 'cyan' },
        { label: 'اقدام‌های در جریان', value: summary.runningActionCount, unit: 'اقدام', note: mine ? `از این تعداد ${Number(mine.myRunningActionCount).toLocaleString('fa-IR')} اقدام با شما است` : 'باز یا در حال انجام', icon: CheckCircle2, tone: 'violet' },
      ]
    : mine
      ? [
          { label: 'پروژه‌های در جریان من', value: mine.myRunningProjectCount, unit: 'پروژه', note: 'پروژه‌هایی که مالک یا مدیر آن هستید', icon: TrendingUp, tone: 'blue' },
          { label: 'اقدام‌های در جریان من', value: mine.myRunningActionCount, unit: 'اقدام', note: 'اقدام‌هایی که مسئول یا مالک آن هستید', icon: CheckCircle2, tone: 'violet' },
        ]
      : []

  // Organisation-wide counts when the caller may see them, otherwise what their own list contains.
  const byStatus = summary
    ? summary.projectsByStatus.map(({ key, count }) => [key, count])
    : Object.entries(projects.reduce((map, project) => {
        const key = statusKey(project.status)
        map[key] = (map[key] || 0) + 1
        return map
      }, {}))
  const bars = CHART_STATUS_ORDER
    .map((key) => [key, byStatus.find(([k]) => k === key)?.[1] || 0])
    .filter(([key, count]) => count > 0 || key !== 'Archived')
  const max = Math.max(1, ...bars.map(([, count]) => count))
  const ticks = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0]

  const recent = [...projects]
    .sort((a, b) => String(b.createdAtUtc || '').localeCompare(String(a.createdAtUtc || '')))
    .slice(0, 5)

  const noAccess = !canMine && !canAll && !canProjects

  return (
    <>
      <section className="welcome-banner">
        <div><span>{today}</span><h1>سلام{name ? `، ${name}` : ''} 👋</h1><p>خلاصه‌ای از وضعیت پروژه‌ها و اقدام‌های مجموعه شما را آماده کرده‌ایم.</p></div>
        <button><FileChartColumn size={19} /> مشاهده گزارش کامل</button>
      </section>

      {noAccess && <p className="data-state">برای مشاهده داشبورد به دسترسی «مشاهده داشبورد شخصی» یا «مشاهده فهرست پروژه‌ها» نیاز دارید.</p>}
      {!noAccess && loading && <p className="data-state">در حال دریافت اطلاعات داشبورد...</p>}
      {!noAccess && !loading && error && <p className="data-state data-state--error">{error}</p>}

      {cards.length > 0 && (
        <section className="stats-grid">
          {cards.map(({ label, value, unit, note, icon: Icon, tone }) => (
            <article className="stat-card" key={label}>
              <div className={`stat-icon ${tone}`}><Icon size={24} /></div>
              <span>{label}</span>
              <div className="stat-value"><strong>{Number(value).toLocaleString('fa-IR')}</strong><small>{unit}</small></div>
              <p>{note}</p>
            </article>
          ))}
        </section>
      )}

      {(canProjects || canAll) && (
        <section className="dashboard-grid">
          <article className="panel sales-panel">
            <div className="panel-header"><div><h3>وضعیت پروژه‌ها</h3><p>{summary ? 'تعداد پروژه‌های سازمان به تفکیک وضعیت' : 'تعداد پروژه‌های قابل مشاهده برای شما به تفکیک وضعیت'}</p></div></div>
            <div className="chart-area">
              <div className="chart-labels">{ticks.map((tick, index) => <span key={index}>{tick.toLocaleString('fa-IR')}</span>)}</div>
              <div className="bars">
                {bars.map(([key, count]) => (
                  <div className="bar-column" key={key} title={`${enumLabel(key, projectStatusLabels)}: ${count.toLocaleString('fa-IR')}`}>
                    <div style={{ height: `${(count / max) * 100}%` }} />
                    <span>{enumLabel(key, projectStatusLabels)} ({count.toLocaleString('fa-IR')})</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
          <article className="panel activity-panel">
            <div className="panel-header"><div><h3>پروژه‌های اخیر</h3><p>آخرین پروژه‌های ثبت‌شده</p></div><button onClick={onOpenProjects}>مشاهده همه</button></div>
            {recent.length ? (
              <ul>
                {recent.map((project) => (
                  <li key={project.id}>
                    <span className="activity-icon blue"><FolderOpen size={17} /></span>
                    <div><strong>{projectDisplayName(project)}</strong><p>{[project.code, enumLabel(project.type, projectTypeLabels)].filter(Boolean).join(' · ')}</p></div>
                    <time>{formatDateOnly(project.createdAtUtc)}</time>
                  </li>
                ))}
              </ul>
            ) : !loading && <p className="data-state">هنوز پروژه‌ای ثبت نشده است.</p>}
          </article>
        </section>
      )}
    </>
  )
}

function Dashboard() {
  const { user, signOut } = useAuth()
  const [active, setActive] = useState(dashboardLabel)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const projectData = useProjectManagementData()

  return (
    <div className="app-shell" dir="rtl">
      <Sidebar active={active} onSelect={setActive} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
            <div><span>صفحه اصلی</span><strong>{active}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={19} /><input placeholder="جست‌وجو در سامانه..." /></label>
            <NotificationBell />
            <TopbarUserMenu onProfile={() => setActive(userProfileLabel)} onSignOut={signOut} />
          </div>
        </header>

        <main className="dashboard-content">
          {active === dashboardLabel ? (
            <DashboardHome onOpenProjects={() => setActive(projectSubmenus[0].label)} />
          ) : taskSubmenus.some((item) => item.label === active) ? (
            <TaskManagement active={active} data={projectData} />
          ) : projectSubmenus.some((item) => item.label === active) ? (
            <ProjectManagement active={active} data={projectData} />
          ) : controlSubmenus.some((item) => item.label === active) ? (
            <ControlManagement active={active} data={projectData} />
          ) : active === governanceSubmenus[0].label ? (
            <ReportingExportPage />
          ) : active === governanceSubmenus[1].label ? (
            <KnowledgeManagement />
          ) : active === 'چت و گفت‌وگوی آنلاین' ? (
            <ChatPage />
          ) : active === 'مدیریت کاربران' ? (
            <UserManagement />
          ) : active === userProfileLabel ? (
            <UserProfile />
          ) : submenuLabels.includes(active) ? (
            <section className="empty-page">
              <div><Boxes size={38} /></div><h1>{active}</h1><p>ساخت محتوای این بخش در مرحله بعدی انجام می‌شود.</p><button onClick={() => setActive(dashboardLabel)}>بازگشت به داشبورد</button>
            </section>
          ) : (
            <section className="empty-page">
              <div><Boxes size={38} /></div><h1>{active}</h1><p>برای شروع یکی از زیرمنوها را انتخاب کنید.</p><button onClick={() => setActive(dashboardLabel)}>بازگشت به داشبورد</button>
            </section>
          )}
        </main>

      </div>
    </div>
  )
}

function AppRoutes() {
  const { isAuthenticated, booting } = useAuth()
  // No router in this app; a token in the URL selects the reset screen on first paint.
  const [screen, setScreen] = useState(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    return token || window.location.pathname.includes('reset-password') ? 'reset' : 'login'
  })
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '')

  if (booting) {
    return <main className="login-page" dir="rtl"><section className="login-panel"><div className="login-box"><Brand /><p>در حال بررسی نشست...</p></div></section></main>
  }

  if (isAuthenticated) return <Dashboard />

  if (screen === 'forgot') {
    return <ForgotPassword onBack={() => setScreen('login')} onTokenIssued={(token) => { setResetToken(token); setScreen('reset') }} />
  }

  if (screen === 'reset') {
    return <ResetPassword initialToken={resetToken} onBack={() => setScreen('login')} />
  }

  return <Login onForgotPassword={() => setScreen('forgot')} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
