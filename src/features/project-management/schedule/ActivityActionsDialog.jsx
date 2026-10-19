import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { unwrap } from '../../../services/api'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { Field, Footer, Shell } from '../DialogParts'
import { approvalOf } from '../documents/documentUtils'
import { listOf, pmApi } from '../pmApi'
import { ACTION_PRIORITIES, ACTION_STATUSES, ACTIVITY_SOURCE, actionStatusOf, explainActionError, isOverdue, priorityOf } from './actionsModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

/** The Core wants an organization unit and a work calendar on every action: the project's own, else the tenant's default calendar. */
async function resolveReferences(project, canListCalendars) {
  const loaded = await pmApi.projects.get(project.id)
  const full = loaded.isSuccess ? unwrap(loaded) : null
  const organizationUnitId = full?.organizationUnitId || project.organizationUnitId
  let workCalendarId = full?.workCalendarId || project.workCalendarId
  if (!workCalendarId && canListCalendars) {
    const calendars = await pmApi.calendars.list()
    workCalendarId = listOf(calendars).find((calendar) => calendar.isDefault)?.id
  }
  return { organizationUnitId, workCalendarId }
}

/** The actions raised from one activity (SourceType = WaterfallActivity): list, change status, send for approval, and raise a new one. */
export default function ActivityActionsDialog({ project, activity, actions, data, perms, onClose, onChanged }) {
  const { can } = useAuth()
  const today = todayIso()
  const [form, setForm] = useState(() => ({
    title: '', description: '', responsibleUserId: activity.responsibleUserId || '', priority: 1,
    startDate: activity.startDate || activity.start || '', endDate: activity.endDate || activity.finish || '',
  }))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [rowBusy, setRowBusy] = useState('')
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(''); setNotice('') }
  const sorted = useMemo(() => [...actions].sort((a, b) => String(a.endDate || '9999').localeCompare(String(b.endDate || '9999'))), [actions])

  async function create(event) {
    event.preventDefault()
    if (!form.title.trim()) { setError('عنوان اقدام را وارد کنید.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.'); return }
    setBusy(true)
    const refs = await resolveReferences(project, can('work_calendars.view'))
    if (!refs.organizationUnitId) { setBusy(false); setError('برای پروژه واحد سازمانی ثبت نشده؛ اقدام بدون واحد ساخته نمی‌شود. آن را در ویرایش پروژه تعیین کنید.'); return }
    if (!refs.workCalendarId) { setBusy(false); setError('برای پروژه تقویم کاری و برای سازمان تقویم پیش‌فرضی پیدا نشد؛ اقدام بدون تقویم کاری ساخته نمی‌شود.'); return }
    const result = await pmApi.actions.create({
      tenantId: data.tenantId, projectId: project.id, title: form.title.trim(), description: orNull(form.description),
      ownerUserId: null, responsibleUserId: orNull(form.responsibleUserId), organizationUnitId: refs.organizationUnitId, workCalendarId: refs.workCalendarId,
      startDate: orNull(form.startDate), endDate: orNull(form.endDate), priority: Number(form.priority), sourceType: ACTIVITY_SOURCE, sourceId: activity.id,
    })
    setBusy(false)
    if (!result.isSuccess) { setError(explainActionError(result)); return }
    setForm((current) => ({ ...current, title: '', description: '' }))
    setNotice('اقدام ثبت و به این فعالیت وصل شد.')
    onChanged()
  }

  async function changeStatus(action, status) {
    setRowBusy(action.id); setError(''); setNotice('')
    const result = await pmApi.actions.setStatus(action.id, Number(status))
    setRowBusy('')
    if (!result.isSuccess) { setError(explainActionError(result)); return }
    setNotice(`وضعیت «${action.title}» به «${actionStatusOf(Number(status)).label}» تغییر کرد.`)
    onChanged()
  }

  async function submit(action) {
    setRowBusy(action.id); setError(''); setNotice('')
    const result = await pmApi.actions.submitForApproval(action.id)
    setRowBusy('')
    if (!result.isSuccess) { setError(explainActionError(result)); return }
    setNotice(approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'اقدام تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'اقدام برای تأیید ارسال شد.')
    onChanged()
  }

  return (
    <Shell title="اقدام‌های فعالیت" subtitle={`${activity.wbs ? `${activity.wbs} — ` : ''}${activity.name}`} wide="xl" onClose={onClose} busy={busy}>
      <div className="ue-body">
        {!sorted.length ? <p className="data-state">برای این فعالیت هنوز اقدامی ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 860 }}>
            <thead><tr><th>اقدام</th><th>مسئول</th><th>بازه</th><th>اولویت</th><th>وضعیت</th><th>تأیید</th></tr></thead>
            <tbody>{sorted.map((action) => {
              const status = actionStatusOf(action.status)
              const approval = approvalOf(action.approvalStatus)
              const late = isOverdue(action, today)
              return (
                <tr key={action.id}>
                  <td><strong>{action.title}</strong>{late && <em className="bl-tag pf-late">معوق</em>}{action.description && <small className="bl-note" title={action.description}>{action.description}</small>}</td>
                  <td>{action.responsibleUserId ? data.userName(action.responsibleUserId) : '—'}</td>
                  <td className="sch-date">{action.startDate ? formatJalali(action.startDate) : '—'} تا {action.endDate ? formatJalali(action.endDate) : '—'}</td>
                  <td>{priorityOf(action.priority).label}</td>
                  <td>{perms.editActions
                    ? <select aria-label={`وضعیت ${action.title}`} className="act-status" value={status.value} disabled={rowBusy === action.id} onChange={(e) => changeStatus(action, e.target.value)}>{ACTION_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                    : <span className={`status-pill ${status.tone}`}>{status.label}</span>}</td>
                  <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span>
                    {perms.submitActions && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" className="act-send" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" disabled={rowBusy === action.id} onClick={() => submit(action)}><Send size={14} /></button>}
                  </td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
        {notice && <p className="docs-notice success" role="status"><span>{notice}</span></p>}

        {perms.createActions ? (
          <form onSubmit={create} noValidate className="act-form">
            <h4 className="bl-subtitle">اقدام جدید برای این فعالیت</h4>
            <div className="ue-grid">
              <Field label="عنوان اقدام *" wide><input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً: پیگیری تأیید نقشه از مشاور" /></Field>
              <Field label="مسئول"><select value={form.responsibleUserId} onChange={(e) => set('responsibleUserId', e.target.value)}><option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></Field>
              <Field label="اولویت"><select value={form.priority} onChange={(e) => set('priority', Number(e.target.value))}>{ACTION_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
              <Field label="تاریخ شروع"><JalaliDateInput value={form.startDate} onChange={(value) => set('startDate', value)} /></Field>
              <Field label="تاریخ پایان"><JalaliDateInput value={form.endDate} onChange={(value) => set('endDate', value)} /></Field>
              <Field label="توضیح" wide><textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
            </div>
            <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت اقدام" busyLabel="در حال ثبت..." />
          </form>
        ) : (
          <>{error && <span className="ue-error" role="alert">{error}</span>}<p className="docs-hint">ثبت اقدام به دسترسی «ایجاد اقدام» نیاز دارد.</p></>
        )}
      </div>
    </Shell>
  )
}
