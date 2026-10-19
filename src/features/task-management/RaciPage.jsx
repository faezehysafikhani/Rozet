import { Info } from 'lucide-react'
import '../project-management/baselines/baselines.css'
import './tasks.css'

/**
 * ماتریس مسئولیت‌ها (RACI): the Core has no RACI data (no activity x person x R/A/C/I), so nothing is drawn here
 * rather than letters made up from the order of people. What the Core does hold - the project's governance roles
 * and team members - is listed as it is.
 */
export default function RaciPage({ data }) {
  const project = data.selectedProject
  const roles = data.governanceRoles || []
  const members = data.teamMembers || []
  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت وظایف / ماتریس مسئولیت‌ها (RACI)</span><h1>ماتریس مسئولیت‌ها (RACI)</h1><p>نقش‌های حاکمیتی و اعضای تیم هر پروژه</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(e) => data.setSelectedProjectId(e.target.value)} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="docs-notice error" role="status">
        <Info size={16} />
        <span>ماتریس RACI (مسئول، پاسخگو، مشاور، مطلع برای هر فعالیت) هنوز در سامانه‌ی مرکزی ثبت و نگهداری نمی‌شود؛ به همین دلیل جدولی ساختگی نشان داده نمی‌شود. تا آن زمان، مسئول هر وظیفه در «همه وظایف» و مسئول هر فعالیت در برنامه‌ی زمان‌بندی دیده می‌شود.</span>
      </div>

      <section className="task-panel task-table-panel">
        {!project ? <p className="data-state">{data.loading ? 'در حال دریافت پروژه‌ها...' : 'هنوز پروژه‌ای ثبت نشده است.'}</p>
          : data.loadingDetails && !roles.length && !members.length ? <p className="data-state">در حال دریافت اطلاعات...</p> : (
            <div className="table-scroll"><table className="users-table" style={{ minWidth: 560 }}>
              <thead><tr><th>نام</th><th>نقش</th><th>نوع</th></tr></thead>
              <tbody>
                {roles.map((role) => <tr key={`g-${role.id}`}><td><strong>{role.userId ? data.userName(role.userId) : '—'}</strong></td><td>{role.title || '—'}</td><td>نقش حاکمیتی</td></tr>)}
                {members.map((member) => <tr key={`m-${member.id}`}><td><strong>{data.userName(member.userId)}</strong></td><td>{member.roleTitle || '—'}</td><td>عضو تیم</td></tr>)}
                {!roles.length && !members.length && <tr><td colSpan={3}><p className="data-state">برای این پروژه نقش حاکمیتی یا عضو تیمی ثبت نشده است.</p></td></tr>}
              </tbody>
            </table></div>
          )}
      </section>
    </>
  )
}
