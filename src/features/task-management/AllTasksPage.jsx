import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Clock3, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import { formatJalali, todayIso } from '../../utils/jalali'
import { approvalOf } from '../project-management/documents/documentUtils'
import { pmApi } from '../project-management/pmApi'
import TaskDialog from './TaskDialog'
import { PRIORITIES, STATUSES, isDone, isOverdue, moveMessage, moveTask, priorityOf, statusOf, taskPerms, toTaskOutcome } from './taskModel'
import { delegationsByTask } from './taskModel'
import { useTaskExtras, useTasksOfProjects } from './useTasks'
import './tasks.css'

const PAGE_SIZE = 25
const SORTS = [
  { key: 'due', label: 'موعد (نزدیک‌ترین اول)' },
  { key: 'priority', label: 'اولویت (بالاترین اول)' },
  { key: 'status', label: 'وضعیت' },
  { key: 'title', label: 'عنوان' },
]

/** همه وظایف: the agile tasks of every project in one list, with filters, "my tasks", status change, approval, hand-over and delete. */
export default function AllTasksPage({ data }) {
  const { can, user } = useAuth()
  const perms = taskPerms(can)
  const today = todayIso()
  const projects = data.projects
  const { tasks, loading, error, reload } = useTasksOfProjects(projects, perms.view)
  const extras = useTaskExtras(projects, perms)
  const delegations = useMemo(() => delegationsByTask(extras.delegations), [extras.delegations])
  const { confirm, dialog } = useConfirm()
  const [filters, setFilters] = useState({ search: '', status: '', priority: '', projectId: '', responsibleUserId: '', mine: false, overdueOnly: false })
  const [sort, setSort] = useState('due')
  const [page, setPage] = useState(1)
  const [dialogState, setDialogState] = useState(null) // { task? }
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState('')
  const say = (type, text) => setNotice({ type, text })
  const set = (patch) => { setFilters((current) => ({ ...current, ...patch })); setPage(1) }
  const changed = () => { reload(); extras.reload(); data.refresh() }

  const shown = useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    const list = tasks.filter((task) => (!needle || `${task.title} ${task.projectName} ${data.userName(task.responsibleUserId)}`.toLowerCase().includes(needle))
      && (filters.status === '' || statusOf(task.status).value === Number(filters.status))
      && (filters.priority === '' || priorityOf(task.priority).value === Number(filters.priority))
      && (filters.projectId === '' || task.projectId === filters.projectId)
      && (filters.responsibleUserId === '' || task.responsibleUserId === filters.responsibleUserId)
      && (!filters.mine || task.responsibleUserId === user?.id)
      && (!filters.overdueOnly || isOverdue(task, today)))
    const order = {
      due: (a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')),
      priority: (a, b) => priorityOf(b.priority).value - priorityOf(a.priority).value || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')),
      status: (a, b) => STATUSES.findIndex((s) => s.value === statusOf(a.status).value) - STATUSES.findIndex((s) => s.value === statusOf(b.status).value),
      title: (a, b) => a.title.localeCompare(b.title, 'fa'),
    }[sort]
    return [...list].sort(order)
  }, [tasks, filters, sort, today, data, user])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const visible = shown.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE)
  const filtered = Object.values(filters).some(Boolean)

  async function changeStatus(task, status) {
    setBusyId(task.id); setNotice(null)
    const outcome = await moveTask({ task, status: Number(status), tenantId: data.tenantId, perms })
    setBusyId('')
    if (!outcome.ok) { say('error', outcome.error); return }
    say('success', moveMessage(task, Number(status), outcome))
    changed()
  }

  function askDelete(task) {
    confirm({
      title: 'حذف وظیفه', message: `«${task.title}» با چک‌لیستش برای همیشه حذف می‌شود.`, confirmLabel: 'حذف وظیفه', danger: true,
      run: async () => {
        const outcome = toTaskOutcome(await pmApi.agile.tasks.remove(task.id))
        if (outcome.ok) { say('success', 'وظیفه حذف شد.'); changed() }
        return outcome
      },
    })
  }

  function askSubmit(task) {
    confirm({
      title: 'ارسال برای تأیید', message: `«${task.title}» برای تأیید ارسال می‌شود. اگر زنجیره‌ی تأییدی تعریف نشده باشد مستقیماً تأیید می‌شود.`, confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.agile.tasks.submitForApproval(task.id)
        if (result.isSuccess) { say('success', approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'وظیفه تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'وظیفه برای تأیید ارسال شد.'); changed() }
        return toTaskOutcome(result)
      },
    })
  }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / همه وظایف</span><h1>همه وظایف</h1><p>وظایف چابک همه‌ی پروژه‌ها در یک فهرست</p></div>
        <div className="task-head-actions">
          {perms.create && projects.length > 0 && <button type="button" onClick={() => setDialogState({})}><Plus size={18} />ایجاد وظیفه جدید</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel">
        {!perms.view ? <p className="data-state">برای مشاهده‌ی وظایف به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p>
          : (data.loading && !data.projects.length) ? <p className="data-state">در حال دریافت پروژه‌ها...</p>
          : !projects.length ? <p className="data-state">هنوز پروژه‌ای نیست؛ وظایف به پروژه تعلق دارند.</p> : (
            <>
              <div className="tk-filters">
                <label className="docs-search"><Search size={16} /><input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="جست‌وجو در عنوان، پروژه و مسئول..." /></label>
                <select aria-label="پروژه" value={filters.projectId} onChange={(e) => set({ projectId: e.target.value })}><option value="">همه‌ی پروژه‌ها</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
                <select aria-label="وضعیت" value={filters.status} onChange={(e) => set({ status: e.target.value })}><option value="">همه‌ی وضعیت‌ها</option>{STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
                <select aria-label="اولویت" value={filters.priority} onChange={(e) => set({ priority: e.target.value })}><option value="">همه‌ی اولویت‌ها</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
                <select aria-label="مسئول" value={filters.responsibleUserId} onChange={(e) => set({ responsibleUserId: e.target.value })}><option value="">همه‌ی مسئولان</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select>
                <select aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
              </div>
              <div className="tk-chips">
                <button type="button" className={filters.mine ? 'active' : ''} onClick={() => set({ mine: !filters.mine })}>وظایف من</button>
                <button type="button" className={filters.overdueOnly ? 'active' : ''} onClick={() => set({ overdueOnly: !filters.overdueOnly })}>فقط معوق</button>
                {filtered && <button type="button" className="prj-clear" onClick={() => { setFilters({ search: '', status: '', priority: '', projectId: '', responsibleUserId: '', mine: false, overdueOnly: false }); setPage(1) }}>پاک کردن فیلترها</button>}
                <span className="docs-count">{shown.length.toLocaleString('fa-IR')} از {tasks.length.toLocaleString('fa-IR')} وظیفه</span>
              </div>

              {loading && !tasks.length ? <p className="data-state">در حال دریافت وظایف...</p>
                : error ? <p className="data-state data-state--error">{error} <button type="button" className="prj-clear" onClick={reload}>تلاش دوباره</button></p>
                : !tasks.length ? <p className="data-state">هنوز وظیفه‌ای ثبت نشده است.{perms.create ? ' با «ایجاد وظیفه جدید» شروع کنید.' : ''}</p>
                : !shown.length ? <p className="data-state">وظیفه‌ای با این فیلترها پیدا نشد.</p> : (
                  <>
                    <div className="table-scroll"><table className="users-table tk-table" style={{ minWidth: 1180 }}>
                      <thead><tr><th>عنوان</th><th>پروژه</th><th>مسئول</th><th>موعد</th><th>اولویت</th><th>وضعیت</th><th>اسپرینت</th><th>امتیاز</th><th>تأیید</th><th>عملیات</th></tr></thead>
                      <tbody>{visible.map((task) => {
                        const status = statusOf(task.status)
                        const approval = approvalOf(task.approvalStatus)
                        const late = isOverdue(task, today)
                        const pending = extras.pending[task.id]
                        const given = (delegations[task.id] || []).find((item) => item.delegatorUserId === user?.id)
                        return (
                          <tr key={task.id} className={isDone(task) ? 'tk-done' : ''}>
                            <td><strong>{task.title}</strong>{pending && <em className="bl-tag pf-late" title={`درخواست انتقال به «${statusOf(pending.submittedStatus).label}»`}><Clock3 size={12} />تغییر وضعیت در انتظار تأیید</em>}</td>
                            <td>{task.projectName}</td>
                            <td>{task.responsibleUserId ? data.userName(task.responsibleUserId) : '—'}{given && <small className="bl-note">ارجاع‌داده‌شده توسط شما</small>}</td>
                            <td className={`sch-date ${late ? 'tk-late' : ''}`}>{task.dueDate ? formatJalali(task.dueDate) : '—'}{late && <small className="bl-note tk-late">معوق</small>}</td>
                            <td><span className={`priority ${priorityOf(task.priority).tone}`}>{priorityOf(task.priority).label}</span></td>
                            <td>{perms.edit || perms.submitStatus
                              ? <select className="act-status" aria-label={`وضعیت ${task.title}`} value={status.value} disabled={busyId === task.id || Boolean(pending)} onChange={(e) => changeStatus(task, e.target.value)}>{STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select>
                              : <span className={`status-pill ${status.tone}`}>{status.label}</span>}</td>
                            <td>{task.sprintNumber ? task.sprintNumber.toLocaleString('fa-IR') : '—'}</td>
                            <td>{task.storyPoints ?? '—'}</td>
                            <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                            <td><div className="row-actions">
                              <button type="button" title={perms.edit ? 'ویرایش' : 'جزئیات'} aria-label={perms.edit ? 'ویرایش' : 'جزئیات'} onClick={() => setDialogState({ task })}><Pencil size={15} /></button>
                              {perms.submit && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => askSubmit(task)}><Send size={15} /></button>}
                              {perms.delete && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(task)}><Trash2 size={15} /></button>}
                            </div></td>
                          </tr>
                        )
                      })}</tbody>
                    </table></div>
                    {pages > 1 && (
                      <div className="prj-pager" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 12 }}>
                        <button type="button" className="bl-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
                        <span>صفحه‌ی {Math.min(page, pages).toLocaleString('fa-IR')} از {pages.toLocaleString('fa-IR')}</span>
                        <button type="button" className="bl-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button>
                      </div>
                    )}
                  </>
                )}
            </>
          )}
      </section>

      {dialogState && (
        <TaskDialog task={dialogState.task} projects={projects} data={data} perms={perms} myDelegations={extras.delegations}
          onClose={() => setDialogState(null)} onChanged={changed} onDone={(text) => { setDialogState(null); say('success', text); changed() }} />
      )}
      {dialog}
    </>
  )
}
