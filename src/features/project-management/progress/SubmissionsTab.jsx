import { useMemo, useState } from 'react'
import { BadgeCheck, Plus } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { approvalOf } from '../documents/documentUtils'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { ConfirmedProgressDialog, SubmitActivityProgressDialog } from './ProgressDialogs'
import { explainProgressError, fmt } from './progressModel'

const localDate = (instant) => {
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function SubmissionsTab({ project, data, perms, say, reloadKey, onChanged }) {
  const submissions = useLoader(() => pmApi.waterfall.progressSubmissions.list({ projectId: project.id }), `${project.id}:${reloadKey}`, perms.viewActivities, { list: true, explain: explainProgressError })
  const activities = useLoader(() => pmApi.waterfall.activities.list(project.id), `${project.id}:${reloadKey}`, perms.viewActivities, { list: true, explain: explainProgressError })
  const [dialog, setDialog] = useState(null) // { kind: 'submit' } | { kind: 'confirm', submission }
  const [status, setStatus] = useState('')
  const names = useMemo(() => Object.fromEntries(activities.value.map((activity) => [activity.id, activity.name])), [activities.value])
  const leaves = useMemo(() => {
    const parents = new Set(activities.value.map((activity) => activity.parentActivityId).filter(Boolean))
    return activities.value.filter((activity) => !parents.has(activity.id))
  }, [activities.value])
  const rows = useMemo(() => [...submissions.value].sort((a, b) => String(b.submittedAtUtc).localeCompare(String(a.submittedAtUtc))), [submissions.value])
  const shown = rows.filter((item) => status === '' || approvalOf(item.approvalStatus).key === status)
  const pendingCount = rows.filter((item) => approvalOf(item.approvalStatus).key === 'PendingApproval').length
  const changed = () => { submissions.reload(); activities.reload(); onChanged() }

  if (!perms.viewActivities) return <p className="data-state">برای مشاهده‌ی گزارش‌های پیشرفت فعالیت‌ها به دسترسی «مشاهده‌ی فعالیت‌های آبشاری» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>گزارش پیشرفت هر فعالیت جداگانه تأیید می‌شود و پس از تأیید روی پیشرفت واقعی فعالیت و برنامه‌ی زمان‌بندی اثر می‌گذارد. هر فعالیت همزمان فقط یک گزارش در انتظار تأیید دارد.</p>
        {perms.submitProgress && <button type="button" className="sch-primary" onClick={() => setDialog({ kind: 'submit' })} disabled={!leaves.length}><Plus size={16} />ثبت گزارش پیشرفت</button>}
      </div>
      {rows.length > 0 && (
        <div className="bl-chips">
          {[['', `همه (${rows.length.toLocaleString('fa-IR')})`], ['PendingApproval', `در انتظار تأیید (${pendingCount.toLocaleString('fa-IR')})`], ['Approved', 'تأییدشده'], ['Rejected', 'ردشده']].map(([key, label]) => (
            <button type="button" key={key} className={status === key ? 'active' : ''} onClick={() => setStatus(status === key && key ? '' : key)}>{label}</button>
          ))}
        </div>
      )}
      {submissions.loading && !rows.length ? <p className="data-state">در حال دریافت گزارش‌ها...</p>
        : submissions.error ? <p className="data-state data-state--error">{submissions.error} <button type="button" className="prj-clear" onClick={submissions.reload}>تلاش دوباره</button></p>
        : !rows.length ? <p className="data-state">برای این پروژه هنوز گزارش پیشرفتی برای فعالیت‌ها ثبت نشده است.{perms.submitProgress && leaves.length ? ' با «ثبت گزارش پیشرفت» شروع کنید.' : ''}</p>
        : !shown.length ? <p className="data-state">گزارشی با این وضعیت نیست.</p> : (
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 1000 }}>
            <thead><tr><th>فعالیت</th><th>گزارش‌شده</th><th>تأییدی</th><th>توضیح</th><th>سند</th><th>ثبت‌کننده</th><th>تأیید</th><th>عملیات</th></tr></thead>
            <tbody>{shown.map((item) => {
              const approval = approvalOf(item.approvalStatus)
              return (
                <tr key={item.id}>
                  <td><strong>{names[item.activityId] || 'فعالیت حذف‌شده'}</strong></td>
                  <td>{fmt(item.submittedProgress)}٪</td>
                  <td>{item.approvedProgress === null || item.approvedProgress === undefined ? '—' : <>{fmt(item.approvedProgress)}٪{item.isPartialRejection && <em className="bl-tag" title="تأییدکننده رقمی کمتر از گزارش را تأیید کرده است">رد جزئی</em>}</>}</td>
                  <td className="prg-text">{item.comment || '—'}</td>
                  <td>{item.documentName || '—'}</td>
                  <td className="sch-date">{item.submittedByUserId ? data.userName(item.submittedByUserId) : '—'}<small className="bl-note">{formatJalali(localDate(item.submittedAtUtc))}</small></td>
                  <td><span className={`status-pill ${approval.tone}`}>{approval.label}</span></td>
                  <td><div className="row-actions">
                    {perms.editActivities && approval.key === 'PendingApproval' && <button type="button" title="ثبت پیشرفت تأییدی" aria-label="ثبت پیشرفت تأییدی" onClick={() => setDialog({ kind: 'confirm', submission: item })}><BadgeCheck size={15} /></button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {pendingCount > 0 && <p className="docs-hint">تصمیم نهایی درباره‌ی گزارش‌های در انتظار (تأیید یا رد) در گردش کار تأیید گرفته می‌شود؛ این صفحه فقط رقم تأییدی را ثبت می‌کند.</p>}
      {dialog?.kind === 'submit' && <SubmitActivityProgressDialog project={project} data={data} activities={leaves} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); say('success', text); changed() }} />}
      {dialog?.kind === 'confirm' && <ConfirmedProgressDialog submission={dialog.submission} activityName={names[dialog.submission.activityId] || ''} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); say('success', text); changed() }} />}
    </>
  )
}
