import { explainPmError } from '../pmErrors'

export const DELIVERABLE_STATUSES = [
  { value: 0, key: 'Planned', label: 'برنامه‌ریزی‌شده', tone: 'todo' },
  { value: 1, key: 'InProgress', label: 'در حال انجام', tone: 'doing' },
  { value: 2, key: 'Delivered', label: 'تحویل‌شده', tone: 'review' },
  { value: 3, key: 'Accepted', label: 'پذیرفته‌شده', tone: 'done' },
  { value: 4, key: 'Rejected', label: 'ردشده', tone: 'rejected' },
]
export const deliverableStatusOf = (raw) => DELIVERABLE_STATUSES.find((item) => item.value === raw || item.key === raw) || DELIVERABLE_STATUSES[0]

export const KPI_TYPES = [
  { value: 0, key: 'Lag', label: 'تأخیری (نتیجه)', hint: 'نتیجه‌ای که بعد از انجام کار اندازه‌گیری می‌شود.' },
  { value: 1, key: 'Lead', label: 'پیشرو', hint: 'شاخصی که پیش از نتیجه، مسیر رسیدن به آن را نشان می‌دهد.' },
]
export const kpiTypeOf = (raw) => KPI_TYPES.find((item) => item.value === raw || item.key === raw) || KPI_TYPES[0]

export const ALIGNMENT_LEVELS = [
  { value: 0, key: 'None', label: 'ندارد', score: 0 },
  { value: 1, key: 'Low', label: 'کم', score: 1 },
  { value: 2, key: 'Medium', label: 'متوسط', score: 2 },
  { value: 3, key: 'High', label: 'زیاد', score: 3 },
]
export const alignmentLevelOf = (raw) => ALIGNMENT_LEVELS.find((item) => item.value === raw || item.key === raw) || ALIGNMENT_LEVELS[0]

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })

const MESSAGES = [
  [/Deliverable not found/i, 'این خروجی پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/Deliverable was not found/i, 'خروجیِ انتخاب‌شده پیدا نشد.'],
  [/KPI not found/i, 'این شاخص پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/Title is required/i, 'عنوان را وارد کنید.'],
  [/Description is required/i, 'شرح را وارد کنید.'],
  [/Strategy not found/i, 'این راهبرد پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/Every strategy needs a name/i, 'هر راهبرد باید نام داشته باشد.'],
  [/appears twice in the tree/i, 'یک راهبرد دو بار در درخت آمده است.'],
  [/weight must be between 0 and 100/i, 'وزن هر راهبرد باید بین ۰ و ۱۰۰ باشد.'],
  [/parent must be another strategy/i, 'والد هر راهبرد باید راهبرد دیگری از همین درخت باشد.'],
  [/cannot sit under itself/i, 'راهبرد را نمی‌توان زیر خودش یا زیرراهبردهایش گذاشت.'],
  [/Parent strategy was not found/i, 'راهبرد والد پیدا نشد.'],
  [/Delete or reassign the sub-strategies first/i, 'ابتدا زیرراهبردها را حذف یا جابه‌جا کنید.'],
  [/already linked/i, 'این پروژه و راهبرد قبلاً به هم وصل شده‌اند.'],
  [/Project was not found/i, 'پروژه پیدا نشد.'],
  [/no sub-strategies/i, 'همسوسازی فقط روی راهبردهای بدون زیرراهبرد ثبت می‌شود؛ درخت راهبرد را دوباره بخوانید.'],
  [/Unknown alignment level/i, 'سطح همسوسازی نامعتبر است.'],
]

/** The Persian message for a failed call of the strategy screens. */
export function explainStrategyError(result) {
  if (result?.code === 'strategy.weights_not_100') return 'مجموع وزن راهبردهای سطح اول باید ۱۰۰ باشد؛ وزن‌ها را اصلاح کنید.'
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}
export const toStrategyOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainStrategyError(result) })

// ---- the strategy tree as an editable draft
let temp = 0
export const newKey = () => `new-${Date.now().toString(36)}-${temp++}`

/** Draft items from the Core's tree nodes: { key, name, description, weight, parentKey } in tree order. */
export const draftFromTree = (tree) => (tree?.nodes || []).map((node) => ({
  key: node.id, name: node.name, description: node.description || '', weight: node.storedWeight ?? 0, parentKey: node.parentStrategyId || null,
}))

export const childrenOf = (items, key) => items.filter((item) => item.parentKey === key)
export const hasChildren = (items, key) => items.some((item) => item.parentKey === key)

/** What an item weighs: its own weight for a leaf, the sum of what its children weigh otherwise (the Core's rule). */
export function weightOf(items, item) {
  const kids = childrenOf(items, item.key)
  return kids.length ? kids.reduce((sum, kid) => sum + weightOf(items, kid), 0) : Number(item.weight) || 0
}
export const totalWeight = (items) => childrenOf(items, null).reduce((sum, root) => sum + weightOf(items, root), 0)

/** The items in display order (a parent before its children) with their depth. */
export function flatten(items) {
  const out = []
  const walk = (parentKey, level) => childrenOf(items, parentKey).forEach((item) => { out.push({ item, level }); walk(item.key, level + 1) })
  walk(null, 0)
  return out
}

export function descendantKeys(items, key) {
  const found = new Set()
  const walk = (parent) => childrenOf(items, parent).forEach((item) => { found.add(item.key); walk(item.key) })
  walk(key)
  return found
}

/** Moves an item one place up (-1) or down (+1) among its siblings; the list order is the order shown. */
export function moveItem(items, key, direction) {
  const item = items.find((entry) => entry.key === key)
  const siblings = childrenOf(items, item.parentKey)
  const target = siblings[siblings.indexOf(item) + direction]
  if (!target) return items
  const next = [...items]
  const a = next.indexOf(item); const b = next.indexOf(target)
  next[a] = target; next[b] = item
  return next
}

/** Items to send: the draft in tree order so the saved order matches what is shown. */
export const itemsToSave = (items) => flatten(items).map(({ item }) => ({ key: item.key, name: item.name.trim(), description: item.description.trim() || null, weight: Number(item.weight) || 0, parentKey: item.parentKey }))

export const sameDraft = (a, b) => JSON.stringify(itemsToSave(a)) === JSON.stringify(itemsToSave(b))
