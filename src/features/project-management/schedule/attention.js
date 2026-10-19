import { fmt } from './scheduleModel'

/** The kinds of things worth a manager's attention in a schedule, worst first. */
export const ATTENTION_KINDS = [
  { key: 'overdue', label: 'موعد گذشته', severity: 'high' },
  { key: 'behind', label: 'عقب از برنامه', severity: 'high' },
  { key: 'notStarted', label: 'شروع نشده', severity: 'medium' },
  { key: 'noOwner', label: 'بدون مسئول', severity: 'medium' },
  { key: 'actions', label: 'اقدام معوق', severity: 'medium' },
  { key: 'weights', label: 'وزن‌ها', severity: 'medium' },
  { key: 'critical', label: 'روی مسیر بحرانی', severity: 'info' },
  { key: 'assumed', label: 'مدت فرضی', severity: 'info' },
]
const KIND = Object.fromEntries(ATTENTION_KINDS.map((kind) => [kind.key, kind]))
const SEVERITY_ORDER = { high: 0, medium: 1, info: 2 }

const dayNumber = (iso) => (iso ? Date.parse(`${iso}T00:00:00Z`) / 86400000 : NaN)
/** Whole days from `from` to `to` (both ISO dates). */
export const daysBetween = (from, to) => Math.round(dayNumber(to) - dayNumber(from))

/**
 * Activities and project-level facts that need a look, from the rows of the schedule (see buildRows) as of `today` (ISO):
 *  - overdue: its finish date has passed and it is not complete;
 *  - behind: planned progress is ahead of actual by 5 points or more (15 or more is high; the Core classifies a report the same way);
 *  - notStarted: its start date has passed and no progress is recorded;
 *  - noOwner: unfinished and nobody is responsible;
 *  - critical: unfinished and on the critical path, so any delay moves the project finish;
 *  - assumed: no duration or dates were entered, so the Core assumed one day;
 *  - actions: unfinished actions raised from the activity whose end date has passed;
 *  - weights: with manual weighting the weights of the activities do not add up to 100 (the project cannot be sent for approval).
 * An activity that is overdue or not started is not also listed as behind. Groups (summary rows) are skipped: their figures roll up.
 */
export function buildAttention(rows, settings, today, actionsByActivity = {}) {
  const items = []
  const add = (kind, row, text, extra = {}) => items.push({ kind, severity: KIND[kind].severity, row, text, ...extra })

  rows.filter((row) => !row.isSummary).forEach((row) => {
    const done = Number(row.actual) >= 100
    const late = !done && row.finish && daysBetween(row.finish, today) > 0
    const stalled = !done && !late && row.start && daysBetween(row.start, today) > 0 && Number(row.actual) === 0
    if (late) add('overdue', row, `پایان برنامه‌ریزی‌شده ${daysBetween(row.finish, today).toLocaleString('fa-IR')} روز پیش بوده و پیشرفت ${fmt(row.actual, 0)}٪ است.`, { date: row.finish })
    else if (stalled) add('notStarted', row, `${daysBetween(row.start, today).toLocaleString('fa-IR')} روز از تاریخ شروع گذشته ولی پیشرفتی ثبت نشده است.`, { date: row.start })
    else if (!done) {
      const gap = Number(row.planned) - Number(row.actual)
      if (gap >= 5) add('behind', row, `پیشرفت واقعی ${fmt(row.actual, 0)}٪ در برابر ${fmt(row.planned, 0)}٪ برنامه‌ای (${fmt(gap, 0)} واحد درصد عقب‌تر).`, { severity: gap >= 15 ? 'high' : 'medium' })
    }
    const lateActions = (actionsByActivity[row.id] || []).filter((action) => ![2, 3].includes(action.status) && action.endDate && action.endDate < today)
    if (lateActions.length) add('actions', row, `${lateActions.length.toLocaleString('fa-IR')} اقدام مرتبط با این فعالیت موعدش گذشته و تمام نشده است.`)
    if (!done && !row.responsibleUserId) add('noOwner', row, 'مسئولی برای این فعالیت تعیین نشده است.')
    if (!done && row.isCritical && !late) add('critical', row, 'روی مسیر بحرانی است؛ هر تأخیری پایان پروژه را عقب می‌اندازد.')
    if (row.usedDefaultDuration) add('assumed', row, 'مدت یا تاریخی ثبت نشده و یک روز فرض شده است.')
  })

  const manual = (typeof settings?.weighting === 'number' ? settings.weighting : ['Manual', 'Time', 'Cost', 'Complexity', 'Combined'].indexOf(settings?.weighting)) <= 0
  const leaves = rows.filter((row) => !row.isSummary)
  if (manual && leaves.length) {
    const total = Math.round(leaves.reduce((sum, row) => sum + Number(row.weight || 0), 0))
    if (total !== 100) add('weights', null, `مجموع وزن فعالیت‌ها ${total.toLocaleString('fa-IR')} است، نه ۱۰۰؛ تا اصلاح نشود پروژه برای تأیید ارسال نمی‌شود.`)
  }

  return items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || ATTENTION_KINDS.findIndex((k) => k.key === a.kind) - ATTENTION_KINDS.findIndex((k) => k.key === b.kind) || String(a.row?.wbs || '').localeCompare(String(b.row?.wbs || ''), undefined, { numeric: true }))
}
