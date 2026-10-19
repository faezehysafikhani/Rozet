import { explainPmError } from '../pmErrors'

/** What an action's SourceType holds when it was raised from a schedule activity: the same label the approval workflow uses for activities. */
export const ACTIVITY_SOURCE = 'WaterfallActivity'

export const ACTION_STATUSES = [
  { value: 0, key: 'Open', label: 'باز', tone: 'todo' },
  { value: 1, key: 'InProgress', label: 'در حال انجام', tone: 'doing' },
  { value: 2, key: 'Completed', label: 'تکمیل‌شده', tone: 'done' },
  { value: 3, key: 'Cancelled', label: 'لغوشده', tone: 'rejected' },
  { value: 4, key: 'OnHold', label: 'متوقف', tone: 'review' },
]
export const actionStatusOf = (raw) => ACTION_STATUSES.find((item) => item.value === raw || item.key === raw) || ACTION_STATUSES[0]
export const isClosed = (action) => [2, 3].includes(actionStatusOf(action.status).value)

export const ACTION_PRIORITIES = [
  { value: 0, label: 'کم' }, { value: 1, label: 'عادی' }, { value: 2, label: 'زیاد' }, { value: 3, label: 'فوری' },
]
export const priorityOf = (raw) => ACTION_PRIORITIES.find((item) => item.value === raw || item.label === raw) || ACTION_PRIORITIES[1]
/** An unfinished action whose end date has passed (ISO dates compare as text). */
export const isOverdue = (action, today) => !isClosed(action) && Boolean(action.endDate) && action.endDate < today

/** The actions raised from schedule activities, grouped by activity id. */
export function linkedByActivity(actions) {
  const map = {}
  ;(actions || []).filter((action) => action.sourceType === ACTIVITY_SOURCE && action.sourceId).forEach((action) => { (map[action.sourceId] ||= []).push(action) })
  return map
}

const MESSAGES = [
  [/Title is required/i, 'عنوان اقدام را وارد کنید.'],
  [/Organization unit was not found/i, 'واحد سازمانی پروژه پیدا نشد؛ آن را در ویرایش پروژه درست کنید.'],
  [/Work calendar was not found/i, 'تقویم کاری پیدا نشد؛ برای پروژه یک تقویم کاری انتخاب کنید.'],
  [/Action not found/i, 'این اقدام پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/End date.*before|cannot be before/i, 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'],
]
export function explainActionError(result) {
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}
