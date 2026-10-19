import { PersianMessages } from '../../services/api'

// Core error codes (ProblemDetails.title) of the project-management modules, in Persian.
const PM_ERRORS = {
  // Projects (Rozet.Api turns on charter validation and unique names)
  'project.name_exists': 'پروژه‌ای با این نام قبلاً ثبت شده است.',
  'project.charter.name_required': 'نام پروژه را وارد کنید.',
  'project.charter.manager_required': 'مدیر پروژه را انتخاب کنید.',
  'project.charter.unit_required': 'واحد سازمانی پروژه را انتخاب کنید.',
  'project.charter.start_date_required': 'تاریخ شروع را وارد کنید.',
  'project.charter.end_date_required': 'تاریخ پایان را وارد کنید.',
  'project.charter.goal_required': '«هدف پروژه» را وارد کنید.',
  'project.charter.requirements_required': '«نیازمندی‌ها» را وارد کنید.',
  'project.charter.goal_meaningless': 'متن «هدف پروژه» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.',
  'project.charter.requirements_meaningless': 'متن «نیازمندی‌ها» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.',
  'project.charter.constraints_meaningless': 'متن «محدودیت‌ها» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.',
  'project.charter.assumptions_meaningless': 'متن «مفروضات» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.',
  'project.charter.description_meaningless': 'متن «توضیحات» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.',
  // Generic codes every module uses
  'validation.error': 'اطلاعات واردشده معتبر نیست. لطفاً فیلدها را بررسی کنید.',
  not_found: 'رکورد موردنظر پیدا نشد؛ ممکن است قبلاً حذف شده باشد.',
  conflict: 'این عملیات با وضعیت فعلی رکورد یا داده‌های وابسته به آن تداخل دارد.',
  forbidden: 'شما دسترسی لازم برای این عملیات را ندارید.',
  too_many_requests: 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید و دوباره تلاش کنید.',
}

/**
 * The Persian message for a failed API result. When the Core's own text says more than the code
 * (a 409 that lists what still depends on a project, a validation detail) it is kept after the message.
 */
export function explainPmError(result) {
  if (!result) return PersianMessages.error('')
  if (result.status === 403) return PM_ERRORS.forbidden
  const known = PM_ERRORS[result.code]
  if (!known) return PersianMessages.error(result.error)
  const detail = typeof result.error === 'string' ? result.error.trim() : ''
  const isLatin = /[A-Za-z]{4,}/.test(detail)
  return result.code === 'conflict' && detail && isLatin ? `${known} (${detail})` : known
}

/** Adapts an API result for ConfirmDialog: { ok, error }. */
export const toOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainPmError(result) })
