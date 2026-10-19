import { explainPmError } from '../pmErrors'

export const DEPENDENCY_TYPES = [
  { value: 0, label: 'پایان به شروع (FS)', short: 'FS' },
  { value: 1, label: 'شروع به شروع (SS)', short: 'SS' },
  { value: 2, label: 'پایان به پایان (FF)', short: 'FF' },
  { value: 3, label: 'شروع به پایان (SF)', short: 'SF' },
]
export const WEIGHTING_MODES = [
  { value: 0, label: 'دستی (وزن هر فعالیت را خودتان وارد می‌کنید)' },
  { value: 1, label: 'بر اساس زمان (مدت فعالیت)' },
  { value: 2, label: 'بر اساس هزینه' },
  { value: 3, label: 'بر اساس پیچیدگی' },
  { value: 4, label: 'ترکیبی (زمان، هزینه و پیچیدگی)' },
]
export const PLANNED_MODES = [
  { value: 0, label: 'ثبت‌شده (پیشرفت برنامه‌ای را خودتان وارد می‌کنید)' },
  { value: 1, label: 'پیوسته (توزیع یکنواخت در بازه‌ی هر فعالیت)' },
  { value: 2, label: 'صفر و صد (۰ تا شروع، ۱۰۰ پس از پایان)' },
]
export const LEVELS = [
  { value: 0, label: 'کم' },
  { value: 1, label: 'متوسط' },
  { value: 2, label: 'زیاد' },
]
const WEIGHTING_KEYS = ['Manual', 'Time', 'Cost', 'Complexity', 'Combined']
const PLANNED_KEYS = ['Stored', 'Continuous', 'ZeroHundred']
const DEPENDENCY_KEYS = ['FinishToStart', 'StartToStart', 'FinishToFinish', 'StartToFinish']
const LEVEL_KEYS = ['Low', 'Medium', 'High']

// Enums arrive as numbers (or names).
const asNumber = (keys, raw) => (typeof raw === 'number' ? raw : Math.max(0, keys.indexOf(raw)))
export const weightingValue = (raw) => asNumber(WEIGHTING_KEYS, raw)
export const plannedValue = (raw) => asNumber(PLANNED_KEYS, raw)
export const dependencyValue = (raw) => asNumber(DEPENDENCY_KEYS, raw)
export const levelValue = (raw) => asNumber(LEVEL_KEYS, raw)

const compareWbs = (a, b) => {
  const x = String(a.wbs || '').split('.').map(Number)
  const y = String(b.wbs || '').split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1)
  }
  return 0
}

/**
 * One row per activity: what is stored (names, people, estimates, approval) joined with what the Core
 * calculated (WBS code, level, dates, float, weight, progress, critical flag), in WBS order.
 */
export function buildRows(plan) {
  const stored = Object.fromEntries((plan?.activities || []).map((activity) => [activity.id, activity]))
  const incoming = {}
  ;(plan?.dependencies || []).forEach((dependency) => { (incoming[dependency.successorActivityId] ||= []).push(dependency) })
  const rows = (plan?.schedule?.activities || []).map((calc) => {
    const own = stored[calc.id] || {}
    return {
      ...own,
      id: calc.id,
      name: own.name ?? calc.name,
      parentId: calc.parentActivityId ?? null,
      isSummary: calc.isSummary,
      isMilestone: calc.isMilestone,
      wbs: calc.wbsCode || '',
      level: calc.level || 1,
      start: calc.start, finish: calc.finish, durationDays: calc.durationDays,
      totalFloat: calc.totalFloatDays, freeFloat: calc.freeFloatDays, isCritical: calc.isCritical,
      weight: Number(calc.weight || 0), storedWeight: Number(own.weight || 0),
      planned: Number(calc.plannedProgress || 0), actual: Number(calc.actualProgress || 0),
      cost: Number(calc.cost || 0), manHours: Number(calc.manHours || 0),
      usedDefaultDuration: calc.usedDefaultDuration,
      predecessors: incoming[calc.id] || [],
    }
  })
  return rows.sort(compareWbs)
}

export const rowById = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]))

/** The ids of everything below `id` in the tree. */
export function descendantsOf(rows, id) {
  const found = new Set()
  const walk = (parent) => rows.forEach((row) => { if (row.parentId === parent && !found.has(row.id)) { found.add(row.id); walk(row.id) } })
  walk(id)
  return found
}

/** Rows to draw when some summaries are collapsed. */
export function visibleRows(rows, collapsed) {
  if (!collapsed.size) return rows
  const byId = rowById(rows)
  const hidden = (row) => { for (let p = row.parentId; p; p = byId[p]?.parentId) if (collapsed.has(p)) return true; return false }
  return rows.filter((row) => !hidden(row))
}

// ---- Persian text for the Core's English schedule messages (the Core words them as plain English errors)
const MESSAGES = [
  [/cannot be its own parent/i, 'فعالیت نمی‌تواند والد خودش باشد.'],
  [/parent activity must exist/i, 'فعالیت والد باید در همین پروژه باشد.'],
  [/milestone cannot have sub-activities/i, 'نقطه‌عطف (milestone) نمی‌تواند زیرفعالیت داشته باشد.'],
  [/placed under itself or one of its own sub-activities/i, 'فعالیت را نمی‌توان زیر خودش یا زیرفعالیت‌هایش قرار داد.'],
  [/with dependencies cannot gain sub-activities/i, 'فعالیتی که وابستگی دارد زیرفعالیت نمی‌پذیرد؛ ابتدا وابستگی‌هایش را بردارید.'],
  [/with sub-activities cannot be a milestone/i, 'فعالیتی که زیرفعالیت دارد نقطه‌عطف نمی‌شود.'],
  [/Delete or reassign the sub-activities first/i, 'ابتدا زیرفعالیت‌ها را حذف یا جابه‌جا کنید، یا «حذف همراه با زیرفعالیت‌ها» را بزنید.'],
  [/cannot depend on itself/i, 'فعالیت نمی‌تواند به خودش وابسته باشد.'],
  [/connect activities without sub-activities/i, 'وابستگی فقط بین فعالیت‌های بدون زیرفعالیت ممکن است.'],
  [/already linked/i, 'این دو فعالیت قبلاً به هم وصل شده‌اند.'],
  [/circular dependency/i, 'این پیوند وابستگی دایره‌ای می‌سازد.'],
  [/Both activities must exist/i, 'هر دو فعالیت باید در پروژه وجود داشته باشند.'],
  [/Progress must be between 0 and 100/i, 'درصد پیشرفت باید بین ۰ و ۱۰۰ باشد.'],
  [/factors must add up to 100/i, 'مجموع ضریب‌های زمان، هزینه و پیچیدگی باید ۱۰۰ باشد.'],
  [/Each factor must be between 0 and 100/i, 'هر ضریب باید بین ۰ و ۱۰۰ باشد.'],
  [/Unknown weighting/i, 'حالت وزن‌دهی یا برنامه‌ریزی پیشرفت نامعتبر است.'],
  [/Activity not found/i, 'فعالیت پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
]

/** The Persian message for a failed schedule call. */
export function explainScheduleError(result) {
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}

/** Warnings come from the schedule calculation as English sentences. */
export function explainWarning(text) {
  const missing = /^'(.*)' has no duration or dates/.exec(text)
  if (missing) return `برای «${missing[1]}» مدت یا تاریخی ثبت نشده؛ یک روز فرض شده است.`
  if (/work calendar could not be loaded/i.test(text)) return 'تقویم کاری پروژه خوانده نشد؛ همه‌ی روزها کاری حساب شده‌اند.'
  return text
}

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })
