import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../../project-management/pmApi'
import { useLoader } from '../../project-management/useLoader'
import { explainTaskError, priorityOf, sprintStatusOf, taskPerms } from '../taskModel'

/** بک‌لاگ: the tasks that are in no sprint and not done (GET .../agile/backlog), with estimates and a way to plan them into a sprint. */
export default function BacklogTab({ project, data, sprints, say, onChanged, onOpenTask, onCreate, reloadKey }) {
  const { can } = useAuth()
  const perms = taskPerms(can)
  const backlog = useLoader(() => pmApi.agile.backlog(project.id), `${project.id}:${reloadKey}`, perms.view, { explain: explainTaskError })
  const [selected, setSelected] = useState(() => new Set())
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const cards = backlog.value?.cards || []
  const planable = sprints.filter((sprint) => sprintStatusOf(sprint.status).value !== 2)
  const toggle = (id) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })

  async function estimate(card, raw) {
    const value = raw === '' ? null : Number(raw)
    if (value === (card.storyPoints ?? null)) return
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > 1000)) { say('error', 'امتیاز باید عدد صحیح بین ۰ و ۱۰۰۰ باشد.'); backlog.reload(); return }
    const result = await pmApi.agile.tasks.estimate(card.id, value)
    if (!result.isSuccess) { say('error', explainTaskError(result)); backlog.reload(); return }
    backlog.reload()
  }

  async function plan() {
    if (!target) { say('error', 'اسپرینت مقصد را انتخاب کنید.'); return }
    setBusy(true)
    const result = await pmApi.agile.sprints.assignTasks(target, [...selected])
    setBusy(false)
    if (!result.isSuccess) { say('error', explainTaskError(result)); return }
    say('success', `${selected.size.toLocaleString('fa-IR')} وظیفه به اسپرینت اضافه شد.`)
    setSelected(new Set()); onChanged()
  }

  if (!perms.view) return <p className="data-state">برای مشاهده‌ی بک‌لاگ به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>وظایفِ بدون اسپرینت و ناتمام. امتیاز بزنید و آن‌ها را برای اسپرینت برنامه‌ریزی کنید.</p>
        {perms.create && <button type="button" className="sch-primary" onClick={onCreate}><Plus size={16} />وظیفه‌ی جدید</button>}
      </div>
      {backlog.value && (
        <div className="bl-cards">
          <article><small>وظایف بک‌لاگ</small><strong>{cards.length.toLocaleString('fa-IR')}</strong></article>
          <article><small>جمع امتیاز</small><strong>{(backlog.value.totalPoints ?? 0).toLocaleString('fa-IR')}</strong></article>
          <article><small>بدون امتیاز</small><strong className={backlog.value.unestimatedCount ? 'bl-var late' : ''}>{(backlog.value.unestimatedCount ?? 0).toLocaleString('fa-IR')}</strong><span>پیش از برنامه‌ریزی تخمین بزنید</span></article>
        </div>
      )}
      {perms.manageSprints && selected.size > 0 && (
        <div className="tk-bulk"><span>{selected.size.toLocaleString('fa-IR')} وظیفه انتخاب شده</span>
          <select aria-label="اسپرینت مقصد" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">افزودن به اسپرینت...</option>{planable.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprintStatusOf(sprint.status).label})</option>)}</select>
          <button type="button" className="bl-button sch-primary" onClick={plan} disabled={busy || !target}>افزودن</button>
          <button type="button" className="prj-clear" onClick={() => setSelected(new Set())}>لغو انتخاب</button>
        </div>
      )}
      {backlog.loading && !backlog.value ? <p className="data-state">در حال دریافت بک‌لاگ...</p>
        : backlog.error ? <p className="data-state data-state--error">{backlog.error} <button type="button" className="prj-clear" onClick={backlog.reload}>تلاش دوباره</button></p>
        : !cards.length ? <p className="data-state">بک‌لاگ خالی است؛ همه‌ی وظایف یا در اسپرینت‌اند یا تمام شده‌اند.</p> : (
          <div className="table-scroll"><table className="users-table bl-table tk-backlog" style={{ minWidth: 760 }}>
            <thead><tr>{perms.manageSprints && sprints.length > 0 && <th />}<th>وظیفه</th><th>اولویت</th><th>امتیاز</th><th>مسئول</th><th>موعد</th></tr></thead>
            <tbody>{cards.map((card) => (
              <tr key={card.id}>
                {perms.manageSprints && sprints.length > 0 && <td><input type="checkbox" aria-label={`انتخاب ${card.title}`} checked={selected.has(card.id)} onChange={() => toggle(card.id)} /></td>}
                <td><button type="button" className="tk-title" onClick={() => onOpenTask(card.id)}>{card.title}</button></td>
                <td><span className={`priority ${priorityOf(card.priority).tone}`}>{priorityOf(card.priority).label}</span></td>
                <td>{perms.edit ? <input className="tk-estimate" type="number" min="0" max="1000" step="1" aria-label={`امتیاز ${card.title}`} defaultValue={card.storyPoints ?? ''} key={`${card.id}:${card.storyPoints}`} onBlur={(e) => estimate(card, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} /> : (card.storyPoints ?? '—')}</td>
                <td>{card.responsibleUserId ? data.userName(card.responsibleUserId) : '—'}</td>
                <td className="sch-date">{card.dueDate ? formatJalali(card.dueDate) : '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
    </>
  )
}
