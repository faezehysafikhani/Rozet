import { useCallback, useEffect, useRef, useState } from 'react'
import { portfolioApi, reportingApi, unwrap, PersianMessages } from '../services/api'
import { useAuth } from '../services/AuthContext'

/**
 * Data of the main dashboard, straight from the Core:
 *   mine     GET /api/reporting/me        (Reporting.View)    - the caller's own running projects/actions
 *   summary  GET /api/reporting/summary   (Reporting.ViewAll) - organisation-wide counts
 *   projects GET /api/portfolio/projects  (Portfolio.View)    - the projects the caller may see
 * Each call is made only when the caller holds its permission, so a plain team member gets
 * a dashboard instead of a wall of 403s.
 */
export function useDashboard() {
  const { can } = useAuth()
  const canMine = can('Reporting.View')
  const canAll = can('Reporting.ViewAll')
  const canProjects = can('Portfolio.View')

  const [state, setState] = useState({ loading: true, error: '', mine: null, summary: null, projects: [] })
  const alive = useRef(true)

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }))
    const [mine, summary, projects] = await Promise.all([
      canMine ? reportingApi.me() : null,
      canAll ? reportingApi.summary() : null,
      canProjects ? portfolioApi.projects() : null,
    ])
    if (!alive.current) return

    const failed = [mine, summary, projects].find((result) => result && !result.isSuccess)
    setState({
      loading: false,
      error: failed ? PersianMessages.error(failed.error) : '',
      mine: unwrap(mine),
      summary: unwrap(summary),
      projects: unwrap(projects, []) || [],
    })
  }, [canMine, canAll, canProjects])

  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load])

  return { ...state, canMine, canAll, canProjects, refresh: load }
}
