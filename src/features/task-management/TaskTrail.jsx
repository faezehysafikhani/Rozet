import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { formatInstant, formatValue, propertyLabel } from '../project-management/history/historyModel'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import { explainTaskError } from './taskModel'

const AGILE_TASK_ITEM = 1
// Bookkeeping columns the Core fills in itself; a person did not change them.
const HIDDEN = new Set(['ModifiedAtUtc', 'ModifiedByUserId', 'CreatedAtUtc', 'CreatedByUserId'])
const KIND_LABEL = { 0: 'ثبت وظیفه', 1: 'ویرایش', 2: 'حذف', Added: 'ثبت وظیفه', Modified: 'ویرایش', Deleted: 'حذف' }

/**
 * سابقه‌ی وظیفه: everything that happened to one task in one list - its edits (from the project history) and who held it
 * (the hand-over trail, ended hand-overs included). Opened on demand; each source needs its own permission and a server without it is skipped.
 */
export default function TaskTrail({ task, data }) {
  const { can } = useAuth()
  const canHistory = can('ProjectHistory.View')
  const canDelegations = can('ItemDelegation.View')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const changes = useLoader(() => pmApi.history.list({ projectId: task.projectId, entityName: 'AgileTask', entityId: task.id, take: 50 }), `h:${task.id}`, open && canHistory, { explain: explainTaskError })
  const hand = useLoader(() => pmApi.delegations.history({ itemType: AGILE_TASK_ITEM, itemId: task.id }), `d:${task.id}`, open && canDelegations, { list: true, explain: explainTaskError })

  const entries = useMemo(() => {
    const list = []
    for (const item of changes.value?.items || []) {
      const props = (item.changes || []).filter((change) => !HIDDEN.has(change.property))
      list.push({ key: `c-${item.id}`, at: item.changedAtUtc, by: item.changedByUserId, title: KIND_LABEL[item.kind] || 'ویرایش', props })
    }
    for (const item of hand.value) {
      list.push({ key: `d-${item.id}`, at: item.delegatedAtUtc, by: item.delegatorUserId, title: `ارجاع به ${data.userName(item.delegateUserId)}`, props: [], tone: 'todo' })
      if (item.endedAtUtc) list.push({ key: `e-${item.id}`, at: item.endedAtUtc, by: item.delegatorUserId, title: `پایان ارجاع به ${data.userName(item.delegateUserId)}`, props: [], tone: 'done' })
    }
    return list.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [changes.value, hand.value, data])

  if (!canHistory && !canDelegations) return null
  const loading = (changes.loading || hand.loading) && !entries.length
  const error = changes.error || hand.error
  return (
    <div className="tk-trail" style={{ gridColumn: '1 / -1' }}>
      <button type="button" className="tk-trail-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={15} /> : <ChevronLeft size={15} />}<strong>سابقه‌ی وظیفه</strong><small>ویرایش‌ها و ارجاع‌ها</small>
      </button>
      {open && (
        loading ? <p className="data-state">در حال دریافت سابقه...</p>
          : <>
            {error && <p className="ue-error" role="alert">{error}</p>}
            {!entries.length && !error ? <p className="data-state">سابقه‌ای ثبت نشده است.</p> : (
              <ol className="tk-trail-list">
                {entries.map((entry) => {
                  const { day, time } = formatInstant(entry.at)
                  const isOpen = expanded[entry.key]
                  return (
                    <li key={entry.key}>
                      <div className="tk-trail-row">
                        <span className={`status-pill ${entry.tone || 'doing'}`}>{entry.title}</span>
                        <small>{entry.by ? data.userName(entry.by) : 'سیستم'} · {day} {time}</small>
                        {entry.props.length > 0 && <button type="button" className="tk-trail-more" onClick={() => setExpanded({ ...expanded, [entry.key]: !isOpen })}>{isOpen ? 'پنهان' : `${entry.props.length.toLocaleString('fa-IR')} تغییر`}</button>}
                      </div>
                      {isOpen && (
                        <ul className="tk-trail-props">
                          {entry.props.map((change) => <li key={change.property}><b>{propertyLabel(change.property)}</b>: <bdi>{formatValue(change.property, change.oldValue, data.userName)}</bdi> ← <bdi>{formatValue(change.property, change.newValue, data.userName)}</bdi></li>)}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </>
      )}
    </div>
  )
}
