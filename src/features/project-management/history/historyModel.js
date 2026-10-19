import { explainPmError } from '../pmErrors'
import { formatJalali } from '../../../utils/jalali'

/** What changed: the Core records the C# type name of the entity. Only the ones that belong to a project are listed. */
export const ENTITIES = {
  Project: 'پروژه',
  Activity: 'فعالیت',
  ActivityDependency: 'وابستگی فعالیت',
  ActivityProgressSubmission: 'گزارش پیشرفت فعالیت',
  WaterfallProjectSettings: 'تنظیمات زمان‌بندی',
  ScheduleBaseline: 'خط مبنا',
  ProgressSnapshot: 'نقطه‌ی منحنی پیشرفت',
  ProgressUpdate: 'گزارش وضعیت',
  DelayReason: 'دلیل تأخیر',
  Deliverable: 'خروجی',
  KpiDefinition: 'شاخص (KPI)',
  ProjectDocument: 'سند',
  ProjectDocumentVersion: 'نسخه‌ی سند',
  ProjectStrategyAlignment: 'همسوسازی با راهبرد',
  Risk: 'ریسک',
  RiskResponseSubmission: 'گزارش پاسخ به ریسک',
  RiskProjectSettings: 'تنظیمات ریسک',
  Stakeholder: 'ذینفع',
  StakeholderProjectSettings: 'تنظیمات ذینفعان',
  ProjectMember: 'عضو تیم',
  GovernanceRole: 'نقش حاکمیتی',
  AgileTask: 'وظیفه‌ی چابک',
  AgileChecklistItem: 'مورد چک‌لیست',
  AgileTaskStatusSubmission: 'گزارش وضعیت وظیفه',
  Sprint: 'اسپرینت',
  Contract: 'قرارداد',
  ItemDelegation: 'تفویض اختیار',
}
export const entityLabel = (name) => ENTITIES[name] || name

export const CHANGE_KINDS = [
  { value: 0, key: 'Added', label: 'افزودن', tone: 'done' },
  { value: 1, key: 'Modified', label: 'ویرایش', tone: 'doing' },
  { value: 2, key: 'Deleted', label: 'حذف', tone: 'rejected' },
]
export const changeKindOf = (raw) => CHANGE_KINDS.find((item) => item.value === raw || item.key === raw) || CHANGE_KINDS[1]

const PROPERTIES = {
  Name: 'نام', Title: 'عنوان', Description: 'شرح', Code: 'کد', Status: 'وضعیت', Type: 'نوع', Kind: 'نوع', Note: 'یادداشت', Notes: 'یادداشت‌ها', Comment: 'توضیح',
  ApprovalStatus: 'وضعیت تأیید', ApproverUserId: 'تأییدکننده', ResponsibleUserId: 'مسئول', ManagerUserId: 'مدیر', OwnerUserId: 'مالک', RiskOwnerUserId: 'مالک ریسک', UserId: 'کاربر',
  DelegateUserId: 'تفویض‌گیرنده', DelegatorUserId: 'تفویض‌کننده', OrganizationUnitId: 'واحد سازمانی', ParentActivityId: 'فعالیت والد', PredecessorActivityId: 'پیش‌نیاز', SuccessorActivityId: 'پس‌نیاز',
  DeliverableId: 'خروجی', ActivityId: 'فعالیت', DocumentId: 'سند', BaselineId: 'نسخه‌ی خط مبنا',
  StartDate: 'تاریخ شروع', EndDate: 'تاریخ پایان', TargetDate: 'تاریخ هدف', RegisterDate: 'تاریخ ثبت', DueDate: 'موعد', SnapshotDate: 'تاریخ نقطه', ProjectStart: 'شروع پروژه', ProjectFinish: 'پایان پروژه',
  DurationDays: 'مدت (روز)', LagDays: 'تأخیر وابستگی (روز)', ManHours: 'نفرساعت', Weight: 'وزن', Cost: 'هزینه', Importance: 'اهمیت', Complexity: 'پیچیدگی', IsMilestone: 'نقطه‌عطف', IsSummary: 'فعالیت خلاصه', IsActive: 'فعال', IsDone: 'انجام‌شده',
  PlannedProgress: 'پیشرفت برنامه‌ای', ActualProgress: 'پیشرفت واقعی', ConfirmedProgress: 'پیشرفت تأییدی', SubmittedProgress: 'پیشرفت گزارش‌شده', ApprovedProgress: 'پیشرفت تأییدشده', IsPartialRejection: 'رد جزئی',
  StatusDescription: 'شرح وضعیت', DelayReasons: 'دلایل تأخیر', DocumentName: 'نام سند', RootCause: 'علت ریشه‌ای', TimeImpactDays: 'اثر زمانی (روز)', CostImpact: 'اثر هزینه‌ای', CorrectiveAction: 'اقدام اصلاحی',
  AcceptanceCriteria: 'معیار پذیرش', Formula: 'فرمول', TargetValue: 'مقدار هدف', Weighting: 'روش وزن‌دهی', TimeFactor: 'ضریب زمان', CostFactor: 'ضریب هزینه', ComplexityFactor: 'ضریب پیچیدگی',
  Goal: 'هدف', Requirements: 'نیازمندی‌ها', Constraints: 'محدودیت‌ها', Assumptions: 'مفروضات', Charter: 'منشور', Expectations: 'انتظارات', Position: 'سمت', RoleTitle: 'عنوان نقش',
  FileName: 'نام فایل', ContentType: 'نوع محتوا', SizeBytes: 'حجم (بایت)', CurrentVersion: 'نسخه‌ی فعلی', VersionNumber: 'شماره‌ی نسخه', DocumentType: 'نوع سند', Number: 'شماره',
  AlignmentLevel: 'سطح همسوسازی', AlignmentPercentage: 'درصد همسوسازی', ProbabilityScore: 'امتیاز احتمال', ImpactScore: 'امتیاز اثر', SeverityScore: 'امتیاز شدت', ResponsePlan: 'برنامه‌ی پاسخ', ResponseStatus: 'وضعیت پاسخ',
  Amount: 'مبلغ', OriginalAmount: 'مبلغ اولیه', PaidAmount: 'مبلغ پرداخت‌شده', ContractNumber: 'شماره‌ی قرارداد', Counterparty: 'طرف قرارداد', SignDate: 'تاریخ امضا', Priority: 'اولویت', StoryPoints: 'امتیاز داستان', Email: 'ایمیل', Phone: 'تلفن',
  WorkCalendarId: 'تقویم کاری', SprintNumber: 'شماره‌ی اسپرینت', Order: 'ترتیب', Text: 'متن',
}
export const propertyLabel = (name) => PROPERTIES[name] || name

const VALUES = {
  // project status / type
  Draft: 'پیش‌نویس', Active: 'فعال', OnHold: 'متوقف', Completed: 'تکمیل‌شده', Archived: 'آرشیو', Terminated: 'خاتمه‌یافته', Waterfall: 'آبشاری', Agile: 'چابک',
  // approval
  NotSubmitted: 'ثبت اولیه', PendingApproval: 'در انتظار تأیید', Approved: 'تأیید شده', Rejected: 'رد شده',
  // deliverable / kpi
  Planned: 'برنامه‌ریزی‌شده', InProgress: 'در حال انجام', Delivered: 'تحویل‌شده', Accepted: 'پذیرفته‌شده', Lag: 'تأخیری', Lead: 'پیشرو',
  // delay root cause
  Funding: 'تأمین مالی', Procurement: 'تدارکات', Permits: 'مجوزها', HumanResources: 'منابع انسانی', Other: 'سایر',
  // schedule
  Manual: 'دستی', Time: 'زمان', Cost: 'هزینه', Complexity: 'پیچیدگی', Combined: 'ترکیبی', Stored: 'ثبت‌شده', Continuous: 'پیوسته', ZeroHundred: 'صفر و صد',
  FinishToStart: 'پایان به شروع', StartToStart: 'شروع به شروع', FinishToFinish: 'پایان به پایان', StartToFinish: 'شروع به پایان',
  Baseline: 'خط مبنا', ProgressInformation: 'اطلاعات پیشرفت',
  Low: 'کم', Medium: 'متوسط', High: 'زیاد', None: 'ندارد',
  True: 'بله', False: 'خیر',
}

const toFa = (text) => String(text).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[digit])
const pad = (n) => String(n).padStart(2, '0')
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** "۱۴۰۵/۰۷/۲۸" and "۱۴:۳۰" for an instant in the browser's time zone. */
export function formatInstant(instant) {
  const date = new Date(instant)
  if (Number.isNaN(date.getTime())) return { day: '—', time: '' }
  return { day: formatJalali(isoOf(date)), time: toFa(`${pad(date.getHours())}:${pad(date.getMinutes())}`) }
}

/**
 * A recorded old/new value as text. The Core stores every value as text in the invariant culture: enums by name,
 * dates as MM/dd/yyyy, booleans as True/False, ids as GUIDs.
 */
export function formatValue(property, raw, userName) {
  if (raw === null || raw === undefined || raw === '') return '—'
  const text = String(raw)
  if (VALUES[text]) return VALUES[text]
  const dateOnly = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (dateOnly) return formatJalali(`${dateOnly[3]}-${dateOnly[1]}-${dateOnly[2]}`)
  const dateTime = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):\d{2}(?: ([+-]\d{2}:\d{2}))?$/.exec(text)
  if (dateTime) return `${formatJalali(`${dateTime[3]}-${dateTime[1]}-${dateTime[2]}`)} ${toFa(`${dateTime[4]}:${dateTime[5]}`)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return formatJalali(text.slice(0, 10))
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    return property.endsWith('UserId') && userName ? userName(text) : `…${text.slice(-6)}`
  }
  return toFa(text)
}

export const explainHistoryError = (result) => {
  const detail = typeof result?.error === 'string' ? result.error : ''
  if (/'to' cannot be before 'from'/i.test(detail)) return 'تاریخ پایان بازه نباید قبل از تاریخ شروع باشد.'
  if (/A project is required/i.test(detail)) return 'ابتدا یک پروژه انتخاب کنید.'
  return explainPmError(result)
}

/** Start / end of a Jalali-picked day (ISO yyyy-mm-dd) as the instants the Core filters on, in the browser's time zone. */
export const dayStart = (iso) => new Date(`${iso}T00:00:00`).toISOString()
export const dayEnd = (iso) => new Date(`${iso}T23:59:59.999`).toISOString()
