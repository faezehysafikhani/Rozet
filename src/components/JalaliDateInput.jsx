import { useEffect, useMemo, useState } from 'react'
import { JALALI_MONTHS, isoToJalali, jalaliMonthLength, jalaliToIso, todayIso } from '../utils/jalali'
import './shared.css'

const fa = (value) => Number(value).toLocaleString('fa-IR', { useGrouping: false })

/**
 * A Jalali date picker with the same contract as <input type="date">: `value` and `onChange` carry
 * an ISO "yyyy-mm-dd" string (what the Core stores), and '' while the date is empty or incomplete.
 *
 * `min` / `max` (ISO) only bound the year list; checking the date against them is the form's job,
 * the same as with a native date input.
 */
export default function JalaliDateInput({ id, value, onChange, min, max, required = false, disabled = false, invalid = false, yearsBack = 10, yearsAhead = 15, ...rest }) {
  const parsed = useMemo(() => isoToJalali(value), [value])
  // The parts chosen so far; they differ from `value` while the date is still incomplete.
  const [parts, setParts] = useState({ jy: parsed?.jy || '', jm: parsed?.jm || '', jd: parsed?.jd || '' })

  // Follow the outside value (a form reset, an edit screen loading a record).
  useEffect(() => {
    if (value) setParts({ jy: parsed?.jy || '', jm: parsed?.jm || '', jd: parsed?.jd || '' })
    else if (!value && parts.jy && parts.jm && parts.jd) setParts({ jy: '', jm: '', jd: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const years = useMemo(() => {
    const thisYear = isoToJalali(todayIso()).jy
    const from = Math.min(isoToJalali(min)?.jy ?? thisYear - yearsBack, parsed?.jy ?? Infinity)
    const to = Math.max(isoToJalali(max)?.jy ?? thisYear + yearsAhead, parsed?.jy ?? -Infinity)
    return Array.from({ length: to - from + 1 }, (_, index) => from + index)
  }, [min, max, parsed?.jy, yearsBack, yearsAhead])

  const daysInMonth = parts.jy && parts.jm ? jalaliMonthLength(Number(parts.jy), Number(parts.jm)) : 31

  function update(key, raw) {
    const next = { ...parts, [key]: raw === '' ? '' : Number(raw) }
    // Moving to a shorter month (or a non-leap Esfand) must not leave an impossible day behind.
    if (next.jy && next.jm && next.jd) next.jd = Math.min(next.jd, jalaliMonthLength(next.jy, next.jm))
    setParts(next)
    onChange(next.jy && next.jm && next.jd ? jalaliToIso(next.jy, next.jm, next.jd) || '' : '')
  }

  const label = (text) => rest['aria-label'] ? `${rest['aria-label']} — ${text}` : text

  return (
    <div className={`jdate${invalid ? ' jdate--invalid' : ''}`} id={id} role="group" aria-label={rest['aria-label']}>
      <select value={parts.jd} onChange={(event) => update('jd', event.target.value)} required={required} disabled={disabled} aria-label={label('روز')}>
        <option value="">روز</option>
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{fa(day)}</option>)}
      </select>
      <select value={parts.jm} onChange={(event) => update('jm', event.target.value)} required={required} disabled={disabled} aria-label={label('ماه')}>
        <option value="">ماه</option>
        {JALALI_MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
      </select>
      <select value={parts.jy} onChange={(event) => update('jy', event.target.value)} required={required} disabled={disabled} aria-label={label('سال')}>
        <option value="">سال</option>
        {years.map((year) => <option key={year} value={year}>{fa(year)}</option>)}
      </select>
    </div>
  )
}
