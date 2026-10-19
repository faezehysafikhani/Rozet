import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { unwrap } from '../../../services/api'
import { Field, Footer, Shell } from '../../project-management/DialogParts'
import { listOf, pmApi } from '../../project-management/pmApi'
import { useLoader } from '../../project-management/useLoader'
import { explainTaskError, priorityOf, sprintStatusOf, statusOf } from '../taskModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

/** Create or edit a sprint (name, goal, dates). */
export function SprintFormDialog({ project, data, sprint, onClose, onDone }) {
  const creating = !sprint
  const [form, setForm] = useState(() => ({ name: sprint?.name || '', goal: sprint?.goal || '', startDate: sprint?.startDate || '', endDate: sprint?.endDate || '' }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (!creating && !form.name.trim()) { setError('نام اسپرینت را وارد کنید.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.'); return }
    setBusy(true)
    const body = { name: creating ? orNull(form.name) : form.name.trim(), goal: orNull(form.goal), startDate: orNull(form.startDate), endDate: orNull(form.endDate) }
    const result = creating ? await pmApi.agile.sprints.create({ ...body, tenantId: data.tenantId, projectId: project.id }) : await pmApi.agile.sprints.update(sprint.id, body)
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    onDone(creating ? 'اسپرینت ساخته شد.' : 'اسپرینت ذخیره شد.')
  }

  return (
    <Shell title={creating ? 'ساخت اسپرینت' : `ویرایش ${sprint.name}`} subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label={creating ? 'نام (اختیاری)' : 'نام *'} wide hint={creating ? 'اگر خالی بماند «Sprint N» می‌شود.' : undefined}><input value={form.name} maxLength={200} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="هدف اسپرینت" wide><textarea rows={2} maxLength={1000} value={form.goal} onChange={(e) => set('goal', e.target.value)} /></Field>
          <Field label="تاریخ شروع"><JalaliDateInput value={form.startDate} onChange={(value) => set('startDate', value)} yearsAhead={3} /></Field>
          <Field label="تاریخ پایان"><JalaliDateInput value={form.endDate} onChange={(value) => set('endDate', value)} yearsAhead={3} /></Field>
          <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>تاریخ‌ها را می‌توان تا لحظه‌ی شروع خالی گذاشت.</p>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'ساخت اسپرینت' : 'ذخیره'} busyLabel="در حال ذخیره..." />
      </form>
    </Shell>
  )
}

/** Start a planned sprint: both dates are needed. */
export function StartSprintDialog({ sprint, onClose, onDone }) {
  const [form, setForm] = useState({ startDate: sprint.startDate || '', endDate: sprint.endDate || '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (!form.startDate || !form.endDate) { setError('تاریخ شروع و پایان را کامل وارد کنید.'); return }
    if (form.endDate < form.startDate) { setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.'); return }
    setBusy(true)
    const result = await pmApi.agile.sprints.start(sprint.id, { startDate: form.startDate, endDate: form.endDate })
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    onDone(`${sprint.name} شروع شد.`)
  }
  return (
    <Shell title={`شروع ${sprint.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="تاریخ شروع *"><JalaliDateInput value={form.startDate} onChange={(value) => { setForm((c) => ({ ...c, startDate: value })); setError('') }} yearsAhead={3} /></Field>
          <Field label="تاریخ پایان *"><JalaliDateInput value={form.endDate} onChange={(value) => { setForm((c) => ({ ...c, endDate: value })); setError('') }} yearsAhead={3} /></Field>
          <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>در هر پروژه هم‌زمان فقط یک اسپرینت فعال است. {sprint.taskCount ? `این اسپرینت ${sprint.taskCount.toLocaleString('fa-IR')} وظیفه دارد.` : 'این اسپرینت هنوز وظیفه‌ای ندارد.'}</p>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="شروع اسپرینت" busyLabel="در حال شروع..." />
      </form>
    </Shell>
  )
}

/** End an active sprint; unfinished tasks go to the backlog or to another sprint. */
export function CompleteSprintDialog({ sprint, sprints, onClose, onDone }) {
  const targets = sprints.filter((entry) => entry.id !== sprint.id && sprintStatusOf(entry.status).value !== 2)
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    const result = await pmApi.agile.sprints.complete(sprint.id, target || null)
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    const done = unwrap(result)
    onDone(`${sprint.name} تمام شد: ${(done?.completedTasks ?? 0).toLocaleString('fa-IR')} وظیفه تکمیل‌شده و ${(done?.carriedOverTasks ?? 0).toLocaleString('fa-IR')} وظیفه منتقل شد.`)
  }
  return (
    <Shell title={`پایان ${sprint.name}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>وظایف تمام‌شده در همین اسپرینت می‌مانند. وظایف ناتمام (اگر باشد) به مقصد زیر می‌روند. بعد از پایان، اسپرینت دیگر تغییر نمی‌کند.</p>
          <Field label="وظایف ناتمام به..." wide><select value={target} onChange={(e) => { setTarget(e.target.value); setError('') }}><option value="">بک‌لاگ</option>{targets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} ({sprintStatusOf(entry.status).label})</option>)}</select></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="پایان اسپرینت" busyLabel="در حال پایان..." />
      </form>
    </Shell>
  )
}

/** The tasks of one sprint: remove some, or add from the backlog (not for a finished sprint). */
export function SprintTasksDialog({ project, sprint, data, perms, onClose, onChanged }) {
  const finished = sprintStatusOf(sprint.status).value === 2
  const tasks = useLoader(() => pmApi.agile.tasks.list(project.id, sprint.number), `${project.id}:${sprint.number}`, true, { list: true, explain: explainTaskError })
  const backlog = useLoader(() => pmApi.agile.backlog(project.id), project.id, !finished && perms.manageSprints, { explain: explainTaskError })
  const [pick, setPick] = useState(() => new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const cards = useMemo(() => backlog.value?.cards || [], [backlog.value])
  const refresh = () => { tasks.reload(); backlog.reload(); onChanged() }

  async function remove(task) {
    setBusy(true); setError('')
    const result = await pmApi.agile.sprints.removeTask(sprint.id, task.id)
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    refresh()
  }
  async function add() {
    setBusy(true); setError('')
    const result = await pmApi.agile.sprints.assignTasks(sprint.id, [...pick])
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    setPick(new Set()); refresh()
  }

  return (
    <Shell title={`وظایف ${sprint.name}`} subtitle={sprintStatusOf(sprint.status).label} wide onClose={onClose} busy={busy}>
      <div className="ue-body">
        {tasks.loading && !tasks.value.length ? <p className="data-state">در حال دریافت...</p> : !tasks.value.length ? <p className="data-state">این اسپرینت هنوز وظیفه‌ای ندارد.</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 640 }}>
            <thead><tr><th>وظیفه</th><th>وضعیت</th><th>اولویت</th><th>امتیاز</th><th>مسئول</th>{!finished && perms.manageSprints && <th />}</tr></thead>
            <tbody>{tasks.value.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.title}</strong></td>
                <td><span className={`status-pill ${statusOf(task.status).tone}`}>{statusOf(task.status).label}</span></td>
                <td><span className={`priority ${priorityOf(task.priority).tone}`}>{priorityOf(task.priority).label}</span></td>
                <td>{task.storyPoints ?? '—'}</td>
                <td>{task.responsibleUserId ? data.userName(task.responsibleUserId) : '—'}</td>
                {!finished && perms.manageSprints && <td><div className="row-actions"><button type="button" className="danger" title="برداشتن از اسپرینت" aria-label={`برداشتن ${task.title}`} disabled={busy} onClick={() => remove(task)}><Trash2 size={15} /></button></div></td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {!finished && perms.manageSprints && (
          <>
            <h4 className="bl-subtitle">افزودن از بک‌لاگ</h4>
            {!cards.length ? <p className="data-state">بک‌لاگ خالی است.</p> : (
              <ul className="tk-pick">{cards.map((card) => (
                <li key={card.id}><label><input type="checkbox" checked={pick.has(card.id)} onChange={() => setPick((current) => { const next = new Set(current); next.has(card.id) ? next.delete(card.id) : next.add(card.id); return next })} /><span>{card.title}</span></label><small>{card.storyPoints ?? '—'} امتیاز</small></li>
              ))}</ul>
            )}
            <div className="tk-add"><button type="button" className="bl-button sch-primary" onClick={add} disabled={busy || !pick.size}>افزودن {pick.size ? `(${pick.size.toLocaleString('fa-IR')})` : ''}</button></div>
          </>
        )}
        {error && <span className="ue-error" role="alert">{error}</span>}
      </div>
      <footer className="ue-foot"><div className="ue-foot-actions"><button className="ue-cancel" type="button" onClick={onClose}>بستن</button></div></footer>
    </Shell>
  )
}
