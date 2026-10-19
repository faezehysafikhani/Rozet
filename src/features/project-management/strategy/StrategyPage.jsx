import { useState } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import AlignmentTab from './AlignmentTab'
import DeliverablesTab from './DeliverablesTab'
import PortfolioTab from './PortfolioTab'
import StrategyTreeTab from './StrategyTreeTab'
import '../baselines/baselines.css'
import '../progress/progress.css'
import './strategy.css'

const TABS = [
  { key: 'portfolio', label: 'نمای سبد پروژه‌ها' },
  { key: 'deliverables', label: 'خروجی‌ها و شاخص‌ها' },
  { key: 'tree', label: 'درخت راهبرد' },
  { key: 'alignment', label: 'همسوسازی با راهبرد' },
]

/**
 * مدیریت استراتژیک پروژه‌ها: deliverables and KPIs of the selected project, the organization's strategy tree,
 * and how well each project is aligned with the strategies.
 */
export default function StrategyPage({ data }) {
  const { can } = useAuth()
  const project = data.selectedProject
  const perms = {
    viewDeliverables: can('Deliverables.View'), createDeliverable: can('Deliverables.Create'), editDeliverable: can('Deliverables.Edit'),
    viewKpis: can('Kpi.View'), createKpi: can('Kpi.Create'), editKpi: can('Kpi.Edit'), deleteKpi: can('Kpi.Delete'),
    viewStrategy: can('Strategy.View'), editStrategy: can('Strategy.Edit'),
    viewAlignment: can('ProjectStrategyAlignment.View'), manageAlignment: can('ProjectStrategyAlignment.Manage'),
    viewReporting: can('Reporting.View') && can('Reporting.ViewAll'), viewRisks: can('Risks.View'), viewDelays: can('DelayReasons.View'), viewActions: can('Actions.View'),
  }
  const { confirm, dialog } = useConfirm()
  const [tab, setTab] = useState('portfolio')
  const [notice, setNotice] = useState(null)
  const [alignmentKey, setAlignmentKey] = useState(0)
  const say = (type, text) => setNotice({ type, text })
  const needsProject = tab === 'deliverables' || tab === 'alignment'

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت پروژه / مدیریت استراتژیک پروژه‌ها</span><h1>مدیریت استراتژیک پروژه‌ها</h1><p>مقایسه‌ی سبد پروژه‌ها، خروجی‌ها و شاخص‌های پروژه، درخت راهبرد سازمان و همسوسازی پروژه‌ها با آن</p></div>
        <div className="task-head-actions">
          {needsProject && data.projects.length > 0 && (
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

      <section className="task-panel task-table-panel bl-panel">
        <div className="bl-tabs" role="tablist">
          {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setNotice(null) }}>{label}</button>)}
        </div>
        {tab === 'portfolio' && ((data.loading && !data.projects.length) ? <p className="data-state">در حال دریافت پروژه‌ها...</p> : data.error ? <p className="data-state data-state--error">{data.error}</p> : <PortfolioTab data={data} perms={perms} />)}
        {tab === 'tree' && <StrategyTreeTab data={data} perms={perms} confirm={confirm} say={say} onSaved={() => setAlignmentKey((value) => value + 1)} />}
        {needsProject && ((data.loading && !data.projects.length) ? <p className="data-state">در حال دریافت پروژه‌ها...</p>
          : data.error ? <p className="data-state data-state--error">{data.error}</p>
          : !project ? <p className="data-state">ابتدا یک پروژه ایجاد کنید.</p>
          : tab === 'deliverables' ? <DeliverablesTab key={project.id} project={project} data={data} perms={perms} confirm={confirm} say={say} />
          : <AlignmentTab key={project.id} project={project} data={data} perms={perms} say={say} reloadKey={alignmentKey} onSaved={() => setAlignmentKey((value) => value + 1)} />)}
      </section>
      {dialog}
    </>
  )
}
