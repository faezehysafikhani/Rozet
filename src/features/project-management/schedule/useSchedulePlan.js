import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { pmApi } from '../pmApi'
import { explainPmError } from '../pmErrors'
import { unwrap } from '../../../services/api'
import { buildRows } from './scheduleModel'

/**
 * The whole plan of one project in one call (GET .../waterfall/schedule/plan): settings, stored activities,
 * dependencies and the calculated schedule. An answer that arrives after a project switch is ignored.
 */
export function useSchedulePlan(projectId, enabled) {
  const [state, setState] = useState({ plan: null, loading: Boolean(projectId && enabled), error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)

  useEffect(() => {
    const mine = ++ticket.current
    if (!projectId || !enabled) { setState({ plan: null, loading: false, error: '' }); return }
    setState((current) => ({ plan: current.plan?.projectId === projectId ? current.plan : null, loading: true, error: '' }))
    pmApi.waterfall.schedule.plan(projectId).then((result) => {
      if (mine !== ticket.current) return
      if (!result.isSuccess) { setState({ plan: null, loading: false, error: explainPmError(result) }); return }
      setState({ plan: unwrap(result), loading: false, error: '' })
    })
  }, [projectId, enabled, reloadKey])

  const rows = useMemo(() => buildRows(state.plan), [state.plan])
  return { ...state, rows, reload: useCallback(() => setReloadKey((value) => value + 1), []) }
}
