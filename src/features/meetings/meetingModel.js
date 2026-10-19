import { explainPmError } from '../project-management/pmErrors'

export const STATUSES = [
  { value: 0, key: 'Scheduled', label: 'برنامه‌ریزی‌شده', tone: 'pending' },
  { value: 1, key: 'Held', label: 'برگزارشده', tone: 'success' },
  { value: 2, key: 'Cancelled', label: 'لغوشده', tone: 'muted' },
]
export const statusOf = (raw) => STATUSES.find((item) => item.value === raw || item.key === raw) || STATUSES[0]

export const ATTENDANCE = [
  { value: 0, key: 'Pending', label: 'ثبت نشده' },
  { value: 1, key: 'Attended', label: 'حاضر' },
  { value: 2, key: 'Absent', label: 'غایب' },
  { value: 3, key: 'Excused', label: 'غیبت موجه' },
]
export const attendanceOf = (raw) => ATTENDANCE.find((item) => item.value === raw || item.key === raw) || ATTENDANCE[0]

export const meetingPerms = (can) => ({ view: can('Meetings.View'), create: can('Meetings.Create'), edit: can('Meetings.Edit'), delete: can('Meetings.Delete') })

const fa = (value) => Number(value).toLocaleString('fa-IR')

/** "10:30:00" -> "10:30" (what a time input holds). */
export const timeInputOf = (value) => (value ? String(value).slice(0, 5) : '')
/** "10:30" -> "10:30:00" (what the Core reads). */
export const timeToCore = (value) => (value ? `${value}:00` : null)
export const timeText = (meeting) => {
  if (!meeting.startTime) return ''
  const [hours, minutes] = String(meeting.startTime).split(':')
  return `${fa(hours).padStart(2, '۰')}:${fa(minutes).padStart(2, '۰')}`
}
export const durationText = (meeting) => (meeting.durationMinutes ? `${fa(meeting.durationMinutes)} دقیقه` : '')

/** How many of the invited came, once the meeting was held. */
export function attendanceSummary(meeting) {
  const total = meeting.participants?.length || 0
  if (!total) return 'بدون شرکت‌کننده'
  if (statusOf(meeting.status).key !== 'Held') return `${fa(total)} نفر دعوت‌شده`
  const came = meeting.participants.filter((item) => attendanceOf(item.attendance).key === 'Attended').length
  return `${fa(came)} از ${fa(total)} نفر حاضر`
}

const MESSAGES = [
  [/cancelled meeting cannot be edited/i, 'جلسه‌ی لغوشده قابل ویرایش نیست؛ ابتدا آن را بازگشایی کنید.'],
  [/held meeting cannot be cancelled/i, 'جلسه‌ی برگزارشده را نمی‌شود لغو کرد.'],
  [/Minutes were already recorded/i, 'برای این جلسه صورت‌جلسه ثبت شده است؛ پس به «برنامه‌ریزی‌شده» برنمی‌گردد.'],
  [/cancelled meeting must be reopened/i, 'جلسه‌ی لغوشده را ابتدا بازگشایی کنید.'],
  [/Minutes can only be recorded for a held meeting/i, 'صورت‌جلسه را فقط برای جلسه‌ی برگزارشده می‌شود ثبت کرد؛ ابتدا «برگزار شد» را بزنید.'],
  [/Attendance can only be recorded for a held meeting/i, 'حضور و غیاب فقط برای جلسه‌ی برگزارشده ثبت می‌شود.'],
  [/held meeting is part of the project record/i, 'جلسه‌ی برگزارشده بخشی از سابقه‌ی پروژه است و حذف نمی‌شود.'],
  [/Participant not found/i, 'این فرد در فهرست شرکت‌کنندگان نیست.'],
  [/Meeting not found/i, 'جلسه پیدا نشد؛ ممکن است حذف شده باشد.'],
  [/Title is required/i, 'عنوان جلسه را وارد کنید.'],
  [/title is at most/i, 'عنوان جلسه حداکثر ۲۰۰ نویسه است.'],
  [/agenda is at most/i, 'دستور جلسه حداکثر ۴۰۰۰ نویسه است.'],
  [/duration must be between/i, 'مدت جلسه باید بین ۱ تا ۱۴۴۰ دقیقه باشد.'],
  [/duration needs a start time/i, 'برای مدت جلسه ساعت شروع را هم وارد کنید.'],
  [/location is at most/i, 'مکان جلسه حداکثر ۳۰۰ نویسه است.'],
  [/online link is at most/i, 'پیوند آنلاین حداکثر ۵۰۰ نویسه است.'],
  [/minutes are at most/i, 'صورت‌جلسه حداکثر ۲۰٬۰۰۰ نویسه است.'],
  [/at most 200 participants/i, 'یک جلسه حداکثر ۲۰۰ شرکت‌کننده دارد.'],
  [/Every participant needs a user/i, 'هر شرکت‌کننده باید یک کاربر باشد.'],
  [/Project is required/i, 'پروژه‌ی جلسه مشخص نیست.'],
]

export function explainMeetingError(result) {
  const text = typeof result?.error === 'string' ? result.error : ''
  const known = MESSAGES.find(([pattern]) => pattern.test(text))
  return known ? known[1] : explainPmError(result)
}

export const toMeetingOutcome = (result) => ({ ok: Boolean(result?.isSuccess), error: result?.isSuccess ? '' : explainMeetingError(result) })
