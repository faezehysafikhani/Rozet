import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiBlobRequest, knowledgeApi, reportingApi } from './services/api'
import {
  Bell,
  BookOpen,
  Boxes,
  Building2,
  CalendarCheck,
  ArrowDownUp,
  Camera,
  Check,
  CalendarDays,
  CalendarRange,
  ChartNoAxesCombined,
  CheckCircle2,
  ClipboardCheck,
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
  Download,
  Trash2,
  Sun,
  Moon,
} from 'lucide-react'
import { AuthProvider, Can, useAuth } from './services/AuthContext'
import { PersianMessages, actionsApi, changeRequestsApi, contractsApi, costReportApi, groupsApi, identityApi, labelForModule, labelForPermission, orgChartApi, permissionsApi, platformApi, projectManagementApi, rolesApi, suppliersApi, unwrap, usersApi, workflowApi, accountApi, myTeamsApi, smsPanelApi, uploadPolicyApi } from './services/api'
import { DEFAULT_TENANT_ID } from './services/config'
import { useChat } from './hooks/useChat'
import { useNotifications } from './hooks/useNotifications'
import DocumentsPage from './features/project-management/documents/DocumentsPage'
import CalendarPage from './features/project-management/calendar/CalendarPage'
import ProjectsSection from './features/project-management/projects/ProjectsSection'
import BoardPage from './features/task-management/board/BoardPage'
import AllTasksPage from './features/task-management/AllTasksPage'
import TaskDashboardPage from './features/task-management/TaskDashboardPage'
import MeetingsPage from './features/meetings/MeetingsPage'
import RaciPage from './features/raci/RaciPage'
import WorkflowPage from './features/workflow/WorkflowPage'
import StrategyPage from './features/project-management/strategy/StrategyPage'
import ProgressPage from './features/project-management/progress/ProgressPage'
import PlanToolsPanel from './features/project-management/baselines/PlanToolsPanel'
import SchedulePanel from './features/project-management/schedule/SchedulePanel'
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
const stakeholderLevelLabels = { 0: 'کم', 1: 'متوسط', 2: 'زیاد', Low: 'کم', Medium: 'متوسط', High: 'زیاد' }
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



const approvalLabels = { 0: 'ثبت اولیه', 1: 'در انتظار تأیید', 2: 'تأیید شده', 3: 'رد شده', NotSubmitted: 'ثبت اولیه', PendingApproval: 'در انتظار تأیید', Approved: 'تأیید شده', Rejected: 'رد شده' }

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
  task: 'ایجاد وظیفه',
  activity: 'افزودن فعالیت برنامه‌ریزی',
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
  task: { title: '', description: '', responsibleUserId: '', approverUserId: '', dueDate: '', priority: '1', sprintNumber: '' },
  activity: { name: '', description: '', responsibleUserId: '', approverUserId: '', startDate: '', endDate: '', durationDays: '', manHours: '', weight: '1' },
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
    if (!selectedProjectId) {
      setError('ابتدا یک پروژه انتخاب کنید.')
      return
    }
    setBusy(true)
    setError('')
    const base = { tenantId: data.tenantId, projectId: selectedProjectId }
    const result = await ({
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

function ProjectPlanning({ data }) {
  const [planVersion, setPlanVersion] = useState(0)
  return (
    <>
      <ProjectsSection data={data} />
      <SchedulePanel data={data} externalReloadKey={planVersion} />
      <PlanToolsPanel data={data} onPlanChanged={() => { setPlanVersion((value) => value + 1); data.refresh() }} />
    </>
  )
}

const toLatinDigits = (value) => String(value || '')
  .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** Dialogs are drawn straight into <body>: inside the page content they would sit under the top bar. */
function ModalPortal({ children }) {
  return createPortal(children, document.body)
}

function CtlField({ label, children, hint, required, wide }) {
  return (
    <label className={`ue-field${wide ? ' ue-field--wide' : ''}`}>
      <span>{label}{required && <b className="ue-required"> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function ControlDialog({ title, icon: Icon, subtitle, size, onClose, footer, children }) {
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
    <ControlDialog
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
            <CtlField label="وضعیت پاسخ" required><select value={status} onChange={(e) => setStatus(e.target.value)}>{Object.entries(riskResponseLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
            <CtlField label="توضیح" wide><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} /></CtlField>
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
    </ControlDialog>
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
    <ControlDialog
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
    </ControlDialog>
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
    <ControlDialog
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
            <CtlField key={key} label={stakeholderQuadrantLabels[quadrant]} wide>
              <textarea rows={2} value={form[key]} onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))} maxLength={400} />
            </CtlField>
          ))}
        </div>
      </div>
    </ControlDialog>
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
    <ControlDialog
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
    </ControlDialog>
  )
}

/* ------------------------------------------------------------------ *
 * Cost management (کنترل و اجرا): contracts, invoices and payments,   *
 * the supplier view of them, contract changes (addenda), and cost     *
 * against progress. Everything comes from the Contracts module and    *
 * the Reporting analytics; money is whole rials and only what is      *
 * approved counts - the Core enforces both.                           *
 * ------------------------------------------------------------------ */

const contractStatusLabels = { 0: 'پیش‌نویس', 1: 'فعال', 2: 'تکمیل‌شده', 3: 'فسخ‌شده' }
// An approved contract stays in Draft until somebody makes it Active, so "approved" and "Draft" can both be true.
const contractStatusText = (contract) => (contract.approvalStatus !== 2 ? 'پیش‌نویس' : contract.status === 0 ? 'تأییدشده، فعال‌نشده' : enumLabel(contract.status, contractStatusLabels))
const healthLabels = { 0: 'نامشخص', 1: 'مطلوب', 2: 'نیازمند توجه', 3: 'بحرانی' }
const healthClass = { 0: 'neutral', 1: 'green', 2: 'yellow', 3: 'red' }

const rialsText = (value) => (value === undefined || value === null || Number.isNaN(Number(value)) ? '—' : Math.round(Number(value)).toLocaleString('fa-IR'))
const moneyRials = (money) => Number(money?.rials ?? 0)
// Axis labels in a left-to-right chart: 1.5B / 250M instead of a ten-digit number.
const compactRials = (value) => {
  const n = Number(value) || 0
  if (n >= 1e9) return `${Math.round(n / 1e8) / 10}B`
  if (n >= 1e6) return `${Math.round(n / 1e5) / 10}M`
  return String(Math.round(n))
}
const percentText = (value) => (value === undefined || value === null ? '—' : `${Number(value).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`)
const indexText = (value) => (value === undefined || value === null ? '—' : Number(value).toLocaleString('fa-IR', { maximumFractionDigits: 2 }))
const jalaliText = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString('fa-IR') : '—')

// Contracts and invoices can be changed only while nobody has been asked to approve them (or after a rejection).
const isEditableApproval = (status) => status === 0 || status === 3

/** Saves rows as a CSV file Excel opens with Persian text intact (UTF-8 with a BOM). */
function downloadCsv(filename, header, rows) {
  const escape = (value) => {
    const text = value === undefined || value === null ? '' : String(value)
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const body = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** The contracts of some projects, each with its addenda and invoices ([{ contract, addenda, invoices }]). */
function useContractDetails(projectIds) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const key = projectIds.join(',')
  const shownKey = useRef(key)

  useEffect(() => {
    let cancelled = false
    if (!projectIds.length) { setItems([]); setError(''); return undefined }
    // Another project clears the list; a reload after a save keeps showing the old rows (and any open dialog) until the new ones arrive.
    if (shownKey.current !== key) { shownKey.current = key; setItems(null) }
    contractsApi.forProjects(projectIds).then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      setItems(arrayPayload(result))
    })
    return () => { cancelled = true }
  }, [key, reloadKey])

  return { items, error, reload: () => setReloadKey((value) => value + 1) }
}

/** A whole-rial amount typed with grouping; keeps only digits (and a leading minus when allowed). */
function AmountInput({ value, onChange, allowNegative = false, ...props }) {
  const display = (() => {
    if (!value || value === '-') return value
    const negative = value.startsWith('-')
    const digits = value.replace(/\D/g, '')
    return `${negative ? '-' : ''}${digits ? Number(digits).toLocaleString('en-US') : ''}`
  })()
  return (
    <input
      {...props}
      className="ltr-input"
      inputMode="numeric"
      value={display}
      onChange={(event) => {
        const typed = toLatinDigits(event.target.value).replace(/[,٬\s]/g, '')
        const negative = allowNegative && typed.startsWith('-')
        onChange(`${negative ? '-' : ''}${typed.replace(/\D/g, '')}`)
      }}
    />
  )
}

const tomansHint = (value) => (value && value !== '-' ? `معادل ${rialsText(Math.round(Number(value) / 10))} تومان` : undefined)

function CostPage({ data }) {
  const { can } = useAuth()
  const [tab, setTab] = useState('نمای کلی')
  const projectIds = useMemo(() => (data.selectedProjectId ? [data.selectedProjectId] : []), [data.selectedProjectId])
  const contracts = useContractDetails(projectIds)
  const canView = can('Contracts.View')
  const tabs = [{ label: 'نمای کلی', icon: ChartNoAxesCombined }, { label: 'قراردادها', icon: FileText }]

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا"
        title="مدیریت هزینه"
        description="قرارداد، صورت‌وضعیت و پرداخت پروژه در یک‌جا، و مقایسه‌ی آن با پیشرفت کار"
        action={null}
      >
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        {!canView ? (
          <p className="data-state data-state--error">برای دیدن اطلاعات هزینه، دسترسی «مشاهده‌ی قراردادها» (Contracts.View) لازم است.</p>
        ) : (
          <>
            <nav className="settings-subtabs ctl-subtabs">
              {tabs.map(({ label, icon: Icon }) => <button key={label} type="button" className={tab === label ? 'active' : ''} onClick={() => setTab(label)}><Icon size={16} />{label}</button>)}
            </nav>
            {contracts.error && <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{contracts.error}</span></div>}
            {tab === 'نمای کلی' && <CostOverview data={data} contracts={contracts} />}
            {tab === 'قراردادها' && <CostContracts data={data} contracts={contracts} />}
          </>
        )}
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

/* ---- Overview: money, health indexes, physical against financial progress, S-curve ---- */

function CostOverview({ data, contracts }) {
  const projectId = data.selectedProjectId
  const [summary, setSummary] = useState(null)
  const [perf, setPerf] = useState(undefined)
  const [curve, setCurve] = useState(undefined)
  const [costCurve, setCostCurve] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    setSummary(null); setPerf(undefined); setCurve(undefined); setCostCurve(undefined)
    if (!projectId) return undefined
    contractsApi.summary(projectId).then((result) => { if (!cancelled) setSummary(unwrap(result)) })
    // The server decides who may see a project's indexes (everyone for ViewAll; a team member with Contracts.View), so just ask.
    costReportApi.performance(projectId).then((result) => { if (!cancelled) setPerf(result.isSuccess ? unwrap(result) : null) })
    costReportApi.costCurve(projectId).then((result) => { if (!cancelled) setCostCurve(result.isSuccess ? unwrap(result) : null) })
    costReportApi.sCurve(projectId).then((result) => { if (!cancelled) setCurve(result.isSuccess ? unwrap(result) : null) })
    // Contract data changing (an approval, a payment) changes the figures, so reload with the list.
    return () => { cancelled = true }
  }, [projectId, contracts.items])

  const budget = Number(data.selectedProject?.cost ?? 0)
  const items = contracts.items || []
  const pendingContracts = items.filter(({ contract }) => contract.approvalStatus === 1).length
  const draftContracts = items.filter(({ contract }) => contract.approvalStatus === 0 || contract.approvalStatus === 3).length
  const pendingAddenda = items.flatMap(({ addenda }) => addenda).filter((item) => item.approvalStatus === 1)
  const pendingInvoices = items.flatMap(({ invoices }) => invoices).filter((item) => item.approvalStatus === 1)
  const contracted = moneyRials(summary?.totalContractAmount)
  const invoiced = moneyRials(summary?.totalInvoiced)
  const paid = moneyRials(summary?.totalPaid)
  const financialPercent = budget > 0 && summary ? (invoiced / budget) * 100 : null
  const physicalPercent = perf?.progressAvailable ? perf.actualProgress : null
  const plannedPercent = perf?.progressAvailable ? perf.plannedProgress : null
  const gap = financialPercent !== null && physicalPercent !== null ? financialPercent - physicalPercent : null

  const exportOverview = () => {
    downloadCsv(`cost-overview-${data.selectedProject?.code || 'project'}.csv`, ['شاخص', 'مقدار'], [
      ['پروژه', projectDisplayName(data.selectedProject)],
      ['بودجه‌ی پروژه (Project.Cost)', budget],
      ['مبلغ قراردادها (ریال)', contracted],
      ['صورت‌حساب‌شده (ریال)', invoiced],
      ['پرداخت‌شده (ریال)', paid],
      ['بدهی معوق (ریال)', moneyRials(summary?.totalOutstandingPayable)],
      ['تعهد باقی‌مانده (ریال)', moneyRials(summary?.totalRemainingCommitment)],
      ['پیشرفت برنامه‌ای ٪', perf?.plannedProgress ?? ''],
      ['پیشرفت واقعی ٪', perf?.actualProgress ?? ''],
      ['PV ارزش برنامه‌ای', perf?.plannedValue ?? ''],
      ['EV ارزش کسب‌شده', perf?.earnedValue ?? ''],
      ['AC هزینه‌ی واقعی', perf?.actualCost ?? ''],
      ['SV انحراف زمان', perf?.scheduleVariance ?? ''],
      ['CV انحراف هزینه', perf?.costVariance ?? ''],
      ['SPI', perf?.spi ?? ''],
      ['CPI', perf?.cpi ?? ''],
      ['EAC پیش‌بینی هزینه‌ی نهایی', perf?.estimateAtCompletion ?? ''],
    ])
  }

  if (contracts.items === null) return <p className="data-state">در حال دریافت اطلاعات...</p>

  return (
    <>
      <ControlKpis items={[
        { icon: WalletCards, tone: 'navy', label: 'بودجه‌ی پروژه', value: budget ? rialsText(budget) : '—', note: 'هزینه‌ی ثبت‌شده‌ی پروژه' },
        { icon: FileText, tone: 'blue', label: 'مبلغ قراردادها', value: rialsText(contracted), note: `${toPersianDigits(summary?.contractCount ?? 0)} قرارداد تأییدشده` },
        { icon: CircleDollarSign, tone: 'red', label: 'صورت‌حساب‌شده', value: rialsText(invoiced), note: `${percentText(summary?.invoicedPercent)} از قراردادها` },
        { icon: CheckCircle2, tone: 'green', label: 'پرداخت‌شده', value: rialsText(paid), note: `${percentText(summary?.paidPercent)} از قراردادها` },
      ]} />
      <ControlKpis items={[
        { icon: CircleAlert, tone: 'red', label: 'بدهی معوق', value: rialsText(moneyRials(summary?.totalOutstandingPayable)), note: 'پرداخت‌نشده' },
        { icon: RefreshCw, tone: 'blue', label: 'تعهد باقی‌مانده', value: rialsText(moneyRials(summary?.totalRemainingCommitment)), note: 'صورت‌حساب‌نشده' },
        { icon: Clock3, tone: 'navy', label: 'در انتظار تأیید', value: toPersianDigits(pendingContracts + pendingAddenda.length + pendingInvoices.length), note: `${toPersianDigits(pendingInvoices.length)} صورت‌وضعیت · ${toPersianDigits(pendingAddenda.length)} الحاقیه · ${toPersianDigits(pendingContracts)} قرارداد` },
        { icon: Pencil, tone: 'green', label: 'ثبت‌شده و ارسال‌نشده', value: toPersianDigits(draftContracts), note: 'پیش‌نویس یا ردشده' },
      ]} />
      <p className="ue-note cost-unit">همه‌ی مبلغ‌ها به ریال است. هزینه‌ی (بودجه‌ی) پروژه را هم هنگام ثبت پروژه به ریال وارد کنید، وگرنه شاخص‌های هزینه (CPI و ...) درست نمی‌شوند.</p>
      {(summary?.overInvoicedContracts ?? 0) > 0 && (
        <div className="users-notice error ctl-notice" role="status"><CircleAlert size={16} /><span>{toPersianDigits(summary.overInvoicedContracts)} قرارداد بیش از مبلغ خود صورت‌حساب شده است.</span></div>
      )}

      <section className="ctl-grid">
        <div className="task-panel ctl-panel">
          <div className="task-panel-title"><div><h3>زمان و هزینه نسبت به پیشرفت</h3><p>ارزش کسب‌شده: پول را با کار انجام‌شده مقایسه می‌کند.</p></div><button type="button" className="ctl-link" onClick={exportOverview}><Download size={14} /> خروجی Excel</button></div>
          {perf === undefined ? <p className="data-state">در حال محاسبه...</p> : perf === null ? (
            <p className="ue-note">
              شاخص‌های زمان و هزینه برای این پروژه در دسترس نیست: پروژه باید تأییدشده باشد و شما باید عضو تیم آن باشید (یا دسترسی «مشاهده‌ی گزارش‌های کل سازمان» داشته باشید). اعداد قراردادی بالا همچنان درست‌اند.
            </p>
          ) : (
            <>
              <div className="cost-health">
                <div className={`cost-index ${healthClass[perf.health] || 'neutral'}`}><small>شاخص زمان (SPI)</small><strong>{indexText(perf.spi)}</strong><span>{perf.spi === null || perf.spi === undefined ? 'هنوز قابل محاسبه نیست' : perf.spi >= 0.95 ? 'مطابق برنامه' : perf.spi >= 0.85 ? 'کمی عقب' : 'عقب از برنامه'}</span></div>
                <div className={`cost-index ${perf.cpi === null || perf.cpi === undefined ? 'neutral' : perf.cpi >= 0.95 ? 'green' : perf.cpi >= 0.85 ? 'yellow' : 'red'}`}><small>شاخص هزینه (CPI)</small><strong>{indexText(perf.cpi)}</strong><span>{perf.cpi === null || perf.cpi === undefined ? 'هنوز قابل محاسبه نیست' : perf.cpi >= 0.95 ? 'مطابق بودجه' : perf.cpi >= 0.85 ? 'کمی بیش‌تر از بودجه' : 'بیش از بودجه'}</span></div>
                <div className={`cost-index ${healthClass[perf.health] || 'neutral'}`}><small>وضعیت کلی</small><strong>{healthLabels[perf.health] || '—'}</strong><span>بدترین‌ِ دو شاخص</span></div>
              </div>
              {!perf.progressAvailable && <p className="ue-note">پیشرفت این پروژه ثبت نشده (برنامه‌ی زمان‌بندی یا وظیفه‌ای تعریف نشده)، پس شاخص‌ها خالی‌اند.</p>}
              <div className="table-scroll"><table className="cost-ev">
                <tbody>
                  <tr><th title="بودجه × درصد برنامه‌ای">ارزش برنامه‌ای (PV)</th><td>{rialsText(perf.plannedValue)}</td><th title="بودجه × درصد واقعی">ارزش کسب‌شده (EV)</th><td>{rialsText(perf.earnedValue)}</td></tr>
                  <tr><th title="صورت‌حساب‌های تأییدشده">هزینه‌ی واقعی (AC)</th><td>{rialsText(perf.actualCost)}</td><th title="EV − AC">انحراف هزینه (CV)</th><td className={perf.costVariance < 0 ? 'neg' : ''}>{rialsText(perf.costVariance)}</td></tr>
                  <tr><th title="EV − PV">انحراف زمان (SV)</th><td className={perf.scheduleVariance < 0 ? 'neg' : ''}>{rialsText(perf.scheduleVariance)}</td><th title="بودجه ÷ CPI">پیش‌بینی هزینه‌ی نهایی (EAC)</th><td>{rialsText(perf.estimateAtCompletion)}</td></tr>
                  <tr><th>باقی‌مانده تا پایان (ETC)</th><td>{rialsText(perf.estimateToComplete)}</td><th title="بودجه − EAC">اختلاف نهایی (VAC)</th><td className={perf.varianceAtCompletion < 0 ? 'neg' : ''}>{rialsText(perf.varianceAtCompletion)}</td></tr>
                  <tr><th>پایان پیش‌بینی‌شده</th><td>{jalaliText(perf.forecastEnd)}</td><th>تأخیر پیش‌بینی‌شده</th><td>{perf.forecastDelayDays === null || perf.forecastDelayDays === undefined ? '—' : `${toPersianDigits(perf.forecastDelayDays)} روز`}</td></tr>
                </tbody>
              </table></div>
            </>
          )}
        </div>

        <div className="task-panel ctl-panel">
          <div className="task-panel-title"><div><h3>پیشرفت فیزیکی و مالی</h3><p>آیا پولی که خرج شده با کاری که انجام شده می‌خواند؟</p></div></div>
          {[
            { label: 'پیشرفت برنامه‌ای', value: plannedPercent, tone: 'planned' },
            { label: 'پیشرفت فیزیکی (کار انجام‌شده)', value: physicalPercent, tone: 'physical' },
            { label: 'پیشرفت مالی (صورت‌حساب‌شده ÷ بودجه)', value: financialPercent, tone: 'financial' },
          ].map((row) => (
            <div className="cost-bar-row" key={row.label}>
              <span>{row.label}</span>
              <div className="cost-bar"><i className={row.tone} style={{ width: `${Math.max(0, Math.min(100, row.value ?? 0))}%` }} /></div>
              <b>{percentText(row.value)}</b>
            </div>
          ))}
          {gap !== null && (
            <p className={`cost-gap ${gap > 5 ? 'bad' : gap < -5 ? 'good' : ''}`}>
              {gap > 5 ? `پول ${toPersianDigits(Math.round(gap))} درصد بیش از کار انجام‌شده خرج شده است.` : gap < -5 ? `کار ${toPersianDigits(Math.round(-gap))} درصد جلوتر از هزینه‌ی صورت‌حساب‌شده است.` : 'پیشرفت مالی و فیزیکی تقریباً هم‌خوان است.'}
            </p>
          )}
          {budget <= 0 && <p className="ue-note">بودجه‌ی پروژه ثبت نشده است، پس پیشرفت مالی محاسبه نمی‌شود.</p>}
          <h4 className="cost-subtitle">منحنی S پیشرفت</h4>
          {curve === undefined ? <p className="data-state">در حال دریافت...</p> : <SCurveChart curve={curve} />}
          <h4 className="cost-subtitle">منحنی S هزینه (PV، EV و AC)</h4>
          {costCurve === undefined ? <p className="data-state">در حال دریافت...</p> : <CostCurveChart curve={costCurve} />}
        </div>
      </section>
    </>
  )
}

/** The money S-curve: planned value, earned value and actual cost (approved invoices) over time. */
function CostCurveChart({ curve }) {
  const planned = curve?.plannedValue || []
  const earned = curve?.earnedValue || []
  const actual = curve?.actualCost || []
  if (!curve || (planned.length < 2 && actual.length < 1)) return <p className="ue-note">برای رسم منحنی هزینه، پروژه باید بودجه و برنامه‌ی زمان‌بندی داشته باشد (یا صورت‌حساب تأییدشده‌ای ثبت شده باشد).</p>
  const width = 560; const height = 230
  const pad = { left: 62, right: 12, top: 12, bottom: 30 }
  const start = new Date(curve.projectStart).getTime()
  const end = Math.max(new Date(curve.projectFinish).getTime(), new Date(curve.today).getTime())
  const top = Math.max(Number(curve.budgetAtCompletion) || 0, ...planned.map((p) => p.amount), ...earned.map((p) => p.amount), ...actual.map((p) => p.amount), 1)
  const x = (date) => pad.left + ((new Date(date).getTime() - start) / (end - start || 1)) * (width - pad.left - pad.right)
  const y = (value) => height - pad.bottom - (Number(value) / top) * (height - pad.top - pad.bottom)
  const line = (points) => points.map((point) => `${x(point.date).toFixed(1)},${y(point.amount).toFixed(1)}`).join(' ')
  const todayMs = new Date(curve.today).getTime()
  const todayX = todayMs >= start && todayMs <= end ? x(curve.today) : null
  return (
    <div className="cost-chart" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="منحنی S هزینه">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(top * tick)} y2={y(top * tick)} className="grid" /><text x={pad.left - 6} y={y(top * tick) + 4} textAnchor="end">{compactRials(top * tick)}</text></g>
        ))}
        {planned.length > 1 && <polyline points={line(planned)} className="planned" fill="none" />}
        {earned.length > 1 && <polyline points={line(earned)} className="actual" fill="none" />}
        {earned.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(point.amount)} r="3" className="actual-dot" />)}
        {actual.length > 1 && <polyline points={line(actual)} className="cost-ac" fill="none" />}
        {todayX !== null && <g><line x1={todayX} x2={todayX} y1={pad.top} y2={height - pad.bottom} className="today" /><text x={todayX} y={pad.top + 9} textAnchor="middle">امروز</text></g>}
        <text x={pad.left} y={height - 8} textAnchor="start">{jalaliText(curve.projectStart)}</text>
        <text x={width - pad.right} y={height - 8} textAnchor="end">{jalaliText(curve.projectFinish)}</text>
      </svg>
      <div className="cost-legend" dir="rtl">
        <span><i className="planned" />ارزش برنامه‌ای (PV)</span><span><i className="actual" />ارزش کسب‌شده (EV)</span><span><i className="ac" />هزینه‌ی واقعی (AC)</span>
        {!curve.contractsAvailable && <em>ماژول قراردادها فعال نیست؛ هزینه‌ی واقعی ندارد</em>}
      </div>
    </div>
  )
}

function SCurveChart({ curve }) {
  const planned = curve?.planned || []
  const actual = curve?.actual || []
  if (planned.length < 2) return <p className="ue-note">برای رسم منحنی، پروژه باید برنامه‌ی زمان‌بندی (فعالیت با تاریخ) داشته باشد.</p>
  const width = 560; const height = 230
  const pad = { left: 38, right: 12, top: 12, bottom: 30 }
  const start = new Date(planned[0].date).getTime()
  const end = new Date(planned[planned.length - 1].date).getTime()
  const x = (date) => pad.left + ((new Date(date).getTime() - start) / (end - start || 1)) * (width - pad.left - pad.right)
  const y = (value) => height - pad.bottom - (Number(value) / 100) * (height - pad.top - pad.bottom)
  const line = (points, valueOf) => points.map((point) => `${x(point.date).toFixed(1)},${y(valueOf(point)).toFixed(1)}`).join(' ')
  const todayX = curve.today && new Date(curve.today).getTime() >= start && new Date(curve.today).getTime() <= end ? x(curve.today) : null
  return (
    <div className="cost-chart" dir="ltr">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="منحنی S پیشرفت">
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid" /><text x={pad.left - 6} y={y(tick) + 4} textAnchor="end">{toPersianDigits(tick)}</text></g>
        ))}
        <polyline points={line(planned, (point) => point.plannedProgress)} className="planned" fill="none" />
        {actual.length > 1 && <polyline points={line(actual, (point) => point.actualProgress)} className="actual" fill="none" />}
        {actual.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(point.actualProgress)} r="3.2" className="actual-dot" />)}
        {todayX !== null && <g><line x1={todayX} x2={todayX} y1={pad.top} y2={height - pad.bottom} className="today" /><text x={todayX} y={pad.top + 9} textAnchor="middle">امروز</text></g>}
        <text x={pad.left} y={height - 8} textAnchor="start">{jalaliText(planned[0].date)}</text>
        <text x={width - pad.right} y={height - 8} textAnchor="end">{jalaliText(planned[planned.length - 1].date)}</text>
      </svg>
      <div className="cost-legend" dir="rtl"><span><i className="planned" />برنامه‌ای</span><span><i className="actual" />واقعی (ثبت‌شده)</span>{actual.length === 0 && <em>هنوز نقطه‌ی واقعی ثبت نشده (عکس‌برداری پیشرفت)</em>}</div>
    </div>
  )
}

/* ---- Contracts: list, details with addenda and invoices, payments ---- */

function CostContracts({ data, contracts }) {
  const { can } = useAuth()
  const rights = {
    create: can('Contracts.Create'), edit: can('Contracts.Edit'), remove: can('Contracts.Delete'), submit: can('Contracts.Submit'),
    addenda: can('Contracts.ManageAddenda'), invoices: can('Contracts.ManageInvoices'), pay: can('Contracts.RecordPayments'),
  }
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const items = contracts.items || []

  const act = (call, text) => runAction(call, text, setNotice, contracts.reload)
  const removeContract = (contract) => {
    if (!window.confirm(`قرارداد «${contract.title}» حذف شود؟`)) return
    act(() => contractsApi.remove(contract.id), 'قرارداد حذف شد.')
  }

  const exportContracts = () => downloadCsv(`contracts-${data.selectedProject?.code || 'project'}.csv`,
    ['شماره', 'عنوان', 'طرف قرارداد', 'مبلغ فعلی (ریال)', 'صورت‌حساب‌شده (ریال)', 'پرداخت‌شده (ریال)', 'بدهی معوق (ریال)', 'تاریخ شروع', 'تاریخ پایان', 'وضعیت', 'تأیید'],
    items.map(({ contract }) => [contract.contractNumber, contract.title, contract.counterparty, moneyRials(contract.summary?.currentAmount), moneyRials(contract.summary?.invoicedAmount), moneyRials(contract.summary?.paidAmount), moneyRials(contract.summary?.outstandingPayable), contract.startDateFa || '', contract.endDateFa || '', enumLabel(contract.status, contractStatusLabels), enumLabel(contract.approvalStatus, approvalLabels)]))
  const exportInvoices = () => downloadCsv(`invoices-${data.selectedProject?.code || 'project'}.csv`,
    ['قرارداد', 'طرف قرارداد', 'شماره صورت‌وضعیت', 'عنوان', 'تاریخ', 'بازه از', 'بازه تا', 'مبلغ (ریال)', 'پرداخت‌شده (ریال)', 'پرداخت‌نشده (ریال)', 'آخرین پرداخت', 'تأیید'],
    items.flatMap(({ contract, invoices }) => invoices.map((invoice) => [contract.contractNumber, contract.counterparty, invoice.invoiceNumber, invoice.title || '', invoice.invoiceDateFa, invoice.periodStartDateFa || '', invoice.periodEndDateFa || '', moneyRials(invoice.amount), moneyRials(invoice.paidAmount), moneyRials(invoice.unpaidAmount), invoice.lastPaymentDateFa || '', enumLabel(invoice.approvalStatus, approvalLabels)])))

  return (
    <>
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title">
          <div><h3>قراردادهای پروژه</h3><p>فقط قرارداد تأییدشده می‌تواند الحاقیه و صورت‌وضعیت بگیرد؛ فقط مبلغ‌های تأییدشده در هزینه حساب می‌شوند.</p></div>
          <div className="ctl-filters">
            <button type="button" className="ctl-link" onClick={exportContracts} disabled={!items.length}><Download size={14} /> قراردادها</button>
            <button type="button" className="ctl-link" onClick={exportInvoices} disabled={!items.length}><Download size={14} /> صورت‌وضعیت‌ها</button>
            {rights.create && <button type="button" className="users-add" onClick={() => setForm({ contract: null })} disabled={!data.selectedProjectId}><Plus size={16} />قرارداد جدید</button>}
          </div>
        </div>
        <DataState loading={contracts.items === null} empty={!items.length}>
          <div className="table-scroll"><table>
            <thead><tr><th>قرارداد</th><th>طرف قرارداد</th><th>مبلغ فعلی (ریال)</th><th>صورت‌حساب‌شده</th><th>پرداخت‌شده</th><th>پایان</th><th>وضعیت</th><th>تأیید</th><th>عملیات</th></tr></thead>
            <tbody>
              {items.map(({ contract }) => {
                const summary = contract.summary || {}
                const approved = contract.approvalStatus === 2
                return (
                  <tr key={contract.id}>
                    <td className="ctl-main"><strong>{contract.title}</strong><small>شماره {contract.contractNumberFa}</small></td>
                    <td>{contract.counterparty}</td>
                    <td>{rialsText(moneyRials(approved ? summary.currentAmount : contract.originalAmount))}</td>
                    <td>{approved ? <>{rialsText(moneyRials(summary.invoicedAmount))}<small className="ctl-sp"> ({percentText(summary.invoicedPercent)})</small></> : '—'}</td>
                    <td>{approved ? <>{rialsText(moneyRials(summary.paidAmount))}<small className="ctl-sp"> ({percentText(summary.paidPercent)})</small></> : '—'}</td>
                    <td>{summary.currentEndDateFa || contract.endDateFa || '—'}</td>
                    <td>{contractStatusText(contract)}</td>
                    <td><ApprovalBadge status={contract.approvalStatus} /></td>
                    <td>
                      <span className="row-actions">
                        <button type="button" title="جزئیات، الحاقیه‌ها و صورت‌وضعیت‌ها" aria-label="جزئیات" onClick={() => setDetailId(contract.id)}><Eye size={15} /></button>
                        {rights.edit && contract.approvalStatus !== 1 && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setForm({ contract })}><Pencil size={15} /></button>}
                        {rights.submit && isEditableApproval(contract.approvalStatus) && <button type="button" className="ok" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => act(() => contractsApi.submit(contract.id), 'قرارداد برای تأیید ارسال شد.')}><Send size={15} /></button>}
                        {rights.remove && contract.approvalStatus !== 1 && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => removeContract(contract)}><Trash2 size={15} /></button>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        </DataState>
      </section>

      {form && (
        <ContractFormDialog
          projectId={data.selectedProjectId} tenantId={data.tenantId} contract={form.contract}
          onClose={() => setForm(null)}
          onSaved={(result) => { setForm(null); setNotice(result); contracts.reload() }}
        />
      )}
      {detailId && items.some(({ contract }) => contract.id === detailId) && (
        <ContractDetailDialog
          detail={items.find(({ contract }) => contract.id === detailId)} rights={rights} data={data}
          onClose={() => setDetailId(null)} reload={contracts.reload}
        />
      )}
    </>
  )
}

function ContractFormDialog({ projectId, tenantId, contract, onClose, onSaved }) {
  const isNew = !contract
  const approved = contract?.approvalStatus === 2
  const [form, setForm] = useState({
    contractNumber: contract?.contractNumber || '', title: contract?.title || '', counterparty: contract?.counterparty || '', supplierId: contract?.supplierId || '', scopeOfWork: contract?.scopeOfWork || '',
    supervisorName: contract?.supervisorName || '', beneficiaryName: contract?.beneficiaryName || '', description: contract?.description || '',
    signDate: contract?.signDate || '', startDate: contract?.startDate || '', endDate: contract?.endDate || '',
    amount: contract ? String(Math.round(moneyRials(contract.originalAmount))) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  // The party of the contract is picked from the suppliers; a name typed instead finds (or starts) the supplier of that name.
  useEffect(() => {
    let cancelled = false
    suppliersApi.list().then((result) => { if (!cancelled && result.isSuccess) setSuppliers(arrayPayload(result)) })
    return () => { cancelled = true }
  }, [])
  const pickableSuppliers = suppliers.filter((item) => item.status === 0 || item.id === form.supplierId)

  async function submit(event) {
    event.preventDefault()
    if (!form.contractNumber.trim() || !form.title.trim() || (!form.supplierId && !form.counterparty.trim())) { setError('شماره، عنوان و طرف قرارداد را وارد کنید.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('مبلغ قرارداد (ریال) را وارد کنید.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.'); return }
    setSaving(true); setError('')
    const fields = {
      contractNumber: toLatinDigits(form.contractNumber.trim()), title: form.title.trim(),
      ...(form.supplierId ? { supplierId: form.supplierId, counterparty: pickableSuppliers.find((item) => item.id === form.supplierId)?.name || form.counterparty.trim() } : { counterparty: form.counterparty.trim() }),
      description: emptyToNull(form.description.trim()), scopeOfWork: form.scopeOfWork.trim(), signDate: emptyToNull(form.signDate), startDate: emptyToNull(form.startDate), endDate: emptyToNull(form.endDate),
      originalAmount: Number(form.amount), supervisorName: emptyToNull(form.supervisorName.trim()), beneficiaryName: emptyToNull(form.beneficiaryName.trim()),
    }
    const result = isNew ? await contractsApi.create({ tenantId, projectId, ...fields }) : await contractsApi.update(contract.id, fields)
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: isNew ? `قرارداد «${fields.title}» ثبت شد. برای استفاده، آن را برای تأیید ارسال کنید.` : `قرارداد «${fields.title}» ذخیره شد.` })
  }

  return (
    <ControlDialog
      size="sm" icon={isNew ? Plus : Pencil} title={isNew ? 'قرارداد جدید' : `ویرایش «${contract.title}»`} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="contract-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : isNew ? 'ثبت قرارداد' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="contract-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="شماره‌ی قرارداد" required><input className="ltr-input" value={form.contractNumber} onChange={set('contractNumber')} maxLength={100} autoFocus /></CtlField>
          <CtlField label="عنوان" required><input value={form.title} onChange={set('title')} maxLength={300} /></CtlField>
          <CtlField label="طرف قرارداد" required hint="پیمانکار، تأمین‌کننده یا مشاور؛ از فهرست انتخاب کنید یا نامِ تازه را بنویسید" wide>
            <select value={form.supplierId} onChange={set('supplierId')}>
              <option value="">— نام تازه (تایپی) —</option>
              {pickableSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </CtlField>
          {!form.supplierId && <CtlField label="نام طرف قرارداد" wide><input value={form.counterparty} onChange={set('counterparty')} maxLength={300} /></CtlField>}
          <CtlField label="ناظر"><input value={form.supervisorName} onChange={set('supervisorName')} maxLength={300} /></CtlField>
          <CtlField label="بهره‌بردار"><input value={form.beneficiaryName} onChange={set('beneficiaryName')} maxLength={300} /></CtlField>
        </div></div>
        <div className="ue-card ue-card--accent"><div className="ue-grid">
          <CtlField label="مبلغ قرارداد (ریال)" required hint={approved ? 'مبلغ قراردادِ تأییدشده فقط با الحاقیه تغییر می‌کند.' : tomansHint(form.amount)}>
            <AmountInput value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} disabled={approved} />
          </CtlField>
          <span />
          <CtlField label="تاریخ امضا"><input type="date" value={form.signDate} onChange={set('signDate')} /></CtlField>
          <CtlField label="تاریخ شروع"><input type="date" value={form.startDate} onChange={set('startDate')} /></CtlField>
          <CtlField label="تاریخ پایان"><input type="date" value={form.endDate} onChange={set('endDate')} /></CtlField>
          <CtlField label="محدوده‌ی کار" wide hint="آنچه پیمان شامل می‌شود"><textarea rows={3} value={form.scopeOfWork} onChange={set('scopeOfWork')} maxLength={4000} /></CtlField>
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={4000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function ContractDetailDialog({ detail, rights, data, onClose, reload }) {
  const { contract, addenda, invoices } = detail
  const [notice, setNotice] = useState(null)
  const [sub, setSub] = useState(null)
  const approved = contract.approvalStatus === 2
  const open = approved && contract.status !== 3
  const summary = contract.summary || {}
  const act = (call, text) => runAction(call, text, setNotice, reload)

  return (
    <ControlDialog
      icon={FileText} title={contract.title} subtitle={`شماره ${contract.contractNumberFa} · ${contract.counterparty}`} onClose={onClose}
      footer={<div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>بستن</button></div>}
    >
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <div className="cost-mini">
        <div><small>مبلغ فعلی</small><b>{rialsText(moneyRials(approved ? summary.currentAmount : contract.originalAmount))}</b></div>
        <div><small>صورت‌حساب‌شده</small><b>{approved ? rialsText(moneyRials(summary.invoicedAmount)) : '—'}</b></div>
        <div><small>پرداخت‌شده</small><b>{approved ? rialsText(moneyRials(summary.paidAmount)) : '—'}</b></div>
        <div><small>بدهی معوق</small><b>{approved ? rialsText(moneyRials(summary.outstandingPayable)) : '—'}</b></div>
        <div><small>تعهد باقی‌مانده</small><b>{approved ? rialsText(moneyRials(summary.remainingCommitment)) : '—'}</b></div>
      </div>
      <p className="ue-note">
        <ApprovalBadge status={contract.approvalStatus} /> وضعیت: {contractStatusText(contract)}
        {contract.startDateFa && ` · از ${contract.startDateFa}`}{(summary.currentEndDateFa || contract.endDateFa) && ` تا ${summary.currentEndDateFa || contract.endDateFa}`}
        {contract.supervisorName && ` · ناظر: ${contract.supervisorName}`}{contract.beneficiaryName && ` · بهره‌بردار: ${contract.beneficiaryName}`}
        {approved && rights.edit && (
          <> · <select className="ctl-select" value={contract.status} aria-label="وضعیت قرارداد" onChange={(e) => act(() => contractsApi.setStatus(contract.id, Number(e.target.value)), 'وضعیت قرارداد ذخیره شد.')}>
            {contract.status === 0 && <option value={0} disabled>فعال‌نشده</option>}
            {[1, 2, 3].map((value) => <option key={value} value={value}>{contractStatusLabels[value]}</option>)}
          </select></>
        )}
      </p>
      {!approved && <p className="ue-note">الحاقیه و صورت‌وضعیت فقط بعد از تأیید قرارداد ثبت می‌شود.</p>}
      {contract.scopeOfWork && <p className="ue-note"><strong>محدوده‌ی کار:</strong> {contract.scopeOfWork}</p>}
      <ContractCommitments contract={contract} canEdit={rights.edit} />

      <section className="ue-section">
        <div className="ue-section-head"><h4><RefreshCw size={16} />الحاقیه‌ها</h4>{rights.addenda && open && <button type="button" className="ctl-link" onClick={() => setSub({ kind: 'addendum', item: null })}><Plus size={14} /> الحاقیه‌ی جدید</button>}</div>
        {!addenda.length ? <p className="ue-note">الحاقیه‌ای ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="cost-sub">
            <thead><tr><th>#</th><th>عنوان</th><th>تغییر مبلغ</th><th>تمدید</th><th>تأیید</th><th /></tr></thead>
            <tbody>{addenda.map((item) => (
              <tr key={item.id}>
                <td>{toPersianDigits(item.number)}</td><td>{item.title}<small className="ctl-sp"> {item.addendumDateFa || ''}</small></td>
                <td className={item.amountChange < 0 ? 'neg' : ''}>{item.amountChange > 0 ? '+' : ''}{rialsText(item.amountChange)}</td>
                <td>{item.extensionDays ? `${toPersianDigits(item.extensionDays)} روز` : '—'}</td><td><ApprovalBadge status={item.approvalStatus} /></td>
                <td>{rights.addenda && isEditableApproval(item.approvalStatus) && (
                  <span className="row-actions">
                    <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setSub({ kind: 'addendum', item })}><Pencil size={15} /></button>
                    <button type="button" className="ok" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => act(() => contractsApi.submitAddendum(contract.id, item.id), 'الحاقیه برای تأیید ارسال شد.')}><Send size={15} /></button>
                    <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => window.confirm('این الحاقیه حذف شود؟') && act(() => contractsApi.deleteAddendum(contract.id, item.id), 'الحاقیه حذف شد.')}><Trash2 size={15} /></button>
                  </span>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="ue-section">
        <div className="ue-section-head"><h4><CircleDollarSign size={16} />صورت‌وضعیت‌ها و پرداخت‌ها</h4>{rights.invoices && open && <button type="button" className="ctl-link" onClick={() => setSub({ kind: 'invoice', item: null })}><Plus size={14} /> صورت‌وضعیت جدید</button>}</div>
        {!invoices.length ? <p className="ue-note">صورت‌وضعیتی ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="cost-sub">
            <thead><tr><th>شماره</th><th>مبلغ</th><th>پرداخت‌شده</th><th>مانده</th><th>تأیید</th><th /></tr></thead>
            <tbody>{invoices.map((item) => (
              <tr key={item.id}>
                <td>{item.invoiceNumberFa}<small className="ctl-sp"> {item.title || ''} {item.invoiceDateFa}</small></td>
                <td>{rialsText(moneyRials(item.amount))}</td>
                <td>{rialsText(moneyRials(item.paidAmount))}{item.lastPaymentDateFa && <small className="ctl-sp"> ({item.lastPaymentDateFa})</small>}</td>
                <td>{rialsText(moneyRials(item.unpaidAmount))}</td><td><ApprovalBadge status={item.approvalStatus} /></td>
                <td><span className="row-actions">
                  {rights.pay && item.approvalStatus === 2 && <button type="button" className="ok" title="ثبت پرداخت" aria-label="ثبت پرداخت" onClick={() => setSub({ kind: 'payment', item })}><WalletCards size={15} /></button>}
                  {rights.invoices && isEditableApproval(item.approvalStatus) && (
                    <>
                      <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setSub({ kind: 'invoice', item })}><Pencil size={15} /></button>
                      <button type="button" className="ok" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => act(() => contractsApi.submitInvoice(contract.id, item.id), 'صورت‌وضعیت برای تأیید ارسال شد.')}><Send size={15} /></button>
                      <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => window.confirm('این صورت‌وضعیت حذف شود؟') && act(() => contractsApi.deleteInvoice(contract.id, item.id), 'صورت‌وضعیت حذف شد.')}><Trash2 size={15} /></button>
                    </>
                  )}
                </span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      {sub?.kind === 'addendum' && <AddendumFormDialog contract={contract} tenantId={data.tenantId} item={sub.item} onClose={() => setSub(null)} onSaved={(result) => { setSub(null); setNotice(result); reload() }} />}
      {sub?.kind === 'invoice' && <InvoiceFormDialog contract={contract} tenantId={data.tenantId} item={sub.item} onClose={() => setSub(null)} onSaved={(result) => { setSub(null); setNotice(result); reload() }} />}
      {sub?.kind === 'payment' && <PaymentDialog contract={contract} invoice={sub.item} onClose={() => setSub(null)} onSaved={(result) => { setSub(null); setNotice(result); reload() }} />}
    </ControlDialog>
  )
}

const milestoneStatusLabels = { 0: 'شروع‌نشده', 1: 'در حال انجام', 2: 'انجام‌شده' }
const obligationStatusLabels = { 0: 'باز', 1: 'ایفا شده', 2: 'نقض شده' }
const obligationPartyLabels = { 0: 'طرف قرارداد', 1: 'کارفرما' }

/** The milestones and obligations of one contract, read when the dialog opens and again after each change. */
function ContractCommitments({ contract, canEdit }) {
  const [milestones, setMilestones] = useState(null)
  const [obligations, setObligations] = useState(null)
  const [links, setLinks] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [sub, setSub] = useState(null)
  const reload = () => setReloadKey((value) => value + 1)

  useEffect(() => {
    let cancelled = false
    contractsApi.milestones(contract.id).then((result) => { if (!cancelled) setMilestones(result.isSuccess ? arrayPayload(result) : []) })
    contractsApi.obligations(contract.id).then((result) => { if (!cancelled) setObligations(result.isSuccess ? arrayPayload(result) : []) })
    contractsApi.links(contract.id).then((result) => { if (!cancelled) setLinks(result.isSuccess ? arrayPayload(result) : []) })
    return () => { cancelled = true }
  }, [contract.id, reloadKey])

  const act = (call, text) => runAction(call, text, setNotice, reload)
  const done = (result) => { setSub(null); setNotice(result); reload() }
  const linksOf = (subjectType, subjectId) => links.filter((link) => link.subjectType === subjectType && link.subjectId === subjectId)
  const linkButton = (subjectType, subject) => canEdit && <button type="button" title="پیوند سند یا اقدام" aria-label="پیوند سند یا اقدام" onClick={() => setSub({ kind: 'link', subjectType, subject })}><Paperclip size={15} /></button>
  const linkChips = (subjectType, subjectId) => {
    const own = linksOf(subjectType, subjectId)
    return own.length > 0 && (
      <span className="ctl-links">
        {own.map((link) => (
          <span key={link.id} className="ctl-chip" title={link.note || undefined}>
            {link.kind === 0 ? 'سند' : 'اقدام'}: {link.title}
            {canEdit && <button type="button" aria-label="حذف پیوند" title="حذف پیوند" onClick={() => window.confirm('این پیوند حذف شود؟') && act(() => contractsApi.deleteLink(contract.id, link.id), 'پیوند حذف شد.')}><X size={12} /></button>}
          </span>
        ))}
      </span>
    )
  }

  return (
    <>
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <section className="ue-section">
        <div className="ue-section-head"><h4><CalendarCheck size={16} />نقاط عطف</h4>{canEdit && <button type="button" className="ctl-link" onClick={() => setSub({ kind: 'milestone', item: null })}><Plus size={14} /> نقطه‌ی عطف تازه</button>}</div>
        {milestones === null ? <p className="ue-note">در حال بارگذاری...</p> : !milestones.length ? <p className="ue-note">نقطه‌ی عطفی ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="cost-sub">
            <thead><tr><th>عنوان</th><th>سررسید</th><th>وضعیت</th><th>انجام</th><th /></tr></thead>
            <tbody>{milestones.map((item) => (
              <tr key={item.id}>
                <td>{item.title}{item.description && <small className="ctl-sp"> {item.description}</small>}{linkChips(1, item.id)}</td>
                <td className={item.isOverdue ? 'neg' : ''}>{item.dueDateFa}{item.isOverdue && <small className="ctl-sp"> معوق</small>}</td>
                <td>{enumLabel(item.status, milestoneStatusLabels)}</td>
                <td>{item.completedDateFa || '—'}</td>
                <td>{canEdit && (
                  <span className="row-actions">
                    {linkButton(1, item)}
                    <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setSub({ kind: 'milestone', item })}><Pencil size={15} /></button>
                    <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => window.confirm('این نقطه‌ی عطف حذف شود؟') && act(() => contractsApi.deleteMilestone(contract.id, item.id), 'نقطه‌ی عطف حذف شد.')}><Trash2 size={15} /></button>
                  </span>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="ue-section">
        <div className="ue-section-head"><h4><ClipboardCheck size={16} />تعهدات</h4>{canEdit && <button type="button" className="ctl-link" onClick={() => setSub({ kind: 'obligation', item: null })}><Plus size={14} /> تعهد تازه</button>}</div>
        {obligations === null ? <p className="ue-note">در حال بارگذاری...</p> : !obligations.length ? <p className="ue-note">تعهدی ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="cost-sub">
            <thead><tr><th>عنوان</th><th>بر عهده‌ی</th><th>سررسید</th><th>وضعیت</th><th /></tr></thead>
            <tbody>{obligations.map((item) => (
              <tr key={item.id}>
                <td>{item.title}{item.description && <small className="ctl-sp"> {item.description}</small>}{linkChips(2, item.id)}</td>
                <td>{enumLabel(item.party, obligationPartyLabels)}</td>
                <td className={item.isOverdue ? 'neg' : ''}>{item.dueDateFa || '—'}{item.isOverdue && <small className="ctl-sp"> معوق</small>}</td>
                <td>{enumLabel(item.status, obligationStatusLabels)}{item.fulfilledDateFa && <small className="ctl-sp"> {item.fulfilledDateFa}</small>}</td>
                <td>{canEdit && (
                  <span className="row-actions">
                    {linkButton(2, item)}
                    <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setSub({ kind: 'obligation', item })}><Pencil size={15} /></button>
                    <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => window.confirm('این تعهد حذف شود؟') && act(() => contractsApi.deleteObligation(contract.id, item.id), 'تعهد حذف شد.')}><Trash2 size={15} /></button>
                  </span>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="ue-section">
        <div className="ue-section-head"><h4><Paperclip size={16} />اسناد و پیوست‌های قرارداد</h4>{canEdit && <button type="button" className="ctl-link" onClick={() => setSub({ kind: 'link', subjectType: 0, subject: contract })}><Plus size={14} /> پیوند تازه</button>}</div>
        {!linksOf(0, contract.id).length ? <p className="ue-note">سند یا اقدامی به این قرارداد پیوند نخورده است.</p> : <p className="ue-note">{linkChips(0, contract.id)}</p>}
      </section>

      {sub?.kind === 'link' && <LinkFormDialog contract={contract} subjectType={sub.subjectType} subject={sub.subject} onClose={() => setSub(null)} onSaved={done} />}
      {sub?.kind === 'milestone' && <MilestoneFormDialog contract={contract} item={sub.item} onClose={() => setSub(null)} onSaved={done} />}
      {sub?.kind === 'obligation' && <ObligationFormDialog contract={contract} item={sub.item} onClose={() => setSub(null)} onSaved={done} />}
    </>
  )
}

/** Links a project document or an action to the contract, or to one of its milestones or obligations (as evidence). */
function LinkFormDialog({ contract, subjectType, subject, onClose, onSaved }) {
  const [kind, setKind] = useState('0')
  const [options, setOptions] = useState(null)
  const [targetId, setTargetId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setOptions(null); setTargetId('')
    const load = kind === '0' ? projectManagementApi.documents(contract.projectId) : actionsApi.list(contract.projectId)
    load.then((result) => {
      if (cancelled) return
      const items = result.isSuccess ? arrayPayload(result) : []
      setOptions(items.map((item) => ({ id: item.id, title: kind === '0' ? (item.description || item.fileName || 'سند') : (item.title || 'اقدام') })))
    })
    return () => { cancelled = true }
  }, [kind, contract.projectId])

  async function submit(event) {
    event.preventDefault()
    const target = (options || []).find((item) => item.id === targetId)
    if (!target) { setError(kind === '0' ? 'یک سند را انتخاب کنید.' : 'یک اقدام را انتخاب کنید.'); return }
    setSaving(true); setError('')
    const result = await contractsApi.createLink(contract.id, {
      kind: Number(kind), targetId: target.id, title: target.title, subjectType, subjectId: subjectType === 0 ? null : subject.id, note: emptyToNull(note.trim()),
    })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: 'پیوند ثبت شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={Paperclip} title="پیوند سند یا اقدام" subtitle={subjectType === 0 ? contract.title : subject.title} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="link-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ثبت پیوند'}</button></div>
        </>
      )}
    >
      <form id="link-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="نوع"><select value={kind} onChange={(e) => setKind(e.target.value)}><option value="0">سند پروژه</option><option value="1">اقدام</option></select></CtlField>
          <CtlField label={kind === '0' ? 'سند' : 'اقدام'} required wide hint="از موارد همین پروژه">
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={options === null}>
              <option value="">{options === null ? 'در حال بارگذاری...' : options.length ? '— انتخاب کنید —' : 'موردی در این پروژه نیست'}</option>
              {(options || []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </CtlField>
          <CtlField label="یادداشت" wide><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function MilestoneFormDialog({ contract, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', dueDate: item?.dueDate || '',
    status: String(item?.status ?? 0), completedDate: item?.completedDate || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.dueDate) { setError('عنوان و سررسید را وارد کنید.'); return }
    setSaving(true); setError('')
    const payload = {
      title: form.title.trim(), description: emptyToNull(form.description.trim()), dueDate: form.dueDate,
      status: Number(form.status), completedDate: form.status === '2' ? emptyToNull(form.completedDate) : null,
    }
    const result = item ? await contractsApi.updateMilestone(contract.id, item.id, payload) : await contractsApi.createMilestone(contract.id, payload)
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'نقطه‌ی عطف ذخیره شد.' : 'نقطه‌ی عطف ثبت شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={item ? Pencil : Plus} title={item ? `ویرایش «${item.title}»` : 'نقطه‌ی عطف تازه'} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="milestone-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="milestone-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="عنوان" required wide><input value={form.title} onChange={set('title')} maxLength={300} autoFocus /></CtlField>
          <CtlField label="سررسید" required><input type="date" value={form.dueDate} onChange={set('dueDate')} /></CtlField>
          <CtlField label="وضعیت"><select value={form.status} onChange={set('status')}>{Object.entries(milestoneStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          {form.status === '2' && <CtlField label="تاریخ انجام" hint="خالی بماند، امروز ثبت می‌شود"><input type="date" value={form.completedDate} onChange={set('completedDate')} /></CtlField>}
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function ObligationFormDialog({ contract, item, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', party: String(item?.party ?? 0), dueDate: item?.dueDate || '',
    status: String(item?.status ?? 0), fulfilledDate: item?.fulfilledDate || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) { setError('عنوان تعهد را وارد کنید.'); return }
    setSaving(true); setError('')
    const payload = {
      title: form.title.trim(), description: emptyToNull(form.description.trim()), party: Number(form.party), dueDate: emptyToNull(form.dueDate),
      status: Number(form.status), fulfilledDate: form.status === '1' ? emptyToNull(form.fulfilledDate) : null,
    }
    const result = item ? await contractsApi.updateObligation(contract.id, item.id, payload) : await contractsApi.createObligation(contract.id, payload)
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'تعهد ذخیره شد.' : 'تعهد ثبت شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={item ? Pencil : Plus} title={item ? `ویرایش «${item.title}»` : 'تعهد تازه'} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="obligation-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="obligation-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="عنوان" required wide><input value={form.title} onChange={set('title')} maxLength={300} autoFocus /></CtlField>
          <CtlField label="بر عهده‌ی"><select value={form.party} onChange={set('party')}>{Object.entries(obligationPartyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          <CtlField label="سررسید" hint="اختیاری"><input type="date" value={form.dueDate} onChange={set('dueDate')} /></CtlField>
          <CtlField label="وضعیت"><select value={form.status} onChange={set('status')}>{Object.entries(obligationStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          {form.status === '1' && <CtlField label="تاریخ ایفا" hint="خالی بماند، امروز ثبت می‌شود"><input type="date" value={form.fulfilledDate} onChange={set('fulfilledDate')} /></CtlField>}
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function AddendumFormDialog({ contract, contracts, tenantId, item, onClose, onSaved }) {
  const [contractId, setContractId] = useState(contract?.id || contracts?.[0]?.id || '')
  const [form, setForm] = useState({
    title: item?.title || '', description: item?.description || '', addendumDate: item?.addendumDate || '',
    amountChange: item ? String(Math.round(item.amountChange)) : '', extensionDays: item ? String(item.extensionDays) : '',
    startDate: item?.startDate || '', endDate: item?.endDate || '', changeRequestId: item?.changeRequestId || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [approvedChanges, setApprovedChanges] = useState([])
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const projectId = (contract || (contracts || []).find((c) => c.id === contractId))?.projectId

  // The approved (or carried out) change requests of the contract's project - what an addendum may carry out.
  useEffect(() => {
    let cancelled = false
    if (!projectId) { setApprovedChanges([]); return undefined }
    changeRequestsApi.list(projectId).then((result) => {
      if (!cancelled) setApprovedChanges((result.isSuccess ? arrayPayload(result) : []).filter((change) => change.status === 2 || change.status === 4))
    })
    return () => { cancelled = true }
  }, [projectId])

  async function submit(event) {
    event.preventDefault()
    const amount = Number(form.amountChange || 0)
    const days = Number(toLatinDigits(form.extensionDays || '0'))
    if (!contractId) { setError('قرارداد را انتخاب کنید.'); return }
    if (!form.title.trim()) { setError('عنوان الحاقیه را وارد کنید.'); return }
    if (!amount && !days) { setError('الحاقیه باید مبلغ یا مدت (یا هر دو) را تغییر دهد.'); return }
    setSaving(true); setError('')
    const fields = { title: form.title.trim(), description: emptyToNull(form.description.trim()), addendumDate: emptyToNull(form.addendumDate), amountChange: amount, extensionDays: days, startDate: emptyToNull(form.startDate), endDate: emptyToNull(form.endDate) }
    // An edit that clears the change request sends the empty id (null would keep the stored one).
    fields.changeRequestId = form.changeRequestId || (item?.changeRequestId ? '00000000-0000-0000-0000-000000000000' : null)
    const result = item ? await contractsApi.updateAddendum(contractId, item.id, fields) : await contractsApi.createAddendum(contractId, { tenantId, ...fields })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'الحاقیه ذخیره شد.' : 'الحاقیه ثبت شد. برای اعمال، آن را برای تأیید ارسال کنید.' })
  }

  return (
    <ControlDialog
      size="sm" icon={RefreshCw} title={item ? 'ویرایش الحاقیه' : 'الحاقیه‌ی جدید'} subtitle={contract?.title} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="addendum-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="addendum-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          {!contract && <CtlField label="قرارداد" required wide><select value={contractId} onChange={(e) => setContractId(e.target.value)}>{(contracts || []).map((c) => <option key={c.id} value={c.id}>{c.title} — {c.counterparty}</option>)}</select></CtlField>}
          <CtlField label="عنوان" required wide><input value={form.title} onChange={set('title')} maxLength={300} autoFocus /></CtlField>
          <CtlField label="مصوبه (درخواست تغییر)" wide hint={form.changeRequestId ? 'این الحاقیه اجرای همین تغییرِ مصوب است' : 'بدون مصوبه، در داشبورد تغییرات «تغییر بدون مصوبه» هشدار داده می‌شود'}>
            <select value={form.changeRequestId} onChange={set('changeRequestId')}>
              <option value="">— بدون مصوبه —</option>
              {approvedChanges.map((change) => <option key={change.id} value={change.id}>{change.code} · {change.title}</option>)}
            </select>
          </CtlField>
          <CtlField label="تغییر مبلغ (ریال)" hint={form.amountChange && form.amountChange !== '-' ? `${tomansHint(form.amountChange)} · منفی یعنی کاهش` : 'منفی یعنی کاهش مبلغ'}><AmountInput allowNegative value={form.amountChange} onChange={(value) => setForm((current) => ({ ...current, amountChange: value }))} /></CtlField>
          <CtlField label="تمدید (روز)"><input className="ltr-input" inputMode="numeric" value={form.extensionDays} onChange={(e) => setForm((current) => ({ ...current, extensionDays: toLatinDigits(e.target.value).replace(/\D/g, '') }))} /></CtlField>
          <CtlField label="تاریخ الحاقیه"><input type="date" value={form.addendumDate} onChange={set('addendumDate')} /></CtlField>
          <span />
          <CtlField label="شروع جدید"><input type="date" value={form.startDate} onChange={set('startDate')} /></CtlField>
          <CtlField label="پایان جدید"><input type="date" value={form.endDate} onChange={set('endDate')} /></CtlField>
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={4000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function InvoiceFormDialog({ contract, tenantId, item, onClose, onSaved }) {
  const summary = contract.summary || {}
  const [form, setForm] = useState({
    invoiceNumber: item?.invoiceNumber || '', title: item?.title || '', invoiceDate: item?.invoiceDate || todayInputValue(),
    periodStartDate: item?.periodStartDate || '', periodEndDate: item?.periodEndDate || '', description: item?.description || '',
    amount: item ? String(Math.round(moneyRials(item.amount))) : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const room = moneyRials(summary.currentAmount) - moneyRials(summary.invoicedAmount)

  async function submit(event) {
    event.preventDefault()
    if (!form.invoiceNumber.trim()) { setError('شماره‌ی صورت‌وضعیت را وارد کنید.'); return }
    if (!form.amount || Number(form.amount) <= 0) { setError('مبلغ صورت‌وضعیت (ریال) را وارد کنید.'); return }
    if (form.periodStartDate && form.periodEndDate && form.periodEndDate < form.periodStartDate) { setError('پایان بازه نمی‌تواند قبل از شروع آن باشد.'); return }
    setSaving(true); setError('')
    const fields = { invoiceNumber: toLatinDigits(form.invoiceNumber.trim()), invoiceDate: form.invoiceDate, amount: Number(form.amount), description: emptyToNull(form.description.trim()), title: emptyToNull(form.title.trim()), periodStartDate: emptyToNull(form.periodStartDate), periodEndDate: emptyToNull(form.periodEndDate) }
    const result = item ? await contractsApi.updateInvoice(contract.id, item.id, fields) : await contractsApi.createInvoice(contract.id, { tenantId, ...fields })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'صورت‌وضعیت ذخیره شد.' : 'صورت‌وضعیت ثبت شد. تا تأیید نشود در هزینه‌ی واقعی حساب نمی‌شود.' })
  }

  return (
    <ControlDialog
      size="sm" icon={CircleDollarSign} title={item ? 'ویرایش صورت‌وضعیت' : 'صورت‌وضعیت جدید'} subtitle={contract.title} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="invoice-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="invoice-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="شماره‌ی صورت‌وضعیت" required><input className="ltr-input" value={form.invoiceNumber} onChange={set('invoiceNumber')} maxLength={100} autoFocus /></CtlField>
          <CtlField label="عنوان"><input value={form.title} onChange={set('title')} maxLength={300} placeholder="مثلاً صورت‌وضعیت موقت ۱" /></CtlField>
          <CtlField label="تاریخ" required><input type="date" value={form.invoiceDate} onChange={set('invoiceDate')} /></CtlField>
          <span />
          <CtlField label="شروع بازه"><input type="date" value={form.periodStartDate} onChange={set('periodStartDate')} /></CtlField>
          <CtlField label="پایان بازه"><input type="date" value={form.periodEndDate} onChange={set('periodEndDate')} /></CtlField>
        </div></div>
        <div className="ue-card ue-card--accent"><div className="ue-grid">
          <CtlField label="مبلغ (ریال)" required hint={`${tomansHint(form.amount) || ''}${tomansHint(form.amount) ? ' · ' : ''}ظرفیت باقی‌مانده‌ی قرارداد: ${rialsText(room)} ریال`} wide><AmountInput value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} /></CtlField>
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

/* The payment is the invoice's TOTAL paid so far, not an increment. */
function PaymentDialog({ contract, invoice, onClose, onSaved }) {
  const amount = moneyRials(invoice.amount)
  const [paid, setPaid] = useState(String(Math.round(moneyRials(invoice.paidAmount))))
  const [date, setDate] = useState(invoice.lastPaymentDate || todayInputValue())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const value = Number(paid || 0)
    if (value < 0 || value > amount) { setError('مبلغ پرداخت‌شده باید بین صفر و مبلغ صورت‌وضعیت باشد.'); return }
    if (!date) { setError('تاریخ پرداخت را وارد کنید.'); return }
    setSaving(true); setError('')
    const result = await contractsApi.recordPayment(contract.id, invoice.id, { paidAmount: value, paymentDate: date })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: 'پرداخت ثبت شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={WalletCards} title="ثبت پرداخت" subtitle={`صورت‌وضعیت ${invoice.invoiceNumberFa} · ${contract.title}`} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="payment-form" className="ue-save" disabled={saving}>{saving ? 'در حال ثبت...' : 'ثبت پرداخت'}</button></div>
        </>
      )}
    >
      <form id="payment-form" onSubmit={submit} noValidate>
        <p className="ue-note">مبلغ صورت‌وضعیت: <b>{rialsText(amount)}</b> ریال. عددی که وارد می‌کنید «جمع کل پرداخت‌شده تا این تاریخ» است، نه مبلغ همین نوبت.</p>
        <div className="ue-card ue-card--accent"><div className="ue-grid">
          <CtlField label="جمع پرداخت‌شده (ریال)" required hint={tomansHint(paid)}><AmountInput value={paid} onChange={setPaid} autoFocus /></CtlField>
          <CtlField label="تاریخ آخرین پرداخت" required><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></CtlField>
          <div className="ue-field ue-field--wide"><button type="button" className="ctl-link" onClick={() => setPaid(String(Math.round(amount)))}>پرداخت کامل ({rialsText(amount)})</button></div>
        </div></div>
      </form>
    </ControlDialog>
  )
}

/* ---- Suppliers: the parties of the contracts, kept once per tenant ---- */

const supplierCategoryLabels = { 0: 'پیمانکار', 1: 'تأمین‌کننده', 2: 'مشاور', 3: 'سایر' }
const supplierStatusLabels = { 0: 'فعال', 1: 'غیرفعال' }

function useSuppliers() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    suppliersApi.list().then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      setItems(arrayPayload(result))
    })
    return () => { cancelled = true }
  }, [reloadKey])

  return { items, error, reload: () => setReloadKey((value) => value + 1) }
}

function SupplierFormDialog({ supplier, onClose, onSaved }) {
  const isNew = !supplier
  const [form, setForm] = useState({
    name: supplier?.name || '', category: String(supplier?.category ?? 0), status: String(supplier?.status ?? 0),
    nationalId: supplier?.nationalId || '', contactPerson: supplier?.contactPerson || '', phone: supplier?.phone || '',
    email: supplier?.email || '', address: supplier?.address || '', description: supplier?.description || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) { setError('نام تأمین‌کننده را وارد کنید.'); return }
    setSaving(true); setError('')
    const fields = {
      name: form.name.trim(), category: Number(form.category), nationalId: emptyToNull(form.nationalId.trim()), contactPerson: emptyToNull(form.contactPerson.trim()),
      phone: emptyToNull(form.phone.trim()), email: emptyToNull(form.email.trim()), address: emptyToNull(form.address.trim()), description: emptyToNull(form.description.trim()),
    }
    const result = isNew ? await suppliersApi.create(fields) : await suppliersApi.update(supplier.id, { ...fields, status: Number(form.status) })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: isNew ? `تأمین‌کننده‌ی «${fields.name}» ثبت شد.` : `تأمین‌کننده‌ی «${fields.name}» ذخیره شد.` })
  }

  return (
    <ControlDialog
      size="sm" icon={isNew ? Plus : Pencil} title={isNew ? 'تأمین‌کننده‌ی جدید' : `ویرایش «${supplier.name}»`} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="supplier-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : isNew ? 'ثبت تأمین‌کننده' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="supplier-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="نام" required wide hint="با تغییر نام، نام طرف قرارداد در قراردادهای او هم عوض می‌شود"><input value={form.name} onChange={set('name')} maxLength={300} autoFocus /></CtlField>
          <CtlField label="نوع"><select value={form.category} onChange={set('category')}>{Object.entries(supplierCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          {isNew ? <span /> : <CtlField label="وضعیت" hint="تأمین‌کننده‌ی غیرفعال در قرارداد تازه انتخاب نمی‌شود"><select value={form.status} onChange={set('status')}>{Object.entries(supplierStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>}
          <CtlField label="شناسه‌ی ملی / کد ملی"><input className="ltr-input" value={form.nationalId} onChange={set('nationalId')} maxLength={50} /></CtlField>
          <CtlField label="رابط"><input value={form.contactPerson} onChange={set('contactPerson')} maxLength={200} /></CtlField>
          <CtlField label="تلفن"><input className="ltr-input" value={form.phone} onChange={set('phone')} maxLength={50} /></CtlField>
          <CtlField label="ایمیل"><input className="ltr-input" value={form.email} onChange={set('email')} maxLength={200} /></CtlField>
          <CtlField label="نشانی" wide><input value={form.address} onChange={set('address')} maxLength={1000} /></CtlField>
          <CtlField label="توضیحات" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={4000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

/* ---- Periodic evaluation of a supplier ---- */

const evaluationCriteria = [
  ['qualityScore', 'کیفیت کار'],
  ['timelinessScore', 'زمان‌بندی'],
  ['complianceScore', 'پایبندی به تعهدات'],
  ['cooperationScore', 'همکاری و پاسخ‌گویی'],
]
const scoreText = (value) => (value === null || value === undefined ? '—' : toPersianDigits(Number(value).toFixed(2).replace(/\.?0+$/, '')))
const scoreClass = (value) => (value === null || value === undefined ? '' : value >= 4 ? 'pos' : value < 2.5 ? 'neg' : '')

/** What the records say about a period, in one line. */
function EvaluationMetricsLine({ metrics }) {
  if (!metrics) return null
  return (
    <span>
      نقاط عطف: {toPersianDigits(metrics.milestonesInPeriod)} سررسید، <span className={metrics.lateMilestones ? 'neg' : ''}>{toPersianDigits(metrics.lateMilestones)} با تأخیر</span>
      {' · '}تعهدات: {toPersianDigits(metrics.obligationsInPeriod)} سررسید، <span className={metrics.missedObligations ? 'neg' : ''}>{toPersianDigits(metrics.missedObligations)} ایفانشده</span>
    </span>
  )
}

function SupplierEvaluationsDialog({ supplier, projects, canEvaluate, onClose, onChanged }) {
  const [items, setItems] = useState(null)
  const [contracts, setContracts] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(null)
  const reload = () => { setReloadKey((value) => value + 1); onChanged() }

  useEffect(() => {
    let cancelled = false
    suppliersApi.evaluations(supplier.id).then((result) => {
      if (cancelled) return
      if (!result.isSuccess) setNotice({ type: 'error', text: PersianMessages.error(result.error) })
      setItems(result.isSuccess ? arrayPayload(result) : [])
    })
    return () => { cancelled = true }
  }, [supplier.id, reloadKey])

  useEffect(() => {
    let cancelled = false
    suppliersApi.get(supplier.id).then((result) => { if (!cancelled && result.isSuccess) setContracts(unwrap(result)?.contracts || []) })
    return () => { cancelled = true }
  }, [supplier.id])

  const contractTitle = (id) => {
    const contract = contracts.find((item) => item.id === id)
    if (!contract) return 'قرارداد'
    const project = projects.find((item) => item.id === contract.projectId)
    return `${contract.title}${project ? ` · ${projectDisplayName(project)}` : ''}`
  }
  const remove = (item) => {
    if (!window.confirm('این ارزیابی حذف شود؟')) return
    runAction(() => suppliersApi.deleteEvaluation(supplier.id, item.id), 'ارزیابی حذف شد.', setNotice, reload)
  }

  return (
    <ControlDialog
      icon={ClipboardCheck} title={`ارزیابی‌های «${supplier.name}»`} subtitle="ارزیابی دوره‌ای عملکرد بر اساس امتیاز ارزیاب و سوابق ثبت‌شده" onClose={onClose}
      footer={<div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>بستن</button></div>}
    >
      <PageNotice notice={notice} onClose={() => setNotice(null)} />
      <section className="ue-section">
        <div className="ue-section-head"><h4><ClipboardCheck size={16} />ارزیابی‌ها</h4>{canEvaluate && <button type="button" className="ctl-link" onClick={() => setForm({ item: null })}><Plus size={14} /> ارزیابی تازه</button>}</div>
        {items === null ? <p className="ue-note">در حال بارگذاری...</p> : !items.length ? <p className="ue-note">این تأمین‌کننده هنوز ارزیابی نشده است.</p> : (
          <div className="table-scroll"><table className="cost-sub">
            <thead><tr><th>دوره</th><th>امتیاز کل</th>{evaluationCriteria.map(([, label]) => <th key={label}>{label}</th>)}<th>سوابق دوره</th><th /></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td>{item.periodStartFa} تا {item.periodEndFa}<small className="ctl-sp"> {item.contractId ? contractTitle(item.contractId) : 'همه‌ی قراردادها'}</small>{item.notes && <small className="ctl-sp"> · {item.notes}</small>}</td>
                <td><strong className={scoreClass(item.overallScore)}>{scoreText(item.overallScore)}</strong></td>
                {evaluationCriteria.map(([key]) => <td key={key}>{toPersianDigits(item[key])}</td>)}
                <td><small><EvaluationMetricsLine metrics={item.metrics} /></small></td>
                <td>{canEvaluate && (
                  <span className="row-actions">
                    <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setForm({ item })}><Pencil size={15} /></button>
                    <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => remove(item)}><Trash2 size={15} /></button>
                  </span>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      {form && (
        <EvaluationFormDialog
          supplier={supplier} item={form.item} contracts={contracts} contractTitle={contractTitle}
          onClose={() => setForm(null)} onSaved={(result) => { setForm(null); setNotice(result); reload() }}
        />
      )}
    </ControlDialog>
  )
}

function EvaluationFormDialog({ supplier, item, contracts, contractTitle, onClose, onSaved }) {
  const [form, setForm] = useState({
    periodStart: item?.periodStart || '', periodEnd: item?.periodEnd || '', contractId: item?.contractId || '', notes: item?.notes || '',
    qualityScore: String(item?.qualityScore ?? 3), timelinessScore: String(item?.timelinessScore ?? 3),
    complianceScore: String(item?.complianceScore ?? 3), cooperationScore: String(item?.cooperationScore ?? 3),
  })
  const [metrics, setMetrics] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const overall = evaluationCriteria.reduce((sum, [key]) => sum + Number(form[key]), 0) / evaluationCriteria.length

  // The facts of the period, read again whenever the period or the contract changes.
  useEffect(() => {
    let cancelled = false
    setMetrics(null)
    if (!form.periodStart || !form.periodEnd || form.periodEnd < form.periodStart) return undefined
    suppliersApi.evaluationMetrics(supplier.id, { from: form.periodStart, to: form.periodEnd, contractId: form.contractId || null })
      .then((result) => { if (!cancelled && result.isSuccess) setMetrics(unwrap(result)) })
    return () => { cancelled = true }
  }, [supplier.id, form.periodStart, form.periodEnd, form.contractId])

  async function submit(event) {
    event.preventDefault()
    if (!form.periodStart || !form.periodEnd) { setError('ابتدا و انتهای دوره را وارد کنید.'); return }
    if (form.periodEnd < form.periodStart) { setError('انتهای دوره نمی‌تواند قبل از ابتدای آن باشد.'); return }
    setSaving(true); setError('')
    const payload = {
      periodStart: form.periodStart, periodEnd: form.periodEnd, contractId: form.contractId || null, notes: emptyToNull(form.notes.trim()),
      qualityScore: Number(form.qualityScore), timelinessScore: Number(form.timelinessScore),
      complianceScore: Number(form.complianceScore), cooperationScore: Number(form.cooperationScore),
    }
    const result = item ? await suppliersApi.updateEvaluation(supplier.id, item.id, payload) : await suppliersApi.createEvaluation(supplier.id, payload)
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'ارزیابی ذخیره شد.' : 'ارزیابی ثبت شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={item ? Pencil : Plus} title={item ? 'ویرایش ارزیابی' : 'ارزیابی تازه'} subtitle={supplier.name} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="evaluation-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="evaluation-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="ابتدای دوره" required><input type="date" value={form.periodStart} onChange={set('periodStart')} autoFocus /></CtlField>
          <CtlField label="انتهای دوره" required><input type="date" value={form.periodEnd} onChange={set('periodEnd')} /></CtlField>
          <CtlField label="قرارداد" wide hint="خالی بماند، همه‌ی قراردادهای این تأمین‌کننده">
            <select value={form.contractId} onChange={set('contractId')}>
              <option value="">— همه‌ی قراردادها —</option>
              {contracts.map((contract) => <option key={contract.id} value={contract.id}>{contractTitle(contract.id)}</option>)}
            </select>
          </CtlField>
        </div>
        <p className="ue-note">{metrics ? <>سوابق این دوره: <EvaluationMetricsLine metrics={metrics} /></> : 'با تعیین دوره، سوابق آن (نقاط عطف و تعهدات) این‌جا نشان داده می‌شود.'}</p>
        </div>
        <div className="ue-card ue-card--accent"><div className="ue-grid">
          {evaluationCriteria.map(([key, label]) => (
            <CtlField key={key} label={label} hint="۱ ضعیف تا ۵ عالی">
              <select value={form[key]} onChange={set(key)}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{toPersianDigits(value)}</option>)}</select>
            </CtlField>
          ))}
          <CtlField label="امتیاز کل" hint="میانگین چهار معیار"><input value={scoreText(Math.round(overall * 100) / 100)} readOnly /></CtlField>
          <CtlField label="یادداشت" wide><textarea rows={2} value={form.notes} onChange={set('notes')} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

/* ---- Supplier dashboard for senior management: every supplier across all projects, side by side ---- */

const supplierAttentionLabels = {
  LowScore: 'امتیاز پایین',
  OverdueMilestones: 'نقطه‌ی عطف معوق',
  MissedObligations: 'تعهد ایفانشده',
  NotEvaluated: 'ارزیابی‌نشده با قرارداد فعال',
}
const supplierDashboardSorts = {
  amount: ['بیشترین مبلغ قرارداد', (a, b) => moneyRials(b.contractAmount) - moneyRials(a.contractAmount)],
  score: ['بهترین امتیاز', (a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1)],
  weakest: ['ضعیف‌ترین امتیاز', (a, b) => (a.latestScore ?? 99) - (b.latestScore ?? 99)],
  risk: ['بیشترین معوقات', (a, b) => (b.overdueMilestones + b.missedObligations) - (a.overdueMilestones + a.missedObligations)],
  outstanding: ['بیشترین بدهی معوق', (a, b) => moneyRials(b.outstandingPayable) - moneyRials(a.outstandingPayable)],
}

function SupplierDashboard({ onEvaluate, reloadKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('amount')

  useEffect(() => {
    let cancelled = false
    suppliersApi.dashboard().then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      setDashboard(result.isSuccess ? unwrap(result) : { totals: null, rows: [] })
    })
    return () => { cancelled = true }
  }, [reloadKey])

  const rows = useMemo(() => [...(dashboard?.rows || [])].sort(supplierDashboardSorts[sort][1]), [dashboard, sort])
  const attention = (dashboard?.rows || []).filter((row) => row.attention?.length)
  const totals = dashboard?.totals
  const exportDashboard = () => downloadCsv('supplier-dashboard.csv',
    ['رتبه', 'تأمین‌کننده', 'نوع', 'پروژه', 'قرارداد', 'قرارداد فعال', 'مبلغ (ریال)', 'بدهی معوق (ریال)', 'نقطه‌ی عطف معوق', 'تعهد ایفانشده', 'آخرین امتیاز', 'میانگین امتیاز', 'نیازمند توجه'],
    rows.map((row, index) => [index + 1, row.name, enumLabel(row.category, supplierCategoryLabels), row.projectCount, row.contractCount, row.activeContractCount,
      moneyRials(row.contractAmount), moneyRials(row.outstandingPayable), row.overdueMilestones, row.missedObligations, row.latestScore ?? '', row.averageScore ?? '',
      (row.attention || []).map((code) => supplierAttentionLabels[code] || code).join('، ')]))

  if (dashboard === null) return <p className="data-state">در حال بارگذاری...</p>

  return (
    <>
      {error && <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{error}</span></div>}
      {totals && (
        <ControlKpis items={[
          { icon: Truck, tone: 'navy', label: 'تأمین‌کننده', value: toPersianDigits(totals.supplierCount), note: `${toPersianDigits(totals.activeSupplierCount)} فعال · ${toPersianDigits(totals.projectCount)} پروژه` },
          { icon: CircleDollarSign, tone: 'blue', label: 'مبلغ قراردادها', value: rialsText(moneyRials(totals.contractAmount)), note: `ریال · بدهی معوق ${rialsText(moneyRials(totals.outstandingPayable))}` },
          { icon: TriangleAlert, tone: 'red', label: 'نیازمند توجه', value: toPersianDigits(totals.needingAttention), note: `${toPersianDigits(totals.overdueMilestones)} نقطه‌ی عطف معوق · ${toPersianDigits(totals.missedObligations)} تعهد ایفانشده` },
          { icon: ClipboardCheck, tone: 'green', label: 'میانگین امتیاز', value: scoreText(totals.averageLatestScore), note: `از آخرین ارزیابیِ ${toPersianDigits(totals.evaluatedSuppliers)} تأمین‌کننده` },
        ]} />
      )}

      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title"><div><h3>نیازمند توجه</h3><p>امتیاز آخرین ارزیابی زیر ۲٫۵، نقطه‌ی عطف یا تعهدِ عقب‌افتاده، یا قرارداد فعال بدون هیچ ارزیابی.</p></div></div>
        {!attention.length ? <p className="ue-note">موردی نیازمند توجه نیست.</p> : (
          <div className="table-scroll"><table>
            <thead><tr><th>تأمین‌کننده</th><th>دلیل</th><th>آخرین امتیاز</th><th /></tr></thead>
            <tbody>{attention.map((row) => (
              <tr key={row.supplierId}>
                <td className="ctl-main"><strong>{row.name}</strong><small>{toPersianDigits(row.activeContractCount)} قرارداد فعال در {toPersianDigits(row.projectCount)} پروژه</small></td>
                <td><span className="ctl-links">{row.attention.map((code) => <span key={code} className="ctl-chip">{supplierAttentionLabels[code] || code}</span>)}</span></td>
                <td><strong className={scoreClass(row.latestScore)}>{scoreText(row.latestScore)}</strong></td>
                <td><span className="row-actions"><button type="button" title="ارزیابی‌های دوره‌ای" aria-label="ارزیابی‌های دوره‌ای" onClick={() => onEvaluate({ id: row.supplierId, name: row.name })}><ClipboardCheck size={15} /></button></span></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title">
          <div><h3>رتبه‌بندی تأمین‌کنندگان</h3><p>همه‌ی پروژه‌ها؛ مبلغ‌ها فقط از قراردادهای تأییدشده.</p></div>
          <div className="ctl-filters">
            <select className="ctl-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="مرتب‌سازی">
              {Object.entries(supplierDashboardSorts).map(([key, [label]]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <button type="button" className="ctl-link" onClick={exportDashboard} disabled={!rows.length}><Download size={14} /> خروجی Excel</button>
          </div>
        </div>
        <DataState loading={false} empty={!rows.length}>
          <div className="table-scroll"><table>
            <thead><tr><th>#</th><th>تأمین‌کننده</th><th>پروژه</th><th>قرارداد</th><th>مبلغ (ریال)</th><th>بدهی معوق</th><th>عطف معوق</th><th>تعهد ایفانشده</th><th>آخرین امتیاز</th><th>میانگین</th></tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={row.supplierId}>
                <td>{toPersianDigits(index + 1)}</td>
                <td className="ctl-main"><strong>{row.name}</strong><small>{enumLabel(row.category, supplierCategoryLabels)}{row.status === 1 ? ' · غیرفعال' : ''}</small></td>
                <td>{toPersianDigits(row.projectCount)}</td>
                <td>{toPersianDigits(row.contractCount)}<small className="ctl-sp"> ({toPersianDigits(row.activeContractCount)} فعال)</small></td>
                <td>{rialsText(moneyRials(row.contractAmount))}</td>
                <td className={moneyRials(row.outstandingPayable) > 0 ? 'neg' : ''}>{rialsText(moneyRials(row.outstandingPayable))}</td>
                <td className={row.overdueMilestones ? 'neg' : ''}>{toPersianDigits(row.overdueMilestones)}</td>
                <td className={row.missedObligations ? 'neg' : ''}>{toPersianDigits(row.missedObligations)}</td>
                <td title={row.latestPeriodEndFa ? `تا ${row.latestPeriodEndFa}` : 'ارزیابی نشده'}><strong className={scoreClass(row.latestScore)}>{scoreText(row.latestScore)}</strong></td>
                <td>{scoreText(row.averageScore)}{row.evaluationCount > 0 && <small className="ctl-sp"> ({toPersianDigits(row.evaluationCount)})</small>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </DataState>
      </section>
    </>
  )
}

function SuppliersPage({ data }) {
  const { can } = useAuth()
  const suppliers = useSuppliers()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)
  const [detail, setDetail] = useState(null)
  const [evaluating, setEvaluating] = useState(null)
  const [view, setView] = useState('list')
  const canManage = can('Contracts.ManageSuppliers')
  const projectName = (id) => projectDisplayName(data.projects.find((project) => project.id === id))
  const items = suppliers.items || []
  const shown = items.filter((item) => !search.trim() || `${item.name} ${item.nationalId || ''} ${item.contactPerson || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const total = (key) => items.reduce((sum, item) => sum + moneyRials(item.stats?.[key]), 0)

  // The contracts of the supplier that is opened, with the figures of each.
  useEffect(() => {
    let cancelled = false
    setDetail(null)
    if (!open) return undefined
    suppliersApi.get(open).then((result) => { if (!cancelled) setDetail(result.isSuccess ? unwrap(result) : { contracts: [], error: PersianMessages.error(result.error) }) })
    return () => { cancelled = true }
  }, [open, suppliers.items])

  const remove = (item) => {
    if (!window.confirm(`تأمین‌کننده‌ی «${item.name}» حذف شود؟`)) return
    runAction(() => suppliersApi.remove(item.id), 'تأمین‌کننده حذف شد.', setNotice, suppliers.reload)
  }

  const exportSuppliers = () => downloadCsv('suppliers.csv', ['تأمین‌کننده', 'نوع', 'وضعیت', 'شناسه‌ی ملی', 'تعداد قرارداد', 'مبلغ (ریال)', 'صورت‌حساب‌شده (ریال)', 'پرداخت‌شده (ریال)', 'بدهی معوق (ریال)'],
    shown.map((item) => [item.name, enumLabel(item.category, supplierCategoryLabels), enumLabel(item.status, supplierStatusLabels), item.nationalId || '', item.stats?.contractCount ?? 0,
      moneyRials(item.stats?.contractAmount), moneyRials(item.stats?.invoicedAmount), moneyRials(item.stats?.paidAmount), moneyRials(item.stats?.outstandingPayable)]))

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا" title="مدیریت تأمین‌کنندگان" action={null}
        description="شناسنامه‌ی پیمانکاران، تأمین‌کنندگان و مشاوران، با قراردادها، صورت‌حساب‌ها و پرداخت هر کدام در همه‌ی پروژه‌ها"
      />
      <DataState loading={data.loading} error={data.error} empty={false}>
        {!can('Contracts.View') ? <p className="data-state data-state--error">برای دیدن این بخش، دسترسی «مشاهده‌ی قراردادها» (Contracts.View) لازم است.</p> : (
          <>
            <PageNotice notice={notice} onClose={() => setNotice(null)} />
            {suppliers.error && <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{suppliers.error}</span></div>}
            <nav className="settings-subtabs ctl-subtabs">
              <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><Truck size={16} />فهرست و شناسنامه</button>
              <button type="button" className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><LayoutDashboard size={16} />داشبورد مدیریتی</button>
            </nav>
            {view === 'dashboard' && <SupplierDashboard data={data} onEvaluate={setEvaluating} reloadKey={suppliers.items} />}
            {view === 'list' && (<>
            <ControlKpis items={[
              { icon: Truck, tone: 'navy', label: 'تأمین‌کننده', value: toPersianDigits(items.length), note: `${toPersianDigits(items.filter((item) => item.status === 0).length)} فعال` },
              { icon: FileText, tone: 'blue', label: 'قرارداد', value: toPersianDigits(items.reduce((sum, item) => sum + (item.stats?.contractCount || 0), 0)), note: 'همه‌ی وضعیت‌ها' },
              { icon: CircleDollarSign, tone: 'red', label: 'صورت‌حساب‌شده', value: rialsText(total('invoicedAmount')), note: 'ریال، تأییدشده' },
              { icon: CircleAlert, tone: 'green', label: 'بدهی معوق', value: rialsText(total('outstandingPayable')), note: 'ریال، هنوز پرداخت‌نشده' },
            ]} />
            <section className="task-panel task-table-panel ctl-panel ctl-block">
              <div className="task-panel-title">
                <div><h3>فهرست تأمین‌کنندگان</h3><p>مبلغ‌ها فقط از قراردادهای تأییدشده جمع شده است. برای دیدن قراردادهای هر کدام، روی نام بزنید.</p></div>
                <div className="ctl-filters">
                  <input className="users-search" type="search" placeholder="جست‌وجوی نام یا شناسه..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="جست‌وجو" />
                  <button type="button" className="ctl-link" onClick={exportSuppliers} disabled={!shown.length}><Download size={14} /> خروجی Excel</button>
                  {canManage && <button type="button" className="users-add" onClick={() => setForm({ supplier: null })}><Plus size={16} />تأمین‌کننده‌ی جدید</button>}
                </div>
              </div>
              <DataState loading={suppliers.items === null} empty={!shown.length}>
                <div className="table-scroll"><table>
                  <thead><tr><th>تأمین‌کننده</th><th>نوع</th><th>قرارداد</th><th>مبلغ (ریال)</th><th>صورت‌حساب‌شده</th><th>پرداخت‌شده</th><th>بدهی معوق</th><th>امتیاز</th><th>وضعیت</th><th>عملیات</th></tr></thead>
                  <tbody>
                    {shown.map((item) => (
                      <Fragment key={item.id}>
                        <tr className="cost-clickable" onClick={() => setOpen(open === item.id ? null : item.id)}>
                          <td className="ctl-main"><strong><ChevronDown size={14} className={open === item.id ? 'cost-open' : ''} /> {item.name}</strong>{(item.nationalId || item.contactPerson) && <small>{[item.nationalId && `شناسه ${toPersianDigits(item.nationalId)}`, item.contactPerson].filter(Boolean).join(' · ')}</small>}</td>
                          <td>{enumLabel(item.category, supplierCategoryLabels)}</td>
                          <td>{toPersianDigits(item.stats?.contractCount ?? 0)}</td>
                          <td>{rialsText(moneyRials(item.stats?.contractAmount))}</td>
                          <td>{rialsText(moneyRials(item.stats?.invoicedAmount))}</td>
                          <td>{rialsText(moneyRials(item.stats?.paidAmount))}</td>
                          <td className={moneyRials(item.stats?.outstandingPayable) > 0 ? 'neg' : ''}>{rialsText(moneyRials(item.stats?.outstandingPayable))}</td>
                          <td title={item.stats?.evaluationCount ? `آخرین ارزیابی تا ${item.stats.latestPeriodEndFa} · میانگین ${scoreText(item.stats.averageScore)} از ${toPersianDigits(item.stats.evaluationCount)} ارزیابی` : 'ارزیابی نشده'}>
                            {item.stats?.evaluationCount ? <strong className={scoreClass(item.stats.latestScore)}>{scoreText(item.stats.latestScore)}</strong> : '—'}
                          </td>
                          <td>{enumLabel(item.status, supplierStatusLabels)}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <span className="row-actions">
                              <button type="button" title="ارزیابی‌های دوره‌ای" aria-label="ارزیابی‌های دوره‌ای" onClick={() => setEvaluating(item)}><ClipboardCheck size={15} /></button>
                              {canManage && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setForm({ supplier: item })}><Pencil size={15} /></button>}
                              {canManage && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => remove(item)}><Trash2 size={15} /></button>}
                            </span>
                          </td>
                        </tr>
                        {open === item.id && (detail === null
                          ? <tr className="cost-subrow"><td colSpan={10}>در حال بارگذاری...</td></tr>
                          : !(detail.contracts || []).length
                            ? <tr className="cost-subrow"><td colSpan={10}>{detail.error || 'این تأمین‌کننده هنوز قراردادی ندارد.'}</td></tr>
                            : detail.contracts.map((contract) => (
                              <tr key={contract.id} className="cost-subrow">
                                <td colSpan={2}>{contract.title} <small className="ctl-sp">شماره {contract.contractNumberFa} · {projectName(contract.projectId)}</small></td>
                                <td />
                                <td>{rialsText(moneyRials(contract.approvalStatus === 2 ? contract.summary?.currentAmount : contract.originalAmount))}</td>
                                <td>{contract.approvalStatus === 2 ? rialsText(moneyRials(contract.summary?.invoicedAmount)) : '—'}</td>
                                <td>{contract.approvalStatus === 2 ? rialsText(moneyRials(contract.summary?.paidAmount)) : '—'}</td>
                                <td>{contract.approvalStatus === 2 ? rialsText(moneyRials(contract.summary?.outstandingPayable)) : '—'}</td>
                                <td />
                                <td colSpan={2}><ApprovalBadge status={contract.approvalStatus} /></td>
                              </tr>
                            )))}
                      </Fragment>
                    ))}
                  </tbody>
                </table></div>
              </DataState>
            </section>
            </>)}
            {evaluating && (
              <SupplierEvaluationsDialog
                supplier={evaluating} projects={data.projects} canEvaluate={can('Contracts.EvaluateSuppliers')}
                onClose={() => setEvaluating(null)} onChanged={suppliers.reload}
              />
            )}
            {form && (
              <SupplierFormDialog
                supplier={form.supplier} onClose={() => setForm(null)}
                onSaved={(result) => { setForm(null); setNotice(result); suppliers.reload() }}
              />
            )}
          </>
        )}
      </DataState>
    </>
  )
}

/* ---- Changes: the project's change requests, and the addenda of its contracts ---- */

const changeTypeLabels = { 0: 'دامنه', 1: 'زمان‌بندی', 2: 'هزینه', 3: 'کیفیت', 4: 'سایر' }
const changePriorityLabels = { 0: 'کم', 1: 'عادی', 2: 'زیاد', 3: 'فوری' }
const changeStatusLabels = { 0: 'پیش‌نویس', 1: 'در انتظار تأیید', 2: 'تأییدشده', 3: 'ردشده', 4: 'اجراشده', 5: 'لغوشده' }
const changeStatusClass = { 0: 'todo', 1: 'review', 2: 'doing', 3: 'rejected', 4: 'done', 5: 'todo' }
const ChangeStatusBadge = ({ status }) => <span className={`status-pill ${changeStatusClass[status] ?? 'todo'}`}>{enumLabel(status, changeStatusLabels)}</span>
const signedDays = (days) => (days ? `${days > 0 ? '+' : ''}${toPersianDigits(days)} روز` : '—')
const signedRials = (rials) => (rials ? `${rials > 0 ? '+' : ''}${rialsText(rials)}` : '—')

function useChangeRequests(projectId) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!projectId) { setItems([]); return undefined }
    setItems(null)
    changeRequestsApi.list(projectId).then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      setItems(arrayPayload(result))
    })
    return () => { cancelled = true }
  }, [projectId, reloadKey])

  return { items, error, reload: () => setReloadKey((value) => value + 1) }
}

function ChangesPage({ data }) {
  const { can } = useAuth()
  const [tab, setTab] = useState('requests')
  const projectIds = useMemo(() => (data.selectedProjectId ? [data.selectedProjectId] : []), [data.selectedProjectId])
  const contracts = useContractDetails(projectIds)
  const changes = useChangeRequests(data.selectedProjectId)
  const [notice, setNotice] = useState(null)
  const [adding, setAdding] = useState(false)
  const [changeForm, setChangeForm] = useState(null)
  const items = contracts.items || []
  const eligible = items.map(({ contract }) => contract).filter((contract) => contract.approvalStatus === 2 && contract.status !== 3)

  const actionNode = tab === 'requests'
    ? can('Contracts.ManageChanges') && <button type="button" onClick={() => setChangeForm({ item: null })} disabled={!data.selectedProjectId}><Plus size={18} />درخواست تغییر</button>
    : can('Contracts.ManageAddenda') && <button type="button" onClick={() => setAdding(true)} disabled={!eligible.length}><Plus size={18} />الحاقیه‌ی جدید</button>

  return (
    <>
      <TaskPageHeader
        section="کنترل و اجرا" title="مدیریت تغییرات" action={null}
        description="ثبت، بررسی و تصویب درخواست‌های تغییر پروژه با اثر آن بر دامنه، زمان و هزینه؛ و الحاقیه‌های قراردادها"
        actionNode={actionNode}
      >
        <ProjectSelector data={data} />
      </TaskPageHeader>
      <DataState loading={data.loading} error={data.error} empty={!data.projects.length}>
        {!can('Contracts.View') ? <p className="data-state data-state--error">برای دیدن این بخش، دسترسی «مشاهده‌ی قراردادها» (Contracts.View) لازم است.</p> : (
          <>
            <PageNotice notice={notice} onClose={() => setNotice(null)} />
            <nav className="settings-subtabs ctl-subtabs">
              <button type="button" className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}><RefreshCw size={16} />درخواست‌های تغییر</button>
              <button type="button" className={tab === 'addenda' ? 'active' : ''} onClick={() => setTab('addenda')}><FileText size={16} />الحاقیه‌های قرارداد</button>
              <button type="button" className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><LayoutDashboard size={16} />داشبورد تغییرات</button>
            </nav>
            {tab === 'requests' && (
              <ChangeRequestsPanel
                data={data} changes={changes} contracts={items.map(({ contract }) => contract)} canManage={can('Contracts.ManageChanges')}
                setNotice={setNotice} onEdit={(item) => setChangeForm({ item })}
              />
            )}
            {tab === 'addenda' && <ContractAddendaPanel data={data} contracts={contracts} changes={changes.items || []} />}
            {tab === 'dashboard' && <ChangeDashboardPanel data={data} reloadKey={`${changes.items?.length}:${contracts.items?.length}`} />}
            {changeForm && (
              <ChangeRequestFormDialog
                data={data} item={changeForm.item} contracts={items.map(({ contract }) => contract)}
                onClose={() => setChangeForm(null)} onSaved={(result) => { setChangeForm(null); setNotice(result); changes.reload() }}
              />
            )}
            {adding && <AddendumFormDialog contracts={eligible} tenantId={data.tenantId} onClose={() => setAdding(false)} onSaved={(result) => { setAdding(false); setNotice(result); contracts.reload() }} />}
          </>
        )}
      </DataState>
    </>
  )
}

/** The Workflow approvals of some change requests, by subject id, newest first (as Workflow returns them); empty without Workflow or Workflow.View. */
function useChangeApprovals(items) {
  const [approvals, setApprovals] = useState({})
  const key = (items || []).filter((item) => item.submittedAtUtc).map((item) => `${item.id}:${item.status}`).join(',')

  useEffect(() => {
    let cancelled = false
    const ids = (items || []).filter((item) => item.submittedAtUtc).map((item) => item.id)
    if (!ids.length) { setApprovals({}); return undefined }
    workflowApi.forSubjects('ChangeRequest', ids).then((result) => {
      if (cancelled) return
      const map = {}
      for (const instance of (result.isSuccess ? arrayPayload(result) : [])) {
        (map[instance.subjectId] ||= []).push(instance)
      }
      setApprovals(map)
    })
    return () => { cancelled = true }
  }, [key])

  return approvals
}

/** Where a pending approval stands: the step it waits on and who is to decide. */
const pendingStepText = (instance, userName) => {
  if (!instance || instance.status !== 0) return null
  const step = (instance.steps || []).find((item) => item.order === instance.currentStepOrder)
  const who = instance.currentApproverUserId || step?.approverUserId
  return `مرحله‌ی ${toPersianDigits(instance.currentStepOrder)} از ${toPersianDigits(instance.totalSteps)}${step?.name ? `: ${step.name}` : ''}${who ? ` · ${userName(who)}` : ''}`
}

function ChangeRequestsPanel({ data, changes, contracts, canManage, setNotice, onEdit }) {
  const [detail, setDetail] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const items = changes.items || []
  const approvals = useChangeApprovals(changes.items)
  const latestApproval = (id) => (approvals[id] || [])[0]
  const decided = items.filter((item) => item.status === 2 || item.status === 4)
  const cost = decided.reduce((sum, item) => sum + moneyRials(item.costImpact), 0)
  const days = decided.reduce((sum, item) => sum + Number(item.scheduleImpactDays || 0), 0)
  const act = (call, text) => runAction(call, text, setNotice, changes.reload)
  const contractTitle = (id) => contracts.find((contract) => contract.id === id)?.title

  const exportChanges = () => downloadCsv(`change-requests-${data.selectedProject?.code || 'project'}.csv`,
    ['کد', 'عنوان', 'نوع', 'اولویت', 'درخواست‌دهنده', 'قرارداد', 'اثر بر دامنه', 'اثر بر زمان (روز)', 'اثر بر هزینه (ریال)', 'وضعیت', 'تاریخ اجرا'],
    items.map((item) => [item.code, item.title, enumLabel(item.type, changeTypeLabels), enumLabel(item.priority, changePriorityLabels), item.requestedBy || '',
      contractTitle(item.contractId) || '', item.scopeImpact || '', item.scheduleImpactDays, moneyRials(item.costImpact), enumLabel(item.status, changeStatusLabels), item.implementedDateFa || '']))

  return (
    <>
      {changes.error && <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{changes.error}</span></div>}
      <ControlKpis items={[
        { icon: RefreshCw, tone: 'navy', label: 'درخواست تغییر', value: toPersianDigits(items.length), note: `${toPersianDigits(items.filter((item) => item.status === 0).length)} پیش‌نویس` },
        { icon: CircleAlert, tone: 'red', label: 'در انتظار تصمیم', value: toPersianDigits(items.filter((item) => item.status === 1).length), note: 'ارسال‌شده برای تأیید' },
        { icon: CircleDollarSign, tone: cost < 0 ? 'green' : 'blue', label: 'اثر هزینه‌ی مصوب', value: signedRials(cost), note: 'ریال، تأییدشده و اجراشده' },
        { icon: Clock3, tone: 'green', label: 'اثر زمانی مصوب', value: signedDays(days), note: 'تأییدشده و اجراشده' },
      ]} />
      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title">
          <div><h3>درخواست‌های تغییر پروژه</h3><p>هر درخواست پیش از ارسال باید اثرش بر دامنه، زمان و هزینه را داشته باشد؛ تصمیم از مسیر تأیید ثبت می‌شود.</p></div>
          <button type="button" className="ctl-link" onClick={exportChanges} disabled={!items.length}><Download size={14} /> خروجی Excel</button>
        </div>
        <DataState loading={changes.items === null} empty={!items.length}>
          <div className="table-scroll"><table>
            <thead><tr><th>درخواست</th><th>نوع</th><th>اثر بر زمان</th><th>اثر بر هزینه (ریال)</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>{items.map((item) => (
              <tr key={item.id}>
                <td className="ctl-main"><strong>{item.code} · {item.title}</strong><small>{[item.requestedBy && `درخواست‌دهنده: ${item.requestedBy}`, contractTitle(item.contractId) && `قرارداد: ${contractTitle(item.contractId)}`, `اولویت ${enumLabel(item.priority, changePriorityLabels)}`].filter(Boolean).join(' · ')}</small></td>
                <td>{enumLabel(item.type, changeTypeLabels)}</td>
                <td>{signedDays(item.scheduleImpactDays)}</td>
                <td className={moneyRials(item.costImpact) > 0 ? 'neg' : ''}>{signedRials(moneyRials(item.costImpact))}</td>
                <td><ChangeStatusBadge status={item.status} />{!item.hasImpactAssessment && item.status === 0 && <small className="ctl-sp neg"> بدون تحلیل اثر</small>}{item.status === 1 && pendingStepText(latestApproval(item.id), data.userName) && <small className="ctl-sp"> {pendingStepText(latestApproval(item.id), data.userName)}</small>}</td>
                <td><span className="row-actions">
                  <button type="button" title="جزئیات" aria-label="جزئیات" onClick={() => setDetail(item)}><Eye size={15} /></button>
                  {canManage && (item.status === 0 || item.status === 3) && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => onEdit(item)}><Pencil size={15} /></button>}
                  {canManage && item.status === 0 && <button type="button" className="ok" title="ارسال برای تصمیم" aria-label="ارسال برای تصمیم" onClick={() => act(() => changeRequestsApi.submit(item.id), 'درخواست تغییر برای تصمیم ارسال شد.')}><Send size={15} /></button>}
                  {canManage && item.status === 2 && <button type="button" className="ok" title="ثبت اجرا" aria-label="ثبت اجرا" onClick={() => setOutcome({ kind: 'implement', item })}><CheckCheck size={15} /></button>}
                  {canManage && [0, 2, 3].includes(item.status) && <button type="button" title="لغو" aria-label="لغو" onClick={() => setOutcome({ kind: 'cancel', item })}><X size={15} /></button>}
                  {canManage && item.status === 0 && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => window.confirm(`درخواست «${item.title}» حذف شود؟`) && act(() => changeRequestsApi.remove(item.id), 'درخواست تغییر حذف شد.')}><Trash2 size={15} /></button>}
                </span></td>
              </tr>
            ))}</tbody>
          </table></div>
        </DataState>
      </section>
      {detail && <ChangeRequestDetailDialog item={detail} approvals={[...(approvals[detail.id] || [])].reverse()} userName={data.userName} contractTitle={contractTitle(detail.contractId)} onClose={() => setDetail(null)} />}
      {outcome && (
        <ChangeOutcomeDialog
          kind={outcome.kind} item={outcome.item} onClose={() => setOutcome(null)}
          onSaved={(result) => { setOutcome(null); setNotice(result); changes.reload() }}
        />
      )}
    </>
  )
}

function ChangeRequestDetailDialog({ item, approvals, userName, contractTitle, onClose }) {
  const at = (value) => (value ? new Date(value).toLocaleDateString('fa-IR') : null)
  const rows = [
    ['نوع و اولویت', `${enumLabel(item.type, changeTypeLabels)} · ${enumLabel(item.priority, changePriorityLabels)}`],
    ['درخواست‌دهنده', item.requestedBy], ['قرارداد مرتبط', contractTitle], ['شرح', item.description], ['دلیل', item.reason],
    ['اثر بر دامنه', item.scopeImpact], ['اثر بر زمان', signedDays(item.scheduleImpactDays)], ['اثر بر هزینه', `${signedRials(moneyRials(item.costImpact))} ریال`],
    ['سایر اثرها', item.otherImpact], ['ثبت', at(item.createdAtUtc)], ['ارسال برای تصمیم', at(item.submittedAtUtc)],
    ['تصمیم', item.decidedAtUtc && `${enumLabel(item.status === 3 ? 3 : 2, changeStatusLabels)} در ${at(item.decidedAtUtc)}${item.decisionNote ? ` · «${item.decisionNote}»` : ''}`],
    ['اجرا', item.implementedDateFa], ['یادداشت نتیجه', item.outcomeNote],
  ].filter(([, value]) => value)
  return (
    <ControlDialog
      size="sm" icon={RefreshCw} title={`${item.code} · ${item.title}`} subtitle={enumLabel(item.status, changeStatusLabels)} onClose={onClose}
      footer={<div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>بستن</button></div>}
    >
      <div className="ue-card">
        {rows.map(([label, value]) => <p key={label} className="ue-note"><strong>{label}:</strong> {value}</p>)}
      </div>
      <section className="ue-section">
        <div className="ue-section-head"><h4><CheckCheck size={16} />سابقه‌ی تصمیم</h4></div>
        {!item.submittedAtUtc ? <p className="ue-note">هنوز برای تصمیم ارسال نشده است.</p>
          : !approvals.length ? <p className="ue-note">سابقه‌ای از مسیر تأیید نیست: یا برای درخواست‌های تغییر مسیری تعریف نشده بود و با ارسال مستقیم تصمیم گرفته شد، یا دسترسی دیدن کارتابل تأیید (Workflow.View) را ندارید.</p> : (
            <div className="table-scroll"><table className="cost-sub">
              <thead><tr><th>مرحله</th><th>تصمیم‌گیرنده</th><th>تصمیم</th><th>تاریخ</th><th>نظر</th></tr></thead>
              <tbody>{approvals.flatMap((instance, index) => {
                const stepName = (order) => (instance.steps || []).find((step) => step.order === order)?.name || `مرحله‌ی ${toPersianDigits(order)}`
                const decided = (instance.decisions || []).map((decision) => (
                  <tr key={decision.id}>
                    <td>{approvals.length > 1 ? `دور ${toPersianDigits(index + 1)} · ` : ''}{stepName(decision.stepOrder)}</td>
                    <td>{userName(decision.decidedByUserId)}{decision.onBehalfOfUserId && <small className="ctl-sp"> از طرف {userName(decision.onBehalfOfUserId)}</small>}</td>
                    <td><span className={`status-pill ${decision.approved ? 'done' : 'rejected'}`}>{decision.approved ? 'تأیید' : 'رد'}</span></td>
                    <td>{new Date(decision.decidedAtUtc).toLocaleDateString('fa-IR')}</td>
                    <td>{decision.comment || '—'}</td>
                  </tr>
                ))
                const waiting = instance.status === 0 && (
                  <tr key={`${instance.id}-waiting`}>
                    <td>{approvals.length > 1 ? `دور ${toPersianDigits(index + 1)} · ` : ''}{stepName(instance.currentStepOrder)}</td>
                    <td>{userName(instance.currentApproverUserId || (instance.steps || []).find((step) => step.order === instance.currentStepOrder)?.approverUserId)}</td>
                    <td><span className="status-pill review">در انتظار</span></td><td>—</td><td>—</td>
                  </tr>
                )
                return waiting ? [...decided, waiting] : decided
              })}</tbody>
            </table></div>
          )}
      </section>
    </ControlDialog>
  )
}

function ChangeOutcomeDialog({ kind, item, onClose, onSaved }) {
  const implementing = kind === 'implement'
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setSaving(true); setError('')
    const result = implementing
      ? await changeRequestsApi.implement(item.id, { date: emptyToNull(date), note: emptyToNull(note.trim()) })
      : await changeRequestsApi.cancel(item.id, emptyToNull(note.trim()))
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: implementing ? 'اجرای تغییر ثبت شد.' : 'درخواست تغییر لغو شد.' })
  }

  return (
    <ControlDialog
      size="sm" icon={implementing ? CheckCheck : X} title={implementing ? 'ثبت اجرای تغییر' : 'لغو درخواست تغییر'} subtitle={`${item.code} · ${item.title}`} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="change-outcome-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : implementing ? 'ثبت اجرا' : 'لغو درخواست'}</button></div>
        </>
      )}
    >
      <form id="change-outcome-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          {implementing && <CtlField label="تاریخ اجرا" hint="خالی بماند، امروز ثبت می‌شود"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus /></CtlField>}
          <CtlField label={implementing ? 'چگونه اجرا شد' : 'دلیل لغو'} wide><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

function ChangeRequestFormDialog({ data, item, contracts, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: item?.title || '', type: String(item?.type ?? 0), priority: String(item?.priority ?? 1), requestedBy: item?.requestedBy || '',
    contractId: item?.contractId || '', description: item?.description || '', reason: item?.reason || '',
    scopeImpact: item?.scopeImpact || '', scheduleImpactDays: item ? String(item.scheduleImpactDays || '') : '',
    costImpact: item ? String(Math.round(moneyRials(item.costImpact)) || '') : '', otherImpact: item?.otherImpact || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) { setError('عنوان درخواست را وارد کنید.'); return }
    const days = Number(toLatinDigits(form.scheduleImpactDays || '0'))
    if (!Number.isInteger(days)) { setError('اثر بر زمان باید عدد صحیح (روز) باشد.'); return }
    setSaving(true); setError('')
    const fields = {
      title: form.title.trim(), type: Number(form.type), priority: Number(form.priority), requestedBy: emptyToNull(form.requestedBy.trim()),
      contractId: form.contractId || null, description: emptyToNull(form.description.trim()), reason: emptyToNull(form.reason.trim()),
      scopeImpact: emptyToNull(form.scopeImpact.trim()), scheduleImpactDays: days, costImpact: Number(form.costImpact || 0), otherImpact: emptyToNull(form.otherImpact.trim()),
    }
    const result = item ? await changeRequestsApi.update(item.id, fields) : await changeRequestsApi.create({ tenantId: data.tenantId, projectId: data.selectedProjectId, ...fields })
    setSaving(false)
    if (!result.isSuccess) { setError(PersianMessages.error(result.error)); return }
    onSaved({ type: 'success', text: item ? 'درخواست تغییر ذخیره شد.' : 'درخواست تغییر ثبت شد. برای تصمیم، آن را ارسال کنید.' })
  }

  return (
    <ControlDialog
      size="sm" icon={item ? Pencil : Plus} title={item ? `ویرایش ${item.code}` : 'درخواست تغییر تازه'} subtitle={item?.status === 3 ? 'ردشده؛ با ذخیره دوباره پیش‌نویس می‌شود' : undefined} onClose={onClose}
      footer={(
        <>
          {error && <span className="ue-error"><TriangleAlert size={15} />{error}</span>}
          <div className="ue-foot-actions"><button type="button" className="ue-cancel" onClick={onClose}>انصراف</button><button type="submit" form="change-request-form" className="ue-save" disabled={saving}>{saving ? 'در حال ذخیره...' : 'ذخیره'}</button></div>
        </>
      )}
    >
      <form id="change-request-form" onSubmit={submit} noValidate>
        <div className="ue-card"><div className="ue-grid">
          <CtlField label="عنوان" required wide><input value={form.title} onChange={set('title')} maxLength={300} autoFocus /></CtlField>
          <CtlField label="نوع"><select value={form.type} onChange={set('type')}>{Object.entries(changeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          <CtlField label="اولویت"><select value={form.priority} onChange={set('priority')}>{Object.entries(changePriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></CtlField>
          <CtlField label="درخواست‌دهنده" hint="شخص یا واحد؛ می‌تواند بیرون از سامانه باشد"><input value={form.requestedBy} onChange={set('requestedBy')} maxLength={200} /></CtlField>
          <CtlField label="قرارداد مرتبط"><select value={form.contractId} onChange={set('contractId')}><option value="">— ندارد —</option>{contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title}</option>)}</select></CtlField>
          <CtlField label="شرح تغییر" wide><textarea rows={2} value={form.description} onChange={set('description')} maxLength={4000} /></CtlField>
          <CtlField label="دلیل" wide><textarea rows={2} value={form.reason} onChange={set('reason')} maxLength={2000} /></CtlField>
        </div></div>
        <div className="ue-card ue-card--accent"><div className="ue-grid">
          <CtlField label="اثر بر دامنه" wide hint="پیش از ارسال برای تصمیم لازم است"><textarea rows={3} value={form.scopeImpact} onChange={set('scopeImpact')} maxLength={4000} /></CtlField>
          <CtlField label="اثر بر زمان (روز)" hint="منفی یعنی صرفه‌جویی"><input className="ltr-input" value={form.scheduleImpactDays} onChange={set('scheduleImpactDays')} inputMode="numeric" /></CtlField>
          <CtlField label="اثر بر هزینه (ریال)" hint={form.costImpact && form.costImpact !== '-' ? tomansHint(form.costImpact.replace('-', '')) : 'منفی یعنی صرفه‌جویی'}>
            <AmountInput value={form.costImpact} onChange={(value) => setForm((current) => ({ ...current, costImpact: value }))} allowNegative />
          </CtlField>
          <CtlField label="سایر اثرها" wide hint="کیفیت، ریسک، منابع"><textarea rows={2} value={form.otherImpact} onChange={set('otherImpact')} maxLength={2000} /></CtlField>
        </div></div>
      </form>
    </ControlDialog>
  )
}

/** One project's changes at a glance: decisions waiting, the approved impact against the baseline, and changes made without approval. */
function ChangeDashboardPanel({ data, reloadKey }) {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!data.selectedProjectId) { setDashboard(null); return undefined }
    changeRequestsApi.dashboard(data.selectedProjectId).then((result) => {
      if (cancelled) return
      setError(result.isSuccess ? '' : PersianMessages.error(result.error))
      setDashboard(result.isSuccess ? unwrap(result) : null)
    })
    return () => { cancelled = true }
  }, [data.selectedProjectId, reloadKey])

  if (error) return <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{error}</span></div>
  if (!dashboard) return <p className="data-state">در حال بارگذاری...</p>
  const d = dashboard
  const percent = (value) => (value === null || value === undefined ? null : `${toPersianDigits(Number(value).toFixed(2).replace(/\.?0+$/, ''))}٪`)

  return (
    <>
      <ControlKpis items={[
        { icon: RefreshCw, tone: 'navy', label: 'درخواست تغییر', value: toPersianDigits(d.total), note: `${toPersianDigits(d.approved + d.implemented)} مصوب · ${toPersianDigits(d.rejected)} رد · ${toPersianDigits(d.cancelled)} لغو` },
        { icon: CircleAlert, tone: 'red', label: 'در انتظار تصمیم', value: toPersianDigits(d.pending), note: `${toPersianDigits(d.drafts)} پیش‌نویس هنوز ارسال نشده` },
        { icon: CircleDollarSign, tone: 'blue', label: 'اثر هزینه‌ی مصوب', value: signedRials(moneyRials(d.approvedCostImpact)), note: d.budget ? `${percent(d.costImpactPercent)} از بودجه‌ی ${rialsText(moneyRials(d.budget))} ریال` : 'ریال · بودجه‌ی پروژه ثبت نشده' },
        { icon: Clock3, tone: 'green', label: 'اثر زمانی مصوب', value: signedDays(d.approvedScheduleImpactDays), note: d.plannedDurationDays ? `${percent(d.scheduleImpactPercent)} از ${toPersianDigits(d.plannedDurationDays)} روز · پایان ${d.plannedEndDateFa} ← ${d.impactedEndDateFa}` : 'تاریخ‌های پروژه ثبت نشده' },
      ]} />

      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title"><div><h3>تغییرات بدون مصوبه</h3><p>الحاقیه‌های تأییدشده یا در انتظار تأیید که درخواست تغییرِ مصوبی پشتشان نیست. فقط هشدار است؛ چیزی رد نمی‌شود.</p></div></div>
        {!d.unapprovedAddenda.length ? <p className="ue-note">همه‌ی الحاقیه‌های اعمال‌شده مصوبه دارند.</p> : (
          <>
            <p className="ue-note neg"><TriangleAlert size={14} /> {toPersianDigits(d.unapprovedAddenda.length)} الحاقیه بدون مصوبه: {signedRials(moneyRials(d.unapprovedAmount))} ریال و {signedDays(d.unapprovedExtensionDays)}</p>
            <div className="table-scroll"><table>
              <thead><tr><th>قرارداد</th><th>الحاقیه</th><th>تغییر مبلغ (ریال)</th><th>تمدید</th><th>تأیید الحاقیه</th><th>دلیل هشدار</th></tr></thead>
              <tbody>{d.unapprovedAddenda.map((row) => (
                <tr key={row.addendumId}>
                  <td className="ctl-main"><strong>{row.contractTitle}</strong><small>شماره {row.contractNumberFa}</small></td>
                  <td>{toPersianDigits(row.number)}. {row.title}</td>
                  <td className={moneyRials(row.amountChange) < 0 ? 'neg' : ''}>{signedRials(moneyRials(row.amountChange))}</td>
                  <td>{signedDays(row.extensionDays)}</td>
                  <td><ApprovalBadge status={row.approvalStatus} /></td>
                  <td><span className="ctl-chip">{row.reason === 'NoChangeRequest' ? 'بدون درخواست تغییر' : 'درخواستش مصوب نیست'}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </section>

      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title"><div><h3>در انتظار تصمیم</h3><p>به ترتیب زمان ارسال؛ قدیمی‌ترین بالا.</p></div></div>
        {!d.pendingChanges.length ? <p className="ue-note">درخواستی منتظر تصمیم نیست.</p> : (
          <div className="table-scroll"><table>
            <thead><tr><th>درخواست</th><th>انتظار</th><th>اثر بر زمان</th><th>اثر بر هزینه (ریال)</th></tr></thead>
            <tbody>{d.pendingChanges.map((row) => (
              <tr key={row.id}>
                <td className="ctl-main"><strong>{row.code} · {row.title}</strong></td>
                <td className={row.waitingDays > 7 ? 'neg' : ''}>{toPersianDigits(row.waitingDays)} روز</td>
                <td>{signedDays(row.scheduleImpactDays)}</td>
                <td>{signedRials(moneyRials(row.costImpact))}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}

/** The addenda of the project's contracts: a change to a contract's amount or duration. */
function ContractAddendaPanel({ data, contracts, changes }) {
  const changeOf = (id) => changes.find((change) => change.id === id)
  const items = contracts.items || []
  const rows = items.flatMap(({ contract, addenda }) => addenda.map((addendum) => ({ contract, addendum })))
    .sort((a, b) => String(b.addendum.addendumDate || '').localeCompare(String(a.addendum.addendumDate || '')))
  const approved = rows.filter((row) => row.addendum.approvalStatus === 2)
  const net = approved.reduce((sum, row) => sum + Number(row.addendum.amountChange || 0), 0)
  const days = approved.reduce((sum, row) => sum + Number(row.addendum.extensionDays || 0), 0)
  const pending = rows.filter((row) => row.addendum.approvalStatus === 1).length

  const exportChanges = () => downloadCsv(`contract-changes-${data.selectedProject?.code || 'project'}.csv`,
    ['قرارداد', 'طرف قرارداد', 'شماره', 'عنوان', 'تاریخ', 'تغییر مبلغ (ریال)', 'تمدید (روز)', 'تأیید', 'مصوبه'],
    rows.map(({ contract, addendum }) => [contract.contractNumber, contract.counterparty, addendum.number, addendum.title, addendum.addendumDateFa || '', addendum.amountChange, addendum.extensionDays, enumLabel(addendum.approvalStatus, approvalLabels), changeOf(addendum.changeRequestId)?.code || '']))

  return (
    <>
      {contracts.error && <div className="users-notice error ctl-notice" role="alert"><CircleAlert size={16} /><span>{contracts.error}</span></div>}
      <ControlKpis items={[
        { icon: RefreshCw, tone: 'navy', label: 'الحاقیه', value: toPersianDigits(rows.length), note: 'همه‌ی وضعیت‌ها' },
        { icon: CircleDollarSign, tone: net < 0 ? 'green' : 'red', label: 'خالص تغییر مبلغ', value: `${net > 0 ? '+' : ''}${rialsText(net)}`, note: 'ریال، الحاقیه‌های تأییدشده' },
        { icon: Clock3, tone: 'blue', label: 'تمدید زمان', value: `${toPersianDigits(days)} روز`, note: 'الحاقیه‌های تأییدشده' },
        { icon: CircleAlert, tone: 'red', label: 'در انتظار تأیید', value: toPersianDigits(pending), note: 'هنوز اعمال نشده' },
      ]} />
      <section className="task-panel task-table-panel ctl-panel ctl-block">
        <div className="task-panel-title"><div><h3>الحاقیه‌های قراردادها</h3><p>الحاقیه فقط بعد از تأیید روی مبلغ و تاریخ پایان قرارداد اثر می‌گذارد.</p></div><button type="button" className="ctl-link" onClick={exportChanges} disabled={!rows.length}><Download size={14} /> خروجی Excel</button></div>
        <DataState loading={contracts.items === null} empty={!rows.length}>
          <div className="table-scroll"><table>
            <thead><tr><th>قرارداد</th><th>الحاقیه</th><th>تاریخ</th><th>تغییر مبلغ (ریال)</th><th>تمدید</th><th>تأیید</th><th>مصوبه</th></tr></thead>
            <tbody>{rows.map(({ contract, addendum }) => (
              <tr key={addendum.id}>
                <td className="ctl-main"><strong>{contract.title}</strong><small>{contract.counterparty}</small></td>
                <td className="ctl-main"><strong>{toPersianDigits(addendum.number)}. {addendum.title}</strong>{addendum.description && <small>{addendum.description}</small>}</td>
                <td>{addendum.addendumDateFa || '—'}</td>
                <td className={addendum.amountChange < 0 ? 'neg' : ''}>{addendum.amountChange > 0 ? '+' : ''}{rialsText(addendum.amountChange)}</td>
                <td>{addendum.extensionDays ? `${toPersianDigits(addendum.extensionDays)} روز` : '—'}</td>
                <td><ApprovalBadge status={addendum.approvalStatus} /></td>
                <td>{(() => {
                  const change = changeOf(addendum.changeRequestId)
                  if (change && (change.status === 2 || change.status === 4)) return <span title={change.title}>{change.code}</span>
                  if (addendum.approvalStatus === 0 || addendum.approvalStatus === 3) return <small className="ctl-sp">{change ? change.code : '—'}</small>
                  return <span className="ctl-chip neg" title={change ? `${change.code} ${enumLabel(change.status, changeStatusLabels)} است` : 'هیچ درخواست تغییرِ تأییدشده‌ای پشت این الحاقیه نیست'}><TriangleAlert size={12} /> {change ? `${change.code} مصوب نیست` : 'بدون مصوبه'}</span>
                })()}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </DataState>
      </section>
    </>
  )
}

function TaskManagement({ active, data }) {
  if (active === 'همه وظایف') return <AllTasksPage data={data} />
  if (active === 'برد کانبان') return <BoardPage data={data} />
  if (active === 'جلسات و صورت‌جلسات') return <MeetingsPage data={data} />
  if (active === 'گردش کار و الگوها') return <WorkflowPage data={data} />
  if (active === 'ماتریس مسئولیت‌ها (RACI)') return <RaciPage data={data} />
  return <TaskDashboardPage data={data} />
}

function ProjectManagement({ active, data }) {
  if (active === 'برنامه‌ریزی پروژه') return <ProjectPlanning data={data} />
  if (active === 'تقویم پروژه') return <CalendarPage data={data} />
  if (active === 'مدیریت مستندات') return <DocumentsPage data={data} />
  if (active === 'کنترل پیشرفت پروژه') return <ProgressPage data={data} />
  if (active === 'مدیریت استراتژیک پروژه‌ها') return <StrategyPage data={data} />
  return <ProjectPlanning data={data} />
}

function ControlManagement({ active, data }) {
  if (active === 'مدیریت ریسک') return <RisksPage data={data} />
  if (active === 'مدیریت منابع') return <ResourcesPage data={data} />
  if (active === 'مدیریت هزینه') return <CostPage data={data} />
  if (active === 'مدیریت ذینفعان') return <StakeholdersPage data={data} />
  if (active === 'مدیریت تأمین‌کنندگان') return <SuppliersPage data={data} />
  if (active === 'مدیریت تغییرات') return <ChangesPage data={data} />
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
          ) : active === governanceSubmenus[0].label ? (
            <ReportingExportPage />
          ) : active === governanceSubmenus[1].label ? (
            <KnowledgeManagement />
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
