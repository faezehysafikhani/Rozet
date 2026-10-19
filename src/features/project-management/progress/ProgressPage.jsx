import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, FileText, Gauge, TrendingUp, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import { unwrap } from '../../../services/api'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import DelayReasonsTab from './DelayReasonsTab'
import PerformanceTab from './PerformanceTab'
import SubmissionsTab from './SubmissionsTab'
import UpdatesTab from './UpdatesTab'
import { classificationOf, deviationText, explainProgressError, fmt } from './progressModel'
import '../baselines/baselines.css'
import './progress.css'

const TABS = [
  { key: 'performance', label: 'سلامت و عملکرد' },
  { key: 'updates', label: 'گزارش‌های وضعیت' },
  { key: 'delays', label: 'دلایل تأخیر' },
  { key: 'submissions', label: 'گزارش پیشرفت فعالیت‌ها' },
]

/**
 * کنترل پیشرفت پروژه: status reports, structured delay reasons and per-activity progress reports of one project.
 * The AI executive summary of the Core is not available in Rozet.Api (it answers 501), so the page has none.
 */
export default function ProgressPage({ data }) {
  const { can } = useAuth()
  const project = data.selectedProject
  const perms = {
    view: can('ProjectProgress.View'), create: can('ProjectProgress.Create'), edit: can('ProjectProgress.Edit'), delete: can('ProjectProgress.Delete'), submit: can('ProjectProgress.Submit'),
    viewDelays: can('DelayReasons.View'), createDelays: can('DelayReasons.Create'), editDelays: can('DelayReasons.Edit'), deleteDelays: can('DelayReasons.Delete'), submitDelays: can('DelayReasons.Submit'),
    viewReporting: can('Reporting.View') && can('Reporting.ViewAll'),
    viewActivities: can('WaterfallActivities.View'), editActivities: can('WaterfallActivities.Edit'), submitProgress: can('WaterfallProgress.Submit'),
  }
  const { confirm, dialog } = useConfirm()
  const [tab, setTab] = useState('performance')
  const [notice, setNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const say = (type, text) => setNotice({ type, text })

  const reports = useLoader(() => pmApi.progress.list(project.id), `${project?.id}`, Boolean(project) && perms.view, { list: true, explain: explainProgressError })
  const live = useLoader(() => pmApi.projects.progress({ projectIds: [project.id] }), `${project?.id}:${reloadKey}`, Boolean(project) && can('Projects.View'))
  const liveEntry = useMemo(() => (Array.isArray(live.value) ? live.value : []).find((entry) => entry.projectId === project?.id), [live.value, project])
  const latest = useMemo(() => [...reports.value].sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate)))[0], [reports.value])
  const lastConfirmed = useMemo(() => [...reports.value].filter((item) => item.confirmedProgress !== null && item.confirmedProgress !== undefined).sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate)))[0], [reports.value])
  const classification = latest ? classificationOf(latest.performanceClassification) : null
  const refreshAll = () => { setReloadKey((value) => value + 1); data.refresh() }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت پروژه / کنترل پیشرفت پروژه</span><h1>کنترل پیشرفت پروژه</h1><p>گزارش وضعیت، دلایل تأخیر و گزارش پیشرفت فعالیت‌ها با گردش تأیید</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(event) => { data.setSelectedProjectId(event.target.value); setNotice(null) }} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      {(data.loading && !data.projects.length) ? <section className="task-panel"><p className="data-state">در حال دریافت پروژه‌ها...</p></section>
        : data.error ? <section className="task-panel"><p className="data-state data-state--error">{data.error}</p></section>
        : !project ? <section className="task-panel"><p className="data-state">ابتدا یک پروژه ایجاد کنید؛ گزارش پیشرفت به یک پروژه تعلق دارد.</p></section>
        : (
          <>
            <div className="task-kpis prg-kpis">
              <article><span className="task-kpi-icon navy"><Gauge size={21} /></span><div><small>پیشرفت فعلی پروژه</small><strong>{liveEntry ? `${fmt(liveEntry.actualProgress)}٪ از ${fmt(liveEntry.plannedProgress)}٪` : '—'}</strong><p>واقعی از برنامه‌ای، همین امروز</p></div></article>
              <article><span className="task-kpi-icon green"><TrendingUp size={21} /></span><div><small>آخرین گزارش وضعیت</small><strong>{latest ? `${fmt(latest.actualProgress)}٪ از ${fmt(latest.plannedProgress)}٪` : '—'}</strong><p>{latest ? formatJalali(latest.registerDate) : perms.view ? 'گزارشی ثبت نشده' : 'بدون دسترسی'}</p></div></article>
              <article><span className={`task-kpi-icon ${classification?.key === 'Behind' ? 'red' : classification?.key === 'AtRisk' ? 'gold' : 'blue'}`}><TriangleAlert size={21} /></span><div><small>انحراف و وضعیت</small><strong>{latest ? deviationText(latest.deviation) : '—'}</strong><p>{classification ? classification.label : '—'}</p></div></article>
              <article><span className="task-kpi-icon blue"><FileText size={21} /></span><div><small>پیشرفت تأییدی</small><strong>{lastConfirmed ? `${fmt(lastConfirmed.confirmedProgress)}٪` : '—'}</strong><p>{lastConfirmed ? `گزارش تأییدشده‌ی ${formatJalali(lastConfirmed.registerDate)}` : 'هنوز گزارشی تأیید نشده'}</p></div></article>
            </div>

            <section className="task-panel task-table-panel bl-panel">
              <div className="bl-tabs" role="tablist">
                {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setNotice(null) }}>{label}</button>)}
              </div>
              {tab === 'performance' && <PerformanceTab key={project.id} project={project} canView={perms.viewReporting} reloadKey={reloadKey} />}
              {tab === 'updates' && <UpdatesTab project={project} data={data} perms={perms} confirm={confirm} say={say} list={reports} onChanged={refreshAll} />}
              {tab === 'delays' && <DelayReasonsTab key={project.id} project={project} data={data} perms={{ view: perms.viewDelays, create: perms.createDelays, edit: perms.editDelays, delete: perms.deleteDelays, submit: perms.submitDelays }} confirm={confirm} say={say} />}
              {tab === 'submissions' && <SubmissionsTab key={project.id} project={project} data={data} perms={perms} say={say} reloadKey={reloadKey} onChanged={refreshAll} />}
            </section>
          </>
        )}
      {dialog}
    </>
  )
}
