// Jalali (Persian) calendar helpers. The Core stores plain Gregorian dates ("2026-10-17"); the UI
// shows and edits them as Jalali. The conversion is the standard arithmetic algorithm (jalaali-js,
// Behrang Noruzi Niya, MIT), valid for Jalali years -61 to 3177.

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]

const div = (a, b) => Math.trunc(a / b)
const mod = (a, b) => a - Math.trunc(a / b) * b

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
export const JALALI_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

function jalCal(jy, withoutLeap) {
  const bl = BREAKS.length
  const gy = jy + 621
  let leapJ = -14
  let jp = BREAKS[0]
  let jump = 0
  if (jy < jp || jy >= BREAKS[bl - 1]) throw new RangeError(`Invalid Jalali year ${jy}`)

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i]
    jump = jm - jp
    if (jy < jm) break
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  let n = jy - jp
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (withoutLeap) return { gy, march }

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return d
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const gd = div(mod(i, 153), 5) + 1
  const gm = mod(div(i, 153), 12) + 1
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6)
  return { gy, gm, gd }
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy, true)
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1
}

function d2j(jdn) {
  const { gy } = d2g(jdn)
  let jy = gy - 621
  const r = jalCal(jy, false)
  const jdn1f = g2d(gy, 3, r.march)
  let k = jdn - jdn1f
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }
    k -= 186
  } else {
    jy -= 1
    k += 179
    if (r.leap === 1) k += 1
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }
}

export function isJalaliLeapYear(jy) {
  return jalCal(jy, false).leap === 0
}

/** Days in a Jalali month: 31 for the first six, 30 for the next five, 29 or 30 for Esfand. */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31
  if (jm <= 11) return 30
  return isJalaliLeapYear(jy) ? 30 : 29
}

const pad = (value, length = 2) => String(value).padStart(length, '0')

/** "2026-10-17" -> { jy: 1405, jm: 7, jd: 25 }; null for an empty or malformed value. */
export function isoToJalali(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (!match) return null
  const [, gy, gm, gd] = match.map(Number)
  return d2j(g2d(gy, gm, gd))
}

/** { jy, jm, jd } -> "2026-10-17"; null when the Jalali date does not exist. */
export function jalaliToIso(jy, jm, jd) {
  if (!jy || !jm || !jd || jm < 1 || jm > 12 || jd < 1 || jd > jalaliMonthLength(jy, jm)) return null
  const { gy, gm, gd } = d2g(j2d(jy, jm, jd))
  return `${pad(gy, 4)}-${pad(gm)}-${pad(gd)}`
}

/** Today's date as "yyyy-mm-dd" in the browser's local time zone (not UTC). */
export function todayIso() {
  const now = new Date()
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Weekday index of an ISO date with Saturday = 0 (the Persian week) ... Friday = 6. */
export function jalaliWeekdayIndex(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 1) % 7
}

/** "1405/07/25" in Persian digits, or "—" for an empty value. */
export function formatJalali(iso, { month = 'numeric' } = {}) {
  const parts = isoToJalali(iso)
  if (!parts) return '—'
  const fa = (value, length = 1) => Number(value).toLocaleString('fa-IR', { useGrouping: false, minimumIntegerDigits: length })
  return month === 'long'
    ? `${fa(parts.jd)} ${JALALI_MONTHS[parts.jm - 1]} ${fa(parts.jy)}`
    : `${fa(parts.jy)}/${fa(parts.jm, 2)}/${fa(parts.jd, 2)}`
}

/** Adds whole days to an ISO date. */
export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
