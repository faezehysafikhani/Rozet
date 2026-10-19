import { useMemo, useState } from 'react'
import { Ban, CheckCheck, RotateCcw, Trash2, UserPlus } from 'lucide-react'
import JalaliDateInput from '../../components/JalaliDateInput'
import { formatJalali } from '../../utils/jalali'
import { Field, Shell } from '../project-management/DialogParts'
import { pmApi } from '../project-management/pmApi'
import { ATTENDANCE, STATUSES, attendanceOf, durationText, explainMeetingError, statusOf, timeInputOf, timeText, timeToCore } from './meetingModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())
const TABS = [
  { key: 'details', label: 'جزئیات' },
  { key: 'participants', label: 'شرکت‌کنندگان و حضور' },
  { key: 'minutes', label: 'صورت‌جلسه' },
]

/**
 * One meeting: its details, the invited people with their attendance, and the minutes.
 * `meeting` is null when creating; after the first save the dialog carries on with the created meeting.
 * Every save returns the Core's current meeting, which replaces the one shown.
 */
export default function MeetingDialog({ meeting: initial, project, data, perms, onClose, onChanged }) {
  const [meeting, setMeeting] = useState(initial)
  const [tab, setTab] = useState('details')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const creating = !meeting
  const status = meeting ? statusOf(meeting.status) : null
  const cancelled = status?.key === 'Cancelled'
  const held = status?.key === 'Held'
  const canEdit = perms.edit && !cancelled

  async function run(key, call, success, after) {
    setBusy(key); setError(''); setNotice('')
    const result = await call()
    setBusy('')
    if (!result.isSuccess) { setError(explainMeetingError(result)); return null }
    const next = result.value
    if (next && typeof next === 'object') setMeeting(next)
    if (success) setNotice(success)
    onChanged()
    after?.(next)
    return next
  }

  const changeStatus = (value, success, after) => run('status', () => pmApi.meetings.setStatus(meeting.id, value), success, after)

  return (
    <Shell title={creating ? 'جلسه‌ی جدید' : meeting.title} subtitle={creating ? project.name : [project.name, status.label].join(' · ')} onClose={onClose} busy={Boolean(busy)} wide="xl">
      {!creating && (
        <div className="mt-statusbar">
          <span className={`status-pill mt-${status.tone}`}>{status.label}</span>
          <span className="mt-statusbar-actions">
            {perms.edit && status.key === 'Scheduled' && <>
              <button type="button" className="bl-button sch-primary" disabled={Boolean(busy)} onClick={() => changeStatus(1, 'جلسه برگزار شد. حضور و صورت‌جلسه را ثبت کنید.', () => setTab('minutes'))}><CheckCheck size={15} />برگزار شد</button>
              <button type="button" className="bl-button" disabled={Boolean(busy)} onClick={() => changeStatus(2, 'جلسه لغو شد.')}><Ban size={15} />لغو جلسه</button>
            </>}
            {perms.edit && cancelled && <button type="button" className="bl-button" disabled={Boolean(busy)} onClick={() => changeStatus(0, 'جلسه بازگشایی شد.')}><RotateCcw size={15} />بازگشایی</button>}
            {perms.edit && held && <button type="button" className="bl-button" disabled={Boolean(busy) || Boolean(meeting.minutes)} title={meeting.minutes ? 'برای این جلسه صورت‌جلسه ثبت شده است' : undefined} onClick={() => changeStatus(0, 'جلسه به برنامه‌ریزی‌شده برگشت.')}><RotateCcw size={15} />برگشت به برنامه‌ریزی‌شده</button>}
          </span>
        </div>
      )}
      {!creating && (
        <div className="bl-tabs mt-tabs" role="tablist">
          {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setError(''); setNotice('') }}>{label}</button>)}
        </div>
      )}
      <div className="ue-body">
        {tab === 'details' && <DetailsForm key={meeting?.id || 'new'} meeting={meeting} project={project} data={data} canEdit={creating ? perms.create : canEdit} busy={busy} setBusy={setBusy} setError={setError} setNotice={setNotice}
          onSaved={(next, created) => { setMeeting(next); onChanged(); if (created) { setNotice('جلسه ساخته شد. حالا شرکت‌کنندگان را اضافه کنید.'); setTab('participants') } else setNotice('تغییرات ذخیره شد.') }} />}
        {tab === 'participants' && meeting && <ParticipantsTab meeting={meeting} data={data} canEdit={canEdit} held={held} busy={busy} run={run} />}
        {tab === 'minutes' && meeting && <MinutesTab key={meeting.minutes ?? ''} meeting={meeting} data={data} canEdit={canEdit} held={held} busy={busy} run={run} />}
      </div>
      <footer className="ue-foot">
        {error && <span className="ue-error" role="alert">{error}</span>}
        {!error && notice && <span className="mt-notice" role="status">{notice}</span>}
        <div className="ue-foot-actions"><button className="ue-cancel" type="button" onClick={onClose} disabled={Boolean(busy)}>بستن</button></div>
      </footer>
    </Shell>
  )
}

function DetailsForm({ meeting, project, data, canEdit, busy, setBusy, setError, setNotice, onSaved }) {
  const creating = !meeting
  const [form, setForm] = useState(() => ({
    title: meeting?.title || '', agenda: meeting?.agenda || '', meetingDate: meeting?.meetingDate || '', startTime: timeInputOf(meeting?.startTime),
    durationMinutes: meeting?.durationMinutes ?? '', location: meeting?.location || '', onlineLink: meeting?.onlineLink || '', organizerUserId: meeting?.organizerUserId || '',
  }))
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(''); setNotice('') }

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) { setError('عنوان جلسه را وارد کنید.'); return }
    if (!form.meetingDate) { setError('تاریخ جلسه را وارد کنید.'); return }
    const duration = String(form.durationMinutes).trim()
    if (duration !== '' && (!/^\d+$/.test(duration) || Number(duration) < 1 || Number(duration) > 1440)) { setError('مدت جلسه باید عددی بین ۱ تا ۱۴۴۰ دقیقه باشد.'); return }
    if (duration !== '' && !form.startTime) { setError('برای مدت جلسه ساعت شروع را هم وارد کنید.'); return }
    const body = {
      title: form.title.trim(), agenda: orNull(form.agenda), meetingDate: form.meetingDate, startTime: timeToCore(form.startTime),
      durationMinutes: duration === '' ? null : Number(duration), location: orNull(form.location), onlineLink: orNull(form.onlineLink), organizerUserId: orNull(form.organizerUserId),
    }
    setBusy('save'); setError('')
    const result = creating ? await pmApi.meetings.create({ ...body, tenantId: data.tenantId, projectId: project.id, participants: [] }) : await pmApi.meetings.update(meeting.id, body)
    setBusy('')
    if (!result.isSuccess) { setError(explainMeetingError(result)); return }
    onSaved(result.value, creating)
  }

  return (
    <form id="mt-details-form" onSubmit={submit} noValidate>
      <div className="ue-grid">
        <Field label="عنوان *" wide><input value={form.title} maxLength={200} disabled={!canEdit} onChange={(e) => set('title', e.target.value)} autoFocus={creating} /></Field>
        <Field label="تاریخ *"><JalaliDateInput value={form.meetingDate} onChange={(value) => set('meetingDate', value)} yearsAhead={3} disabled={!canEdit} /></Field>
        <Field label="ساعت شروع"><input type="time" value={form.startTime} disabled={!canEdit} onChange={(e) => set('startTime', e.target.value)} /></Field>
        <Field label="مدت (دقیقه)"><input inputMode="numeric" value={form.durationMinutes} disabled={!canEdit} onChange={(e) => set('durationMinutes', e.target.value)} placeholder="مثلاً ۶۰" /></Field>
        <Field label="برگزارکننده">
          <select value={form.organizerUserId} disabled={!canEdit} onChange={(e) => set('organizerUserId', e.target.value)}>
            <option value="">{creating ? 'خودم' : 'مشخص نشده'}</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}
          </select>
        </Field>
        <Field label="مکان"><input value={form.location} maxLength={300} disabled={!canEdit} onChange={(e) => set('location', e.target.value)} placeholder="مثلاً اتاق جلسات ۲" /></Field>
        <Field label="پیوند جلسه‌ی آنلاین"><input dir="ltr" value={form.onlineLink} maxLength={500} disabled={!canEdit} onChange={(e) => set('onlineLink', e.target.value)} placeholder="https://" /></Field>
        <Field label="دستور جلسه" wide><textarea rows={4} maxLength={4000} value={form.agenda} disabled={!canEdit} onChange={(e) => set('agenda', e.target.value)} /></Field>
      </div>
      {canEdit && <div className="mt-form-actions"><button type="submit" className="ue-save" disabled={Boolean(busy)}>{busy === 'save' ? 'در حال ذخیره...' : creating ? 'ساخت جلسه' : 'ذخیره‌ی تغییرات'}</button></div>}
      {!canEdit && !creating && <p className="docs-hint">{statusOf(meeting.status).key === 'Cancelled' ? 'جلسه‌ی لغوشده قابل ویرایش نیست؛ ابتدا آن را بازگشایی کنید.' : 'برای ویرایش جلسه دسترسی «ویرایش جلسه» لازم است.'}</p>}
      {!creating && <p className="docs-hint">{formatJalali(meeting.meetingDate)}{meeting.startTime ? ` · ${timeText(meeting)}` : ''}{durationText(meeting) ? ` · ${durationText(meeting)}` : ''}</p>}
    </form>
  )
}

function ParticipantsTab({ meeting, data, canEdit, held, busy, run }) {
  const [draft, setDraft] = useState(() => meeting.participants.map((item) => ({ userId: item.userId, isRequired: item.isRequired })))
  const [pick, setPick] = useState('')
  const attendanceByUser = useMemo(() => Object.fromEntries(meeting.participants.map((item) => [item.userId, item.attendance])), [meeting])
  const dirty = JSON.stringify([...draft].sort((a, b) => a.userId.localeCompare(b.userId))) !== JSON.stringify(meeting.participants.map((item) => ({ userId: item.userId, isRequired: item.isRequired })).sort((a, b) => a.userId.localeCompare(b.userId)))
  const teamIds = new Set((data.teamMembers || []).map((member) => member.userId))
  const free = data.users.filter((user) => !draft.some((item) => item.userId === user.id))
  const label = (user) => user.displayName || user.email

  const save = () => run('participants', () => pmApi.meetings.setParticipants(meeting.id, draft), 'فهرست شرکت‌کنندگان ذخیره شد.')
  const setAttendance = (userId, value) => run(`att-${userId}`, () => pmApi.meetings.setAttendance(meeting.id, userId, Number(value)))

  return (
    <div className="mt-participants">
      {canEdit && (
        <div className="mt-add">
          <select aria-label="افزودن شرکت‌کننده" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">شرکت‌کننده‌ی جدید...</option>
            {free.some((user) => teamIds.has(user.id)) && <optgroup label="اعضای تیم پروژه">{free.filter((user) => teamIds.has(user.id)).map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</optgroup>}
            <optgroup label="سایر کاربران">{free.filter((user) => !teamIds.has(user.id)).map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</optgroup>
          </select>
          <button type="button" className="bl-button" disabled={!pick} onClick={() => { setDraft([...draft, { userId: pick, isRequired: true }]); setPick('') }}><UserPlus size={15} />افزودن</button>
          {(data.teamMembers || []).some((member) => !draft.some((item) => item.userId === member.userId)) && (
            <button type="button" className="bl-button" onClick={() => setDraft([...draft, ...data.teamMembers.filter((member) => !draft.some((item) => item.userId === member.userId)).map((member) => ({ userId: member.userId, isRequired: true }))])}>افزودن همه‌ی اعضای تیم</button>
          )}
        </div>
      )}
      {!draft.length ? <p className="data-state">هنوز شرکت‌کننده‌ای انتخاب نشده است.</p> : (
        <div className="table-scroll"><table className="users-table mt-people" style={{ minWidth: 520 }}>
          <thead><tr><th>نام</th><th>الزامی</th><th>حضور</th>{canEdit && <th aria-label="حذف" />}</tr></thead>
          <tbody>{draft.map((item) => {
            const saved = attendanceByUser[item.userId]
            return (
              <tr key={item.userId}>
                <td><strong>{data.userName(item.userId)}</strong></td>
                <td><input type="checkbox" aria-label={`الزامی بودن ${data.userName(item.userId)}`} checked={item.isRequired} disabled={!canEdit} onChange={(e) => setDraft(draft.map((entry) => (entry.userId === item.userId ? { ...entry, isRequired: e.target.checked } : entry)))} /></td>
                <td>{saved === undefined ? <small className="bl-note">پس از ذخیره‌ی فهرست</small>
                  : held && canEdit
                    ? <select className="act-status" aria-label={`حضور ${data.userName(item.userId)}`} value={attendanceOf(saved).value} disabled={Boolean(busy)} onChange={(e) => setAttendance(item.userId, e.target.value)}>{ATTENDANCE.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                    : <span className="status-pill mt-muted">{held ? attendanceOf(saved).label : 'پس از برگزاری'}</span>}</td>
                {canEdit && <td><button type="button" className="mt-icon danger" aria-label={`حذف ${data.userName(item.userId)}`} onClick={() => setDraft(draft.filter((entry) => entry.userId !== item.userId))}><Trash2 size={15} /></button></td>}
              </tr>
            )
          })}</tbody>
        </table></div>
      )}
      {canEdit && <div className="mt-form-actions"><button type="button" className="ue-save" disabled={!dirty || Boolean(busy)} onClick={save}>{busy === 'participants' ? 'در حال ذخیره...' : 'ذخیره‌ی فهرست'}</button>{dirty && <small className="bl-note">تغییرات هنوز ذخیره نشده است.</small>}</div>}
      {!held && <p className="docs-hint">حضور و غیاب بعد از «برگزار شد» ثبت می‌شود.</p>}
    </div>
  )
}

function MinutesTab({ meeting, data, canEdit, held, busy, run }) {
  const [text, setText] = useState(meeting.minutes || '')
  const dirty = text.trim() !== (meeting.minutes || '')
  return (
    <div className="mt-minutes">
      {!held && <p className="docs-hint">صورت‌جلسه را فقط برای جلسه‌ی برگزارشده می‌شود ثبت کرد؛ در نوار بالا «برگزار شد» را بزنید.</p>}
      <Field label="متن صورت‌جلسه" wide hint={meeting.minutesRecordedAtUtc ? `آخرین ثبت: ${data.userName(meeting.minutesRecordedByUserId)} · ${formatJalali(String(meeting.minutesRecordedAtUtc).slice(0, 10))}` : 'تصمیم‌ها، مسئولان و مهلت‌ها را بنویسید.'}>
        <textarea rows={12} maxLength={20000} value={text} disabled={!canEdit || !held} onChange={(e) => setText(e.target.value)} />
      </Field>
      {canEdit && held && <div className="mt-form-actions"><button type="button" className="ue-save" disabled={!dirty || Boolean(busy)} onClick={() => run('minutes', () => pmApi.meetings.setMinutes(meeting.id, text.trim() || null), text.trim() ? 'صورت‌جلسه ذخیره شد.' : 'صورت‌جلسه پاک شد.')}>{busy === 'minutes' ? 'در حال ذخیره...' : 'ذخیره‌ی صورت‌جلسه'}</button></div>}
    </div>
  )
}
