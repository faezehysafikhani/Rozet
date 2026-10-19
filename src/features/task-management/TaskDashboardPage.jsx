import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Clock3, ListTodo, Plus, TriangleAlert, UserRound } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { formatJalali, todayIso } from '../../utils/jalali'
import TaskDialog from './TaskDialog'
import { fmt, isDone, isOverdue, priorityOf, statusOf, taskPerms } from './taskModel'
import { delegationsByTask } from './taskModel'
import { useTaskExtras, useTasksOfProjects } from './useTasks'
import './tasks.css'

/** داشبورد وظایف: counts, progress per project, workload per person, the tasks closest to their due date and the user's own hand-overs. */
export default function TaskDashboardPage({ data }) {
  const { can, user } = useAuth()
  const perms = taskPerms(can)
  const today = todayIso()
  const [projectId, setProjectId] = useState('')
  const [dialogState, setDialogState] = useState(null)
  const projects = data.projects
  const { tasks: all, loading, error, reload } = useTasksOfProjects(projects, perms.view)
  const extras = useTaskExtras(projects, perms)
  const tasks = useMemo(() => all.filter((task) => !projectId || task.projectId === projectId), [all, projectId])
  const open = tasks.filter((task) => !isDone(task))
  const counts = {
    total: tasks.length,
    doing: tasks.filter((task) => statusOf(task.status).value === 1).length,
    review: tasks.filter((task) => statusOf(task.status).value === 3).length,
    done: tasks.filter(isDone).length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    mine: open.filter((task) => task.responsibleUserId === user?.id).length,
  }

  const perProject = useMemo(() => projects.map((project) => {
    const mine = all.filter((task) => task.projectId === project.id)
    const done = mine.filter(isDone).length
    return { project, total: mine.length, done, overdue: mine.filter((task) => isOverdue(task, today)).length }
  }).filter((row) => row.total).sort((a, b) => b.total - a.total).slice(0, 8), [projects, all, today])

  const workload = useMemo(() => {
    const map = {}
    open.forEach((task) => { const key = task.responsibleUserId || ''; (map[key] ||= { open: 0, overdue: 0 }).open += 1; if (isOverdue(task, today)) map[key].overdue += 1 })
    return Object.entries(map).map(([id, value]) => ({ id, name: id ? data.userName(id) : 'بدون مسئول', ...value })).sort((a, b) => b.open - a.open).slice(0, 8)
  }, [open, today, data])

  const upcoming = useMemo(() => [...open].filter((task) => task.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8), [open])
  const given = extras.delegations.filter((item) => item.delegatorUserId === user?.id)
  const received = extras.delegations.filter((item) => item.delegateUserId === user?.id)
  const taskById = useMemo(() => Object.fromEntries(all.map((task) => [task.id, task])), [all])
  const changed = () => { reload(); extras.reload(); data.refresh() }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / داشبورد وظایف</span><h1>داشبورد وظایف</h1><p>نمای کلی وظایف چابک پروژه‌ها</p></div>
        <div className="task-head-actions">
          {projects.length > 0 && <select className="project-selector" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="پروژه"><option value="">همه‌ی پروژه‌ها</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
          {perms.create && projects.length > 0 && <button type="button" onClick={() => setDialogState({})}><Plus size={18} />ایجاد وظیفه جدید</button>}
        </div>
      </div>

      {!perms.view ? <section className="task-panel"><p className="data-state">برای مشاهده‌ی وظایف به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p></section>
        : (data.loading && !data.projects.length) || (loading && !all.length) ? <section className="task-panel"><p className="data-state">در حال دریافت وظایف...</p></section>
        : error ? <section className="task-panel"><p className="data-state data-state--error">{error} <button type="button" className="prj-clear" onClick={reload}>تلاش دوباره</button></p></section>
        : !projects.length ? <section className="task-panel"><p className="data-state">هنوز پروژه‌ای نیست؛ وظایف به پروژه تعلق دارند.</p></section> : (
          <>
            <div className="task-kpis tk-kpis">
              <article><span className="task-kpi-icon navy"><ListTodo size={21} /></span><div><small>کل وظایف</small><strong>{counts.total.toLocaleString('fa-IR')}</strong><p>{counts.mine.toLocaleString('fa-IR')} باز به نام شما</p></div></article>
              <article><span className="task-kpi-icon blue"><Clock3 size={21} /></span><div><small>در حال انجام</small><strong>{counts.doing.toLocaleString('fa-IR')}</strong><p>{counts.review.toLocaleString('fa-IR')} نیازمند بررسی</p></div></article>
              <article><span className="task-kpi-icon green"><CheckCircle2 size={21} /></span><div><small>تکمیل شده</small><strong>{counts.done.toLocaleString('fa-IR')}</strong><p>{counts.total ? fmt((counts.done / counts.total) * 100, 0) : '۰'}٪ از کل</p></div></article>
              <article><span className="task-kpi-icon red"><TriangleAlert size={21} /></span><div><small>معوق</small><strong>{counts.overdue.toLocaleString('fa-IR')}</strong><p>موعد گذشته و ناتمام</p></div></article>
            </div>

            <div className="task-dashboard-grid">
              <section className="task-panel project-progress">
                <div className="task-panel-title"><div><h3>پیشرفت وظایف پروژه‌ها</h3><p>سهم وظایف تکمیل‌شده از کل، به تفکیک پروژه</p></div></div>
                {perProject.length ? perProject.map(({ project, total, done, overdue }) => {
                  const percent = Math.round((done / total) * 100)
                  return <div className="progress-row" key={project.id}><div><strong>{project.name}</strong><span>{done.toLocaleString('fa-IR')} از {total.toLocaleString('fa-IR')} وظیفه{overdue ? ` · ${overdue.toLocaleString('fa-IR')} معوق` : ''}</span></div><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><em>{percent.toLocaleString('fa-IR')}٪</em></div>
                }) : <p className="data-state">هنوز وظیفه‌ای برای پروژه‌ها ثبت نشده است.</p>}
              </section>
              <section className="task-panel workload-panel">
                <div className="task-panel-title"><div><h3>توزیع حجم کار</h3><p>وظایف باز هر مسئول</p></div></div>
                {workload.length ? workload.map((row) => (
                  <div className="workload-row" key={row.id || 'none'}><span className="mini-avatar tone-0">{row.name.slice(0, 1)}</span><div><strong>{row.name}</strong>{row.overdue > 0 && <small className="tk-late">{row.overdue.toLocaleString('fa-IR')} معوق</small>}</div><b>{row.open.toLocaleString('fa-IR')} وظیفه</b></div>
                )) : <p className="data-state">وظیفه‌ی بازی نیست.</p>}
              </section>
            </div>

            <section className="task-panel task-table-panel">
              <div className="task-panel-title"><div><h3>وظایف نزدیک به موعد</h3><p>ناتمام‌ها به ترتیب موعد؛ معوق‌ها اول می‌آیند</p></div></div>
              {!upcoming.length ? <p className="data-state">وظیفه‌ی بازِ دارای موعد نیست.</p> : (
                <div className="table-scroll"><table className="users-table tk-table" style={{ minWidth: 760 }}>
                  <thead><tr><th>عنوان</th><th>پروژه</th><th>مسئول</th><th>موعد</th><th>اولویت</th><th>وضعیت</th></tr></thead>
                  <tbody>{upcoming.map((task) => {
                    const late = isOverdue(task, today)
                    return (
                      <tr key={task.id} className="tk-click" onClick={() => setDialogState({ task })}>
                        <td><strong>{task.title}</strong></td><td>{task.projectName}</td><td>{task.responsibleUserId ? data.userName(task.responsibleUserId) : '—'}</td>
                        <td className={`sch-date ${late ? 'tk-late' : ''}`}>{formatJalali(task.dueDate)}{late && <small className="bl-note tk-late">معوق</small>}</td>
                        <td><span className={`priority ${priorityOf(task.priority).tone}`}>{priorityOf(task.priority).label}</span></td>
                        <td><span className={`status-pill ${statusOf(task.status).tone}`}>{statusOf(task.status).label}</span></td>
                      </tr>
                    )
                  })}</tbody>
                </table></div>
              )}
            </section>

            {(perms.viewDelegations || given.length > 0 || received.length > 0) && (
              <section className="task-panel">
                <div className="task-panel-title"><div><h3>ارجاع‌های فعال من</h3><p>کارهایی که به دیگری سپرده‌اید یا به شما سپرده شده است</p></div></div>
                {!given.length && !received.length ? <p className="data-state">ارجاع فعالی ندارید.</p> : (
                  <ul className="tk-delegations">
                    {[...received.map((item) => ({ item, text: `از ${data.userName(item.delegatorUserId)} به شما`, tone: 'doing' })), ...given.map((item) => ({ item, text: `از شما به ${data.userName(item.delegateUserId)}`, tone: 'todo' }))].filter(({ item }) => item.itemType === 1 || item.itemType === 'AgileTask').map(({ item, text, tone }) => (
                      <li key={item.id}><UserRound size={15} /><strong>{taskById[item.itemId]?.title || 'وظیفه‌ی حذف‌شده'}</strong><span className={`status-pill ${tone}`}>{text}</span>{taskById[item.itemId] && <button type="button" onClick={() => setDialogState({ task: taskById[item.itemId] })}>جزئیات</button>}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

      {dialogState && (
        <TaskDialog task={dialogState.task} projects={projects} project={projectId ? projects.find((p) => p.id === projectId) : undefined} data={data} perms={perms} myDelegations={extras.delegations}
          onClose={() => setDialogState(null)} onChanged={changed} onDone={() => { setDialogState(null); changed() }} />
      )}
    </>
  )
}
