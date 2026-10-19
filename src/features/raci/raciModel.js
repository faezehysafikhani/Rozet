import { explainPmError } from '../project-management/pmErrors'

export const ITEM_TYPES = [
  { value: 0, key: 'WaterfallActivity', label: 'فعالیت‌ها', one: 'فعالیت' },
  { value: 1, key: 'Deliverable', label: 'خروجی‌ها', one: 'خروجی' },
  { value: 2, key: 'AgileTask', label: 'وظایف', one: 'وظیفه' },
]
export const itemTypeValue = (raw) => ITEM_TYPES.find((item) => item.value === raw || item.key === raw)?.value ?? 0

/** The four roles, in the order of the letters R A C I. `cls` is the colour class the legend already has. */
export const ROLES = [
  { value: 0, key: 'Responsible', letter: 'R', cls: 'r', label: 'مسئول اجرا', hint: 'کار را انجام می‌دهد' },
  { value: 1, key: 'Accountable', letter: 'A', cls: 'a', label: 'پاسخگو', hint: 'پاسخگوی نتیجه است؛ فقط یک نفر' },
  { value: 2, key: 'Consulted', letter: 'C', cls: 'c', label: 'مشاور', hint: 'پیش از تصمیم نظرش پرسیده می‌شود' },
  { value: 3, key: 'Informed', letter: 'I', cls: 'i', label: 'مطلع', hint: 'از نتیجه باخبر می‌شود' },
]
export const roleValue = (raw) => ROLES.find((item) => item.value === raw || item.key === raw)?.value ?? 0

export const raciPerms = (can) => ({ view: can('Raci.View'), edit: can('Raci.Edit') })

/** The roles of one item as { userId -> Set(role values) }. */
export function rolesOfItem(rows, itemType, itemId) {
  const byUser = {}
  for (const row of rows) {
    if (itemTypeValue(row.itemType) !== itemType || row.itemId !== itemId) continue
    ;(byUser[row.userId] ||= new Set()).add(roleValue(row.role))
  }
  return byUser
}

/** What is missing on an item: no accountable person, or nobody responsible. */
export function gapsOf(byUser) {
  const all = Object.values(byUser)
  const has = (role) => all.some((set) => set.has(role))
  return { noAccountable: !has(1), noResponsible: !has(0), empty: all.length === 0 }
}

const MESSAGES = [
  [/only one accountable person/i, 'هر مورد فقط یک نفر «پاسخگو» (A) دارد.'],
  [/Every role needs a person/i, 'برای هر نقش یک نفر را انتخاب کنید.'],
  [/at most 100 roles/i, 'هر مورد حداکثر ۱۰۰ نقش دارد.'],
  [/project and the item are required/i, 'پروژه یا مورد مشخص نیست.'],
]

export function explainRaciError(result) {
  // The module is optional: a server that does not host it has no such route.
  if (result?.status === 404 && !result?.code) return 'ماتریس مسئولیت‌ها (RACI) روی سرور فعلی نصب نیست.'
  const text = typeof result?.error === 'string' ? result.error : ''
  const known = MESSAGES.find(([pattern]) => pattern.test(text))
  return known ? known[1] : explainPmError(result)
}
