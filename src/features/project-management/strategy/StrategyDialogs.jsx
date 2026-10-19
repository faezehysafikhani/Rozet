import { useState } from 'react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { Field, Footer, Shell } from '../DialogParts'
import { pmApi } from '../pmApi'
import { DELIVERABLE_STATUSES, KPI_TYPES, deliverableStatusOf, explainStrategyError, kpiTypeOf } from './strategyModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

/** Create or edit a deliverable (status is changed from the table, in its own call). */
export function DeliverableDialog({ project, data, deliverable, onClose, onDone }) {
  const creating = !deliverable
  const [form, setForm] = useState(() => ({
    title: deliverable?.title || '', description: deliverable?.description || '', acceptanceCriteria: deliverable?.acceptanceCriteria || '',
    responsibleUserId: deliverable?.responsibleUserId || '', targetDate: deliverable?.targetDate || '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim()) { setError('عنوان خروجی را وارد کنید.'); return }
    setBusy(true)
    const body = { title: form.title.trim(), description: orNull(form.description), acceptanceCriteria: orNull(form.acceptanceCriteria), responsibleUserId: orNull(form.responsibleUserId), targetDate: orNull(form.targetDate) }
    const result = creating ? await pmApi.deliverables.create({ ...body, tenantId: data.tenantId, projectId: project.id }) : await pmApi.deliverables.update(deliverable.id, body)
    setBusy(false)
    if (!result.isSuccess) { setError(explainStrategyError(result)); return }
    onDone(creating ? `خروجی «${body.title}» تعریف شد.` : 'خروجی ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'تعریف خروجی' : 'ویرایش خروجی'} subtitle={project.name} wide onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="عنوان *" wide><input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
          <Field label="مسئول"><select value={form.responsibleUserId} onChange={(e) => set('responsibleUserId', e.target.value)}><option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></Field>
          <Field label="تاریخ هدف"><JalaliDateInput value={form.targetDate} onChange={(value) => set('targetDate', value)} yearsAhead={10} /></Field>
          <Field label="شرح" wide><textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="معیار پذیرش" wide><textarea rows={3} maxLength={2000} value={form.acceptanceCriteria} onChange={(e) => set('acceptanceCriteria', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'تعریف خروجی' : 'ذخیره'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

/** Create or edit a KPI. A KPI belongs to one deliverable; its type and deliverable cannot change later. */
export function KpiDialog({ project, data, deliverables, kpi, presetDeliverableId, onClose, onDone }) {
  const creating = !kpi
  const [form, setForm] = useState(() => ({
    deliverableId: kpi?.deliverableId || presetDeliverableId || '', type: kpiTypeOf(kpi?.type ?? 0).value,
    description: kpi?.description || '', formula: kpi?.formula || '', targetValue: kpi?.targetValue ?? '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const deliverableTitle = deliverables.find((item) => item.id === form.deliverableId)?.title

  async function submit(event) {
    event.preventDefault()
    if (creating && !form.deliverableId) { setError('خروجی مربوط به شاخص را انتخاب کنید.'); return }
    if (!form.description.trim()) { setError('شرح شاخص را وارد کنید.'); return }
    if (form.targetValue !== '' && Number.isNaN(Number(form.targetValue))) { setError('مقدار هدف باید عدد باشد.'); return }
    setBusy(true)
    const body = { description: form.description.trim(), formula: orNull(form.formula), targetValue: form.targetValue === '' ? null : Number(form.targetValue) }
    const result = creating
      ? await pmApi.kpis.create({ ...body, tenantId: data.tenantId, projectId: project.id, deliverableId: form.deliverableId, type: Number(form.type) })
      : await pmApi.kpis.update(kpi.id, body)
    setBusy(false)
    if (!result.isSuccess) { setError(explainStrategyError(result)); return }
    onDone(creating ? 'شاخص تعریف شد.' : 'شاخص ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'تعریف شاخص (KPI)' : 'ویرایش شاخص (KPI)'} subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          {creating
            ? <Field label="خروجی *" wide><select value={form.deliverableId} onChange={(e) => set('deliverableId', e.target.value)}><option value="">انتخاب کنید...</option>{deliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
            : <div className="ue-field" style={{ gridColumn: '1 / -1' }}><span>خروجی</span><strong>{deliverableTitle || '—'}</strong><small>خروجی و نوع شاخص بعد از تعریف تغییر نمی‌کند.</small></div>}
          {creating && <Field label="نوع شاخص" wide hint={kpiTypeOf(form.type).hint}><select value={form.type} onChange={(e) => set('type', Number(e.target.value))}>{KPI_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>}
          <Field label="شرح *" wide><textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} autoFocus={!creating} /></Field>
          <Field label="فرمول محاسبه" wide><input maxLength={500} value={form.formula} onChange={(e) => set('formula', e.target.value)} /></Field>
          <Field label="مقدار هدف" wide><input type="number" step="any" value={form.targetValue} onChange={(e) => set('targetValue', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'تعریف شاخص' : 'ذخیره'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

export { DELIVERABLE_STATUSES, deliverableStatusOf }
