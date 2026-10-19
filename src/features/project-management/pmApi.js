import { api, apiRequest, unwrap } from '../../services/api'
import { API_BASE_URL } from '../../services/config'
import { AuthTokenStore, refreshAccessToken } from '../../services/authStore'

/**
 * Wrappers for the Core's project-management endpoints used by the project screens (Rozet.Api).
 * Every call returns { isSuccess, value, error, code, status } like the rest of the API layer.
 * Named separately from `projectManagementApi` in services/api.js, which the older screens use.
 */

const BASE = '/api/project-management'

/** Query string from an object, skipping empty values. */
export function query(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const pmApi = {
  projects: {
    list: (params) => api.get(`${BASE}/projects${query(params)}`),
    get: (id) => api.get(`${BASE}/projects/${id}`),
    /** Dry run of create/update: the same rules, nothing saved. */
    check: (payload, projectId) => api.post(`${BASE}/projects/check${query({ projectId })}`, payload),
    create: (payload) => api.post(`${BASE}/projects`, payload),
    update: (id, payload) => api.put(`${BASE}/projects/${id}`, payload),
    setStatus: (id, status) => api.put(`${BASE}/projects/${id}/status`, { status }),
    archive: (id) => api.post(`${BASE}/projects/${id}/archive`),
    remove: (id) => api.delete(`${BASE}/projects/${id}`),
    submitForApproval: (id) => api.post(`${BASE}/projects/${id}/submit-for-approval`),
    /** Planned / actual progress of several projects at once. */
    progress: (payload) => api.post(`${BASE}/projects/progress`, payload),
  },

  /** Projects the caller may see (visibility rules of the organisation applied). Needs Portfolio.View. */
  portfolio: {
    projects: (params) => api.get(`/api/portfolio/projects${query(params)}`),
  },

  waterfall: {
    activities: {
      list: (projectId) => api.get(`${BASE}/waterfall/activities${query({ projectId })}`),
      get: (id) => api.get(`${BASE}/waterfall/activities/${id}`),
      create: (payload) => api.post(`${BASE}/waterfall/activities`, payload),
      update: (id, payload) => api.put(`${BASE}/waterfall/activities/${id}`, payload),
      remove: (id, withSubActivities = false) => api.delete(`${BASE}/waterfall/activities/${id}${query({ withSubActivities: withSubActivities || undefined })}`),
      setProgress: (id, payload) => api.put(`${BASE}/waterfall/activities/${id}/progress`, payload),
      setActualProgress: (id, payload) => api.put(`${BASE}/waterfall/activities/${id}/actual-progress`, payload),
      submitForApproval: (id) => api.post(`${BASE}/waterfall/activities/${id}/submit-for-approval`),
    },
    dependencies: {
      list: (params) => api.get(`${BASE}/waterfall/dependencies${query(params)}`),
      create: (payload) => api.post(`${BASE}/waterfall/dependencies`, payload),
      /** The one prerequisite of an activity (type + lag); replaces its links. */
      setPredecessor: (payload) => api.put(`${BASE}/waterfall/dependencies/predecessor`, payload),
      update: (id, payload) => api.put(`${BASE}/waterfall/dependencies/${id}`, payload),
      remove: (id) => api.delete(`${BASE}/waterfall/dependencies/${id}`),
    },
    schedule: {
      get: (projectId) => api.get(`${BASE}/waterfall/schedule${query({ projectId })}`),
      /** The whole plan in one call: WBS code, level, effective weight, float, rolled-up cost. */
      plan: (projectId) => api.get(`${BASE}/waterfall/schedule/plan${query({ projectId })}`),
      plans: (payload) => api.post(`${BASE}/waterfall/schedule/plans`, payload),
      /** Writes the calculated dates back to the activities (needs WaterfallSchedule.Manage). */
      apply: (projectId) => api.post(`${BASE}/waterfall/schedule/apply${query({ projectId })}`),
    },
    baselines: {
      list: (projectId) => api.get(`${BASE}/waterfall/baselines${query({ projectId })}`),
      get: (id) => api.get(`${BASE}/waterfall/baselines/${id}`),
      variance: (id) => api.get(`${BASE}/waterfall/baselines/${id}/variance`),
      create: (payload) => api.post(`${BASE}/waterfall/baselines`, payload),
      remove: (id) => api.delete(`${BASE}/waterfall/baselines/${id}`),
    },
    /** S-curve points saved by hand: the only recorded history of actual progress (one per date; saving the same date again refreshes it). */
    progressSnapshots: {
      list: (projectId) => api.get(`${BASE}/waterfall/progress-snapshots${query({ projectId })}`),
      create: (payload) => api.post(`${BASE}/waterfall/progress-snapshots`, payload),
      remove: (id) => api.delete(`${BASE}/waterfall/progress-snapshots/${id}`),
    },
    sCurve: (projectId, stepDays) => api.get(`${BASE}/waterfall/s-curve${query({ projectId, stepDays })}`),
    settings: {
      get: (projectId) => api.get(`${BASE}/waterfall/settings${query({ projectId })}`),
      save: (payload) => api.put(`${BASE}/waterfall/settings`, payload),
    },
    progressSubmissions: {
      list: (params) => api.get(`${BASE}/waterfall/progress-submissions${query(params)}`),
      create: (payload) => api.post(`${BASE}/waterfall/progress-submissions`, payload),
      confirm: (id, payload) => api.put(`${BASE}/waterfall/progress-submissions/${id}/confirmed-progress`, payload),
    },
    msProject: {
      import: (file, projectId, replaceExisting = false) => {
        const form = new FormData()
        form.append('file', file)
        return apiRequest(`${BASE}/waterfall/msproject/import${query({ projectId, replaceExisting: replaceExisting || undefined })}`, { method: 'POST', body: form })
      },
      /** Download through downloadFile(), not a plain link: the call needs the bearer token. */
      exportPath: (projectId) => `${BASE}/waterfall/msproject/export${query({ projectId })}`,
    },
  },

  progress: {
    list: (projectId) => api.get(`${BASE}/progress-updates${query({ projectId })}`),
    get: (id) => api.get(`${BASE}/progress-updates/${id}`),
    create: (payload) => api.post(`${BASE}/progress-updates`, payload),
    update: (id, payload) => api.put(`${BASE}/progress-updates/${id}`, payload),
    remove: (id) => api.delete(`${BASE}/progress-updates/${id}`),
    submitForApproval: (id) => api.post(`${BASE}/progress-updates/${id}/submit-for-approval`),
    executiveSummary: (params) => api.get(`${BASE}/progress-updates/executive-summary${query(params)}`),
  },

  delayReasons: {
    list: (projectId) => api.get(`${BASE}/delay-reasons${query({ projectId })}`),
    forProjects: (projectIds) => api.post(`${BASE}/delay-reasons/for-projects`, { projectIds }),
    get: (id) => api.get(`${BASE}/delay-reasons/${id}`),
    create: (payload) => api.post(`${BASE}/delay-reasons`, payload),
    update: (id, payload) => api.put(`${BASE}/delay-reasons/${id}`, payload),
    remove: (id) => api.delete(`${BASE}/delay-reasons/${id}`),
    submitForApproval: (id) => api.post(`${BASE}/delay-reasons/${id}/submit-for-approval`),
  },

  documents: {
    list: (projectId) => api.get(`${BASE}/documents${query({ projectId })}`),
    get: (id) => api.get(`${BASE}/documents/${id}`),
    /** The Core reads projectId, description and documentType from the query string and the file from the form. */
    upload: ({ file, projectId, description, documentType }) => {
      const form = new FormData()
      form.append('file', file)
      return apiRequest(`${BASE}/documents${query({ projectId, description, documentType })}`, { method: 'POST', body: form })
    },
    update: (id, payload) => api.put(`${BASE}/documents/${id}`, payload),
    remove: (id) => api.delete(`${BASE}/documents/${id}`),
    submitForApproval: (id) => api.post(`${BASE}/documents/${id}/submit-for-approval`),
    versions: (id) => api.get(`${BASE}/documents/${id}/versions`),
    uploadVersion: (id, file, params) => {
      const form = new FormData()
      form.append('file', file)
      return apiRequest(`${BASE}/documents/${id}/versions${query(params)}`, { method: 'POST', body: form })
    },
    downloadPath: (id) => `${BASE}/documents/${id}/download`,
    versionDownloadPath: (id, versionNumber) => `${BASE}/documents/${id}/versions/${versionNumber}/download`,
  },

  deliverables: {
    list: (projectId) => api.get(`${BASE}/deliverables${query({ projectId })}`),
    get: (id) => api.get(`${BASE}/deliverables/${id}`),
    create: (payload) => api.post(`${BASE}/deliverables`, payload),
    update: (id, payload) => api.put(`${BASE}/deliverables/${id}`, payload),
    setStatus: (id, status) => api.put(`${BASE}/deliverables/${id}/status`, { status }),
  },

  kpis: {
    list: (params) => api.get(`${BASE}/kpis${query(params)}`),
    get: (id) => api.get(`${BASE}/kpis/${id}`),
    create: (payload) => api.post(`${BASE}/kpis`, payload),
    update: (id, payload) => api.put(`${BASE}/kpis/${id}`, payload),
    remove: (id) => api.delete(`${BASE}/kpis/${id}`),
  },

  history: {
    list: (params) => api.get(`${BASE}/history${query(params)}`),
  },

  // Beyond /api/project-management: what the project calendar and the strategy screen read.
  tasks: {
    /** Agile tasks of several projects in one call. */
    forProjects: (projectIds) => api.post(`${BASE}/agile/tasks/for-projects`, { projectIds }),
  },

  /** The agile board: tasks, the four-column board, backlog, sprints, charts and status-change requests. */
  agile: {
    tasks: {
      list: (projectId, sprintNumber) => api.get(`${BASE}/agile/tasks${query({ projectId, sprintNumber })}`),
      get: (id) => api.get(`${BASE}/agile/tasks/${id}`),
      create: (payload) => api.post(`${BASE}/agile/tasks`, payload),
      /** Omitting storyPoints leaves the estimate alone; use `estimate` to clear it. */
      update: (id, payload) => api.put(`${BASE}/agile/tasks/${id}`, payload),
      remove: (id) => api.delete(`${BASE}/agile/tasks/${id}`),
      submitForApproval: (id) => api.post(`${BASE}/agile/tasks/${id}/submit-for-approval`),
      /** Direct move into a column (AgileTasks.Edit), before `beforeTaskId` or at the end; no approval step. */
      move: (id, status, beforeTaskId) => api.post(`${BASE}/agile/tasks/${id}/move`, { status, beforeTaskId: beforeTaskId || null }),
      estimate: (id, storyPoints) => api.put(`${BASE}/agile/tasks/${id}/estimate`, { storyPoints }),
      checklist: {
        list: (id) => api.get(`${BASE}/agile/tasks/${id}/checklist`),
        add: (id, text) => api.post(`${BASE}/agile/tasks/${id}/checklist`, { text }),
        update: (id, itemId, payload) => api.put(`${BASE}/agile/tasks/${id}/checklist/${itemId}`, payload),
        remove: (id, itemId) => api.delete(`${BASE}/agile/tasks/${id}/checklist/${itemId}`),
      },
    },
    board: (params) => api.get(`${BASE}/agile/board${query(params)}`),
    backlog: (projectId) => api.get(`${BASE}/agile/backlog${query({ projectId })}`),
    velocity: (projectId, sprints, metric) => api.get(`${BASE}/agile/velocity${query({ projectId, sprints, metric })}`),
    sprintProgress: (projectId, metric) => api.get(`${BASE}/agile/sprint-progress${query({ projectId, metric })}`),
    /** A column change that goes through the approval workflow (AgileStatus.Submit); applied at once when no chain is defined. */
    statusSubmissions: {
      list: (taskId) => api.get(`${BASE}/agile/status-submissions${query({ taskId })}`),
      forProjects: (projectIds) => api.post(`${BASE}/agile/status-submissions/for-projects`, { projectIds }),
      submit: (payload) => api.post(`${BASE}/agile/status-submissions`, payload),
    },
    sprints: {
      list: (projectId) => api.get(`${BASE}/agile/sprints${query({ projectId })}`),
      create: (payload) => api.post(`${BASE}/agile/sprints`, payload),
      update: (id, payload) => api.put(`${BASE}/agile/sprints/${id}`, payload),
      remove: (id) => api.delete(`${BASE}/agile/sprints/${id}`),
      start: (id, payload) => api.post(`${BASE}/agile/sprints/${id}/start`, payload),
      complete: (id, moveIncompleteToSprintId) => api.post(`${BASE}/agile/sprints/${id}/complete`, { moveIncompleteToSprintId: moveIncompleteToSprintId || null }),
      assignTasks: (id, taskIds) => api.post(`${BASE}/agile/sprints/${id}/tasks`, { taskIds }),
      removeTask: (id, taskId) => api.delete(`${BASE}/agile/sprints/${id}/tasks/${taskId}`),
      burn: (id, metric) => api.get(`${BASE}/agile/sprints/${id}/burn${query({ metric })}`),
    },
  },

  /** Hand-overs of work (ItemDelegation.*). The record is kept for the trail; the screen sets the task's responsible person itself. */
  delegations: {
    list: (activeOnly = true) => api.get(`${BASE}/delegations${query({ activeOnly })}`),
    create: (payload) => api.post(`${BASE}/delegations`, payload),
    end: (id) => api.post(`${BASE}/delegations/${id}/end`),
  },
  /** Actions of the tenant, or of one project. */
  actions: {
    list: (projectId) => api.get(`/api/actions${query({ projectId })}`),
    /** Needs Actions.Create; SourceType / SourceId say what the action was raised from. */
    create: (payload) => api.post('/api/actions', payload),
    /** Direct status change (Actions.Edit). */
    setStatus: (id, status) => api.put(`/api/actions/${id}/status`, { status }),
    submitForApproval: (id) => api.post(`/api/actions/${id}/submit-for-approval`),
  },

  risks: {
    forProjects: (projectIds) => api.post(`${BASE}/risks/for-projects`, { projectIds }),
  },

  /** Earned-value and health figures. Needs Reporting.View and Reporting.ViewAll; progress comes from the schedule in Rozet.Api. */
  reporting: {
    projectPerformance: (projectId) => api.get(`/api/reporting/projects/${projectId}/performance`),
  },
  units: {
    /** Active organisation units (organization_units.view); creating one needs organization_units.create. */
    list: () => api.get('/api/organization/units?activeOnly=true'),
    create: (tenantId, name) => api.post('/api/organization/units', { tenantId, name }),
  },
  calendars: {
    list: () => api.get('/api/calendar/work-calendars'),
    days: (id, from, to) => api.get(`/api/calendar/work-calendars/${id}/days${query({ from, to })}`),
    officialHolidays: (from, to) => api.get(`/api/calendar/work-calendars/official-holidays${query({ from, to })}`),
  },
  strategy: {
    list: () => api.get('/api/strategy'),
    tree: () => api.get('/api/strategy/tree'),
    saveTree: (payload) => api.put('/api/strategy/tree', payload),
    create: (payload) => api.post('/api/strategy', payload),
    update: (id, payload) => api.put(`/api/strategy/${id}`, payload),
    remove: (id) => api.delete(`/api/strategy/${id}`),
  },
  alignment: {
    list: (params) => api.get(`/api/integrations/project-strategy-alignment${query(params)}`),
    scores: (payload) => api.post('/api/integrations/project-strategy-alignment/scores', payload),
    saveLevels: (payload) => api.put('/api/integrations/project-strategy-alignment/levels', payload),
    create: (payload) => api.post('/api/integrations/project-strategy-alignment', payload),
    update: (id, payload) => api.put(`/api/integrations/project-strategy-alignment/${id}`, payload),
  },
  platform: {
    /** { maxFileSizeKb, allowedExtensions }: the system-wide upload rules, readable by any signed-in user. */
    uploadPolicy: () => api.get('/api/platform/upload-policy'),
  },
  /** One-time setup of the approval chains the "submit for approval" buttons rely on (needs workflow settings access). */
  applyApprovalDefaults: () => api.post('/api/integrations/project-workflow/settings/apply-defaults'),
}

/**
 * Downloads a file the Core serves behind the bearer token (a document, an MS Project export) and
 * hands it to the browser as a save. Returns { isSuccess, error, status } like the API calls.
 */
export async function downloadFile(path, fallbackName = 'file') {
  const fetchOnce = () => fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${AuthTokenStore.getAccessToken() || ''}` } })
  try {
    let response = await fetchOnce()
    if (response.status === 401 && await refreshAccessToken()) response = await fetchOnce()
    if (!response.ok) return { isSuccess: false, error: `خطای سرور (${response.status})`, status: response.status }

    const disposition = response.headers.get('content-disposition') || ''
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
    const plain = /filename="?([^";]+)"?/i.exec(disposition)
    const name = encoded ? decodeURIComponent(encoded[1]) : plain ? plain[1] : fallbackName

    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return { isSuccess: true, status: response.status }
  } catch (err) {
    return { isSuccess: false, error: err?.message || 'ارتباط با سرور برقرار نشد.', status: 0 }
  }
}

/** The list a page-or-array endpoint returned: [..], { items: [..] } or a Result-wrapped one. */
export function listOf(result) {
  const payload = unwrap(result)
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.value)) return payload.value
  return []
}
