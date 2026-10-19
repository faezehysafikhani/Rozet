import { useMemo, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import { formatInstant } from '../project-management/history/historyModel'
import InstanceDialog from './InstanceDialog'
import { explainWorkflowError, instanceStatusOf, lastDecisionAt, subjectLabel } from './workflowModel'
import { useSubjectNames } from './useSubjectNames'

const VIEWS = [
  { key: 'pending', label: 'در انتظار من', load: () => pmApi.workflow.pending(), empty: 'درخواست تأییدی در انتظار شما نیست.' },
  { key: 'decided', label: 'تصمیم‌های من', load: () => pmApi.workflow.decided(100), empty: 'هنوز درخواستی را تأیید یا رد نکرده‌اید.' },
  { key: 'requested', label: 'درخواست‌های من', load: () => pmApi.workflow.requested(100), empty: 'هنوز چیزی را برای تأیید ارسال نکرده‌اید.' },
]

/** کارتابل تأیید: what waits for me (or for whoever I stand in for), what I decided, and what I submitted myself. */
export default function InboxTab({ data, perms, say, onCount }) {
  const [view, setView] = useState('pending')
  const current = VIEWS.find((item) => item.key === view)
  const list = useLoader(current.load, `inbox:${view}`, perms.view, { list: true, explain: explainWorkflowError })
  const items = list.value
  const names = useSubjectNames(items, data.projects)
  const [open, setOpen] = useState(null)
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const projectName = (id) => data.projects.find((project) => project.id === id)?.name || ''
  const types = useMemo(() => [...new Set(items.map((item) => item.subjectType))], [items])

  const rows = items.map((item) => {
    const found = names.describe(item)
    return { item, name: found?.name || '', projectName: found?.projectId ? projectName(found.projectId) : '' }
  }).filter(({ item, name, projectName: project }) => (!type || item.subjectType === type)
    && (!search.trim() || `${name} ${project} ${subjectLabel(item.subjectType)}`.toLowerCase().includes(search.trim().toLowerCase())))

  const canDecide = view === 'pending' && (perms.approve || perms.reject)
  const done = (text) => { setOpen(null); say('success', text); list.reload(); onCount?.() }
  const switchView = (key) => { setView(key); setType(''); setSearch(''); setOpen(null) }

  const whenOf = (item) => {
    const instant = view === 'requested' ? item.createdAtUtc : lastDecisionAt(item) || item.createdAtUtc
    if (!instant) return '—'
    const { day, time } = formatInstant(instant)
    return `${day} ${time}`.trim()
  }
  return (
    <>
      <div className="bl-tabs wf-views" role="tablist" aria-label="کارتابل">
        {VIEWS.map(({ key, label }) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => switchView(key)}>{label}</button>)}
      </div>
      {list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p> : (
        <>
          <div className="tk-filters">
            <input className="wf-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در نام مورد، پروژه و نوع..." aria-label="جست‌وجو" />
            <select aria-label="نوع" value={type} onChange={(e) => setType(e.target.value)}><option value="">همه‌ی انواع</option>{types.map((entry) => <option key={entry} value={entry}>{subjectLabel(entry)}</option>)}</select>
            <button type="button" className="bl-button" onClick={list.reload} disabled={list.loading}><RefreshCw size={15} />تازه‌سازی</button>
            <span className="docs-count">{rows.length.toLocaleString('fa-IR')} درخواست</span>
          </div>
          {list.loading && !items.length ? <p className="data-state">در حال دریافت درخواست‌ها...</p>
            : !items.length ? <p className="data-state">{current.empty}</p>
            : !rows.length ? <p className="data-state">درخواستی با این فیلتر پیدا نشد.</p> : (
              <div className="table-scroll"><table className="users-table wf-table" style={{ minWidth: 900 }}>
                <thead><tr><th>مورد</th><th>نوع</th><th>پروژه</th>{view === 'pending' ? <th>مرحله</th> : <><th>وضعیت</th><th>{view === 'requested' ? 'ارسال' : 'آخرین تصمیم'}</th></>}<th>عملیات</th></tr></thead>
                <tbody>{rows.map(({ item, name, projectName: project }) => {
                  const step = item.steps?.find((entry) => entry.order === item.currentStepOrder)
                  const status = instanceStatusOf(item.status)
                  return (
                    <tr key={item.id}>
                      <td><strong>{name || <span className="wf-unknown">بدون عنوان</span>}</strong>{item.delegatedFromUserId && <small className="bl-note">به‌جای {data.userName(item.delegatedFromUserId)} (ارجاع)</small>}</td>
                      <td>{subjectLabel(item.subjectType)}</td>
                      <td>{project || '—'}</td>
                      {view === 'pending'
                        ? <td>{step ? step.name : `مرحله ${item.currentStepOrder.toLocaleString('fa-IR')}`}<small className="bl-note">{item.currentStepOrder.toLocaleString('fa-IR')} از {item.totalSteps.toLocaleString('fa-IR')}</small></td>
                        : <>
                          <td><span className={`status-pill wf-${status.tone}`}>{status.label}</span>
                            {status.key === 'InProgress' && <small className="bl-note">{item.currentApproverUserId ? `منتظر ${data.userName(item.currentApproverUserId)}` : `مرحله ${item.currentStepOrder.toLocaleString('fa-IR')} از ${item.totalSteps.toLocaleString('fa-IR')}`}</small>}</td>
                          <td className="sch-date">{whenOf(item)}</td>
                        </>}
                      <td><div className="row-actions"><button type="button" onClick={() => setOpen({ item, name, projectName: project })} aria-label={`بررسی ${name || subjectLabel(item.subjectType)}`} title={canDecide ? 'بررسی و تصمیم' : 'جزئیات'}><Eye size={15} /></button></div></td>
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
        </>
      )}
      {open && <InstanceDialog instance={open.item} name={open.name} projectName={open.projectName} data={data} perms={perms} canDecide={canDecide} readOnlyNote={view === 'requested' ? 'این درخواست منتظر تصمیم تأییدکننده‌ی مرحله‌ی جاری است.' : undefined} onClose={() => setOpen(null)} onDone={done} />}
    </>
  )
}
