import { useMemo, useState } from 'react'
import { Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { approvalOf } from '../documents/documentUtils'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { DelayReasonDialog } from './ProgressDialogs'
import { ROOT_CAUSES, explainProgressError, fmt, rootCauseOf, toProgressOutcome } from './progressModel'

export default function DelayReasonsTab({ project, data, perms, confirm, say, reloadKey }) {
  const list = useLoader(() => pmApi.delayReasons.list(project.id), `${project.id}:${reloadKey}`, perms.view, { list: true, explain: explainProgressError })
  const [dialog, setDialog] = useState(null)
  const [cause, setCause] = useState('')
  const rows = useMemo(() => [...list.value].sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate))), [list.value])
  const shown = rows.filter((item) => cause === '' || rootCauseOf(item.rootCause).value === Number(cause))
  const totals = useMemo(() => ROOT_CAUSES.map((entry) => {
    const items = rows.filter((item) => rootCauseOf(item.rootCause).value === entry.value)
    return { ...entry, count: items.length, days: items.reduce((sum, item) => sum + Number(item.timeImpactDays || 0), 0), cost: items.reduce((sum, item) => sum + Number(item.costImpact || 0), 0) }
  }).filter((entry) => entry.count), [rows])

  function askDelete(item) {
    confirm({
      title: 'حذف دلیل تأخیر', message: 'این دلیل تأخیر برای همیشه حذف می‌شود.', confirmLabel: 'حذف', danger: true,
      run: async () => {
        const outcome = toProgressOutcome(await pmApi.delayReasons.remove(item.id))
        if (outcome.ok) { say('success', 'دلیل تأخیر حذف شد.'); list.reload() }
        return outcome
      },
    })
  }

  function askSubmit(item) {
    confirm({
      title: 'ارسال برای تأیید', message: 'این دلیل تأخیر برای تأیید ارسال می‌شود. اگر زنجیره‌ی تأییدی تعریف نشده باشد، مستقیماً تأیید می‌شود.', confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.delayReasons.submitForApproval(item.id)
        if (result.isSuccess) { say('success', approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'دلیل تأخیر تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'دلیل تأخیر برای تأیید ارسال شد.'); list.reload() }
        return toProgressOutcome(result)
      },
    })
  }

  if (!perms.view) return <p className="data-state">برای مشاهده‌ی دلایل تأخیر به دسترسی «مشاهده‌ی دلایل تأخیر پروژه» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>دلایل ساختاریافته‌ی تأخیر با علت ریشه‌ای، اثر زمانی و هزینه‌ای و اقدام اصلاحی.</p>
        {perms.create && <button type="button" className="sch-primary" onClick={() => setDialog({})}><Plus size={16} />ثبت دلیل تأخیر</button>}
      </div>
      {totals.length > 0 && (
        <div className="bl-cards">
          {totals.map((entry) => <article key={entry.value}><small>{entry.label}</small><strong>{entry.count.toLocaleString('fa-IR')} مورد</strong><span>{entry.days ? `${fmt(entry.days, 0)} روز` : 'بدون اثر زمانی'}{entry.cost ? ` · ${fmt(entry.cost, 0)} هزینه` : ''}</span></article>)}
        </div>
      )}
      {rows.length > 0 && (
        <div className="bl-chips">
          <button type="button" className={cause === '' ? 'active' : ''} onClick={() => setCause('')}>همه ({rows.length.toLocaleString('fa-IR')})</button>
          {totals.map((entry) => <button type="button" key={entry.value} className={cause === String(entry.value) ? 'active' : ''} onClick={() => setCause(cause === String(entry.value) ? '' : String(entry.value))}>{entry.label} ({entry.count.toLocaleString('fa-IR')})</button>)}
        </div>
      )}
      {list.loading && !rows.length ? <p className="data-state">در حال دریافت دلایل تأخیر...</p>
        : list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p>
        : !rows.length ? <p className="data-state">برای این پروژه هنوز دلیل تأخیری ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 1000 }}>
            <thead><tr><th>تاریخ</th><th>علت ریشه‌ای</th><th>شرح</th><th>اثر زمانی</th><th>اثر هزینه‌ای</th><th>اقدام اصلاحی</th><th>تأیید</th><th>عملیات</th></tr></thead>
            <tbody>{shown.map((item) => {
              const approval = approvalOf(item.approvalStatus)
              const pending = approval.key === 'PendingApproval'
              return (
                <tr key={item.id}>
                  <td className="sch-date">{formatJalali(item.registerDate)}{item.createdByUserId ? <small className="bl-note">{data.userName(item.createdByUserId)}</small> : null}</td>
                  <td><span className="status-pill todo">{rootCauseOf(item.rootCause).label}</span></td>
                  <td className="prg-text">{item.description}</td>
                  <td>{item.timeImpactDays === null || item.timeImpactDays === undefined ? '—' : `${fmt(item.timeImpactDays, 0)} روز`}</td>
                  <td>{item.costImpact === null || item.costImpact === undefined ? '—' : fmt(item.costImpact, 0)}</td>
                  <td className="prg-text">{item.correctiveAction || '—'}</td>
                  <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                  <td><div className="row-actions">
                    {perms.edit && !pending && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setDialog({ reason: item })}><Pencil size={15} /></button>}
                    {perms.submit && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => askSubmit(item)}><Send size={15} /></button>}
                    {perms.delete && !pending && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(item)}><Trash2 size={15} /></button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {dialog && <DelayReasonDialog project={project} data={data} reason={dialog.reason} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); say('success', text); list.reload() }} />}
    </>
  )
}
