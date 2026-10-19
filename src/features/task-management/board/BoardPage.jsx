import { useCallback, useState } from 'react'
import { CheckCircle2, CircleAlert, Plus, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { unwrap } from '../../../services/api'
import { pmApi } from '../../project-management/pmApi'
import { useLoader } from '../../project-management/useLoader'
import '../../project-management/baselines/baselines.css'
import '../../project-management/progress/progress.css'
import TaskDialog from '../TaskDialog'
import { explainTaskError, taskPerms } from '../taskModel'
import { useTaskExtras } from '../useTasks'
import '../tasks.css'
import BacklogTab from './BacklogTab'
import BoardTab from './BoardTab'
import ChartsTab from './ChartsTab'
import SprintsTab from './SprintsTab'

const TABS = [
  { key: 'board', label: 'برد' },
  { key: 'backlog', label: 'بک‌لاگ' },
  { key: 'sprints', label: 'اسپرینت‌ها' },
  { key: 'charts', label: 'نمودارها' },
]

/**
 * برد کانبان: the agile board of the selected project - the board itself with drag and drop, the backlog, sprints and charts.
 * Every figure comes from the Core's board, backlog, sprint and chart endpoints.
 */
export default function BoardPage({ data }) {
  const { can } = useAuth()
  const perms = taskPerms(can)
  const project = data.selectedProject
  const [tab, setTab] = useState('board')
  const [notice, setNotice] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [dialog, setDialog] = useState(null) // { task? }
  const say = useCallback((type, text) => setNotice({ type, text }), [])

  const sprints = useLoader(() => pmApi.agile.sprints.list(project.id), `${project?.id}:${reloadKey}`, Boolean(project) && perms.view, { list: true, explain: explainTaskError })
  const extras = useTaskExtras(project ? [project] : [], perms)
  const changed = () => { setReloadKey((value) => value + 1); extras.reload(); data.refresh() }

  async function openTask(id) {
    const result = await pmApi.agile.tasks.get(id)
    if (!result.isSuccess) { say('error', explainTaskError(result)); return }
    setDialog({ task: { ...unwrap(result), projectName: project.name } })
  }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / برد کانبان</span><h1>برد کانبان</h1><p>برد، بک‌لاگ، اسپرینت و نمودارهای تیم چابک</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(e) => { data.setSelectedProjectId(e.target.value); setNotice(null) }} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          {perms.create && project && <button type="button" onClick={() => setDialog({})}><Plus size={18} />ایجاد وظیفه جدید</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel bl-panel">
        {(data.loading && !data.projects.length) ? <p className="data-state">در حال دریافت پروژه‌ها...</p>
          : data.error ? <p className="data-state data-state--error">{data.error}</p>
          : !project ? <p className="data-state">ابتدا یک پروژه ایجاد کنید؛ برد به یک پروژه تعلق دارد.</p> : (
            <>
              <div className="bl-tabs" role="tablist">
                {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setNotice(null) }}>{label}</button>)}
              </div>
              {tab === 'board' && <BoardTab key={project.id} project={project} data={data} sprints={sprints.value} pending={extras.pending} say={say} onChanged={changed} onOpenTask={openTask} reloadKey={reloadKey} />}
              {tab === 'backlog' && <BacklogTab key={project.id} project={project} data={data} sprints={sprints.value} say={say} onChanged={changed} onOpenTask={openTask} onCreate={() => setDialog({})} reloadKey={reloadKey} />}
              {tab === 'sprints' && <SprintsTab key={project.id} project={project} data={data} sprints={sprints.value} loading={sprints.loading} error={sprints.error} say={say} onChanged={changed} reload={sprints.reload} />}
              {tab === 'charts' && <ChartsTab key={project.id} project={project} sprints={sprints.value} reloadKey={reloadKey} />}
            </>
          )}
      </section>

      {dialog && project && (
        <TaskDialog task={dialog.task} project={project} projects={data.projects} data={data} perms={perms} myDelegations={extras.delegations}
          onClose={() => setDialog(null)} onChanged={changed} onDone={(text) => { setDialog(null); say('success', text); changed() }} />
      )}
    </>
  )
}
