import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { DeliverableDialog, KpiDialog } from './StrategyDialogs'
import { DELIVERABLE_STATUSES, deliverableStatusOf, explainStrategyError, fmt, kpiTypeOf, toStrategyOutcome } from './strategyModel'

/** خروجی‌ها و شاخص‌ها (KPI) of one project. */
export default function DeliverablesTab({ project, data, perms, confirm, say }) {
  const deliverables = useLoader(() => pmApi.deliverables.list(project.id), project.id, perms.viewDeliverables, { list: true, explain: explainStrategyError })
  const kpis = useLoader(() => pmApi.kpis.list({ projectId: project.id }), project.id, perms.viewKpis, { list: true, explain: explainStrategyError })
  const [dialog, setDialog] = useState(null) // { kind: 'deliverable' | 'kpi', item?, deliverableId? }
  const [statusBusy, setStatusBusy] = useState('')
  const titles = useMemo(() => Object.fromEntries(deliverables.value.map((item) => [item.id, item.title])), [deliverables.value])
  const kpisOf = (id) => kpis.value.filter((item) => item.deliverableId === id)
  const orphans = kpis.value.filter((item) => !titles[item.deliverableId])

  async function changeStatus(item, status) {
    setStatusBusy(item.id)
    const result = await pmApi.deliverables.setStatus(item.id, Number(status))
    setStatusBusy('')
    if (!result.isSuccess) { say('error', explainStrategyError(result)); return }
    say('success', `وضعیت «${item.title}» به «${deliverableStatusOf(Number(status)).label}» تغییر کرد.`)
    deliverables.reload()
  }

  function askDeleteKpi(item) {
    confirm({
      title: 'حذف شاخص', message: `«${item.description}» برای همیشه حذف می‌شود.`, confirmLabel: 'حذف شاخص', danger: true,
      run: async () => {
        const outcome = toStrategyOutcome(await pmApi.kpis.remove(item.id))
        if (outcome.ok) { say('success', 'شاخص حذف شد.'); kpis.reload() }
        return outcome
      },
    })
  }

  const done = (text) => { setDialog(null); say('success', text); deliverables.reload(); kpis.reload() }
  if (!perms.viewDeliverables) return <p className="data-state">برای مشاهده‌ی خروجی‌ها به دسترسی «مشاهده تحویل‌دادنی‌ها» نیاز دارید.</p>

  return (
    <>
      <div className="bl-bar">
        <p>خروجی‌های پروژه با معیار پذیرش و وضعیت تحویل، و شاخص‌های کلیدی (KPI) هر خروجی. Core حذف خروجی را پشتیبانی نمی‌کند؛ خروجی نادرست را ویرایش کنید.</p>
        {perms.createDeliverable && <button type="button" className="sch-primary" onClick={() => setDialog({ kind: 'deliverable' })}><Plus size={16} />تعریف خروجی</button>}
      </div>
      {deliverables.loading && !deliverables.value.length ? <p className="data-state">در حال دریافت خروجی‌ها...</p>
        : deliverables.error ? <p className="data-state data-state--error">{deliverables.error} <button type="button" className="prj-clear" onClick={deliverables.reload}>تلاش دوباره</button></p>
        : !deliverables.value.length ? <p className="data-state">برای این پروژه هنوز خروجی‌ای تعریف نشده است.{perms.createDeliverable ? ' با «تعریف خروجی» شروع کنید.' : ''}</p> : (
          <div className="str-list">
            {deliverables.value.map((item) => {
              const status = deliverableStatusOf(item.status)
              const mine = kpisOf(item.id)
              return (
                <article key={item.id} className="str-card">
                  <header>
                    <div><strong>{item.title}</strong><span className={`status-pill ${status.tone}`}>{status.label}</span></div>
                    <div className="row-actions">
                      {perms.editDeliverable && (
                        <select aria-label={`وضعیت ${item.title}`} value={deliverableStatusOf(item.status).value} disabled={statusBusy === item.id} onChange={(e) => changeStatus(item, e.target.value)}>
                          {DELIVERABLE_STATUSES.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
                        </select>
                      )}
                      {perms.editDeliverable && <button type="button" title="ویرایش خروجی" aria-label="ویرایش خروجی" onClick={() => setDialog({ kind: 'deliverable', item })}><Pencil size={15} /></button>}
                    </div>
                  </header>
                  <dl>
                    <div><dt>مسئول</dt><dd>{item.responsibleUserId ? data.userName(item.responsibleUserId) : '—'}</dd></div>
                    <div><dt>تاریخ هدف</dt><dd>{formatJalali(item.targetDate)}</dd></div>
                    {item.description && <div className="wide"><dt>شرح</dt><dd>{item.description}</dd></div>}
                    {item.acceptanceCriteria && <div className="wide"><dt>معیار پذیرش</dt><dd>{item.acceptanceCriteria}</dd></div>}
                  </dl>
                  <footer>
                    <div className="str-kpi-head"><b>شاخص‌های کلیدی ({mine.length.toLocaleString('fa-IR')})</b>{perms.createKpi && <button type="button" onClick={() => setDialog({ kind: 'kpi', deliverableId: item.id })}><Plus size={14} />تعریف شاخص</button>}</div>
                    {!perms.viewKpis ? <small>برای دیدن شاخص‌ها به دسترسی «مشاهده شاخص‌های کلیدی عملکرد» نیاز دارید.</small>
                      : kpis.loading && !kpis.value.length ? <small>در حال دریافت شاخص‌ها...</small>
                      : !mine.length ? <small>شاخصی برای این خروجی تعریف نشده است.</small> : (
                        <table className="users-table bl-table str-kpis">
                          <thead><tr><th>نوع</th><th>شرح</th><th>فرمول</th><th>هدف</th>{(perms.editKpi || perms.deleteKpi) && <th>عملیات</th>}</tr></thead>
                          <tbody>{mine.map((kpi) => (
                            <tr key={kpi.id}>
                              <td><span className="status-pill todo">{kpiTypeOf(kpi.type).label}</span></td>
                              <td className="prg-text">{kpi.description}</td>
                              <td className="prg-text str-formula">{kpi.formula || '—'}</td>
                              <td>{kpi.targetValue === null || kpi.targetValue === undefined ? '—' : fmt(kpi.targetValue, 4)}</td>
                              {(perms.editKpi || perms.deleteKpi) && <td><div className="row-actions">
                                {perms.editKpi && <button type="button" title="ویرایش شاخص" aria-label="ویرایش شاخص" onClick={() => setDialog({ kind: 'kpi', item: kpi })}><Pencil size={15} /></button>}
                                {perms.deleteKpi && <button type="button" className="danger" title="حذف شاخص" aria-label="حذف شاخص" onClick={() => askDeleteKpi(kpi)}><Trash2 size={15} /></button>}
                              </div></td>}
                            </tr>
                          ))}</tbody>
                        </table>
                      )}
                  </footer>
                </article>
              )
            })}
          </div>
        )}
      {kpis.error && <p className="data-state data-state--error">{kpis.error}</p>}
      {orphans.length > 0 && <p className="docs-hint">{orphans.length.toLocaleString('fa-IR')} شاخص به خروجی‌ای وصل‌اند که در فهرست بالا نیست.</p>}
      {dialog?.kind === 'deliverable' && <DeliverableDialog project={project} data={data} deliverable={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'kpi' && <KpiDialog project={project} data={data} deliverables={deliverables.value} kpi={dialog.item} presetDeliverableId={dialog.deliverableId} onClose={() => setDialog(null)} onDone={done} />}
    </>
  )
}
