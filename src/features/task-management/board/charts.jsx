const W = 760
const H = 280
const PAD = { top: 16, right: 16, bottom: 44, left: 44 }

const niceMax = (value) => {
  if (value <= 5) return 5
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / magnitude) * magnitude
}
const ticks = (max) => [0, 0.25, 0.5, 0.75, 1].map((share) => Math.round(max * share))
const fa = (value) => Number(value).toLocaleString('fa-IR', { maximumFractionDigits: 1 })

function Frame({ max, children, xLabels, label }) {
  const innerH = H - PAD.top - PAD.bottom
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="tk-chart">
      {ticks(max).map((value) => {
        const y = PAD.top + innerH - (value / max) * innerH
        return <g key={value}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="bl-grid" /><text x={PAD.left - 8} y={y + 4} textAnchor="end" className="bl-axis">{fa(value)}</text></g>
      })}
      {xLabels.map((item) => <text key={item.x} x={item.x} y={H - PAD.bottom + 18} textAnchor={item.anchor || 'middle'} className="bl-axis">{item.text}</text>)}
      {children}
    </svg>
  )
}

/** Lines over shared x positions. series: [{ name, color, dashed, values: [number|null] }]; labels: one text per x. */
export function LineChart({ labels, series, label }) {
  const count = Math.max(labels.length, 2)
  const all = series.flatMap((entry) => entry.values).filter((value) => value !== null && value !== undefined)
  const max = niceMax(Math.max(1, ...all))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const x = (index) => PAD.left + (index / (count - 1)) * innerW
  const y = (value) => PAD.top + innerH - (value / max) * innerH
  const step = Math.max(1, Math.ceil(labels.length / 7))
  const xLabels = labels.map((text, index) => ({ x: x(index), text, index })).filter((item) => item.index % step === 0 || item.index === labels.length - 1).map(({ x: px, text }) => ({ x: px, text }))
  const path = (values) => {
    let started = false
    return values.map((value, index) => {
      if (value === null || value === undefined) { started = false; return '' }
      const command = started ? 'L' : 'M'; started = true
      return `${command}${x(index).toFixed(1)},${y(value).toFixed(1)}`
    }).join(' ')
  }
  return (
    <figure className="tk-chart-box">
      <Frame max={max} xLabels={xLabels} label={label}>
        {series.map((entry) => <path key={entry.name} d={path(entry.values)} fill="none" stroke={entry.color} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={entry.dashed ? '6 5' : undefined} />)}
        {series.filter((entry) => !entry.dashed).map((entry) => entry.values.map((value, index) => (value === null || value === undefined || labels.length > 20 ? null : <circle key={`${entry.name}${index}`} cx={x(index)} cy={y(value)} r="3.5" fill="#fff" stroke={entry.color} strokeWidth="2"><title>{`${labels[index]} — ${entry.name}: ${fa(value)}`}</title></circle>)))}
      </Frame>
      <figcaption>{series.map((entry) => <span key={entry.name}><i style={{ background: entry.color, opacity: entry.dashed ? 0.55 : 1 }} />{entry.name}</span>)}</figcaption>
    </figure>
  )
}

/** Grouped bars. groups: [{ label, values: [number] }]; series: [{ name, color }]; average: optional horizontal line. */
export function BarChart({ groups, series, average, label }) {
  const max = niceMax(Math.max(1, average || 0, ...groups.flatMap((group) => group.values)))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / Math.max(groups.length, 1)
  const barW = Math.min(36, (slot - 12) / series.length)
  const y = (value) => PAD.top + innerH - (value / max) * innerH
  const xLabels = groups.map((group, index) => ({ x: PAD.left + slot * index + slot / 2, text: group.label }))
  return (
    <figure className="tk-chart-box">
      <Frame max={max} xLabels={xLabels} label={label}>
        {groups.map((group, gi) => group.values.map((value, si) => {
          const bx = PAD.left + slot * gi + slot / 2 - (series.length * barW) / 2 + si * barW
          return <rect key={`${gi}-${si}`} x={bx} y={y(value)} width={barW - 2} height={Math.max(0, PAD.top + innerH - y(value))} rx="3" fill={series[si].color}><title>{`${group.label} — ${series[si].name}: ${fa(value)}`}</title></rect>
        }))}
        {average ? <g><line x1={PAD.left} x2={W - PAD.right} y1={y(average)} y2={y(average)} stroke="#b8860b" strokeWidth="2" strokeDasharray="6 5" /><text x={W - PAD.right} y={y(average) - 6} textAnchor="end" className="bl-axis">{`میانگین ${fa(average)}`}</text></g> : null}
      </Frame>
      <figcaption>{series.map((entry) => <span key={entry.name}><i style={{ background: entry.color }} />{entry.name}</span>)}</figcaption>
    </figure>
  )
}
