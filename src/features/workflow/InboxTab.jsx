import { useMemo, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import InstanceDialog from './InstanceDialog'
import { explainWorkflowError, subjectLabel } from './workflowModel'
import { useSubjectNames } from './useSubjectNames'

/** کارتابل تأیید: the approvals whose current step is mine (or that I stand in for through a delegation). */
export default function InboxTab({ data, perms, say, onCount }) {
  const pending = useLoader(() => pmApi.workflow.pending(), 'inbox', perms.view, { list: true, explain: explainWorkflowError })
  const items = pending.value
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

  const canDecide = perms.approve || perms.reject
  const done = (text) => { setOpen(null); say('success', text); pending.reload(); onCount?.() }

  if (pending.error) return <p className="data-state data-state--error">{pending.error} <button type="button" className="prj-clear" onClick={pending.reload}>تلاش دوباره</button></p>
  return (
    <>
      <div className="tk-filters">
        <input className="wf-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجو در نام مورد، پروژه و نوع..." aria-label="جست‌وجو" />
        <select aria-label="نوع" value={type} onChange={(e) => setType(e.target.value)}><option value="">همه‌ی انواع</option>{types.map((item) => <option key={item} value={item}>{subjectLabel(item)}</option>)}</select>
        <button type="button" className="bl-button" onClick={pending.reload} disabled={pending.loading}><RefreshCw size={15} />تازه‌سازی</button>
        <span className="docs-count">{rows.length.toLocaleString('fa-IR')} درخواست</span>
      </div>
      {pending.loading && !items.length ? <p className="data-state">در حال دریافت درخواست‌ها...</p>
        : !items.length ? <p className="data-state">درخواست تأییدی در انتظار شما نیست.</p>
        : !rows.length ? <p className="data-state">درخواستی با این فیلتر پیدا نشد.</p> : (
          <div className="table-scroll"><table className="users-table wf-table" style={{ minWidth: 860 }}>
            <thead><tr><th>مورد</th><th>نوع</th><th>پروژه</th><th>مرحله</th><th>عملیات</th></tr></thead>
            <tbody>{rows.map(({ item, name, projectName: project }) => {
              const step = item.steps?.find((entry) => entry.order === item.currentStepOrder)
              return (
                <tr key={item.id}>
                  <td><strong>{name || <span className="wf-unknown">بدون عنوان</span>}</strong>{item.delegatedFromUserId && <small className="bl-note">به‌جای {data.userName(item.delegatedFromUserId)} (ارجاع)</small>}</td>
                  <td>{subjectLabel(item.subjectType)}</td>
                  <td>{project || '—'}</td>
                  <td>{step ? step.name : `مرحله ${item.currentStepOrder.toLocaleString('fa-IR')}`}<small className="bl-note">{item.currentStepOrder.toLocaleString('fa-IR')} از {item.totalSteps.toLocaleString('fa-IR')}</small></td>
                  <td><div className="row-actions"><button type="button" onClick={() => setOpen({ item, name, projectName: project })} aria-label={`بررسی ${name || subjectLabel(item.subjectType)}`} title={canDecide ? 'بررسی و تصمیم' : 'جزئیات'}><Eye size={15} /></button></div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {open && <InstanceDialog instance={open.item} name={open.name} projectName={open.projectName} data={data} perms={perms} canDecide={canDecide} onClose={() => setOpen(null)} onDone={done} />}
    </>
  )
}
