import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarClock, CheckCircle2, ChevronDown, ChevronLeft, CircleAlert, Flag, Gauge, ListPlus, Pencil, Plus, Send, Settings2, Trash2, TrendingUp, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { pmApi } from '../pmApi'
import { toOutcome } from '../pmErrors'
import { approvalOf } from '../documents/documentUtils'
import AttentionList from './AttentionList'
import { buildAttention } from './attention'
import { ActivityFormDialog, ActualProgressDialog, ScheduleSettingsDialog } from './ScheduleDialogs'
import { DEPENDENCY_TYPES, PLANNED_MODES, WEIGHTING_MODES, dependencyValue, descendantsOf, explainScheduleError, explainWarning, fmt, plannedValue, rowById, visibleRows, weightingValue } from './scheduleModel'
import { useSchedulePlan } from './useSchedulePlan'
import './schedule.css'

/**
 * برنامه‌ی زمان‌بندی (WBS) of the selected project: the activities as a tree with the calculated dates, float,
 * critical path, weights and progress, and everything the Core offers on them for users who hold the permission -
 * add / edit / delete (with sub-activities), a predecessor with its type and lag, actual progress, approval,
 * weighting settings and writing the calculated dates back.
 */
export default function SchedulePanel({ data, externalReloadKey = 0 }) {
  const { can } = useAuth()
  const project = data.selectedProject
  const canView = can('WaterfallActivities.View')
  const canCreate = can('WaterfallActivities.Create')
  const canEdit = can('WaterfallActivities.Edit')
  const canDelete = can('WaterfallActivities.Delete')
  const canSubmit = can('WaterfallActivities.Submit')
  const canManage = can('WaterfallSchedule.Manage')

  const { plan, rows, loading, error, reload } = useSchedulePlan(project?.id, canView)
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // { kind: 'create' | 'edit' | 'progress' | 'settings', id?, parentId? }
  const [notice, setNotice] = useState(null)

  // The plan was changed elsewhere (an MS Project import): read it again.
  const seenKey = useRef(externalReloadKey)
  useEffect(() => { if (seenKey.current !== externalReloadKey) { seenKey.current = externalReloadKey; reload() } }, [externalReloadKey, reload])

  const attention = useMemo(() => buildAttention(rows, plan?.settings, todayIso()), [rows, plan])
  const byId = useMemo(() => rowById(rows), [rows])
  const shown = useMemo(() => visibleRows(rows, collapsed), [rows, collapsed])
  const dialogRow = dialog?.id ? byId[dialog.id] : null
  const schedule = plan?.schedule
  const settings = plan?.settings
  const say = (type, text) => setNotice({ type, text })
  const refresh = () => { reload(); data.refresh() }
  const summaries = rows.filter((row) => row.isSummary)
  const allCollapsed = summaries.length > 0 && summaries.every((row) => collapsed.has(row.id))
  const toggle = (id) => setCollapsed((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })

  const done = (text, type = 'success') => { setDialog(null); say(type, text); refresh() }

  function askDelete(row) {
    const children = descendantsOf(rows, row.id).size
    confirm({
      title: 'حذف فعالیت',
      message: children
        ? `«${row.name}» و ${children.toLocaleString('fa-IR')} زیرفعالیتش با پیوندهای وابستگی‌شان برای همیشه حذف می‌شوند.`
        : `«${row.name}» با پیوندهای وابستگی‌اش برای همیشه حذف می‌شود.`,
      confirmLabel: children ? 'حذف همراه با زیرفعالیت‌ها' : 'حذف فعالیت',
      danger: true,
      run: async () => {
        const result = await pmApi.waterfall.activities.remove(row.id, children > 0)
        const outcome = { ok: result.isSuccess, error: result.isSuccess ? '' : explainScheduleError(result) }
        if (outcome.ok) { say('success', `«${row.name}» حذف شد.`); refresh() }
        return outcome
      },
    })
  }

  function askSubmit(row) {
    confirm({
      title: 'ارسال برای تأیید',
      message: `«${row.name}» برای تأیید ارسال می‌شود. اگر زنجیره‌ی تأییدی تعریف نشده باشد، مستقیماً تأیید می‌شود.`,
      confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.waterfall.activities.submitForApproval(row.id)
        if (result.isSuccess) { say('success', approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'فعالیت تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'فعالیت برای تأیید ارسال شد.'); refresh() }
        return toOutcome(result)
      },
    })
  }

  function askApply() {
    confirm({
      title: 'اعمال زمان‌بندی محاسبه‌شده',
      message: 'تاریخ شروع و پایان محاسبه‌شده‌ی همه‌ی فعالیت‌ها (بر اساس مدت، وابستگی‌ها و تقویم کاری) روی خود فعالیت‌ها نوشته می‌شود و تاریخ‌های قبلی را جایگزین می‌کند.',
      confirmLabel: 'اعمال تاریخ‌ها',
      run: async () => {
        const result = await pmApi.waterfall.schedule.apply(project.id)
        const outcome = { ok: result.isSuccess, error: result.isSuccess ? '' : explainScheduleError(result) }
        if (outcome.ok) { say('success', 'تاریخ‌های محاسبه‌شده روی فعالیت‌ها اعمال شد.'); refresh() }
        return outcome
      },
    })
  }

  if (!project) return null
  const predecessorText = (row) => row.predecessors.map((link) => {
    const type = DEPENDENCY_TYPES[dependencyValue(link.type)].short
    const lag = link.lagDays ? `${link.lagDays > 0 ? '+' : '−'}${Math.abs(link.lagDays).toLocaleString('fa-IR')}` : ''
    return `${byId[link.predecessorActivityId]?.wbs || '؟'} ${type}${lag}`
  }).join('، ')

  return (
    <section className="task-panel task-table-panel sch-panel">
      <div className="task-panel-title">
        <div><h3>برنامه‌ی زمان‌بندی (WBS) — {project.name}</h3><p>فعالیت‌ها به‌صورت درختی؛ تاریخ‌ها، شناوری و مسیر بحرانی را Core بر اساس مدت، وابستگی‌ها و تقویم کاری حساب می‌کند.</p></div>
        <div className="sch-toolbar">
          {canCreate && <button type="button" className="sch-primary" onClick={() => setDialog({ kind: 'create' })}><Plus size={16} />افزودن فعالیت</button>}
          {summaries.length > 0 && <button type="button" onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(summaries.map((row) => row.id)))}>{allCollapsed ? 'باز کردن همه' : 'بستن همه'}</button>}
          {canManage && <button type="button" onClick={askApply} disabled={!rows.length}><CalendarClock size={16} />اعمال زمان‌بندی</button>}
          {canManage && <button type="button" onClick={() => setDialog({ kind: 'settings' })} disabled={!plan}><Settings2 size={16} />تنظیمات</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      {!canView ? <p className="data-state">برای مشاهده‌ی فعالیت‌ها به دسترسی «مشاهده‌ی فعالیت‌های آبشاری» نیاز دارید.</p>
        : loading && !plan ? <p className="data-state">در حال دریافت برنامه‌ی زمان‌بندی...</p>
        : error ? <p className="data-state data-state--error">{error} <button type="button" className="prj-clear" onClick={reload}>تلاش دوباره</button></p>
        : plan && (
          <>
            <div className="sch-summary">
              <article><Gauge size={18} /><div><small>بازه‌ی پروژه</small><strong>{rows.length ? `${formatJalali(schedule.projectStart)} تا ${formatJalali(schedule.projectFinish)}` : '—'}</strong></div></article>
              <article><CalendarClock size={18} /><div><small>مدت کل ({schedule.usesWorkCalendar ? 'روز کاری' : 'روز'})</small><strong>{rows.length ? Number(schedule.projectDurationDays).toLocaleString('fa-IR') : '—'}</strong></div></article>
              <article><TrendingUp size={18} /><div><small>پیشرفت برنامه‌ای / واقعی</small><strong>{fmt(schedule.plannedProgress)}٪ / {fmt(schedule.actualProgress)}٪</strong></div></article>
              <article><Flag size={18} /><div><small>فعالیت‌های بحرانی</small><strong>{schedule.criticalPath.length.toLocaleString('fa-IR')}</strong></div></article>
              <article><Settings2 size={18} /><div><small>وزن‌دهی · پیشرفت برنامه‌ای</small><strong className="sch-small">{WEIGHTING_MODES[weightingValue(settings.weighting)].label.split(' (')[0]} · {PLANNED_MODES[plannedValue(settings.plannedProgress)].label.split(' (')[0]}</strong></div></article>
            </div>
            {schedule.warnings.length > 0 && (
              <ul className="sch-warnings">{schedule.warnings.slice(0, 5).map((text) => <li key={text}><CircleAlert size={14} />{explainWarning(text)}</li>)}{schedule.warnings.length > 5 && <li>و {(schedule.warnings.length - 5).toLocaleString('fa-IR')} هشدار دیگر</li>}</ul>
            )}

            {rows.length > 0 && <AttentionList items={attention} canEdit={canEdit} onEdit={(row) => setDialog({ kind: 'edit', id: row.id })} />}

            {!rows.length ? <p className="data-state">برای این پروژه هنوز فعالیتی ثبت نشده است.{canCreate ? ' با «افزودن فعالیت» شروع کنید.' : ''}</p> : (
              <div className="table-scroll"><table className="users-table sch-table" style={{ minWidth: 1320 }}>
                <thead><tr><th>WBS</th><th>فعالیت</th><th>مسئول</th><th>شروع</th><th>پایان</th><th>مدت</th><th>شناوری</th><th>وزن</th><th>پیشرفت</th><th>پیش‌نیاز</th><th>تأیید</th><th>عملیات</th></tr></thead>
                <tbody>
                  {shown.map((row) => {
                    const approval = approvalOf(row.approvalStatus)
                    const open = !collapsed.has(row.id)
                    return (
                      <tr key={row.id} className={`${row.isSummary ? 'sch-summary-row' : ''}${row.isCritical ? ' sch-critical' : ''}`}>
                        <td className="sch-wbs">{row.wbs}</td>
                        <td>
                          <div className="sch-name" style={{ paddingInlineStart: `${(row.level - 1) * 20}px` }}>
                            {row.isSummary
                              ? <button type="button" className="sch-toggle" onClick={() => toggle(row.id)} aria-label={open ? 'بستن' : 'باز کردن'} aria-expanded={open}>{open ? <ChevronDown size={15} /> : <ChevronLeft size={15} />}</button>
                              : <span className="sch-toggle" />}
                            {row.isMilestone && <Flag size={14} className="sch-milestone" aria-label="نقطه‌عطف" />}
                            <strong>{row.name}</strong>
                            {row.isCritical && <em className="sch-badge">بحرانی</em>}
                          </div>
                        </td>
                        <td>{row.responsibleUserId ? data.userName(row.responsibleUserId) : '—'}</td>
                        <td className="sch-date">{formatJalali(row.start)}</td>
                        <td className="sch-date">{formatJalali(row.finish)}</td>
                        <td>{Number(row.durationDays).toLocaleString('fa-IR')}{row.usedDefaultDuration ? <span title="مدت یا تاریخی ثبت نشده؛ یک روز فرض شده است" className="sch-assumed">*</span> : ''}</td>
                        <td title={`شناوری آزاد: ${Number(row.freeFloat).toLocaleString('fa-IR')} روز`}>{Number(row.totalFloat).toLocaleString('fa-IR')}</td>
                        <td>{fmt(row.weight)}٪</td>
                        <td>
                          <div className="prj-progress" title={`برنامه‌ای ${fmt(row.planned)}٪ — واقعی ${fmt(row.actual)}٪`}>
                            <span><i style={{ width: `${Math.min(100, row.planned)}%` }} className="planned" /></span>
                            <span><i style={{ width: `${Math.min(100, row.actual)}%` }} className="actual" /></span>
                            <small>{fmt(row.actual, 0)}٪ از {fmt(row.planned, 0)}٪</small>
                          </div>
                        </td>
                        <td className="sch-pred">{predecessorText(row) || '—'}</td>
                        <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                        <td>
                          <div className="row-actions">
                            {canCreate && !row.isMilestone && <button type="button" title="افزودن زیرفعالیت" aria-label="افزودن زیرفعالیت" onClick={() => setDialog({ kind: 'create', parentId: row.id })}><ListPlus size={15} /></button>}
                            {canEdit && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setDialog({ kind: 'edit', id: row.id })}><Pencil size={15} /></button>}
                            {canEdit && !row.isSummary && <button type="button" title="ثبت پیشرفت واقعی" aria-label="ثبت پیشرفت واقعی" onClick={() => setDialog({ kind: 'progress', id: row.id })}><TrendingUp size={15} /></button>}
                            {canSubmit && !row.isSummary && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => askSubmit(row)}><Send size={15} /></button>}
                            {canDelete && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(row)}><Trash2 size={15} /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            )}
          </>
        )}

      {dialog?.kind === 'create' && plan && <ActivityFormDialog project={project} rows={rows} activity={null} presetParentId={dialog.parentId} data={data} settings={settings} canManageSchedule={canManage} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && dialogRow && <ActivityFormDialog project={project} rows={rows} activity={dialogRow} data={data} settings={settings} canManageSchedule={canManage} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'progress' && dialogRow && <ActualProgressDialog activity={dialogRow} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'settings' && plan && <ScheduleSettingsDialog project={project} settings={settings} data={data} onClose={() => setDialog(null)} onDone={done} />}
      {confirmDialog}
    </section>
  )
}
