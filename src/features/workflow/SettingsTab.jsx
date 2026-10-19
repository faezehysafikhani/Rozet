import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import { PARTICIPANTS, blankStep, explainWorkflowError, groupOf, participantLabel, rowsToSteps, sameSteps, stepToRow, toWorkflowOutcome, validateRows } from './workflowModel'

function StepsView({ steps, data }) {
  if (!steps.length) return <p className="wf-none">بدون تأیید: موارد این گروه بعد از ارسال، مستقیماً تأیید می‌شوند.</p>
  return (
    <ol className="wf-chain">
      {steps.map((step, index) => (
        <li key={index}><b>{(index + 1).toLocaleString('fa-IR')}</b><strong>{step.name}</strong>
          <span>{step.approverUserId ? data.userName(step.approverUserId) : participantLabel(step.approverKey)}</span>
          {step.isOptional && <em className="bl-tag">اگر تأییدکننده نباشد، رد می‌شود</em>}
        </li>
      ))}
    </ol>
  )
}

function StepsEditor({ rows, setRows, data }) {
  const patch = (index, change) => setRows(rows.map((row, i) => (i === index ? { ...row, ...change } : row)))
  const move = (index, delta) => { const next = [...rows]; const [row] = next.splice(index, 1); next.splice(index + delta, 0, row); setRows(next) }
  return (
    <div className="wf-editor">
      {!rows.length && <p className="wf-none">هیچ مرحله‌ای نیست؛ با ذخیره، موارد این گروه بدون تأیید و مستقیم تأیید می‌شوند.</p>}
      {rows.map((row, index) => (
        <div className="wf-edit-row" key={index}>
          <b>{(index + 1).toLocaleString('fa-IR')}</b>
          <input value={row.name} maxLength={160} placeholder="نام مرحله (مثلاً تأیید نهایی)" aria-label={`نام مرحله ${index + 1}`} onChange={(e) => patch(index, { name: e.target.value })} />
          <select aria-label={`نوع تأییدکننده ${index + 1}`} value={row.kind} onChange={(e) => patch(index, { kind: e.target.value })}><option value="key">یک نقش</option><option value="user">یک نفر مشخص</option></select>
          {row.kind === 'key'
            ? <select aria-label={`نقش ${index + 1}`} value={row.approverKey} onChange={(e) => patch(index, { approverKey: e.target.value })}>{PARTICIPANTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
            : <select aria-label={`شخص ${index + 1}`} value={row.approverUserId} onChange={(e) => patch(index, { approverUserId: e.target.value })}><option value="">انتخاب کنید...</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select>}
          <label className="wf-optional" title="اگر آن نقش برای مورد مشخص نباشد، این مرحله رد می‌شود">
            <input type="checkbox" disabled={row.kind === 'user'} checked={row.kind === 'key' && row.isOptional} onChange={(e) => patch(index, { isOptional: e.target.checked })} />اختیاری
          </label>
          <span className="wf-edit-actions">
            <button type="button" aria-label="بالا" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button>
            <button type="button" aria-label="پایین" disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="danger" aria-label="حذف مرحله" onClick={() => setRows(rows.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
          </span>
        </div>
      ))}
      <button type="button" className="bl-button" onClick={() => setRows([...rows, blankStep()])}><Plus size={15} />افزودن مرحله</button>
    </div>
  )
}

function GroupCard({ group, project, canEdit, data, say, onSaved }) {
  const info = groupOf(group.key)
  const [rows, setRows] = useState(null) // null = not editing
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { confirm, dialog } = useConfirm()
  const scoped = Boolean(project)
  const editing = rows !== null

  const state = scoped
    ? (group.isCustom ? { label: 'قواعد اختصاصی این پروژه', tone: 'pending' } : { label: group.isConfigured ? 'طبق قواعد عمومی' : 'طبق قواعد عمومی (بدون تأیید)', tone: 'muted' })
    : { label: group.isConfigured ? (group.steps.length ? 'تعریف‌شده' : 'بدون تأیید') : 'تعریف نشده (بدون تأیید)', tone: group.isConfigured && group.steps.length ? 'success' : 'muted' }

  async function save(steps, message) {
    setBusy(true); setError('')
    const result = scoped ? await pmApi.workflow.settings.saveProject(project.id, group.key, steps) : await pmApi.workflow.settings.saveGeneral(group.key, steps)
    setBusy(false)
    if (!result.isSuccess) { setError(explainWorkflowError(result)); return }
    setRows(null); say('success', message); onSaved()
  }

  function submit() {
    const problem = validateRows(rows)
    if (problem) { setError(problem); return }
    if (group.isConfigured && sameSteps(rows, group.steps.map(stepToRow))) { setRows(null); return }
    save(rowsToSteps(rows), `زنجیره‌ی تأیید «${info.label}» ذخیره شد. درخواست‌هایی که از قبل ارسال شده‌اند با زنجیره‌ی قبلی ادامه می‌دهند.`)
  }

  function askStandard() {
    confirm({
      title: 'بازگشت به تنظیم استاندارد', confirmLabel: 'اعمال تنظیم استاندارد',
      message: `زنجیره‌ی «${info.label}» با مراحل استاندارد جایگزین می‌شود: ${group.defaultSteps.map((step) => `${step.name} (${participantLabel(step.approverKey)})`).join('، ')}.`,
      run: async () => {
        const result = await pmApi.workflow.settings.saveGeneral(group.key, null)
        if (result.isSuccess) { setRows(null); say('success', `زنجیره‌ی «${info.label}» استاندارد شد.`); onSaved() }
        return toWorkflowOutcome(result)
      },
    })
  }

  function askReset() {
    confirm({
      title: 'بازگشت به قواعد عمومی', confirmLabel: 'بازگشت', message: `قواعد اختصاصی «${info.label}» در «${project.name}» حذف می‌شود و این پروژه دوباره از قواعد عمومی پیروی می‌کند.`,
      run: async () => {
        const result = await pmApi.workflow.settings.resetProject(project.id, group.key)
        if (result.isSuccess) { setRows(null); say('success', 'پروژه دوباره از قواعد عمومی پیروی می‌کند.'); onSaved() }
        return toWorkflowOutcome(result)
      },
    })
  }

  return (
    <article className="wf-card" aria-label={info.label}>
      <header><div><h3>{info.label}</h3><small>{info.hint}</small></div><span className={`status-pill wf-${state.tone}`}>{state.label}</span></header>
      {editing ? <StepsEditor rows={rows} setRows={(next) => { setRows(next); setError('') }} data={data} /> : <StepsView steps={group.steps} data={data} />}
      {error && <p className="ue-error" role="alert">{error}</p>}
      {canEdit && (
        <footer>
          {editing ? (
            <>
              <button type="button" className="bl-button sch-primary" onClick={submit} disabled={busy}>{busy ? 'در حال ذخیره...' : 'ذخیره'}</button>
              <button type="button" className="bl-button" onClick={() => { setRows(null); setError('') }} disabled={busy}>انصراف</button>
            </>
          ) : (
            <>
              <button type="button" className="bl-button" onClick={() => setRows(group.steps.map(stepToRow))}>ویرایش زنجیره</button>
              {!scoped && <button type="button" className="bl-button" onClick={askStandard}>تنظیم استاندارد</button>}
              {scoped && group.isCustom && <button type="button" className="bl-button" onClick={askReset}>بازگشت به قواعد عمومی</button>}
            </>
          )}
        </footer>
      )}
      {dialog}
    </article>
  )
}

/** تنظیم زنجیره‌ی تأیید: who approves each kind of item - the general rules, or one project's own. */
export default function SettingsTab({ data, perms, say }) {
  const { user } = useAuth()
  const [projectId, setProjectId] = useState('')
  const settings = useLoader(() => pmApi.workflow.settings.get(projectId || undefined), `settings:${projectId}`, perms.view, { list: true, explain: explainWorkflowError })
  const { confirm, dialog } = useConfirm()
  const project = data.projects.find((item) => item.id === projectId) || null
  const canEdit = projectId
    ? perms.configureProjects || (project && (project.managerUserId === user?.id || project.ownerUserId === user?.id))
    : perms.configureProjects
  const groups = settings.value
  const nothingDefined = !projectId && groups.length > 0 && groups.every((group) => !group.isConfigured)

  function askDefaults() {
    confirm({
      title: 'اعمال تنظیمات استاندارد', confirmLabel: 'اعمال',
      message: 'برای هر گروهی که هنوز قاعده‌ای ندارد، زنجیره‌ی استاندارد ساخته می‌شود (معمولاً تأیید نهایی مدیر پروژه). گروه‌هایی که تنظیم شده‌اند دست‌نخورده می‌مانند.',
      run: async () => {
        const result = await pmApi.workflow.settings.applyDefaults()
        if (result.isSuccess) { say('success', 'تنظیمات استاندارد اعمال شد.'); settings.reload() }
        return toWorkflowOutcome(result)
      },
    })
  }

  return (
    <>
      <div className="tk-filters">
        <select aria-label="محدوده" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">قواعد عمومی (همه‌ی پروژه‌ها)</option>
          {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {!projectId && perms.configureProjects && <button type="button" className="bl-button" onClick={askDefaults}>اعمال تنظیمات استاندارد</button>}
      </div>
      <p className="docs-hint">هر نوع مورد یک زنجیره‌ی تأیید دارد. اگر زنجیره‌ای تعریف نشده باشد، موارد پس از ارسال برای تأیید مستقیماً تأیید می‌شوند. پروژه می‌تواند قواعد اختصاصی خودش را داشته باشد.
        {!canEdit && ' شما در این محدوده فقط می‌توانید قواعد را ببینید.'}</p>
      {nothingDefined && <div className="docs-notice error" role="status"><span>هنوز هیچ زنجیره‌ی تأییدی تعریف نشده است؛ همه‌ی موارد بدون تأیید و مستقیم تأیید می‌شوند.{perms.configureProjects ? ' «اعمال تنظیمات استاندارد» را بزنید.' : ''}</span></div>}
      {settings.error ? <p className="data-state data-state--error">{settings.error} <button type="button" className="prj-clear" onClick={settings.reload}>تلاش دوباره</button></p>
        : settings.loading && !groups.length ? <p className="data-state">در حال دریافت تنظیمات...</p> : (
          <div className="wf-cards">{groups.map((group) => <GroupCard key={`${projectId}:${group.key}`} group={group} project={project} canEdit={canEdit} data={data} say={say} onSaved={settings.reload} />)}</div>
        )}
      {dialog}
    </>
  )
}
