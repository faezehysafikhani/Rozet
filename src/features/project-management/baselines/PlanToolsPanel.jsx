import { useState } from 'react'
import { CheckCircle2, CircleAlert, FileSpreadsheet, GitCompare, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import BaselinesTab from './BaselinesTab'
import MsProjectTab from './MsProjectTab'
import SCurveTab from './SCurveTab'
import './baselines.css'

const TABS = [
  { key: 'baselines', label: 'خط مبنا', icon: GitCompare },
  { key: 'scurve', label: 'منحنی S', icon: TrendingUp },
  { key: 'msproject', label: 'MS Project', icon: FileSpreadsheet },
]

/**
 * Tools that work on the whole schedule of the selected project: saved baselines and their variance,
 * the S-curve with progress snapshots, and MS Project XML import / export. Only the open tab loads its data.
 */
export default function PlanToolsPanel({ data, onPlanChanged }) {
  const { can } = useAuth()
  const project = data.selectedProject
  const canView = can('WaterfallActivities.View')
  const canManage = can('WaterfallSchedule.Manage')
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [tab, setTab] = useState('baselines')
  const [notice, setNotice] = useState(null)
  const say = (type, text) => setNotice({ type, text })
  if (!project) return null

  const shared = { project, data, canView, canManage, confirm, say }
  return (
    <section className="task-panel task-table-panel bl-panel">
      <div className="task-panel-title">
        <div><h3>خط مبنا، منحنی S و MS Project — {project.name}</h3><p>مقایسه‌ی برنامه با نسخه‌های ثبت‌شده، پیگیری پیشرفت در طول زمان و تبادل برنامه با MS Project.</p></div>
      </div>
      <div className="bl-tabs" role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setNotice(null) }}><Icon size={15} />{label}</button>
        ))}
      </div>
      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}
      {tab === 'baselines' && <BaselinesTab key={project.id} {...shared} />}
      {tab === 'scurve' && <SCurveTab key={project.id} {...shared} />}
      {tab === 'msproject' && <MsProjectTab key={project.id} {...shared} onImported={onPlanChanged} />}
      {confirmDialog}
    </section>
  )
}
