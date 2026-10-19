import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../services/AuthContext'
import { unwrap } from '../../../services/api'
import { DEFAULT_TENANT_ID } from '../../../services/config'
import { listOf, pmApi } from '../pmApi'
import { explainPmError } from '../pmErrors'

export const PROJECT_STATUSES = [
  { value: 0, key: 'Draft', label: 'پیش‌نویس', tone: 'todo' },
  { value: 1, key: 'Active', label: 'فعال', tone: 'doing' },
  { value: 2, key: 'OnHold', label: 'متوقف', tone: 'review' },
  { value: 3, key: 'Completed', label: 'تکمیل شده', tone: 'done' },
  { value: 4, key: 'Archived', label: 'آرشیو', tone: 'todo' },
]
export const PROJECT_TYPES = [
  { value: 0, key: 'Waterfall', label: 'آبشاری' },
  { value: 1, key: 'Agile', label: 'چابک' },
]
const find = (list, raw) => list.find((item) => item.value === raw || item.key === raw || String(item.value) === String(raw))
export const projectStatusOf = (raw) => find(PROJECT_STATUSES, raw) || PROJECT_STATUSES[0]
export const projectTypeOf = (raw) => find(PROJECT_TYPES, raw) || PROJECT_TYPES[0]

export const SORTS = [
  { key: 'createdAtUtc', label: 'جدیدترین', get: (p) => String(p.createdAtUtc || ''), descending: true },
  { key: 'name', label: 'نام', get: (p) => p.name || '', descending: false },
  { key: 'startDate', label: 'تاریخ شروع', get: (p) => String(p.startDate || ''), descending: false },
  { key: 'endDate', label: 'تاریخ پایان', get: (p) => String(p.endDate || ''), descending: false },
  { key: 'status', label: 'وضعیت', get: (p) => projectStatusOf(p.status).value, descending: false },
]

// Persian and Arabic-Indic digits count as the digits they are, so "پروژه ۱۲" finds "پروژه 12" and the reverse.
const latinDigits = (text) => String(text ?? '').replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))

/** Search, filters and sorting of the loaded list; the Core already limited it to what the user may see. */
export function filterAndSort(projects, { search, status, type, approval, unitId, managerId, sortKey, descending }, approvalValue) {
  const needle = latinDigits(search).trim().toLowerCase()
  const sort = SORTS.find((item) => item.key === sortKey) || SORTS[0]
  return projects
    .filter((p) => !needle || latinDigits(`${p.name} ${p.code}`).toLowerCase().includes(needle))
    .filter((p) => status === '' || projectStatusOf(p.status).value === Number(status))
    .filter((p) => type === '' || projectTypeOf(p.type).value === Number(type))
    .filter((p) => approval === '' || approvalValue(p.approvalStatus) === Number(approval))
    .filter((p) => !unitId || p.organizationUnitId === unitId)
    .filter((p) => !managerId || p.managerUserId === managerId)
    .sort((a, b) => {
      const x = sort.get(a); const y = sort.get(b)
      const order = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'fa')
      return descending ? -order : order
    })
}

/**
 * The projects the user may see, with each one's planned/actual progress. Uses the portfolio
 * (which applies the organisation's visibility rules) and falls back to the plain project list for
 * users who hold Projects.View but not Portfolio.View.
 */
export function useVisibleProjects({ includeArchived }) {
  const { can, user } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const viaPortfolio = can('Portfolio.View')
  const canList = viaPortfolio || can('Projects.View')
  const [state, setState] = useState({ items: [], progress: {}, loading: canList, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)

  useEffect(() => {
    const mine = ++ticket.current
    if (!canList) { setState({ items: [], progress: {}, loading: false, error: '' }); return }
    setState((current) => ({ ...current, loading: true, error: '' }))
    ;(async () => {
      const result = viaPortfolio
        ? await pmApi.portfolio.projects({ includeArchived: includeArchived || undefined })
        : await pmApi.projects.list({ tenantId, pageNumber: 1, pageSize: 1000 })
      if (mine !== ticket.current) return
      if (!result.isSuccess) { setState({ items: [], progress: {}, loading: false, error: explainPmError(result) }); return }
      const all = listOf(result)
      const items = !viaPortfolio && !includeArchived ? all.filter((p) => projectStatusOf(p.status).key !== 'Archived') : all
      setState({ items, progress: {}, loading: false, error: '' })

      // Progress is a nice-to-have: a failure leaves the column empty instead of failing the page.
      if (items.length) {
        const progress = await pmApi.projects.progress({ projectIds: items.map((p) => p.id).slice(0, 200) })
        if (mine === ticket.current && progress.isSuccess) {
          setState((current) => ({ ...current, progress: Object.fromEntries((unwrap(progress) || []).map((entry) => [entry.projectId, entry])) }))
        }
      }
    })()
  }, [includeArchived, viaPortfolio, canList, tenantId, reloadKey])

  return { ...state, canList, reload: useCallback(() => setReloadKey((value) => value + 1), []) }
}

/** Organisation units and work calendars for the project form and the unit filter. */
export function useProjectLookups() {
  const { can } = useAuth()
  const canListUnits = can('organization_units.view')
  const canCreateUnit = can('organization_units.create')
  const canListCalendars = can('work_calendars.view')
  const [units, setUnits] = useState([])
  const [calendars, setCalendars] = useState([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [unitResult, calendarResult] = await Promise.all([
        canListUnits ? pmApi.units.list() : null,
        canListCalendars ? pmApi.calendars.list() : null,
      ])
      if (cancelled) return
      setUnits(unitResult ? listOf(unitResult) : [])
      setCalendars(calendarResult ? listOf(calendarResult) : [])
    })()
    return () => { cancelled = true }
  }, [canListUnits, canListCalendars])

  const createUnit = useCallback(async (tenantId, name) => {
    const result = await pmApi.units.create(tenantId, name)
    if (result.isSuccess) setUnits((current) => [...current, unwrap(result)])
    return result
  }, [])

  return { units, calendars, canListUnits, canCreateUnit, canListCalendars, createUnit }
}

export const unitLabel = (unit) => unit?.path || unit?.name || ''
