import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { listOf, pmApi } from '../pmApi'
import { Field, Footer, Shell } from '../DialogParts'
import { DEPENDENCY_TYPES, LEVELS, PLANNED_MODES, WEIGHTING_MODES, dependencyValue, descendantsOf, explainScheduleError, levelValue, plannedValue, weightingValue } from './scheduleModel'

const toNumberOrNull = (value) => (value === '' || value === undefined || value === null ? null : Number(value))
const orNull = (value) => (value === '' || value === undefined ? null : value)

/** Create or edit one activity: its place in the tree, people, dates, estimates and its predecessors (any number, each with a type and a lag). */
export function ActivityFormDialog({ project, rows, activity, presetParentId, data, settings, canManageSchedule, onClose, onDone }) {
  const creating = !activity
  const manual = weightingValue(settings?.weighting) === 0
  const originalLinks = activity?.predecessors || []
  const [form, setForm] = useState(() => ({
    name: activity?.name || '', description: activity?.description || '',
    parentActivityId: activity ? activity.parentActivityId || '' : presetParentId || '',
    responsibleUserId: activity?.responsibleUserId || '', approverUserId: activity?.approverUserId || '',
    deliverableId: activity?.deliverableId || '',
    startDate: activity?.startDate || '', endDate: activity?.endDate || '',
    durationDays: activity?.durationDays ?? '', manHours: activity?.manHours ?? '',
    weight: activity ? activity.storedWeight : '', cost: activity?.cost ?? '',
    importance: levelValue(activity?.importance ?? 1), complexity: levelValue(activity?.complexity ?? 1),
    isMilestone: Boolean(activity?.isMilestone),
  }))
  const [links, setLinks] = useState(() => originalLinks.map((link) => ({ key: link.id, id: link.id, predecessorId: link.predecessorActivityId, type: dependencyValue(link.type), lag: link.lagDays ?? 0 })))
  const [deliverables, setDeliverables] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const setLink = (key, patch) => { setLinks((current) => current.map((link) => (link.key === key ? { ...link, ...patch } : link))); setError('') }
  const addLink = () => { setLinks((current) => [...current, { key: `new-${Date.now()}-${current.length}`, id: null, predecessorId: '', type: 0, lag: 0 }]); setError('') }

  useEffect(() => {
    let cancelled = false
    pmApi.deliverables.list(project.id).then((result) => { if (!cancelled && result.isSuccess) setDeliverables(listOf(result)) })
    return () => { cancelled = true }
  }, [project.id])

  const excluded = creating ? new Set() : new Set([activity.id, ...descendantsOf(rows, activity.id)])
  const parentOptions = rows.filter((row) => !row.isMilestone && !excluded.has(row.id))
  const predecessorOptions = rows.filter((row) => !row.isSummary && row.id !== activity?.id)
  const showPredecessor = canManageSchedule && !activity?.isSummary
  const label = (row) => `${row.wbs ? `${row.wbs} — ` : ''}${row.name}`

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) { setError('نام فعالیت را وارد کنید.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.'); return }
    if (showPredecessor) {
      if (links.some((link) => !link.predecessorId)) { setError('برای هر ردیف پیش‌نیاز، فعالیت را انتخاب کنید یا ردیف را حذف کنید.'); return }
      if (new Set(links.map((link) => link.predecessorId)).size !== links.length) { setError('یک فعالیت را نمی‌توان دو بار پیش‌نیاز قرار داد.'); return }
      if (links.some((link) => !Number.isInteger(Number(link.lag)) || Math.abs(Number(link.lag)) > 365)) { setError('تأخیر باید عددی صحیح بین ۳۶۵- و ۳۶۵ روز باشد.'); return }
    }
    const weight = manual ? Number(form.weight || 0) : (activity?.storedWeight ?? 0)
    if (weight < 0 || weight > 100) { setError('وزن باید بین ۰ و ۱۰۰ باشد.'); return }
    if (form.durationDays !== '' && Number(form.durationDays) < 0) { setError('مدت فعالیت نمی‌تواند منفی باشد.'); return }
    if (form.cost !== '' && Number(form.cost) < 0) { setError('هزینه نمی‌تواند منفی باشد.'); return }

    setBusy(true); setError('')
    const payload = {
      parentActivityId: orNull(form.parentActivityId), name: form.name.trim(), description: orNull(form.description.trim()),
      deliverableId: orNull(form.deliverableId), responsibleUserId: orNull(form.responsibleUserId), approverUserId: orNull(form.approverUserId),
      startDate: orNull(form.startDate), endDate: orNull(form.endDate),
      durationDays: toNumberOrNull(form.durationDays), manHours: toNumberOrNull(form.manHours), weight,
      isMilestone: form.isMilestone, cost: toNumberOrNull(form.cost), importance: Number(form.importance), complexity: Number(form.complexity),
    }
    const result = creating
      ? await pmApi.waterfall.activities.create({ ...payload, tenantId: data.tenantId, projectId: project.id })
      : await pmApi.waterfall.activities.update(activity.id, payload)
    if (!result.isSuccess) { setBusy(false); setError(explainScheduleError(result)); return }

    // The predecessors are separate calls: remove what was taken out, update what changed, then add the new ones.
    const savedId = result.value?.id || activity?.id
    if (showPredecessor && savedId) {
      const kept = new Map(links.filter((link) => link.id).map((link) => [link.id, link]))
      const steps = []
      originalLinks.forEach((old) => {
        const now = kept.get(old.id)
        if (!now || now.predecessorId !== old.predecessorActivityId) steps.push(() => pmApi.waterfall.dependencies.remove(old.id))
      })
      links.forEach((link) => {
        const old = originalLinks.find((entry) => entry.id === link.id)
        if (old && old.predecessorActivityId === link.predecessorId && (Number(link.type) !== dependencyValue(old.type) || Number(link.lag || 0) !== Number(old.lagDays ?? 0))) {
          steps.push(() => pmApi.waterfall.dependencies.update(link.id, { type: Number(link.type), lagDays: Number(link.lag || 0) }))
        }
      })
      links.forEach((link) => {
        const old = originalLinks.find((entry) => entry.id === link.id)
        if (!old || old.predecessorActivityId !== link.predecessorId) {
          steps.push(() => pmApi.waterfall.dependencies.create({ tenantId: data.tenantId, projectId: project.id, predecessorActivityId: link.predecessorId, successorActivityId: savedId, type: Number(link.type), lagDays: Number(link.lag || 0) }))
        }
      })
      for (let index = 0; index < steps.length; index += 1) {
        const step = await steps[index]()
        if (!step.isSuccess) {
          setBusy(false)
          onDone(`فعالیت ذخیره شد، اما ثبت پیش‌نیازها ناموفق بود (${index.toLocaleString('fa-IR')} از ${steps.length.toLocaleString('fa-IR')} تغییر انجام شد): ${explainScheduleError(step)}`, 'error')
          return
        }
      }
    }
    setBusy(false)
    onDone(creating ? `فعالیت «${payload.name}» افزوده شد.` : 'تغییرات فعالیت ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'افزودن فعالیت' : 'ویرایش فعالیت'} subtitle={activity ? `${activity.wbs} — ${project.name}` : project.name} onClose={onClose} busy={busy} wide>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="نام فعالیت *" wide><input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} autoFocus /></Field>
          <Field label="فعالیت والد" hint="خالی = فعالیت سطح اول">
            <select value={form.parentActivityId} onChange={(e) => set('parentActivityId', e.target.value)}>
              <option value="">— سطح اول —</option>{parentOptions.map((row) => <option key={row.id} value={row.id}>{label(row)}</option>)}
            </select>
          </Field>
          <Field label="خروجی مرتبط">
            <select value={form.deliverableId} onChange={(e) => set('deliverableId', e.target.value)}>
              <option value="">انتخاب نشده</option>{deliverables.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </Field>
          <Field label="مسئول">
            <select value={form.responsibleUserId} onChange={(e) => set('responsibleUserId', e.target.value)}>
              <option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
            </select>
          </Field>
          <Field label="تأییدکننده">
            <select value={form.approverUserId} onChange={(e) => set('approverUserId', e.target.value)}>
              <option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
            </select>
          </Field>
          <Field label="تاریخ شروع" hint="اگر خالی بماند، زمان‌بندی از پیش‌نیازها و مدت محاسبه می‌شود."><JalaliDateInput value={form.startDate} onChange={(v) => set('startDate', v)} aria-label="تاریخ شروع" /></Field>
          <Field label="تاریخ پایان"><JalaliDateInput value={form.endDate} min={form.startDate || undefined} onChange={(v) => set('endDate', v)} aria-label="تاریخ پایان" /></Field>
          <Field label="مدت (روز کاری)"><input type="number" min="0" value={form.durationDays} onChange={(e) => set('durationDays', e.target.value)} /></Field>
          <Field label="نفر-ساعت"><input type="number" min="0" step="0.5" value={form.manHours} onChange={(e) => set('manHours', e.target.value)} /></Field>
          <Field label="هزینه"><input type="number" min="0" value={form.cost} onChange={(e) => set('cost', e.target.value)} /></Field>
          {manual
            ? <Field label="وزن (٪)"><input type="number" min="0" max="100" step="0.1" value={form.weight} onChange={(e) => set('weight', e.target.value)} /></Field>
            : <Field label="وزن"><input value="خودکار" disabled /><small>وزن بر اساس حالت وزن‌دهی پروژه محاسبه می‌شود.</small></Field>}
          <Field label="اهمیت"><select value={form.importance} onChange={(e) => set('importance', e.target.value)}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></Field>
          <Field label="پیچیدگی"><select value={form.complexity} onChange={(e) => set('complexity', e.target.value)}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></Field>
          <label className="sch-check" style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={form.isMilestone} disabled={activity?.isSummary} onChange={(e) => set('isMilestone', e.target.checked)} />
            نقطه‌عطف (milestone؛ فعالیتی بدون مدت که زیرفعالیت ندارد)
          </label>
          {showPredecessor && (
            <div className="sch-links" style={{ gridColumn: '1 / -1' }}>
              <div className="sch-links-head"><strong>پیش‌نیازها</strong><button type="button" onClick={addLink}><Plus size={14} />افزودن پیش‌نیاز</button></div>
              {!links.length && <small>بدون پیش‌نیاز؛ با «افزودن پیش‌نیاز» فعالیت‌هایی را که باید پیش از این تمام یا شروع شوند اضافه کنید.</small>}
              {links.map((link) => (
                <div className="sch-link-row" key={link.key}>
                  <select aria-label="فعالیت پیش‌نیاز" value={link.predecessorId} onChange={(e) => setLink(link.key, { predecessorId: e.target.value })}>
                    <option value="">انتخاب فعالیت...</option>
                    {predecessorOptions.map((row) => <option key={row.id} value={row.id} disabled={row.id !== link.predecessorId && links.some((other) => other.predecessorId === row.id)}>{label(row)}</option>)}
                  </select>
                  <select aria-label="نوع وابستگی" value={link.type} onChange={(e) => setLink(link.key, { type: Number(e.target.value) })}>{DEPENDENCY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
                  <label className="sch-lag">تأخیر (روز)<input type="number" min="-365" max="365" step="1" aria-label="تأخیر یا پیش‌افتادگی (روز)" value={link.lag} onChange={(e) => setLink(link.key, { lag: e.target.value })} /></label>
                  <button type="button" className="danger" title="حذف پیش‌نیاز" aria-label="حذف پیش‌نیاز" onClick={() => { setLinks((current) => current.filter((entry) => entry.key !== link.key)); setError('') }}><Trash2 size={15} /></button>
                </div>
              ))}
              {links.length > 0 && <small>عدد منفی برای تأخیر یعنی همپوشانی (پیش‌افتادگی).</small>}
            </div>
          )}
          <Field label="توضیحات" wide><textarea rows="2" value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'افزودن فعالیت' : 'ذخیره تغییرات'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

/** The percentage of one (leaf) activity that is done. A summary's progress is rolled up from its children. */
export function ActualProgressDialog({ activity, onClose, onDone }) {
  const [value, setValue] = useState(String(Math.round(activity.actual)))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const number = Number(value)
    if (value === '' || Number.isNaN(number) || number < 0 || number > 100) { setError('درصد پیشرفت باید بین ۰ و ۱۰۰ باشد.'); return }
    setBusy(true); setError('')
    const result = await pmApi.waterfall.activities.setActualProgress(activity.id, { actualProgress: number })
    setBusy(false)
    if (!result.isSuccess) { setError(explainScheduleError(result)); return }
    onDone(`پیشرفت واقعی «${activity.name}» ${number.toLocaleString('fa-IR')}٪ ثبت شد.`)
  }

  return (
    <Shell title="ثبت پیشرفت واقعی" subtitle={`${activity.wbs} — ${activity.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="درصد پیشرفت واقعی" wide hint={`پیشرفت برنامه‌ای فعلی: ${Number(activity.planned).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`}>
            <input type="number" min="0" max="100" step="1" value={value} onChange={(e) => { setValue(e.target.value); setError('') }} autoFocus />
          </Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت پیشرفت" busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}

/** How the project weighs its activities and plans their progress. */
export function ScheduleSettingsDialog({ project, settings, data, onClose, onDone }) {
  const [weighting, setWeighting] = useState(weightingValue(settings?.weighting))
  const [planned, setPlanned] = useState(plannedValue(settings?.plannedProgress))
  const [factors, setFactors] = useState({ time: settings?.timeFactor ?? 34, cost: settings?.costFactor ?? 33, complexity: settings?.complexityFactor ?? 33 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const combined = Number(weighting) === 4
  const total = Number(factors.time) + Number(factors.cost) + Number(factors.complexity)

  async function submit(event) {
    event.preventDefault()
    if (combined && total !== 100) { setError(`مجموع ضریب‌ها ${total.toLocaleString('fa-IR')} است؛ باید ۱۰۰ باشد.`); return }
    setBusy(true); setError('')
    const result = await pmApi.waterfall.settings.save({
      tenantId: data.tenantId, projectId: project.id, weighting: Number(weighting), plannedProgress: Number(planned),
      timeFactor: combined ? Number(factors.time) : 0, costFactor: combined ? Number(factors.cost) : 0, complexityFactor: combined ? Number(factors.complexity) : 0,
    })
    setBusy(false)
    if (!result.isSuccess) { setError(explainScheduleError(result)); return }
    onDone('تنظیمات زمان‌بندی ذخیره شد.')
  }
  const setFactor = (key, value) => { setFactors((current) => ({ ...current, [key]: value })); setError('') }

  return (
    <Shell title="تنظیمات وزن‌دهی و پیشرفت" subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="روش وزن‌دهی فعالیت‌ها" wide><select value={weighting} onChange={(e) => { setWeighting(Number(e.target.value)); setError('') }}>{WEIGHTING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
          {combined && (
            <>
              <Field label="ضریب زمان (٪)"><input type="number" min="0" max="100" value={factors.time} onChange={(e) => setFactor('time', e.target.value)} /></Field>
              <Field label="ضریب هزینه (٪)"><input type="number" min="0" max="100" value={factors.cost} onChange={(e) => setFactor('cost', e.target.value)} /></Field>
              <Field label="ضریب پیچیدگی (٪)"><input type="number" min="0" max="100" value={factors.complexity} onChange={(e) => setFactor('complexity', e.target.value)} /></Field>
              <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>مجموع ضریب‌ها: {total.toLocaleString('fa-IR')} از ۱۰۰</p>
            </>
          )}
          <Field label="محاسبه‌ی پیشرفت برنامه‌ای" wide><select value={planned} onChange={(e) => setPlanned(Number(e.target.value))}>{PLANNED_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ذخیره تنظیمات" busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}
