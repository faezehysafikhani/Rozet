import { useMemo, useState } from 'react'
import { CalendarCheck, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { JALALI_MONTHS, JALALI_WEEKDAYS, formatJalali, isoToJalali, todayIso } from '../../../utils/jalali'
import { EVENT_KINDS, buildMonthGrid, currentMonth, groupByDay, shiftMonth } from './calendarModel'
import { useCalendarData } from './useCalendarData'
import './calendar.css'

const fa = (value) => Number(value).toLocaleString('fa-IR', { useGrouping: false })
const MAX_CHIPS = 3
const ALL = 'all'

/**
 * تقویم پروژه: a Jalali month grid of what the Core knows about a project (or all of them) -
 * task due dates, activities, actions, deliverables and the project's own start and end - with the
 * work calendar's non-working days and the official holidays. Click a day for its details.
 */
export default function CalendarPage({ data }) {
  const { can } = useAuth()
  const [month, setMonth] = useState(currentMonth)
  const [scope, setScope] = useState(data.selectedProjectId || ALL)
  const [hidden, setHidden] = useState(() => new Set())
  const [selectedDay, setSelectedDay] = useState(todayIso())

  const grid = useMemo(() => buildMonthGrid(month.jy, month.jm), [month])
  const gridFrom = grid[0].iso
  const gridTo = grid[grid.length - 1].iso
  const today = todayIso()

  const scopeProjects = useMemo(
    () => (scope === ALL ? data.projects : data.projects.filter((project) => project.id === scope)),
    [scope, data.projects],
  )
  const { events, errors, loading, days, perms, reload, truncated } = useCalendarData({
    scopeProjects, allProjects: data.projects, gridFrom, gridTo, userName: data.userName,
  })

  const shown = useMemo(() => events.filter((event) => !hidden.has(event.kind)), [events, hidden])
  const byDay = useMemo(() => groupByDay(shown, gridFrom, gridTo), [shown, gridFrom, gridTo])
  const counts = useMemo(() => events.reduce((map, event) => ({ ...map, [event.kind]: (map[event.kind] || 0) + 1 }), {}), [events])

  const monthLabel = `${JALALI_MONTHS[month.jm - 1]} ${fa(month.jy)}`
  const goToday = () => { setMonth(currentMonth()); setSelectedDay(today) }
  const toggleKind = (key) => setHidden((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next })

  const selectedParts = isoToJalali(selectedDay)
  const selectedEvents = byDay[selectedDay] || []
  const selectedInfo = days[selectedDay]
  const yearOptions = Array.from({ length: 21 }, (_, index) => month.jy - 10 + index)

  function pickScope(value) {
    setScope(value)
    if (value !== ALL) data.setSelectedProjectId(value)
  }

  const problems = Object.entries(errors)
  const missing = EVENT_KINDS.filter((kind) => !perms[kind.key])

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت پروژه / تقویم پروژه</span><h1>تقویم پروژه</h1><p>موعد وظایف، فعالیت‌ها، اقدام‌ها و خروجی‌ها در تقویم شمسی همراه با تعطیلات</p></div>
        <div className="task-head-actions">
          <select className="project-selector" value={scope} onChange={(event) => pickScope(event.target.value)} aria-label="پروژه">
            <option value={ALL}>همه‌ی پروژه‌ها</option>
            {data.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
      </div>

      <section className="task-panel cal-panel">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="ماه قبل"><ChevronRight size={18} /></button>
            <strong aria-live="polite">{monthLabel}</strong>
            <button type="button" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="ماه بعد"><ChevronLeft size={18} /></button>
          </div>
          <button type="button" className="cal-today" onClick={goToday}><CalendarCheck size={16} />امروز</button>
          <select value={month.jm} onChange={(event) => setMonth({ ...month, jm: Number(event.target.value) })} aria-label="ماه">
            {JALALI_MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
          <select value={month.jy} onChange={(event) => setMonth({ ...month, jy: Number(event.target.value) })} aria-label="سال">
            {yearOptions.map((year) => <option key={year} value={year}>{fa(year)}</option>)}
          </select>
          <div className="cal-legend" role="group" aria-label="نوع رویدادها">
            {EVENT_KINDS.filter((kind) => perms[kind.key]).map((kind) => (
              <button key={kind.key} type="button" className={`cal-chip cal-ev--${kind.key}${hidden.has(kind.key) ? ' off' : ''}`} aria-pressed={!hidden.has(kind.key)} onClick={() => toggleKind(kind.key)}>
                {kind.label} <b>{(counts[kind.key] || 0).toLocaleString('fa-IR')}</b>
              </button>
            ))}
          </div>
        </div>

        {problems.map(([key, message]) => (
          <p key={key} className="cal-note cal-note--error" role="alert"><CircleAlert size={15} /> {EVENT_KINDS.find((kind) => kind.key === key)?.label}: {message} <button type="button" onClick={reload}>تلاش دوباره</button></p>
        ))}
        {missing.length > 0 && <p className="cal-note">برای نمایش {missing.map((kind) => kind.label).join('، ')} به دسترسی مشاهده‌ی همان بخش نیاز دارید.</p>}
        {truncated && <p className="cal-note">فقط ۴۰ پروژه‌ی اول نمایش داده می‌شود؛ یک پروژه را انتخاب کنید.</p>}
        {!data.projects.length && !data.loading && <p className="data-state">هنوز پروژه‌ای ثبت نشده است.</p>}
        {loading && data.projects.length > 0 && <p className="cal-note">در حال دریافت رویدادها...</p>}

        <div className="cal-grid" role="grid" aria-label={monthLabel}>
          {JALALI_WEEKDAYS.map((name, index) => <div key={name} className={`cal-weekday${index === 6 ? ' weekend' : ''}`} role="columnheader">{name}</div>)}
          {grid.map((cell, index) => {
            const info = days[cell.iso]
            const list = byDay[cell.iso] || []
            const friday = index % 7 === 6
            const off = info ? !info.isWorking : friday
            return (
              <div
                key={cell.iso}
                role="gridcell"
                tabIndex={0}
                aria-selected={cell.iso === selectedDay}
                aria-label={`${formatJalali(cell.iso, { month: 'long' })}${list.length ? `، ${list.length.toLocaleString('fa-IR')} رویداد` : ''}${info?.reason ? `، ${info.reason}` : ''}`}
                className={`cal-cell${cell.inMonth ? '' : ' dim'}${off ? ' off' : ''}${info?.official ? ' holiday' : ''}${cell.iso === today ? ' today' : ''}${cell.iso === selectedDay ? ' selected' : ''}`}
                onClick={() => setSelectedDay(cell.iso)}
                onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), setSelectedDay(cell.iso))}
              >
                <header><b>{fa(cell.day)}</b>{info?.reason && <small title={info.reason}>{info.reason}</small>}</header>
                {list.slice(0, MAX_CHIPS).map((event) => (
                  <span key={event.id} className={`cal-event cal-ev--${event.kind}${event.done ? ' done' : ''}${event.overdue ? ' overdue' : ''}`} title={`${event.title} — ${event.status}`}>
                    {event.start !== event.end && event.start !== cell.iso ? '↤ ' : ''}{event.title}
                  </span>
                ))}
                {list.length > MAX_CHIPS && <em>+{(list.length - MAX_CHIPS).toLocaleString('fa-IR')} مورد دیگر</em>}
              </div>
            )
          })}
        </div>
      </section>

      <section className="task-panel cal-details" aria-live="polite">
        <div className="task-panel-title"><div>
          <h3>{formatJalali(selectedDay, { month: 'long' })}{selectedParts && ` — ${JALALI_WEEKDAYS[(new Date(`${selectedDay}T00:00:00`).getDay() + 1) % 7]}`}</h3>
          <p>{selectedInfo ? (selectedInfo.isWorking ? 'روز کاری' : `غیرکاری${selectedInfo.reason ? `: ${selectedInfo.reason}` : ''}`) : 'رویدادهای این روز'}</p>
        </div></div>
        {selectedEvents.length === 0
          ? <p className="data-state">رویدادی برای این روز ثبت نشده است.</p>
          : (
            <ul className="cal-list">
              {selectedEvents.map((event) => (
                <li key={event.id} className={`cal-ev--${event.kind}${event.overdue ? ' overdue' : ''}`}>
                  <span className="cal-kind">{EVENT_KINDS.find((kind) => kind.key === event.kind)?.label}</span>
                  <div>
                    <strong>{event.title}</strong>
                    <small>{[event.start === event.end ? formatJalali(event.start) : `${formatJalali(event.start)} تا ${formatJalali(event.end)}`, ...event.meta].join(' · ')}</small>
                  </div>
                  <span className={`cal-status${event.done ? ' done' : event.overdue ? ' overdue' : ''}`}>{event.overdue ? 'دارای تأخیر' : event.status}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </>
  )
}
