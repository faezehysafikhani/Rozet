import { explainPmError } from '../pmErrors'
import { formatJalali } from '../../../utils/jalali'

export const BASELINE_KINDS = [
  { value: 0, label: 'خط مبنا', hint: 'برنامه‌ی توافق‌شده برای مقایسه‌ی برنامه‌ی فعلی با آن.' },
  { value: 1, label: 'اطلاعات پیشرفت', hint: 'برنامه به‌همراه پیشرفت هر فعالیت در همین روز، به‌عنوان سابقه‌ی پیشرفت.' },
]
export const kindOf = (raw) => {
  const value = typeof raw === 'number' ? raw : raw === 'ProgressInformation' ? 1 : 0
  return BASELINE_KINDS[value]
}

const VARIANCE_KEYS = ['OnTrack', 'Late', 'Early', 'Added', 'Removed']
export const VARIANCE_STATUSES = [
  { key: 'OnTrack', label: 'مطابق برنامه', tone: 'done' },
  { key: 'Late', label: 'با تأخیر', tone: 'rejected' },
  { key: 'Early', label: 'زودتر', tone: 'doing' },
  { key: 'Added', label: 'افزوده‌شده', tone: 'review' },
  { key: 'Removed', label: 'حذف‌شده', tone: 'todo' },
]
export const varianceOf = (raw) => VARIANCE_STATUSES[typeof raw === 'number' ? raw : Math.max(0, VARIANCE_KEYS.indexOf(raw))] || VARIANCE_STATUSES[0]

/**
 * A variance in days (current minus baseline) in words: "۳ روز دیرتر" / "۲ روز زودتر" / "بدون تغییر"; '—' when one side is missing.
 * Words rather than a sign: a "+" or "−" in front of Persian digits lands on the wrong side in right-to-left text.
 * `durations` swaps the wording to longer / shorter.
 */
export function varianceText(days, durations = false) {
  if (days === null || days === undefined) return '—'
  if (days === 0) return 'بدون تغییر'
  const [more, less] = durations ? ['طولانی‌تر', 'کوتاه‌تر'] : ['دیرتر', 'زودتر']
  return `${Math.abs(days).toLocaleString('fa-IR')} روز ${days > 0 ? more : less}`
}
export const varianceTone = (days) => (days > 0 ? 'late' : days < 0 ? 'early' : '')

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })

// ---- Persian text for the Core's English messages of these three features
const MESSAGES = [
  [/Baseline not found/i, 'این نسخه پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/at most \d+ baselines/i, 'هر پروژه حداکثر ۵۰ نسخه‌ی خط مبنا دارد؛ ابتدا یکی را حذف کنید.'],
  [/nothing to baseline/i, 'پروژه‌ای که فعالیتی ندارد خط مبنا نمی‌شود؛ ابتدا فعالیت‌ها را ثبت کنید.'],
  [/Unknown kind of copy/i, 'نوع نسخه نامعتبر است.'],
  [/Name is required/i, 'نام نسخه را وارد کنید.'],
  [/Progress snapshot not found/i, 'این نقطه‌ی منحنی پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/stepDays must be between/i, 'گام نمودار باید بین ۱ و ۹۰ روز باشد.'],
  [/not valid MS Project XML/i, 'فایل یک XML معتبر MS Project نیست.'],
  [/no <Project> element/i, 'فایل یک خروجی XML برنامه‌ی MS Project نیست.'],
  [/more than \d+ tasks/i, 'فایل بیش از حد مجاز فعالیت دارد.'],
  [/contains no tasks/i, 'فایل هیچ فعالیتی ندارد.'],
  [/already has activities/i, 'این پروژه از قبل فعالیت دارد. برای ورود فایل، گزینه‌ی «جایگزینی فعالیت‌های موجود» را بزنید.'],
  [/between 1 byte and/i, 'فایل باید بین ۱ بایت تا ۲۰ مگابایت باشد.'],
  [/Project not found/i, 'پروژه پیدا نشد.'],
]
export function explainBaselineError(result) {
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}

/** Import warnings are English sentences with a leading count. */
export function explainImportWarning(text) {
  const rules = [
    [/^(\d+) task\(s\) repeated a unique ID/, (n) => `${n} فعالیت شناسه‌ی تکراری داشتند و نادیده گرفته شدند.`],
    [/^(\d+) task\(s\) had no name/, (n) => `${n} فعالیت نام نداشتند و «(بدون نام)» شدند.`],
    [/^(\d+) task name\(s\) were longer/, (n) => `${n} نام فعالیت از حد مجاز بلندتر بود و کوتاه شد.`],
    [/^Resources, assignments, costs/, () => 'منابع، تخصیص‌ها، هزینه‌ها، قیدها و تقویم‌ها وارد نمی‌شوند. تاریخ‌ها را همین سامانه حساب می‌کند (برای به‌روز شدن، «اعمال زمان‌بندی» را بزنید).'],
    [/^(\d+) link\(s\) to or from summary/, (n) => `${n} پیوند به/از فعالیت‌های خلاصه رد شد (پیوند فقط بین فعالیت‌های بدون زیرفعالیت ممکن است).`],
    [/^(\d+) link\(s\) referred to a task that is not/, (n) => `${n} پیوند به فعالیتی اشاره داشت که در فایل نیست و رد شد.`],
    [/^(\d+) duplicate link/, (n) => `${n} پیوند تکراری بین یک جفت فعالیت رد شد.`],
    [/^(\d+) link\(s\) would have formed a circular/, (n) => `${n} پیوند وابستگی دایره‌ای می‌ساخت و رد شد.`],
    [/^(\d+) link lag/, (n) => `${n} تأخیر پیوند از ۳۶۵ روز بیشتر بود و به ۳۶۵ روز محدود شد.`],
  ]
  for (const [pattern, render] of rules) {
    const hit = pattern.exec(text)
    if (hit) return render(Number(hit[1]).toLocaleString('fa-IR'))
  }
  return text
}

// ---- S-curve geometry
const DAY = 86400000
const toDay = (iso) => Date.parse(`${iso}T00:00:00Z`) / DAY

/**
 * Turns the Core's S-curve answer into drawable SVG data: x = days since the first date shown, y = percent.
 * The axis covers the planned curve plus any snapshot that falls outside it (a project can be re-planned after a snapshot).
 */
export function buildChart(curve, { width = 860, height = 340, pad = { top: 16, right: 20, bottom: 40, left: 46 } } = {}) {
  const planned = curve?.planned || []
  const actual = curve?.actual || []
  if (!planned.length) return null
  const days = [...planned.map((p) => p.date), ...actual.map((p) => p.date), curve.today].map(toDay)
  const min = Math.min(...days.slice(0, planned.length + actual.length))
  const max = Math.max(...days.slice(0, planned.length + actual.length), min + 1)
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const x = (iso) => pad.left + ((toDay(iso) - min) / (max - min)) * innerW
  const y = (percent) => pad.top + innerH - (Math.max(0, Math.min(100, Number(percent || 0))) / 100) * innerH
  const line = (points, key) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.date).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
  const tickCount = 5
  const xTicks = Array.from({ length: tickCount + 1 }, (_, index) => {
    const dayNumber = min + ((max - min) * index) / tickCount
    const iso = new Date(Math.round(dayNumber) * DAY).toISOString().slice(0, 10)
    return { x: pad.left + (innerW * index) / tickCount, label: formatJalali(iso), anchor: index === 0 ? 'start' : index === tickCount ? 'end' : 'middle' }
  })
  const todayInRange = toDay(curve.today) >= min && toDay(curve.today) <= max
  return {
    width, height, pad, innerW, innerH,
    plannedPath: line(planned, 'plannedProgress'),
    actualPath: actual.length > 1 ? line(actual, 'actualProgress') : '',
    actualDots: actual.map((point) => ({ x: x(point.date), y: y(point.actualProgress), date: point.date, value: point.actualProgress })),
    xTicks,
    yTicks: [0, 20, 40, 60, 80, 100].map((value) => ({ value, y: y(value) })),
    todayX: todayInRange ? x(curve.today) : null,
  }
}
