import { useEffect, useMemo, useState } from 'react'
import { Plus, Send, Trash2, UserRoundPlus, Undo2 } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import JalaliDateInput from '../../components/JalaliDateInput'
import { Field, Footer, Shell } from '../project-management/DialogParts'
import { approvalOf } from '../project-management/documents/documentUtils'
import { listOf, pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import { PRIORITIES, delegateTask, explainTaskError, priorityOf, sprintStatusOf, taskPayload, takeBackTask } from './taskModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

function Checklist({ task, canEdit }) {
  const list = useLoader(() => pmApi.agile.tasks.checklist.list(task.id), task.id, true, { list: true, explain: explainTaskError })
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const items = [...list.value].sort((a, b) => a.order - b.order)
  const done = items.filter((item) => item.isDone).length

  async function run(call) {
    setBusy(true); setError('')
    const result = await call()
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return false }
    list.reload()
    return true
  }
  async function add() {
    if (!text.trim()) return
    if (await run(() => pmApi.agile.tasks.checklist.add(task.id, text.trim()))) setText('')
  }

  return (
    <div className="tk-checklist" style={{ gridColumn: '1 / -1' }}>
      <div className="tk-section-head"><strong>چک‌لیست</strong>{items.length > 0 && <small>{done.toLocaleString('fa-IR')} از {items.length.toLocaleString('fa-IR')} انجام شده</small>}</div>
      {list.loading && !items.length ? <small>در حال دریافت...</small> : list.error ? <small className="ue-error">{list.error}</small>
        : !items.length ? <small>موردی ثبت نشده است.</small> : (
          <ul>{items.map((item) => (
            <li key={item.id} className={item.isDone ? 'done' : ''}>
              <label><input type="checkbox" checked={item.isDone} disabled={!canEdit || busy} onChange={(e) => run(() => pmApi.agile.tasks.checklist.update(task.id, item.id, { text: item.text, isDone: e.target.checked }))} /><span>{item.text}</span></label>
              {canEdit && <button type="button" title="حذف مورد" aria-label="حذف مورد" disabled={busy} onClick={() => run(() => pmApi.agile.tasks.checklist.remove(task.id, item.id))}><Trash2 size={14} /></button>}
            </li>
          ))}</ul>
        )}
      {canEdit && <div className="tk-add"><input value={text} maxLength={500} placeholder="مورد تازه..." onChange={(e) => { setText(e.target.value); setError('') }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} /><button type="button" onClick={add} disabled={busy || !text.trim()}><Plus size={14} />افزودن</button></div>}
      {error && <span className="ue-error" role="alert">{error}</span>}
    </div>
  )
}

/** Hand the task to someone else, or take a hand-over back. */
function Delegation({ task, data, perms, myDelegations, onChanged }) {
  const { user } = useAuth()
  const mine = (myDelegations || []).filter((item) => item.delegatorUserId === user?.id)
  const received = (myDelegations || []).filter((item) => item.delegateUserId === user?.id)
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function give() {
    if (!target) { setError('شخص مقصد را انتخاب کنید.'); return }
    setBusy(true); setError(''); setNotice('')
    const outcome = await delegateTask({ task, toUserId: target, tenantId: data.tenantId })
    setBusy(false)
    if (!outcome.ok) { setError(outcome.error); onChanged(); return }
    setNotice(`وظیفه به ${data.userName(target)} ارجاع شد.`); setTarget(''); onChanged()
  }
  async function back(delegation) {
    setBusy(true); setError(''); setNotice('')
    const outcome = await takeBackTask({ task, delegation })
    setBusy(false)
    if (!outcome.ok) { setError(outcome.error); onChanged(); return }
    setNotice('ارجاع پایان یافت و وظیفه برگشت.'); onChanged()
  }

  return (
    <div className="tk-delegation" style={{ gridColumn: '1 / -1' }}>
      <div className="tk-section-head"><strong>ارجاع</strong></div>
      {mine.map((item) => <p key={item.id}><UserRoundPlus size={14} />شما این وظیفه را به {data.userName(item.delegateUserId)} ارجاع داده‌اید.<button type="button" disabled={busy} onClick={() => back(item)}><Undo2 size={13} />پس گرفتن</button></p>)}
      {received.map((item) => <p key={item.id}><UserRoundPlus size={14} />این وظیفه از طرف {data.userName(item.delegatorUserId)} به شما ارجاع شده است.</p>)}
      {perms.delegate && perms.edit && (
        <div className="tk-add">
          <select value={target} onChange={(e) => { setTarget(e.target.value); setError('') }} aria-label="ارجاع به"><option value="">ارجاع به...</option>{data.users.filter((u) => u.id !== user?.id).map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select>
          <button type="button" onClick={give} disabled={busy || !target}><Send size={14} />ارجاع</button>
        </div>
      )}
      {notice && <small className="tk-ok">{notice}</small>}
      {error && <span className="ue-error" role="alert">{error}</span>}
    </div>
  )
}

/**
 * Create or edit an agile task: title, people, due date, priority, sprint and estimate; when editing also the checklist,
 * the approval of the task and hand-over (ارجاع). `projects` is offered only when creating without a fixed project.
 */
export default function TaskDialog({ task, project, projects, data, perms, myDelegations, defaultSprintNumber, onClose, onDone, onChanged }) {
  const creating = !task
  const [projectId, setProjectId] = useState(task?.projectId || project?.id || '')
  const [form, setForm] = useState(() => ({
    title: task?.title || '', description: task?.description || '', responsibleUserId: task?.responsibleUserId || '', approverUserId: task?.approverUserId || '',
    dueDate: task?.dueDate || '', priority: priorityOf(task?.priority ?? 1).value, sprintNumber: task?.sprintNumber ?? defaultSprintNumber ?? '', storyPoints: task?.storyPoints ?? '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const sprints = useLoader(() => pmApi.agile.sprints.list(projectId), projectId, Boolean(projectId), { list: true, explain: explainTaskError })
  const canEdit = creating ? perms.create : perms.edit
  const approval = approvalOf(task?.approvalStatus)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const sprintOptions = useMemo(() => sprints.value.filter((sprint) => sprintStatusOf(sprint.status).value !== 2 || sprint.number === task?.sprintNumber), [sprints.value, task])
  const projectName = (projects || []).find((item) => item.id === projectId)?.name || project?.name || task?.projectName || ''

  async function submit(event) {
    event.preventDefault()
    if (!projectId) { setError('پروژه را انتخاب کنید.'); return }
    if (!form.title.trim()) { setError('عنوان وظیفه را وارد کنید.'); return }
    if (form.storyPoints !== '' && (!Number.isInteger(Number(form.storyPoints)) || Number(form.storyPoints) < 0 || Number(form.storyPoints) > 1000)) { setError('امتیاز باید عدد صحیح بین ۰ و ۱۰۰۰ باشد.'); return }
    setBusy(true)
    const body = {
      title: form.title.trim(), description: orNull(form.description), responsibleUserId: orNull(form.responsibleUserId), approverUserId: orNull(form.approverUserId),
      dueDate: orNull(form.dueDate), priority: Number(form.priority), sprintNumber: form.sprintNumber === '' ? null : Number(form.sprintNumber),
    }
    const points = form.storyPoints === '' ? null : Number(form.storyPoints)
    const result = creating
      ? await pmApi.agile.tasks.create({ ...body, tenantId: data.tenantId, projectId, storyPoints: points })
      : await pmApi.agile.tasks.update(task.id, { ...body, storyPoints: points })
    if (!result.isSuccess) { setBusy(false); setError(explainTaskError(result)); return }
    // An update that leaves the estimate out keeps it, so clearing one is a call of its own.
    if (!creating && points === null && task.storyPoints !== null && task.storyPoints !== undefined) {
      const cleared = await pmApi.agile.tasks.estimate(task.id, null)
      if (!cleared.isSuccess) { setBusy(false); setError(`وظیفه ذخیره شد ولی برداشتن امتیاز ناموفق بود: ${explainTaskError(cleared)}`); return }
    }
    setBusy(false)
    onDone(creating ? `وظیفه‌ی «${body.title}» ایجاد شد.` : 'تغییرات وظیفه ذخیره شد.')
  }

  async function sendForApproval() {
    setBusy(true); setError('')
    const result = await pmApi.agile.tasks.submitForApproval(task.id)
    setBusy(false)
    if (!result.isSuccess) { setError(explainTaskError(result)); return }
    onDone(approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'وظیفه تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'وظیفه برای تأیید ارسال شد.')
  }

  return (
    <Shell title={creating ? 'ایجاد وظیفه' : 'ویرایش وظیفه'} subtitle={projectName} wide onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          {creating && !project && (
            <Field label="پروژه *" wide><select value={projectId} onChange={(e) => { setProjectId(e.target.value); set('sprintNumber', '') }}><option value="">انتخاب کنید...</option>{(projects || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
          )}
          <Field label="عنوان *" wide><input value={form.title} maxLength={200} onChange={(e) => set('title', e.target.value)} disabled={!canEdit} autoFocus /></Field>
          <Field label="مسئول"><select value={form.responsibleUserId} onChange={(e) => set('responsibleUserId', e.target.value)} disabled={!canEdit}><option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></Field>
          <Field label="تأییدکننده"><select value={form.approverUserId} onChange={(e) => set('approverUserId', e.target.value)} disabled={!canEdit}><option value="">انتخاب نشده</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></Field>
          <Field label="موعد انجام"><JalaliDateInput value={form.dueDate} onChange={(value) => set('dueDate', value)} disabled={!canEdit} yearsAhead={5} /></Field>
          <Field label="اولویت"><select value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} disabled={!canEdit}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
          <Field label="اسپرینت" hint={projectId && !sprints.loading && !sprintOptions.length ? 'اسپرینتی تعریف نشده؛ در «برد کانبان ← اسپرینت‌ها» بسازید.' : undefined}>
            <select value={form.sprintNumber} onChange={(e) => set('sprintNumber', e.target.value)} disabled={!canEdit}><option value="">بدون اسپرینت (بک‌لاگ)</option>{sprintOptions.map((sprint) => <option key={sprint.id} value={sprint.number}>{sprint.name} ({sprintStatusOf(sprint.status).label})</option>)}</select>
          </Field>
          <Field label="امتیاز (Story Points)"><input type="number" min="0" max="1000" step="1" value={form.storyPoints} onChange={(e) => set('storyPoints', e.target.value)} disabled={!canEdit} /></Field>
          <Field label="توضیحات" wide><textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => set('description', e.target.value)} disabled={!canEdit} /></Field>
          {!creating && (
            <>
              <div className="tk-approval" style={{ gridColumn: '1 / -1' }}>
                <span>تأیید وظیفه:</span><span className={`status-pill ${approval.tone}`}>{approval.label}</span>
                {perms.submit && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" onClick={sendForApproval} disabled={busy}><Send size={14} />ارسال برای تأیید</button>}
              </div>
              <Checklist task={task} canEdit={perms.edit} />
              {(perms.delegate || perms.viewDelegations) && <Delegation task={task} data={data} perms={perms} myDelegations={(myDelegations || []).filter((item) => item.itemId === task.id)} onChanged={onChanged} />}
            </>
          )}
        </div></div>
        {canEdit ? <Footer error={error} busy={busy} onClose={onClose} submitLabel={creating ? 'ایجاد وظیفه' : 'ذخیره تغییرات'} busyLabel="در حال ذخیره..." />
          : <footer className="ue-foot"><span className="ue-error">{error || 'برای ویرایش وظیفه دسترسی «ویرایش وظایف» لازم است.'}</span><div className="ue-foot-actions"><button className="ue-cancel" type="button" onClick={onClose}>بستن</button></div></footer>}
      </form>
    </Shell>
  )
}
