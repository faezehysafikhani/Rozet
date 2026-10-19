import { useEffect, useState } from 'react'
import { unwrap } from '../../../services/api'
import { pmApi } from '../pmApi'

// The Core serialises enums as numbers; names are accepted too so either form works.
export const DOCUMENT_TYPES = [
  { value: 0, key: 'Report', label: 'گزارش' },
  { value: 1, key: 'Letter', label: 'نامه' },
  { value: 2, key: 'MeetingMinutes', label: 'صورت‌جلسه' },
  { value: 3, key: 'Other', label: 'سایر' },
]
export const APPROVAL_STATUSES = [
  { value: 0, key: 'NotSubmitted', label: 'ثبت اولیه', tone: 'todo' },
  { value: 1, key: 'PendingApproval', label: 'در انتظار تأیید', tone: 'review' },
  { value: 2, key: 'Approved', label: 'تأیید شده', tone: 'done' },
  { value: 3, key: 'Rejected', label: 'رد شده', tone: 'rejected' },
]

const find = (list, raw) => list.find((item) => item.value === raw || item.key === raw || String(item.value) === String(raw))
export const documentTypeOf = (raw) => find(DOCUMENT_TYPES, raw) || DOCUMENT_TYPES[3]
export const approvalOf = (raw) => find(APPROVAL_STATUSES, raw) || APPROVAL_STATUSES[0]

export function formatBytes(value) {
  const size = Number(value || 0)
  if (!size) return '—'
  const fa = (n) => n.toLocaleString('fa-IR')
  if (size < 1024) return `${fa(size)} بایت`
  if (size < 1024 * 1024) return `${fa(Math.round(size / 1024))} کیلوبایت`
  return `${fa(Math.round((size / 1024 / 1024) * 10) / 10)} مگابایت`
}

/**
 * The system-wide upload rules (Uploads.MaxFileSizeKb and the accepted extensions). The Core's
 * project-document upload does not check them itself, so the screen does. If the policy cannot be read
 * it is null and the Core decides.
 */
export function useUploadPolicy() {
  const [policy, setPolicy] = useState(null)
  useEffect(() => {
    let cancelled = false
    pmApi.platform.uploadPolicy().then((result) => {
      const value = result.isSuccess ? unwrap(result) : null
      if (!cancelled && value?.allowedExtensions) setPolicy({ maxFileSizeKb: value.maxFileSizeKb, allowedExtensions: value.allowedExtensions })
    })
    return () => { cancelled = true }
  }, [])
  return policy
}

/** '' when the file may be uploaded, otherwise the reason in Persian. */
export function checkUpload(file, policy) {
  if (!file) return 'فایل را انتخاب کنید.'
  if (file.size === 0) return 'فایل انتخاب‌شده خالی است.'
  if (!policy) return ''
  const extension = `.${String(file.name).split('.').pop().toLowerCase()}`
  if (!policy.allowedExtensions.map((item) => item.toLowerCase()).includes(extension)) {
    return `نوع این فایل مجاز نیست. فقط ${policy.allowedExtensions.join('، ')} پذیرفته می‌شود.`
  }
  if (file.size > policy.maxFileSizeKb * 1024) {
    return `حجم فایل (${formatBytes(file.size)}) بیشتر از حد مجاز (${formatBytes(policy.maxFileSizeKb * 1024)}) است.`
  }
  return ''
}
