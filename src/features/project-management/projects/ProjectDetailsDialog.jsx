import { useState } from 'react'
import { Archive, Pencil, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { formatJalali } from '../../../utils/jalali'
import { approvalOf } from '../documents/documentUtils'
import { PROJECT_STATUSES, projectStatusOf, projectTypeOf, unitLabel } from './projectModel'

const Row = ({ label, children }) => <div className="prj-row"><dt>{label}</dt><dd>{children || '—'}</dd></div>
const Text = ({ label, value }) => value ? <div className="prj-text"><dt>{label}</dt><dd>{value}</dd></div> : null

/**
 * Everything the Core knows about one project, with the actions the user may take on it. The actions
 * themselves live in ProjectsSection (they share its confirmations and notices); this only asks for them.
 */
export default function ProjectDetailsDialog({ project, data, lookups, progress, actions, onClose }) {
  const { can } = useAuth()
  const status = projectStatusOf(project.status)
  const approval = approvalOf(project.approvalStatus)
  const archived = status.key === 'Archived'
  const [busy, setBusy] = useState(false)
  const unit = lookups.units.find((item) => item.id === project.organizationUnitId)
  const calendar = lookups.calendars.find((item) => item.id === project.workCalendarId)
  const canSubmit = can('Projects.Submit') && !archived && (approval.key === 'NotSubmitted' || approval.key === 'Rejected')
  const canArchive = can('Projects.Delete') && !archived
  const hasActions = can('Projects.Edit') || canSubmit || canArchive || can('Projects.Remove')

  async function changeStatus(value) {
    setBusy(true)
    await actions.changeStatus(project, Number(value))
    setBusy(false)
  }

  return (
    <div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="ue-modal pm-modal prj-modal" role="dialog" aria-modal="true" aria-label={`جزئیات ${project.name}`} dir="rtl">
        <header className="ue-head">
          <div className="ue-head-title"><strong>{project.name}</strong><small>{project.code} · {projectTypeOf(project.type).label}</small></div>
          <button className="ue-close" type="button" onClick={onClose} aria-label="بستن"><X size={17} /></button>
        </header>
        <div className="ue-body">
          <dl className="prj-details">
            <Row label="وضعیت"><span className={`status-pill ${status.tone}`}>{status.label}</span></Row>
            <Row label="وضعیت تأیید"><span className={`status-pill ${approval.tone}`}>{approval.label}</span></Row>
            <Row label="مدیر پروژه">{project.managerUserId ? data.userName(project.managerUserId) : ''}</Row>
            <Row label="مالک پروژه">{project.ownerUserId ? data.userName(project.ownerUserId) : ''}</Row>
            <Row label="واحد سازمانی">{unit ? unitLabel(unit) : ''}</Row>
            <Row label="تقویم کاری">{calendar?.name}</Row>
            <Row label="تاریخ شروع">{project.startDate ? formatJalali(project.startDate) : ''}</Row>
            <Row label="تاریخ پایان">{project.endDate ? formatJalali(project.endDate) : ''}</Row>
            <Row label="هزینه اولیه">{project.cost != null ? Number(project.cost).toLocaleString('fa-IR') : ''}</Row>
            <Row label="تاریخ ایجاد">{project.createdAtUtc ? formatJalali(String(project.createdAtUtc).slice(0, 10)) : ''}</Row>
            <Row label="پیشرفت برنامه‌ای">{progress ? `${Number(progress.plannedProgress).toLocaleString('fa-IR')}٪` : ''}</Row>
            <Row label="پیشرفت واقعی">{progress ? `${Number(progress.actualProgress).toLocaleString('fa-IR')}٪` : ''}</Row>
          </dl>
          <dl className="prj-texts">
            <Text label="هدف پروژه" value={project.goal} />
            <Text label="نیازمندی‌ها" value={project.requirements} />
            <Text label="محدودیت‌ها" value={project.constraints} />
            <Text label="مفروضات" value={project.assumptions} />
            <Text label="توضیحات" value={project.description} />
          </dl>

          {can('Projects.Edit') && !archived && (
            <label className="ue-field prj-status">
              <span>تغییر وضعیت پروژه</span>
              <select value={status.value} onChange={(event) => changeStatus(event.target.value)} disabled={busy}>
                {PROJECT_STATUSES.filter((item) => item.key !== 'Archived').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          )}
          {archived && <p className="docs-hint">این پروژه آرشیو شده است و وضعیتش تغییر نمی‌کند.</p>}
        </div>
        {hasActions && <footer className="ue-foot">
          <div className="prj-actions">
            {can('Projects.Edit') && <button type="button" onClick={() => actions.edit(project)}><Pencil size={15} />ویرایش</button>}
            {canSubmit && <button type="button" onClick={() => actions.submit(project)}><Send size={15} />{approval.key === 'Rejected' ? 'ارسال مجدد برای تأیید' : 'ارسال برای تأیید'}</button>}
            {canArchive && <button type="button" onClick={() => actions.archive(project)}><Archive size={15} />آرشیو</button>}
            {can('Projects.Remove') && <button type="button" className="danger" onClick={() => actions.remove(project)}><Trash2 size={15} />حذف</button>}
          </div>
        </footer>}
      </div>
    </div>
  )
}
