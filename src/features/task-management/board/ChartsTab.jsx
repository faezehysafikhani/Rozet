import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../services/AuthContext'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../../project-management/pmApi'
import { useLoader } from '../../project-management/useLoader'
import { BarChart, LineChart } from './charts'
import { explainTaskError, fmt, sprintStatusOf, taskPerms } from '../taskModel'

const METRICS = [{ value: 0, label: 'امتیاز' }, { value: 1, label: 'تعداد وظیفه' }]
const dayLabel = (iso) => formatJalali(iso).slice(5)

/** نمودارها: velocity per sprint, a sprint's burn-down / burn-up, and the project's progress sprint by sprint. */
export default function ChartsTab({ project, sprints, reloadKey }) {
  const { can } = useAuth()
  const perms = taskPerms(can)
  const [metric, setMetric] = useState(0)
  const [sprintId, setSprintId] = useState('')
  const [mode, setMode] = useState('down')
  const charted = useMemo(() => sprints.filter((sprint) => sprintStatusOf(sprint.status).value !== 0), [sprints])
  const unit = METRICS[metric].label
  useEffect(() => {
    if (sprintId && charted.some((sprint) => sprint.id === sprintId)) return
    const active = charted.find((sprint) => sprintStatusOf(sprint.status).value === 1) || charted[charted.length - 1]
    setSprintId(active?.id || '')
  }, [charted, sprintId])

  const velocity = useLoader(() => pmApi.agile.velocity(project.id, 10, metric), `${project.id}:${metric}:${reloadKey}`, perms.view, { explain: explainTaskError })
  const burn = useLoader(() => pmApi.agile.sprints.burn(sprintId, metric), `${sprintId}:${metric}:${reloadKey}`, perms.view && Boolean(sprintId), { explain: explainTaskError })
  const progress = useLoader(() => pmApi.agile.sprintProgress(project.id, metric), `${project.id}:${metric}:${reloadKey}`, perms.view, { explain: explainTaskError })
  const v = velocity.value
  const b = burn.value
  const p = progress.value

  if (!perms.view) return <p className="data-state">برای دیدن نمودارها به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p>
  return (
    <>
      <div className="tk-filters">
        <label>واحد<select value={metric} onChange={(e) => setMetric(Number(e.target.value))}>{METRICS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
      </div>

      <h4 className="bl-subtitle">سرعت تیم (Velocity)</h4>
      {velocity.loading && !v ? <p className="data-state">در حال محاسبه...</p> : velocity.error ? <p className="data-state data-state--error">{velocity.error}</p>
        : !v?.sprints?.length ? <p className="data-state">هنوز اسپرینت تمام‌شده‌ای نیست؛ سرعت از اسپرینت‌های تمام‌شده حساب می‌شود.</p> : (
          <>
            <div className="bl-cards">
              <article><small>میانگین سرعت</small><strong>{fmt(v.averageVelocity)}</strong><span>{unit} در هر اسپرینت</span></article>
              <article><small>میانگین تعهد</small><strong>{fmt(v.averageCommitted)}</strong><span>{unit} در ابتدای اسپرینت</span></article>
            </div>
            <BarChart label="سرعت اسپرینت‌ها" groups={v.sprints.map((sprint) => ({ label: sprint.name, values: [sprint.committed, sprint.completed] }))} series={[{ name: `تعهد (${unit})`, color: '#a9b8d4' }, { name: `انجام‌شده (${unit})`, color: '#3d845b' }]} average={v.averageVelocity} />
          </>
        )}

      <h4 className="bl-subtitle">نمودار یک اسپرینت</h4>
      {!charted.length ? <p className="data-state">اسپرینت فعال یا تمام‌شده‌ای برای رسم نمودار نیست.</p> : (
        <>
          <div className="tk-filters">
            <label>اسپرینت<select value={sprintId} onChange={(e) => setSprintId(e.target.value)}>{charted.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprintStatusOf(sprint.status).label})</option>)}</select></label>
            <label>نوع<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="down">فرسایشی (Burn-down)</option><option value="up">افزایشی (Burn-up)</option></select></label>
          </div>
          {burn.loading && !b ? <p className="data-state">در حال محاسبه...</p> : burn.error ? <p className="data-state data-state--error">{burn.error}</p> : b && (
            <>
              <div className="bl-cards">
                <article><small>تعهد اولیه</small><strong>{fmt(b.committedScope, 0)}</strong><span>{unit}</span></article>
                <article><small>اکنون در اسپرینت</small><strong>{fmt(b.currentScope, 0)}</strong><span>{unit}</span></article>
                <article><small>انجام‌شده</small><strong>{fmt(b.currentCompleted, 0)}</strong><span>{unit}</span></article>
                <article><small>باقی‌مانده</small><strong>{fmt(b.currentRemaining, 0)}</strong><span>{unit}</span></article>
              </div>
              {(b.warnings || []).length > 0 && <ul className="sch-warnings">{b.warnings.map((text) => <li key={text}>{text}</li>)}</ul>}
              <LineChart label={`نمودار ${b.name}`} labels={b.points.map((point) => dayLabel(point.date))}
                series={mode === 'down'
                  ? [{ name: 'ایده‌آل', color: '#607087', dashed: true, values: b.points.map((point) => point.idealRemaining) }, { name: 'باقی‌مانده', color: '#ac4d49', values: b.points.map((point) => point.remaining) }]
                  : [{ name: 'دامنه‌ی کار', color: '#103a7b', values: b.points.map((point) => point.scope) }, { name: 'انجام‌شده', color: '#3d845b', values: b.points.map((point) => point.completed) }]} />
            </>
          )}
        </>
      )}

      <h4 className="bl-subtitle">پیشرفت پروژه اسپرینت به اسپرینت</h4>
      {progress.loading && !p ? <p className="data-state">در حال محاسبه...</p> : progress.error ? <p className="data-state data-state--error">{progress.error}</p>
        : !p?.sprints?.length ? <p className="data-state">اسپرینتی برای نمایش نیست.</p> : (
          <LineChart label="پیشرفت تجمعی پروژه" labels={p.sprints.map((sprint) => sprint.name)}
            series={[{ name: `کل تجمعی (${unit})`, color: '#103a7b', values: p.sprints.map((sprint) => sprint.cumulativeTotal) }, { name: `انجام‌شده‌ی تجمعی (${unit})`, color: '#3d845b', values: p.sprints.map((sprint) => sprint.cumulativeCompleted) }, { name: 'باقی‌مانده', color: '#ac4d49', dashed: true, values: p.sprints.map((sprint) => sprint.cumulativeRemaining) }]} />
        )}
    </>
  )
}
