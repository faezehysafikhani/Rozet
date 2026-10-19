import { useMemo, useState } from 'react'
import { GitCompare, Plus, Trash2 } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { Field, Footer, Shell } from '../DialogParts'
import { pmApi } from '../pmApi'
import { BASELINE_KINDS, explainBaselineError, fmt, kindOf, varianceOf, varianceText, varianceTone, VARIANCE_STATUSES } from './baselineModel'
import { useLoader } from '../useLoader'

const localDate = (instant) => {
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function CreateBaselineDialog({ project, data, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', note: '', kind: 0 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) { setError('نام نسخه را وارد کنید.'); return }
    setBusy(true)
    const result = await pmApi.waterfall.baselines.create({ tenantId: data.tenantId, projectId: project.id, name: form.name.trim(), note: form.note.trim() || null, kind: Number(form.kind) })
    setBusy(false)
    if (!result.isSuccess) { setError(explainBaselineError(result)); return }
    onDone(`نسخه‌ی «${form.name.trim()}» از برنامه‌ی فعلی ثبت شد.`)
  }

  return (
    <Shell title="ثبت خط مبنا" subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="نام نسخه *" wide><input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={200} autoFocus placeholder="مثلاً خط مبنای اولیه" /></Field>
          <Field label="نوع نسخه" wide hint={kindOf(form.kind).hint}>
            <select value={form.kind} onChange={(e) => set('kind', Number(e.target.value))}>{BASELINE_KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}</select>
          </Field>
          <Field label="یادداشت (اختیاری)" wide><textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={2000} /></Field>
          <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>تاریخ‌ها، وزن‌ها، پیشرفت و مسئول همه‌ی فعالیت‌ها همین حالا کپی می‌شود. نسخه بعداً قابل ویرایش نیست و فقط حذف می‌شود.</p>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت نسخه" busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}

/** One saved copy: how today's plan differs from it, and what it contained. */
function BaselineDetailDialog({ baseline, data, onClose }) {
  const [tab, setTab] = useState('variance')
  const variance = useLoader(() => pmApi.waterfall.baselines.variance(baseline.id), baseline.id, true, { explain: explainBaselineError })
  const detail = useLoader(() => pmApi.waterfall.baselines.get(baseline.id), baseline.id, tab === 'content', { explain: explainBaselineError })
  const v = variance.value
  const [filter, setFilter] = useState('')
  const rows = useMemo(() => (v?.activities || []).filter((row) => !filter || varianceOf(row.status).key === filter), [v, filter])
  const counts = v ? { OnTrack: v.onTrackCount, Late: v.lateCount, Early: v.earlyCount, Added: v.addedCount, Removed: v.removedCount } : {}
  const contents = detail.value?.activities || []
  const byId = Object.fromEntries(contents.map((row) => [row.activityId, row]))
  const depth = (row) => { let level = 0; for (let p = row.parentActivityId; p && byId[p] && level < 20; p = byId[p].parentActivityId) level += 1; return level }

  return (
    <Shell title={`نسخه‌ی ${Number(baseline.number).toLocaleString('fa-IR')} — ${baseline.name}`} subtitle={`${kindOf(baseline.kind).label} · ثبت‌شده در ${formatJalali(localDate(baseline.createdAtUtc))}`} wide="xl" onClose={onClose}>
      <div className="ue-body">
        <div className="bl-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'variance'} className={tab === 'variance' ? 'active' : ''} onClick={() => setTab('variance')}>مقایسه با برنامه‌ی فعلی</button>
          <button type="button" role="tab" aria-selected={tab === 'content'} className={tab === 'content' ? 'active' : ''} onClick={() => setTab('content')}>محتوای نسخه</button>
        </div>
        {baseline.note && <p className="docs-hint">{baseline.note}</p>}

        {tab === 'variance' && (variance.loading && !v ? <p className="data-state">در حال مقایسه...</p>
          : variance.error ? <p className="data-state data-state--error">{variance.error}</p>
          : v && (
            <>
              <div className="bl-cards">
                <article><small>شروع پروژه</small><strong>{formatJalali(v.currentProjectStart)}</strong><span>نسخه: {formatJalali(v.baselineProjectStart)} · <b className={`bl-var ${varianceTone(v.projectStartVarianceDays)}`}>{varianceText(v.projectStartVarianceDays)}</b></span></article>
                <article><small>پایان پروژه</small><strong>{formatJalali(v.currentProjectFinish)}</strong><span>نسخه: {formatJalali(v.baselineProjectFinish)} · <b className={`bl-var ${varianceTone(v.projectFinishVarianceDays)}`}>{varianceText(v.projectFinishVarianceDays)}</b></span></article>
              </div>
              <div className="bl-chips">
                <button type="button" className={!filter ? 'active' : ''} onClick={() => setFilter('')}>همه ({(v.activities || []).length.toLocaleString('fa-IR')})</button>
                {VARIANCE_STATUSES.map((status) => <button type="button" key={status.key} className={filter === status.key ? 'active' : ''} onClick={() => setFilter(filter === status.key ? '' : status.key)}>{status.label} ({Number(counts[status.key] || 0).toLocaleString('fa-IR')})</button>)}
              </div>
              {!rows.length ? <p className="data-state">فعالیتی با این وضعیت نیست.</p> : (
                <div className="table-scroll"><table className="users-table bl-table">
                  <thead><tr><th>فعالیت</th><th>وضعیت</th><th>شروع (نسخه / فعلی)</th><th>انحراف شروع</th><th>پایان (نسخه / فعلی)</th><th>انحراف پایان</th><th>انحراف مدت</th></tr></thead>
                  <tbody>{rows.map((row) => {
                    const status = varianceOf(row.status)
                    return (
                      <tr key={row.activityId}>
                        <td><strong>{row.name}</strong>{row.isSummary && <em className="bl-tag">خلاصه</em>}{row.isMilestone && <em className="bl-tag">نقطه‌عطف</em>}</td>
                        <td><span className={`status-pill ${status.tone}`}>{status.label}</span></td>
                        <td className="sch-date bl-pair"><span>{formatJalali(row.baselineStart)}</span><span>{formatJalali(row.currentStart)}</span></td>
                        <td><b className={`bl-var ${varianceTone(row.startVarianceDays)}`}>{varianceText(row.startVarianceDays)}</b></td>
                        <td className="sch-date bl-pair"><span>{formatJalali(row.baselineFinish)}</span><span>{formatJalali(row.currentFinish)}</span></td>
                        <td><b className={`bl-var ${varianceTone(row.finishVarianceDays)}`}>{varianceText(row.finishVarianceDays)}</b></td>
                        <td><b className={`bl-var ${varianceTone(row.durationVarianceDays)}`}>{varianceText(row.durationVarianceDays, true)}</b></td>
                      </tr>
                    )
                  })}</tbody>
                </table></div>
              )}
              <p className="docs-hint">انحراف یعنی تاریخ یا مدت فعلی نسبت به نسخه، به روز تقویمی. در هر خانه‌ی تاریخ، سطر بالا نسخه و سطر پایین برنامه‌ی فعلی است.</p>
            </>
          ))}

        {tab === 'content' && (detail.loading && !detail.value ? <p className="data-state">در حال دریافت...</p>
          : detail.error ? <p className="data-state data-state--error">{detail.error}</p>
          : !contents.length ? <p className="data-state">این نسخه فعالیتی ندارد.</p> : (
            <div className="table-scroll"><table className="users-table bl-table">
              <thead><tr><th>WBS</th><th>فعالیت</th><th>مسئول</th><th>شروع</th><th>پایان</th><th>مدت</th><th>وزن</th><th>پیشرفت برنامه‌ای</th><th>پیشرفت واقعی</th></tr></thead>
              <tbody>{contents.map((row) => (
                <tr key={row.activityId} className={row.isSummary ? 'sch-summary-row' : ''}>
                  <td className="sch-wbs">{row.wbsCode}</td>
                  <td><div className="sch-name" style={{ paddingInlineStart: `${depth(row) * 20}px` }}><strong>{row.name}</strong>{row.isMilestone && <em className="bl-tag">نقطه‌عطف</em>}</div></td>
                  <td>{row.responsibleUserId ? data.userName(row.responsibleUserId) : '—'}</td>
                  <td className="sch-date">{formatJalali(row.startDate)}</td><td className="sch-date">{formatJalali(row.endDate)}</td>
                  <td>{Number(row.durationDays).toLocaleString('fa-IR')}</td><td>{fmt(row.weight)}٪</td><td>{fmt(row.plannedProgress)}٪</td><td>{fmt(row.actualProgress)}٪</td>
                </tr>
              ))}</tbody>
            </table></div>
          ))}
      </div>
    </Shell>
  )
}

export default function BaselinesTab({ project, data, canView, canManage, confirm, say }) {
  const list = useLoader(() => pmApi.waterfall.baselines.list(project.id), project.id, canView, { list: true, explain: explainBaselineError })
  const [dialog, setDialog] = useState(null) // { kind: 'create' } | { kind: 'detail', baseline }
  const baselines = [...list.value].sort((a, b) => b.number - a.number)

  function askDelete(baseline) {
    confirm({
      title: 'حذف نسخه',
      message: `نسخه‌ی ${Number(baseline.number).toLocaleString('fa-IR')} («${baseline.name}») برای همیشه حذف می‌شود و دیگر نمی‌توان برنامه را با آن مقایسه کرد.`,
      confirmLabel: 'حذف نسخه',
      danger: true,
      run: async () => {
        const result = await pmApi.waterfall.baselines.remove(baseline.id)
        const outcome = { ok: result.isSuccess, error: result.isSuccess ? '' : explainBaselineError(result) }
        if (outcome.ok) { say('success', `نسخه‌ی «${baseline.name}» حذف شد.`); list.reload() }
        return outcome
      },
    })
  }

  if (!canView) return <p className="data-state">برای مشاهده‌ی خط مبنا به دسترسی «مشاهده‌ی فعالیت‌های آبشاری» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>نسخه‌هایی از برنامه‌ی زمان‌بندی که در یک روز مشخص ثبت شده‌اند؛ برنامه‌ی فعلی را با هر کدام می‌توان مقایسه کرد.</p>
        {canManage && <button type="button" className="sch-primary" onClick={() => setDialog({ kind: 'create' })}><Plus size={16} />ثبت خط مبنا</button>}
      </div>
      {list.loading && !baselines.length ? <p className="data-state">در حال دریافت نسخه‌ها...</p>
        : list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p>
        : !baselines.length ? <p className="data-state">برای این پروژه هنوز خط مبنایی ثبت نشده است.{canManage ? ' بعد از نهایی شدن برنامه، «ثبت خط مبنا» را بزنید.' : ''}</p> : (
          <div className="table-scroll"><table className="users-table bl-table">
            <thead><tr><th>#</th><th>نام</th><th>نوع</th><th>ثبت</th><th>بازه‌ی پروژه</th><th>فعالیت</th><th>پیشرفت برنامه‌ای / واقعی</th><th>عملیات</th></tr></thead>
            <tbody>{baselines.map((baseline) => (
              <tr key={baseline.id}>
                <td>{Number(baseline.number).toLocaleString('fa-IR')}</td>
                <td><strong>{baseline.name}</strong>{baseline.note && <small className="bl-note" title={baseline.note}>{baseline.note}</small>}</td>
                <td>{kindOf(baseline.kind).label}</td>
                <td className="sch-date">{formatJalali(localDate(baseline.createdAtUtc))}{baseline.createdByUserId ? <small className="bl-note">{data.userName(baseline.createdByUserId)}</small> : null}</td>
                <td className="sch-date">{formatJalali(baseline.projectStart)} تا {formatJalali(baseline.projectFinish)}</td>
                <td>{Number(baseline.activityCount).toLocaleString('fa-IR')}</td>
                <td>{fmt(baseline.plannedProgress)}٪ / {fmt(baseline.actualProgress)}٪</td>
                <td><div className="row-actions">
                  <button type="button" title="مقایسه و جزئیات" aria-label="مقایسه و جزئیات" onClick={() => setDialog({ kind: 'detail', baseline })}><GitCompare size={15} /></button>
                  {canManage && <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(baseline)}><Trash2 size={15} /></button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      {dialog?.kind === 'create' && <CreateBaselineDialog project={project} data={data} onClose={() => setDialog(null)} onDone={(text) => { setDialog(null); say('success', text); list.reload() }} />}
      {dialog?.kind === 'detail' && <BaselineDetailDialog baseline={dialog.baseline} data={data} onClose={() => setDialog(null)} />}
    </>
  )
}
