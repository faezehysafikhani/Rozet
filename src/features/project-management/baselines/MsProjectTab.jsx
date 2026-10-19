import { useRef, useState } from 'react'
import { CircleAlert, Download, FileUp } from 'lucide-react'
import { unwrap } from '../../../services/api'
import { downloadFile, pmApi } from '../pmApi'
import { explainBaselineError, explainImportWarning } from './baselineModel'

const MAX_BYTES = 20 * 1024 * 1024

export default function MsProjectTab({ project, canView, canManage, confirm, say, onImported }) {
  const input = useRef(null)
  const [file, setFile] = useState(null)
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  async function exportPlan() {
    setExporting(true)
    const result = await downloadFile(pmApi.waterfall.msProject.exportPath(project.id), 'project.xml')
    setExporting(false)
    say(result.isSuccess ? 'success' : 'error', result.isSuccess ? 'فایل XML برنامه دریافت شد.' : `دریافت فایل ناموفق بود: ${result.error}`)
  }

  function chooseFile(event) {
    const picked = event.target.files?.[0] || null
    setReport(null)
    if (picked && picked.size > MAX_BYTES) { setFile(null); setError('حجم فایل بیشتر از ۲۰ مگابایت است.'); event.target.value = ''; return }
    if (picked && picked.size === 0) { setFile(null); setError('فایل خالی است.'); event.target.value = ''; return }
    setFile(picked); setError('')
  }

  async function runImport() {
    setBusy(true); setError('')
    const result = await pmApi.waterfall.msProject.import(file, project.id, replace)
    setBusy(false)
    if (!result.isSuccess) { const text = explainBaselineError(result); setError(text); return { ok: false, error: text } }
    const done = unwrap(result) || {}
    setReport({ activities: done.activitiesImported, dependencies: done.dependenciesImported, replaced: done.activitiesReplaced, warnings: done.warnings || [] })
    setFile(null); setReplace(false)
    if (input.current) input.current.value = ''
    say('success', 'برنامه از فایل MS Project وارد شد.')
    onImported()
    return { ok: true }
  }

  function submit(event) {
    event.preventDefault()
    if (!file) { setError('فایل XML را انتخاب کنید.'); return }
    if (!replace) { runImport(); return }
    confirm({
      title: 'جایگزینی برنامه‌ی فعلی',
      message: 'همه‌ی فعالیت‌ها و وابستگی‌های فعلی این پروژه حذف و با محتوای فایل جایگزین می‌شوند. این کار برگشت‌پذیر نیست. (اگر فایل نامعتبر باشد، برنامه‌ی فعلی دست‌نخورده می‌ماند.)',
      confirmLabel: 'جایگزین کن', danger: true,
      run: runImport,
    })
  }

  if (!canView) return <p className="data-state">برای استفاده از MS Project به دسترسی «مشاهده‌ی فعالیت‌های آبشاری» نیاز دارید.</p>
  return (
    <div className="bl-ms">
      <section>
        <h4 className="bl-subtitle">خروجی</h4>
        <p>برنامه‌ی فعلی پروژه (فعالیت‌ها، ساختار WBS و وابستگی‌ها) به‌صورت فایل XML برای باز کردن در MS Project.</p>
        <button type="button" className="bl-button" onClick={exportPlan} disabled={exporting}><Download size={16} />{exporting ? 'در حال آماده‌سازی...' : 'دریافت فایل XML'}</button>
      </section>
      <section>
        <h4 className="bl-subtitle">ورودی</h4>
        {!canManage ? <p className="docs-hint">ورود فایل به دسترسی «مدیریت زمان‌بندی» نیاز دارد.</p> : (
          <form onSubmit={submit} noValidate>
            <p>فایل XML ذخیره‌شده از MS Project (Save As ← XML) را انتخاب کنید؛ حداکثر ۲۰ مگابایت.</p>
            <label className="ue-field"><span>فایل</span><input ref={input} type="file" accept=".xml,text/xml,application/xml" onChange={chooseFile} /></label>
            <label className="sch-check"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />جایگزینی فعالیت‌های موجود پروژه</label>
            <small className="docs-hint">اگر پروژه از قبل فعالیت دارد و این گزینه خاموش باشد، Core ورود را رد می‌کند.</small>
            {error && <span className="ue-error" role="alert">{error}</span>}
            <div><button type="submit" className="sch-primary bl-button" disabled={busy || !file}><FileUp size={16} />{busy ? 'در حال ورود...' : 'ورود برنامه'}</button></div>
          </form>
        )}
        {report && (
          <div className="bl-report" role="status">
            <strong>ورود انجام شد</strong>
            <span>{Number(report.activities).toLocaleString('fa-IR')} فعالیت و {Number(report.dependencies).toLocaleString('fa-IR')} وابستگی وارد شد{report.replaced ? `؛ ${Number(report.replaced).toLocaleString('fa-IR')} فعالیت قبلی جایگزین شد` : ''}.</span>
            {report.warnings.length > 0 && <ul>{report.warnings.map((text) => <li key={text}><CircleAlert size={14} />{explainImportWarning(text)}</li>)}</ul>}
          </div>
        )}
      </section>
    </div>
  )
}
