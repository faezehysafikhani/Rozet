import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, Download, History, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { useConfirm } from '../../../components/ConfirmDialog'
import { formatJalali } from '../../../utils/jalali'
import { downloadFile, pmApi } from '../pmApi'
import { explainPmError, toOutcome } from '../pmErrors'
import { useProjectResources } from '../hooks'
import { APPROVAL_STATUSES, DOCUMENT_TYPES, approvalOf, documentTypeOf, formatBytes, useUploadPolicy } from './documentUtils'
import { EditDocumentDialog, UploadDocumentDialog, VersionsDialog } from './DocumentDialogs'
import './documents.css'

const RESOURCES = ['documents']

/**
 * مدیریت مستندات: documents of one project - list, filter, upload, download, edit, versions,
 * submit for approval and delete, each action shown only to users who hold its permission.
 * `data` is the shared project data of the dashboard (project list, selection, user names).
 */
export default function DocumentsPage({ data }) {
  const { can } = useAuth()
  const project = data.selectedProject
  const policy = useUploadPolicy()
  const { data: loaded, loading, errors, reload } = useProjectResources(data.selectedProjectId, RESOURCES)
  const { confirm, dialog } = useConfirm()
  const [notice, setNotice] = useState(null)
  const [dialogState, setDialogState] = useState(null) // { kind: 'upload' | 'edit' | 'versions', document? }
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const canView = can('ProjectDocuments.View')
  const canUpload = can('ProjectDocuments.Upload')
  const canEdit = can('ProjectDocuments.Edit')
  const canDelete = can('ProjectDocuments.Delete')
  const canSubmit = can('ProjectDocuments.Submit')

  const documents = loaded.documents || []
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return documents
      .filter((item) => !needle || `${item.description} ${item.fileName}`.toLowerCase().includes(needle))
      .filter((item) => typeFilter === '' || documentTypeOf(item.documentType).value === Number(typeFilter))
      .filter((item) => statusFilter === '' || approvalOf(item.approvalStatus).value === Number(statusFilter))
      .sort((a, b) => String(b.registerDate).localeCompare(String(a.registerDate)))
  }, [documents, search, typeFilter, statusFilter])

  const say = (type, text) => setNotice({ type, text })
  const done = (text) => { setDialogState(null); say('success', text); reload() }

  async function download(item) {
    setNotice(null)
    const result = await downloadFile(pmApi.documents.downloadPath(item.id), item.fileName)
    if (!result.isSuccess) say('error', result.status === 404 ? 'فایل این سند روی سرور پیدا نشد.' : explainPmError(result))
  }

  function askDelete(item) {
    confirm({
      title: 'حذف سند',
      message: `«${item.description}» با همه‌ی نسخه‌هایش برای همیشه حذف می‌شود.${approvalOf(item.approvalStatus).key === 'Approved' ? ' این سند تأییدشده است.' : ''}`,
      confirmLabel: 'حذف سند',
      danger: true,
      run: async () => {
        const outcome = toOutcome(await pmApi.documents.remove(item.id))
        if (outcome.ok) { say('success', 'سند حذف شد.'); reload() }
        return outcome
      },
    })
  }

  function askSubmit(item) {
    confirm({
      title: 'ارسال برای تأیید',
      message: `«${item.description}» برای تأیید ارسال می‌شود. اگر برای پروژه زنجیره‌ی تأییدی تعریف نشده باشد، سند مستقیماً تأیید می‌شود.`,
      confirmLabel: 'ارسال',
      run: async () => {
        const result = await pmApi.documents.submitForApproval(item.id)
        if (result.isSuccess) {
          const status = approvalOf(result.value?.approvalStatus).key
          say('success', status === 'Approved' ? 'سند تأیید شد (زنجیره‌ی تأییدی تعریف نشده بود).' : 'سند برای تأیید ارسال شد.')
          reload()
        }
        return toOutcome(result)
      },
    })
  }

  return (
    <>
      <div className="task-page-header">
        <div><span>مدیریت پروژه / مدیریت مستندات</span><h1>مدیریت مستندات</h1><p>مستندات پروژه با نسخه‌بندی و گردش تأیید</p></div>
        <div className="task-head-actions">
          {data.projects.length > 0 && (
            <select className="project-selector" value={data.selectedProjectId} onChange={(event) => data.setSelectedProjectId(event.target.value)} aria-label="پروژه">
              {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
          {canUpload && project && <button type="button" onClick={() => setDialogState({ kind: 'upload' })}><Plus size={18} />آپلود سند</button>}
        </div>
      </div>

      {notice && (
        <div className={`docs-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
          {notice.type === 'error' ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="بستن پیام"><X size={15} /></button>
        </div>
      )}

      <section className="task-panel task-table-panel">
        {!canView ? <p className="data-state">برای مشاهده‌ی مستندات به دسترسی «مشاهده‌ی مستندات پروژه» نیاز دارید.</p>
          : (data.loading && !data.projects.length) ? <p className="data-state">در حال دریافت پروژه‌ها...</p>
          : data.error ? <p className="data-state data-state--error">{data.error}</p>
          : !project ? <p className="data-state">ابتدا یک پروژه ایجاد کنید؛ مستندات به یک پروژه تعلق دارند.</p>
          : (
            <>
              <div className="docs-toolbar">
                <label className="docs-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجو در عنوان و نام فایل..." /></label>
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="نوع سند">
                  <option value="">همه‌ی انواع</option>
                  {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="وضعیت تأیید">
                  <option value="">همه‌ی وضعیت‌ها</option>
                  {APPROVAL_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
                <span className="docs-count">{visible.length.toLocaleString('fa-IR')} از {documents.length.toLocaleString('fa-IR')} سند</span>
              </div>

              {loading && !documents.length ? <p className="data-state">در حال دریافت مستندات...</p>
                : errors.documents ? <p className="data-state data-state--error">{errors.documents}</p>
                : !documents.length ? <p className="data-state">برای این پروژه هنوز سندی بارگذاری نشده است.</p>
                : !visible.length ? <p className="data-state">سندی با این فیلترها پیدا نشد.</p>
                : (
                  <div className="table-scroll"><table className="users-table" style={{ minWidth: 980 }}>
                    <thead><tr><th>عنوان</th><th>نوع</th><th>نسخه</th><th>حجم</th><th>تاریخ ثبت</th><th>ثبت‌کننده</th><th>وضعیت</th><th>عملیات</th></tr></thead>
                    <tbody>
                      {visible.map((item) => {
                        const status = approvalOf(item.approvalStatus)
                        const canResubmit = canSubmit && (status.key === 'NotSubmitted' || status.key === 'Rejected')
                        return (
                          <tr key={item.id}>
                            <td><div className="docs-title"><strong>{item.description}</strong><small>{item.fileName}</small></div></td>
                            <td>{documentTypeOf(item.documentType).label}</td>
                            <td><span className="docs-version">{Number(item.currentVersion || 1).toLocaleString('fa-IR')}</span></td>
                            <td>{formatBytes(item.sizeBytes)}</td>
                            <td>{formatJalali(item.registerDate)}</td>
                            <td>{item.createdByUserId ? data.userName(item.createdByUserId) : '—'}</td>
                            <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                            <td>
                              <div className="row-actions">
                                <button type="button" title="دانلود" aria-label="دانلود" onClick={() => download(item)}><Download size={15} /></button>
                                <button type="button" title="نسخه‌ها" aria-label="نسخه‌ها" onClick={() => setDialogState({ kind: 'versions', document: item })}><History size={15} /></button>
                                {canEdit && <button type="button" title="ویرایش" aria-label="ویرایش" onClick={() => setDialogState({ kind: 'edit', document: item })}><Pencil size={15} /></button>}
                                {canResubmit && <button type="button" title={status.key === 'Rejected' ? 'ارسال مجدد برای تأیید' : 'ارسال برای تأیید'} aria-label="ارسال برای تأیید" onClick={() => askSubmit(item)}><Send size={15} /></button>}
                                {canDelete && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(item)}><Trash2 size={15} /></button>}
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
      </section>

      {dialogState?.kind === 'upload' && project && <UploadDocumentDialog project={project} policy={policy} onClose={() => setDialogState(null)} onDone={done} />}
      {dialogState?.kind === 'edit' && <EditDocumentDialog document={dialogState.document} onClose={() => setDialogState(null)} onDone={done} />}
      {dialogState?.kind === 'versions' && (
        <VersionsDialog document={dialogState.document} policy={policy} userName={data.userName}
          onClose={() => setDialogState(null)} onChanged={(text) => { say('success', text); reload() }} />
      )}
      {dialog}
    </>
  )
}
