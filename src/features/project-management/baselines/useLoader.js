import { useCallback, useEffect, useRef, useState } from 'react'
import { unwrap } from '../../../services/api'
import { listOf } from '../pmApi'
import { explainBaselineError } from './baselineModel'

/**
 * Loads one resource: `load()` returns an API result; `list` says whether the answer is a list.
 * Reloads when `key` changes or `reload()` is called; an answer that arrives after a newer request started is ignored.
 */
export function useLoader(load, key, enabled = true, { list = false } = {}) {
  const [state, setState] = useState({ value: list ? [] : null, loading: Boolean(enabled), error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const mine = ++ticket.current
    if (!enabled) { setState({ value: list ? [] : null, loading: false, error: '' }); return }
    setState((current) => ({ ...current, loading: true, error: '' }))
    loadRef.current().then((result) => {
      if (mine !== ticket.current) return
      if (!result.isSuccess) { setState({ value: list ? [] : null, loading: false, error: explainBaselineError(result) }); return }
      setState({ value: list ? listOf(result) : unwrap(result), loading: false, error: '' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, reloadKey])

  return { ...state, reload: useCallback(() => setReloadKey((value) => value + 1), []) }
}
