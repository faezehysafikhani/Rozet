import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, Clock3 } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { unwrap } from '../../../services/api'
import { pmApi } from '../../project-management/pmApi'
import { useLoader } from '../../project-management/useLoader'
import { PRIORITIES, STATUSES, explainTaskError, isOverdue, moveMessage, moveTask, priorityOf, sprintStatusOf, statusOf, taskPerms } from '../taskModel'

/**
 * The Kanban board of one project (GET .../agile/board): four columns, cards that can be dragged to another column or to a spot
 * in a column, filters by sprint, person and priority. Moving to another column goes through the approval workflow when the user
 * may submit it (the card then waits, marked), otherwise it is a direct move.
 */
export default function BoardTab({ project, data, sprints, pending, say, onChanged, onOpenTask, reloadKey }) {
  const { can } = useAuth()
  const perms = taskPerms(can)
  const today = todayIso()
  const [sprintNumber, setSprintNumber] = useState('')
  const [touched, setTouched] = useState(false)
  const [responsibleUserId, setResponsible] = useState('')
  const [priority, setPriority] = useState('')
  const [drag, setDrag] = useState(null) // { id, status }
  const [over, setOver] = useState(null) // { status, beforeId }
  const [busy, setBusy] = useState(false)
  const dragRef = useRef(null)

  // Open on the running sprint when the project has one, until the user picks something.
  useEffect(() => {
    if (touched) return
    const active = sprints.find((sprint) => sprintStatusOf(sprint.status).value === 1)
    setSprintNumber(active ? String(active.number) : '')
  }, [sprints, touched])

  const board = useLoader(
    () => pmApi.agile.board({ projectId: project.id, sprintNumber: sprintNumber || undefined, responsibleUserId: responsibleUserId || undefined, priority: priority === '' ? undefined : priority }),
    `${project.id}:${sprintNumber}:${responsibleUserId}:${priority}:${reloadKey}`, perms.view, { explain: explainTaskError },
  )
  const columns = useMemo(() => {
    const byStatus = Object.fromEntries((board.value?.columns || []).map((column) => [statusOf(column.status).value, column]))
    return STATUSES.map((status) => ({ status, cards: byStatus[status.value]?.cards || [], count: byStatus[status.value]?.cardCount ?? 0, points: byStatus[status.value]?.points ?? 0 }))
  }, [board.value])
  const total = columns.reduce((sum, column) => sum + column.count, 0)
  const filtered = Boolean(responsibleUserId || priority !== '')

  async function drop(status, beforeId) {
    const moving = dragRef.current
    dragRef.current = null
    setDrag(null); setOver(null)
    if (!moving) return
    const task = { id: moving.id, title: moving.title, status: moving.status, projectId: project.id }
    await place(task, status, beforeId === moving.id ? null : beforeId)
  }

  async function place(task, status, beforeId) {
    if (statusOf(task.status).value === status && !beforeId) return
    setBusy(true)
    const outcome = await moveTask({ task, status, beforeTaskId: beforeId || undefined, tenantId: data.tenantId, perms })
    setBusy(false)
    if (!outcome.ok) { say('error', outcome.error); board.reload(); return }
    say('success', moveMessage(task, status, outcome))
    onChanged()
  }

  if (!perms.view) return <p className="data-state">برای مشاهده‌ی برد به دسترسی «مشاهده وظایف چابک» نیاز دارید.</p>
  return (
    <>
      <div className="tk-filters">
        <label>اسپرینت<select value={sprintNumber} onChange={(e) => { setTouched(true); setSprintNumber(e.target.value) }}><option value="">کل پروژه</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.number}>{sprint.name} ({sprintStatusOf(sprint.status).label})</option>)}</select></label>
        <label>مسئول<select value={responsibleUserId} onChange={(e) => setResponsible(e.target.value)}><option value="">همه</option>{data.users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></label>
        <label>اولویت<select value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">همه</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        {filtered && <button type="button" className="prj-clear" onClick={() => { setResponsible(''); setPriority('') }}>پاک کردن فیلترها</button>}
        <span className="docs-count">{total.toLocaleString('fa-IR')} کارت{busy ? ' · در حال انتقال...' : ''}</span>
      </div>

      {board.loading && !board.value ? <p className="data-state">در حال دریافت برد...</p>
        : board.error ? <p className="data-state data-state--error">{board.error} <button type="button" className="prj-clear" onClick={board.reload}>تلاش دوباره</button></p> : (
          <div className="tk-board" aria-busy={busy}>
            {columns.map(({ status, cards, count, points }) => (
              <section key={status.value} className={`tk-column ${over?.status === status.value ? 'over' : ''}`} aria-label={status.label}
                onDragOver={(e) => { if (drag) { e.preventDefault(); setOver((current) => (current?.status === status.value && current.beforeId ? current : { status: status.value, beforeId: null })) } }}
                onDrop={(e) => { e.preventDefault(); drop(status.value, over?.status === status.value ? over.beforeId : null) }}>
                <header><div><i style={{ background: status.color }} /><strong>{status.label}</strong><span>{count.toLocaleString('fa-IR')}</span></div>{points > 0 && <small>{points.toLocaleString('fa-IR')} امتیاز</small>}</header>
                {cards.length === 0 && <p className="tk-empty">کارتی نیست</p>}
                {cards.map((card) => {
                  const late = isOverdue(card, today)
                  const waiting = pending[card.id]
                  return (
                    <article key={card.id} className={`tk-card ${drag?.id === card.id ? 'dragging' : ''} ${over?.beforeId === card.id ? 'before' : ''}`} draggable={perms.edit || perms.submitStatus}
                      onDragStart={(e) => { dragRef.current = { id: card.id, title: card.title, status: card.status }; setDrag({ id: card.id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.id) }}
                      onDragEnd={() => { dragRef.current = null; setDrag(null); setOver(null) }}
                      onDragOver={(e) => { if (drag && drag.id !== card.id) { e.preventDefault(); e.stopPropagation(); setOver({ status: status.value, beforeId: card.id }) } }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(status.value, card.id) }}>
                      <div className="tk-card-top"><span className={`priority ${priorityOf(card.priority).tone}`}>{priorityOf(card.priority).label}</span>{card.storyPoints !== null && card.storyPoints !== undefined && <b className="tk-points" title="امتیاز">{card.storyPoints.toLocaleString('fa-IR')}</b>}</div>
                      <h4><button type="button" className="tk-title" onClick={() => onOpenTask(card.id)}>{card.title}</button></h4>
                      {waiting && <em className="bl-tag pf-late"><Clock3 size={12} />انتقال در انتظار تأیید</em>}
                      <footer>
                        <span className={late ? 'tk-late' : ''}>{card.dueDate ? formatJalali(card.dueDate) : '—'}</span>
                        {card.checklistTotal > 0 && <span title="چک‌لیست"><CheckSquare size={13} />{card.checklistDone.toLocaleString('fa-IR')}/{card.checklistTotal.toLocaleString('fa-IR')}</span>}
                        {card.sprintNumber ? <span title="اسپرینت">S{card.sprintNumber.toLocaleString('fa-IR')}</span> : null}
                        <i className="tk-avatar" title={card.responsibleUserId ? data.userName(card.responsibleUserId) : 'بدون مسئول'}>{card.responsibleUserId ? data.userName(card.responsibleUserId).slice(0, 1) : '؟'}</i>
                      </footer>
                      {(perms.edit || perms.submitStatus) && !waiting && (
                        <select className="tk-move" aria-label={`انتقال ${card.title}`} value={statusOf(card.status).value} onChange={(e) => place({ id: card.id, title: card.title, status: card.status, projectId: project.id }, Number(e.target.value), null)}>
                          {STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                        </select>
                      )}
                    </article>
                  )
                })}
              </section>
            ))}
          </div>
        )}
      <p className="docs-hint">کارت را بکشید و روی ستون یا بالای کارت دیگر رها کنید (یا از لیست پایین کارت استفاده کنید). {perms.submitStatus ? 'انتقال به ستون دیگر از گردش تأیید می‌گذرد؛ اگر برای پروژه زنجیره‌ای تعریف نشده باشد همان لحظه اعمال می‌شود.' : 'شما دسترسی «ارسال تغییر وضعیت» ندارید و انتقال مستقیم انجام می‌شود.'}</p>
    </>
  )
}
