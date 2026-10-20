import { useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, FolderOpen, ListTodo, TrendingUp,
} from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { useDashboard } from '../../hooks/useDashboard'
import { formatJalali, todayIso } from '../../utils/jalali'
import { useDashboardActions } from './useDashboardActions'
import {
  PRIORITY_LABELS, actionStatusKey, donutArcs, faNumber, longJalaliDate, monthlyActivity, myOpenActions, niceScale, priorityKey,
  registrationTrend, sharePercent, smoothPath, statusCounts,
} from './dashboardModel'
import './dashboard.css'

const TYPE_LABELS = { 0: 'آبشاری', 1: 'چابک', Waterfall: 'آبشاری', Agile: 'چابک' }

function projectName(project) {
  if (!project) return 'بدون پروژه'
  if (project.name && project.name !== 'string') return project.name
  if (project.code && project.code !== 'string') return `پروژه ${project.code}`
  return 'پروژه ثبت‌شده'
}

function Trend({ trend }) {
  if (!trend) return null
  if (trend.kind === 'share') return <span className="dh-trend is-share">{faNumber(trend.percent)}٪ {trend.text}</span>
  if (trend.kind === 'new') return <span className="dh-trend is-up"><ArrowUpRight size={15} />{faNumber(trend.recent)} جدید</span>
  const Icon = trend.kind === 'up' ? ArrowUpRight : ArrowDownRight
  return <span className={`dh-trend is-${trend.kind}`}><Icon size={15} /><bdi dir="ltr">{trend.kind === 'up' ? '+' : '−'}{faNumber(trend.percent)}٪</bdi></span>
}

function KpiCard({ label, value, trend, note, icon: Icon, tone }) {
  return (
    <article className="dh-kpi">
      <div className="dh-kpi__top"><span>{label}</span><i className={`dh-tile is-${tone}`}><Icon size={22} strokeWidth={1.9} /></i></div>
      <div className="dh-kpi__value"><strong>{faNumber(value)}</strong><Trend trend={trend} /></div>
      <p>{note}</p>
    </article>
  )
}

function StatusDonut({ segments, summaryScope }) {
  const R = 78
  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const arcs = donutArcs(segments, R)
  return (
    <article className="dh-panel dh-status">
      <header><h3>وضعیت پروژه‌ها</h3><p>{summaryScope ? 'تعداد پروژه‌های سازمان به تفکیک وضعیت' : 'تعداد پروژه‌های قابل مشاهده برای شما به تفکیک وضعیت'}</p></header>
      <div className="dh-status__body">
        <ul className="dh-legend">
          {segments.map((segment) => (
            <li key={segment.key}><i style={{ background: segment.color }} /><span>{segment.label}</span><b>{faNumber(segment.count)}</b></li>
          ))}
        </ul>
        <div className="dh-donut" role="img" aria-label={`${faNumber(total)} پروژه`}>
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={R} className="dh-donut__track" />
            {arcs.map((arc) => (
              <circle
                key={arc.key} cx="100" cy="100" r={R} fill="none" stroke={arc.color} strokeWidth="26"
                strokeDasharray={`${arc.dash} ${arc.rest}`} strokeDashoffset={arc.offset} transform="rotate(-90 100 100)"
              />
            ))}
          </svg>
          <div><strong>{faNumber(total)}</strong><small>پروژه</small></div>
        </div>
      </div>
    </article>
  )
}

const CHART = { w: 640, h: 300, left: 40, right: 14, top: 18, bottom: 40 }

function ActivityChart({ months, allowed, loading, failed }) {
  const [picked, setPicked] = useState(null)
  const selected = picked ?? months.length - 1
  const peak = Math.max(0, ...months.flatMap((m) => [m.started, m.completed]))
  const scale = niceScale(peak)
  const innerW = CHART.w - CHART.left - CHART.right
  const innerH = CHART.h - CHART.top - CHART.bottom
  const xAt = (i) => CHART.left + (months.length > 1 ? (i * innerW) / (months.length - 1) : innerW / 2)
  const yAt = (v) => CHART.top + innerH * (1 - v / scale.max)
  const pointsOf = (key) => months.map((m, i) => ({ x: xAt(i), y: yAt(m[key]) }))
  const done = pointsOf('completed')
  const started = pointsOf('started')
  const donePath = smoothPath(done)
  const area = done.length ? `${donePath} L ${done.at(-1).x} ${CHART.top + innerH} L ${done[0].x} ${CHART.top + innerH} Z` : ''
  const current = months[selected]

  function track(event) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * CHART.w
    let best = 0
    months.forEach((_, i) => { if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i })
    setPicked(best)
  }

  return (
    <article className="dh-panel dh-activity">
      <header>
        <div><h3>فعالیت اقدام‌ها</h3><p>مقایسه‌ی اقدام‌های شروع‌شده و تکمیل‌شده در ماه‌های اخیر</p></div>
        {allowed && current && (
          <label className="dh-month-picker">
            <span><small>{current.label} {Number(current.jy).toLocaleString('fa-IR', { useGrouping: false })}</small><b>{faNumber(current.completed)} اقدام</b></span>
            <ChevronDown size={16} />
            <select value={selected} onChange={(e) => setPicked(Number(e.target.value))} aria-label="انتخاب ماه">
              {months.map((m, i) => <option key={m.index} value={i}>{m.label} {Number(m.jy).toLocaleString('fa-IR', { useGrouping: false })}</option>)}
            </select>
          </label>
        )}
      </header>

      {!allowed && <p className="dh-note">برای دیدن این نمودار به دسترسی «مشاهده اقدام‌ها» نیاز دارید.</p>}
      {allowed && failed && <p className="dh-note">دریافت اقدام‌ها ناموفق بود.</p>}
      {allowed && !failed && (
        <>
          <div className="dh-chart" dir="ltr">
            <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} onPointerMove={track} onPointerLeave={() => setPicked(null)} role="img" aria-label="نمودار اقدام‌های شروع‌شده و تکمیل‌شده">
              <defs>
                <linearGradient id="dh-area" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#0b3d91" stopOpacity=".16" /><stop offset="1" stopColor="#0b3d91" stopOpacity="0" />
                </linearGradient>
              </defs>
              {scale.ticks.map((tick) => (
                <g key={tick}>
                  <line x1={CHART.left} x2={CHART.w - CHART.right} y1={yAt(tick)} y2={yAt(tick)} className="dh-grid" />
                  <text x={CHART.left - 10} y={yAt(tick) + 4} textAnchor="end" className="dh-axis">{faNumber(tick)}</text>
                </g>
              ))}
              {months.map((m, i) => <line key={m.index} x1={xAt(i)} x2={xAt(i)} y1={CHART.top} y2={CHART.top + innerH} className="dh-grid is-vertical" />)}
              {area && <path d={area} fill="url(#dh-area)" />}
              <path d={smoothPath(started)} className="dh-line is-started" />
              <path d={donePath} className="dh-line is-done" />
              {current && (
                <g>
                  <line x1={xAt(selected)} x2={xAt(selected)} y1={CHART.top} y2={CHART.top + innerH} className="dh-cursor" />
                  <circle cx={xAt(selected)} cy={yAt(current.completed)} r="6" className="dh-dot is-done" />
                  <circle cx={xAt(selected)} cy={yAt(current.started)} r="4.5" className="dh-dot is-started" />
                </g>
              )}
              {months.map((m, i) => <text key={m.index} x={xAt(i)} y={CHART.h - 12} textAnchor="middle" className="dh-axis is-month">{m.label}</text>)}
            </svg>
            {current && (
              <div className={`dh-tip ${selected >= months.length - 2 ? 'is-end' : selected <= 1 ? 'is-start' : ''}`} style={{ left: `${(xAt(selected) / CHART.w) * 100}%`, top: `${(Math.min(yAt(current.completed), yAt(current.started)) / CHART.h) * 100}%` }} dir="rtl">
                <small>{current.label} {Number(current.jy).toLocaleString('fa-IR', { useGrouping: false })}</small>
                <b><i className="is-done" />{faNumber(current.completed)} تکمیل‌شده</b>
                <b><i className="is-started" />{faNumber(current.started)} شروع‌شده</b>
              </div>
            )}
          </div>
          <footer className="dh-chart-legend">
            <span><i className="is-done" />تکمیل شده</span>
            <span><i className="is-started" />شروع شده</span>
          </footer>
          {loading && <p className="dh-note">در حال دریافت...</p>}
          <small className="dh-foot">اقدام‌ها تاریخ ثبت ندارند؛ شروع‌شده بر پایه‌ی تاریخ شروع و تکمیل‌شده بر پایه‌ی تاریخ پایانِ اقدام‌های تکمیل‌شده شمرده می‌شود.</small>
        </>
      )}
    </article>
  )
}

function MyActions({ actions, projectById, allowed, loading, onOpenAll }) {
  const today = todayIso()
  return (
    <article className="dh-panel dh-side">
      <header><h3>اقدام‌های من</h3><button type="button" onClick={onOpenAll}>مشاهده همه</button></header>
      {!allowed ? <p className="dh-note">برای دیدن اقدام‌ها به دسترسی «مشاهده اقدام‌ها» نیاز دارید.</p> : actions.length ? (
        <ul className="dh-actions">
          {actions.map((action) => {
            const priority = priorityKey(action.priority)
            const late = action.endDate && String(action.endDate).slice(0, 10) < today
            return (
              <li key={action.id}>
                <i className={`dh-ring is-${actionStatusKey(action.status) === 'InProgress' ? 'progress' : 'open'}`} aria-hidden="true" />
                <div>
                  <strong>{action.title}</strong>
                  <small>{projectName(projectById.get(action.projectId))}</small>
                  <span className={late ? 'is-late' : ''}><CalendarDays size={14} />{action.endDate ? formatJalali(String(action.endDate).slice(0, 10)) : 'بدون موعد'}</span>
                </div>
                <em className={`dh-priority is-${priority.toLowerCase()}`}>{PRIORITY_LABELS[priority] || priority}</em>
              </li>
            )
          })}
        </ul>
      ) : <p className="dh-note">{loading ? 'در حال دریافت...' : 'اقدام بازی برای شما نیست.'}</p>}
    </article>
  )
}

function RecentProjects({ projects, loading, onOpenAll }) {
  return (
    <article className="dh-panel dh-side">
      <header><h3>آخرین پروژه‌های ثبت‌شده</h3><button type="button" onClick={onOpenAll}>مشاهده همه</button></header>
      {projects.length ? (
        <ul className="dh-recent">
          {projects.map((project, index) => (
            <li key={project.id}>
              <i className={`dh-tile is-${index % 2 ? 'gold' : 'blue'}`}><FolderOpen size={19} /></i>
              <div>
                <strong>{projectName(project)}</strong>
                <small>{[project.code, TYPE_LABELS[project.type]].filter(Boolean).join(' · ')}</small>
              </div>
              <time>{project.createdAtUtc ? formatJalali(String(project.createdAtUtc).slice(0, 10)) : ''}</time>
            </li>
          ))}
        </ul>
      ) : <p className="dh-note">{loading ? 'در حال دریافت...' : 'هنوز پروژه‌ای ثبت نشده است.'}</p>}
    </article>
  )
}

/** Main dashboard: the caller's numbers and the organisation's, read from the Core. */
export default function DashboardHome({ onOpenProjects, onOpenActions }) {
  const { user } = useAuth()
  const { loading, error, mine, summary, projects, canMine, canAll, canProjects } = useDashboard()
  const actionData = useDashboardActions()

  const today = todayIso()
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const segments = useMemo(() => statusCounts(summary, projects), [summary, projects])
  const months = useMemo(() => monthlyActivity(actionData.actions, today), [actionData.actions, today])
  const myActions = useMemo(() => myOpenActions(actionData.actions, mine, user?.id), [actionData.actions, mine, user?.id])
  const recent = useMemo(() => [...projects]
    .sort((a, b) => String(b.createdAtUtc || '').localeCompare(String(a.createdAtUtc || '')))
    .slice(0, 3), [projects])

  const completedActions = actionData.actions.filter((a) => actionStatusKey(a.status) === 'Completed').length
  const cards = summary
    ? [
      { label: 'کل پروژه‌ها', value: summary.projectCount, trend: registrationTrend(projects), note: 'همه پروژه‌های سازمان', icon: FolderOpen, tone: 'gold' },
      {
        label: 'پروژه‌های در جریان', value: summary.runningProjectCount,
        trend: sharePercent(summary.runningProjectCount, summary.projectCount) === null ? null : { kind: 'share', percent: sharePercent(summary.runningProjectCount, summary.projectCount), text: 'از کل' },
        note: mine ? `از این تعداد ${faNumber(mine.myRunningProjectCount)} پروژه با شما است` : 'فعال یا متوقف', icon: TrendingUp, tone: 'blue',
      },
      {
        label: 'کل اقدامات', value: summary.actionCount,
        trend: actionData.allowed && summary.actionCount > 0 ? { kind: 'share', percent: sharePercent(completedActions, summary.actionCount), text: 'تکمیل‌شده' } : null,
        note: 'همه اقدام‌های سازمان', icon: ListTodo, tone: 'mint',
      },
      {
        label: 'اقدام‌های در جریان', value: summary.runningActionCount,
        trend: sharePercent(summary.runningActionCount, summary.actionCount) === null ? null : { kind: 'share', percent: sharePercent(summary.runningActionCount, summary.actionCount), text: 'از کل' },
        note: mine ? `از این تعداد ${faNumber(mine.myRunningActionCount)} اقدام با شما است` : 'باز یا در حال انجام', icon: CheckCircle2, tone: 'violet',
      },
    ]
    : mine
      ? [
        { label: 'پروژه‌های در جریان من', value: mine.myRunningProjectCount, note: 'پروژه‌هایی که مالک یا مدیر آن هستید', icon: TrendingUp, tone: 'blue' },
        { label: 'اقدام‌های در جریان من', value: mine.myRunningActionCount, note: 'اقدام‌هایی که مسئول یا مالک آن هستید', icon: CheckCircle2, tone: 'violet' },
      ]
      : []

  const noAccess = !canMine && !canAll && !canProjects

  return (
    <div className="dh">
      <div className="dh-main">
        <header className="dh-head">
          <span>{longJalaliDate(today)}</span>
          <h1>داشبورد اصلی</h1>
        </header>

        {noAccess && <p className="data-state">برای مشاهده داشبورد به دسترسی «مشاهده داشبورد شخصی» یا «مشاهده فهرست پروژه‌ها» نیاز دارید.</p>}
        {!noAccess && loading && <p className="data-state">در حال دریافت اطلاعات داشبورد...</p>}
        {!noAccess && !loading && error && <p className="data-state data-state--error">{error}</p>}

        {cards.length > 0 && <section className="dh-kpis">{cards.map((card) => <KpiCard key={card.label} {...card} />)}</section>}

        {(canProjects || canAll) && (
          <section className="dh-charts">
            <StatusDonut segments={segments} summaryScope={Boolean(summary)} />
            <ActivityChart months={months} allowed={actionData.allowed} loading={actionData.loading} failed={actionData.failed} />
          </section>
        )}
      </div>

      {(canProjects || canAll || actionData.allowed) && (
        <aside className="dh-sidebar">
          <MyActions actions={myActions} projectById={projectById} allowed={actionData.allowed} loading={actionData.loading} onOpenAll={onOpenActions} />
          {(canProjects || canAll) && <RecentProjects projects={recent} loading={loading} onOpenAll={onOpenProjects} />}
        </aside>
      )}
    </div>
  )
}
