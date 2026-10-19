import { useState } from 'react'
import { ListTodo, Pencil, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../../project-management/pmApi'
import { CompleteSprintDialog, SprintFormDialog, SprintTasksDialog, StartSprintDialog } from './SprintDialogs'
import { explainTaskError, fmt, sprintStatusOf, taskPerms, toTaskOutcome } from '../taskModel'

/** اسپرینت‌ها: create, edit, start, complete and delete sprints, and see what each holds. */
export default function SprintsTab({ project, data, sprints, loading, error, say, onChanged, reload }) {
  const { can } = useAuth()
  const perms = taskPerms(can)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [dialog, setDialog] = useState(null) // { kind, sprint? }
  const hasActive = sprints.some((sprint) => sprintStatusOf(sprint.status).value === 1)
  const done = (text) => { setDialog(null); say('success', text); onChanged() }

  function askDelete(sprint) {
    confirm({
      title: 'حذف اسپرینت', message: `${sprint.name} حذف می‌شود. فقط اسپرینت برنامه‌ریزی‌شده‌ی بدون وظیفه حذف می‌شود.`, confirmLabel: 'حذف اسپرینت', danger: true,
      run: async () => {
        const outcome = toTaskOutcome(await pmApi.agile.sprints.remove(sprint.id))
        if (outcome.ok) { say('success', 'اسپرینت حذف شد.'); onChanged() }
        return outcome
      },
    })
  }

  if (!perms.view) return <p className="data-state">برای مشاهده‌ی اسپرینت‌ها به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>اسپرینت‌های پروژه؛ در هر پروژه هم‌زمان یک اسپرینت فعال است و اسپرینت تمام‌شده بخشی از تاریخچه می‌ماند.</p>
        {perms.manageSprints && <button type="button" className="sch-primary" onClick={() => setDialog({ kind: 'form' })}><Plus size={16} />ساخت اسپرینت</button>}
      </div>
      {loading && !sprints.length ? <p className="data-state">در حال دریافت اسپرینت‌ها...</p>
        : error ? <p className="data-state data-state--error">{error} <button type="button" className="prj-clear" onClick={reload}>تلاش دوباره</button></p>
        : !sprints.length ? <p className="data-state">برای این پروژه هنوز اسپرینتی ساخته نشده است.{perms.manageSprints ? ' با «ساخت اسپرینت» شروع کنید.' : ''}</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 900 }}>
            <thead><tr><th>#</th><th>اسپرینت</th><th>وضعیت</th><th>بازه</th><th>وظایف</th><th>پیشرفت (امتیاز)</th><th>عملیات</th></tr></thead>
            <tbody>{sprints.map((sprint) => {
              const status = sprintStatusOf(sprint.status)
              const percent = sprint.totalPoints ? Math.round((sprint.donePoints / sprint.totalPoints) * 100) : 0
              return (
                <tr key={sprint.id}>
                  <td>{sprint.number.toLocaleString('fa-IR')}</td>
                  <td><strong>{sprint.name}</strong>{sprint.goal && <small className="bl-note" title={sprint.goal}>{sprint.goal}</small>}</td>
                  <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                  <td className="sch-date">{sprint.startDate ? formatJalali(sprint.startDate) : '—'} تا {sprint.endDate ? formatJalali(sprint.endDate) : '—'}</td>
                  <td>{sprint.taskCount.toLocaleString('fa-IR')}</td>
                  <td>{sprint.totalPoints ? <div className="prj-progress" title={`${fmt(sprint.donePoints, 0)} از ${fmt(sprint.totalPoints, 0)} امتیاز`}><span><i className="actual" style={{ width: `${percent}%` }} /></span><small>{fmt(sprint.donePoints, 0)} از {fmt(sprint.totalPoints, 0)}</small></div> : '—'}</td>
                  <td><div className="row-actions">
                    <button type="button" title="وظایف اسپرینت" aria-label={`وظایف ${sprint.name}`} onClick={() => setDialog({ kind: 'tasks', sprint })}><ListTodo size={15} /></button>
                    {perms.manageSprints && status.value === 0 && <button type="button" title="شروع" aria-label={`شروع ${sprint.name}`} disabled={hasActive} onClick={() => setDialog({ kind: 'start', sprint })}><Play size={15} /></button>}
                    {perms.manageSprints && status.value === 1 && <button type="button" title="پایان اسپرینت" aria-label={`پایان ${sprint.name}`} onClick={() => setDialog({ kind: 'complete', sprint })}><Square size={15} /></button>}
                    {perms.manageSprints && status.value !== 2 && <button type="button" title="ویرایش" aria-label={`ویرایش ${sprint.name}`} onClick={() => setDialog({ kind: 'form', sprint })}><Pencil size={15} /></button>}
                    {perms.manageSprints && status.value === 0 && <button type="button" className="danger" title="حذف" aria-label={`حذف ${sprint.name}`} onClick={() => askDelete(sprint)}><Trash2 size={15} /></button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {hasActive && perms.manageSprints && <p className="docs-hint">شروع اسپرینت‌های دیگر تا پایان اسپرینت فعال غیرفعال است.</p>}
      {dialog?.kind === 'form' && <SprintFormDialog project={project} data={data} sprint={dialog.sprint} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'start' && <StartSprintDialog sprint={dialog.sprint} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'complete' && <CompleteSprintDialog sprint={dialog.sprint} sprints={sprints} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'tasks' && <SprintTasksDialog project={project} sprint={dialog.sprint} data={data} perms={perms} onClose={() => setDialog(null)} onChanged={onChanged} />}
      {confirmDialog}
    </>
  )
}
