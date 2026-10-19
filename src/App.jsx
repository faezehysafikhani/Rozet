import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Bell,
  BookOpen,
  Boxes,
  Building2,
  ArrowDownUp,
  Camera,
  Check,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  CheckCircle2,
  CheckCheck,
  CheckSquare2,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  CircleDollarSign,
  CircleDashed,
  CircleHelp,
  Clock3,
  CloudUpload,
  Columns3,
  Eye,
  EyeOff,
  FileChartColumn,
  FileText,
  Filter,
  Lock,
  FolderOpen,
  Grid3x3,
  Handshake,
  History,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  LogOut,
  Menu,
  MessagesSquare,
  MessageCircle,
  MessageSquareText,
  RotateCcw,
  MoreHorizontal,
  Network,
  Palette,
  Plus,
  Paperclip,
  Pencil,
  Presentation,
  RefreshCw,
  Save,
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
  Upload,
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
  Sun,
  Moon,
} from 'lucide-react'
import { AuthProvider, Can, useAuth } from './services/AuthContext'
import { PersianMessages, accountApi, groupsApi, identityApi, labelForModule, labelForPermission, myTeamsApi, orgChartApi, permissionsApi, platformApi, projectManagementApi, rolesApi, smsPanelApi, unwrap, uploadPolicyApi, usersApi } from './services/api'
import { DEFAULT_TENANT_ID } from './services/config'
import { useChat } from './hooks/useChat'
import { useNotifications } from './hooks/useNotifications'
import { useDashboard } from './hooks/useDashboard'
import { PRESET_AVATARS } from './utils/avatars'

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
  users: ['users.view'],
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
      <span>نمایش {toPersianDigits(from)} تا {toPersianDigits(to)} از {toPersianDigits(totalCount)} مورد</span>
      <div>
        <button type="button" disabled={pageNumber <= 1} onClick={() => onChange(pageNumber - 1)}>قبلی</button>
        <b>صفحه {toPersianDigits(pageNumber)} از {toPersianDigits(totalPages)}</b>
        <button type="button" disabled={pageNumber >= totalPages} onClick={() => onChange(pageNumber + 1)}>بعدی</button>
      </div>
    </div>
  )
}

function toPersianDigits(value) {
  return String(value ?? '').replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit])
}

function initialsOf(name = '') {
  const parts = String(name).trim().split(/\s+/)
  if (!parts[0]) return '؟'
  return parts.length > 1 ? `${parts[0][0]}\u200c${parts[1][0]}` : parts[0].slice(0, 2)
}

// Core's upload-policy default (Uploads.MaxFileSizeKb) is 200KB; avatars are stored as a data
// URL on the user record, so the file is resized/compressed client-side to fit under that.
const AVATAR_MAX_BYTES = 200 * 1024

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Resizes an image into a square canvas and re-encodes it as JPEG, shrinking until it fits. */
async function compressImageToDataUrl(file, maxSide = 220, quality = 0.8) {
  const original = await readFileAsDataUrl(file)
  const image = await new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = original
  })
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d')
  // JPEG has no alpha: without a backdrop, transparent PNG areas would come out black.
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
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
// Same label as the «ارتباطات و سیستم» submenu's «تنظیمات» entry, so the topbar's profile
// button and the sidebar both land on the one settings page.
const userProfileLabel = 'تنظیمات'
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
      ; (async () => {
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
      ; (async () => {
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
      ; (async () => {
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

function UserSelect({ data, value, onChange, required = false, users }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">انتخاب نشده</option>
      {(users || data.users).map((item) => <option key={item.id} value={item.id}>{item.displayName || item.email}</option>)}
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

const editTitles = {
  risk: 'ویرایش ریسک',
  stakeholder: 'ویرایش ذینفع',
  member: 'ویرایش نقش عضو پروژه',
  governance: 'ویرایش نقش حاکمیتی',
}

// The form of an existing record (risks, stakeholders, team members and governance roles can be edited).
const editInitialState = (kind, item) => ({
  risk: { description: item.description || '', probabilityScore: String(item.probabilityScore), severityScore: String(item.severityScore), impactScore: String(item.impactScore), responsePlan: item.responsePlan || '', riskOwnerUserId: item.riskOwnerUserId || '' },
  stakeholder: { name: item.name || '', isInternal: String(Boolean(item.isInternal)), expectations: item.expectations || '', notes: item.notes || '', power: String(item.power), interest: String(item.interest), engagementStrategy: item.engagementStrategy || '', requirements: item.requirements || '' },
  member: { userId: item.userId, roleTitle: item.roleTitle || '' },
  governance: { title: item.title || '', userId: item.userId || '', personnelNumber: item.personnelNumber || '', phone: item.phone || '', email: item.email || '', serviceLocation: item.serviceLocation || '' },
}[kind])

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

function CreateProjectItemModal({ kind, data, item = null, onClose }) {
  const [form, setForm] = useState(() => (item ? editInitialState(kind, item) : creationInitialState(kind, data)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [teamCandidates, setTeamCandidates] = useState(null)
  const selectedProjectId = data.selectedProjectId
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  // A new team member is picked from the users the Core allows on this project's team (not everyone already on it).
  useEffect(() => {
    if (kind !== 'member' || item) return undefined
    let cancelled = false
    projectManagementApi.availableTeamUsers(selectedProjectId).then((result) => {
      if (cancelled) return
      const onTeam = new Set(data.teamMembers.map((member) => member.userId))
      setTeamCandidates((result.isSuccess ? arrayPayload(result) : data.users).filter((person) => !onTeam.has(person.id)))
    })
    return () => { cancelled = true }
  }, [kind, item, selectedProjectId])

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
      risk: () => {
        const fields = {
          description: form.description.trim(),
          probabilityScore: Number(form.probabilityScore),
          severityScore: Number(form.severityScore),
          impactScore: Number(form.impactScore),
          responsePlan: emptyToNull(form.responsePlan.trim()),
          riskOwnerUserId: emptyToNull(form.riskOwnerUserId),
        }
        return item ? projectManagementApi.updateRisk(item.id, fields) : projectManagementApi.createRisk({ ...base, ...fields })
      },
      stakeholder: () => {
        const fields = {
          name: form.name.trim(),
          isInternal: form.isInternal === 'true',
          expectations: emptyToNull(form.expectations.trim()),
          notes: emptyToNull(form.notes.trim()),
          power: Number(form.power),
          interest: Number(form.interest),
          engagementStrategy: emptyToNull(form.engagementStrategy.trim()),
          requirements: emptyToNull(form.requirements.trim()),
        }
        return item ? projectManagementApi.updateStakeholder(item.id, fields) : projectManagementApi.createStakeholder({ ...base, ...fields })
      },
      member: () => (item
        ? projectManagementApi.updateTeamMember(item.id, { roleTitle: emptyToNull(form.roleTitle.trim()) })
        : projectManagementApi.addTeamMember({ ...base, userId: form.userId, roleTitle: emptyToNull(form.roleTitle.trim()) })),
      governance: () => {
        const fields = {
          title: form.title.trim(),
          userId: emptyToNull(form.userId),
          personnelNumber: emptyToNull(form.personnelNumber.trim()),
          phone: emptyToNull(form.phone.trim()),
          email: emptyToNull(form.email.trim()),
          serviceLocation: emptyToNull(form.serviceLocation.trim()),
        }
        return item ? projectManagementApi.updateGovernanceRole(item.id, fields) : projectManagementApi.createGovernanceRole({ ...base, ...fields })
      },
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
    <ModalPortal><div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <form className="ue-modal pm-modal" onSubmit={submit}>
          <header className="ue-head">
            <div className="ue-head-title"><strong>{item ? editTitles[kind] : creationTitles[kind]}</strong><small>{kind === 'project' ? 'ثبت در Projects API' : projectDisplayName(data.selectedProject)}</small></div>
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
              <FormField label="احتمال وقوع"><select value={form.probabilityScore} onChange={(event) => set('probabilityScore', event.target.value)}>{riskScoreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
              <FormField label="اثر"><select value={form.impactScore} onChange={(event) => set('impactScore', event.target.value)}>{riskScoreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
              <FormField label="شدت"><select value={form.severityScore} onChange={(event) => set('severityScore', event.target.value)}>{riskScoreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
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
              <FormField label="نیازمندی‌ها" wide><textarea rows="2" value={form.requirements} onChange={(event) => set('requirements', event.target.value)} /></FormField>
              <FormField label="راهبرد تعامل (اختیاری)" wide><textarea rows="2" value={form.engagementStrategy} onChange={(event) => set('engagementStrategy', event.target.value)} placeholder="خالی بماند تا راهبرد پیش‌فرض ربع او نمایش داده شود" /></FormField>
              <FormField label="یادداشت" wide><textarea rows="2" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></FormField>
            </>}
            {kind === 'member' && <>
              <FormField label="کاربر">{item ? <input value={data.userName(item.userId)} disabled readOnly /> : <UserSelect data={data} users={teamCandidates || []} value={form.userId} onChange={(value) => set('userId', value)} required />}</FormField>
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
            <div className="ue-foot-actions"><button className="ue-cancel" type="button" onClick={onClose}>انصراف</button><button className="ue-save" type="submit" disabled={busy}>{busy ? 'در حال ذخیره...' : item ? 'ذخیره تغییرات' : 'ذخیره'}</button></div>
          </footer>
        </form>
    </div></ModalPortal>
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

function TaskPageHeader({ title, description, action = 'ایجاد وظیفه جدید', actionNode, children, section = 'مدیریت وظایف' }) {
  return (
    <div className="task-page-header">
      <div><span>{section} / {title}</span><h1>{title}</h1><p>{description}</p></div>
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
  return <><TaskPageHeader title="تقویم پروژه" description="تقویم موعد وظایف؛ Core هنوز endpoint رویداد پروژه مستقل ندارد" action={null}><ProjectSelector data={data} /></TaskPageHeader><div className="calendar-toolbar"><button>امروز</button><div><ChevronLeft size={18} /><strong>{today.toLocaleDateString('fa-IR', { month: 'long', year: 'numeric' })}</strong><ChevronLeft className="flip" size={18} /></div></div><DataState loading={data.loading} error={data.error} empty={!data.tasks.length}><section className="calendar-card"><div className="calendar-weekdays">{['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{cells.map((day, index) => <div className={day === today.getDate() ? 'today' : ''} key={index}>{day && <b>{day.toLocaleString('fa-IR')}</b>}{(byDay[day] || []).slice(0, 3).map((task) => <span className={`event ${task.priority === 'بالا' || task.priority === 'بحرانی' ? 'gold' : task.status === 'تکمیل شده' ? 'green' : 'blue'}`} key={task.id}>{task.title}</span>)}</div>)}</div></section></DataState></>
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
  const flows = [['گردش کار وظایف اجرایی', 'پیش‌نویس، در حال انجام، بازبینی، تأیید نهایی', '۳ پروژه', 'فعال'], ['فرآیند بررسی مستندات', 'ثبت، بررسی کارشناس، اصلاح، تأیید مدیر', '۲ پروژه', 'فعال'], ['الگوی درخواست تغییر', 'ثبت درخواست، ارزیابی اثر، کمیته تغییر، اجرا', 'تمام پروژه‌ها', 'پیش‌نویس']]
  return <><TaskPageHeader title="گردش کار و الگوها" description="تعریف مراحل و قوانین گردش وظایف به تفکیک پروژه" action={null} /><section className="workflow-help"><Workflow size={28} /><div><h3>فرآیندهای کاری را با پروژه خود هماهنگ کنید</h3><p>وضعیت‌ها، مسئول هر مرحله و قوانین انتقال را بدون نیاز به کدنویسی تعریف کنید.</p></div><button>راهنمای طراحی گردش کار</button></section><div className="workflow-grid">{flows.map(([title, steps, projects, status], index) => <article key={title}><header><span className={`workflow-icon tone-${index}`}><Workflow size={20} /></span><MoreHorizontal size={18} /></header><h3>{title}</h3><p>{steps}</p><div className="flow-steps">{[1, 2, 3, 4].map((step) => <i key={step} />)}</div><footer><span>{projects}</span><StatusPill status={status === 'فعال' ? 'تکمیل شده' : 'برای انجام'} /></footer></article>)}</div></>
}

function RaciMatrix({ data }) {
  const people = data.governanceRoles.length ? data.governanceRoles : data.teamMembers.map((member) => ({ id: member.id, title: member.roleTitle || 'عضو تیم', userId: member.userId }))
  const rows = [...data.activities, ...data.deliverables].slice(0, 8)
  return <><TaskPageHeader title="ماتریس مسئولیت‌ها (RACI)" description="Core نقش‌های حاکمیتی دارد، ولی RACI واقعی به‌عنوان endpoint مستقل ندارد" actionNode={<CreateButton kind="activity" data={data} label="افزودن فعالیت" />}><ProjectSelector data={data} /></TaskPageHeader><div className="raci-legend"><span><i className="r">R</i>مسئول اجرا</span><span><i className="a">A</i>پاسخگو</span><span><i className="c">C</i>مشاور</span><span><i className="i">I</i>مطلع</span></div><section className="task-panel raci-table"><DataState loading={data.loading || data.loadingDetails} error={data.error} empty={!rows.length || !people.length}><div className="table-scroll"><table><thead><tr><th>فعالیت / خروجی</th>{people.slice(0, 5).map((person) => <th key={person.id}><span className="person-head"><i>{initialsOf(data.userName(person.userId)).slice(0, 1)}</i>{data.userName(person.userId)}<small>{person.title}</small></span></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name || row.title || row.description || row.id}</strong></td>{people.slice(0, 5).map((person, index) => <td key={person.id}><span className={`raci-role ${index === 0 ? 'a' : row.responsibleUserId === person.userId ? 'r' : index === 1 ? 'c' : 'i'}`}>{index === 0 ? 'A' : row.responsibleUserId === person.userId ? 'R' : index === 1 ? 'C' : 'I'}</span></td>)}</tr>)}</tbody></table></div></DataState></section></>
}

/* ------------------------------------------------------------------ *
 * «کنترل و اجرا» - risks, stakeholders and project resources, with     *
 * everything the Core offers for them (create / edit / delete, the     *
 * approval round, response reports, matrices and project settings).    *
 * ------------------------------------------------------------------ */

const approvalClass = { 0: 'todo', 1: 'review', 2: 'done', 3: 'rejected' }

function ApprovalBadge({ status }) {
  return <span className={`status-pill ${approvalClass[status] ?? 'todo'}`}>{enumLabel(status, approvalLabels)}</span>
}

function PageNotice({ notice, onClose }) {
  if (!notice) return null
  return (
    <div className={`users-notice ctl-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
      <span>{notice.text}</span>
      <button type="button" onClick={onClose} aria-label="بستن"><X size={15} /></button>
    </div>
  )
}

function ControlKpis({ items }) {
  return (
    <div className="task-kpis ctl-kpis">
      {items.map(({ icon: Icon, tone, label, value, note }) => (
        <article key={label}><span className={`task-kpi-icon ${tone}`}><Icon size={21} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>
      ))}
    </div>
  )
}

/** Runs a Core call, then tells the page how it went and reloads the project's data. */
async function runAction(call, successText, setNotice, refresh) {
  const result = await call()
  if (!result.isSuccess) { setNotice({ type: 'error', text: PersianMessages.error(result.error) }); return false }
  setNotice({ type: 'success', text: successText })
  refresh()
  return true
}

/* ---- Risks ---- */

const riskResponseLabels = { 0: 'در حال برنامه‌ریزی', 1: 'در حال اجرا', 2: 'متوقف', 3: 'تکمیل شده' }
const riskLevelLabels = { green: 'کم', yellow: 'متوسط', red: 'بحرانی' }
const riskBandLabels = { low: 'کم', medium: 'متوسط', high: 'زیاد' }
const riskScoreOptions = [[1, '۱ - خیلی کم'], [2, '۲ - کم'], [3, '۳ - متوسط'], [4, '۴ - زیاد'], [5, '۵ - خیلی زیاد']]
const riskBand = (score) => (score <= 2 ? 'low' : score === 3 ? 'medium' : 'high')
// What the Core uses until a project words its own matrix: probability band, then impact band.
const DEFAULT_MATRIX_COLORS = {
  'low-low': 'green', 'low-medium': 'green', 'low-high': 'yellow',
  'medium-low': 'green', 'medium-medium': 'yellow', 'medium-high': 'red',
  'high-low': 'yellow', 'high-medium': 'red', 'high-high': 'red',
}

function RisksPage({ data }) {
  const { can } = useAuth()
  const rights = { create: can('Risks.Create'), edit: can('Risks.Edit'), remove: can('Risks.Delete'), submit: can('Risks.Submit'), respond: can('RiskResponse.Submit') }
  const [settings, setSettings] = useState(null)
  const [settingsKey, setSettingsKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [responseOf, setResponseOf] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [cell, setCell] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSettings(null)
    setCell(null)
    if (!data.selectedProjectId) return undefined
    projectManagementApi.riskSettings(data.selectedProjectId).then((result) => { if (!cancelled) setSettings(unwrap(result)) })
    return () => { cancelled = true }
  }, [data.selectedProjectId, settingsKey])

  const colorOf = (probability, impact) => {
    const key = `${riskBand(probability)}-${riskBand(impact)}`
    const found = settings?.matrixColors?.find((item) => `${item.probability}-${item.impact}` === key)
    return found?.color || DEFAULT_MATRIX_COLORS[key]
  }

  const risks = data.risks
  const total = risks.length
  const critical = risks.filter((risk) => risk.level === 'red').length
  const averageRpn = total ? Math.round(risks.reduce((sum, risk) => sum + Number(risk.rpn || 0), 0) / total) : 0
  const inProgress = risks.filter((risk) => risk.responseStatus === 1).length
  const countAt = (probability, impact) => risks.filter((risk) => risk.probabilityScore === probability && risk.impactScore === impact).length

  const term = search.trim().toLowerCase()
  const shown = risks.filter((risk) => (
    (!levelFilter || risk.level === levelFilter)
    && (!cell || (risk.probabilityScore === cell.probability && risk.impactScore === cell.impact))
    && (!term || `${risk.description} ${risk.responsePlan || ''} ${data.userName(risk.riskOwnerUserId)}`.toLowerCase().includes(term))
  ))

  const changeResponse = (risk, status) => runAction(() => projectManagementApi.setRiskResponseStatus(risk.id, Number(status)), 'وضعیت پاسخ ریسک ذخیره شد.', setNotice, data.refresh)
  const submitForApproval = (risk) => runAction(() => projectManagementApi.submitRisk(risk.id), 'ریسک برای تأیید ارسال شد.', setNotice, data.refresh)
  const remove = (risk) => {
    if (!window.confirm('این ریسک حذف شود؟')) return
    runAction(() => projectManagementApi.deleteRisk(risk.id), 'ریسک حذف شد.', setNotice, data.refresh)
  }

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا"
        title="مدیریت ریسک"
        description="ثبت، ارزیابی و پیگیری ریسک‌های پروژه با ماتریس احتمال و اثر"
        actionNode={(
          <>
            {rights.edit && <button type="button" className="ctl-ghost" onClick={() => setSettingsOpen(true)} disabled={!data.selectedProjectId || !settings}><SlidersHorizontal size={17} />تنظیمات ریسک</button>}
            {rights.create && <CreateButton kind="risk" data={data} label="ثبت ریسک" disabled={!data.selectedProjectId} />}
          </>
        )}
      >
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        <ControlKpis items={[
          { icon: TriangleAlert, tone: 'navy', label: 'کل ریسک‌ها', value: toPersianDigits(total), note: 'در پروژه‌ی انتخاب‌شده' },
          { icon: CircleAlert, tone: 'red', label: 'ریسک‌های بحرانی', value: toPersianDigits(critical), note: 'سطح قرمز ماتریس' },
          { icon: ChartNoAxesCombined, tone: 'blue', label: 'میانگین RPN', value: toPersianDigits(averageRpn), note: 'احتمال × شدت × اثر' },
          { icon: Clock3, tone: 'green', label: 'پاسخ در حال اجرا', value: toPersianDigits(inProgress), note: 'برنامه‌ی پاسخ فعال' },
        ]} />

        <section className="ctl-grid">
          <div className="task-panel ctl-panel">
            <div className="task-panel-title"><div><h3>ماتریس ریسک</h3><p>برای فیلتر کردن جدول، روی یک خانه بزنید.</p></div>{cell && <button type="button" className="ctl-link" onClick={() => setCell(null)}>حذف فیلتر</button>}</div>
            <div className="ctl-matrix-body">
            <div className="rm-wrap">
              <span className="rm-axis rm-axis-y">احتمال</span>
              <div className="rm-grid">
                {[5, 4, 3, 2, 1].map((probability) => (
                  <div className="rm-row" key={probability}>
                    <b className="rm-label">{toPersianDigits(probability)}</b>
                    {[1, 2, 3, 4, 5].map((impact) => {
                      const count = countAt(probability, impact)
                      const active = cell?.probability === probability && cell?.impact === impact
                      return (
                        <button
                          type="button" key={impact}
                          className={`rm-cell ${colorOf(probability, impact)}${active ? ' active' : ''}${count ? ' has' : ''}`}
                          title={`احتمال ${toPersianDigits(probability)} × اثر ${toPersianDigits(impact)}: ${toPersianDigits(count)} ریسک`}
                          onClick={() => setCell(active ? null : { probability, impact })}
                        >{count ? toPersianDigits(count) : ''}</button>
                      )
                    })}
                  </div>
                ))}
                <div className="rm-row rm-foot"><b className="rm-label" />{[1, 2, 3, 4, 5].map((impact) => <b className="rm-label" key={impact}>{toPersianDigits(impact)}</b>)}</div>
              </div>
              <span className="rm-axis rm-axis-x">اثر</span>
            </div>
            <div className="ctl-matrix-info">
            <div className="rm-legend">
              {['green', 'yellow', 'red'].map((color) => <span key={color}><i className={`rm-dot ${color}`} />{riskLevelLabels[color]}</span>)}
              {settings?.isDefault === false && <em>تنظیم اختصاصی پروژه</em>}
            </div>
            {settings?.definitions?.length > 0 && (
              <details className="rm-defs">
                <summary>تعریف سطح‌ها</summary>
                {['probability', 'impact'].map((axis) => (
                  <div key={axis}>
                    <h5>{axis === 'probability' ? 'احتمال' : 'اثر'}</h5>
                    <ul>{settings.definitions.filter((item) => item.axis === axis).map((item) => <li key={item.level}><b>{riskBandLabels[item.level]}</b> <small>({item.range})</small> {item.description}</li>)}</ul>
                  </div>
                ))}
              </details>
            )}
            </div>
            </div>
          </div>

          <div className="task-panel task-table-panel ctl-panel ctl-table-panel">
            <div className="task-panel-title">
              <div><h3>فهرست ریسک‌ها</h3><p>{toPersianDigits(shown.length)} از {toPersianDigits(total)} ریسک</p></div>
              <div className="ctl-filters">
                <label className="ctl-search"><Search size={15} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در ریسک‌ها..." /></label>
                <select className="ctl-select" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} aria-label="سطح ریسک">
                  <option value="">همه‌ی سطح‌ها</option>
                  <option value="red">بحرانی</option><option value="yellow">متوسط</option><option value="green">کم</option>
                </select>
              </div>
            </div>
            <DataState loading={data.loadingDetails} empty={!shown.length}>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>ریسک</th><th>احتمال</th><th>اثر</th><th>شدت</th><th>RPN</th><th>وضعیت پاسخ</th><th>تأیید</th><th>عملیات</th></tr></thead>
                  <tbody>
                    {shown.map((risk) => (
                      <tr key={risk.id}>
                        <td className="ctl-main">
                          <strong>{risk.description}</strong>
                          <small>مالک: {data.userName(risk.riskOwnerUserId)}{risk.responsePlan ? ` · پاسخ: ${risk.responsePlan}` : ''}</small>
                        </td>
                        <td>{toPersianDigits(risk.probabilityScore)}</td>
                        <td>{toPersianDigits(risk.impactScore)}</td>
                        <td>{toPersianDigits(risk.severityScore)}</td>
                        <td><span className={`level-pill ${risk.level}`} title={riskLevelLabels[risk.level]}>{toPersianDigits(risk.rpn)}</span></td>
                        <td>
                          {rights.edit && risk.approvalStatus === 2
                            ? <select className="ctl-select" value={risk.responseStatus} onChange={(e) => changeResponse(risk, e.target.value)} aria-label="وضعیت پاسخ">{Object.entries(riskResponseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                            : <span title={risk.approvalStatus === 2 ? '' : 'وضعیت پاسخ پس از تأیید ریسک قابل تغییر است.'}>{enumLabel(risk.responseStatus, riskResponseLabels)}</span>}
                        </td>
                        <td><ApprovalBadge status={risk.approvalStatus} /></td>
                        <td>
                          <span className="row-actions">
                            {rights.edit && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setEditing(risk)}><Pencil size={15} /></button>}
                            <button type="button" title="گزارش‌های پاسخ به ریسک" aria-label="گزارش‌های پاسخ" onClick={() => setResponseOf(risk)}><MessageSquareText size={15} /></button>
                            {rights.submit && (risk.approvalStatus === 0 || risk.approvalStatus === 3) && <button type="button" className="ok" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => submitForApproval(risk)}><Send size={15} /></button>}
                            {rights.remove && <button type="button" className="danger" title="حذف" aria-label="حذف" disabled={risk.approvalStatus === 1} onClick={() => remove(risk)}><Trash2 size={15} /></button>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataState>
          </div>
        </section>
      </DataState>

      {editing && <CreateProjectItemModal kind="risk" item={editing} data={data} onClose={() => setEditing(null)} />}
      {responseOf && (
        <RiskResponseDialog
          risk={responseOf} data={data} canSubmit={rights.respond && responseOf.approvalStatus === 2}
          onClose={() => setResponseOf(null)}
          onSaved={(result) => { setResponseOf(null); setNotice(result); data.refresh() }}
        />
      )}
      {settingsOpen && settings && (
        <RiskSettingsDialog
          settings={settings} data={data}
          onClose={() => setSettingsOpen(false)}
          onSaved={(result) => { setSettingsOpen(false); setNotice(result); setSettingsKey((key) => key + 1) }}
        />
      )}
    </>
  )
}

/* Reports on how the answer to one risk is going. The Core takes them only for an approved risk,
   and a report waits for verification before it changes the risk's response status. */
function RiskResponseDialog({ risk, data, canSubmit, onClose, onSaved }) {
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState(String(risk.responseStatus ?? 0))
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    projectManagementApi.riskResponseSubmissions(risk.id).then((result) => {
      if (cancelled) return
      if (!result.isSuccess) setError(PersianMessages.error(result.error))
      setItems(arrayPayload(result))
    })
    return () => { cancelled = true }
  }, [risk.id, reloadKey])

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const result = await projectManagementApi.submitRiskResponse({ tenantId: data.tenantId, riskId: risk.id, status: Number(status), comment: emptyToNull(comment.trim()) })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setComment('')
    setReloadKey((key) => key + 1)
    onSaved({ type: 'success', text: 'گزارش پاسخ ثبت شد.' })
  }

  return (
    <UserDialog
      size="sm" icon={MessageSquareText} title="گزارش‌های پاسخ به ریسک" subtitle={risk.description}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={onClose}>بستن</button>
            {canSubmit && <button type="submit" form="risk-response-form" className="ue-save" disabled={saving}>{saving ? 'در حال ثبت...' : 'ثبت گزارش'}</button>}
          </div>
        </>
      )}
    >
      {canSubmit ? (
        <form id="risk-response-form" onSubmit={submit} className="ue-card ue-card--accent">
          <h5 className="ue-card-title">گزارش تازه</h5>
          <div className="ue-grid">
            <Field label="وضعیت پاسخ" required><select value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(riskResponseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
            <Field label="توضیح" wide><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></Field>
          </div>
        </form>
      ) : (
        <p className="ue-note">{risk.approvalStatus === 2 ? 'برای ثبت گزارش، دسترسی «ثبت گزارش پاسخ ریسک» لازم است.' : 'گزارش پاسخ فقط برای ریسکِ تأییدشده ثبت می‌شود.'}</p>
      )}
      <section className="ue-section ue-section--first">
        <h4><History size={16} />سابقه‌ی گزارش‌ها</h4>
        {items === null ? <p className="users-empty"><LoaderCircle size={18} className="spin" /></p>
          : !items.length ? <p className="ue-note">هنوز گزارشی ثبت نشده است.</p>
            : (
              <ul className="ctl-timeline">
                {items.map((item) => (
                  <li key={item.id}>
                    <div><strong>{enumLabel(item.previousStatus, riskResponseLabels)} ← {enumLabel(item.submittedStatus, riskResponseLabels)}</strong><ApprovalBadge status={item.approvalStatus} /></div>
                    {item.comment && <p>{item.comment}</p>}
                    <small>{data.userName(item.submittedByUserId)} · {formatDateTime(item.submittedAtUtc)}</small>
                  </li>
                ))}
              </ul>
            )}
      </section>
    </UserDialog>
  )
}

/* How a project words its six bands and colours its 3x3 matrix. */
function RiskSettingsDialog({ settings, data, onClose, onSaved }) {
  const [definitions, setDefinitions] = useState(() => settings.definitions.map((item) => ({ ...item })))
  const [colors, setColors] = useState(() => {
    const map = {}
    for (const probability of ['low', 'medium', 'high']) for (const impact of ['low', 'medium', 'high']) {
      map[`${probability}-${impact}`] = settings.matrixColors.find((item) => item.probability === probability && item.impact === impact)?.color || DEFAULT_MATRIX_COLORS[`${probability}-${impact}`]
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setDefinition = (axis, level, key, value) => setDefinitions((current) => current.map((item) => (item.axis === axis && item.level === level ? { ...item, [key]: value } : item)))

  async function save(reset) {
    if (!reset && definitions.some((item) => !item.range.trim() || !item.description.trim())) { setError('برای هر سطح، بازه و توضیح را بنویسید.'); return }
    setSaving(true)
    setError('')
    const result = await projectManagementApi.saveRiskSettings({
      tenantId: data.tenantId,
      projectId: data.selectedProjectId,
      definitions: reset ? [] : definitions.map((item) => ({ ...item, range: item.range.trim(), description: item.description.trim() })),
      matrixColors: reset ? [] : Object.entries(colors).map(([key, color]) => { const [probability, impact] = key.split('-'); return { probability, impact, color } }),
    })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: reset ? 'تنظیمات ریسک به حالت پیش‌فرض برگشت.' : 'تنظیمات ریسک ذخیره شد.' })
  }

  return (
    <UserDialog
      icon={SlidersHorizontal} title="تنظیمات ریسک پروژه" subtitle={projectDisplayName(data.selectedProject)}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={() => save(true)} disabled={saving || settings.isDefault}><RotateCcw size={14} /> پیش‌فرض</button>
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="button" className="ue-save" onClick={() => save(false)} disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}</button>
          </div>
        </>
      )}
    >
      <section className="ue-section ue-section--first">
        <h4><ChartNoAxesCombined size={16} />تعریف سطح‌ها</h4>
        <p className="ue-note">هر پروژه می‌تواند بازه و توضیح سطح‌های کم، متوسط و زیاد را به زبان خودش بنویسد.</p>
        {['probability', 'impact'].map((axis) => (
          <div className="ue-card" key={axis}>
            <h5 className="ue-card-title">{axis === 'probability' ? 'احتمال' : 'اثر'}</h5>
            {['high', 'medium', 'low'].map((level) => {
              const item = definitions.find((d) => d.axis === axis && d.level === level)
              return (
                <div className="ctl-def-row" key={level}>
                  <b>{riskBandLabels[level]}</b>
                  <input value={item.range} onChange={(e) => setDefinition(axis, level, 'range', e.target.value)} maxLength={80} aria-label="بازه" />
                  <input value={item.description} onChange={(e) => setDefinition(axis, level, 'description', e.target.value)} maxLength={400} aria-label="توضیح" />
                </div>
              )
            })}
          </div>
        ))}
      </section>
      <section className="ue-section">
        <h4><Grid3x3 size={16} />رنگ خانه‌های ماتریس</h4>
        <p className="ue-note">رنگ هر ترکیب احتمال × اثر. ماتریس بالای صفحه و رنگ سطح هر ریسک از همین‌جا می‌آید.</p>
        <div className="ctl-color-grid">
          <span />{['low', 'medium', 'high'].map((impact) => <b key={impact}>اثر {riskBandLabels[impact]}</b>)}
          {['high', 'medium', 'low'].map((probability) => (
            <Fragment key={probability}>
              <b>احتمال {riskBandLabels[probability]}</b>
              {['low', 'medium', 'high'].map((impact) => (
                <select key={impact} className={`ctl-color ${colors[`${probability}-${impact}`]}`} value={colors[`${probability}-${impact}`]} onChange={(e) => setColors((current) => ({ ...current, [`${probability}-${impact}`]: e.target.value }))} aria-label={`احتمال ${riskBandLabels[probability]} و اثر ${riskBandLabels[impact]}`}>
                  <option value="green">سبز</option><option value="yellow">زرد</option><option value="red">قرمز</option>
                </select>
              ))}
            </Fragment>
          ))}
        </div>
      </section>
    </UserDialog>
  )
}

/* ---- Stakeholders ---- */

const stakeholderQuadrantLabels = { 0: 'پایش', 1: 'مطلع نگه داشتن', 2: 'راضی نگه داشتن', 3: 'مدیریت دقیق' }
const stakeholderQuadrantKeys = { 0: 'monitor', 1: 'keepInformed', 2: 'keepSatisfied', 3: 'manageClosely' }
// "High" is the high side of an axis; Medium and Low are the low side.
const stakeholderQuadrantOf = (power, interest) => (power === 2 ? (interest === 2 ? 3 : 2) : (interest === 2 ? 1 : 0))
const stakeholderLevels = [[0, 'کم'], [1, 'متوسط'], [2, 'زیاد']]

function StakeholdersPage({ data }) {
  const { can } = useAuth()
  const rights = { create: can('Stakeholders.Create'), edit: can('Stakeholders.Edit'), remove: can('Stakeholders.Delete'), submit: can('Stakeholders.Submit') }
  const [settings, setSettings] = useState(null)
  const [settingsKey, setSettingsKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [cell, setCell] = useState(null)

  useEffect(() => {
    let cancelled = false
    setSettings(null)
    setCell(null)
    if (!data.selectedProjectId) return undefined
    projectManagementApi.stakeholderSettings(data.selectedProjectId).then((result) => { if (!cancelled) setSettings(unwrap(result)) })
    return () => { cancelled = true }
  }, [data.selectedProjectId, settingsKey])

  const items = data.stakeholders
  const manage = items.filter((item) => stakeholderQuadrantOf(item.power, item.interest) === 3).length
  const internal = items.filter((item) => item.isInternal).length
  const term = search.trim().toLowerCase()
  const shown = items.filter((item) => (
    (!cell || (item.power === cell.power && item.interest === cell.interest))
    && (!term || `${item.name} ${item.expectations || ''} ${item.engagementStrategy || ''}`.toLowerCase().includes(term))
  ))
  const wording = (quadrant) => settings?.[stakeholderQuadrantKeys[quadrant]] || ''

  const submitForApproval = (item) => runAction(() => projectManagementApi.submitStakeholder(item.id), 'ذینفع برای تأیید ارسال شد.', setNotice, data.refresh)
  const remove = (item) => {
    if (!window.confirm(`ذینفع «${item.name}» حذف شود؟`)) return
    runAction(() => projectManagementApi.deleteStakeholder(item.id), 'ذینفع حذف شد.', setNotice, data.refresh)
  }

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا"
        title="مدیریت ذینفعان"
        description="شناسایی ذینفعان پروژه و تعیین راهبرد تعامل با هر یک بر اساس قدرت و علاقه"
        actionNode={(
          <>
            {rights.edit && <button type="button" className="ctl-ghost" onClick={() => setSettingsOpen(true)} disabled={!data.selectedProjectId || !settings}><SlidersHorizontal size={17} />راهبردهای تعامل</button>}
            {rights.create && <CreateButton kind="stakeholder" data={data} label="ثبت ذینفع" disabled={!data.selectedProjectId} />}
          </>
        )}
      >
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        <ControlKpis items={[
          { icon: Handshake, tone: 'navy', label: 'کل ذینفعان', value: toPersianDigits(items.length), note: 'در پروژه‌ی انتخاب‌شده' },
          { icon: Target, tone: 'red', label: 'مدیریت دقیق', value: toPersianDigits(manage), note: 'قدرت و علاقه‌ی زیاد' },
          { icon: Building2, tone: 'blue', label: 'داخلی', value: toPersianDigits(internal), note: 'درون سازمان' },
          { icon: Users, tone: 'green', label: 'خارجی', value: toPersianDigits(items.length - internal), note: 'بیرون از سازمان' },
        ]} />

        <section className="ctl-grid">
          <div className="task-panel ctl-panel">
            <div className="task-panel-title"><div><h3>ماتریس قدرت و علاقه</h3><p>برای فیلتر کردن جدول، روی یک خانه بزنید.</p></div>{cell && <button type="button" className="ctl-link" onClick={() => setCell(null)}>حذف فیلتر</button>}</div>
            <div className="ctl-matrix-body">
            <div className="rm-wrap sm-wrap">
              <span className="rm-axis rm-axis-y">قدرت</span>
              <div className="rm-grid sm-grid">
                {[2, 1, 0].map((power) => (
                  <div className="rm-row" key={power}>
                    <b className="rm-label">{stakeholderLevels[power][1]}</b>
                    {[0, 1, 2].map((interest) => {
                      const here = items.filter((item) => item.power === power && item.interest === interest)
                      const active = cell?.power === power && cell?.interest === interest
                      const quadrant = stakeholderQuadrantOf(power, interest)
                      return (
                        <button
                          type="button" key={interest}
                          className={`sm-cell q${quadrant}${active ? ' active' : ''}${here.length ? ' has' : ''}`}
                          title={`${stakeholderQuadrantLabels[quadrant]}: ${toPersianDigits(here.length)} ذینفع`}
                          onClick={() => setCell(active ? null : { power, interest })}
                        >
                          {here.slice(0, 3).map((item) => <span key={item.id}>{item.name}</span>)}
                          {here.length > 3 && <em>+{toPersianDigits(here.length - 3)}</em>}
                        </button>
                      )
                    })}
                  </div>
                ))}
                <div className="rm-row rm-foot"><b className="rm-label" />{[0, 1, 2].map((interest) => <b className="rm-label" key={interest}>{stakeholderLevels[interest][1]}</b>)}</div>
              </div>
              <span className="rm-axis rm-axis-x">علاقه</span>
            </div>
            <div className="ctl-matrix-info">
            <ul className="sm-legend">
              {[3, 2, 1, 0].map((quadrant) => <li key={quadrant}><i className={`rm-dot q${quadrant}`} /><b>{stakeholderQuadrantLabels[quadrant]}</b>{wording(quadrant) && <small>{wording(quadrant)}</small>}</li>)}
            </ul>
            </div>
            </div>
          </div>

          <div className="task-panel task-table-panel ctl-panel ctl-table-panel">
            <div className="task-panel-title">
              <div><h3>فهرست ذینفعان</h3><p>{toPersianDigits(shown.length)} از {toPersianDigits(items.length)} ذینفع</p></div>
              <div className="ctl-filters"><label className="ctl-search"><Search size={15} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در ذینفعان..." /></label></div>
            </div>
            <DataState loading={data.loadingDetails} empty={!shown.length}>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>ذینفع</th><th>قدرت</th><th>علاقه</th><th>راهبرد</th><th>تأیید</th><th>عملیات</th></tr></thead>
                  <tbody>
                    {shown.map((item) => {
                      const quadrant = stakeholderQuadrantOf(item.power, item.interest)
                      return (
                        <tr key={item.id}>
                          <td className="ctl-main">
                            <strong>{item.name}<em className="ctl-tag">{item.isInternal ? 'داخلی' : 'خارجی'}</em></strong>
                            {item.expectations && <small>انتظارات: {item.expectations}</small>}
                          </td>
                          <td>{compactEnumLabel(item.power, stakeholderLevelLabels)}</td>
                          <td>{compactEnumLabel(item.interest, stakeholderLevelLabels)}</td>
                          <td className="ctl-main"><span className={`quad-pill q${quadrant}`}>{stakeholderQuadrantLabels[quadrant]}</span><small>{item.engagementStrategy || item.strategy || ''}</small></td>
                          <td><ApprovalBadge status={item.approvalStatus} /></td>
                          <td>
                            <span className="row-actions">
                              {rights.edit && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setEditing(item)}><Pencil size={15} /></button>}
                              {rights.submit && (item.approvalStatus === 0 || item.approvalStatus === 3) && <button type="button" className="ok" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => submitForApproval(item)}><Send size={15} /></button>}
                              {rights.remove && <button type="button" className="danger" title="حذف" aria-label="حذف" disabled={item.approvalStatus === 1} onClick={() => remove(item)}><Trash2 size={15} /></button>}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </DataState>
          </div>
        </section>
      </DataState>

      {editing && <CreateProjectItemModal kind="stakeholder" item={editing} data={data} onClose={() => setEditing(null)} />}
      {settingsOpen && settings && (
        <StakeholderSettingsDialog
          settings={settings} data={data}
          onClose={() => setSettingsOpen(false)}
          onSaved={(result) => { setSettingsOpen(false); setNotice(result); setSettingsKey((key) => key + 1) }}
        />
      )}
    </>
  )
}

/* The wording a project uses for each engagement quadrant; a blank text puts it back on the default. */
function StakeholderSettingsDialog({ settings, data, onClose, onSaved }) {
  const [form, setForm] = useState({ manageClosely: settings.manageClosely, keepSatisfied: settings.keepSatisfied, keepInformed: settings.keepInformed, monitor: settings.monitor })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const quadrants = [[3, 'manageClosely'], [2, 'keepSatisfied'], [1, 'keepInformed'], [0, 'monitor']]

  async function save(reset) {
    setSaving(true)
    setError('')
    const result = await projectManagementApi.saveStakeholderSettings({
      tenantId: data.tenantId, projectId: data.selectedProjectId,
      ...(reset ? { manageClosely: '', keepSatisfied: '', keepInformed: '', monitor: '' } : form),
    })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: reset ? 'راهبردها به حالت پیش‌فرض برگشت.' : 'راهبردهای تعامل ذخیره شد.' })
  }

  return (
    <UserDialog
      size="sm" icon={SlidersHorizontal} title="راهبردهای تعامل با ذینفعان" subtitle={projectDisplayName(data.selectedProject)}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={() => save(true)} disabled={saving || settings.isDefault}><RotateCcw size={14} /> پیش‌فرض</button>
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="button" className="ue-save" onClick={() => save(false)} disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </>
      )}
    >
      <p className="ue-note">این متن‌ها زیر هر ذینفع، بر اساس ربع قدرت و علاقه‌اش نمایش داده می‌شوند (مگر برای او راهبرد جداگانه نوشته شده باشد).</p>
      <div className="ue-card">
        <div className="ue-grid">
          {quadrants.map(([quadrant, key]) => (
            <Field key={key} label={stakeholderQuadrantLabels[quadrant]} wide>
              <textarea rows={2} value={form[key]} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} maxLength={400} />
            </Field>
          ))}
        </div>
      </div>
    </UserDialog>
  )
}

/* ---- Resources: the project team, who carries how much, and its governance roles ---- */

const taskDone = (task) => task.status === 2 || task.status === 'Done'

/** What each person of the selected project carries, from the work that names them as responsible. */
function buildWorkload(data) {
  const projectTasks = data.tasks.filter((task) => task.projectId === data.selectedProjectId)
  const onTeam = new Set(data.teamMembers.map((member) => member.userId))
  const roleOf = new Map(data.teamMembers.map((member) => [member.userId, member.roleTitle]))
  const rows = new Map()
  const rowOf = (userId) => {
    if (!rows.has(userId)) rows.set(userId, { userId, onTeam: onTeam.has(userId), roleTitle: roleOf.get(userId) || '', activities: 0, manHours: 0, tasksOpen: 0, tasksDone: 0, storyPoints: 0, deliverables: 0, risks: 0 })
    return rows.get(userId)
  }
  data.teamMembers.forEach((member) => rowOf(member.userId))
  let unassigned = { activities: 0, tasks: 0, deliverables: 0 }
  for (const activity of data.activities) {
    if (!activity.responsibleUserId) { unassigned.activities += 1; continue }
    const row = rowOf(activity.responsibleUserId)
    row.activities += 1
    row.manHours += Number(activity.manHours || 0)
  }
  for (const task of projectTasks) {
    if (!task.responsibleUserId) { unassigned.tasks += 1; continue }
    const row = rowOf(task.responsibleUserId)
    if (taskDone(task)) row.tasksDone += 1
    else { row.tasksOpen += 1; row.storyPoints += Number(task.storyPoints || 0) }
  }
  for (const deliverable of data.deliverables) {
    if (!deliverable.responsibleUserId) { unassigned.deliverables += 1; continue }
    rowOf(deliverable.responsibleUserId).deliverables += 1
  }
  for (const risk of data.risks) if (risk.riskOwnerUserId) rowOf(risk.riskOwnerUserId).risks += 1
  const list = [...rows.values()].sort((a, b) => (b.manHours - a.manHours) || ((b.tasksOpen + b.activities) - (a.tasksOpen + a.activities)))
  const load = (row) => row.manHours || row.tasksOpen + row.activities
  const maxLoad = Math.max(0, ...list.map(load))
  const totalManHours = list.reduce((sum, row) => sum + row.manHours, 0)
  return { list, unassigned, maxLoad, load, totalManHours, projectTasks }
}

function ResourcesPage({ data }) {
  const { can } = useAuth()
  const rights = { members: can('ProjectTeam.ManageMembers'), governance: can('ProjectTeam.ManageGovernance') }
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [teamOpen, setTeamOpen] = useState(false)

  const workload = useMemo(() => buildWorkload(data), [data.teamMembers, data.activities, data.tasks, data.deliverables, data.risks, data.selectedProjectId])
  const unassignedTotal = workload.unassigned.activities + workload.unassigned.tasks + workload.unassigned.deliverables
  const userOf = (userId) => data.users.find((item) => item.id === userId)

  const removeMember = (member) => {
    if (!window.confirm(`«${data.userName(member.userId)}» از تیم پروژه حذف شود؟`)) return
    runAction(() => projectManagementApi.removeTeamMember(member.id), 'عضو از تیم پروژه حذف شد.', setNotice, data.refresh)
  }
  const removeRole = (role) => {
    if (!window.confirm(`نقش «${role.title}» حذف شود؟`)) return
    runAction(() => projectManagementApi.deleteGovernanceRole(role.id), 'نقش حاکمیتی حذف شد.', setNotice, data.refresh)
  }
  const vacant = data.governanceRoles.filter((role) => !role.userId).length
  const hours = (value) => toPersianDigits(Math.round(value * 10) / 10)

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا"
        title="مدیریت منابع"
        description="اعضای تیم پروژه، بار کاری هر نفر و نقش‌های حاکمیتی"
        actionNode={(
          <>
            {rights.governance && <button type="button" className="ctl-ghost" onClick={() => setEditing({ kind: 'governance', item: null })} disabled={!data.selectedProjectId}><Plus size={17} />نقش حاکمیتی</button>}
            {rights.members && <button type="button" className="ctl-ghost" onClick={() => setTeamOpen(true)} disabled={!data.selectedProjectId}><UsersRound size={17} />تنظیم تیم</button>}
            {rights.members && <button type="button" onClick={() => setEditing({ kind: 'member', item: null })} disabled={!data.selectedProjectId}><Plus size={18} />افزودن عضو</button>}
          </>
        )}
      >
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        <ControlKpis items={[
          { icon: Users, tone: 'navy', label: 'اعضای تیم', value: toPersianDigits(data.teamMembers.length), note: 'در پروژه‌ی انتخاب‌شده' },
          { icon: Clock3, tone: 'blue', label: 'نفرساعت برنامه‌ریزی‌شده', value: hours(workload.totalManHours), note: 'مجموع فعالیت‌های دارای مسئول' },
          { icon: CircleAlert, tone: 'red', label: 'کار بدون مسئول', value: toPersianDigits(unassignedTotal), note: 'فعالیت، وظیفه و خروجی' },
          { icon: Shield, tone: 'green', label: 'نقش‌های حاکمیتی', value: toPersianDigits(data.governanceRoles.length), note: `${toPersianDigits(vacant)} نقش بدون فرد` },
        ]} />

        {unassignedTotal > 0 && (
          <div className="users-notice error ctl-notice" role="status">
            <CircleAlert size={16} />
            <span>
              کارهای بدون مسئول:
              {workload.unassigned.activities > 0 && ` ${toPersianDigits(workload.unassigned.activities)} فعالیت`}
              {workload.unassigned.tasks > 0 && ` ${toPersianDigits(workload.unassigned.tasks)} وظیفه`}
              {workload.unassigned.deliverables > 0 && ` ${toPersianDigits(workload.unassigned.deliverables)} خروجی`}
              . برای هر کدام مسئول تعیین کنید تا بار کاری درست دیده شود.
            </span>
          </div>
        )}

        <section className="task-panel task-table-panel ctl-panel ctl-block">
          <div className="task-panel-title"><div><h3>بار کاری اعضا</h3><p>بر اساس فعالیت‌ها، وظایف، خروجی‌ها و ریسک‌هایی که مسئولش هستند</p></div></div>
          <DataState loading={data.loadingDetails} empty={!workload.list.length}>
            <div className="table-scroll"><table>
              <thead><tr><th>عضو</th><th>فعالیت‌ها</th><th>نفرساعت</th><th>بار کاری</th><th>وظایف باز</th><th>انجام‌شده</th><th>خروجی‌ها</th><th>ریسک‌ها</th></tr></thead>
              <tbody>
                {workload.list.map((row) => {
                  const share = workload.maxLoad ? Math.round((workload.load(row) / workload.maxLoad) * 100) : 0
                  return (
                    <tr key={row.userId}>
                      <td className="ctl-main">
                        <span className="owner-cell"><i>{initialsOf(data.userName(row.userId)).slice(0, 1)}</i><strong>{data.userName(row.userId)}{!row.onTeam && <em className="ctl-tag ctl-tag--warn" title="مسئول کاری است ولی عضو تیم پروژه نیست">خارج از تیم</em>}</strong></span>
                        {row.roleTitle && <small>{row.roleTitle}</small>}
                      </td>
                      <td>{toPersianDigits(row.activities)}</td>
                      <td>{row.manHours ? hours(row.manHours) : '—'}</td>
                      <td className="ctl-bar-cell" title={`${toPersianDigits(share)}٪ نسبت به پرکارترین عضو`}><span className="ctl-bar"><i style={{ width: `${share}%` }} /></span></td>
                      <td>{toPersianDigits(row.tasksOpen)}{row.storyPoints > 0 && <small className="ctl-sp"> ({toPersianDigits(row.storyPoints)} امتیاز)</small>}</td>
                      <td>{toPersianDigits(row.tasksDone)}</td>
                      <td>{toPersianDigits(row.deliverables)}</td>
                      <td>{toPersianDigits(row.risks)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </DataState>
        </section>

        <section className="task-panel task-table-panel ctl-panel ctl-block">
          <div className="task-panel-title"><div><h3>اعضای تیم پروژه</h3><p>کسانی که روی این پروژه کار می‌کنند</p></div></div>
          <DataState loading={data.loadingDetails} empty={!data.teamMembers.length}>
            <div className="table-scroll"><table>
              <thead><tr><th>عضو</th><th>نقش در پروژه</th><th>ایمیل</th><th>موبایل</th><th>وضعیت حساب</th><th>عملیات</th></tr></thead>
              <tbody>
                {data.teamMembers.map((member) => {
                  const person = userOf(member.userId)
                  return (
                    <tr key={member.id}>
                      <td><span className="owner-cell"><i>{initialsOf(data.userName(member.userId)).slice(0, 1)}</i><strong>{data.userName(member.userId)}</strong></span></td>
                      <td>{member.roleTitle || '—'}</td>
                      <td className="ltr-cell">{person?.email || '—'}</td>
                      <td className="ltr-cell">{person?.phoneNumber ? toPersianDigits(person.phoneNumber) : '—'}</td>
                      <td>{person ? <span className={`user-status ${person.isActive ? 'active' : ''}`}><i />{person.isActive ? 'فعال' : 'غیرفعال'}</span> : '—'}</td>
                      <td>
                        {rights.members && (
                          <span className="row-actions">
                            <button type="button" title="ویرایش نقش" aria-label="ویرایش نقش" onClick={() => setEditing({ kind: 'member', item: member })}><Pencil size={15} /></button>
                            <button type="button" className="danger" title="حذف از تیم" aria-label="حذف از تیم" onClick={() => removeMember(member)}><Trash2 size={15} /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          </DataState>
        </section>

        <section className="task-panel task-table-panel ctl-panel ctl-block">
          <div className="task-panel-title"><div><h3>نقش‌های حاکمیتی</h3><p>مسئولیت‌های راهبری و تأیید پروژه</p></div></div>
          <DataState loading={data.loadingDetails} empty={!data.governanceRoles.length}>
            <div className="table-scroll"><table>
              <thead><tr><th>عنوان نقش</th><th>فرد</th><th>شماره پرسنلی</th><th>تلفن</th><th>ایمیل</th><th>محل خدمت</th><th>عملیات</th></tr></thead>
              <tbody>
                {data.governanceRoles.map((role) => (
                  <tr key={role.id}>
                    <td><strong>{role.title}</strong></td>
                    <td>{role.userId ? data.userName(role.userId) : <span className="users-missing">بدون فرد</span>}</td>
                    <td className="ltr-cell">{role.personnelNumber ? toPersianDigits(role.personnelNumber) : '—'}</td>
                    <td className="ltr-cell">{role.phone ? toPersianDigits(role.phone) : '—'}</td>
                    <td className="ltr-cell">{role.email || '—'}</td>
                    <td>{role.serviceLocation || '—'}</td>
                    <td>
                      {rights.governance && (
                        <span className="row-actions">
                          <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setEditing({ kind: 'governance', item: role })}><Pencil size={15} /></button>
                          <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => removeRole(role)}><Trash2 size={15} /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </DataState>
        </section>
      </DataState>

      {editing && <CreateProjectItemModal kind={editing.kind} item={editing.item} data={data} onClose={() => setEditing(null)} />}
      {teamOpen && (
        <TeamSetDialog
          data={data}
          onClose={() => setTeamOpen(false)}
          onSaved={(result) => { setTeamOpen(false); setNotice(result); data.refresh() }}
        />
      )}
    </>
  )
}

/* The whole team of the project in one go: tick who is on it. People left unticked are removed,
   new ones join without a role title, those already on it keep theirs. */
function TeamSetDialog({ data, onClose, onSaved }) {
  const [candidates, setCandidates] = useState(null)
  const [picked, setPicked] = useState(() => new Set(data.teamMembers.map((member) => member.userId)))
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    projectManagementApi.availableTeamUsers(data.selectedProjectId).then((result) => {
      if (cancelled) return
      const known = new Map()
      for (const person of result.isSuccess ? arrayPayload(result) : data.users) known.set(person.id, person)
      // People already on the team stay listed even when the Core no longer offers them.
      for (const member of data.teamMembers) if (!known.has(member.userId)) known.set(member.userId, data.users.find((item) => item.id === member.userId) || { id: member.userId, displayName: data.userName(member.userId) })
      setCandidates([...known.values()])
    })
    return () => { cancelled = true }
  }, [data.selectedProjectId])

  const term = filter.trim().toLowerCase()
  const shown = (candidates || []).filter((person) => !term || `${person.displayName || ''} ${person.email || ''} ${person.username || ''}`.toLowerCase().includes(term))
  const original = data.teamMembers.map((member) => member.userId).sort().join(',')
  const changed = [...picked].sort().join(',') !== original
  const removed = data.teamMembers.filter((member) => !picked.has(member.userId)).length
  const added = [...picked].filter((id) => !data.teamMembers.some((member) => member.userId === id)).length

  async function save() {
    setSaving(true)
    setError('')
    const result = await projectManagementApi.setTeam({ tenantId: data.tenantId, projectId: data.selectedProjectId, userIds: [...picked] })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: `تیم پروژه ذخیره شد (${toPersianDigits(added)} عضو تازه، ${toPersianDigits(removed)} حذف).` })
  }

  return (
    <UserDialog
      size="sm" icon={UsersRound} title="تنظیم تیم پروژه" subtitle={projectDisplayName(data.selectedProject)}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="button" className="ue-save" onClick={save} disabled={saving || !changed}>{saving ? 'در حال ذخیره...' : 'ذخیره تیم'}</button>
          </div>
        </>
      )}
    >
      <div className="ue-section-head">
        <p className="ue-note ctl-note-flex">{toPersianDigits(picked.size)} نفر انتخاب شده. حذف شدگان از تیم بیرون می‌روند.</p>
        <label className="users-search users-search--sm"><Search size={15} /><input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="جستجوی کاربر..." /></label>
      </div>
      {candidates === null ? <p className="users-empty"><LoaderCircle size={18} className="spin" /></p> : (
        <ul className="ue-roles ctl-people">
          {shown.map((person) => (
            <li key={person.id}>
              <label>
                <input type="checkbox" checked={picked.has(person.id)} onChange={(e) => setPicked((current) => { const next = new Set(current); if (e.target.checked) next.add(person.id); else next.delete(person.id); return next })} />
                <span className="access-check"><CheckCheck size={13} /></span>
                <span className="access-text"><strong>{person.displayName || person.email}</strong>{(person.email || person.username) && <code>{person.email || person.username}</code>}</span>
              </label>
            </li>
          ))}
          {!shown.length && <li><p className="ue-note">کاربری پیدا نشد.</p></li>}
        </ul>
      )}
    </UserDialog>
  )
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

const NATIONAL_CODE = /^[0-9]{10}$/
const PHONE_NUMBER = /^(\+?[0-9]{8,15}|0?9[0-9]{9})$/
const EMAIL_ADDRESS = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Debounced copy of a fast-changing value, e.g. a search box. */
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

const userFullName = (user) => `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.displayName

function Field({ label, children, hint, required, wide }) {
  return (
    <label className={`ue-field${wide ? ' ue-field--wide' : ''}`}>
      <span>{label}{required && <b className="ue-required"> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

/** Dialogs are drawn straight into <body>: inside the page content they would sit under the top bar. */
function ModalPortal({ children }) {
  return createPortal(children, document.body)
}

/** The same dialog shell for the user form and the access dialog. */
function UserDialog({ title, icon: Icon, subtitle, size, onClose, footer, children }) {
  return (
    <ModalPortal><div className="ue-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`ue-modal${size === 'sm' ? ' ue-modal--sm' : ''}`}>
        <header className="ue-head">
          <span className="ue-head-icon"><Icon size={19} /></span>
          <div className="ue-head-title">
            <strong>{title}</strong>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button type="button" className="ue-close" onClick={onClose} aria-label="بستن"><X size={19} /></button>
        </header>
        <div className="ue-body">{children}</div>
        <footer className="ue-foot">{footer}</footer>
      </div>
    </div></ModalPortal>
  )
}

function UsersTable() {
  const { user: currentUser, can } = useAuth()
  const tenantId = currentUser?.tenantId || DEFAULT_TENANT_ID
  const PAGE_SIZE = 10
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [editing, setEditing] = useState(null)
  const [accessOf, setAccessOf] = useState(null)

  // What the signed-in user may do here (the Core checks every one of them again).
  const rights = {
    create: can('users.create'),
    update: can('users.update'),
    changeStatus: can('users.change_status'),
    assignRoles: can('users.assign_roles'),
    assignPermissions: can('users.assign_permissions'),
  }

  // Any new search starts from the first page.
  useEffect(() => { setPage(1) }, [debouncedSearch])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    usersApi.list({ tenantId, pageNumber: page, pageSize: PAGE_SIZE, search: debouncedSearch }).then((result) => {
      if (cancelled) return
      if (!result.isSuccess) setNotice({ type: 'error', text: PersianMessages.error(result.error) })
      const paged = unwrap(result)
      setUsers(paged?.items || [])
      setTotal(paged?.totalCount || 0)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tenantId, page, debouncedSearch, reloadKey])

  const reload = () => setReloadKey((key) => key + 1)

  async function toggleStatus(user) {
    const enable = !user.isActive
    if (!enable && !window.confirm(`حساب «${userFullName(user)}» غیرفعال شود؟ کاربر بلافاصله از سامانه خارج می‌شود.`)) return
    const result = await usersApi.setStatus(user.id, enable)
    if (!result.isSuccess) { setNotice({ type: 'error', text: PersianMessages.error(result.error) }); return }
    setNotice({ type: 'success', text: `حساب «${userFullName(user)}» ${enable ? 'فعال' : 'غیرفعال'} شد.` })
    reload()
  }

  return (
    <section className="users-card">
      <div className="users-toolbar">
        <label className="users-search"><Search size={16} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در نام، کد ملی، موبایل، ایمیل، نقش..." /></label>
        {rights.create && <button type="button" className="users-add" onClick={() => setEditing('new')}><UserPlus size={16} />کاربر جدید</button>}
      </div>
      {notice && (
        <div className={`users-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن"><X size={15} /></button>
        </div>
      )}
      <div className="table-scroll">
        <table className="users-table">
          <thead><tr><th>کاربر</th><th>نام کاربری (کد ملی)</th><th>شماره موبایل</th><th>نقش</th><th>آخرین ورود</th><th>وضعیت</th><th>عملیات</th></tr></thead>
          <tbody className={loading ? 'is-loading' : ''}>
            {users.map((user, index) => {
              const isSelf = user.id === currentUser?.id
              const lockedReason = user.isSystem ? 'مدیر اصلی سیستم از این بخش قابل تغییر نیست.' : isSelf ? 'این عملیات برای حساب خودتان مجاز نیست.' : ''
              return (
                <tr key={user.id}>
                  <td>
                    <span className={`user-identity tone-${index % 5}`}>
                      <i>{initialsOf(userFullName(user))}</i>
                      <span>
                        <strong>{userFullName(user)}{user.isSystem && <em className="user-system" title="ایجادشده توسط سیستم؛ قابل حذف، غیرفعال‌سازی یا تغییر دسترسی نیست"><Lock size={12} />مدیر اصلی</em>}</strong>
                        {user.email && <small className="ltr-cell">{user.email}</small>}
                      </span>
                    </span>
                  </td>
                  <td className="ltr-cell">{user.username ? toPersianDigits(user.username) : <span className="users-missing">ثبت نشده</span>}</td>
                  <td className="ltr-cell">{user.phoneNumber ? toPersianDigits(user.phoneNumber) : '—'}</td>
                  <td>{(user.roles || []).length ? user.roles.map((role) => <span className="access-badge" key={role}><Shield size={13} />{role}</span>) : <span className="users-missing">بدون نقش</span>}</td>
                  <td>{user.lastLoginAtUtc ? formatDateTime(user.lastLoginAtUtc) : 'ثبت نشده'}</td>
                  <td><span className={`user-status ${user.isActive ? 'active' : ''}`}><i />{user.isActive ? 'فعال' : 'غیرفعال'}</span></td>
                  <td>
                    <span className="row-actions">
                      {rights.update && (
                        <button type="button" title={user.isSystem ? 'مشخصات مدیر اصلی سیستم از این بخش قابل تغییر نیست؛ رمز خود را از «تنظیمات» تغییر می‌دهد.' : 'ویرایش'} aria-label="ویرایش" disabled={user.isSystem} onClick={() => setEditing(user)}><Pencil size={15} /></button>
                      )}
                      {(rights.assignRoles || rights.assignPermissions) && (
                        <button type="button" title={lockedReason || 'دسترسی‌ها'} aria-label="دسترسی‌ها" disabled={Boolean(lockedReason)} onClick={() => setAccessOf(user)}><ShieldCheck size={15} /></button>
                      )}
                      {rights.changeStatus && (user.isActive
                        ? <button type="button" className="danger" title={lockedReason || 'غیرفعال‌سازی'} aria-label="غیرفعال‌سازی" disabled={Boolean(lockedReason)} onClick={() => toggleStatus(user)}><EyeOff size={15} /></button>
                        : <button type="button" className="ok" title="فعال‌سازی" aria-label="فعال‌سازی" onClick={() => toggleStatus(user)}><Eye size={15} /></button>)}
                    </span>
                  </td>
                </tr>
              )
            })}
            {loading && !users.length && <tr><td colSpan={7} className="users-empty"><LoaderCircle size={18} className="spin" /></td></tr>}
            {!loading && !users.length && <tr><td colSpan={7} className="users-empty">کاربری یافت نشد.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pageNumber={page} pageSize={PAGE_SIZE} totalCount={total} onChange={setPage} />
      {/* The Core exposes a delete endpoint, but disabling is the safe default: a user is referenced by tasks and chats. */}
      {editing && (
        <UserFormDialog
          user={editing === 'new' ? null : editing}
          tenantId={tenantId}
          canAssignRoles={rights.assignRoles}
          onClose={() => setEditing(null)}
          onSaved={(result) => { setEditing(null); setNotice(result); reload() }}
        />
      )}
      {accessOf && (
        <UserAccessDialog
          user={accessOf}
          tenantId={tenantId}
          rights={rights}
          onClose={() => setAccessOf(null)}
          onSaved={(result) => { setAccessOf(null); setNotice(result); reload() }}
        />
      )}
    </section>
  )
}

/* Create / edit one account: the fields the Core keeps - name, national code (the username),
   mobile number, e-mail and password. Roles can be picked while creating; later changes (and
   direct permissions) live in the access dialog. */
function UserFormDialog({ user, tenantId, canAssignRoles, onClose, onSaved }) {
  const isNew = !user
  const [form, setForm] = useState({
    firstName: user?.firstName || (user && !user.lastName ? user.displayName : ''),
    lastName: user?.lastName || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
    password: '',
  })
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [roles, setRoles] = useState([])
  const [roleIds, setRoleIds] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The role list needs roles.view; without it the account is still created, just without roles.
  useEffect(() => {
    if (!isNew || !canAssignRoles) return
    rolesApi.list(tenantId).then((result) => setRoles(unwrap(result, []) || []))
  }, [isNew, canAssignRoles, tenantId])

  const set = (key) => (event) => {
    const value = key === 'username' || key === 'phoneNumber' ? toLatinDigits(event.target.value) : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
  }

  // An older username (from before the national-code rule) may stay as it is.
  const usernameChanged = isNew || form.username.trim() !== (user?.username || '')
  const passwordMismatch = Boolean(passwordConfirm) && form.password !== passwordConfirm

  function validate() {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'نام و نام خانوادگی را وارد کنید.'
    if (usernameChanged && !NATIONAL_CODE.test(form.username.trim())) return 'نام کاربری باید کد ملی ۱۰ رقمی باشد (فقط عدد).'
    if (!form.phoneNumber.trim()) return 'شماره موبایل را وارد کنید.'
    if (!PHONE_NUMBER.test(form.phoneNumber.replace(/[\s\-()]/g, ''))) return 'شماره موبایل معتبر نیست (مثال: 09121234567).'
    if (form.email.trim() && !EMAIL_ADDRESS.test(form.email.trim())) return 'ایمیل معتبر نیست.'
    if (isNew && form.password.length < 8) return 'رمز عبور اولیه باید حداقل ۸ کاراکتر باشد.'
    if (!isNew && form.password && form.password.length < 8) return 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.'
    if (form.password !== passwordConfirm) return 'رمز عبور و تکرار آن یکسان نیستند.'
    return ''
  }

  async function submit(event) {
    event.preventDefault()
    const problem = validate()
    if (problem) { setError(problem); return }
    setSaving(true)
    setError('')
    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const fullName = `${firstName} ${lastName}`.trim()

    if (isNew) {
      const created = await usersApi.create({
        tenantId,
        username: form.username.trim(),
        firstName,
        lastName,
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
        email: form.email.trim() || null,
        isActive: true,
      })
      if (!created.isSuccess) { setSaving(false); setError(PersianMessages.error(created.error)); return }
      if (canAssignRoles && roleIds.length) {
        const assigned = await usersApi.assignRoles(unwrap(created).id, roleIds)
        if (!assigned.isSuccess) {
          onSaved({ type: 'error', text: `کاربر «${fullName}» ایجاد شد، اما نقش‌ها ذخیره نشد: ${PersianMessages.error(assigned.error)} از دکمه‌ی «دسترسی‌ها» دوباره امتحان کنید.` })
          return
        }
      }
      onSaved({ type: 'success', text: `کاربر «${fullName}» ایجاد شد.` })
      return
    }

    const saved = await usersApi.update(user.id, {
      displayName: fullName || user.displayName,
      isActive: user.isActive,
      firstName,
      lastName,
      username: form.username.trim(),
      phoneNumber: form.phoneNumber.trim(),
      email: form.email.trim(),
      password: form.password.trim() || null,
    })
    if (!saved.isSuccess) { setSaving(false); setError(PersianMessages.error(saved.error)); return }
    onSaved({ type: 'success', text: `مشخصات «${fullName}» ذخیره شد.` })
  }

  return (
    <UserDialog
      size="sm"
      icon={isNew ? UserPlus : Pencil}
      title={isNew ? 'ایجاد کاربر جدید' : `ویرایش «${userFullName(user)}»`}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="submit" form="user-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : isNew ? 'ایجاد کاربر' : 'ذخیره تغییرات'}</button>
          </div>
        </>
      )}
    >
      <form id="user-form" onSubmit={submit} noValidate>
        <div className="ue-card">
          <div className="ue-grid">
            <Field label="نام" required><input value={form.firstName} onChange={set('firstName')} maxLength={80} autoFocus /></Field>
            <Field label="نام خانوادگی" required><input value={form.lastName} onChange={set('lastName')} maxLength={80} /></Field>
            <Field label="نام کاربری (کد ملی)" required hint={!isNew && user?.username && !NATIONAL_CODE.test(user.username) ? 'نام کاربری فعلی پیش از قانون کد ملی ثبت شده؛ اگر تغییرش دهید باید کد ملی ۱۰ رقمی باشد.' : 'دقیقاً ۱۰ رقم، فقط عدد.'}>
              <input className="ltr-input" value={form.username} onChange={set('username')} inputMode="numeric" maxLength={usernameChanged ? 10 : 64} autoComplete="off" />
            </Field>
            <Field label="شماره موبایل" required hint="برای ورود و دریافت پیامک.">
              <input className="ltr-input" value={form.phoneNumber} onChange={set('phoneNumber')} inputMode="tel" placeholder="09121234567" autoComplete="off" />
            </Field>
            <Field label="ایمیل" hint="اختیاری؛ برای ارسال لینک بازیابی رمز عبور." wide>
              <input className="ltr-input" type="email" value={form.email} onChange={set('email')} autoComplete="off" />
            </Field>
          </div>
        </div>

        <div className="ue-card ue-card--accent">
          <div className="ue-grid">
            <Field label={isNew ? 'رمز عبور اولیه' : 'رمز عبور جدید'} required={isNew} hint={isNew ? 'حداقل ۸ کاراکتر.' : 'خالی بگذارید تا رمز فعلی بماند.'}>
              <input className="ltr-input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </Field>
            <Field label="تکرار رمز عبور" required={isNew} hint={passwordMismatch ? 'رمزها یکسان نیستند.' : undefined}>
              <input className={`ltr-input${passwordMismatch ? ' is-invalid' : ''}`} type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} autoComplete="new-password" aria-invalid={passwordMismatch} />
            </Field>
          </div>
        </div>

        {isNew && canAssignRoles && roles.length > 0 && (
          <div className="ue-card ue-card--accent">
            <h5 className="ue-card-title">نقش‌ها</h5>
            <ul className="ue-roles ue-roles--wrap">
              {roles.map((role) => (
                <li key={role.id}>
                  <label>
                    <input type="checkbox" checked={roleIds.includes(role.id)} onChange={(e) => setRoleIds((ids) => e.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))} />
                    <span className="access-check"><CheckCheck size={13} /></span>
                    <span className="access-text"><strong>{role.name}</strong></span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </UserDialog>
  )
}

/* Where a permission reaches one user from, and whether it is in effect for them. */
function accessIsEffective(entry, direct, denied) {
  if (denied.has(entry.permissionId)) return false
  return direct.has(entry.permissionId) || entry.grantedByRole || entry.grantedByGroup || Boolean(entry.grantedAsPrerequisite)
}

/* Turning one permission on or off for this user. Off: the direct grant goes, and when a role,
   a group or another permission would still give it, it is denied to the user. On: a denial goes,
   and it is granted directly only when nothing else gives it. */
function toggleUserAccess(entry, enable, direct, denied) {
  const nextDirect = new Set(direct)
  const nextDenied = new Set(denied)
  const inherited = entry.grantedByRole || entry.grantedByGroup || Boolean(entry.grantedAsPrerequisite)
  if (enable) {
    nextDenied.delete(entry.permissionId)
    if (!inherited) nextDirect.add(entry.permissionId)
  } else {
    nextDirect.delete(entry.permissionId)
    if (inherited) nextDenied.add(entry.permissionId)
  }
  return { direct: nextDirect, denied: nextDenied }
}

function AccessSourceBadges({ entry, direct, denied }) {
  const roles = (entry.grantingRoles || []).join('، ')
  const groups = (entry.grantingGroups || []).join('، ')
  if (denied.has(entry.permissionId)) {
    const despite = [entry.grantedByRole && `سمت ${roles}`, entry.grantedByGroup && `گروه ${groups}`].filter(Boolean).join(' و ')
    return (
      <span className="access-inherited access-inherited--denied" title={despite ? `با وجود دسترسی از طریق ${despite}، برای این کاربر ممنوع شده است.` : 'برای این کاربر ممنوع شده است.'}>
        غیرفعال برای این کاربر
      </span>
    )
  }
  return (
    <>
      {direct.has(entry.permissionId) && <span className="access-inherited access-inherited--direct">دسترسی مستقیم</span>}
      {entry.grantedByRole && <span className="access-inherited" title={roles}><ShieldCheck size={13} />نقش: {roles}</span>}
      {entry.grantedByGroup && <span className="access-inherited access-inherited--group" title={groups}><Users2 size={13} />گروه: {groups}</span>}
      {entry.grantedAsPrerequisite && !direct.has(entry.permissionId) && !entry.grantedByRole && !entry.grantedByGroup && (
        <span className="access-inherited access-inherited--prereq" title="مجوز دیگری از این کاربر به آن نیاز دارد.">لازمه‌ی مجوزی دیگر</span>
      )}
    </>
  )
}

/* The roles of one user and, permission by permission, what they actually have and why. */
function UserAccessDialog({ user, tenantId, rights, onClose, onSaved }) {
  const [roles, setRoles] = useState([])
  const [access, setAccess] = useState(null)
  const [roleIds, setRoleIds] = useState([])
  const [direct, setDirect] = useState(new Set())
  const [denied, setDenied] = useState(new Set())
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    // The role list needs roles.view; without it the permissions are still shown.
    Promise.all([rolesApi.list(tenantId), usersApi.permissions(user.id)]).then(([roleResult, accessResult]) => {
      if (cancelled) return
      if (!accessResult.isSuccess) { setError(PersianMessages.error(accessResult.error)); return }
      const roleList = unwrap(roleResult, []) || []
      const userAccess = unwrap(accessResult)
      setRoles(roleList)
      setAccess(userAccess)
      setRoleIds(roleList.filter((role) => (userAccess.roles || []).includes(role.name)).map((role) => role.id))
      setDirect(new Set(userAccess.permissions.filter((p) => p.grantedDirectly).map((p) => p.permissionId)))
      setDenied(new Set(userAccess.permissions.filter((p) => p.deniedForUser).map((p) => p.permissionId)))
    })
    return () => { cancelled = true }
  }, [user.id, tenantId])

  const modules = useMemo(() => {
    const term = filter.trim().toLowerCase()
    const grouped = new Map()
    for (const entry of access?.permissions || []) {
      if (term && !`${labelForPermission(entry)} ${entry.name} ${labelForModule(entry.module)}`.toLowerCase().includes(term)) continue
      if (!grouped.has(entry.module)) grouped.set(entry.module, [])
      grouped.get(entry.module).push(entry)
    }
    return Array.from(grouped, ([module, permissions]) => ({ module, permissions }))
  }, [access, filter])

  async function save() {
    if (!access) return
    setSaving(true)
    setError('')
    const originalRoleIds = roles.filter((role) => (access.roles || []).includes(role.name)).map((role) => role.id).sort().join(',')
    if (rights.assignRoles && [...roleIds].sort().join(',') !== originalRoleIds) {
      const result = await usersApi.assignRoles(user.id, roleIds)
      if (!result.isSuccess) { setSaving(false); setError(PersianMessages.error(result.error)); return }
    }
    const originalDirect = access.permissions.filter((p) => p.grantedDirectly).map((p) => p.permissionId).sort().join(',')
    const originalDenied = access.permissions.filter((p) => p.deniedForUser).map((p) => p.permissionId).sort().join(',')
    if (rights.assignPermissions && ([...direct].sort().join(',') !== originalDirect || [...denied].sort().join(',') !== originalDenied)) {
      const result = await usersApi.assignPermissions(user.id, [...direct], [...denied])
      if (!result.isSuccess) { setSaving(false); setError(PersianMessages.error(result.error)); return }
    }
    onSaved({ type: 'success', text: `دسترسی‌های «${userFullName(user)}» ذخیره شد. تغییرات پس از ورود دوباره‌ی کاربر اعمال می‌شود.` })
  }

  const nothingEditable = !rights.assignRoles && !rights.assignPermissions

  return (
    <UserDialog
      icon={ShieldCheck}
      title={`دسترسی‌های «${userFullName(user)}»`}
      subtitle={user.email || undefined}
      onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions">
            <button type="button" className="ue-cancel" onClick={onClose}>انصراف</button>
            <button type="button" className="ue-save" onClick={save} disabled={saving || !access || nothingEditable}>{saving ? 'در حال ذخیره...' : 'ذخیره دسترسی‌ها'}</button>
          </div>
        </>
      )}
    >
      {!access ? (
        error ? null : <p className="users-empty"><LoaderCircle size={18} className="spin" /></p>
      ) : (
        <>
          <section className="ue-section ue-section--first">
            <h4><Shield size={16} />نقش‌ها</h4>
            {roles.length ? (
              <ul className="ue-roles ue-roles--wrap">
                {roles.map((role) => (
                  <li key={role.id}>
                    <label className={rights.assignRoles ? '' : 'is-locked'}>
                      <input type="checkbox" disabled={!rights.assignRoles} checked={roleIds.includes(role.id)} onChange={(e) => setRoleIds((ids) => e.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))} />
                      <span className="access-check"><CheckCheck size={13} /></span>
                      <span className="access-text">
                        <strong>{role.name}</strong>
                        <code>{toPersianDigits((role.permissions || []).length)} مجوز</code>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ue-note">برای دیدن و تغییر نقش‌ها به دسترسی «مشاهده نقش‌ها» نیاز دارید.</p>
            )}
          </section>

          <section className="ue-section">
            <div className="ue-section-head">
              <h4><KeyRound size={16} />مجوزهای این کاربر</h4>
              <label className="users-search users-search--sm"><Search size={15} /><input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="جستجوی مجوز..." /></label>
            </div>
            <p className="ue-note">
              تیک هر مجوز یعنی این کاربر واقعاً آن را دارد. برداشتن تیک مجوزی که از نقش یا گروه می‌آید، آن را فقط برای همین کاربر غیرفعال می‌کند و نقش یا گروه تغییر نمی‌کند؛ با زدن دوباره‌ی تیک، دسترسی برمی‌گردد. فقط مجوزهایی را می‌توانید بدهید یا غیرفعال کنید که خودتان دارید.
            </p>
            {modules.map((group) => (
              <div className="access-group" key={group.module}>
                <h5>{labelForModule(group.module)}</h5>
                <ul>
                  {group.permissions.map((entry) => (
                    <li key={entry.permissionId}>
                      <label className={rights.assignPermissions ? '' : 'is-locked'}>
                        <input
                          type="checkbox"
                          disabled={!rights.assignPermissions}
                          checked={accessIsEffective(entry, direct, denied)}
                          onChange={(e) => {
                            const next = toggleUserAccess(entry, e.target.checked, direct, denied)
                            setDirect(next.direct)
                            setDenied(next.denied)
                          }}
                        />
                        <span className="access-check"><CheckCheck size={13} /></span>
                        <span className="access-text">
                          <strong>{labelForPermission(entry)}</strong>
                          <code>{entry.name}</code>
                        </span>
                        <span className="access-inherited-wrap"><AccessSourceBadges entry={entry} direct={direct} denied={denied} /></span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!modules.length && <p className="ue-note">مجوزی پیدا نشد.</p>}
          </section>
        </>
      )}
    </UserDialog>
  )
}

/** Sign-in history, derived from the platform audit log (identity.login*). */
const LOGIN_OUTCOMES = {
  'identity.login': { label: 'ورود موفق', tone: 'success' },
  'identity.login_failed': { label: 'ورود ناموفق', tone: 'failed' },
  'identity.login_blocked': { label: 'مسدود (تلاش زیاد)', tone: 'warn' },
  'identity.login_captcha_failed': { label: 'کد امنیتی نادرست', tone: 'warn' },
}

const LOGIN_REASONS = {
  'unknown account': 'حساب ناموجود',
  'wrong password': 'رمز نادرست',
  'account disabled': 'حساب غیرفعال',
}

/** "0912... (wrong password)" -> the identifier that was typed and a Persian reason. */
function describeLogin(details) {
  if (!details) return { identifier: '—', reason: null }
  const match = /^(.*) \(([^)]+)\)$/.exec(details)
  return match ? { identifier: match[1], reason: LOGIN_REASONS[match[2]] || match[2] } : { identifier: details, reason: null }
}

const jalaliDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })
const jalaliTime = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function LoginHistory() {
  const { user } = useAuth()
  const PAGE_SIZE = 15
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounced(search)
  const [newestFirst, setNewestFirst] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // A new search or sort order starts from the first page.
  useEffect(() => { setPage(1) }, [debouncedSearch, newestFirst])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // The Core filters by action prefix ("identity.login" also covers failed / blocked attempts).
    platformApi.auditLogs({
      tenantId: user?.tenantId, pageNumber: page, pageSize: PAGE_SIZE,
      action: 'identity.login', search: debouncedSearch.trim(), sort: newestFirst ? 'desc' : 'asc',
    }).then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      const paged = unwrap(result)
      setLogs(paged?.items || [])
      setTotal(paged?.totalCount || 0)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user?.tenantId, page, debouncedSearch, newestFirst])

  return (
    <section className="users-card">
      <div className="users-toolbar">
        <label className="users-search"><Search size={16} /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو در کاربر، نام کاربری، IP، رویداد..." /></label>
        <span className="users-toolbar-note">داده‌ها از رویدادهای ثبت‌شده‌ی سامانه خوانده می‌شوند.</span>
      </div>
      {error && <div className="users-notice error" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
      <div className="table-scroll">
        <table className="users-table">
          <thead>
            <tr>
              <th>کاربر</th>
              <th>نام کاربری / شناسه واردشده</th>
              <th><button type="button" className="th-sort" onClick={() => setNewestFirst((value) => !value)} title="تغییر ترتیب">تاریخ <ArrowDownUp size={13} /></button></th>
              <th>ساعت</th>
              <th>وضعیت</th>
              <th>علت</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody className={loading ? 'is-loading' : ''}>
            {logs.map((log) => {
              const outcome = LOGIN_OUTCOMES[log.action] || { label: log.action, tone: 'neutral' }
              const { identifier, reason } = describeLogin(log.details)
              const when = new Date(log.occurredAtUtc)
              return (
                <tr key={log.id}>
                  <td><strong>{log.userDisplayName || <span className="users-missing">نامشخص</span>}</strong></td>
                  <td className="ltr-cell">{toPersianDigits(log.username || identifier)}</td>
                  <td>{jalaliDate.format(when)}</td>
                  <td>{jalaliTime.format(when)}</td>
                  <td><span className={`login-result ${outcome.tone}`}>{outcome.label}</span></td>
                  <td>{reason || '—'}</td>
                  <td className="ltr-cell"><code>{log.ipAddress || '—'}</code></td>
                </tr>
              )
            })}
            {loading && !logs.length && <tr><td colSpan={7} className="users-empty"><LoaderCircle size={18} className="spin" /></td></tr>}
            {!loading && !logs.length && <tr><td colSpan={7} className="users-empty">رویدادی یافت نشد.</td></tr>}
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

function UserManagement() {
  const [tab, setTab] = useState('کاربران')
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
  return <div className="user-management"><div className="task-page-header"><div><span>تنظیمات سازمانی</span><h1>مدیریت کاربران</h1><p>مدیریت حساب‌ها، ساختار سازمانی و سطوح دسترسی</p></div></div><nav className="user-tabs">{tabs.map(({ label, icon: Icon }) => <button key={label} className={tab === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={17} />{label}</button>)}</nav>{tab === 'کاربران' && <UsersTable />}{tab === 'تاریخچه ورود' && <LoginHistory />}{tab === 'چارت سازمانی' && <OrgChart />}{tab === 'نقش‌ها و دسترسی‌ها' && <AccessControl />}</div>
}

// «تنظیمات»: a tabbed settings page (today just «پروفایل»; more tabs land here later,
// each a sibling of ProfileTab, the same way UserManagement's own tabs are laid out).
function SystemSettings() {
  const { canReach } = useAuth()
  const [tab, setTab] = useState('پروفایل')
  const tabs = [
    { label: 'پروفایل', icon: UserCog },
    // Shown to those given their teams to see (groups.view_own) or to build (groups.manage_own).
    ...(canReach(['groups.view_own', 'groups.manage_own']) ? [{ label: 'مدیریت تیم کاری', icon: Users }] : []),
    { label: 'ظاهر سامانه', icon: Palette },
    ...(canReach('sms_settings.view') ? [{ label: 'پنل پیامکی', icon: MessageSquareText }] : []),
    ...(canReach([...sectionPermissions.users, ...sectionPermissions.loginHistory]) ? [{ label: 'مدیریت کاربران', icon: UsersRound }] : []),
  ]
  const current = tabs.some((item) => item.label === tab) ? tab : tabs[0].label

  return (
    <section className="profile-page">
      <div className="task-page-header">
        <div><span>تنظیمات شخصی</span><h1>تنظیمات</h1><p>پروفایل، امنیت و تنظیمات حساب کاربری شما</p></div>
      </div>
      <nav className="user-tabs">{tabs.map(({ label, icon: Icon }) => <button key={label} className={current === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={17} />{label}</button>)}</nav>
      {current === 'پروفایل' && <ProfileTab />}
      {current === 'مدیریت تیم کاری' && <CollapsibleCard icon={Users} title="مدیریت تیم کاری من"><MyWorkTeams /></CollapsibleCard>}
      {current === 'ظاهر سامانه' && <AppearanceTab />}
      {current === 'پنل پیامکی' && <SmsPanelTab />}
      {current === 'مدیریت کاربران' && <UsersSettingsTab />}
    </section>
  )
}

/**
 * Settings → «مدیریت کاربران»: the user list and the sign-in history, as sub-tabs. The same
 * panels as the «مدیریت کاربران» page of the side menu; LDAP and SSO are deliberately not here.
 */
function UsersSettingsTab() {
  const { canReach } = useAuth()
  const [tab, setTab] = useState('مدیریت کاربران')
  const tabs = [
    { label: 'مدیریت کاربران', icon: UsersRound, permissions: sectionPermissions.users },
    { label: 'تاریخچه ورود', icon: History, permissions: sectionPermissions.loginHistory },
  ].filter((item) => canReach(item.permissions))
  const current = tabs.some((item) => item.label === tab) ? tab : tabs[0]?.label

  return (
    <div className="users-settings">
      <div className="settings-subtabs-row">
        <nav className="settings-subtabs">
          {tabs.map(({ label, icon: Icon }) => (
            <button key={label} type="button" className={current === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={16} />{label}</button>
          ))}
        </nav>
      </div>
      {current === 'مدیریت کاربران' && <UsersTable />}
      {current === 'تاریخچه ورود' && <LoginHistory />}
    </div>
  )
}

/* «پنل پیامکی» ---------------------------------------------------------------------------- */

const SMS_TEMPLATE_MAX_LENGTH = 1000
// Offered by every template when the server has a product name configured.
const SMS_PRODUCT_NAME_PLACEHOLDER = 'ProductName'
const SMS_PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g

const toLatinDigits = (value) => String(value || '')
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** The Core's SMS settings in the shape the panel edits; secrets always start empty (write-only). */
function normalizeSmsSettings(sms) {
  const toProvider = (item, fallbackId) => ({
    id: item?.id || fallbackId,
    name: item?.name || (item?.provider === 'kavenegar' ? 'کاوه‌نگار' : 'سرویس‌دهنده پیامک'),
    provider: item?.provider || 'kavenegar',
    enabled: !!item?.enabled,
    apiUrl: item?.apiUrl || '',
    apiKey: '',
    lineNumber: item?.lineNumber || '',
    username: '',
    password: '',
    apiKeyConfigured: !!item?.apiKeyConfigured,
    usernameConfigured: !!item?.usernameConfigured,
    passwordConfigured: !!item?.passwordConfigured,
  })
  // Settings saved before the provider list existed hold one provider at the top level; it is
  // shown as that provider (by default an unconfigured «کاوه‌نگار»).
  const providers = Array.isArray(sms?.providers)
    ? sms.providers.map((item, index) => toProvider(item, `provider-${index}`))
    : [toProvider(sms, '00000000-0000-0000-0000-000000000001')]
  return { provider: sms?.provider || 'kavenegar', providers }
}

/** The body for PUT /notification-channels: the list, with the active provider mirrored on top. */
function smsSettingsBody(settings, providers) {
  const active = providers.find((item) => item.enabled)
  const clean = (value) => (value || '').trim() || null
  return {
    enabled: !!active,
    provider: active?.provider ?? settings.provider,
    apiUrl: clean(active?.apiUrl),
    apiKey: clean(active?.apiKey),
    username: clean(active?.username),
    password: active?.password || null,
    lineNumber: clean(active?.lineNumber),
    providers: providers.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      provider: item.provider,
      enabled: item.enabled,
      apiUrl: clean(item.apiUrl),
      apiKey: clean(item.apiKey),
      username: clean(item.username),
      password: item.password || null,
      lineNumber: clean(item.lineNumber),
    })),
  }
}

const usedSmsPlaceholders = (text) => Array.from(new Set(Array.from(String(text || '').matchAll(SMS_PLACEHOLDER), (m) => m[1])))

/** The same rules the Core applies on save, in Persian; null when the text is fine. */
function validateSmsTemplate(template) {
  const title = template.title || template.key
  const text = template.text ?? ''
  if (!text.trim()) return `متن پیامک «${title}» نمی‌تواند خالی باشد.`
  if (text.trim().length > SMS_TEMPLATE_MAX_LENGTH) return `متن پیامک «${title}» نباید بیشتر از ${SMS_TEMPLATE_MAX_LENGTH.toLocaleString('fa-IR')} کاراکتر باشد.`
  const allowed = new Set([...(template.placeholders || []), SMS_PRODUCT_NAME_PLACEHOLDER].map((p) => p.toLowerCase()))
  const unknown = usedSmsPlaceholders(text).filter((p) => !allowed.has(p.toLowerCase()))
  if (unknown.length) return `متن پیامک «${title}» عبارت ناشناخته دارد: ${unknown.map((p) => `{${p}}`).join('، ')}`
  const used = new Set(usedSmsPlaceholders(text).map((p) => p.toLowerCase()))
  const missing = (template.requiredPlaceholders || []).filter((p) => !used.has(p.toLowerCase()))
  if (missing.length) return `متن پیامک «${title}» باید ${missing.map((p) => `{${p}}`).join('، ')} را داشته باشد.`
  return null
}

const errorText = (result, fallback) => (result?.error ? PersianMessages.error(result.error) : fallback)

function SmsPanelTab() {
  const { can } = useAuth()
  const canUpdate = can('sms_settings.update')
  const canTest = can('sms_settings.test')

  const [providerOptions, setProviderOptions] = useState([])
  const [settings, setSettings] = useState(null)
  const [templates, setTemplates] = useState([])
  const [editor, setEditor] = useState(null)
  const [isNewProvider, setIsNewProvider] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [busy, setBusy] = useState(null) // 'save' | 'test' | 'provider'
  const [notice, setNotice] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([smsPanelApi.providers(), smsPanelApi.settings(), smsPanelApi.templates()]).then(([p, s, t]) => {
      if (!alive) return
      const failed = [p, s, t].find((result) => !result.isSuccess)
      if (failed) { setLoadError(errorText(failed, 'دریافت تنظیمات پنل پیامکی ممکن نشد.')); return }
      setProviderOptions(unwrap(p, []) || [])
      setSettings(normalizeSmsSettings(unwrap(s)?.sms))
      setTemplates(unwrap(t, []) || [])
    })
    return () => { alive = false }
  }, [])

  if (!settings) {
    return (
      <div className="profile-form sms-loading">
        {loadError ? <p className="login-error" role="alert">{loadError}</p> : <><LoaderCircle size={20} className="spin" />در حال دریافت تنظیمات پنل پیامکی...</>}
      </div>
    )
  }

  const locked = !canUpdate || busy !== null
  const selectedOption = providerOptions.find((item) => item.key === editor?.provider)
  const updateEditor = (changes) => setEditor((current) => (current ? { ...current, ...changes } : current))

  /** Stores the provider list; the screen then shows the settings exactly as the Core returns them. */
  async function persistProviders(providers) {
    const result = await smsPanelApi.saveSettings(smsSettingsBody(settings, providers))
    if (!result.isSuccess) throw new Error(errorText(result, 'ذخیره تنظیمات انجام نشد.'))
    const reloaded = await smsPanelApi.settings()
    setSettings(reloaded.isSuccess ? normalizeSmsSettings(unwrap(reloaded)?.sms) : { ...settings, providers })
  }

  async function runProviderChange(change, successText) {
    setBusy('provider'); setNotice(null)
    try {
      await change()
      setNotice({ type: 'success', text: successText })
      return true
    } catch (err) {
      setNotice({ type: 'error', text: err.message })
      return false
    } finally {
      setBusy(null)
    }
  }

  function addProvider() {
    setEditor({
      id: crypto.randomUUID(), name: '', provider: providerOptions[0]?.key ?? 'kavenegar', enabled: false,
      apiUrl: '', apiKey: '', lineNumber: '', username: '', password: '',
      apiKeyConfigured: false, usernameConfigured: false, passwordConfigured: false,
    })
    setIsNewProvider(true)
    setNotice(null)
  }

  async function saveProvider() {
    if (!editor) return
    if (!editor.name.trim()) { setNotice({ type: 'error', text: 'نام سرویس‌دهنده را وارد کنید.' }); return }
    if (editor.enabled && !editor.apiKey.trim() && !editor.apiKeyConfigured) {
      setNotice({ type: 'error', text: 'برای فعال‌کردن این سرویس‌دهنده، کلید API را وارد کنید.' })
      return
    }
    const item = { ...editor, name: editor.name.trim() }
    const list = isNewProvider ? [...settings.providers, item] : settings.providers.map((current) => (current.id === item.id ? item : current))
    // Only one provider sends at a time: turning this one on turns the others off.
    const providers = item.enabled ? list.map((current) => ({ ...current, enabled: current.id === item.id })) : list
    const ok = await runProviderChange(() => persistProviders(providers), isNewProvider ? 'سرویس‌دهنده اضافه شد.' : 'تغییرات سرویس‌دهنده ذخیره شد.')
    if (ok) setEditor(null)
  }

  async function deleteProvider(item) {
    if (!window.confirm(`سرویس‌دهنده «${item.name}» حذف شود؟`)) return
    const ok = await runProviderChange(() => persistProviders(settings.providers.filter((current) => current.id !== item.id)), 'سرویس‌دهنده حذف شد.')
    if (ok && editor?.id === item.id) setEditor(null)
  }

  async function setProviderActive(item, enabled) {
    if (enabled && !item.apiKeyConfigured && !item.apiKey.trim()) {
      setNotice({ type: 'error', text: 'برای فعال‌کردن سرویس‌دهنده، ابتدا کلید API آن را در بخش ویرایش ثبت کنید.' })
      return
    }
    await runProviderChange(
      () => persistProviders(settings.providers.map((current) => ({ ...current, enabled: enabled && current.id === item.id }))),
      enabled ? 'سرویس‌دهنده فعال شد.' : 'سرویس‌دهنده غیرفعال شد.',
    )
  }

  /** Saves the texts (and the provider list as it stands); false when something stopped it. */
  async function saveAll() {
    const active = settings.providers.find((item) => item.enabled)
    const hasKey = active?.apiKeyConfigured || active?.apiKey.trim()
    const hasLogin = (active?.usernameConfigured || active?.username.trim()) && (active?.passwordConfigured || active?.password)
    if (active && !hasKey && !hasLogin) {
      setNotice({ type: 'error', text: 'برای فعال کردن پنل پیامکی، کلید API یا نام کاربری و رمز عبور را وارد کنید.' })
      return false
    }
    const invalid = templates.map(validateSmsTemplate).find(Boolean)
    if (invalid) { setNotice({ type: 'error', text: invalid }); return false }
    await persistProviders(settings.providers)
    const saved = await smsPanelApi.saveTemplates(templates.map((t) => ({ key: t.key, text: t.text })))
    if (!saved.isSuccess) throw new Error(errorText(saved, 'ذخیره متن پیامک‌ها انجام نشد.'))
    setTemplates(unwrap(saved, templates) || templates)
    return true
  }

  async function handleSave() {
    setBusy('save'); setNotice(null)
    try {
      if (await saveAll()) setNotice({ type: 'success', text: 'تنظیمات و متن پیامک‌ها ذخیره شد.' })
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'ذخیره تنظیمات انجام نشد.' })
    } finally {
      setBusy(null)
    }
  }

  async function handleSaveAndTest() {
    if (!testPhone.trim()) { setNotice({ type: 'error', text: 'شماره موبایل آزمایشی را وارد کنید.' }); return }
    setBusy('test'); setNotice(null)
    try {
      if (canUpdate && !(await saveAll())) return
      const result = await smsPanelApi.test(testPhone.trim(), testMessage.trim())
      const value = unwrap(result)
      if (!result.isSuccess) setNotice({ type: 'error', text: errorText(result, 'ارسال پیامک آزمایشی انجام نشد.') })
      else setNotice({ type: value?.success === false ? 'error' : 'success', text: value?.message ? PersianMessages.error(value.message) : 'پیامک آزمایشی ارسال شد.' })
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'ارسال پیامک آزمایشی انجام نشد.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sms-panel">
      {notice && (
        <div className={`team-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.type === 'success' ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} title="بستن"><X size={14} /></button>
        </div>
      )}

      <section className="profile-form sms-card">
        <div className="sms-card-head">
          <div>
            <h3>سرویس‌دهنده پیامک</h3>
            <p>پیامک‌های سامانه از طریق این سرویس و توسط سرور ارسال می‌شوند.</p>
          </div>
          {canUpdate && <button type="button" className="sms-primary" onClick={addProvider} disabled={busy !== null}><Plus size={16} />افزودن سرویس</button>}
        </div>

        <div className="sms-providers">
          {settings.providers.length === 0 && <p className="sms-empty">هنوز سرویس‌دهنده‌ای ثبت نشده است.</p>}
          {settings.providers.map((item) => (
            <div key={item.id} className="sms-provider">
              <div>
                <strong>{item.name || 'سرویس‌دهنده پیامک'}</strong>
                <small className={item.enabled ? 'on' : ''}>{item.enabled ? 'فعال و در حال استفاده' : 'غیرفعال'}</small>
              </div>
              {canUpdate && (
                <div className="sms-provider-actions">
                  <button type="button" className={item.enabled ? 'sms-off' : 'sms-on'} onClick={() => setProviderActive(item, !item.enabled)} disabled={busy !== null}>{item.enabled ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
                  <button type="button" className="sms-edit" onClick={() => { setEditor({ ...item }); setIsNewProvider(false); setNotice(null) }} disabled={busy !== null}><Pencil size={14} />ویرایش</button>
                  <button type="button" className="sms-delete" onClick={() => deleteProvider(item)} disabled={busy !== null}><Trash2 size={14} />حذف</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {editor && (
          <div className="sms-editor">
            <div className="sms-editor-head">
              <h4>{isNewProvider ? 'افزودن سرویس‌دهنده' : `ویرایش ${editor.name}`}</h4>
              <button type="button" className="team-icon-button" onClick={() => setEditor(null)} disabled={busy !== null} aria-label="بستن فرم سرویس‌دهنده"><X size={16} /></button>
            </div>
            <label className="sms-switch">
              <input type="checkbox" checked={editor.enabled} onChange={(e) => updateEditor({ enabled: e.target.checked })} disabled={locked} />
              <span className="sms-switch-track" aria-hidden="true" />
              <span><strong>فعال بودن این سرویس‌دهنده</strong><small>فقط یک سرویس‌دهنده می‌تواند هم‌زمان برای ارسال پیامک فعال باشد.</small></span>
            </label>
            <div className="sms-fields">
              <label>سرویس‌دهنده (Service Provider) *
                <input value={editor.name} onChange={(e) => updateEditor({ name: e.target.value })} disabled={locked} placeholder="مثلاً پنل پیامکی شرکت ..." />
                <small>نامی که برای تشخیص این پنل در سامانه نمایش داده می‌شود</small>
              </label>
              {providerOptions.length > 1 && (
                <label>نوع پنل
                  <select value={editor.provider} onChange={(e) => updateEditor({ provider: e.target.value })} disabled={locked}>
                    {providerOptions.map((option) => <option key={option.key} value={option.key}>{option.displayName}</option>)}
                  </select>
                </label>
              )}
              <label>آدرس سرویس (Base URL)
                <input value={editor.apiUrl} onChange={(e) => updateEditor({ apiUrl: e.target.value })} disabled={locked} placeholder={selectedOption?.defaultBaseUrl} dir="ltr" />
                {selectedOption && <small>خالی = آدرس رسمی: {selectedOption.defaultBaseUrl}</small>}
              </label>
              <label>کلید API (API Key)
                <input type="password" value={editor.apiKey} onChange={(e) => updateEditor({ apiKey: e.target.value })} disabled={locked} autoComplete="new-password" placeholder={editor.apiKeyConfigured ? '••••••••••••' : ''} dir="ltr" />
                <small>{editor.apiKeyConfigured ? 'کلید فعلی نمایش داده نمی‌شود؛ برای تغییر، کلید جدید را وارد کنید.' : 'برای کاوه‌نگار الزامی است.'}</small>
              </label>
              <label>نام کاربری پنل (اختیاری)
                <input value={editor.username} onChange={(e) => updateEditor({ username: e.target.value })} disabled={locked} autoComplete="off" placeholder={editor.usernameConfigured ? '••••••••' : ''} dir="ltr" />
                <small>{editor.usernameConfigured ? 'نام کاربری فعلی نمایش داده نمی‌شود؛ برای تغییر، مقدار جدید را وارد کنید.' : 'کاوه‌نگار به این مورد نیاز ندارد.'}</small>
              </label>
              <label>رمز عبور پنل (اختیاری)
                <input type="password" value={editor.password} onChange={(e) => updateEditor({ password: e.target.value })} disabled={locked} autoComplete="new-password" placeholder={editor.passwordConfigured ? '••••••••••••' : ''} dir="ltr" />
                <small>{editor.passwordConfigured ? 'رمز فعلی نمایش داده نمی‌شود؛ برای تغییر، رمز جدید را وارد کنید.' : 'کاوه‌نگار به این مورد نیاز ندارد.'}</small>
              </label>
              <label>شماره فرستنده (اختیاری)
                <input value={editor.lineNumber} onChange={(e) => updateEditor({ lineNumber: toLatinDigits(e.target.value).replace(/\D/g, '') })} disabled={locked} inputMode="numeric" dir="ltr" />
                <small>خالی = خط پیش‌فرض حساب</small>
              </label>
            </div>
            <div className="sms-actions">
              <button type="button" className="sms-secondary" onClick={() => setEditor(null)} disabled={busy !== null}>انصراف</button>
              <button type="button" className="profile-save" onClick={saveProvider} disabled={busy !== null}>{busy === 'provider' ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}{isNewProvider ? 'ثبت سرویس‌دهنده' : 'ذخیره تغییرات'}</button>
            </div>
          </div>
        )}
      </section>

      <section className="profile-form sms-card">
        <h3><MessageSquareText size={18} />متن پیامک‌ها</h3>
        <p className="sms-hint">عبارت‌های داخل آکولاد هنگام ارسال با مقدار واقعی جایگزین می‌شوند. عبارت‌های ستاره‌دار باید در متن بمانند.</p>
        {templates.length === 0 && <p className="sms-hint">متنی برای ویرایش وجود ندارد.</p>}
        <div className="sms-templates">
          {templates.map((template, index) => {
            const error = validateSmsTemplate(template)
            const required = new Set((template.requiredPlaceholders || []).map((p) => p.toLowerCase()))
            const update = (text) => setTemplates((list) => list.map((t, i) => (i === index ? { ...t, text } : t)))
            return (
              <div key={template.key} className="sms-template">
                <div className="sms-template-head">
                  <div>
                    <strong>{template.title}</strong>
                    <small dir="ltr">{template.key}</small>
                  </div>
                  {template.defaultText && template.text !== template.defaultText && canUpdate && (
                    <button type="button" className="sms-reset" onClick={() => update(template.defaultText)}><RotateCcw size={12} />متن پیش‌فرض</button>
                  )}
                </div>
                {/* Always rendered (empty when there is none) so each row of the grid lines up. */}
                <p className="sms-hint">{template.description || ''}</p>
                <textarea value={template.text} maxLength={SMS_TEMPLATE_MAX_LENGTH} disabled={!canUpdate} aria-label={template.title} aria-invalid={error ? true : undefined} onChange={(e) => update(e.target.value)} />
                <span className="sms-placeholders">
                  {(template.placeholders || []).map((placeholder) => (
                    <button key={placeholder} type="button" disabled={!canUpdate} title={required.has(placeholder.toLowerCase()) ? 'الزامی' : 'افزودن به متن'} onClick={() => update(`${template.text}{${placeholder}}`)} dir="ltr">
                      {`{${placeholder}}`}{required.has(placeholder.toLowerCase()) && <em>*</em>}
                    </button>
                  ))}
                </span>
                <p className="sms-error" role={error ? 'alert' : undefined}>{error || ''}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="profile-form sms-card">
        <h3><Send size={18} />ارسال آزمایشی</h3>
        <div className="sms-test-fields">
          <label>شماره موبایل آزمایشی
            <input value={testPhone} onChange={(e) => setTestPhone(toLatinDigits(e.target.value))} inputMode="tel" placeholder="09121234567" dir="ltr" />
          </label>
          <label>متن آزمایشی
            <input value={testMessage} onChange={(e) => setTestMessage(e.target.value)} maxLength={500} placeholder="پیامک آزمایشی سامانه" />
          </label>
        </div>
        <div className="sms-actions">
          {canUpdate && <button type="button" className="sms-secondary" onClick={handleSave} disabled={busy !== null}>{busy === 'save' ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}ذخیره تنظیمات</button>}
          {canTest && <button type="button" className="profile-save" onClick={handleSaveAndTest} disabled={busy !== null}>{busy === 'test' ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}{canUpdate ? 'ذخیره و ارسال تست' : 'ارسال تست'}</button>}
        </div>
      </section>
    </div>
  )
}

/* «ظاهر سامانه»: per-user accent palette and background pattern, stored on the user
   (PUT /auth/me/preferences: colorPalette and theme) so they follow the user to any device. */
const COLOR_PALETTES = [
  { id: 'navy', name: 'سرمه‌ای روزت (پیش‌فرض)', preview: 'linear-gradient(110deg, #071944, #0f477d 70%, #1d766f)' },
  { id: 'indigo', name: 'نیلی / بنفش', preview: 'linear-gradient(110deg, #4f46e5, #7c3aed)' },
  { id: 'emerald', name: 'زمردی / سبز', preview: 'linear-gradient(110deg, #059669, #0d9488)' },
  { id: 'rose', name: 'سرخ / گلبهی', preview: 'linear-gradient(110deg, #e11d48, #db2777)' },
  { id: 'amber', name: 'طلایی / کهربایی', preview: 'linear-gradient(110deg, #d97706, #ea580c)' },
  { id: 'cyan', name: 'فیروزه‌ای / آبی', preview: 'linear-gradient(110deg, #0891b2, #2563eb)' },
  { id: 'slate', name: 'زغالی / تیره', preview: 'linear-gradient(110deg, #334155, #0f172a)' },
]
const BACKGROUND_PATTERNS = [
  { id: 'default', name: 'ساده و مدرن', description: 'زمینه خنثی' },
  { id: 'checkerboard', name: 'طرح شطرنجی', description: 'مربع‌های ریز' },
  { id: 'diagonal', name: 'خطوط مورب', description: 'خطوط اریب' },
  { id: 'grid', name: 'طرح شبکه‌ای', description: 'جدول هندسی' },
  { id: 'dots', name: 'طرح نقطه‌ای', description: 'نقطه‌چین ظریف' },
  { id: 'cross', name: 'چهارخانه', description: 'متقاطع ریز' },
  { id: 'waves', name: 'طرح موجی', description: 'قوس‌های دایره‌ای' },
]

const THEME_MODES = [
  { id: 'light', name: 'طرح روشن (روز)', icon: Sun },
  { id: 'dark', name: 'طرح تیره (شب)', icon: Moon },
]

/** The user's saved mode/palette/pattern ids, or the defaults for missing or unknown values. */
function appearanceOf(user) {
  return {
    mode: user?.themeMode === 'dark' ? 'dark' : 'light',
    palette: COLOR_PALETTES.some((p) => p.id === user?.colorPalette) ? user.colorPalette : 'navy',
    pattern: BACKGROUND_PATTERNS.some((p) => p.id === user?.theme) ? user.theme : 'default',
  }
}

function AppearanceTab() {
  const { user, can, refreshMe } = useAuth()
  const { mode, palette, pattern } = appearanceOf(user)
  const [pending, setPending] = useState('') // the option being saved
  const [notice, setNotice] = useState(null)

  async function save(change, key) {
    if (pending) return
    setPending(key); setNotice(null)
    const next = { mode, palette, pattern, ...change }
    const result = await accountApi.updatePreferences({
      colorPalette: next.palette === 'navy' ? null : next.palette,
      theme: next.pattern === 'default' ? null : next.pattern,
      themeMode: next.mode,
    })
    if (result.isSuccess) await refreshMe()
    else setNotice({ type: 'error', text: PersianMessages.error(result.error) })
    setPending('')
  }

  return (
    <>
      {notice && (
        <div className={`team-notice ${notice.type} appearance-notice`} role="alert">
          <span><CircleAlert size={16} />{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} title="بستن"><X size={14} /></button>
        </div>
      )}

      {can('settings.update') && <UploadLimitCard />}

      <CollapsibleCard icon={Sun} title="حالت روز / شب (طرح روشن و تیره)">
        <div className="appearance-grid modes">
          {THEME_MODES.map(({ id, name, icon: Icon }) => (
            <button key={id} type="button" className={`appearance-option mode-option${mode === id ? ' active' : ''}`} onClick={() => save({ mode: id }, `mode:${id}`)} disabled={!!pending} aria-pressed={mode === id}>
              <span><Icon size={20} className={`mode-icon ${id}`} /><strong>{name}</strong></span>
              {pending === `mode:${id}` ? <LoaderCircle size={16} className="spin" /> : mode === id && <Check size={16} className="mode-check" />}
            </button>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard icon={Palette} title="پالت رنگی اصلی سامانه">
        <p className="appearance-hint">رنگ دکمه‌ها، منوی فعال، بنر و حاشیه‌ها هم‌زمان تغییر می‌کند و برای حساب شما ذخیره می‌شود.</p>
        <div className="appearance-grid palettes">
          {COLOR_PALETTES.map((option) => (
            <button key={option.id} type="button" className={`appearance-option${palette === option.id ? ' active' : ''}`} onClick={() => save({ palette: option.id }, `palette:${option.id}`)} disabled={!!pending} aria-pressed={palette === option.id}>
              <span className="appearance-swatch" style={{ background: option.preview }}>
                {pending === `palette:${option.id}` ? <LoaderCircle size={14} className="spin" /> : palette === option.id && <Check size={13} />}
              </span>
              <strong>{option.name}</strong>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard icon={Grid3x3} title="طرح بافت زمینه (پترن گرافیکی)">
        <p className="appearance-hint">الگوی زمینه‌ی صفحه‌ها؛ با رنگ پالت انتخابی کشیده می‌شود و برای حساب شما ذخیره می‌شود.</p>
        <div className="appearance-grid patterns">
          {BACKGROUND_PATTERNS.map((option) => (
            <button key={option.id} type="button" className={`appearance-option${pattern === option.id ? ' active' : ''}`} onClick={() => save({ pattern: option.id }, `pattern:${option.id}`)} disabled={!!pending} aria-pressed={pattern === option.id}>
              <span className={`appearance-swatch pattern-preview pattern-${option.id}`}>
                {pending === `pattern:${option.id}` ? <LoaderCircle size={14} className="spin" /> : pattern === option.id && <Check size={13} />}
              </span>
              <strong>{option.name}</strong>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      </CollapsibleCard>
    </>
  )
}

/** Admin only (settings.update): the system-wide maximum upload size, in KB. */
function UploadLimitCard() {
  const [valueKb, setValueKb] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let alive = true
    uploadPolicyApi.get().then((result) => {
      if (!alive) return
      setValueKb(String(unwrap(result)?.maxFileSizeKb ?? 200))
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  async function submit(event) {
    event.preventDefault()
    const kb = Number(valueKb)
    if (!Number.isFinite(kb) || kb <= 0) { setNotice({ type: 'error', text: 'مقدار واردشده معتبر نیست.' }); return }
    setSaving(true); setNotice(null)
    const result = await uploadPolicyApi.setMaxFileSizeKb(Math.max(1, Math.round(kb)))
    setSaving(false)
    setNotice(result.isSuccess
      ? { type: 'success', text: 'حداکثر حجم فایل آپلودی ذخیره شد.' }
      : { type: 'error', text: PersianMessages.error(result.error) })
  }

  return (
    <CollapsibleCard icon={CloudUpload} title="محدودیت حجم فایل آپلودی">
      {notice && (
        <div className={`team-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.type === 'success' ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} title="بستن"><X size={14} /></button>
        </div>
      )}
      <form className="upload-limit-form" onSubmit={submit}>
        <label>حداکثر حجم مجاز (کیلوبایت)
          <input type="number" min={1} value={valueKb} onChange={(e) => setValueKb(e.target.value)} disabled={loading} dir="ltr" />
          <small>پیش‌فرض: ۲۰۰ کیلوبایت</small>
        </label>
        <button type="submit" className="profile-save" disabled={saving || loading}>{saving ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}ذخیره</button>
      </form>
      <p className="appearance-hint">این مقدار برای بارگذاری فایل در کل سامانه اعمال می‌شود.</p>
    </CollapsibleCard>
  )
}

const TEAM_MANAGER_ROLE = 'مدیر تیم'
const TEAM_MEMBER_ROLE = 'عضو تیم'

/** Every user of the tenant (the Core pages /users at 100 at most). */
async function loadAllTenantUsers(tenantId) {
  const users = []
  for (let page = 1; page <= 50; page += 1) {
    const result = await usersApi.list({ tenantId, pageNumber: page, pageSize: 100 })
    if (!result.isSuccess) return { users, error: result.error }
    const value = unwrap(result) || {}
    users.push(...(value.items || []))
    if (!value.items?.length || users.length >= (value.totalCount ?? 0) || page >= (value.totalPages ?? page)) break
  }
  return { users, error: null }
}

/**
 * «تیم کاری من»: the teams the user belongs to (their own and others'). With groups.manage_own
 * they build teams and choose the members of the ones they own; the rest is read only. Every
 * change goes to the server first and the screen then shows the teams exactly as it returns them.
 */
function MyWorkTeams() {
  const { user, can } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const canBuildTeams = can('groups.manage_own')

  const [teams, setTeams] = useState([])
  const [activeTeamId, setActiveTeamId] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [memberScope, setMemberScope] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null) // { type: 'success' | 'error', text }
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  async function fetchTeams() {
    const result = await myTeamsApi.list()
    if (!result.isSuccess) throw new Error(PersianMessages.error(result.error))
    return (unwrap(result, []) || []).filter((team) => team.isActive)
  }

  useEffect(() => {
    let alive = true
      ; (async () => {
        setLoading(true)
        try {
          const list = await fetchTeams()
          if (!alive) return
          setTeams(list)
          setActiveTeamId(list[0]?.id || '')
          // The people to add are only needed by a team builder (groups.manage_own brings users.view).
          if (canBuildTeams) {
            const [{ users }, scopeResult] = await Promise.all([loadAllTenantUsers(tenantId), myTeamsApi.memberScope()])
            if (!alive) return
            setAllUsers(users)
            // Without an organization structure (or if the call fails) nobody is filtered out
            // here - the server still refuses whoever it does not allow.
            setMemberScope(unwrap(scopeResult))
          }
        } catch (err) {
          if (alive) setNotice({ type: 'error', text: err.message })
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => { alive = false }
  }, [user?.id, tenantId, canBuildTeams])

  const activeTeam = teams.find((team) => team.id === activeTeamId) || teams[0] || null
  const canManageActiveTeam = canBuildTeams && !!activeTeam && activeTeam.ownerUserId === user?.id
  const usersById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers])

  /** Sends one change, then reloads the teams from the server. False when it failed. */
  async function applyChange(send, successText, nextActiveId) {
    if (saving) return false
    setSaving(true)
    try {
      const result = await send()
      if (!result.isSuccess) throw new Error(PersianMessages.error(result.error))
      const list = await fetchTeams()
      setTeams(list)
      const preferred = nextActiveId === undefined ? unwrap(result)?.id : nextActiveId
      setActiveTeamId(list.some((team) => team.id === preferred) ? preferred : list[0]?.id || '')
      setNotice({ type: 'success', text: successText })
      return true
    } catch (err) {
      setNotice({ type: 'error', text: err.message || 'تغییر تیم کاری ذخیره نشد. لطفاً دوباره تلاش کنید.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  async function createTeam(event) {
    event.preventDefault()
    const name = newTeamName.trim()
    if (!name) return
    if (await applyChange(() => myTeamsApi.create(name), `تیم کاری جدید «${name}» با موفقیت ایجاد شد.`)) {
      setNewTeamName('')
      setCreating(false)
    }
  }

  const memberIds = (team) => (team?.members || []).map((member) => member.userId)

  function addMember(candidate) {
    if (!canManageActiveTeam) return
    if (memberIds(activeTeam).includes(candidate.id)) {
      setNotice({ type: 'error', text: 'این کاربر قبلاً در تیم قرار دارد.' })
      return
    }
    applyChange(
      () => myTeamsApi.setMembers(activeTeam.id, [...memberIds(activeTeam), candidate.id]),
      `«${candidate.displayName || candidate.username}» به تیم ${activeTeam.name} اضافه شد.`,
    )
  }

  function removeMember(memberUserId) {
    if (!canManageActiveTeam) return
    if (memberUserId === user?.id) {
      setNotice({ type: 'error', text: 'امکان حذف سازنده تیم وجود ندارد.' })
      return
    }
    applyChange(
      () => myTeamsApi.setMembers(activeTeam.id, memberIds(activeTeam).filter((id) => id !== memberUserId)),
      'عضو موردنظر از تیم حذف شد.',
    )
  }

  function deleteTeam() {
    if (!canManageActiveTeam) return
    if (!window.confirm(`آیا از حذف تیم کاری «${activeTeam.name}» اطمینان دارید؟`)) return
    applyChange(() => myTeamsApi.remove(activeTeam.id), 'تیم کاری حذف شد.', null)
  }

  // Search results: active colleagues the server would accept; members already in the active
  // team stay listed, marked as such.
  const allowedIds = memberScope?.limited ? new Set(memberScope.allowedUserIds || []) : null
  const query = searchTerm.trim().toLowerCase()
  const candidates = query
    ? allUsers.filter((u) =>
      u.id !== user?.id
      && u.isActive !== false
      && (!allowedIds || allowedIds.has(u.id))
      && [u.displayName, u.username, u.email].some((value) => (value || '').toLowerCase().includes(query)))
    : []

  const avatarOf = (person, fallbackName) => {
    const url = person?.avatarUrl
    return url ? <img src={url} alt="" /> : <span>{initialsOf(fallbackName || person?.displayName || person?.username)}</span>
  }

  return (
    <div className="work-teams">
      {notice && (
        <div className={`team-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.type === 'success' ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} title="بستن"><X size={14} /></button>
        </div>
      )}

      <div className="team-bar">
        <div className="team-chips">
          {teams.length === 0 ? (
            <span className="team-empty">شما هنوز عضو هیچ تیم کاری نیستید.</span>
          ) : teams.map((team) => (
            <button key={team.id} type="button" className={activeTeam?.id === team.id ? 'active' : ''} onClick={() => setActiveTeamId(team.id)}>
              <Users size={14} />{team.name}<small>({(team.members || []).length})</small>
            </button>
          ))}
        </div>
        {canBuildTeams && (
          <button type="button" className="team-create-toggle" onClick={() => setCreating((value) => !value)}>
            <Plus size={16} />ساخت تیم کاری جدید
          </button>
        )}
      </div>

      {canBuildTeams && creating && (
        <form className="team-create-form" onSubmit={createTeam}>
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="نام تیم کاری (مثلاً: تیم پروژه طراحی UI)" maxLength={128} required autoFocus />
          <button type="submit" disabled={saving || !newTeamName.trim()}>{saving && <LoaderCircle size={14} className="spin" />}ایجاد تیم</button>
          <button type="button" className="team-icon-button" onClick={() => setCreating(false)} title="انصراف"><X size={16} /></button>
        </form>
      )}

      {loading ? (
        <div className="team-loading"><LoaderCircle size={20} className="spin" />در حال بارگذاری اعضا و تیم‌های کاری...</div>
      ) : activeTeam ? (
        <>
          <div className="team-panel">
            <div className="team-panel-head">
              <div>
                <h4><Users size={16} />تیم کاری: {activeTeam.name}</h4>
                <small>تعداد اعضا: {(activeTeam.members || []).length} نفر</small>
              </div>
              {canManageActiveTeam && (
                <button type="button" className="team-danger" onClick={deleteTeam} disabled={saving}><Trash2 size={14} />حذف تیم</button>
              )}
            </div>

            {!canManageActiveTeam && (
              <p className="team-readonly">شما عضو این تیم هستید؛ اعضا را می‌توانید ببینید و در گفتگوی داخلی با آن‌ها صحبت کنید. مدیریت اعضا فقط با مدیر تیم است.</p>
            )}

            {canManageActiveTeam && (
              <div className="team-search">
                <label htmlFor="team-member-search">جستجو و اضافه کردن کاربر به {activeTeam.name}:</label>
                {memberScope?.limited && (
                  <p className="team-scope-hint">
                    {memberScope.scopeName ? `فقط همکاران معاونت «${memberScope.scopeName}» را می‌توانید به تیم اضافه کنید.` : 'فقط همکاران معاونت خودتان را می‌توانید به تیم اضافه کنید.'}
                  </p>
                )}
                <div className="team-search-input">
                  <Search size={16} />
                  <input id="team-member-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="نام یا نام کاربری همکار خود را جستجو کنید..." />
                </div>
                {query && (
                  <div className="team-results">
                    {candidates.length === 0 ? (
                      <p className="team-results-empty">کاربری با این مشخصات پیدا نشد.</p>
                    ) : candidates.map((candidate) => {
                      const inTeam = memberIds(activeTeam).includes(candidate.id)
                      return (
                        <div key={candidate.id} className="team-person">
                          <div className="team-person-info">
                            <span className="team-avatar">{avatarOf(candidate)}</span>
                            <div>
                              <strong>{candidate.displayName || candidate.username}</strong>
                              <small dir="ltr">{candidate.username}{candidate.email ? ` (${candidate.email})` : ''}</small>
                            </div>
                          </div>
                          <button type="button" className="team-add" disabled={inTeam || saving} onClick={() => addMember(candidate)}>
                            <UserPlus size={14} />{inTeam ? 'عضو تیم' : 'افزودن به تیم'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="team-members">
            <h5><span>لیست اعضای فعلی {activeTeam.name}:</span><small>{(activeTeam.members || []).length} عضو</small></h5>
            {(activeTeam.members || []).map((member) => {
              const isOwner = member.userId === activeTeam.ownerUserId
              const person = usersById.get(member.userId)
              return (
                <div key={member.userId} className="team-person">
                  <div className="team-person-info">
                    <span className="team-avatar">{avatarOf(person, member.displayName)}</span>
                    <div>
                      <strong>{member.displayName}<em className={isOwner ? 'owner' : ''}>{isOwner ? TEAM_MANAGER_ROLE : TEAM_MEMBER_ROLE}</em></strong>
                      {(person?.username || member.email) && <small dir="ltr">{person?.username || member.email}</small>}
                    </div>
                  </div>
                  {canManageActiveTeam && member.userId !== user?.id && (
                    <button type="button" className="team-danger" onClick={() => removeMember(member.userId)} disabled={saving} title="حذف از تیم"><Trash2 size={14} />حذف</button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

function ProfileTab() {
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
    <>
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
      <ProfileEditCard />
      <ChangePasswordCard />
    </>
  )
}

/** Avatar, mobile number and SMS notifications - the fields the self-service endpoint allows. */
function ProfileEditCard() {
  const { user, refreshMe } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '')
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '')
  const [notifySms, setNotifySms] = useState(user?.notifySms ?? true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const fileRef = useRef(null)

  // Re-sync only when the signed-in user actually changes, not on every background /me refresh -
  // otherwise a pending edit would be wiped out from under the person typing it.
  useEffect(() => {
    setAvatarUrl(user?.avatarUrl || '')
    setPhoneNumber(user?.phoneNumber || '')
    setNotifySms(user?.notifySms ?? true)
  }, [user?.id])

  async function onPickAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setAvatarError('یک فایل تصویری انتخاب کنید.'); return }
    setAvatarError('')
    try {
      let dataUrl = await compressImageToDataUrl(file, 220, 0.8)
      if (dataUrl.length * 0.75 > AVATAR_MAX_BYTES) dataUrl = await compressImageToDataUrl(file, 160, 0.65)
      setAvatarUrl(dataUrl)
      setMessage('')
    } catch {
      setAvatarError('بارگذاری تصویر انجام نشد.')
    }
  }

  async function save() {
    setBusy(true); setError(''); setAvatarError(''); setMessage('')
    const result = await accountApi.updateProfile({
      displayName: user?.displayName || '',
      avatarUrl: avatarUrl || null,
      phoneNumber: phoneNumber.trim() || null,
      notifySms,
    })
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    await refreshMe()
    setMessage('تغییرات ذخیره شد.')
  }

  return (
    <CollapsibleCard icon={UserRound} title="پروفایل و آواتار کاربری">
      {avatarError && <p className="login-error" role="alert">{avatarError}</p>}
      <div className="avatar-panel">
        <div className="avatar-picker">
          {avatarUrl ? <img src={avatarUrl} alt="آواتار" /> : <span className="avatar">{initialsOf(user?.displayName)}</span>}
          <button type="button" onClick={() => fileRef.current?.click()} title="بارگذاری تصویر شخصی"><Camera size={15} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickAvatar} />
        </div>
        <div className="avatar-panel-body">
          <h4>تصویر آواتار کاربر</h4>
          <p>می‌توانید از آلبوم آواتارهای پیش‌فرض انتخاب کنید یا تصویر دلخواه خود را بارگذاری نمایید.</p>
          <div className="avatar-notice">
            <strong><i />حجم قابل قبول: حداکثر ۲۰۰ کیلوبایت (200 KB)</strong>
            <small>فرمت‌های مجاز: JPG, PNG, WEBP, GIF (تصاویر بزرگ‌تر به‌صورت خودکار فشرده‌سازی می‌شوند).</small>
          </div>
          <button type="button" className="avatar-upload" onClick={() => fileRef.current?.click()}><Upload size={16} />بارگذاری تصویر شخصی (حداکثر ۲۰۰ KB)</button>
        </div>
      </div>

      <span className="profile-field-label">انتخاب از آلبوم آواتارهای پیش‌فرض:</span>
      <div className="avatar-album">
        {PRESET_AVATARS.map((avatar) => (
          <button key={avatar.id} type="button" title={avatar.name} className={avatarUrl === avatar.url ? 'active' : ''} onClick={() => { setAvatarUrl(avatar.url); setMessage('') }}>
            <img src={avatar.url} alt={avatar.name} />
          </button>
        ))}
      </div>

      {/* Identity fields are shown for reference; changing them needs an administrator. */}
      <div className="profile-identity">
        <label>نام و نام خانوادگی *<input value={user?.displayName || ''} readOnly title="نام ثبت‌شده در پروفایل شخصی قابل تغییر نیست." /></label>
        <label>نام کاربری (ورود به سیستم)<input value={user?.username || ''} readOnly dir="ltr" title="نام کاربری فقط توسط مدیر سامانه قابل تغییر است." /></label>
      </div>
      <p className="avatar-hint">نام، نام خانوادگی و شناسهٔ ورود از این صفحه قابل ویرایش نیستند. برای اصلاح اطلاعات هویتی با مدیر سامانه تماس بگیرید.</p>

      <span className="profile-field-label profile-section-title"><Bell size={16} />اطلاع‌رسانی پیامکی</span>
      <div className="profile-sms-grid">
        <label><span className="profile-label-icon"><Smartphone size={15} />شماره تلفن همراه (ورود و پیامک):</span><input value={phoneNumber} onChange={(e) => { setPhoneNumber(e.target.value); setMessage('') }} placeholder="09121234567" dir="ltr" inputMode="tel" autoComplete="tel" /></label>
        <span />
        <label className={`profile-sms-toggle${notifySms ? ' active' : ''}`}>
          <span><MessageCircle size={16} />اطلاع‌رسانی با پیامک (SMS)</span>
          <input type="checkbox" checked={notifySms} onChange={(e) => { setNotifySms(e.target.checked); setMessage('') }} />
        </label>
      </div>

      {/* Next to the save button, so the outcome is seen without scrolling back up. */}
      {error && <p className="login-error" role="alert">{error}</p>}
      {message && <p className="profile-success">{message}</p>}
      <div className="profile-actions">
        <button className="profile-save" onClick={save} disabled={busy}><Check size={16} />{busy ? 'در حال ذخیره...' : 'ذخیره آواتار و تنظیمات پیامک'}</button>
      </div>
    </CollapsibleCard>
  )
}

/** A settings card whose body folds away under its title; starts closed. */
function CollapsibleCard({ icon: Icon, title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`profile-form collapsible-card${open ? ' open' : ''}`}>
      <button type="button" className="collapsible-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><Icon size={18} />{title}</span>
        <ChevronDown size={18} />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  )
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save() {
    setError(''); setMessage('')
    if (newPassword.length < 8) { setError('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.'); return }
    if (newPassword !== confirm) { setError('تکرار رمز عبور با رمز جدید یکسان نیست.'); return }
    setBusy(true)
    const result = await accountApi.changePassword(currentPassword, newPassword)
    setBusy(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    setCurrentPassword(''); setNewPassword(''); setConfirm('')
    setMessage('رمز عبور شما تغییر کرد.')
  }

  return (
    <CollapsibleCard icon={LockKeyhole} title="تغییر رمز عبور">
      <label>رمز عبور فعلی<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" /></label>
      <label>رمز عبور جدید (حداقل ۸ کاراکتر)<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></label>
      <label>تکرار رمز عبور جدید<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      {message && <p className="profile-success">{message}</p>}
      <div className="profile-actions">
        <button className="profile-save" onClick={save} disabled={busy}><KeyRound size={16} />{busy ? 'در حال ذخیره...' : 'تغییر رمز عبور'}</button>
      </div>
    </CollapsibleCard>
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
  const { mode, palette, pattern } = appearanceOf(user)

  // Palette and mode live on <html> so everything (menus, modals, dropdowns) picks them up;
  // they are removed again on sign-out so the login page keeps Rozet's own light colors.
  useEffect(() => {
    const root = document.documentElement
    if (palette === 'navy') root.removeAttribute('data-palette')
    else root.setAttribute('data-palette', palette)
    return () => root.removeAttribute('data-palette')
  }, [palette])

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'dark') root.setAttribute('data-mode', 'dark')
    else root.removeAttribute('data-mode')
    return () => root.removeAttribute('data-mode')
  }, [mode])

  return (
    <div className={`app-shell pattern-${pattern}`} dir="rtl">
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
          ) : active === 'چت و گفت‌وگوی آنلاین' ? (
            <ChatPage />
          ) : active === 'مدیریت کاربران' ? (
            <UserManagement />
          ) : active === userProfileLabel ? (
            <SystemSettings />
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
