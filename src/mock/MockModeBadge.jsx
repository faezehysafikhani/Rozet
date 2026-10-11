import { useState } from 'react'
import { DEMO_PASSWORD, USE_MOCK } from '../services/config'
import { AuthTokenStore } from '../services/authStore'
import { getDb, resetDb } from './db'
import { pushDemoNotification } from './mockServer'

/** Demo accounts shown on the login screen (all share DEMO_PASSWORD). */
export const DEMO_ACCOUNTS = [
  { label: 'مدیر سیستم', email: 'admin@nexus.local' },
  { label: 'مدیر پروژه', email: 'ali.rezaei@rozet.ir' },
  { label: 'مدیر مالی', email: 'reza.hosseini@rozet.ir' },
  { label: 'مهندس اجرا', email: 'sina.mohammadi@rozet.ir' },
]

export { DEMO_PASSWORD }

/** Small floating pill: tells the audience this is demo data and lets the presenter reset it. */
export default function MockModeBadge() {
  const [open, setOpen] = useState(false)
  if (!USE_MOCK) return null

  function reset() {
    if (!window.confirm('همه تغییرات نمایشی پاک و داده‌ها به حالت اولیه برگردانده شود؟')) return
    resetDb()
    AuthTokenStore.clear()
    window.location.reload()
  }

  return (
    <div className="mock-badge" dir="rtl">
      {open && (
        <div className="mock-badge__panel">
          <strong>حالت نمایشی (Local Storage)</strong>
          <p>داده‌ها فقط در همین مرورگر ذخیره می‌شوند و به بک‌اند متصل نیست. تعداد کاربران: {getDb().users.length.toLocaleString('fa-IR')}</p>
          <button type="button" onClick={() => pushDemoNotification('اعلان زنده', 'این اعلان همین حالا از سرور نمایشی رسید.')}>ارسال اعلان آزمایشی</button>
          <button type="button" className="danger" onClick={reset}>بازنشانی داده‌ها</button>
        </div>
      )}
      <button type="button" className="mock-badge__pill" onClick={() => setOpen((v) => !v)}>
        <i />حالت نمایشی
      </button>
    </div>
  )
}
