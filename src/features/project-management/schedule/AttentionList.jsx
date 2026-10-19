import { useMemo, useState } from 'react'
import { CircleAlert, Pencil } from 'lucide-react'
import { ATTENTION_KINDS } from './attention'

const TONE = { high: 'rejected', medium: 'review', info: 'todo' }

/** نیازمند توجه: what is late, stalled, unowned or unbalanced in the plan, with a shortcut to edit the activity. */
export default function AttentionList({ items, canEdit, onEdit }) {
  const [kind, setKind] = useState('')
  const [all, setAll] = useState(false)
  const counts = useMemo(() => Object.fromEntries(ATTENTION_KINDS.map((entry) => [entry.key, items.filter((item) => item.kind === entry.key).length])), [items])
  const shown = items.filter((item) => !kind || item.kind === kind)
  const visible = all ? shown : shown.slice(0, 5)
  const urgent = items.filter((item) => item.severity === 'high').length

  if (!items.length) return <p className="att-ok"><CircleAlert size={16} />هیچ موردی نیاز به توجه ندارد: موعد گذشته‌ای نیست، همه‌ی فعالیت‌های جاری مسئول دارند و وزن‌ها درست است.</p>
  return (
    <section className="att-panel" aria-label="موارد نیازمند توجه">
      <header>
        <strong><CircleAlert size={16} />نیازمند توجه ({items.length.toLocaleString('fa-IR')})</strong>
        {urgent > 0 && <span className="status-pill rejected">{urgent.toLocaleString('fa-IR')} مورد فوری</span>}
      </header>
      <div className="bl-chips">
        <button type="button" className={kind === '' ? 'active' : ''} onClick={() => setKind('')}>همه</button>
        {ATTENTION_KINDS.filter((entry) => counts[entry.key]).map((entry) => (
          <button type="button" key={entry.key} className={kind === entry.key ? 'active' : ''} onClick={() => setKind(kind === entry.key ? '' : entry.key)}>{entry.label} ({counts[entry.key].toLocaleString('fa-IR')})</button>
        ))}
      </div>
      <ul>
        {visible.map((item, index) => (
          <li key={`${item.kind}-${item.row?.id || 'project'}-${index}`}>
            <span className={`status-pill ${TONE[item.severity]}`}>{ATTENTION_KINDS.find((entry) => entry.key === item.kind)?.label}</span>
            <div><strong>{item.row ? <><span className="att-wbs">{item.row.wbs}</span> {item.row.name}</> : 'کل پروژه'}</strong><small>{item.text}</small></div>
            {canEdit && item.row && <button type="button" title="ویرایش فعالیت" aria-label="ویرایش فعالیت" onClick={() => onEdit(item.row)}><Pencil size={15} /></button>}
          </li>
        ))}
      </ul>
      {shown.length > 5 && <button type="button" className="prj-clear" onClick={() => setAll(!all)}>{all ? 'نمایش کمتر' : `نمایش همه (${shown.length.toLocaleString('fa-IR')})`}</button>}
    </section>
  )
}
