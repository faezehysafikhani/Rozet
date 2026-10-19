import { useCallback, useState } from 'react'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import '../project-management/baselines/baselines.css'
import '../task-management/tasks.css'
import DelegationsTab from './DelegationsTab'
import InboxTab from './InboxTab'
import SettingsTab from './SettingsTab'
import { workflowPerms } from './workflowModel'
import './workflow.css'

const TABS = [
  { key: 'inbox', label: 'کارتابل تأیید' },
  { key: 'delegations', label: 'ارجاع تأییدها' },
  { key: 'settings', label: 'تنظیم زنجیره‌ی تأیید' },
]

/**
 * گردش کار و الگوها: the approval center (approve or reject what waits for me), delegation of approvals,
 * and the approval chain each kind of project item follows. Backed by /api/workflow and /api/integrations/project-workflow.
 */
export default function WorkflowPage({ data }) {
  const { can } = useAuth()
  const perms = workflowPerms(can)
  const [tab, setTab] = useState('inbox')
  const [notice, setNotice] = useState(null)
  const say = useCallback((type, text) => setNotice({ type, text }), [])

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / گردش کار و الگوها</span><h1>گردش کار و الگوها</h1><p>کارتابل تأیید، ارجاع تأییدها و زنجیره‌ی تأیید هر نوع مورد</p></div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel bl-panel">
        {!perms.view ? <p className="data-state">برای مشاهده‌ی کارتابل و تنظیمات گردش کار به دسترسی «مشاهده گردش کار» نیاز دارید.</p> : (
          <>
            <div className="bl-tabs" role="tablist">
              {TABS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setNotice(null) }}>{label}</button>)}
            </div>
            {tab === 'inbox' && <InboxTab data={data} perms={perms} say={say} />}
            {tab === 'delegations' && <DelegationsTab data={data} perms={perms} say={say} />}
            {tab === 'settings' && <SettingsTab data={data} perms={perms} say={say} />}
          </>
        )}
      </section>
    </>
  )
}
