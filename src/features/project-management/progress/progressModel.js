import { explainPmError } from '../pmErrors'

export const CLASSIFICATIONS = [
  { key: 'OnTrack', value: 0, label: 'مطابق برنامه', tone: 'done' },
  { key: 'AtRisk', value: 1, label: 'در معرض تأخیر', tone: 'review' },
  { key: 'Behind', value: 2, label: 'عقب از برنامه', tone: 'rejected' },
]
export const classificationOf = (raw) => CLASSIFICATIONS.find((item) => item.value === raw || item.key === raw) || CLASSIFICATIONS[0]
/** The Core's rule (deviation = actual − planned): −5 and above is on track, −15 and above at risk, below that behind. */
export const classify = (deviation) => (deviation >= -5 ? CLASSIFICATIONS[0] : deviation >= -15 ? CLASSIFICATIONS[1] : CLASSIFICATIONS[2])

export const ROOT_CAUSES = [
  { value: 0, key: 'Funding', label: 'تأمین مالی' },
  { value: 1, key: 'Procurement', label: 'تدارکات' },
  { value: 2, key: 'Permits', label: 'مجوزها' },
  { value: 3, key: 'HumanResources', label: 'منابع انسانی' },
  { value: 4, key: 'Other', label: 'سایر' },
]
export const rootCauseOf = (raw) => ROOT_CAUSES.find((item) => item.value === raw || item.key === raw) || ROOT_CAUSES[4]

export const fmt = (value, digits = 1) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: digits })
/** Signed percent points as words, because a "+"/"−" before Persian digits lands on the wrong side in right-to-left text. */
export const deviationText = (value) => (Math.abs(value) < 0.005 ? 'بدون انحراف' : `${fmt(Math.abs(value))} واحد درصد ${value < 0 ? 'عقب‌تر' : 'جلوتر'}`)

const MESSAGES = [
  [/Progress update not found/i, 'این گزارش پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/progress update that is pending approval cannot be deleted/i, 'گزارشی که در انتظار تأیید است حذف نمی‌شود.'],
  [/Delay reason not found/i, 'این دلیل تأخیر پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/delay reason that is pending approval cannot be deleted/i, 'دلیل تأخیری که در انتظار تأیید است حذف نمی‌شود.'],
  [/Description is required/i, 'شرح را وارد کنید.'],
  [/Progress must be between 0 and 100/i, 'درصد پیشرفت باید بین ۰ و ۱۰۰ باشد.'],
  [/Activity not found/i, 'فعالیت پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/without sub-activities; a group's progress/i, 'پیشرفت فقط برای فعالیت‌های بدون زیرفعالیت گزارش می‌شود؛ پیشرفت یک گروه از زیرفعالیت‌هایش به دست می‌آید.'],
  [/earlier progress report for this activity is still waiting/i, 'گزارش قبلی این فعالیت هنوز در انتظار تأیید است؛ پس از تعیین تکلیف آن گزارش جدید ثبت کنید.'],
  [/Progress report not found/i, 'این گزارش پیشرفت پیدا نشد؛ ممکن است قبلاً حذف شده باشد.'],
  [/Only a report that is waiting for approval/i, 'پیشرفت تأییدی فقط برای گزارشی که در انتظار تأیید است ثبت می‌شود.'],
  [/Confirming a progress figure when rejecting a report is switched off/i, 'تنظیمات سامانه اجازه‌ی ثبت پیشرفت تأییدی هنگام رد گزارش را نداده است.'],
]
/** The Persian message for a failed call of the progress screens (the Core words its rule violations in English). */
export function explainProgressError(result) {
  const detail = typeof result?.error === 'string' ? result.error : ''
  const hit = MESSAGES.find(([pattern]) => pattern.test(detail))
  return hit ? hit[1] : explainPmError(result)
}
export const toProgressOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainProgressError(result) })
