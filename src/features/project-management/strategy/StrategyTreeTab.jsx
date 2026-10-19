import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CornerDownLeft, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { pmApi } from '../pmApi'
import { useLoader } from '../useLoader'
import { childrenOf, descendantKeys, draftFromTree, explainStrategyError, flatten, fmt, itemsToSave, moveItem, newKey, sameDraft, totalWeight, weightOf } from './strategyModel'

/**
 * درخت راهبرد: the strategies of the whole organization as one tree, edited as a draft and saved in a single call
 * (PUT /api/strategy/tree: creates, updates and deletes together). A strategy with sub-strategies weighs what they add up to;
 * the weights of the top-level ones must add up to 100.
 */
export default function StrategyTreeTab({ data, perms, confirm, say, onSaved }) {
  const tree = useLoader(() => pmApi.strategy.tree(), 'tree', perms.viewStrategy, { explain: explainStrategyError })
  const saved = useMemo(() => draftFromTree(tree.value), [tree.value])
  const [draft, setDraft] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const editable = perms.editStrategy

  useEffect(() => { setDraft(saved); setError('') }, [saved])

  const rows = useMemo(() => flatten(draft), [draft])
  const total = totalWeight(draft)
  const dirty = !sameDraft(draft, saved)
  const roundedTotal = Math.round(total)
  const set = (key, patch) => { setDraft((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item))); setError('') }
  const add = (parentKey) => { setDraft((current) => [...current, { key: newKey(), name: '', description: '', weight: 0, parentKey }]); setError('') }

  function remove(item) {
    const doomed = descendantKeys(draft, item.key)
    const drop = () => { setDraft((current) => current.filter((entry) => entry.key !== item.key && !doomed.has(entry.key))); setError('') }
    if (!doomed.size) { drop(); return }
    confirm({
      title: 'حذف راهبرد',
      message: `«${item.name || 'راهبرد بدون نام'}» و ${doomed.size.toLocaleString('fa-IR')} زیرراهبردش از پیش‌نویس حذف می‌شوند. تا «ذخیره‌ی درخت» را نزده‌اید چیزی در Core تغییر نمی‌کند.`,
      confirmLabel: 'حذف از پیش‌نویس', danger: true,
      run: async () => { drop(); return { ok: true } },
    })
  }

  async function save() {
    if (rows.some(({ item }) => !item.name.trim())) { setError('هر راهبرد باید نام داشته باشد.'); return }
    if (draft.some((item) => Number(item.weight) < 0 || Number(item.weight) > 100 || Number.isNaN(Number(item.weight)))) { setError('وزن هر راهبرد باید بین ۰ و ۱۰۰ باشد.'); return }
    if (draft.length && roundedTotal !== 100) { setError(`مجموع وزن راهبردهای سطح اول ${fmt(total, 2)} است؛ باید ۱۰۰ باشد.`); return }
    setSaving(true); setError('')
    const result = await pmApi.strategy.saveTree({ tenantId: data.tenantId, items: itemsToSave(draft) })
    setSaving(false)
    if (!result.isSuccess) { setError(explainStrategyError(result)); return }
    say('success', 'درخت راهبرد ذخیره شد.')
    tree.reload()
    onSaved()
  }

  if (!perms.viewStrategy) return <p className="data-state">برای مشاهده‌ی درخت راهبرد به دسترسی «مشاهده درخت راهبرد» نیاز دارید.</p>
  return (
    <>
      <div className="bl-bar">
        <p>راهبردهای سازمان به‌صورت درخت. وزن فقط برای راهبرد بدون زیرراهبرد وارد می‌شود؛ وزن بقیه از جمع زیرراهبردهایشان به دست می‌آید و جمع وزن سطح اول باید ۱۰۰ باشد.</p>
        {editable && <div className="bl-bar-actions">
          <button type="button" className="bl-button" onClick={() => add(null)}><Plus size={16} />راهبرد سطح اول</button>
        </div>}
      </div>
      {tree.loading && !tree.value ? <p className="data-state">در حال دریافت درخت راهبرد...</p>
        : tree.error ? <p className="data-state data-state--error">{tree.error} <button type="button" className="prj-clear" onClick={tree.reload}>تلاش دوباره</button></p>
        : (
          <>
            <div className={`str-total ${draft.length && roundedTotal !== 100 ? 'bad' : ''}`}>
              <span>مجموع وزن سطح اول:</span><strong>{fmt(total, 2)}٪</strong>
              {draft.length > 0 && (roundedTotal === 100 ? <em>درست است</em> : <em>باید ۱۰۰ شود</em>)}
              {dirty && <b className="str-dirty">تغییرات ذخیره‌نشده</b>}
            </div>
            {!rows.length ? <p className="data-state">هنوز راهبردی تعریف نشده است.{editable ? ' با «راهبرد سطح اول» شروع کنید.' : ''}</p> : (
              <div className="table-scroll"><table className="users-table bl-table str-tree" style={{ minWidth: 820 }}>
                <thead><tr><th>راهبرد</th><th>وزن (٪)</th><th>وزن مؤثر</th>{editable && <th>عملیات</th>}</tr></thead>
                <tbody>{rows.map(({ item, level }) => {
                  const leaf = !childrenOf(draft, item.key).length
                  const siblings = childrenOf(draft, item.parentKey)
                  const position = siblings.findIndex((entry) => entry.key === item.key)
                  return (
                    <tr key={item.key} className={leaf ? '' : 'sch-summary-row'}>
                      <td>
                        <div className="str-name" style={{ paddingInlineStart: `${level * 22}px` }}>
                          {editable ? <input aria-label="نام راهبرد" value={item.name} maxLength={200} placeholder="نام راهبرد" onChange={(e) => set(item.key, { name: e.target.value })} />
                            : <strong>{item.name}</strong>}
                        </div>
                        {editable ? <input className="str-desc" aria-label="توضیح راهبرد" value={item.description} placeholder="توضیح (اختیاری)" style={{ marginInlineStart: `${level * 22}px`, width: `calc(100% - ${level * 22 + 4}px)` }} onChange={(e) => set(item.key, { description: e.target.value })} />
                          : item.description && <small className="bl-note" style={{ marginInlineStart: `${level * 22}px` }} title={item.description}>{item.description}</small>}
                      </td>
                      <td>{leaf
                        ? (editable ? <input className="str-weight" type="number" min="0" max="100" step="any" aria-label="وزن" value={item.weight} onChange={(e) => set(item.key, { weight: e.target.value })} /> : fmt(item.weight, 2))
                        : <span className="str-muted" title="وزن از جمع زیرراهبردها به دست می‌آید">—</span>}</td>
                      <td>{fmt(weightOf(draft, item), 2)}</td>
                      {editable && <td><div className="row-actions">
                        <button type="button" title="افزودن زیرراهبرد" aria-label="افزودن زیرراهبرد" onClick={() => add(item.key)}><CornerDownLeft size={15} /></button>
                        <button type="button" title="بالا" aria-label="بالا" disabled={position <= 0} onClick={() => setDraft((current) => moveItem(current, item.key, -1))}><ArrowUp size={15} /></button>
                        <button type="button" title="پایین" aria-label="پایین" disabled={position === siblings.length - 1} onClick={() => setDraft((current) => moveItem(current, item.key, 1))}><ArrowDown size={15} /></button>
                        <button type="button" className="danger" title="حذف" aria-label="حذف" onClick={() => remove(item)}><Trash2 size={15} /></button>
                      </div></td>}
                    </tr>
                  )
                })}</tbody>
              </table></div>
            )}
            {editable && (
              <div className="str-save">
                {error && <span className="ue-error" role="alert">{error}</span>}
                <button type="button" className="bl-button" onClick={() => { setDraft(saved); setError('') }} disabled={!dirty || saving}><RotateCcw size={16} />برگرداندن تغییرات</button>
                <button type="button" className="bl-button sch-primary" onClick={save} disabled={!dirty || saving}><Save size={16} />{saving ? 'در حال ذخیره...' : 'ذخیره‌ی درخت'}</button>
              </div>
            )}
            {!editable && <p className="docs-hint">ویرایش درخت به دسترسی «ویرایش راهبردها» نیاز دارد.</p>}
          </>
        )}
    </>
  )
}
