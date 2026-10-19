import { useCallback, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardCheck, Eye, FileText, Plus, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import { formatJalali, todayIso } from '../../utils/jalali'
import '../project-management/baselines/baselines.css'
import '../task-management/tasks.css'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import MeetingDialog from './MeetingDialog'
import { STATUSES, attendanceSummary, durationText, explainMeetingError, meetingPerms, statusOf, timeText, toMeetingOutcome } from './meetingModel'
import './meetings.css'

/** جلسات و صورت‌جلسات: the meetings of the selected project - schedule, invited people, attendance and minutes. */
export default function MeetingsPage({ data }) {
  const { can } = useAuth()
  const perms = meetingPerms(can)
  const project = data.selectedProject
  const [reloadKey, setReloadKey] = useState(0)
  const meetings = useLoader(() => pmApi.meetings.list(project.id), `${project?.id}:${reloadKey}`, Boolean(project) && perms.view, { list: true, explain: explainMeetingError })
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null) // { meeting? }
  const [notice, setNotice] = useState(null)
  const say = useCallback((type, text) => setNotice({ type, text }), [])
  const changed = useCallback(() => setReloadKey((value) => value + 1), [])
  const today = todayIso()

  const rows = useMemo(() => meetings.value.filter((item) => (statusFilter === '' || statusOf(item.status).value === Number(statusFilter))
    && (!search.trim() || `${item.title} ${item.location || ''} ${data.userName(item.organizerUserId)}`.toLowerCase().includes(search.trim().toLowerCase()))), [meetings.value, statusFilter, search, data])
  const counts = useMemo(() => ({
    upcoming: meetings.value.filter((item) => statusOf(item.status).key === 'Scheduled' && item.meetingDate >= today).length,
    overdue: meetings.value.filter((item) => statusOf(item.status).key === 'Scheduled' && item.meetingDate < today).length,
    held: meetings.value.filter((item) => statusOf(item.status).key === 'Held').length,
    withMinutes: meetings.value.filter((item) => item.minutes).length,
  }), [meetings.value, today])

  function askDelete(item) {
    confirm({
      title: 'حذف جلسه', message: `«${item.title}» با فهرست شرکت‌کنندگانش حذف می‌شود.`, confirmLabel: 'حذف جلسه', danger: true,
      run: async () => {
        const outcome = toMeetingOutcome(await pmApi.meetings.remove(item.id))
        if (outcome.ok) { say('success', 'جلسه حذف شد.'); changed() }
        return outcome
      },
    })
  }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / جلسات و صورت‌جلسات</span><h1>جلسات و صورت‌جلسات</h1><p>برنامه‌ریزی جلسات پروژه، ثبت حضور و صورت‌جلسه</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(e) => { data.setSelectedProjectId(e.target.value); setNotice(null) }} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          {perms.create && project && <button type="button" onClick={() => setDialog({})}><Plus size={18} />جلسه‌ی جدید</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      {!perms.view ? <section className="task-panel"><p className="data-state">برای مشاهده‌ی جلسات به دسترسی «مشاهده جلسات» نیاز دارید.</p></section>
        : (data.loading && !data.projects.length) ? <section className="task-panel"><p className="data-state">در حال دریافت پروژه‌ها...</p></section>
        : !project ? <section className="task-panel"><p className="data-state">ابتدا یک پروژه ایجاد کنید؛ جلسه به یک پروژه تعلق دارد.</p></section> : (
          <>
            <div className="meeting-summary">
              <article><CalendarDays size={22} /><div><strong>{counts.upcoming.toLocaleString('fa-IR')}</strong><span>جلسه‌ی پیش رو</span></div></article>
              <article><CircleAlert size={22} /><div><strong>{counts.overdue.toLocaleString('fa-IR')}</strong><span>موعد گذشته و برگزارنشده</span></div></article>
              <article><ClipboardCheck size={22} /><div><strong>{counts.held.toLocaleString('fa-IR')}</strong><span>جلسه‌ی برگزارشده</span></div></article>
              <article><FileText size={22} /><div><strong>{counts.withMinutes.toLocaleString('fa-IR')}</strong><span>دارای صورت‌جلسه</span></div></article>
            </div>
            <section className="task-panel task-table-panel">
              <div className="tk-filters">
                <label className="docs-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در عنوان، مکان و برگزارکننده..." /></label>
                <select aria-label="وضعیت" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">همه‌ی وضعیت‌ها</option>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                <span className="docs-count">{rows.length.toLocaleString('fa-IR')} از {meetings.value.length.toLocaleString('fa-IR')} جلسه</span>
              </div>
              {meetings.error ? <p className="data-state data-state--error">{meetings.error} <button type="button" className="prj-clear" onClick={meetings.reload}>تلاش دوباره</button></p>
                : meetings.loading && !meetings.value.length ? <p className="data-state">در حال دریافت جلسات...</p>
                : !meetings.value.length ? <p className="data-state">هنوز جلسه‌ای ثبت نشده است.{perms.create ? ' با «جلسه‌ی جدید» شروع کنید.' : ''}</p>
                : !rows.length ? <p className="data-state">جلسه‌ای با این فیلتر پیدا نشد.</p> : (
                  <div className="table-scroll"><table className="users-table mt-table" style={{ minWidth: 960 }}>
                    <thead><tr><th>جلسه</th><th>زمان</th><th>مکان</th><th>شرکت‌کنندگان</th><th>وضعیت</th><th>صورت‌جلسه</th><th>عملیات</th></tr></thead>
                    <tbody>{rows.map((item) => {
                      const status = statusOf(item.status)
                      const late = status.key === 'Scheduled' && item.meetingDate < today
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.title}</strong>{item.organizerUserId && <small className="bl-note">برگزارکننده: {data.userName(item.organizerUserId)}</small>}</td>
                          <td className={`sch-date ${late ? 'tk-late' : ''}`}>{formatJalali(item.meetingDate)}{item.startTime && <small className="bl-note">{timeText(item)}{durationText(item) ? ` · ${durationText(item)}` : ''}</small>}{late && <small className="bl-note tk-late">موعد گذشته</small>}</td>
                          <td>{item.location || (item.onlineLink ? 'آنلاین' : '—')}</td>
                          <td>{attendanceSummary(item)}</td>
                          <td><span className={`status-pill mt-${status.tone}`}>{status.label}</span></td>
                          <td>{item.minutes ? <span className="status-pill mt-success">ثبت شده</span> : '—'}</td>
                          <td><div className="row-actions">
                            <button type="button" aria-label={`باز کردن ${item.title}`} title="جزئیات، حضور و صورت‌جلسه" onClick={() => setDialog({ meeting: item })}><Eye size={15} /></button>
                            {perms.delete && status.key !== 'Held' && <button type="button" className="danger" aria-label={`حذف ${item.title}`} title="حذف" onClick={() => askDelete(item)}><Trash2 size={15} /></button>}
                          </div></td>
                        </tr>
                      )
                    })}</tbody>
                  </table></div>
                )}
            </section>
          </>
        )}

      {dialog && project && <MeetingDialog meeting={dialog.meeting || null} project={project} data={data} perms={perms} onClose={() => setDialog(null)} onChanged={changed} />}
      {confirmDialog}
    </>
  )
}
