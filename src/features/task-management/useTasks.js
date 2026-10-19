import { useCallback, useEffect, useRef, useState } from 'react'
import { listOf, pmApi } from '../project-management/pmApi'
import { explainTaskError } from './taskModel'

/**
 * The agile tasks of several projects in one call (POST .../agile/tasks/for-projects), each with its project's name.
 * Reloads when the set of projects changes or `reload()` is called; a stale answer is ignored.
 */
export function useTasksOfProjects(projects, enabled = true) {
  const [state, setState] = useState({ tasks: [], loading: Boolean(enabled), error: '' })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)
  const idKey = projects.map((project) => project.id).join(',')

  useEffect(() => {
    const mine = ++ticket.current
    if (!enabled || !projects.length) { setState({ tasks: [], loading: false, error: '' }); return }
    setState((current) => ({ ...current, loading: true, error: '' }))
    pmApi.tasks.forProjects(projects.map((project) => project.id)).then((result) => {
      if (mine !== ticket.current) return
      if (!result.isSuccess) { setState({ tasks: [], loading: false, error: explainTaskError(result) }); return }
      const names = Object.fromEntries(projects.map((project) => [project.id, project.name]))
      setState({ tasks: listOf(result).map((task) => ({ ...task, projectName: names[task.projectId] || '—' })), loading: false, error: '' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, enabled, reloadKey])

  return { ...state, reload: useCallback(() => setReloadKey((value) => value + 1), []) }
}

/** What sits beside the tasks: status changes waiting for approval (by task id) and the user's active hand-overs. */
export function useTaskExtras(projects, perms) {
  const [state, setState] = useState({ pending: {}, delegations: [] })
  const [reloadKey, setReloadKey] = useState(0)
  const ticket = useRef(0)
  const idKey = projects.map((project) => project.id).join(',')

  useEffect(() => {
    const mine = ++ticket.current
    ;(async () => {
      const [submissions, delegations] = await Promise.all([
        perms.view && projects.length ? pmApi.agile.statusSubmissions.forProjects(projects.map((project) => project.id)) : null,
        perms.viewDelegations ? pmApi.delegations.list(true) : null,
      ])
      if (mine !== ticket.current) return
      const pending = {}
      if (submissions?.isSuccess) listOf(submissions).filter((item) => item.approvalStatus === 1 || item.approvalStatus === 'PendingApproval').forEach((item) => { pending[item.taskId] = item })
      setState({ pending, delegations: delegations?.isSuccess ? listOf(delegations) : [] })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey, perms.view, perms.viewDelegations, reloadKey])

  return { ...state, reload: useCallback(() => setReloadKey((value) => value + 1), []) }
}
