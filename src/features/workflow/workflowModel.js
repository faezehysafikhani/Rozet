import { explainPmError } from '../project-management/pmErrors'

/** What each kind of approval is called (the Core's SubjectType strings). */
export const SUBJECT_TYPES = {
  Project: 'منشور پروژه',
  WaterfallActivity: 'فعالیت برنامه',
  ActivityProgress: 'پیشرفت فعالیت',
  AgileTask: 'وظیفه',
  AgileTaskStatus: 'تغییر وضعیت وظیفه',
  Risk: 'ریسک',
  RiskResponseStatus: 'وضعیت پاسخ به ریسک',
  Stakeholder: 'ذینفع',
  ProgressUpdate: 'گزارش پیشرفت',
  DelayReason: 'دلیل تأخیر',
  ProjectDocument: 'مستند',
  Action: 'اقدام',
  ActionStatus: 'تغییر وضعیت اقدام',
  Contract: 'قرارداد',
  ContractAddendum: 'الحاقیه‌ی قرارداد',
  ContractInvoice: 'صورت‌حساب قرارداد',
}
export const subjectLabel = (type) => SUBJECT_TYPES[type] || type || '—'

/** The groups an administrator edits one approval chain for (Core's ProjectWorkflowGroups keys). */
export const GROUPS = {
  charter: { label: 'منشور و تأیید پروژه', hint: 'ارسال پروژه برای تأیید' },
  activity_progress: { label: 'پیشرفت فعالیت‌ها و وظایف', hint: 'تأیید فعالیت، پیشرفت فعالیت، وظیفه و تغییر وضعیت وظیفه' },
  risks: { label: 'ریسک‌ها', hint: 'ریسک و وضعیت پاسخ به ریسک' },
  stakeholders: { label: 'ذینفعان', hint: 'ثبت ذینفع' },
  status_updates: { label: 'گزارش‌های پیشرفت', hint: 'گزارش وضعیت پروژه' },
  delay_reasons: { label: 'دلایل تأخیر', hint: 'ثبت دلیل تأخیر' },
  documents: { label: 'مستندات', hint: 'مستندات پروژه' },
  contracts: { label: 'قراردادها', hint: 'قرارداد و الحاقیه' },
  invoices: { label: 'صورت‌حساب‌ها', hint: 'صورت‌حساب قرارداد' },
  actions: { label: 'اقدام‌ها', hint: 'اقدام و تغییر وضعیت آن' },
}
export const groupOf = (key) => GROUPS[key] || { label: key, hint: '' }

/** Who a step points at when it is not one fixed person (the Core's approval participants). */
export const PARTICIPANTS = [
  { key: 'Manager', label: 'مدیر پروژه' },
  { key: 'Owner', label: 'مالک پروژه', note: 'اگر مالکی ثبت نشده باشد، مدیر پروژه تأیید می‌کند' },
  { key: 'Approver1', label: 'تأییدکننده‌ی اول اقدام' },
  { key: 'Approver2', label: 'تأییدکننده‌ی دوم اقدام' },
  { key: 'Approver3', label: 'تأییدکننده‌ی سوم اقدام' },
]
export const participantLabel = (key) => PARTICIPANTS.find((item) => item.key === key)?.label || key || '—'

const INSTANCE_STATUSES = [
  { value: 0, key: 'InProgress', label: 'در انتظار تأیید', tone: 'pending' },
  { value: 1, key: 'Approved', label: 'تأیید شد', tone: 'success' },
  { value: 2, key: 'Rejected', label: 'رد شد', tone: 'danger' },
]
export const instanceStatusOf = (raw) => INSTANCE_STATUSES.find((item) => item.value === raw || item.key === raw) || INSTANCE_STATUSES[0]

/** The permissions the approval screens look at. */
export const workflowPerms = (can) => ({
  view: can('Workflow.View'),
  approve: can('Workflow.Approve'),
  reject: can('Workflow.Reject'),
  configure: can('Workflow.Configure'),
  configureProjects: can('ProjectWorkflow.Configure'),
})

const MESSAGES = [
  [/already been decided/i, 'درخواست قبلاً تصمیم‌گیری شده است؛ فهرست را تازه کنید.'],
  [/assigned to another approver/i, 'این مرحله به تأییدکننده‌ی دیگری سپرده شده است.'],
  [/Workflow instance not found/i, 'درخواست تأیید پیدا نشد.'],
  [/Only the project's manager or owner can change/i, 'فقط مدیر یا مالک پروژه می‌تواند قواعد تأیید همین پروژه را تغییر دهد.'],
  [/Each step needs exactly one approver/i, 'هر مرحله باید دقیقاً یک تأییدکننده داشته باشد: یک شخص مشخص یا یک نقش.'],
  [/Step name is required/i, 'نام هر مرحله را وارد کنید.'],
  [/Unknown approver key/i, 'نقش تأییدکننده شناخته‌شده نیست.'],
  [/Unknown workflow group/i, 'گروه موردنظر شناخته‌شده نیست.'],
  [/Project was not found/i, 'پروژه پیدا نشد.'],
  [/someone other than the delegator/i, 'یک نفر غیر از خودتان را برای جانشینی انتخاب کنید.'],
  [/end date cannot be before/i, 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'],
  [/delegation has already ended/i, 'بازه‌ی ارجاع در گذشته است؛ تاریخ پایان را به امروز یا بعد از آن ببرید.'],
  [/overlapping delegation/i, 'میان این دو نفر در همین بازه ارجاع دیگری وجود دارد.'],
  [/Only a workflow administrator can delegate/i, 'ارجاع تأییدهای دیگران فقط با دسترسی مدیریت گردش کار ممکن است.'],
  [/Only the delegator or a workflow administrator can revoke/i, 'لغو ارجاع فقط برای ارجاع‌دهنده یا مدیر گردش کار ممکن است.'],
  [/Delegation not found/i, 'ارجاع پیدا نشد.'],
]

export function explainWorkflowError(result) {
  const text = typeof result?.error === 'string' ? result.error : ''
  const known = MESSAGES.find(([pattern]) => pattern.test(text))
  return known ? known[1] : explainPmError(result)
}

/** { ok, error } for ConfirmDialog-style callers. */
export const toWorkflowOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainWorkflowError(result) })

/** A new, empty step of an approval chain. */
export const blankStep = () => ({ name: '', kind: 'key', approverKey: 'Manager', approverUserId: '', isOptional: false })

/** Core step -> editor row. */
export const stepToRow = (step) => ({
  name: step.name || '', kind: step.approverUserId ? 'user' : 'key', approverKey: step.approverKey || 'Manager', approverUserId: step.approverUserId || '', isOptional: Boolean(step.isOptional),
})

/** Editor rows -> the request body (a fixed person is never "optional"). */
export const rowsToSteps = (rows) => rows.map((row) => (row.kind === 'user'
  ? { name: row.name.trim(), approverUserId: row.approverUserId, approverKey: null, isOptional: false }
  : { name: row.name.trim(), approverUserId: null, approverKey: row.approverKey, isOptional: Boolean(row.isOptional) }))

export const sameSteps = (a, b) => JSON.stringify(rowsToSteps(a)) === JSON.stringify(rowsToSteps(b))

/** The error in an editor's rows, or ''. */
export function validateRows(rows) {
  for (const [index, row] of rows.entries()) {
    if (!row.name.trim()) return `نام مرحله‌ی ${(index + 1).toLocaleString('fa-IR')} را وارد کنید.`
    if (row.kind === 'user' && !row.approverUserId) return `برای مرحله‌ی ${(index + 1).toLocaleString('fa-IR')} یک نفر را انتخاب کنید.`
  }
  return ''
}
