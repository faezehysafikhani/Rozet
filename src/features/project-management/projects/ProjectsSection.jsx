import { useEffect, useMemo, useState } from 'react'
import { ArrowDownUp, CheckCircle2, CircleAlert, Eye, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../pmApi'
import { explainPmError, toOutcome } from '../pmErrors'
import { APPROVAL_STATUSES, approvalOf } from '../documents/documentUtils'
import ProjectDetailsDialog from './ProjectDetailsDialog'
import ProjectFormDialog from './ProjectFormDialog'
import { PROJECT_STATUSES, PROJECT_TYPES, SORTS, filterAndSort, projectStatusOf, projectTypeOf, unitLabel, useProjectLookups, useVisibleProjects } from './projectModel'
import './projects.css'

const PAGE_SIZE = 10
const EMPTY_FILTERS = { search: '', status: '', type: '', approval: '', unitId: '', managerId: '' }
const fa = (value) => Number(value).toLocaleString('fa-IR')

/**
 * The project list of "برنامه‌ریزی پروژه": search, filters, sorting and paging, and the whole life of a project -
 * create, view, edit, change status, send for approval, archive, delete - each action only for users who may.
 * `data` is the dashboard's shared project data (users, selected project); mutations refresh it too.
 */
export default function ProjectsSection({ data }) {
  const { can } = useAuth()
  const lookups = useProjectLookups()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState({ key: 'createdAtUtc', descending: true })
  const [includeArchived, setIncludeArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState(null) // { kind: 'create' } | { kind: 'edit' | 'details', id }
  const [notice, setNotice] = useState(null)
  const list = useVisibleProjects({ includeArchived })

  const say = (type, text) => setNotice({ type, text })
  const refresh = () => { list.reload(); data.refresh() }
  const setFilter = (patch) => { setFilters((current) => ({ ...current, ...patch })); setPage(1) }

  const visible = useMemo(
    () => filterAndSort(list.items, { ...filters, sortKey: sort.key, descending: sort.descending }, (raw) => approvalOf(raw).value),
    [list.items, filters, sort],
  )
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  useEffect(() => { if (page > pages) setPage(pages) }, [page, pages])
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const dialogProject = dialog?.id ? list.items.find((project) => project.id === dialog.id) : null
  const unitName = (id) => unitLabel(lookups.units.find((unit) => unit.id === id)) || '—'
  const filtered = Object.values(filters).some(Boolean)

  // ---- actions (shared by the table and the details dialog)
  const actions = {
    edit: (project) => setDialog({ kind: 'edit', id: project.id }),
    async changeStatus(project, value) {
      const result = await pmApi.projects.setStatus(project.id, value)
      if (result.isSuccess) { say('success', `وضعیت «${project.name}» به «${projectStatusOf(value).label}» تغییر کرد.`); refresh() } else say('error', explainPmError(result))
    },
    submit: (project) => confirm({
      title: 'ارسال برای تأیید',
      message: `«${project.name}» برای تأیید ارسال می‌شود. اگر برای پروژه‌ها زنجیره‌ی تأییدی تعریف نشده باشد، مستقیماً تأیید می‌شود.`,
      confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.projects.submitForApproval(project.id)
        if (result.isSuccess) {
          say('success', approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'پروژه تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'پروژه برای تأیید ارسال شد.')
          refresh()
        }
        return toOutcome(result)
      },
    }),
    archive: (project) => confirm({
      title: 'آرشیو پروژه',
      message: `«${project.name}» آرشیو می‌شود. پروژه‌ی آرشیوشده از فهرست عادی بیرون می‌رود و وضعیتش دیگر تغییر نمی‌کند.`,
      confirmLabel: 'آرشیو',
      run: async () => {
        const outcome = toOutcome(await pmApi.projects.archive(project.id))
        if (outcome.ok) { say('success', `«${project.name}» آرشیو شد.`); setDialog(null); refresh() }
        return outcome
      },
    }),
    remove: (project) => confirm({
      title: 'حذف پروژه',
      message: `«${project.name}» برای همیشه حذف می‌شود. اگر پروژه هنوز عضو تیم، خروجی، KPI یا اقدام دارد، حذف انجام نمی‌شود؛ در این صورت می‌توانید آن را آرشیو کنید.`,
      confirmLabel: 'حذف پروژه',
      danger: true,
      run: async () => {
        const outcome = toOutcome(await pmApi.projects.remove(project.id))
        if (outcome.ok) { say('success', `«${project.name}» حذف شد.`); setDialog(null); refresh() }
        return outcome
      },
    }),
  }

  const done = (text, saved) => {
    setDialog(null); say('success', text); refresh()
    if (saved?.id) data.setSelectedProjectId(saved.id)
  }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت پروژه / برنامه‌ریزی پروژه</span><h1>برنامه‌ریزی پروژه</h1><p>فهرست پروژه‌ها، چرخه‌ی عمر پروژه و فعالیت‌های برنامه</p></div>
        <div className="task-head-actions">
          {can('Projects.Create') && <button type="button" onClick={() => setDialog({ kind: 'create' })}><Plus size={18} />ایجاد پروژه</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel">
        {!list.canList ? <p className="data-state">برای مشاهده‌ی پروژه‌ها به دسترسی «مشاهده‌ی پروژه‌ها» نیاز دارید.</p> : (
          <>
            <div className="docs-toolbar prj-toolbar">
              <label className="docs-search"><Search size={16} /><input value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} placeholder="جست‌وجو در نام و کد پروژه..." /></label>
              <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="وضعیت پروژه">
                <option value="">همه‌ی وضعیت‌ها</option>{PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select value={filters.type} onChange={(e) => setFilter({ type: e.target.value })} aria-label="نوع پروژه">
                <option value="">همه‌ی انواع</option>{PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={filters.approval} onChange={(e) => setFilter({ approval: e.target.value })} aria-label="وضعیت تأیید">
                <option value="">همه‌ی تأییدها</option>{APPROVAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {lookups.units.length > 0 && (
                <select value={filters.unitId} onChange={(e) => setFilter({ unitId: e.target.value })} aria-label="واحد سازمانی">
                  <option value="">همه‌ی واحدها</option>{lookups.units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
                </select>
              )}
              {data.users.length > 0 && (
                <select value={filters.managerId} onChange={(e) => setFilter({ managerId: e.target.value })} aria-label="مدیر پروژه">
                  <option value="">همه‌ی مدیران</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                </select>
              )}
              <select value={sort.key} onChange={(e) => setSort({ key: e.target.value, descending: SORTS.find((s) => s.key === e.target.value).descending })} aria-label="مرتب‌سازی">
                {SORTS.map((s) => <option key={s.key} value={s.key}>مرتب‌سازی: {s.label}</option>)}
              </select>
              <button type="button" className="prj-icon" onClick={() => setSort((c) => ({ ...c, descending: !c.descending }))} title={sort.descending ? 'نزولی' : 'صعودی'} aria-label="جهت مرتب‌سازی"><ArrowDownUp size={16} /></button>
              <label className="prj-check"><input type="checkbox" checked={includeArchived} onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1) }} />نمایش آرشیو</label>
              {filtered && <button type="button" className="prj-clear" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}>پاک کردن فیلترها</button>}
              <span className="docs-count">{fa(visible.length)} از {fa(list.items.length)} پروژه</span>
            </div>

            {list.loading && !list.items.length ? <p className="data-state">در حال دریافت پروژه‌ها...</p>
              : list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p>
              : !list.items.length ? <p className="data-state">هنوز پروژه‌ای ثبت نشده است.{can('Projects.Create') ? ' با «ایجاد پروژه» شروع کنید.' : ''}</p>
              : !visible.length ? <p className="data-state">پروژه‌ای با این فیلترها پیدا نشد.</p>
              : (
                <>
                  <div className="table-scroll"><table className="users-table" style={{ minWidth: 1100 }}>
                    <thead><tr><th>پروژه</th><th>نوع</th><th>وضعیت</th><th>مدیر</th><th>واحد</th><th>بازه</th><th>پیشرفت</th><th>تأیید</th><th>عملیات</th></tr></thead>
                    <tbody>
                      {pageItems.map((project) => {
                        const status = projectStatusOf(project.status)
                        const approval = approvalOf(project.approvalStatus)
                        const progress = list.progress[project.id]
                        const archived = status.key === 'Archived'
                        return (
                          <tr key={project.id} className={`prj-row-main${project.id === data.selectedProjectId ? ' prj-selected' : ''}`} onClick={() => data.setSelectedProjectId(project.id)}>
                            <td><div className="docs-title"><strong>{project.name}</strong><small>{project.code}</small></div></td>
                            <td>{projectTypeOf(project.type).label}</td>
                            <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                            <td>{project.managerUserId ? data.userName(project.managerUserId) : '—'}</td>
                            <td>{unitName(project.organizationUnitId)}</td>
                            <td className="prj-dates">{project.startDate ? formatJalali(project.startDate) : '—'}<br />{project.endDate ? formatJalali(project.endDate) : '—'}</td>
                            <td>{progress ? (
                              <div className="prj-progress" title={`برنامه‌ای ${fa(progress.plannedProgress)}٪ — واقعی ${fa(progress.actualProgress)}٪`}>
                                <span><i style={{ width: `${Math.min(100, progress.plannedProgress)}%` }} className="planned" /></span>
                                <span><i style={{ width: `${Math.min(100, progress.actualProgress)}%` }} className="actual" /></span>
                                <small>{fa(Math.round(progress.actualProgress))}٪ از {fa(Math.round(progress.plannedProgress))}٪</small>
                              </div>
                            ) : '—'}</td>
                            <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                            <td onClick={(event) => event.stopPropagation()}>
                              <div className="row-actions">
                                <button type="button" title="جزئیات" aria-label="جزئیات" onClick={() => setDialog({ kind: 'details', id: project.id })}><Eye size={15} /></button>
                                {can('Projects.Edit') && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => actions.edit(project)}><Pencil size={15} /></button>}
                                {can('Projects.Submit') && !archived && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => actions.submit(project)}><Send size={15} /></button>}
                                {can('Projects.Remove') && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => actions.remove(project)}><Trash2 size={15} /></button>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table></div>
                  {pages > 1 && (
                    <div className="table-pager">
                      <span>نمایش {fa((page - 1) * PAGE_SIZE + 1)} تا {fa(Math.min(page * PAGE_SIZE, visible.length))} از {fa(visible.length)} پروژه</span>
                      <div>
                        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
                        <b>صفحه {fa(page)} از {fa(pages)}</b>
                        <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button>
                      </div>
                    </div>
                  )}
                </>
              )}
          </>
        )}
      </section>

      {dialog?.kind === 'create' && <ProjectFormDialog project={null} data={data} lookups={lookups} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && dialogProject && <ProjectFormDialog project={dialogProject} data={data} lookups={lookups} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'details' && dialogProject && <ProjectDetailsDialog project={dialogProject} data={data} lookups={lookups} progress={list.progress[dialogProject.id]} actions={actions} onClose={() => setDialog(null)} />}
      {confirmDialog}
    </>
  )
}
