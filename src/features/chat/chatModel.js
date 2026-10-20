import { PersianMessages } from '../../services/api'

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const MAX_TEXT_LENGTH = 4000

const digits = (value) => Number(value || 0).toLocaleString('fa-IR')

export function formatSize(bytes) {
  const size = Number(bytes) || 0
  if (size < 1024) return `${digits(size)} بایت`
  if (size < 1024 * 1024) return `${digits(Math.round(size / 1024))} کیلوبایت`
  return `${(size / (1024 * 1024)).toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت`
}

export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  return parts.slice(0, 2).map((part) => Array.from(part)[0]).join('‌')
}

/** The Core sends UTC instants; an offset-less string is still UTC. */
export function parseInstant(value) {
  if (!value) return null
  const text = typeof value === 'string' && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? `${value}Z` : value
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatClock(value) {
  const date = parseInstant(value)
  return date ? date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : ''
}

export function dayLabel(value) {
  const date = parseInstant(value)
  if (!date) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'امروز'
  if (date.toDateString() === yesterday.toDateString()) return 'دیروز'
  return date.toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** A Core message (direct or team DTO, or the bare hub event) in the one shape the screen uses. */
export function normalizeMessage(raw, meId) {
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    senderUserId: raw.senderUserId,
    senderName: raw.senderDisplayName || '',
    text: raw.text || '',
    sentAt: raw.sentAtUtc || raw.sentAt,
    editedAt: raw.editedAtUtc || null,
    // IsRead exists on direct messages only: it tells whether the other person has read it.
    isRead: raw.isRead ?? null,
    attachment: raw.attachment || null,
    isOwn: raw.senderUserId === meId,
  }
}

export const threadKey = (kind, id) => `${kind}:${id}`

/** Persian wording for what the chat endpoints refuse with. */
export function explainChatError(result) {
  const raw = result?.error
  const text = String(typeof raw === 'object' ? raw?.message || raw?.code || '' : raw || '').toLowerCase()
  if (text.includes('needs text or an attachment')) return 'متن پیام یا یک پیوست لازم است.'
  if (text.includes('at most') && text.includes('characters')) return `پیام می‌تواند حداکثر ${digits(MAX_TEXT_LENGTH)} نویسه باشد.`
  if (text.includes('attached file is empty')) return 'فایل پیوست خالی است.'
  if (text.includes('attachment') && text.includes('mb')) return `حجم پیوست بیش از ${formatSize(MAX_ATTACHMENT_BYTES)} است.`
  if (text.includes('cannot start a conversation with yourself')) return 'با خودتان نمی‌توانید گفت‌وگو کنید.'
  if (text.includes('user was not found')) return 'این کاربر پیدا نشد یا غیرفعال است.'
  if (text.includes('team was not found')) return 'این تیم پیدا نشد یا دیگر عضو آن نیستید.'
  if (text.includes('attachment was not found')) return 'پیوست پیدا نشد.'
  if (text.includes('content is missing from storage')) return 'فایل پیوست در انبار فایل موجود نیست.'
  if (text.includes('message not found')) return 'پیام پیدا نشد یا مال شما نیست.'
  if (result?.status === 403) return 'برای این بخش دسترسی ندارید.'
  if (result?.status === 413) return `حجم پیوست بیش از ${formatSize(MAX_ATTACHMENT_BYTES)} است.`
  if (result?.status === 429) return 'پیام‌ها پشت‌سرهم ارسال شده‌اند؛ کمی بعد دوباره تلاش کنید.'
  return PersianMessages.error(raw)
}
