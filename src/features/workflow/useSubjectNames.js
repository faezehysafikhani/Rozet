import { useEffect, useMemo, useRef, useState } from 'react'
import { listOf, pmApi } from '../project-management/pmApi'
import { formatJalali } from '../../utils/jalali'
import { statusOf } from '../task-management/taskModel'

/**
 * The Core's approval list only says "a Risk with this id". This looks the items up (with the lists the other
 * screens already read) so the inbox can show their names and projects. Kinds it cannot look up stay unnamed.
 * Returns { describe(instance) -> { name, projectId } | null, loading }.
 */
export function useSubjectNames(instances, projects) {
  const [index, setIndex] = useState({})
  const [loading, setLoading] = useState(false)
  const ticket = useRef(0)
  const types = useMemo(() => [...new Set(instances.map((item) => item.subjectType))].sort().join(','), [instances])
  const projectKey = projects.map((project) => project.id).join(',')

  useEffect(() => {
    const mine = ++ticket.current
    const wanted = new Set(types ? types.split(',') : [])
    if (!wanted.size || !projects.length) { setIndex({}); setLoading(false); return }
    const ids = projects.map((project) => project.id)
    const perProject = (call) => Promise.all(ids.map((id) => call(id).then((result) => (result.isSuccess ? listOf(result).map((row) => ({ ...row, projectId: row.projectId || id })) : []))))
      .then((lists) => lists.flat())
    const has = (...kinds) => kinds.some((kind) => wanted.has(kind))
    setLoading(true)

    ;(async () => {
      const next = {}
      const put = (type, rows, nameOf) => { next[type] = Object.fromEntries(rows.map((row) => [row.id, { name: nameOf(row), projectId: row.projectId }])) }
      const jobs = []
      let tasks = []
      if (has('AgileTask', 'AgileTaskStatus')) jobs.push(pmApi.tasks.forProjects(ids).then((result) => { tasks = result.isSuccess ? listOf(result) : [] }))
      await Promise.all(jobs)
      const taskTitle = Object.fromEntries(tasks.map((task) => [task.id, task.title]))
      if (has('AgileTask')) put('AgileTask', tasks, (task) => task.title)
      const more = []
      if (has('AgileTaskStatus')) more.push(pmApi.agile.statusSubmissions.forProjects(ids).then((result) => put('AgileTaskStatus', result.isSuccess ? listOf(result) : [], (row) => `${taskTitle[row.taskId] || 'وظیفه'} ← ${statusOf(row.submittedStatus).label}`)))
      if (has('Risk', 'RiskResponseStatus')) more.push(pmApi.risks.forProjects(ids).then((result) => { const rows = result.isSuccess ? listOf(result) : []; put('Risk', rows, (row) => row.description); put('RiskResponseStatus', rows, (row) => row.description) }))
      if (has('DelayReason')) more.push(pmApi.delayReasons.forProjects(ids).then((result) => put('DelayReason', result.isSuccess ? listOf(result) : [], (row) => row.description)))
      if (has('Action', 'ActionStatus')) more.push(pmApi.actions.list().then((result) => { const rows = result.isSuccess ? listOf(result) : []; put('Action', rows, (row) => row.title); put('ActionStatus', rows, (row) => row.title) }))
      if (has('ProjectDocument')) more.push(perProject(pmApi.documents.list).then((rows) => put('ProjectDocument', rows, (row) => row.description || row.fileName)))
      if (has('ProgressUpdate')) more.push(perProject(pmApi.progress.list).then((rows) => put('ProgressUpdate', rows, (row) => `گزارش ${row.registerDate ? formatJalali(row.registerDate) : ''}`.trim())))
      if (has('WaterfallActivity', 'ActivityProgress')) more.push(perProject(pmApi.waterfall.activities.list).then((rows) => { put('WaterfallActivity', rows, (row) => row.name); put('ActivityProgress', rows, (row) => row.name) }))
      await Promise.all(more)
      if (wanted.has('Project')) next.Project = Object.fromEntries(projects.map((project) => [project.id, { name: project.name, projectId: project.id }]))
      if (mine !== ticket.current) return
      setIndex(next)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, projectKey])

  const describe = (instance) => index[instance.subjectType]?.[instance.subjectId] || null
  return { describe, loading }
}
