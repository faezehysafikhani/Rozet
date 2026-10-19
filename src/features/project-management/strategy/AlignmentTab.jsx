import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { unwrap } from '../../../services/api'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { ALIGNMENT_LEVELS, alignmentLevelOf, explainStrategyError, fmt } from './strategyModel'

/** همسوسازی با راهبرد: how much each project serves each leaf strategy (none / low / medium / high) and the score that comes out. */
export default function AlignmentTab({ project, data, perms, say, reloadKey, onSaved }) {
  const enabled = perms.viewAlignment && perms.viewStrategy
  const tree = useLoader(() => pmApi.strategy.tree(), `tree:${reloadKey}`, enabled, { explain: explainStrategyError })
  const score = useLoader(() => pmApi.alignment.scores({ projectIds: [project.id] }), `${project.id}:${reloadKey}`, enabled, { explain: explainStrategyError })
  const overviewIds = useMemo(() => data.projects.map((item) => item.id).slice(0, 200), [data.projects])
  const overview = useLoader(() => pmApi.alignment.scores({ projectIds: overviewIds }), `all:${overviewIds.join(',')}:${reloadKey}`, enabled && overviewIds.length > 0, { list: true, explain: explainStrategyError })
  const [levels, setLevels] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nodes = tree.value?.nodes || []
  const byId = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
  const leaves = useMemo(() => nodes.filter((node) => node.isLeaf), [nodes])
  const current = useMemo(() => {
    const entry = (Array.isArray(score.value) ? score.value : []).find((item) => item.projectId === project.id)
    return { percentage: entry?.percentage ?? 0, byStrategy: Object.fromEntries((entry?.levels || []).map((item) => [item.strategyId, alignmentLevelOf(item.level).value])) }
  }, [score.value, project.id])

  useEffect(() => { setLevels(current.byStrategy); setError('') }, [current])
  const changed = leaves.filter((leaf) => (levels[leaf.id] ?? 0) !== (current.byStrategy[leaf.id] ?? 0))
  const pathOf = (node) => { const parts = []; for (let n = node; n; n = byId[n.parentStrategyId]) parts.unshift(n.name); return parts.join(' › ') }

  // The score the draft levels would give, with the Core's rule: level 0..3 times weight over 3 times the weights.
  const preview = useMemo(() => {
    let sum = 0; let best = 0
    leaves.forEach((leaf) => { if (leaf.effectiveWeight > 0) { sum += (levels[leaf.id] ?? 0) * leaf.effectiveWeight; best += 3 * leaf.effectiveWeight } })
    return best > 0 ? (sum / best) * 100 : 0
  }, [leaves, levels])

  async function save() {
    setBusy(true); setError('')
    const result = await pmApi.alignment.saveLevels({ tenantId: data.tenantId, projectId: project.id, levels: changed.map((leaf) => ({ strategyId: leaf.id, level: levels[leaf.id] ?? 0 })) })
    setBusy(false)
    if (!result.isSuccess) { setError(explainStrategyError(result)); return }
    const after = unwrap(result)
    say('success', `همسوسازی ذخیره شد؛ امتیاز پروژه ${fmt(after?.percentage ?? preview, 1)}٪ است.`)
    score.reload(); overview.reload(); onSaved()
  }

  if (!perms.viewAlignment) return <p className="data-state">برای مشاهده‌ی همسوسازی به دسترسی «مشاهده ماتریس هم‌راستایی پروژه و راهبرد» نیاز دارید.</p>
  if (!perms.viewStrategy) return <p className="data-state">برای دیدن راهبردها به دسترسی «مشاهده درخت راهبرد» هم نیاز است.</p>
  const overviewRows = (overview.value || []).map((entry) => ({ ...entry, name: data.projects.find((item) => item.id === entry.projectId)?.name || '—' })).sort((a, b) => b.percentage - a.percentage)
  return (
    <>
      <div className="bl-bar"><p>سطح خدمت این پروژه به هر راهبرد بدون زیرراهبرد. امتیاز: سطح (۰ تا ۳) × وزن راهبرد، نسبت به بیشترین امتیاز ممکن؛ راهبردهای بدون وزن در امتیاز نمی‌آیند.</p></div>
      {tree.loading && !tree.value ? <p className="data-state">در حال دریافت راهبردها...</p>
        : tree.error ? <p className="data-state data-state--error">{tree.error}</p>
        : score.error ? <p className="data-state data-state--error">{score.error}</p>
        : !leaves.length ? <p className="data-state">هنوز راهبردی تعریف نشده است؛ ابتدا در زبانه‌ی «درخت راهبرد» راهبردها را بسازید.</p> : (
          <>
            <div className="bl-cards">
              <article><small>امتیاز همسوسازی {project.name}</small><strong>{fmt(changed.length ? preview : current.percentage, 1)}٪</strong><span>{changed.length ? `پیش‌نمایش تغییرات ذخیره‌نشده (ذخیره‌شده: ${fmt(current.percentage, 1)}٪)` : 'ذخیره‌شده در Core'}</span></article>
            </div>
            <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 640 }}>
              <thead><tr><th>راهبرد</th><th>وزن مؤثر</th><th>سطح همسوسازی</th></tr></thead>
              <tbody>{leaves.map((leaf) => (
                <tr key={leaf.id}>
                  <td><strong>{pathOf(leaf)}</strong>{leaf.effectiveWeight <= 0 && <em className="bl-tag" title="راهبرد بدون وزن در امتیاز حساب نمی‌شود">بدون وزن</em>}</td>
                  <td>{fmt(leaf.effectiveWeight, 2)}٪</td>
                  <td>
                    <select aria-label={`سطح ${leaf.name}`} className="str-level" value={levels[leaf.id] ?? 0} disabled={!perms.manageAlignment || busy} onChange={(e) => { setLevels((currentLevels) => ({ ...currentLevels, [leaf.id]: Number(e.target.value) })); setError('') }}>
                      {ALIGNMENT_LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
            {perms.manageAlignment
              ? <div className="str-save">{error && <span className="ue-error" role="alert">{error}</span>}<button type="button" className="bl-button sch-primary" onClick={save} disabled={!changed.length || busy}><Save size={16} />{busy ? 'در حال ذخیره...' : `ذخیره‌ی همسوسازی${changed.length ? ` (${changed.length.toLocaleString('fa-IR')} تغییر)` : ''}`}</button></div>
              : <p className="docs-hint">ثبت همسوسازی به دسترسی «ایجاد یا ویرایش هم‌راستایی پروژه و راهبرد» نیاز دارد.</p>}
          </>
        )}

      {overviewRows.length > 0 && (
        <>
          <h4 className="bl-subtitle">همسوسازی همه‌ی پروژه‌ها</h4>
          <div className="table-scroll"><table className="users-table bl-table" style={{ minWidth: 420 }}>
            <thead><tr><th>پروژه</th><th>امتیاز همسوسازی</th></tr></thead>
            <tbody>{overviewRows.map((entry) => (
              <tr key={entry.projectId} className={entry.projectId === project.id ? 'str-current' : ''}>
                <td><strong>{entry.name}</strong></td>
                <td><div className="prj-progress"><span><i className="actual" style={{ width: `${Math.min(100, entry.percentage)}%` }} /></span><small>{fmt(entry.percentage, 1)}٪</small></div></td>
              </tr>
            ))}</tbody>
          </table></div>
        </>
      )}
    </>
  )
}
