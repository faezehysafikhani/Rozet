import { useState } from 'react'
import { X } from 'lucide-react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { pmApi } from '../pmApi'
import { explainPmError } from '../pmErrors'
import { PROJECT_TYPES, projectTypeOf, unitLabel } from './projectModel'

// The Core's charter rules (Rozet.Api turns charter validation on), checked first so the user is told what is
// missing before anything is sent. The Core repeats every check.
const PLACEHOLDER_TEXTS = ['test', 'تست', 'asdf', 'qwer', '1234', '123456', 'aaaa', 'bbbb', 'xxxx', '....', '---']
const meaningless = (text) => { const t = String(text || '').trim(); return t.length < 4 || PLACEHOLDER_TEXTS.includes(t.toLowerCase()) }
const TEXT_FIELDS = [['goal', 'هدف پروژه', true], ['requirements', 'نیازمندی‌ها', true], ['constraints', 'محدودیت‌ها', false], ['assumptions', 'مفروضات', false], ['description', 'توضیحات', false]]

export function validateProject(form, { creating }) {
  if (!form.name.trim()) return 'نام پروژه را وارد کنید.'
  if (!creating && !form.code.trim()) return 'کد پروژه را وارد کنید.'
  if (!form.managerUserId) return 'مدیر پروژه را انتخاب کنید.'
  if (!form.organizationUnitId) return 'واحد سازمانی پروژه را انتخاب کنید.'
  if (!form.startDate) return 'تاریخ شروع را وارد کنید.'
  if (!form.endDate) return 'تاریخ پایان را وارد کنید.'
  if (form.endDate < form.startDate) return 'تاریخ پایان نباید قبل از تاریخ شروع باشد.'
  for (const [key, label, required] of TEXT_FIELDS) {
    const text = form[key].trim()
    if (required && !text) return `«${label}» را وارد کنید.`
    if (text && meaningless(text)) return `متن «${label}» معنادار نیست؛ آن را با چند کلمه‌ی واقعی توضیح دهید.`
  }
  return ''
}

const blank = (project) => ({
  name: project?.name || '', code: project?.code || '', type: String(projectTypeOf(project?.type ?? 1).value),
  managerUserId: project?.managerUserId || '', ownerUserId: project?.ownerUserId || '',
  organizationUnitId: project?.organizationUnitId || '', workCalendarId: project?.workCalendarId || '',
  startDate: project?.startDate || '', endDate: project?.endDate || '',
  cost: project?.cost ?? '', goal: project?.goal || '', requirements: project?.requirements || '',
  constraints: project?.constraints || '', assumptions: project?.assumptions || '', description: project?.description || '',
})
const orNull = (value) => (value === '' || value === undefined ? null : value)

const Field = ({ label, children, wide, hint }) => <label className="ue-field" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>

/** Create (project = null) or edit a project's charter. The type cannot change after creation (the Core has no such call). */
export default function ProjectFormDialog({ project, data, lookups, onClose, onDone }) {
  const creating = !project
  const [form, setForm] = useState(() => {
    const initial = blank(project)
    if (creating) initial.workCalendarId = lookups.calendars.find((calendar) => calendar.isDefault)?.id || ''
    return initial
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newUnit, setNewUnit] = useState('')
  const [creatingUnit, setCreatingUnit] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function addUnit() {
    const name = newUnit.trim()
    if (!name) return
    setCreatingUnit(true)
    const result = await lookups.createUnit(data.tenantId, name)
    setCreatingUnit(false)
    if (!result.isSuccess) { setError(explainPmError(result)); return }
    set('organizationUnitId', result.value?.id || '')
    setNewUnit('')
  }

  async function submit(event) {
    event.preventDefault()
    const problem = validateProject(form, { creating })
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    const common = {
      name: form.name.trim(), managerUserId: form.managerUserId, ownerUserId: orNull(form.ownerUserId),
      organizationUnitId: form.organizationUnitId, workCalendarId: orNull(form.workCalendarId),
      startDate: form.startDate, endDate: form.endDate, cost: form.cost === '' ? null : Number(form.cost),
      goal: form.goal.trim(), requirements: form.requirements.trim(),
      constraints: orNull(form.constraints.trim()), assumptions: orNull(form.assumptions.trim()), description: orNull(form.description.trim()),
      charter: project?.charter ?? null,
    }
    const result = creating
      ? await pmApi.projects.create({ ...common, tenantId: data.tenantId, code: orNull(form.code.trim()), type: Number(form.type) })
      : await pmApi.projects.update(project.id, { ...common, code: form.code.trim() })
    setBusy(false)
    if (!result.isSuccess) { setError(explainPmError(result, { conflict: 'پروژه‌ای با این کد قبلاً ثبت شده است.' })); return }
    onDone(creating ? `پروژه‌ی «${common.name}» ایجاد شد.` : 'تغییرات پروژه ذخیره شد.', result.value)
  }

  const { units, calendars, canListUnits, canCreateUnit, canListCalendars } = lookups
  return (
    <div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="ue-modal pm-modal prj-modal" role="dialog" aria-modal="true" aria-label={creating ? 'ایجاد پروژه' : 'ویرایش پروژه'} dir="rtl">
        <header className="ue-head">
          <div className="ue-head-title"><strong>{creating ? 'ایجاد پروژه' : 'ویرایش پروژه'}</strong>{!creating && <small>{project.code}</small>}</div>
          <button className="ue-close" type="button" onClick={onClose} disabled={busy} aria-label="بستن"><X size={17} /></button>
        </header>
        <form onSubmit={submit} noValidate>
          <div className="ue-body"><div className="ue-grid">
            <Field label="نام پروژه *"><input value={form.name} onChange={(e) => set('name', e.target.value)} required autoFocus /></Field>
            <Field label={creating ? 'کد پروژه' : 'کد پروژه *'} hint={creating ? 'خالی بماند تا خودکار ساخته شود (P0001)' : undefined}><input value={form.code} onChange={(e) => set('code', e.target.value)} /></Field>
            <Field label="نوع پروژه" hint={creating ? undefined : 'نوع پروژه پس از ایجاد تغییر نمی‌کند.'}>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} disabled={!creating}>{PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            </Field>
            <Field label="هزینه اولیه"><input type="number" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
            <Field label="مدیر پروژه *">
              <select value={form.managerUserId} onChange={(e) => set('managerUserId', e.target.value)}>
                <option value="">انتخاب کنید</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
              </select>
            </Field>
            <Field label="مالک پروژه">
              <select value={form.ownerUserId} onChange={(e) => set('ownerUserId', e.target.value)}>
                <option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
              </select>
            </Field>
            <Field label="واحد سازمانی *">
              <select value={form.organizationUnitId} onChange={(e) => set('organizationUnitId', e.target.value)} disabled={!canListUnits}>
                <option value="">{canListUnits ? 'انتخاب کنید' : 'نیازمند دسترسی مشاهده واحدهای سازمانی'}</option>
                {units.map((unit) => <option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}
              </select>
            </Field>
            <Field label="تقویم کاری">
              <select value={form.workCalendarId} onChange={(e) => set('workCalendarId', e.target.value)} disabled={!canListCalendars}>
                <option value="">{canListCalendars ? 'بدون تقویم' : 'نیازمند دسترسی مشاهده تقویم'}</option>
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isDefault ? ' (پیش‌فرض)' : ''}</option>)}
              </select>
            </Field>
            {canListUnits && !units.length && (
              <div className="ue-field" style={{ gridColumn: '1 / -1' }}>
                <span>هنوز واحد سازمانی تعریف نشده است.{canCreateUnit ? ' نام اولین واحد را وارد کنید:' : ' از مدیر سامانه بخواهید یک واحد سازمانی تعریف کند.'}</span>
                {canCreateUnit && <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="مثلاً معاونت فناوری" />
                  <button type="button" className="ue-save" onClick={addUnit} disabled={creatingUnit || !newUnit.trim()}>{creatingUnit ? 'در حال ثبت...' : 'ایجاد واحد'}</button>
                </div>}
              </div>
            )}
            <Field label="تاریخ شروع *"><JalaliDateInput value={form.startDate} onChange={(v) => set('startDate', v)} aria-label="تاریخ شروع" /></Field>
            <Field label="تاریخ پایان *"><JalaliDateInput value={form.endDate} min={form.startDate || undefined} onChange={(v) => set('endDate', v)} aria-label="تاریخ پایان" /></Field>
            <Field label="هدف پروژه *" wide><textarea rows="2" value={form.goal} onChange={(e) => set('goal', e.target.value)} /></Field>
            <Field label="نیازمندی‌ها *" wide><textarea rows="2" value={form.requirements} onChange={(e) => set('requirements', e.target.value)} /></Field>
            <Field label="محدودیت‌ها" wide><textarea rows="2" value={form.constraints} onChange={(e) => set('constraints', e.target.value)} /></Field>
            <Field label="مفروضات" wide><textarea rows="2" value={form.assumptions} onChange={(e) => set('assumptions', e.target.value)} /></Field>
            <Field label="توضیحات" wide><textarea rows="2" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          </div></div>
          <footer className="ue-foot">
            {error && <span className="ue-error" role="alert">{error}</span>}
            <div className="ue-foot-actions">
              <button className="ue-cancel" type="button" onClick={onClose} disabled={busy}>انصراف</button>
              <button className="ue-save" type="submit" disabled={busy}>{busy ? 'در حال ذخیره...' : creating ? 'ایجاد پروژه' : 'ذخیره تغییرات'}</button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}
