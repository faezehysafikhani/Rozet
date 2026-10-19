import { useEffect, useState } from 'react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { unwrap } from '../../../services/api'
import { Field, Footer, Shell } from '../DialogParts'
import { pmApi } from '../pmApi'
import { ROOT_CAUSES, classify, explainProgressError, fmt } from './progressModel'

const percentError = (value, label) => {
  if (value === '' || Number.isNaN(Number(value))) return `${label} را وارد کنید.`
  if (Number(value) < 0 || Number(value) > 100) return `${label} باید بین ۰ و ۱۰۰ باشد.`
  return ''
}
const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

/** Create or edit a project status report (planned / actual progress, status text, delay reasons text). */
export function ProgressUpdateDialog({ project, data, update, onClose, onDone }) {
  const creating = !update
  const [form, setForm] = useState(() => ({
    registerDate: update?.registerDate || todayIso(), statusDescription: update?.statusDescription || '',
    plannedProgress: update?.plannedProgress ?? '', actualProgress: update?.actualProgress ?? '', delayReasons: update?.delayReasons || '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fill, setFill] = useState({ loading: false, note: '' })
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const deviation = form.plannedProgress !== '' && form.actualProgress !== '' ? Number(form.actualProgress) - Number(form.plannedProgress) : null

  async function fillFromPlan() {
    setFill({ loading: true, note: '' })
    const result = await pmApi.projects.progress({ projectIds: [project.id] })
    const entry = result.isSuccess ? (unwrap(result) || []).find((item) => item.projectId === project.id) : null
    if (!entry) { setFill({ loading: false, note: 'پیشرفت فعلی پروژه خوانده نشد.' }); return }
    setForm((current) => ({ ...current, plannedProgress: Math.round(entry.plannedProgress * 100) / 100, actualProgress: Math.round(entry.actualProgress * 100) / 100 }))
    setError('')
    setFill({ loading: false, note: 'مقادیر از برنامه‌ی زمان‌بندی فعلی پر شد؛ در صورت نیاز ویرایش کنید.' })
  }

  async function submit(event) {
    event.preventDefault()
    if (creating && !form.registerDate) { setError('تاریخ گزارش را کامل وارد کنید.'); return }
    const problem = percentError(form.plannedProgress, 'پیشرفت برنامه‌ای') || percentError(form.actualProgress, 'پیشرفت واقعی')
    if (problem) { setError(problem); return }
    setBusy(true)
    const body = { statusDescription: orNull(form.statusDescription), plannedProgress: Number(form.plannedProgress), actualProgress: Number(form.actualProgress), delayReasons: orNull(form.delayReasons) }
    const result = creating
      ? await pmApi.progress.create({ ...body, tenantId: data.tenantId, projectId: project.id, registerDate: form.registerDate })
      : await pmApi.progress.update(update.id, body)
    setBusy(false)
    if (!result.isSuccess) { setError(explainProgressError(result)); return }
    onDone(creating ? 'گزارش پیشرفت ثبت شد.' : 'گزارش پیشرفت ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'ثبت گزارش وضعیت پروژه' : 'ویرایش گزارش وضعیت'} subtitle={project.name} wide onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          {creating ? <Field label="تاریخ گزارش *"><JalaliDateInput value={form.registerDate} onChange={(value) => set('registerDate', value)} required /></Field>
            : <div className="ue-field"><span>تاریخ گزارش</span><strong>{formatJalali(update.registerDate)}</strong><small>تاریخ ثبت‌شده‌ی گزارش بعداً تغییر نمی‌کند.</small></div>}
          <div className="prg-fill"><button type="button" className="bl-button" onClick={fillFromPlan} disabled={fill.loading}>{fill.loading ? 'در حال خواندن...' : 'پر کردن از پیشرفت فعلی برنامه'}</button>{fill.note && <small>{fill.note}</small>}</div>
          <Field label="پیشرفت برنامه‌ای (٪) *"><input type="number" min="0" max="100" step="0.01" value={form.plannedProgress} onChange={(e) => set('plannedProgress', e.target.value)} /></Field>
          <Field label="پیشرفت واقعی (٪) *"><input type="number" min="0" max="100" step="0.01" value={form.actualProgress} onChange={(e) => set('actualProgress', e.target.value)} /></Field>
          {deviation !== null && !percentError(form.plannedProgress, '') && !percentError(form.actualProgress, '') && (
            <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>انحراف: {fmt(deviation, 2)} واحد درصد — وضعیت: <b>{classify(deviation).label}</b> (Core همین قاعده را حساب می‌کند).</p>
          )}
          <Field label="شرح وضعیت" wide><textarea rows={3} maxLength={2000} value={form.statusDescription} onChange={(e) => set('statusDescription', e.target.value)} /></Field>
          <Field label="دلایل تأخیر (متن آزاد)" wide hint="برای ثبت دلیل ساختاریافته با علت ریشه‌ای و اثر زمانی و هزینه‌ای از زبانه‌ی «دلایل تأخیر» استفاده کنید."><textarea rows={2} maxLength={2000} value={form.delayReasons} onChange={(e) => set('delayReasons', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'ثبت گزارش' : 'ذخیره'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

/** Create or edit a structured delay reason: root cause, description, time / cost impact, corrective action. */
export function DelayReasonDialog({ project, data, reason, onClose, onDone }) {
  const creating = !reason
  const [form, setForm] = useState(() => ({
    registerDate: reason?.registerDate || todayIso(), rootCause: typeof reason?.rootCause === 'number' ? reason.rootCause : ROOT_CAUSES.find((c) => c.key === reason?.rootCause)?.value ?? 0,
    description: reason?.description || '', timeImpactDays: reason?.timeImpactDays ?? '', costImpact: reason?.costImpact ?? '', correctiveAction: reason?.correctiveAction || '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (!form.registerDate) { setError('تاریخ ثبت را کامل وارد کنید.'); return }
    if (!form.description.trim()) { setError('شرح دلیل تأخیر را وارد کنید.'); return }
    if (form.timeImpactDays !== '' && (!Number.isInteger(Number(form.timeImpactDays)) || Number(form.timeImpactDays) < 0)) { setError('اثر زمانی باید یک عدد صحیح صفر یا بیشتر (به روز) باشد.'); return }
    if (form.costImpact !== '' && (!Number.isInteger(Number(form.costImpact)) || Number(form.costImpact) < 0)) { setError('اثر هزینه‌ای باید یک عدد صحیح صفر یا بیشتر باشد.'); return }
    setBusy(true)
    const body = {
      registerDate: form.registerDate, rootCause: Number(form.rootCause), description: form.description.trim(),
      timeImpactDays: form.timeImpactDays === '' ? null : Number(form.timeImpactDays), costImpact: form.costImpact === '' ? null : Number(form.costImpact),
      correctiveAction: orNull(form.correctiveAction),
    }
    const result = creating ? await pmApi.delayReasons.create({ ...body, tenantId: data.tenantId, projectId: project.id }) : await pmApi.delayReasons.update(reason.id, body)
    setBusy(false)
    if (!result.isSuccess) { setError(explainProgressError(result)); return }
    onDone(creating ? 'دلیل تأخیر ثبت شد.' : 'دلیل تأخیر ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'ثبت دلیل تأخیر' : 'ویرایش دلیل تأخیر'} subtitle={project.name} wide onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="تاریخ ثبت *"><JalaliDateInput value={form.registerDate} onChange={(value) => set('registerDate', value)} required /></Field>
          <Field label="علت ریشه‌ای *"><select value={form.rootCause} onChange={(e) => set('rootCause', Number(e.target.value))}>{ROOT_CAUSES.map((cause) => <option key={cause.value} value={cause.value}>{cause.label}</option>)}</select></Field>
          <Field label="شرح *" wide><textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} autoFocus /></Field>
          <Field label="اثر زمانی (روز)"><input type="number" min="0" step="1" value={form.timeImpactDays} onChange={(e) => set('timeImpactDays', e.target.value)} /></Field>
          <Field label="اثر هزینه‌ای"><input type="number" min="0" step="1" value={form.costImpact} onChange={(e) => set('costImpact', e.target.value)} /></Field>
          <Field label="اقدام اصلاحی" wide><textarea rows={2} maxLength={2000} value={form.correctiveAction} onChange={(e) => set('correctiveAction', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'ثبت' : 'ذخیره'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

/** Report an activity's progress; the report goes to the approval workflow (or is applied at once when there is none). */
export function SubmitActivityProgressDialog({ project, data, activities, presetActivityId, onClose, onDone }) {
  const [form, setForm] = useState({ activityId: presetActivityId || '', progress: '', comment: '', documentName: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const chosen = activities.find((activity) => activity.id === form.activityId)

  useEffect(() => { if (chosen && form.progress === '') setForm((current) => ({ ...current, progress: chosen.actualProgress ?? '' })) }, [form.activityId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(event) {
    event.preventDefault()
    if (!form.activityId) { setError('فعالیت را انتخاب کنید.'); return }
    const problem = percentError(form.progress, 'پیشرفت')
    if (problem) { setError(problem); return }
    setBusy(true)
    const result = await pmApi.waterfall.progressSubmissions.create({
      tenantId: data.tenantId, projectId: project.id, activityId: form.activityId, progress: Number(form.progress), comment: orNull(form.comment), documentName: orNull(form.documentName),
    })
    setBusy(false)
    if (!result.isSuccess) { setError(explainProgressError(result)); return }
    onDone(String(result.value?.approvalStatus) === '2' || result.value?.approvalStatus === 'Approved' ? 'گزارش ثبت و اعمال شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'گزارش پیشرفت برای تأیید ارسال شد.')
  }

  return (
    <Shell title="ثبت گزارش پیشرفت فعالیت" subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="فعالیت *" wide hint="فقط فعالیت‌های بدون زیرفعالیت؛ پیشرفت گروه‌ها از زیرفعالیت‌ها به دست می‌آید.">
            <select value={form.activityId} onChange={(e) => set('activityId', e.target.value)}><option value="">انتخاب کنید...</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select>
          </Field>
          <Field label="پیشرفت (٪) *" wide hint={chosen ? `پیشرفت فعلی ثبت‌شده: ${fmt(chosen.actualProgress)}٪` : undefined}><input type="number" min="0" max="100" step="0.01" value={form.progress} onChange={(e) => set('progress', e.target.value)} /></Field>
          <Field label="توضیح" wide><textarea rows={3} maxLength={2000} value={form.comment} onChange={(e) => set('comment', e.target.value)} /></Field>
          <Field label="نام سند پیوست (اختیاری)" wide hint="فقط یک نام یا عنوان؛ فایلی بارگذاری نمی‌شود (برای فایل از «مدیریت مستندات» استفاده کنید)."><input maxLength={260} value={form.documentName} onChange={(e) => set('documentName', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت گزارش" busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}

/** What an approver confirms for a pending report (may differ from the figure reported). */
export function ConfirmedProgressDialog({ submission, activityName, onClose, onDone }) {
  const [value, setValue] = useState(submission.approvedProgress ?? submission.submittedProgress)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const problem = percentError(value, 'پیشرفت تأییدی')
    if (problem) { setError(problem); return }
    setBusy(true)
    const result = await pmApi.waterfall.progressSubmissions.confirm(submission.id, { progress: Number(value) })
    setBusy(false)
    if (!result.isSuccess) { setError(explainProgressError(result)); return }
    onDone('پیشرفت تأییدی ثبت شد. تصمیم نهایی (تأیید یا رد) در گردش کار تأیید گرفته می‌شود.')
  }

  return (
    <Shell title="پیشرفت تأییدی" subtitle={activityName} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="پیشرفت تأییدی (٪)" wide hint={`گزارش‌شده: ${fmt(submission.submittedProgress)}٪. اگر با رقم گزارش‌شده موافق نیستید، رقم تأییدی را اینجا بنویسید.`}><input type="number" min="0" max="100" step="0.01" value={value} onChange={(e) => { setValue(e.target.value); setError('') }} autoFocus /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت پیشرفت تأییدی" busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}
