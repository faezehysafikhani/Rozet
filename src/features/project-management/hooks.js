import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../services/AuthContext'
import { unwrap } from '../../services/api'
import { DEFAULT_TENANT_ID } from '../../services/config'
import { explainPmError } from './pmErrors'
import { listOf, pmApi } from './pmApi'

/**
 * Projects of the tenant with search, filters, sorting and paging done by the Core
 * (GET /api/project-management/projects). Searching waits 300 ms after the last keystroke.
 *
 *   const list = useProjectList({ pageSize: 20 })
 *   list.setFilter({ status: 'Active' })   // back to page 1
 *   list.setPage(3)   list.refresh()
 */
export function useProjectList({ pageSize = 20, initialFilters = {} } = {}) {
  const { user } = useAuth()
  const tenantId = user?.tenantId || DEFAULT_TENANT_ID
  const [filters, setFilters] = useState({ search: '', status: '', type: '', organizationUnitId: '', managerUserId: '', sortBy: '', sortDescending: true, ...initialFilters })
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const [pageNumber, setPageNumber] = useState(1)
  const [state, setState] = useState({ items: [], totalCount: 0, totalPages: 1, loading: true, error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => clearTimeout(timer)
  }, [filters.search])

  useEffect(() => {
    const mine = ++ticket.current
    setState((current) => ({ ...current, loading: true, error: '' }))
    pmApi.projects.list({
      tenantId, pageNumber, pageSize, search: debouncedSearch.trim(),
      status: filters.status, type: filters.type, organizationUnitId: filters.organizationUnitId, managerUserId: filters.managerUserId,
      sortBy: filters.sortBy, sortDescending: filters.sortBy ? filters.sortDescending : undefined,
    }).then((result) => {
      if (mine !== ticket.current) return // a newer request already took over
      if (!result.isSuccess) {
        setState((current) => ({ ...current, items: [], loading: false, error: explainPmError(result) }))
        return
      }
      const page = unwrap(result) || {}
      const items = listOf(result)
      setState({ items, totalCount: page.totalCount ?? items.length, totalPages: page.totalPages ?? 1, loading: false, error: '' })
    })
  }, [tenantId, pageNumber, pageSize, debouncedSearch, filters.status, filters.type, filters.organizationUnitId, filters.managerUserId, filters.sortBy, filters.sortDescending, reloadKey])

  const setFilter = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }))
    setPageNumber(1)
  }, [])

  return { ...state, pageNumber, pageSize, filters, setFilter, setPage: setPageNumber, refresh: () => setReloadKey((value) => value + 1) }
}

// What a project screen can ask for; each loads only its own endpoint.
const LOADERS = {
  activities: (projectId) => pmApi.waterfall.activities.list(projectId),
  plan: (projectId) => pmApi.waterfall.schedule.plan(projectId),
  dependencies: (projectId) => pmApi.waterfall.dependencies.list({ projectId }),
  baselines: (projectId) => pmApi.waterfall.baselines.list(projectId),
  progress: (projectId) => pmApi.progress.list(projectId),
  delayReasons: (projectId) => pmApi.delayReasons.list(projectId),
  documents: (projectId) => pmApi.documents.list(projectId),
  deliverables: (projectId) => pmApi.deliverables.list(projectId),
  kpis: (projectId) => pmApi.kpis.list({ projectId }),
  actions: (projectId) => pmApi.actions.list(projectId),
  history: (projectId) => pmApi.history.list({ projectId, take: 100 }),
}

/**
 * Loads only the named resources of one project, in parallel:
 *
 *   const { data, loading, errors, reload } = useProjectResources(projectId, ['documents'])
 *   data.documents   // an array (empty until loaded or when the call failed)
 *   errors.documents // a Persian message, or undefined
 *   reload()         // all of them;  reload(['documents'])  // just those
 *
 * Switching project drops the old data at once, and an answer that arrives after the switch is ignored.
 */
export function useProjectResources(projectId, resources) {
  const wanted = useMemo(() => [...new Set(resources)].sort(), [resources.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(Boolean(projectId))
  const ticket = useRef(0)

  const load = useCallback(async (keys) => {
    const mine = ++ticket.current
    if (!projectId) { setData({}); setErrors({}); setLoading(false); return }
    setLoading(true)
    const results = await Promise.all(keys.map((key) => LOADERS[key](projectId)))
    if (mine !== ticket.current) return
    setData((current) => ({ ...current, ...Object.fromEntries(keys.map((key, index) => [key, results[index].isSuccess ? listOf(results[index]) : []])) }))
    setErrors((current) => {
      const next = { ...current }
      keys.forEach((key, index) => { if (results[index].isSuccess) delete next[key]; else next[key] = explainPmError(results[index]) })
      return next
    })
    setLoading(false)
  }, [projectId])

  // A different project, or a different set of resources: start clean.
  useEffect(() => {
    setData({}); setErrors({})
    load(wanted)
  }, [load, wanted])

  const reload = useCallback((keys) => load(keys?.length ? keys : wanted), [load, wanted])
  return { data, loading, errors, reload }
}
