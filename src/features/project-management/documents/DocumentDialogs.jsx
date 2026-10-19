import { useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useAuth } from '../../../services/AuthContext'
import { formatJalali } from '../../../utils/jalali'
import { downloadFile, listOf, pmApi } from '../pmApi'
import { explainPmError } from '../pmErrors'
import { DOCUMENT_TYPES, approvalOf, checkUpload, documentTypeOf, formatBytes } from './documentUtils'

function Shell({ title, subtitle, onClose, busy, children, footer }) {
  return (
    <div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className="ue-modal docs-modal" role="dialog" aria-modal="true" aria-label={title} dir="rtl">
        <header className="ue-head">
          <div className="ue-head-title"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
          <button className="ue-close" type="button" onClick={onClose} disabled={busy} aria-label="بستن"><X size={17} /></button>
        </header>
        {children}
        {footer}
      </div>
    </div>
  )
}

const Field = ({ label, children, hint }) => <label className="ue-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>

/** Upload a new document into a project. */
export function UploadDocumentDialog({ project, policy, onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const problem = checkUpload(file, policy)
    if (problem) { setError(problem); return }
    if (!description.trim()) { setError('عنوان یا توضیح سند را وارد کنید.'); return }
    setBusy(true); setError('')
    const result = await pmApi.documents.upload({ file, projectId: project.id, description: description.trim(), documentType })
    setBusy(false)
    if (!result.isSuccess) { setError(explainPmError(result)); return }
    onDone(`سند «${description.trim()}» بارگذاری شد.`)
  }

  return (
    <Shell title="آپلود سند پروژه" subtitle={project.name} onClose={onClose} busy={busy}
      footer={null}>
      <form onSubmit={submit}>
        <div className="ue-body"><div className="ue-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="فایل *" hint={policy ? `فرمت‌های مجاز: ${policy.allowedExtensions.join('، ')} — حداکثر ${formatBytes(policy.maxFileSizeKb * 1024)}` : undefined}>
              <input type="file" accept={policy?.allowedExtensions.join(',')} onChange={(event) => { setFile(event.target.files?.[0] || null); setError('') }} required />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="عنوان / توضیح سند *">
              <input value={description} onChange={(event) => { setDescription(event.target.value); setError('') }} maxLength={500} required />
            </Field>
          </div>
          <Field label="نوع سند">
            <select value={documentType} onChange={(event) => setDocumentType(Number(event.target.value))}>
              {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
        </div></div>
        <footer className="ue-foot">
          {error && <span className="ue-error">{error}</span>}
          <div className="ue-foot-actions">
            <button className="ue-cancel" type="button" onClick={onClose} disabled={busy}>انصراف</button>
            <button className="ue-save" type="submit" disabled={busy}>{busy ? 'در حال بارگذاری...' : 'بارگذاری'}</button>
          </div>
        </footer>
      </form>
    </Shell>
  )
}

/** Change a document's title and type (the file itself is replaced by uploading a new version). */
export function EditDocumentDialog({ document, onClose, onDone }) {
  const [description, setDescription] = useState(document.description || '')
  const [documentType, setDocumentType] = useState(documentTypeOf(document.documentType).value)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!description.trim()) { setError('عنوان یا توضیح سند را وارد کنید.'); return }
    setBusy(true); setError('')
    const result = await pmApi.documents.update(document.id, { description: description.trim(), documentType })
    setBusy(false)
    if (!result.isSuccess) { setError(explainPmError(result)); return }
    onDone('اطلاعات سند ذخیره شد.')
  }

  return (
    <Shell title="ویرایش سند" subtitle={document.fileName} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="ue-body"><div className="ue-grid">
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="عنوان / توضیح سند *"><input value={description} onChange={(event) => { setDescription(event.target.value); setError('') }} maxLength={500} required autoFocus /></Field>
          </div>
          <Field label="نوع سند">
            <select value={documentType} onChange={(event) => setDocumentType(Number(event.target.value))}>
              {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
        </div></div>
        <footer className="ue-foot">
          {error && <span className="ue-error">{error}</span>}
          <div className="ue-foot-actions">
            <button className="ue-cancel" type="button" onClick={onClose} disabled={busy}>انصراف</button>
            <button className="ue-save" type="submit" disabled={busy}>{busy ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </footer>
      </form>
    </Shell>
  )
}

/** Version history of a document, with a download for each and an upload for a new one. */
export function VersionsDialog({ document, policy, userName, onClose, onChanged }) {
  const { can } = useAuth()
  const [versions, setVersions] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [file, setFile] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const canUpload = can('ProjectDocuments.Upload')
  const pending = approvalOf(document.approvalStatus).key === 'PendingApproval'

  async function load() {
    const result = await pmApi.documents.versions(document.id)
    if (!result.isSuccess) { setLoadError(explainPmError(result)); setVersions([]); return }
    setLoadError('')
    setVersions(listOf(result).sort((a, b) => b.versionNumber - a.versionNumber))
  }
  useEffect(() => { load() }, [document.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function download(version) {
    setError('')
    const result = await downloadFile(pmApi.documents.versionDownloadPath(document.id, version.versionNumber), version.fileName)
    if (!result.isSuccess) setError(result.status === 404 ? 'فایل این نسخه روی سرور پیدا نشد.' : explainPmError(result))
  }

  async function upload(event) {
    event.preventDefault()
    const problem = checkUpload(file, policy)
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    const result = await pmApi.documents.uploadVersion(document.id, file, { comment: comment.trim() })
    setBusy(false)
    if (!result.isSuccess) { setError(explainPmError(result)); return }
    setFile(null); setComment(''); if (fileInput.current) fileInput.current.value = ''
    await load()
    onChanged(`نسخه‌ی جدید «${document.description}» بارگذاری شد.`)
  }

  return (
    <Shell title="نسخه‌های سند" subtitle={document.description} onClose={onClose} busy={busy}>
      <div className="ue-body">
        {versions === null && <p className="data-state">در حال دریافت نسخه‌ها...</p>}
        {loadError && <p className="data-state data-state--error">{loadError}</p>}
        {versions && !loadError && !versions.length && <p className="data-state">نسخه‌ای ثبت نشده است.</p>}
        {versions && versions.length > 0 && (
          <ul className="docs-versions">
            {versions.map((version) => (
              <li key={version.versionNumber} className={version.isCurrent ? 'current' : ''}>
                <span className="ver-no">{version.versionNumber.toLocaleString('fa-IR')}</span>
                <div className="ver-info">
                  <span>{version.fileName}</span>
                  <small>
                    {formatBytes(version.sizeBytes)} · {version.createdAtUtc ? formatJalali(String(version.createdAtUtc).slice(0, 10)) : '—'}
                    {version.createdByUserId ? ` · ${userName(version.createdByUserId)}` : ''}
                    {version.isCurrent ? ' · نسخه‌ی فعلی' : ''}
                  </small>
                  {version.comment && <small>«{version.comment}»</small>}
                </div>
                <div className="row-actions"><button type="button" title="دانلود این نسخه" aria-label="دانلود این نسخه" onClick={() => download(version)}><Download size={15} /></button></div>
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <form className="docs-newversion" onSubmit={upload}>
            <strong>بارگذاری نسخه‌ی جدید</strong>
            {pending
              ? <p className="docs-hint">این سند در انتظار تأیید است و نسخه‌ی جدید نمی‌پذیرد؛ پس از تعیین تکلیف تأیید دوباره تلاش کنید.</p>
              : <>
                <Field label="فایل" hint={policy ? `حداکثر ${formatBytes(policy.maxFileSizeKb * 1024)}` : undefined}>
                  <input ref={fileInput} type="file" accept={policy?.allowedExtensions.join(',')} onChange={(event) => { setFile(event.target.files?.[0] || null); setError('') }} required />
                </Field>
                <Field label="توضیح تغییرات (اختیاری)"><input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} /></Field>
              </>}
            {error && <span className="ue-error">{error}</span>}
            {!pending && <div className="ue-foot-actions" style={{ marginInlineStart: 0 }}><button className="ue-save" type="submit" disabled={busy || !file}>{busy ? 'در حال بارگذاری...' : 'بارگذاری نسخه'}</button></div>}
          </form>
        )}
        {!canUpload && error && <span className="ue-error">{error}</span>}
      </div>
    </Shell>
  )
}
