import { JALALI_MONTHS, JALALI_WEEKDAYS, isoToJalali, jalaliWeekdayIndex } from '../../utils/jalali'

export const PROJECT_STATUS_ORDER = ['Draft', 'Active', 'OnHold', 'Completed', 'Archived']
const PROJECT_STATUS_BY_NUMBER = PROJECT_STATUS_ORDER

/** The Core sends enums as names or numbers depending on the endpoint. */
export const projectStatusKey = (value) => (typeof value === 'number' ? PROJECT_STATUS_BY_NUMBER[value] : value)

// Donut: the four statuses of the design plus «بایگانی» when a project is archived.
export const DONUT_SEGMENTS = [
  { key: 'Active', label: 'فعال', color: '#0b3d91' },
  { key: 'Draft', label: 'در برنامه', color: '#4f93f5' },
  { key: 'OnHold', label: 'متوقف', color: '#d9a441' },
  { key: 'Completed', label: 'تکمیل شده', color: '#c3c9d6' },
  { key: 'Archived', label: 'بایگانی', color: '#8f98ab' },
]

const ACTION_STATUS_BY_NUMBER = ['Open', 'InProgress', 'Completed', 'Cancelled', 'OnHold']
export const actionStatusKey = (value) => (typeof value === 'number' ? ACTION_STATUS_BY_NUMBER[value] : value)

const PRIORITY_BY_NUMBER = ['Low', 'Normal', 'High', 'Urgent']
export const PRIORITY_LABELS = { Low: 'کم', Normal: 'متوسط', High: 'بالا', Urgent: 'فوری' }
export const priorityKey = (value) => (typeof value === 'number' ? PRIORITY_BY_NUMBER[value] : value) || 'Normal'

export const faNumber = (value) => Number(value || 0).toLocaleString('fa-IR')

/** Counts per project status, organisation-wide when the summary is available. */
export function statusCounts(summary, projects) {
  const raw = summary
    ? Object.fromEntries((summary.projectsByStatus || []).map(({ key, count }) => [projectStatusKey(key), count]))
    : projects.reduce((map, project) => {
      const key = projectStatusKey(project.status)
      map[key] = (map[key] || 0) + 1
      return map
    }, {})
  return DONUT_SEGMENTS
    .map((segment) => ({ ...segment, count: raw[segment.key] || 0 }))
    .filter((segment) => segment.count > 0 || segment.key !== 'Archived')
}

/** Arc geometry for a ring of `radius`: each segment's dash and offset, with a small gap between them. */
export function donutArcs(segments, radius, gap = 3) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const circumference = 2 * Math.PI * radius
  if (!total) return []
  const live = segments.filter((segment) => segment.count > 0)
  let offset = 0
  return live.map((segment) => {
    const length = (segment.count / total) * circumference
    const dash = live.length > 1 ? Math.max(length - gap, 0.5) : length
    const arc = { ...segment, dash, rest: circumference - dash, offset: -offset }
    offset += length
    return arc
  })
}

/** Growth of what was registered in the last 30 days against the 30 days before (null when there is nothing to compare). */
export function registrationTrend(projects, now = Date.now()) {
  const DAY = 86400000
  let recent = 0
  let before = 0
  for (const project of projects) {
    const at = Date.parse(project.createdAtUtc)
    if (Number.isNaN(at)) continue
    const age = now - at
    if (age >= 0 && age < 30 * DAY) recent += 1
    else if (age >= 30 * DAY && age < 60 * DAY) before += 1
  }
  if (!recent && !before) return null
  if (!before) return { kind: 'new', recent }
  const percent = Math.round(((recent - before) / before) * 100)
  return { kind: percent >= 0 ? 'up' : 'down', percent: Math.abs(percent), recent }
}

export const sharePercent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null)

const monthIndexOf = (iso) => {
  const parts = isoToJalali(String(iso || '').slice(0, 10))
  return parts ? parts.jy * 12 + (parts.jm - 1) : null
}

/**
 * Started and completed actions in each of the last `count` Jalali months. Actions carry no
 * creation or completion timestamp, so the plan dates stand in: an action counts as started in
 * the month of its start date and as completed (status Completed) in the month of its end date.
 */
export function monthlyActivity(actions, todayIso, count = 6) {
  const today = isoToJalali(todayIso)
  if (!today) return []
  const current = today.jy * 12 + (today.jm - 1)
  const months = Array.from({ length: count }, (_, i) => {
    const index = current - (count - 1 - i)
    const jy = Math.floor(index / 12)
    const jm = (index % 12) + 1
    return { index, jy, jm, label: JALALI_MONTHS[jm - 1], started: 0, completed: 0 }
  })
  const byIndex = new Map(months.map((month) => [month.index, month]))
  for (const action of actions) {
    const started = byIndex.get(monthIndexOf(action.startDate))
    if (started) started.started += 1
    if (actionStatusKey(action.status) === 'Completed') {
      const done = byIndex.get(monthIndexOf(action.endDate))
      if (done) done.completed += 1
    }
  }
  return months
}

/** 4 even ticks up to a round maximum: 0..40 for a peak of 28. */
export function niceScale(peak, steps = 4) {
  const rough = Math.max(peak, 1) / steps
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough)
  return { step, max: step * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => step * i) }
}

/** Smooth path through points (monotone-ish cubic: control points share the neighbours' x). */
export function smoothPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const next = points[i]
    const mid = (prev.x + next.x) / 2
    d += ` C ${mid} ${prev.y}, ${mid} ${next.y}, ${next.x} ${next.y}`
  }
  return d
}

/** The caller's open actions, nearest end date first (undated last). */
export function myOpenActions(actions, mine, userId, limit = 4) {
  const mineIds = new Set(mine?.myActionIds || [])
  return actions
    .filter((action) => mineIds.has(action.id) || action.responsibleUserId === userId || action.ownerUserId === userId)
    .filter((action) => ['Open', 'InProgress', 'OnHold'].includes(actionStatusKey(action.status)))
    .sort((a, b) => String(a.endDate || '9999').localeCompare(String(b.endDate || '9999')))
    .slice(0, limit)
}

/** "سه‌شنبه ۲۸ مهر ۱۴۰۵" */
export function longJalaliDate(iso) {
  const parts = isoToJalali(iso)
  if (!parts) return ''
  return `${JALALI_WEEKDAYS[jalaliWeekdayIndex(iso)]} ${faNumber(parts.jd)} ${JALALI_MONTHS[parts.jm - 1]} ${Number(parts.jy).toLocaleString('fa-IR', { useGrouping: false })}`
}
