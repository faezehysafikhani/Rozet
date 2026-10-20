import { useEffect, useState } from 'react'
import { actionsApi, unwrap } from '../../services/api'
import { useAuth } from '../../services/AuthContext'

/** The tenant's actions (Actions.View) for «اقدام‌های من» and the activity chart; empty without the permission. */
export function useDashboardActions() {
  const { can } = useAuth()
  const allowed = can('Actions.View')
  const [state, setState] = useState({ loading: allowed, actions: [], failed: false })

  useEffect(() => {
    if (!allowed) { setState({ loading: false, actions: [], failed: false }); return undefined }
    let alive = true
    actionsApi.list().then((result) => {
      if (!alive) return
      const list = unwrap(result, [])
      setState({ loading: false, actions: Array.isArray(list) ? list : [], failed: !result.isSuccess })
    })
    return () => { alive = false }
  }, [allowed])

  return { ...state, allowed }
}
