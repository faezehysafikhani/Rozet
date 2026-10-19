import { useMemo, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import JalaliDateInput from '../../../components/JalaliDateInput'
import { formatJalali, todayIso } from '../../../utils/jalali'
import { Field, Footer, Shell } from '../DialogParts'
import { pmApi } from '../pmApi'
import { buildChart, explainBaselineError, fmt } from './baselineModel'
import { useLoader } from '../useLoader'

const STEPS = [
  { value: 1, label: 'روزانه' }, { value: 7, label: 'هفتگی' }, { value: 14, label: 'دو هفته' }, { value: 30, label: 'ماهانه' },
]

function SnapshotDialog({ project, data, existingDates, onClose, onDone }) {
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const replacing = existingDates.includes(date)

  async function submit(event) {
    event.preventDefault()
    if (!date) { setError('تاریخ را کامل وارد کنید.'); return }
    setBusy(true)
    const result = await pmApi.waterfall.progressSnapshots.create({ tenantId: data.tenantId, projectId: project.id, snapshotDate: date, note: note.trim() || null })
    setBusy(false)
    if (!result.isSuccess) { setError(explainBaselineError(result)); return }
    onDone(replacing ? 'نقطه‌ی این تاریخ با پیشرفت فعلی به‌روز شد.' : 'پیشرفت فعلی پروژه به‌عنوان یک نقطه‌ی منحنی ثبت شد.')
  }

  return (
    <Shell title="ثبت نقطه‌ی پیشرفت" subtitle={project.name} onClose={onClose} busy={busy}>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          <Field label="تاریخ نقطه" wide><JalaliDateInput value={date} onChange={(value) => { setDate(value); setError('') }} required /></Field>
          <Field label="یادداشت (اختیاری)" wide><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></Field>
          <p className="docs-hint" style={{ gridColumn: '1 / -1' }}>
            {replacing ? 'برای این تاریخ نقطه‌ای هست؛ ثبت دوباره آن را با پیشرفت فعلی جایگزین می‌کند. ' : ''}
            پیشرفت واقعی و برنامه‌ای همین حالا از برنامه‌ی پروژه خوانده و ذخیره می‌شود؛ تنها سابقه‌ی پیشرفت واقعی همین نقطه‌هاست.
          </p>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel={replacing ? 'به‌روزرسانی نقطه' : 'ثبت نقطه'} busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}

function Chart({ curve }) {
  const chart = useMemo(() => buildChart(curve), [curve])
  if (!chart) return null
  const { width, height, pad } = chart
  return (
    <figure className="bl-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="منحنی S: پیشرفت برنامه‌ای و واقعی در طول زمان" preserveAspectRatio="xMidYMid meet">
        {chart.yTicks.map((tick) => (
          <g key={tick.value}>
            <line x1={pad.left} x2={width - pad.right} y1={tick.y} y2={tick.y} className="bl-grid" />
            <text x={pad.left - 8} y={tick.y + 4} textAnchor="end" className="bl-axis">{tick.value.toLocaleString('fa-IR')}٪</text>
          </g>
        ))}
        {chart.xTicks.map((tick, index) => <text key={index} x={tick.x} y={height - pad.bottom + 20} textAnchor={tick.anchor} className="bl-axis">{tick.label}</text>)}
        {chart.todayX !== null && <g><line x1={chart.todayX} x2={chart.todayX} y1={pad.top} y2={height - pad.bottom} className="bl-today" /><text x={chart.todayX} y={pad.top + 10} textAnchor="middle" className="bl-axis bl-today-label">امروز</text></g>}
        <path d={chart.plannedPath} className="bl-planned" />
        {chart.actualPath && <path d={chart.actualPath} className="bl-actual" />}
        {chart.actualDots.map((dot) => <circle key={dot.date} cx={dot.x} cy={dot.y} r="4.5" className="bl-dot"><title>{`${formatJalali(dot.date)} — واقعی ${fmt(dot.value)}٪`}</title></circle>)}
      </svg>
      <figcaption>
        <span><i className="bl-key planned" />پیشرفت برنامه‌ای (محاسبه‌شده از زمان‌بندی)</span>
        <span><i className="bl-key actual" />پیشرفت واقعی (نقطه‌های ثبت‌شده)</span>
      </figcaption>
    </figure>
  )
}

export default function SCurveTab({ project, data, canView, canManage, confirm, say }) {
  const [step, setStep] = useState(7)
  const curve = useLoader(() => pmApi.waterfall.sCurve(project.id, step), `${project.id}:${step}`, canView, { explain: explainBaselineError })
  const snapshots = useLoader(() => pmApi.waterfall.progressSnapshots.list(project.id), project.id, canView, { list: true, explain: explainBaselineError })
  const [dialog, setDialog] = useState(false)
  const c = curve.value
  const reloadAll = () => { curve.reload(); snapshots.reload() }
  const hasPlan = Boolean(c && c.planned?.length > 1 && c.projectFinish > c.projectStart)
  const index = c?.schedulePerformanceIndex
  const rows = [...snapshots.value].sort((a, b) => String(b.snapshotDate).localeCompare(String(a.snapshotDate)))

  function askDelete(snapshot) {
    confirm({
      title: 'حذف نقطه‌ی پیشرفت',
      message: `نقطه‌ی ${formatJalali(snapshot.snapshotDate)} از منحنی پیشرفت واقعی حذف می‌شود.`,
      confirmLabel: 'حذف نقطه', danger: true,
      run: async () => {
        const result = await pmApi.waterfall.progressSnapshots.remove(snapshot.id)
        const outcome = { ok: result.isSuccess, error: result.isSuccess ? '' : explainBaselineError(result) }
        if (outcome.ok) { say('success', 'نقطه حذف شد.'); reloadAll() }
        return outcome
      },
    })
  }

  if (!canView) return <p className="data-state">برای مشاهده‌ی منحنی S به دسترسی «مشاهده‌ی فعالیت‌های آبشاری» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>پیشرفت برنامه‌ای را Core از زمان‌بندی حساب می‌کند؛ پیشرفت واقعی فقط نقطه‌هایی است که شما ثبت می‌کنید.</p>
        <div className="bl-bar-actions">
          <label className="bl-step">گام نمودار<select value={step} onChange={(e) => setStep(Number(e.target.value))}>{STEPS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          {canManage && <button type="button" className="sch-primary" onClick={() => setDialog(true)}><Camera size={16} />ثبت نقطه‌ی پیشرفت</button>}
        </div>
      </div>

      {curve.loading && !c ? <p className="data-state">در حال محاسبه‌ی منحنی...</p>
        : curve.error ? <p className="data-state data-state--error">{curve.error} <button type="button" className="prj-clear" onClick={reloadAll}>تلاش دوباره</button></p>
        : c && (
          <>
            <div className="bl-cards">
              <article><small>برنامه‌ای تا امروز</small><strong>{fmt(c.currentPlannedProgress)}٪</strong></article>
              <article><small>واقعی تا امروز</small><strong>{fmt(c.currentActualProgress)}٪</strong></article>
              <article><small>انحراف پیشرفت</small><strong className={`bl-var ${c.progressVariance < 0 ? 'late' : c.progressVariance > 0 ? 'early' : ''}`}>{c.progressVariance === 0 ? 'بدون انحراف' : `${fmt(Math.abs(c.progressVariance))} واحد درصد ${c.progressVariance < 0 ? 'عقب‌تر' : 'جلوتر'}`}</strong><span>واقعی منهای برنامه‌ای</span></article>
              <article><small>شاخص عملکرد زمان‌بندی (SPI)</small><strong className={`bl-var ${index !== null && index !== undefined ? (index < 1 ? 'late' : 'early') : ''}`}>{index === null || index === undefined ? '—' : index.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}</strong><span>{index === null || index === undefined ? 'هنوز قرار نیست کاری انجام شده باشد.' : index < 1 ? 'عقب از برنامه' : 'مطابق یا جلوتر از برنامه'}</span></article>
            </div>
            {hasPlan ? <Chart curve={c} /> : <p className="data-state">برای رسم منحنی، پروژه باید فعالیت‌هایی با بازه‌ی زمانی داشته باشد.</p>}
          </>
        )}

      <h4 className="bl-subtitle">نقطه‌های ثبت‌شده‌ی پیشرفت واقعی</h4>
      {snapshots.error ? <p className="data-state data-state--error">{snapshots.error}</p>
        : !rows.length ? <p className="data-state">{snapshots.loading ? 'در حال دریافت...' : `هنوز نقطه‌ای ثبت نشده است.${canManage ? ' هر چند وقت یک‌بار «ثبت نقطه‌ی پیشرفت» را بزنید تا منحنی واقعی ساخته شود.' : ''}`}</p> : (
          <div className="table-scroll"><table className="users-table bl-table">
            <thead><tr><th>تاریخ</th><th>برنامه‌ای</th><th>واقعی</th><th>انحراف</th><th>یادداشت</th>{canManage && <th>عملیات</th>}</tr></thead>
            <tbody>{rows.map((snapshot) => {
              const variance = Number(snapshot.actualProgress) - Number(snapshot.plannedProgress)
              return (
                <tr key={snapshot.id}>
                  <td className="sch-date">{formatJalali(snapshot.snapshotDate)}</td>
                  <td>{fmt(snapshot.plannedProgress)}٪</td><td>{fmt(snapshot.actualProgress)}٪</td>
                  <td><b className={`bl-var ${variance < 0 ? 'late' : variance > 0 ? 'early' : ''}`}><bdi dir="ltr">{variance > 0 ? '+' : variance < 0 ? '−' : ''}{fmt(Math.abs(variance))}</bdi></b></td>
                  <td>{snapshot.note || '—'}</td>
                  {canManage && <td><div className="row-actions"><button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => askDelete(snapshot)}><Trash2 size={15} /></button></div></td>}
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {dialog && <SnapshotDialog project={project} data={data} existingDates={snapshots.value.map((s) => s.snapshotDate)} onClose={() => setDialog(false)} onDone={(text) => { setDialog(false); say('success', text); reloadAll() }} />}
    </>
  )
}
