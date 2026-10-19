import { addDaysIso, isoToJalali, jalaliToIso, jalaliMonthLength, jalaliWeekdayIndex, todayIso } from '../../../utils/jalali'

// What the calendar can show. `perm` is the Core permission that lets a user read that source.
export const EVENT_KINDS = [
  { key: 'project', label: 'پروژه', perm: 'Projects.View' },
  { key: 'deliverable', label: 'خروجی', perm: 'Deliverables.View' },
  { key: 'activity', label: 'فعالیت', perm: 'WaterfallActivities.View' },
  { key: 'action', label: 'اقدام', perm: 'Actions.View' },
  { key: 'task', label: 'وظیفه', perm: 'AgileTasks.View' },
]
const KIND_ORDER = Object.fromEntries(EVENT_KINDS.map((kind, index) => [kind.key, index]))

// Enums arrive as numbers (or names); each list is in the Core's enum order.
const TASK_STATUS = ['برای انجام', 'در حال انجام', 'تکمیل شده', 'نیازمند بررسی']
const TASK_STATUS_KEYS = ['ToDo', 'InProgress', 'Done', 'UnderReview']
const TASK_PRIORITY = ['کم', 'متوسط', 'بالا', 'بحرانی']
const TASK_PRIORITY_KEYS = ['Low', 'Medium', 'High', 'Critical']
const ACTION_STATUS = ['باز', 'در حال انجام', 'تکمیل شده', 'لغو شده', 'متوقف']
const ACTION_STATUS_KEYS = ['Open', 'InProgress', 'Completed', 'Cancelled', 'OnHold']
const DELIVERABLE_STATUS = ['برنامه‌ریزی‌شده', 'در حال انجام', 'تحویل‌شده', 'پذیرفته‌شده', 'ردشده']
const DELIVERABLE_STATUS_KEYS = ['Planned', 'InProgress', 'Delivered', 'Accepted', 'Rejected']

const labelOf = (labels, keys, raw) => {
  const index = typeof raw === 'number' ? raw : keys.indexOf(raw)
  return labels[index] ?? 'نامشخص'
}
const isDone = (keys, raw, doneKeys) => doneKeys.includes(typeof raw === 'number' ? keys[raw] : raw)

/** The 5-6 week grid of a Jalali month, Saturday first: [{ iso, day, inMonth }]. */
export function buildMonthGrid(jy, jm) {
  const first = jalaliToIso(jy, jm, 1)
  const lead = jalaliWeekdayIndex(first)
  const length = jalaliMonthLength(jy, jm)
  const total = Math.ceil((lead + length) / 7) * 7
  return Array.from({ length: total }, (_, index) => {
    const iso = addDaysIso(first, index - lead)
    const parts = isoToJalali(iso)
    return { iso, day: parts.jd, inMonth: index >= lead && index < lead + length }
  })
}

/** Month before/after: { jy, jm }. */
export const shiftMonth = ({ jy, jm }, delta) => {
  const index = jy * 12 + (jm - 1) + delta
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 }
}

export const currentMonth = () => {
  const { jy, jm } = isoToJalali(todayIso())
  return { jy, jm }
}

const span = (start, end) => {
  const from = start || end
  const to = end || start
  return from && to ? (from <= to ? { start: from, end: to } : { start: to, end: from }) : null
}

/** Turns the Core's records into one shape: { id, kind, title, start, end, status, tone, done, meta }. */
export function taskEvent(task, { userName, projectName }) {
  if (!task.dueDate) return null
  const done = isDone(TASK_STATUS_KEYS, task.status, ['Done'])
  const priority = labelOf(TASK_PRIORITY, TASK_PRIORITY_KEYS, task.priority)
  return {
    id: `task-${task.id}`, kind: 'task', title: task.title, start: task.dueDate, end: task.dueDate,
    status: labelOf(TASK_STATUS, TASK_STATUS_KEYS, task.status), done,
    overdue: !done && task.dueDate < todayIso(),
    meta: [projectName(task.projectId), task.responsibleUserId ? `مسئول: ${userName(task.responsibleUserId)}` : null, `اولویت ${priority}`].filter(Boolean),
  }
}

export function activityEvent(activity, { userName, projectName }) {
  const range = span(activity.startDate, activity.endDate)
  if (!range) return null
  return {
    id: `activity-${activity.id}`, kind: 'activity', title: activity.name, ...range,
    status: `${Number(activity.actualProgress || 0).toLocaleString('fa-IR')}٪ پیشرفت`, done: Number(activity.actualProgress) >= 100,
    overdue: Number(activity.actualProgress) < 100 && range.end < todayIso(),
    meta: [projectName(activity.projectId), activity.responsibleUserId ? `مسئول: ${userName(activity.responsibleUserId)}` : null].filter(Boolean),
  }
}

export function actionEvent(action, { userName, projectName }) {
  const range = span(action.startDate, action.endDate)
  if (!range) return null
  const done = isDone(ACTION_STATUS_KEYS, action.status, ['Completed', 'Cancelled'])
  return {
    id: `action-${action.id}`, kind: 'action', title: action.title, ...range,
    status: labelOf(ACTION_STATUS, ACTION_STATUS_KEYS, action.status), done,
    overdue: !done && range.end < todayIso(),
    meta: [action.projectId ? projectName(action.projectId) : 'اقدام سازمانی', action.responsibleUserId ? `مسئول: ${userName(action.responsibleUserId)}` : null].filter(Boolean),
  }
}

export function deliverableEvent(deliverable, { userName, projectName }) {
  if (!deliverable.targetDate) return null
  const done = isDone(DELIVERABLE_STATUS_KEYS, deliverable.status, ['Delivered', 'Accepted'])
  return {
    id: `deliverable-${deliverable.id}`, kind: 'deliverable', title: deliverable.title, start: deliverable.targetDate, end: deliverable.targetDate,
    status: labelOf(DELIVERABLE_STATUS, DELIVERABLE_STATUS_KEYS, deliverable.status), done,
    overdue: !done && deliverable.targetDate < todayIso(),
    meta: [projectName(deliverable.projectId), deliverable.responsibleUserId ? `مسئول: ${userName(deliverable.responsibleUserId)}` : null].filter(Boolean),
  }
}

/** The start and the end of a project as two milestones. */
export function projectEvents(project) {
  return [
    project.startDate && { id: `project-start-${project.id}`, kind: 'project', title: `شروع پروژه ${project.name}`, start: project.startDate, end: project.startDate, status: 'شروع', done: false, meta: [project.name] },
    project.endDate && { id: `project-end-${project.id}`, kind: 'project', title: `پایان پروژه ${project.name}`, start: project.endDate, end: project.endDate, status: 'پایان', done: false, meta: [project.name] },
  ].filter(Boolean)
}

/** { 'yyyy-mm-dd': [event, ...] } for the days of the grid; a long event is clipped to the grid. */
export function groupByDay(events, gridFrom, gridTo) {
  const map = {}
  events.forEach((event) => {
    const from = event.start < gridFrom ? gridFrom : event.start
    const to = event.end > gridTo ? gridTo : event.end
    for (let iso = from; iso <= to; iso = addDaysIso(iso, 1)) (map[iso] ||= []).push(event)
  })
  Object.values(map).forEach((list) => list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title, 'fa')))
  return map
}
