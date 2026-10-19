import { CalendarClock, CircleAlert } from 'lucide-react'
import { formatJalali } from '../../../utils/jalali'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { explainReportingError, financialProgress, fmt, healthOf, index2, money } from './performanceModel'

const Bar = ({ label, value, tone, note }) => (
  <div className="prf-bar">
    <div><span>{label}</span><strong>{value === null || value === undefined ? '—' : `${fmt(value)}٪`}</strong></div>
    <span className="prf-track"><i className={tone} style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} /></span>
    {note && <small>{note}</small>}
  </div>
)

const Signed = ({ value }) => (value === null || value === undefined ? '—'
  : <b className={`bl-var ${value < 0 ? 'late' : value > 0 ? 'early' : ''}`}><bdi dir="ltr">{value > 0 ? '+' : value < 0 ? '−' : ''}{money(Math.abs(value))}</bdi></b>)

function Figure({ label, hint, children }) {
  return <div className="prf-figure" title={hint}><small>{label}</small><strong>{children}</strong></div>
}

/** سلامت و عملکرد: the Core's earned-value figures for one project (schedule, cost, forecast, contracts) and its health. */
export default function PerformanceTab({ project, canView, reloadKey }) {
  const perf = useLoader(() => pmApi.reporting.projectPerformance(project.id), `${project.id}:${reloadKey}`, canView, { explain: explainReportingError })
  const p = perf.value

  if (!canView) return <p className="data-state">برای مشاهده‌ی شاخص‌های سلامت و عملکرد به دسترسی‌های «مشاهده‌ی گزارش‌ها» و «مشاهده‌ی همه‌ی گزارش‌ها» نیاز دارید.</p>
  if (perf.loading && !p) return <p className="data-state">در حال محاسبه‌ی شاخص‌ها...</p>
  if (perf.error) return <p className="data-state data-state--error">{perf.error} <button type="button" className="prj-clear" onClick={perf.reload}>تلاش دوباره</button></p>
  if (!p) return null

  const health = healthOf(p.health)
  const financial = financialProgress(p)
  const unknown = 'قابل محاسبه نیست (بودجه، پیشرفت یا هزینه‌ای ثبت نشده)'
  return (
    <>
      <div className="prf-head">
        <article className={`prf-health ${health.tone}`}>
          <small>سلامت پروژه</small>
          <strong>{health.label}</strong>
          <span>{health.hint}</span>
        </article>
        <article><small>شاخص عملکرد زمان‌بندی (SPI)</small><strong>{index2(p.spi)}</strong><span>پیشرفت واقعی ÷ برنامه‌ای؛ کمتر از ۱ یعنی عقب</span></article>
        <article><small>شاخص عملکرد هزینه (CPI)</small><strong>{index2(p.cpi)}</strong><span>ارزش کسب‌شده ÷ هزینه‌ی واقعی؛ کمتر از ۱ یعنی گران‌تر</span></article>
        <article>
          <small>پیش‌بینی پایان</small>
          <strong>{p.forecastEnd ? formatJalali(p.forecastEnd) : '—'}</strong>
          <span>{p.endDate ? `پایان برنامه: ${formatJalali(p.endDate)}` : 'تاریخ پایان ثبت نشده'}{p.forecastDelayDays ? ` · ${fmt(p.forecastDelayDays, 0)} روز تأخیر پیش‌بینی` : ''}</span>
        </article>
      </div>
      {p.isOverdue && <p className="prf-alert"><CalendarClock size={16} />موعد پایان پروژه گذشته و پیشرفت هنوز به ۱۰۰٪ نرسیده است.</p>}
      {!p.progressAvailable && <p className="prf-alert"><CircleAlert size={16} />پیشرفتی برای این پروژه در دسترس نیست؛ شاخص‌های وابسته به پیشرفت محاسبه نمی‌شوند.</p>}

      <h4 className="bl-subtitle">مقایسه‌ی پیشرفت</h4>
      <div className="prf-bars">
        <Bar label="پیشرفت برنامه‌ای (تا امروز)" value={p.plannedProgress} tone="planned" />
        <Bar label="پیشرفت فیزیکی (واقعی)" value={p.actualProgress} tone="actual" note={p.progressDate ? `آخرین گزارش: ${formatJalali(p.progressDate)}` : 'از برنامه‌ی زمان‌بندی'} />
        <Bar label="پیشرفت مالی (هزینه‌ی واقعی ÷ بودجه)" value={financial} tone="money" note={financial === null ? 'بودجه‌ی پروژه یا فاکتور تأییدشده‌ای ثبت نشده' : undefined} />
      </div>

      <h4 className="bl-subtitle">ارزش کسب‌شده</h4>
      <div className="prf-grid">
        <Figure label="بودجه‌ی پروژه (BAC)" hint="هزینه‌ی ثبت‌شده در پروژه">{money(p.budgetAtCompletion)}</Figure>
        <Figure label="ارزش برنامه‌ای (PV)" hint={p.plannedValue === null ? unknown : 'بودجه × پیشرفت برنامه‌ای'}>{money(p.plannedValue)}</Figure>
        <Figure label="ارزش کسب‌شده (EV)" hint={p.earnedValue === null ? unknown : 'بودجه × پیشرفت واقعی'}>{money(p.earnedValue)}</Figure>
        <Figure label="هزینه‌ی واقعی (AC)" hint="جمع فاکتورهای تأییدشده‌ی قراردادهای پروژه">{money(p.actualCost)}</Figure>
        <Figure label="انحراف زمانی (SV = EV − PV)"><Signed value={p.scheduleVariance} /></Figure>
        <Figure label="انحراف هزینه (CV = EV − AC)"><Signed value={p.costVariance} /></Figure>
        <Figure label="پیش‌بینی هزینه‌ی نهایی (EAC)" hint={p.estimateAtCompletion === null ? unknown : 'بودجه ÷ CPI'}>{money(p.estimateAtCompletion)}</Figure>
        <Figure label="هزینه‌ی باقی‌مانده (ETC)">{money(p.estimateToComplete)}</Figure>
        <Figure label="انحراف نهایی (VAC = BAC − EAC)"><Signed value={p.varianceAtCompletion} /></Figure>
      </div>
      <p className="docs-hint">بودجه به واحدی است که در پروژه ثبت شده و هزینه‌ی واقعی بر اساس ریال فاکتورهای قراردادهاست؛ اگر واحدها یکی نباشند شاخص‌های هزینه معنا ندارند. پیشرفت برنامه‌ای و واقعی از برنامه‌ی زمان‌بندی پروژه خوانده می‌شود.</p>

      <h4 className="bl-subtitle">قراردادها و تعهدات</h4>
      {p.contractsAvailable && p.contractedAmount !== null && p.contractedAmount !== undefined ? (
        <div className="prf-grid">
          <Figure label="مبلغ قراردادها (ریال)">{money(p.contractedAmount)}</Figure>
          <Figure label="فاکتور تأییدشده (ریال)">{money(p.invoicedAmount)}</Figure>
          <Figure label="پرداخت‌شده (ریال)">{money(p.paidAmount)}</Figure>
          <Figure label="سهم فاکتور از قراردادها">{p.contractedAmount > 0 ? `${fmt((p.invoicedAmount / p.contractedAmount) * 100)}٪` : '—'}</Figure>
        </div>
      ) : <p className="data-state">{p.contractsAvailable ? 'برای این پروژه قراردادی ثبت نشده است.' : 'ماژول قراردادها در این سامانه فعال نیست.'}</p>}
    </>
  )
}
