import { explainPmError } from '../project-management/pmErrors'
import { pmApi } from '../project-management/pmApi'
import { unwrap } from '../../services/api'

/** The four board columns, in board order. Values are the Core's AgileTaskStatus. */
export const STATUSES = [
  { value: 0, key: 'ToDo', label: 'برای انجام', tone: 'todo', color: '#8b92a2' },
  { value: 1, key: 'InProgress', label: 'در حال انجام', tone: 'doing', color: '#326fa4' },
  { value: 3, key: 'UnderReview', label: 'نیازمند بررسی', tone: 'review', color: '#9b7127' },
  { value: 2, key: 'Done', label: 'تکمیل شده', tone: 'done', color: '#3d845b' },
]
export const statusOf = (raw) => STATUSES.find((item) => item.value === raw || item.key === raw) || STATUSES[0]
export const isDone = (task) => statusOf(task.status).value === 2

export const PRIORITIES = [
  { value: 0, key: 'Low', label: 'کم', tone: 'low' },
  { value: 1, key: 'Medium', label: 'متوسط', tone: 'medium' },
  { value: 2, key: 'High', label: 'بالا', tone: 'high' },
  { value: 3, key: 'Critical', label: 'بحرانی', tone: 'high' },
]
export const priorityOf = (raw) => PRIORITIES.find((item) => item.value === raw || item.key === raw) || PRIORITIES[1]

export const SPRINT_STATUSES = [
  { value: 0, key: 'Planned', label: 'برنامه‌ریزی‌شده', tone: 'todo' },
  { value: 1, key: 'Active', label: 'فعال', tone: 'doing' },
  { value: 2, key: 'Completed', label: 'تمام‌شده', tone: 'done' },
]
export const sprintStatusOf = (raw) => SPRINT_STATUSES.find((item) => item.value === raw || item.key === raw) || SPRINT_STATUSES[0]

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })

/** An unfinished task whose due date has passed (ISO dates compare as text). */
export const isOverdue = (task, today) => !isDone(task) && Boolean(task.dueDate) && task.dueDate < today

const MESSAGES = [
  [/Agile task not found/i, 'این وظیفه پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/Title is required/i, 'عنوان را وارد کنید.'],
  [/Text is required/i, 'متن را وارد کنید.'],
  [/Name is required/i, 'نام را وارد کنید.'],
  [/Unknown (task )?status/i, 'وضعیت نامعتبر است.'],
  [/BeforeTaskId must be a card/i, 'جای رها کردن کارت معتبر نیست؛ دوباره تلاش کنید.'],
  [/checklist holds at most/i, 'چک‌لیست هر وظیفه حداکثر ۱۰۰ مورد دارد.'],
  [/Checklist item not found/i, 'این مورد چک‌لیست پیدا نشد.'],
  [/Tasks cannot be added to a completed sprint/i, 'اسپرینت تمام‌شده وظیفه‌ی تازه نمی‌پذیرد.'],
  [/task is already in that column/i, 'وظیفه همین حالا در همان ستون است.'],
  [/earlier status change for this task is still waiting/i, 'تغییر وضعیت قبلی این وظیفه هنوز در انتظار تأیید است.'],
  [/Sprint not found/i, 'این اسپرینت پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/completed sprint can no longer be edited/i, 'اسپرینت تمام‌شده دیگر ویرایش نمی‌شود.'],
  [/Only a planned sprint can be started/i, 'فقط اسپرینت برنامه‌ریزی‌شده شروع می‌شود.'],
  [/needs a start date and an end date before it can be started/i, 'پیش از شروع اسپرینت، تاریخ شروع و پایان را وارد کنید.'],
  [/already has an active sprint/i, 'پروژه یک اسپرینت فعال دارد؛ ابتدا آن را تمام کنید.'],
  [/Only an active sprint can be completed/i, 'فقط اسپرینت فعال تمام می‌شود.'],
  [/target sprint must be a sprint of the same project/i, 'اسپرینت مقصد باید از همین پروژه باشد.'],
  [/Unfinished tasks cannot move to a completed sprint/i, 'وظایف ناتمام را نمی‌توان به اسپرینت تمام‌شده برد.'],
  [/Only a planned sprint can be deleted/i, 'فقط اسپرینت برنامه‌ریزی‌شده حذف می‌شود؛ اسپرینت فعال یا تمام‌شده بخشی از تاریخچه‌ی پروژه است.'],
  [/Move the sprint's tasks to the backlog/i, 'ابتدا وظایف این اسپرینت را به بک‌لاگ یا اسپرینت دیگر ببرید.'],
  [/Give at least one task/i, 'دست‌کم یک وظیفه انتخاب کنید.'],
  [/Every task must exist in the sprint's project/i, 'همه‌ی وظایف باید از همین پروژه باشند.'],
  [/That task is not in this sprint/i, 'این وظیفه در این اسپرینت نیست.'],
  [/end date cannot be before the start date/i, 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'],
  [/needs a start and an end date before it can be charted/i, 'برای رسم نمودار، اسپرینت باید تاریخ شروع و پایان داشته باشد.'],
  [/more than \d+ days/i, 'نمودار اسپرینت‌های طولانی‌تر از ۳۶۶ روز رسم نمی‌شود.'],
  [/An item cannot be handed to yourself/i, 'نمی‌توان کار را به خودتان ارجاع داد.'],
  [/already handed this item over/i, 'شما این وظیفه را قبلاً ارجاع داده‌اید.'],
  [/already handed this item on/i, 'آن شخص این وظیفه را به کس دیگری ارجاع داده است؛ ابتدا همان ارجاع را پایان دهید.'],
  [/Delegation not found/i, 'این ارجاع پیدا نشد.'],
  [/hand-over has already ended/i, 'این ارجاع قبلاً پایان یافته است.'],
  [/Only the person who handed the item over can take it back/i, 'فقط کسی که کار را ارجاع داده می‌تواند آن را پس بگیرد.'],
]
/** The Persian message for a failed call of the task screens. */
export function explainTaskError(result) {
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}
export const toTaskOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainTaskError(result) })

/** What the user may do with tasks, from the permissions of the Core. */
export const taskPerms = (can) => ({
  view: can('AgileTasks.View'), create: can('AgileTasks.Create'), edit: can('AgileTasks.Edit'), delete: can('AgileTasks.Delete'),
  submit: can('AgileTasks.Submit'), submitStatus: can('AgileStatus.Submit'), manageSprints: can('AgileSprints.Manage'),
  delegate: can('ItemDelegation.Delegate'), viewDelegations: can('ItemDelegation.View'), manageDelegations: can('ItemDelegation.Manage'),
})

/**
 * Puts a task in a column. A change of column goes through the approval workflow when the user may submit it
 * (it lands at once when the project has no chain, otherwise the task waits and `pending` is true); otherwise
 * the user's own right to edit moves it directly. A move inside a column, or onto a given spot, is a direct move.
 * Returns { ok, error, pending }.
 */
export async function moveTask({ task, status, beforeTaskId, comment, tenantId, perms }) {
  const target = statusOf(status).value
  const changesColumn = target !== statusOf(task.status).value
  if (changesColumn && perms.submitStatus) {
    const result = await pmApi.agile.statusSubmissions.submit({ tenantId, projectId: task.projectId, taskId: task.id, status: target, comment: comment || null })
    if (!result.isSuccess) return { ok: false, error: explainTaskError(result), pending: false }
    const approval = unwrap(result)?.approvalStatus
    const applied = approval === 2 || approval === 'Approved'
    if (applied && beforeTaskId && perms.edit) await pmApi.agile.tasks.move(task.id, target, beforeTaskId)
    return { ok: true, error: '', pending: !applied }
  }
  if (!perms.edit) return { ok: false, error: 'برای تغییر وضعیت وظیفه دسترسی «ارسال تغییر وضعیت» یا «ویرایش وظایف» لازم است.', pending: false }
  const result = await pmApi.agile.tasks.move(task.id, target, beforeTaskId)
  return { ok: result.isSuccess, error: result.isSuccess ? '' : explainTaskError(result), pending: false }
}

export const moveMessage = (task, status, outcome) => (outcome.pending
  ? `درخواست انتقال «${task.title}» به «${statusOf(status).label}» برای تأیید ارسال شد.`
  : `«${task.title}» به «${statusOf(status).label}» منتقل شد.`)

/** The body of PUT /agile/tasks/{id} for a task as the Core returned it, with some fields changed. */
export const taskPayload = (task, changes = {}) => ({
  title: task.title, description: task.description ?? null, responsibleUserId: task.responsibleUserId ?? null, approverUserId: task.approverUserId ?? null,
  dueDate: task.dueDate ?? null, priority: priorityOf(task.priority).value, sprintNumber: task.sprintNumber ?? null, ...changes,
})

/** Hands a task to someone: the Core keeps the record, and the task's responsible person becomes the delegate. */
export async function delegateTask({ task, toUserId, tenantId }) {
  const record = await pmApi.delegations.create({ itemType: 1, itemId: task.id, projectId: task.projectId, delegateUserId: toUserId })
  if (!record.isSuccess) return { ok: false, error: explainTaskError(record) }
  const moved = await pmApi.agile.tasks.update(task.id, taskPayload(task, { responsibleUserId: toUserId }))
  if (!moved.isSuccess) return { ok: false, error: `ارجاع ثبت شد ولی مسئول وظیفه عوض نشد: ${explainTaskError(moved)}` }
  return { ok: true, error: '' }
}

/** Takes a hand-over back: the Core ends it (and what was handed on after it) and says who the task returns to. */
export async function takeBackTask({ task, delegation }) {
  const ended = await pmApi.delegations.end(delegation.id)
  if (!ended.isSuccess) return { ok: false, error: explainTaskError(ended) }
  const back = unwrap(ended)?.restoreToUserId
  if (back) {
    const moved = await pmApi.agile.tasks.update(task.id, taskPayload(task, { responsibleUserId: back }))
    if (!moved.isSuccess) return { ok: false, error: `ارجاع پایان یافت ولی مسئول وظیفه برنگشت: ${explainTaskError(moved)}` }
  }
  return { ok: true, error: '' }
}

/** Active hand-overs of tasks the user gave or received, by task id. */
export const delegationsByTask = (list) => (list || []).filter((item) => item.isActive && (item.itemType === 1 || item.itemType === 'AgileTask')).reduce((map, item) => { (map[item.itemId] ||= []).push(item); return map }, {})
