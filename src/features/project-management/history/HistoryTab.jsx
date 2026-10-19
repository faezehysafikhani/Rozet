import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { unwrap } from '../../../services/api'
import { pmApi } from '../pmApi'
import { CHANGE_KINDS, ENTITIES, changeKindOf, dayEnd, dayStart, entityLabel, explainHistoryError, formatInstant, formatValue, propertyLabel } from './historyModel'

const PAGE = 50

/** تاریخچه‌ی تغییرات: who added, edited or deleted what in the project, newest first, with filters and paging. */
export default function HistoryTab({ project, data, canView }) {
  const [filters, setFilters] = useState({ entityName: '', kind: '', userId: '', from: '', to: '' })
  const [state, setState] = useState({ items: [], total: 0, loading: Boolean(canView), more: false, error: '' })
  const [open, setOpen] = useState(() => new Set())
  const ticket = useRef(0)
  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const rangeError = filters.from && filters.to && filters.to < filters.from ? 'تاریخ پایان بازه نباید قبل از تاریخ شروع باشد.' : ''

  const load = useCallback(async (skip) => {
    const mine = ++ticket.current
    if (!canView || rangeError) { setState((current) => ({ ...current, loading: false })); return }
    setState((current) => ({ ...current, loading: true, more: skip > 0, error: '', items: skip === 0 ? [] : current.items }))
    const result = await pmApi.history.list({
      projectId: project.id, entityName: filters.entityName || undefined, kind: filters.kind === '' ? undefined : filters.kind, userId: filters.userId || undefined,
      from: filters.from ? dayStart(filters.from) : undefined, to: filters.to ? dayEnd(filters.to) : undefined, skip, take: PAGE,
    })
    if (mine !== ticket.current) return
    if (!result.isSuccess) { setState((current) => ({ ...current, loading: false, more: false, error: explainHistoryError(result) })); return }
    const page = unwrap(result) || {}
    setState((current) => ({ items: skip === 0 ? page.items || [] : [...current.items, ...(page.items || [])], total: page.total ?? 0, loading: false, more: false, error: '' }))
  }, [project.id, canView, rangeError, filters.entityName, filters.kind, filters.userId, filters.from, filters.to])

  useEffect(() => { setOpen(new Set()); load(0) }, [load])
  const toggle = (id) => setOpen((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })

  if (!canView) return <p className="data-state">برای مشاهده‌ی تاریخچه به دسترسی «مشاهده تاریخچه تغییرات پروژه» نیاز دارید.</p>
  const filtered = Object.values(filters).some(Boolean)
  return (
    <>
      <div className="bl-bar"><p>هر افزودن، ویرایش و حذفِ مربوط به پروژه (خود پروژه، فعالیت‌ها، گزارش‌ها، مستندات و...) با نام کاربر و مقدار قبل و بعد؛ جدیدترین‌ها اول.</p></div>
      <div className="hst-filters">
        <label>مورد<select value={filters.entityName} onChange={(e) => set('entityName', e.target.value)}><option value="">همه</option>{Object.entries(ENTITIES).map(([name, label]) => <option key={name} value={name}>{label}</option>)}</select></label>
        <label>نوع تغییر<select value={filters.kind} onChange={(e) => set('kind', e.target.value)}><option value="">همه</option>{CHANGE_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select></label>
        <label>کاربر<select value={filters.userId} onChange={(e) => set('userId', e.target.value)}><option value="">همه</option>{data.users.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select></label>
        <label>از تاریخ<JalaliDateInput value={filters.from} onChange={(value) => set('from', value)} yearsBack={5} yearsAhead={1} /></label>
        <label>تا تاریخ<JalaliDateInput value={filters.to} onChange={(value) => set('to', value)} yearsBack={5} yearsAhead={1} /></label>
        {filtered && <button type="button" className="prj-clear" onClick={() => setFilters({ entityName: '', kind: '', userId: '', from: '', to: '' })}>پاک کردن فیلترها</button>}
      </div>
      {rangeError && <p className="ue-error" role="alert">{rangeError}</p>}

      {rangeError ? null : state.error ? <p className="data-state data-state--error">{state.error} <button type="button" className="prj-clear" onClick={() => load(0)}>تلاش دوباره</button></p>
        : state.loading && !state.items.length ? <p className="data-state">در حال دریافت تاریخچه...</p>
        : !state.items.length ? <p className="data-state">{filtered ? 'تغییری با این فیلترها ثبت نشده است.' : 'هنوز تغییری برای این پروژه ثبت نشده است.'}</p> : (
          <>
            <p className="docs-hint">{state.items.length.toLocaleString('fa-IR')} از {state.total.toLocaleString('fa-IR')} تغییر</p>
            <div className="hst-list">
              {state.items.map((item) => {
                const kind = changeKindOf(item.kind)
                const when = formatInstant(item.changedAtUtc)
                const expanded = open.has(item.id)
                const changes = item.changes || []
                return (
                  <article key={item.id} className="hst-item">
                    <button type="button" className="hst-head" onClick={() => changes.length && toggle(item.id)} aria-expanded={expanded} disabled={!changes.length}>
                      {changes.length ? (expanded ? <ChevronDown size={15} /> : <ChevronLeft size={15} />) : <span style={{ width: 15 }} />}
                      <span className={`status-pill ${kind.tone}`}>{kind.label}</span>
                      <strong>{entityLabel(item.entityName)}</strong>
                      <span className="hst-who">{item.changedByUserId ? data.userName(item.changedByUserId) : 'سامانه'}</span>
                      <span className="hst-when">{when.day} · {when.time}</span>
                      {changes.length > 0 && <small>{changes.length.toLocaleString('fa-IR')} ویژگی</small>}
                    </button>
                    {expanded && (
                      <table className="users-table bl-table hst-changes">
                        <thead><tr><th>ویژگی</th><th>قبل</th><th>بعد</th></tr></thead>
                        <tbody>{changes.map((change) => (
                          <tr key={change.property}>
                            <td>{propertyLabel(change.property)}</td>
                            <td className="prg-text">{formatValue(change.property, change.oldValue, data.userName)}</td>
                            <td className="prg-text">{formatValue(change.property, change.newValue, data.userName)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </article>
                )
              })}
            </div>
            {state.items.length < state.total && <div className="hst-more"><button type="button" className="bl-button" onClick={() => load(state.items.length)} disabled={state.loading}>{state.more ? 'در حال دریافت...' : 'نمایش بیشتر'}</button></div>}
          </>
        )}
    </>
  )
}
