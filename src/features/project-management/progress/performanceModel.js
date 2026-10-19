import { explainPmError } from '../pmErrors'

export const HEALTH = [
  { value: 0, key: 'Unknown', label: 'نامشخص', tone: 'todo', hint: 'داده‌ی کافی برای قضاوت نیست.' },
  { value: 1, key: 'Green', label: 'سالم', tone: 'done', hint: 'شاخص‌های زمان و هزینه از ۰٫۹۵ کمتر نیستند.' },
  { value: 2, key: 'Amber', label: 'در معرض خطر', tone: 'review', hint: 'یکی از شاخص‌های زمان یا هزینه بین ۰٫۸۵ و ۰٫۹۵ است.' },
  { value: 3, key: 'Red', label: 'بحرانی', tone: 'rejected', hint: 'یکی از شاخص‌های زمان یا هزینه کمتر از ۰٫۸۵ است.' },
]
export const healthOf = (raw) => HEALTH.find((item) => item.value === raw || item.key === raw) || HEALTH[0]
/** Worst first, for sorting. */
export const healthSeverity = (raw) => ({ 3: 0, 2: 1, 0: 2, 1: 3 })[healthOf(raw).value]

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })
export const money = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('fa-IR', { maximumFractionDigits: 0 }))
export const index2 = (value) => (value === null || value === undefined ? '—' : Number(value).toLocaleString('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

/** Share of the budget already spent, or null when either figure is missing. */
export const financialProgress = (perf) => (perf?.budgetAtCompletion > 0 && perf.actualCost !== null && perf.actualCost !== undefined ? (perf.actualCost / perf.budgetAtCompletion) * 100 : null)

export function explainReportingError(result) {
  if (result?.status === 403) return 'برای مشاهده‌ی شاخص‌های سلامت و عملکرد به دسترسی «مشاهده‌ی همه‌ی گزارش‌ها» (Reporting.ViewAll) نیاز دارید.'
  const detail = typeof result?.error === 'string' ? result.error : ''
  if (/Project not found/i.test(detail)) return 'پروژه پیدا نشد.'
  return explainPmError(result)
}
