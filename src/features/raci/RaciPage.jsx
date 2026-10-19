import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Pencil, TriangleAlert, X } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { listOf, pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import '../project-management/baselines/baselines.css'
import '../task-management/tasks.css'
import '../meetings/meetings.css'
import RaciDialog from './RaciDialog'
import { ITEM_TYPES, ROLES, explainRaciError, gapsOf, raciPerms, rolesOfItem } from './raciModel'
import './raci.css'

/**
 * ماتریس مسئولیت‌ها (RACI): who is Responsible, Accountable, Consulted or Informed for each activity, deliverable and task of the
 * selected project. Backed by the optional Raci module of the Core; the matrix is the project's own, empty until someone fills it.
 */
export default function RaciPage({ data }) {
  const { can } = useAuth()
  const perms = raciPerms(can)
  const project = data.selectedProject
  const [tab, setTab] = useState(0)
  const [notice, setNotice] = useState(null)
  const [dialog, setDialog] = useState(null) // { id, name }
  const [rows, setRows] = useState(null) // the matrix the last save answered with; null = the loader's
  const matrix = useLoader(() => pmApi.raci.list(project.id), `${project?.id}`, Boolean(project) && perms.view, { list: true, explain: explainRaciError })
  const all = rows ?? matrix.value
  const say = useCallback((type, text) => setNotice({ type, text }), [])

  const items = useMemo(() => {
    if (tab === 0) return data.activities.map((item) => ({ id: item.id, name: item.name || item.title || item.description || '—' }))
    if (tab === 1) return data.deliverables.map((item) => ({ id: item.id, name: item.title || item.name || '—' }))
    return data.tasks.map((item) => ({ id: item.id, name: item.title || item.name || '—' }))
  }, [tab, data.activities, data.deliverables, data.tasks])
  const perItem = useMemo(() => items.map((item) => ({ ...item, byUser: rolesOfItem(all, tab, item.id) })), [items, all, tab])
  const people = useMemo(() => {
    const ids = new Set([...(data.teamMembers || []).map((member) => member.userId), ...(data.governanceRoles || []).map((role) => role.userId).filter(Boolean)])
    all.filter((row) => ITEM_TYPES[tab].value === (typeof row.itemType === 'number' ? row.itemType : ITEM_TYPES.find((t) => t.key === row.itemType)?.value)).forEach((row) => ids.add(row.userId))
    return [...ids]
  }, [data.teamMembers, data.governanceRoles, all, tab])
  const missing = perItem.filter((item) => { const gaps = gapsOf(item.byUser); return !gaps.empty && (gaps.noAccountable || gaps.noResponsible) }).length
  const filled = perItem.filter((item) => Object.keys(item.byUser).length > 0).length
  const loading = (data.loading && !data.projects.length) || data.loadingDetails

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / ماتریس مسئولیت‌ها (RACI)</span><h1>ماتریس مسئولیت‌ها (RACI)</h1><p>مسئول، پاسخگو، مشاور و مطلع برای هر فعالیت، خروجی و وظیفه</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(e) => { data.setSelectedProjectId(e.target.value); setNotice(null); setRows(null) }} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}<span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel bl-panel">
        {!perms.view ? <p className="data-state">برای مشاهده‌ی ماتریس مسئولیت‌ها به دسترسی «مشاهده RACI» نیاز دارید.</p>
          : loading ? <p className="data-state">در حال دریافت اطلاعات...</p>
          : !project ? <p className="data-state">هنوز پروژه‌ای ثبت نشده است.</p>
          : matrix.error ? <p className="data-state data-state--error">{matrix.error} <button type="button" className="prj-clear" onClick={matrix.reload}>تلاش دوباره</button></p> : (
            <>
              <div className="bl-tabs" role="tablist">
                {ITEM_TYPES.map(({ value, label }) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{label}</button>)}
              </div>
              <div className="raci-legend">
                {ROLES.map((role) => <span key={role.key} title={role.hint}><i className={role.cls}>{role.letter}</i>{role.label}</span>)}
                <span className="rc-summary">{filled.toLocaleString('fa-IR')} از {perItem.length.toLocaleString('fa-IR')} مورد نقش دارد{missing > 0 ? `؛ ${missing.toLocaleString('fa-IR')} مورد ناقص (بدون R یا A)` : ''}</span>
              </div>
              {!perItem.length ? <p className="data-state">در این پروژه هنوز {ITEM_TYPES[tab].one}ی ثبت نشده است.</p> : (
                <div className="table-scroll"><table className="users-table rc-table" style={{ minWidth: 640 }}>
                  <thead><tr><th>{ITEM_TYPES[tab].one}</th>{people.map((userId) => <th key={userId}><span className="rc-person">{data.userName(userId)}</span></th>)}<th aria-label="وضعیت" /><th>عملیات</th></tr></thead>
                  <tbody>{perItem.map((item) => {
                    const gaps = gapsOf(item.byUser)
                    const outside = Object.keys(item.byUser).filter((userId) => !people.includes(userId))
                    return (
                      <tr key={item.id}>
                        <td><strong>{item.name}</strong></td>
                        {people.map((userId) => (
                          <td key={userId}><span className="rc-cell">{ROLES.filter((role) => item.byUser[userId]?.has(role.value)).map((role) => <i key={role.key} className={`raci-role ${role.cls}`} title={role.label}>{role.letter}</i>)}</span></td>
                        ))}
                        <td>{!gaps.empty && (gaps.noAccountable || gaps.noResponsible) && <span className="rc-gap" title={[gaps.noResponsible && 'بدون مسئول اجرا (R)', gaps.noAccountable && 'بدون پاسخگو (A)'].filter(Boolean).join(' · ')}><TriangleAlert size={15} /></span>}{outside.length > 0 && <small className="bl-note">{outside.length.toLocaleString('fa-IR')} نفر دیگر</small>}</td>
                        <td><div className="row-actions"><button type="button" aria-label={`نقش‌های ${item.name}`} title={perms.edit ? 'ویرایش نقش‌ها' : 'نقش‌ها'} onClick={() => setDialog(item)}><Pencil size={15} /></button></div></td>
                      </tr>
                    )
                  })}</tbody>
                </table></div>
              )}
              {!perms.edit && <p className="docs-hint">برای ویرایش ماتریس دسترسی «ویرایش RACI» لازم است.</p>}
            </>
          )}
      </section>

      {dialog && project && (
        <RaciDialog project={project} itemType={tab} itemId={dialog.id} itemName={dialog.name} byUser={rolesOfItem(all, tab, dialog.id)} data={data} canEdit={perms.edit} onClose={() => setDialog(null)}
          onSaved={(result, text) => { setRows(listOf(result)); setDialog(null); say('success', text); matrix.reload() }} />
      )}
    </>
  )
}
