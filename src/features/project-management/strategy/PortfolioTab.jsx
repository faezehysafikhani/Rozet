import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { unwrap } from '../../../services/api'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { PROJECT_STATUSES } from '../projects/projectModel'
import { listOf, pmApi } from '../pmApi'
import { HEALTH, explainReportingError, fmt, healthOf, healthSeverity, index2, money } from '../progress/performanceModel'

const CONCURRENCY = 4
const MAX_PROJECTS = 50
const SORTS = [
  { key: 'health', label: 'وخیم‌ترین سلامت' },
  { key: 'delay', label: 'بیشترین تأخیر پیش‌بینی' },
  { key: 'actual', label: 'کمترین پیشرفت واقعی' },
  { key: 'alignment', label: 'کمترین همسوسازی' },
  { key: 'name', label: 'نام' },
]
const ACTION_CLOSED = new Set([2, 3, 'Completed', 'Cancelled'])

/** Runs `task` over `items` with at most `limit` in flight; results keep the order of `items`. */
async function mapLimited(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await task(items[index]) }
  }))
  return results
}

const byProject = (list) => list.reduce((map, item) => { (map[item.projectId] ||= []).push(item); return map }, {})

/**
 * نمای سبد پروژه‌ها: every project side by side - progress, health (SPI / CPI), forecast delay, risks, obstacles (delay reasons),
 * commitments (contracts), open and overdue actions and strategy alignment - so the weakest projects are seen first.
 * Each figure comes from its own Core call and is left out (shown as "—") when the user cannot see it.
 */
export default function PortfolioTab({ data, perms }) {
  const projects = useMemo(() => data.projects.slice(0, MAX_PROJECTS), [data.projects])
  const ids = useMemo(() => projects.map((item) => item.id), [projects])
  const [state, setState] = useState({ loading: true, perf: {}, risks: {}, delays: {}, actions: {}, align: {}, errors: {}, done: 0 })
  const [reloadKey, setReloadKey] = useState(0)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState('health')
  const ticket = useRef(0)
  const today = todayIso()

  useEffect(() => {
    const mine = ++ticket.current
    const fresh = { loading: true, perf: {}, risks: {}, delays: {}, actions: {}, align: {}, errors: {}, done: 0 }
    setState(fresh)
    if (!ids.length) { setState({ ...fresh, loading: false }); return }
    const live = () => mine === ticket.current
    const patch = (change) => live() && setState((current) => ({ ...current, ...change(current) }))
    ;(async () => {
      const side = []
      if (perms.viewRisks) side.push(pmApi.risks.forProjects(ids).then((r) => patch((c) => (r.isSuccess ? { risks: byProject(listOf(r)) } : { errors: { ...c.errors, risks: true } }))))
      if (perms.viewDelays) side.push(pmApi.delayReasons.forProjects(ids).then((r) => patch((c) => (r.isSuccess ? { delays: byProject(listOf(r)) } : { errors: { ...c.errors, delays: true } }))))
      if (perms.viewActions) side.push(pmApi.actions.list().then((r) => patch((c) => (r.isSuccess ? { actions: byProject(listOf(r).filter((a) => a.projectId)) } : { errors: { ...c.errors, actions: true } }))))
      if (perms.viewAlignment) side.push(pmApi.alignment.scores({ projectIds: ids }).then((r) => patch((c) => (r.isSuccess ? { align: Object.fromEntries((unwrap(r) || []).map((e) => [e.projectId, e.percentage])) } : { errors: { ...c.errors, align: true } }))))
      const main = perms.viewReporting
        ? mapLimited(ids, CONCURRENCY, async (id) => {
          const r = await pmApi.reporting.projectPerformance(id)
          patch((c) => ({ perf: r.isSuccess ? { ...c.perf, [id]: unwrap(r) } : c.perf, errors: r.isSuccess ? c.errors : { ...c.errors, perf: explainReportingError(r) }, done: c.done + 1 }))
        })
        : Promise.resolve()
      await Promise.all([main, ...side])
      patch(() => ({ loading: false }))
    })()
  }, [ids, reloadKey, perms.viewReporting, perms.viewRisks, perms.viewDelays, perms.viewActions, perms.viewAlignment])

  const rows = useMemo(() => projects.map((project) => {
    const perf = state.perf[project.id]
    const risks = state.risks[project.id] || []
    const delays = state.delays[project.id] || []
    const actions = (state.actions[project.id] || []).filter((a) => !ACTION_CLOSED.has(a.status))
    return {
      project, perf,
      risk: { total: risks.length, high: risks.filter((r) => String(r.level).toLowerCase() === 'red').length },
      delay: { count: delays.length, days: delays.reduce((sum, d) => sum + Number(d.timeImpactDays || 0), 0) },
      actions: { open: actions.length, overdue: actions.filter((a) => a.endDate && a.endDate < today).length },
      align: state.align[project.id],
    }
  }), [projects, state, today])

  const shown = useMemo(() => {
    const list = rows.filter((row) => filter === '' || (row.perf && healthOf(row.perf.health).key === filter))
    const num = (value, fallback) => (value === null || value === undefined ? fallback : Number(value))
    const order = {
      health: (a, b) => healthSeverity(a.perf?.health) - healthSeverity(b.perf?.health) || num(a.perf?.spi, 9) - num(b.perf?.spi, 9),
      delay: (a, b) => num(b.perf?.forecastDelayDays, -1) - num(a.perf?.forecastDelayDays, -1),
      actual: (a, b) => num(a.perf?.actualProgress, 999) - num(b.perf?.actualProgress, 999),
      alignment: (a, b) => num(a.align, 999) - num(b.align, 999),
      name: (a, b) => a.project.name.localeCompare(b.project.name, 'fa'),
    }[sort]
    return [...list].sort(order)
  }, [rows, filter, sort])

  const withPerf = rows.filter((row) => row.perf)
  const count = (key) => withPerf.filter((row) => healthOf(row.perf.health).key === key).length
  const summary = {
    overdue: withPerf.filter((row) => row.perf.isOverdue).length,
    delayed: withPerf.filter((row) => (row.perf.forecastDelayDays || 0) > 0).length,
    openActions: rows.reduce((sum, row) => sum + row.actions.open, 0),
    overdueActions: rows.reduce((sum, row) => sum + row.actions.overdue, 0),
    highRisks: rows.reduce((sum, row) => sum + row.risk.high, 0),
  }

  if (!perms.viewReporting && !perms.viewRisks && !perms.viewDelays && !perms.viewActions && !perms.viewAlignment) {
    return <p className="data-state">برای دیدن نمای سبد پروژه‌ها حداقل یکی از دسترسی‌های گزارش‌ها، ریسک، دلایل تأخیر، اقدام‌ها یا همسوسازی لازم است.</p>
  }
  const statusLabel = (value) => PROJECT_STATUSES.find((item) => item.value === value || item.key === value)?.label || String(value ?? '—')
  return (
    <>
      <div className="bl-bar"><p>مقایسه‌ی همه‌ی پروژه‌ها در یک نگاه برای اولویت‌بندی و تصمیم‌گیری؛ وخیم‌ترین پروژه‌ها اول می‌آیند. {data.projects.length > MAX_PROJECTS ? `فقط ${MAX_PROJECTS.toLocaleString('fa-IR')} پروژه‌ی اول بررسی می‌شود.` : ''}</p>
        <div className="bl-bar-actions"><button type="button" className="bl-button" onClick={() => setReloadKey((v) => v + 1)} disabled={state.loading}>{state.loading ? `در حال محاسبه (${state.done.toLocaleString('fa-IR')} از ${ids.length.toLocaleString('fa-IR')})` : 'به‌روزرسانی'}</button></div>
      </div>

      {perms.viewReporting && (
        <div className="bl-cards pf-cards">
          {HEALTH.filter((item) => item.key !== 'Unknown').reverse().map((item) => (
            <article key={item.key} className={`pf-health ${item.tone}`}><small>{item.label}</small><strong>{count(item.key).toLocaleString('fa-IR')}</strong><span>پروژه</span></article>
          ))}
          <article><small>نامشخص</small><strong>{count('Unknown').toLocaleString('fa-IR')}</strong><span>داده‌ی ناکافی</span></article>
          <article><small>سررسید گذشته / با تأخیر پیش‌بینی</small><strong>{summary.overdue.toLocaleString('fa-IR')} / {summary.delayed.toLocaleString('fa-IR')}</strong><span>پروژه</span></article>
          {perms.viewActions && <article><small>اقدام باز / معوق</small><strong>{summary.openActions.toLocaleString('fa-IR')} / {summary.overdueActions.toLocaleString('fa-IR')}</strong><span>اقدام‌های پروژه‌ها</span></article>}
          {perms.viewRisks && <article><small>ریسک بحرانی (قرمز)</small><strong>{summary.highRisks.toLocaleString('fa-IR')}</strong><span>در همه‌ی پروژه‌ها</span></article>}
        </div>
      )}
      {!perms.viewReporting && <p className="docs-hint">شاخص‌های سلامت و پیشرفت به دسترسی «مشاهده‌ی همه‌ی گزارش‌ها» (Reporting.ViewAll) نیاز دارند و در این نما نیامده‌اند.</p>}
      {state.errors.perf && <p className="data-state data-state--error">{state.errors.perf}</p>}
      {(state.errors.risks || state.errors.delays || state.errors.actions || state.errors.align) && <p className="docs-hint">بخشی از ستون‌ها (ریسک، موانع، اقدام‌ها یا همسوسازی) بارگذاری نشد و با «—» نشان داده شده است.</p>}

      <div className="hst-filters">
        <label>سلامت<select value={filter} onChange={(e) => setFilter(e.target.value)} disabled={!perms.viewReporting}><option value="">همه</option>{HEALTH.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label>مرتب‌سازی<select value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
      </div>

      {!ids.length ? <p className="data-state">پروژه‌ای برای نمایش نیست.</p>
        : !shown.length && !state.loading ? <p className="data-state">پروژه‌ای با این فیلتر نیست.</p> : (
          <div className="table-scroll"><table className="users-table bl-table pf-table" style={{ minWidth: 1280 }}>
            <thead><tr><th>پروژه</th><th>سلامت</th><th>پیشرفت (واقعی از برنامه‌ای)</th><th>SPI / CPI</th><th>پیش‌بینی پایان</th><th>ریسک</th><th>موانع</th><th>قراردادها (ریال)</th><th>اقدام باز / معوق</th><th>همسوسازی</th></tr></thead>
            <tbody>{shown.map(({ project, perf, risk, delay, actions, align }) => {
              const health = perf ? healthOf(perf.health) : null
              return (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong><small className="bl-note">{project.code}{perf ? ` · ${statusLabel(perf.status)}` : ''}</small></td>
                  <td>{health ? <span className={`status-pill ${health.tone}`}>{health.label}</span> : state.loading && perms.viewReporting ? '…' : '—'}</td>
                  <td>{perf && perf.progressAvailable ? (
                    <div className="prj-progress" title={`برنامه‌ای ${fmt(perf.plannedProgress)}٪ — واقعی ${fmt(perf.actualProgress)}٪`}>
                      <span><i style={{ width: `${Math.min(100, perf.plannedProgress || 0)}%` }} className="planned" /></span>
                      <span><i style={{ width: `${Math.min(100, perf.actualProgress || 0)}%` }} className="actual" /></span>
                      <small>{fmt(perf.actualProgress, 0)}٪ از {fmt(perf.plannedProgress, 0)}٪</small>
                    </div>
                  ) : '—'}</td>
                  <td className="pf-nums">{perf ? `${index2(perf.spi)} / ${index2(perf.cpi)}` : '—'}</td>
                  <td>{perf ? (<>{perf.forecastEnd ? formatJalali(perf.forecastEnd) : '—'}{perf.isOverdue && <em className="bl-tag pf-late"><CalendarClock size={12} />سررسید گذشته</em>}{perf.forecastDelayDays > 0 && <small className="bl-note">{fmt(perf.forecastDelayDays, 0)} روز تأخیر</small>}</>) : '—'}</td>
                  <td>{perms.viewRisks && !state.errors.risks ? <>{risk.total.toLocaleString('fa-IR')}{risk.high > 0 && <em className="bl-tag pf-late">{risk.high.toLocaleString('fa-IR')} بحرانی</em>}</> : '—'}</td>
                  <td>{perms.viewDelays && !state.errors.delays ? (delay.count ? <>{delay.count.toLocaleString('fa-IR')}<small className="bl-note">{delay.days ? `${fmt(delay.days, 0)} روز اثر زمانی` : 'بدون اثر زمانی'}</small></> : '۰') : '—'}</td>
                  <td>{perf && perf.contractedAmount !== null && perf.contractedAmount !== undefined ? <>{money(perf.contractedAmount)}<small className="bl-note">فاکتور تأییدشده: {money(perf.invoicedAmount)}</small></> : '—'}</td>
                  <td>{perms.viewActions && !state.errors.actions ? <>{actions.open.toLocaleString('fa-IR')} / <b className={actions.overdue ? 'bl-var late' : ''}>{actions.overdue.toLocaleString('fa-IR')}</b></> : '—'}</td>
                  <td>{align === undefined ? '—' : `${fmt(align, 0)}٪`}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      <p className="docs-hint">سلامت از SPI و CPI می‌آید (از ۰٫۹۵ بالا سالم، ۰٫۸۵ تا ۰٫۹۵ در معرض خطر، پایین‌تر بحرانی). ریسک بحرانی یعنی خانه‌ی قرمز ماتریس ریسک. اقدام معوق یعنی اقدام بازی که موعدش گذشته. موانع همان دلایل ثبت‌شده‌ی تأخیر پروژه است.</p>
    </>
  )
}
