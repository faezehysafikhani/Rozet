import { useMemo, useState } from 'react'
import { Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { approvalOf } from '../documents/documentUtils'
import { pmApi } from '../pmApi'
import { ProgressUpdateDialog } from './ProgressDialogs'
import { classificationOf, deviationText, fmt, toProgressOutcome } from './progressModel'

/** `list` is the page's own load of the project's reports (the KPI cards read it too). */
export default function UpdatesTab({ project, data, perms, confirm, say, list, onChanged }) {
  const [dialog, setDialog] = useState(null) // { update? }
  const rows = useMemo(() => [...list.value].sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate))), [list.value])
  const changed = () => { list.reload(); onChanged() }

  function askDelete(item) {
    confirm({
      title: 'حذف گزارش وضعیت',
      message: `گزارش ${formatJalali(item.registerDate)} برای همیشه حذف می‌شود.`,
      confirmLabel: 'حذف گزارش', danger: true,
      run: async () => {
        const outcome = toProgressOutcome(await pmApi.progress.remove(item.id))
        if (outcome.ok) { say('success', 'گزارش حذف شد.'); changed() }
        return outcome
      },
    })
  }

  function askSubmit(item) {
    confirm({
      title: 'ارسال برای تأیید',
      message: `گزارش ${formatJalali(item.registerDate)} برای تأیید ارسال می‌شود. اگر برای پروژه زنجیره‌ی تأییدی تعریف نشده باشد، مستقیماً تأیید می‌شود و پیشرفت تأییدی پروژه برابر پیشرفت واقعی این گزارش می‌شود.`,
      confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.progress.submitForApproval(item.id)
        if (result.isSuccess) { say('success', approvalOf(result.value?.approvalStatus).key === 'Approved' ? 'گزارش تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'گزارش برای تأیید ارسال شد.'); changed() }
        return toProgressOutcome(result)
      },
    })
  }

  if (!perms.view) return <p className="data-state">برای مشاهده‌ی گزارش‌های وضعیت به دسترسی «مشاهده‌ی گزارش‌های وضعیت پروژه» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>گزارش‌های دوره‌ای وضعیت پروژه؛ انحراف و طبقه‌بندی را Core از تفاوت پیشرفت واقعی و برنامه‌ای حساب می‌کند.</p>
        {perms.create && <button type="button" className="sch-primary" onClick={() => setDialog({})}><Plus size={16} />ثبت گزارش</button>}
      </div>
      {list.loading && !rows.length ? <p className="data-state">در حال دریافت گزارش‌ها...</p>
        : list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p>
        : !rows.length ? <p className="data-state">برای این پروژه هنوز گزارش وضعیتی ثبت نشده است.{perms.create ? ' با «ثبت گزارش» شروع کنید.' : ''}</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 1100 }}>
            <thead><tr><th>تاریخ</th><th>شرح وضعیت</th><th>برنامه‌ای</th><th>واقعی</th><th>تأییدی</th><th>انحراف</th><th>طبقه‌بندی</th><th>دلایل تأخیر</th><th>تأیید</th><th>عملیات</th></tr></thead>
            <tbody>{rows.map((item) => {
              const approval = approvalOf(item.approvalStatus)
              const pending = approval.key === 'PendingApproval'
              const classification = classificationOf(item.performanceClassification)
              return (
                <tr key={item.id}>
                  <td className="sch-date">{formatJalali(item.registerDate)}{item.createdByUserId ? <small className="bl-note">{data.userName(item.createdByUserId)}</small> : null}</td>
                  <td className="prg-text">{item.statusDescription || '—'}</td>
                  <td>{fmt(item.plannedProgress)}٪</td><td>{fmt(item.actualProgress)}٪</td>
                  <td>{item.confirmedProgress === null || item.confirmedProgress === undefined ? '—' : `${fmt(item.confirmedProgress)}٪`}</td>
                  <td><b className={`bl-var ${item.deviation < 0 ? 'late' : item.deviation > 0 ? 'early' : ''}`}>{deviationText(item.deviation)}</b></td>
                  <td><span className={`status-pill ${classification.tone}`}>{classification.label}</span></td>
                  <td className="prg-text">{item.delayReasons || '—'}</td>
                  <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                  <td><div className="row-actions">
                    {perms.edit && !pending && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setDialog({ update: item })}><Pencil size={15} /></button>}
                    {perms.submit && (approval.key === 'NotSubmitted' || approval.key === 'Rejected') && <button type="button" title="ارسال برای تأیید" aria-label="ارسال برای تأیید" onClick={() => askSubmit(item)}><Send size={15} /></button>}
                    {perms.delete && !pending && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(item)}><Trash2 size={15} /></button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {dialog && <ProgressUpdateDialog project={project} data={data} update={dialog.update} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); say('success', text); changed() }} />}
    </>
  )
}
