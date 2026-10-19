import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../services/AuthContext'
import { listOf, pmApi } from '../pmApi'
import { explainPmError } from '../pmErrors'
import { actionEvent, activityEvent, deliverableEvent, projectEvents, taskEvent } from './calendarModel'

const MAX_PROJECTS_IN_ALL_SCOPE = 40

/**
 * Everything the project calendar draws, from the Core:
 *   events   tasks (due date), activities and actions (start-end), deliverables (target date), project start/end
 *   days     { iso: { isWorking, reason, official } } for the visible grid (work calendar + official holidays)
 * `scopeProjects` is the project(s) shown. A source the user may not read is skipped, not failed;
 * `errors` holds a Persian message for a source that failed.
 */
export function useCalendarData({ scopeProjects, allProjects, gridFrom, gridTo, userName }) {
  const { can } = useAuth()
  const [events, setEvents] = useState([])
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [calendars, setCalendars] = useState([])
  const [days, setDays] = useState({})
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)

  const projects = useMemo(() => scopeProjects.slice(0, MAX_PROJECTS_IN_ALL_SCOPE), [scopeProjects])
  const idsKey = projects.map((project) => project.id).join(',')
  const nameById = useMemo(() => Object.fromEntries(allProjects.map((project) => [project.id, project.name])), [allProjects])
  const projectName = useCallback((id) => nameById[id] || 'پروژه', [nameById])
  const singleProject = projects.length === 1 ? projects[0] : null
  const isAll = projects.length !== 1

  const perms = { project: can('Projects.View'), deliverable: can('Deliverables.View'), activity: can('WaterfallActivities.View'), action: can('Actions.View'), task: can('AgileTasks.View'), calendar: can('work_calendars.view') }
  const permKey = Object.values(perms).join('')

  // Records, loaded once per scope (not per month): the calendar pages through them locally.
  useEffect(() => {
    const mine = ++ticket.current
    if (!projects.length) { setEvents([]); setErrors({}); setLoading(false); return }
    setLoading(true)
    const ids = projects.map((project) => project.id)
    const context = { userName, projectName }
    ;(async () => {
      const jobs = {
        task: perms.task && pmApi.tasks.forProjects(ids),
        activity: perms.activity && Promise.all(ids.map((id) => pmApi.waterfall.activities.list(id))),
        deliverable: perms.deliverable && Promise.all(ids.map((id) => pmApi.deliverables.list(id))),
        action: perms.action && pmApi.actions.list(singleProject?.id),
      }
      const keys = Object.keys(jobs).filter((key) => jobs[key])
      const results = await Promise.all(keys.map((key) => jobs[key]))
      if (mine !== ticket.current) return

      const nextErrors = {}
      const collected = []
      keys.forEach((key, index) => {
        const result = results[index]
        const parts = Array.isArray(result) ? result : [result]
        const failed = parts.find((part) => !part.isSuccess)
        if (failed) { nextErrors[key] = explainPmError(failed); return }
        const records = parts.flatMap((part) => listOf(part))
        const make = { task: taskEvent, activity: activityEvent, deliverable: deliverableEvent, action: actionEvent }[key]
        records.forEach((record) => {
          // "All projects" shows the tenant's actions only when they belong to one of the shown projects or to none.
          if (key === 'action' && isAll && record.projectId && !ids.includes(record.projectId)) return
          const event = make(record, context)
          if (event) collected.push(event)
        })
      })
      if (perms.project) projects.forEach((project) => collected.push(...projectEvents(project)))
      setEvents(collected)
      setErrors(nextErrors)
      setLoading(false)
    })()
  }, [idsKey, permKey, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Work calendars: the project's own, else the tenant's default.
  useEffect(() => {
    if (!perms.calendar) { setCalendars([]); return }
    let cancelled = false
    pmApi.calendars.list().then((result) => { if (!cancelled) setCalendars(result.isSuccess ? listOf(result) : []) })
    return () => { cancelled = true }
  }, [perms.calendar])

  const calendarId = singleProject?.workCalendarId || calendars.find((calendar) => calendar.isDefault)?.id || calendars[0]?.id || null

  // Working / non-working days and official holidays of the visible grid.
  useEffect(() => {
    if (!perms.calendar) { setDays({}); return }
    let cancelled = false
    ;(async () => {
      const [daysResult, holidaysResult] = await Promise.all([
        calendarId ? pmApi.calendars.days(calendarId, gridFrom, gridTo) : null,
        pmApi.calendars.officialHolidays(gridFrom, gridTo),
      ])
      if (cancelled) return
      const next = {}
      if (daysResult?.isSuccess) listOf(daysResult).forEach((day) => { next[day.date] = { isWorking: day.isWorkingDay, reason: day.reason || '', official: false } })
      if (holidaysResult.isSuccess) listOf(holidaysResult).forEach((holiday) => { next[holiday.date] = { isWorking: false, reason: holiday.reason, official: true } })
      setDays(next)
    })()
    return () => { cancelled = true }
  }, [calendarId, gridFrom, gridTo, perms.calendar])

  return { events, errors, loading, days, calendarId, perms, reload: () => setReloadKey((value) => value + 1), truncated: scopeProjects.length > MAX_PROJECTS_IN_ALL_SCOPE }
}
