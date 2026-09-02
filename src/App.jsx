import { useEffect, useMemo, useRef, useState } from 'react'
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
  PackageCheck,
  Plus,
  Paperclip,
  Pencil,
  Presentation,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
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
  { label: 'داشبورد مدیریتی و گزارش‌دهی', icon: ChartNoAxesCombined },
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

const stats = [
  { label: 'فروش این ماه', value: '۲۸۴,۵۰۰,۰۰۰', unit: 'تومان', change: '۱۲٪ رشد', icon: TrendingUp, tone: 'gold' },
  { label: 'سفارش‌های فعال', value: '۲۴', unit: 'سفارش', change: '۸ سفارش جدید', icon: PackageCheck, tone: 'blue' },
  { label: 'مشتریان جدید', value: '۳۸', unit: 'مشتری', change: 'این ماه', icon: UsersRound, tone: 'cyan' },
  { label: 'فاکتورهای باز', value: '۱۷', unit: 'فاکتور', change: 'نیازمند بررسی', icon: ReceiptText, tone: 'violet' },
]

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
  // Core identity is e-mail based (LoginRequest.Email) and seeds this account.
  const [username, setUsername] = useState('admin@nexus.local')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const result = await signIn(username.trim(), password)
    setBusy(false)
    if (!result.ok) setError(result.error)
  }

  return (
    <main className="login-page" dir="rtl">
      <section className="login-visual" aria-label="معرفی سامانه روزت">
        <div className="visual-orb visual-orb--one" />
        <div className="visual-orb visual-orb--two" />
        <div className="visual-content">
          <div className="gold-mark"><span /><span /><span /><span /><span /></div>
          <p className="eyebrow">گروه اقتصادی روزت</p>
          <h1>مدیریت هوشمند،<br />رشد ماندگار.</h1>
          <p className="visual-copy">تمام ابزارهای مورد نیاز کسب‌وکار شما، در یک فضای ساده، امن و یکپارچه.</p>
          <div className="trust-row">
            <div><ShieldCheck size={21} /><span>ورود امن</span></div>
            <div><TrendingUp size={21} /><span>گزارش لحظه‌ای</span></div>
            <div><CircleHelp size={21} /><span>پشتیبانی همراه</span></div>
          </div>
        </div>
        <span className="visual-footer">ROZET ECONOMIC GROUP · 2026</span>
      </section>

      <section className="login-panel">
        <div className="login-box">
          <Brand />
          <div className="login-heading">
            <p>به سامانه روزت خوش آمدید</p>
            <h2>ورود به حساب کاربری</h2>
            <span>برای ادامه، اطلاعات حساب خود را وارد کنید.</span>
          </div>

          <form onSubmit={submit}>
            <label htmlFor="username">نام کاربری (ایمیل)</label>
            <div className="input-wrap">
              <UserRound size={20} />
              <input id="username" type="email" value={username} onChange={(event) => { setUsername(event.target.value); setError('') }} autoComplete="username" placeholder="ایمیل خود را وارد کنید" required />
            </div>

            <div className="password-label">
              <label htmlFor="password">رمز عبور</label>
              <button type="button" onClick={onForgotPassword}>فراموشی رمز عبور؟</button>
            </div>
            <div className="input-wrap">
              <ShieldCheck size={20} />
              <input id="password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="رمز عبور خود را وارد کنید" required />
              <button className="eye-btn" type="button" onClick={() => setShowPassword((value) => !value)} aria-label="نمایش یا مخفی کردن رمز عبور">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <label className="check-row">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>مرا به خاطر بسپار</span>
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="login-btn" type="submit" disabled={busy}>{busy ? 'در حال ورود...' : 'ورود به سامانه'} <ChevronLeft size={20} /></button>
          </form>
          <p className="support-copy">برای دریافت راهنمایی با <button type="button">پشتیبانی روزت</button> در ارتباط باشید.</p>
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
        <div className="visual-orb visual-orb--one" />
        <div className="visual-orb visual-orb--two" />
        <div className="visual-content">
          <div className="gold-mark"><span /><span /><span /><span /><span /></div>
          <p className="eyebrow">گروه اقتصادی روزت</p>
          <h1>بازیابی امن<br />دسترسی شما.</h1>
          <p className="visual-copy">لینک بازیابی محدود به زمان است و پس از یک‌بار استفاده باطل می‌شود.</p>
          <div className="trust-row">
            <div><ShieldCheck size={21} /><span>توکن یک‌بارمصرف</span></div>
            <div><Clock3 size={21} /><span>انقضای زمان‌دار</span></div>
            <div><CircleHelp size={21} /><span>پشتیبانی همراه</span></div>
          </div>
        </div>
        <span className="visual-footer">ROZET ECONOMIC GROUP · 2026</span>
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

function formatBytes(value) {
  const size = Number(value || 0)
  if (!size) return '—'
  if (size < 1024) return `${size.toLocaleString('fa-IR')} بایت`
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString('fa-IR')} کیلوبایت`
  return `${(size / 1024 / 1024).toFixed(1).replace('.', '/')} مگابایت`
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
  }, [tenantId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!projects.length) {
        setTasks([])
        return
      }
      const results = await Promise.all(projects.map((project) => projectManagementApi.agileTasks({ projectId: project.id })))
      if (cancelled) return
      setTasks(results.flatMap((result, index) => arrayPayload(result).map((task) => ({ ...task, projectName: projects[index].name }))))
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
  }, [selectedProjectId])

  const userName = useMemo(() => {
    const map = new Map(users.map((item) => [item.id, item.displayName || item.email]))
    return (id) => map.get(id) || '—'
  }, [users])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null

  return {
    tenantId, projects, projectTotal, selectedProject, selectedProjectId, setSelectedProjectId,
    tasks, activities, progressUpdates, documents, risks, stakeholders, teamMembers,
    governanceRoles, deliverables, kpis, userName, loading, loadingDetails, error,
  }
}

function ProjectSelector({ data }) {
  if (!data.projects.length) return null
  return (
    <select className="project-selector" value={data.selectedProjectId} onChange={(event) => data.setSelectedProjectId(event.target.value)}>
      {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
  )
}

function DataState({ loading, error, empty, children }) {
  if (loading) return <p className="data-state">در حال دریافت اطلاعات از Nexus Core...</p>
  if (error) return <p className="data-state data-state--error">{error}</p>
  if (empty) return <p className="data-state">داده‌ای برای نمایش وجود ندارد.</p>
  return children
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

function TaskPageHeader({ title, description, action = 'ایجاد وظیفه جدید', children }) {
  return (
    <div className="task-page-header">
      <div><span>مدیریت وظایف / {title}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="task-head-actions">{children}<button><Plus size={18} />{action}</button></div>
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
    return [project.name, percent, `${projectDone.toLocaleString('fa-IR')} از ${projectTasks.length.toLocaleString('fa-IR')} وظیفه`]
  })

  return (
    <>
      <TaskPageHeader title="داشبورد وظایف" description="نمای کلی وضعیت وظایف متصل به Nexus Core">
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
  return <><TaskPageHeader title="همه وظایف" description="مشاهده و مدیریت وظایف دریافت شده از Agile Tasks API"><ProjectSelector data={data} /></TaskPageHeader><div className="view-switch"><button className="active"><ListTodo size={16} />نمای لیستی</button><button><Network size={16} />نمای درختی</button><button><UserRound size={16} />وظایف من</button></div><TaskList data={data} /></>
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
  return <><TaskPageHeader title="برد کانبان" description="نمای دیداری وضعیت وظایف موجود در Nexus Core"><ProjectSelector data={data} /></TaskPageHeader><div className="kanban-toolbar"><div className="view-switch"><button className="active">کانبان</button><button>اسکرامبان</button></div><ProjectSelector data={data} /></div><DataState loading={data.loading} error={data.error} empty={!normalized.length}><div className="kanban-board">{columns.map((column) => <section className="kanban-column" key={column.title}><header><div><i className={column.tone} /><strong>{column.title}</strong><span>{column.tasks.length.toLocaleString('fa-IR')}</span></div><button><Plus size={16} /></button></header>{column.tasks.map((task) => <article className="kanban-card" key={task.id}><div><span className={`priority ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'high' : task.priority === 'متوسط' ? 'medium' : 'low'}`}>{task.priority}</span><MoreHorizontal size={16} /></div><h4>{task.title}</h4><p>{task.project}</p><footer><span><Clock3 size={14} />{task.due}</span><i>{initialsOf(task.owner).slice(0, 1)}</i></footer></article>)}</section>)}</div></DataState></>
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
  return <><TaskPageHeader title="تقویم پروژه" description="تقویم موعد وظایف؛ Core هنوز endpoint رویداد پروژه مستقل ندارد" action="افزودن رویداد"><ProjectSelector data={data} /></TaskPageHeader><div className="calendar-toolbar"><button>امروز</button><div><ChevronLeft size={18} /><strong>{today.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}</strong><ChevronLeft className="flip" size={18} /></div><ProjectSelector data={data} /></div><DataState loading={data.loading} error={data.error} empty={!data.tasks.length}><section className="calendar-card"><div className="calendar-weekdays">{['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => <div className={day === today.getDate() ? 'today' : ''} key={index}>{day && <b>{day.toLocaleString('fa-IR')}</b>}{(byDay[day] || []).slice(0, 3).map((task) => <span className={`event ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'gold' : task.status === 'تکمیل شده' ? 'green' : 'blue'}`} key={task.id}>{task.title}</span>)}</div>)}</div></section></DataState></>
}

function ProjectPlanning({ data }) {
  const project = data.selectedProject
  return (
    <>
      <TaskPageHeader title="برنامه‌ریزی پروژه" description="فهرست پروژه‌ها و فعالیت‌های WBS متصل به Core" action="ایجاد پروژه">
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
          <div className="task-panel-title"><div><h3>فعالیت‌های برنامه</h3><p>داده‌های Waterfall Activities برای پروژه منتخب</p></div></div>
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

function ProjectDocuments({ data }) {
  return (
    <>
      <TaskPageHeader title="مدیریت مستندات" description="لیست مستندات پروژه از Project Documents API" action="آپلود سند">
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
      <TaskPageHeader title="کنترل پیشرفت پروژه" description="گزارش‌های پیشرفت ثبت‌شده در Core" action="ثبت گزارش پیشرفت">
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
      <TaskPageHeader title="مدیریت استراتژیک پروژه‌ها" description="نمای خلاصه پروژه، خروجی‌ها و KPIهای موجود در Core" action="تعریف KPI">
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.selectedProject}>
        <section className="task-dashboard-grid">
          <div className="task-panel task-table-panel">
            <div className="task-panel-title"><div><h3>خروجی‌های پروژه</h3><p>Deliverables API</p></div></div>
            <DataState loading={data.loadingDetails} empty={!data.deliverables.length}>
              <div className="table-scroll"><table><thead><tr><th>خروجی</th><th>وضعیت</th><th>مسئول</th></tr></thead><tbody>{data.deliverables.map((item) => <tr key={item.id}><td><strong>{item.title || item.name || item.description || item.id}</strong></td><td>{item.status ?? '—'}</td><td>{data.userName(item.responsibleUserId)}</td></tr>)}</tbody></table></div>
            </DataState>
          </div>
          <div className="task-panel task-table-panel">
            <div className="task-panel-title"><div><h3>KPIها</h3><p>KPI API</p></div></div>
            <DataState loading={data.loadingDetails} empty={!data.kpis.length}>
              <div className="table-scroll"><table><thead><tr><th>شاخص</th><th>هدف</th><th>واحد</th></tr></thead><tbody>{data.kpis.map((item) => <tr key={item.id}><td><strong>{item.name || item.title || item.id}</strong></td><td>{item.targetValue ?? item.target ?? '—'}</td><td>{item.unit || '—'}</td></tr>)}</tbody></table></div>
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
  return <><TaskPageHeader title="جلسات و صورت‌جلسات" description="برنامه‌ریزی جلسات، ثبت صورت‌جلسه و تخصیص بندهای اجرایی" action="برگزاری جلسه جدید" /><div className="meeting-summary"><article><CalendarDays size={22} /><div><strong>۵</strong><span>جلسه پیش رو</span></div></article><article><FileText size={22} /><div><strong>۱۲</strong><span>بند اجرایی باز</span></div></article><article><CheckCircle2 size={22} /><div><strong>۸</strong><span>صورت‌جلسه نهایی‌شده</span></div></article></div><section className="task-panel meetings-list"><div className="task-panel-title"><div><h3>جلسات اخیر و پیش رو</h3><p>فهرست جلسات مرتبط با پروژه‌های شما</p></div><div className="view-switch"><button className="active">همه</button><button>پیش رو</button><button>گذشته</button></div></div>{meetings.map(([title, project, time, location, status]) => <article key={title}><span className="meeting-date"><b>{time.split(' ')[0]}</b><small>{time.replace(time.split(' ')[0], '')}</small></span><div className="meeting-info"><h4>{title}</h4><p>{project}</p><span>{location === 'جلسه آنلاین' ? <Video size={14} /> : <Users2 size={14} />}{location}</span></div><div className="meeting-meta"><StatusPill status={status === 'برگزار شده' ? 'تکمیل شده' : 'در حال انجام'} /><button>{status === 'برگزار شده' ? 'مشاهده صورت‌جلسه' : 'ورود به جلسه'}</button></div></article>)}</section></>
}

function Workflows() {
  const flows = [['گردش کار وظایف اجرایی','پیش‌نویس، در حال انجام، بازبینی، تأیید نهایی','۳ پروژه','فعال'],['فرآیند بررسی مستندات','ثبت، بررسی کارشناس، اصلاح، تأیید مدیر','۲ پروژه','فعال'],['الگوی درخواست تغییر','ثبت درخواست، ارزیابی اثر، کمیته تغییر، اجرا','تمام پروژه‌ها','پیش‌نویس']]
  return <><TaskPageHeader title="گردش کار و الگوها" description="تعریف مراحل و قوانین گردش وظایف به تفکیک پروژه" action="ساخت گردش کار" /><section className="workflow-help"><Workflow size={28} /><div><h3>فرآیندهای کاری را با پروژه خود هماهنگ کنید</h3><p>وضعیت‌ها، مسئول هر مرحله و قوانین انتقال را بدون نیاز به کدنویسی تعریف کنید.</p></div><button>راهنمای طراحی گردش کار</button></section><div className="workflow-grid">{flows.map(([title, steps, projects, status], index) => <article key={title}><header><span className={`workflow-icon tone-${index}`}><Workflow size={20} /></span><MoreHorizontal size={18} /></header><h3>{title}</h3><p>{steps}</p><div className="flow-steps">{[1,2,3,4].map((step) => <i key={step} />)}</div><footer><span>{projects}</span><StatusPill status={status === 'فعال' ? 'تکمیل شده' : 'برای انجام'} /></footer></article>)}</div></>
}

function RaciMatrix({ data }) {
  const people = data.governanceRoles.length ? data.governanceRoles : data.teamMembers.map((member) => ({ id: member.id, title: member.roleTitle || 'عضو تیم', userId: member.userId }))
  const rows = [...data.activities, ...data.deliverables].slice(0, 8)
  return <><TaskPageHeader title="ماتریس مسئولیت‌ها (RACI)" description="Core نقش‌های حاکمیتی دارد، ولی RACI واقعی به‌عنوان endpoint مستقل ندارد" action="افزودن فعالیت"><ProjectSelector data={data} /></TaskPageHeader><div className="raci-legend"><span><i className="r">R</i>مسئول اجرا</span><span><i className="a">A</i>پاسخگو</span><span><i className="c">C</i>مشاور</span><span><i className="i">I</i>مطلع</span><ProjectSelector data={data} /></div><section className="task-panel raci-table"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!rows.length || !people.length}><div className="table-scroll"><table><thead><tr><th>فعالیت / خروجی</th>{people.slice(0, 5).map((person) => <th key={person.id}><span className="person-head"><i>{initialsOf(data.userName(person.userId)).slice(0, 1)}</i>{data.userName(person.userId)}<small>{person.title}</small></span></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || row.title || row.description || row.id}</strong></td>{people.slice(0, 5).map((person, index) => <td key={person.id}><span className={`raci-role ${index === 0 ? 'a' : row.responsibleUserId === person.userId ? 'r' : index === 1 ? 'c' : 'i'}`}>{index === 0 ? 'A' : row.responsibleUserId === person.userId ? 'R' : index === 1 ? 'C' : 'I'}</span></td>)}</tr>)}</tbody></table></div></DataState></section></>
}

function RisksPage({ data }) {
  return <><TaskPageHeader title="مدیریت ریسک" description="ریسک‌های پروژه از Risks API" action="ثبت ریسک"><ProjectSelector data={data} /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.risks.length}><div className="table-scroll"><table><thead><tr><th>ریسک</th><th>احتمال</th><th>شدت</th><th>اثر</th><th>RPN</th><th>مالک</th><th>برنامه پاسخ</th></tr></thead><tbody>{data.risks.map((risk) => <tr key={risk.id}><td><strong>{risk.description}</strong></td><td>{risk.probabilityScore}</td><td>{risk.severityScore}</td><td>{risk.impactScore}</td><td>{risk.rpn}</td><td>{data.userName(risk.riskOwnerUserId)}</td><td>{risk.responsePlan || '—'}</td></tr>)}</tbody></table></div></DataState></section></>
}

function ResourcesPage({ data }) {
  return <><TaskPageHeader title="مدیریت منابع" description="منابع انسانی فعلاً از Project Team API پوشش داده می‌شود" action="افزودن عضو"><ProjectSelector data={data} /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.teamMembers.length}><div className="table-scroll"><table><thead><tr><th>نام عضو</th><th>نقش پروژه</th><th>شناسه کاربر</th></tr></thead><tbody>{data.teamMembers.map((member) => <tr key={member.id}><td><span className="owner-cell"><i>{initialsOf(data.userName(member.userId)).slice(0, 1)}</i><strong>{data.userName(member.userId)}</strong></span></td><td>{member.roleTitle || '—'}</td><td>{member.userId}</td></tr>)}</tbody></table></div></DataState></section></>
}

function StakeholdersPage({ data }) {
  return <><TaskPageHeader title="مدیریت ذینفعان" description="ذینفعان پروژه از Stakeholders API" action="ثبت ذینفع"><ProjectSelector data={data} /></TaskPageHeader><section className="task-panel task-table-panel"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!data.stakeholders.length}><div className="table-scroll"><table><thead><tr><th>نام</th><th>نوع</th><th>قدرت</th><th>علاقه</th><th>انتظارات</th><th>استراتژی تعامل</th></tr></thead><tbody>{data.stakeholders.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.isInternal ? 'داخلی' : 'خارجی'}</td><td>{item.power}</td><td>{item.interest}</td><td>{item.expectations || '—'}</td><td>{item.engagementStrategy || '—'}</td></tr>)}</tbody></table></div></DataState></section></>
}

function CostPage({ data }) {
  return <><TaskPageHeader title="مدیریت هزینه" description="Core فعلاً فقط Cost کلی پروژه را پوشش می‌دهد" action="ثبت هزینه"><ProjectSelector data={data} /></TaskPageHeader><section className="empty-page"><div><WalletCards size={38} /></div><h1>{data.selectedProject?.cost ? Number(data.selectedProject.cost).toLocaleString('fa-IR') : 'هزینه ثبت نشده'}</h1><p>برای مدیریت هزینه واقعی، endpointهای بودجه، هزینه واقعی، پیش‌بینی و آیتم‌های هزینه لازم است.</p></section></>
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
            <>
              <section className="welcome-banner">
                <div><span>شنبه، ۳۱ مرداد ۱۴۰۵</span><h1>سلام، روز خوبی داشته باشید 👋</h1><p>خلاصه‌ای از وضعیت امروز مجموعه شما را آماده کرده‌ایم.</p></div>
                <button><FileChartColumn size={19} /> مشاهده گزارش کامل</button>
              </section>
              <section className="stats-grid">
                {stats.map(({ label, value, unit, change, icon: Icon, tone }) => (
                  <article className="stat-card" key={label}>
                    <div className={`stat-icon ${tone}`}><Icon size={24} /></div>
                    <span>{label}</span>
                    <div className="stat-value"><strong>{value}</strong><small>{unit}</small></div>
                    <p>{change}</p>
                  </article>
                ))}
              </section>
              <section className="dashboard-grid">
                <article className="panel sales-panel">
                  <div className="panel-header"><div><h3>روند فروش</h3><p>مقایسه فروش ۶ ماه اخیر</p></div><select aria-label="بازه گزارش"><option>۶ ماه اخیر</option><option>سال جاری</option></select></div>
                  <div className="chart-area">
                    <div className="chart-labels"><span>۳۰۰م</span><span>۲۰۰م</span><span>۱۰۰م</span><span>۰</span></div>
                    <div className="bars">
                      {[42, 61, 52, 73, 66, 91].map((height, index) => <div className="bar-column" key={index}><div style={{ height: `${height}%` }} /><span>{['اسفند','فروردین','اردیبهشت','خرداد','تیر','مرداد'][index]}</span></div>)}
                    </div>
                  </div>
                </article>
                <article className="panel activity-panel">
                  <div className="panel-header"><div><h3>آخرین فعالیت‌ها</h3><p>رویدادهای اخیر سامانه</p></div><button>مشاهده همه</button></div>
                  <ul>
                    <li><span className="activity-icon blue"><ShoppingBag size={17} /></span><div><strong>سفارش جدید ثبت شد</strong><p>سفارش شماره #۲۴۸۱</p></div><time>۱۰ دقیقه پیش</time></li>
                    <li><span className="activity-icon gold"><UsersRound size={17} /></span><div><strong>مشتری جدید اضافه شد</strong><p>شرکت بازرگانی آریا</p></div><time>۴۵ دقیقه پیش</time></li>
                    <li><span className="activity-icon green"><ReceiptText size={17} /></span><div><strong>فاکتور پرداخت شد</strong><p>فاکتور شماره #۱۰۳۲</p></div><time>۲ ساعت پیش</time></li>
                  </ul>
                </article>
              </section>
            </>
          ) : taskSubmenus.some((item) => item.label === active) ? (
            <TaskManagement active={active} data={projectData} />
          ) : projectSubmenus.some((item) => item.label === active) ? (
            <ProjectManagement active={active} data={projectData} />
          ) : controlSubmenus.some((item) => item.label === active) ? (
            <ControlManagement active={active} data={projectData} />
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
