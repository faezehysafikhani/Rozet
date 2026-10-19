import { useState } from 'react'
import { Trash2, UserPlus } from 'lucide-react'
import { Shell } from '../project-management/DialogParts'
import { pmApi } from '../project-management/pmApi'
import { ROLES, explainRaciError } from './raciModel'

/** The roles of one item: a row per person with the four letters as toggles. Saving replaces the item's roles. */
export default function RaciDialog({ project, itemType, itemId, itemName, byUser, data, canEdit, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(Object.entries(byUser).map(([userId, set]) => [userId, [...set]])))
  const [pick, setPick] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const people = Object.keys(draft)
  const accountable = people.filter((userId) => draft[userId].includes(1))
  const teamIds = new Set((data.teamMembers || []).map((member) => member.userId))
  const free = data.users.filter((user) => !(user.id in draft))
  const label = (user) => user.displayName || user.email

  function toggle(userId, role) {
    setError('')
    setDraft((current) => {
      const has = current[userId].includes(role)
      // The "A" is one person: choosing it for someone takes it from whoever had it.
      const next = Object.fromEntries(Object.entries(current).map(([id, roles]) => [id, role === 1 && !has && id !== userId ? roles.filter((r) => r !== 1) : roles]))
      next[userId] = has ? current[userId].filter((r) => r !== role) : [...current[userId], role]
      return next
    })
  }

  async function save() {
    setBusy(true); setError('')
    const entries = people.flatMap((userId) => draft[userId].map((role) => ({ userId, role })))
    const result = await pmApi.raci.setItem({ projectId: project.id, itemType, itemId, entries })
    setBusy(false)
    if (!result.isSuccess) { setError(explainRaciError(result)); return }
    onSaved(result, entries.length ? 'نقش‌ها ذخیره شد.' : 'نقش‌های این مورد پاک شد.')
  }

  return (
    <Shell title={`نقش‌ها: ${itemName}`} subtitle={project.name} onClose={onClose} busy={busy} wide>
      <div className="ue-body">
        <div className="raci-legend">{ROLES.map((role) => <span key={role.key} title={role.hint}><i className={role.cls}>{role.letter}</i>{role.label}</span>)}</div>
        {canEdit && (
          <div className="mt-add rc-add">
            <select aria-label="افزودن فرد" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">افزودن فرد...</option>
              {free.some((user) => teamIds.has(user.id)) && <optgroup label="اعضای تیم پروژه">{free.filter((user) => teamIds.has(user.id)).map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</optgroup>}
              <optgroup label="سایر کاربران">{free.filter((user) => !teamIds.has(user.id)).map((user) => <option key={user.id} value={user.id}>{label(user)}</option>)}</optgroup>
            </select>
            <button type="button" className="bl-button" disabled={!pick} onClick={() => { setDraft({ ...draft, [pick]: [] }); setPick('') }}><UserPlus size={15} />افزودن</button>
          </div>
        )}
        {!people.length ? <p className="data-state">هنوز نقشی برای این مورد ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="users-table rc-people" style={{ minWidth: 480 }}>
            <thead><tr><th>فرد</th>{ROLES.map((role) => <th key={role.key} title={role.label}>{role.letter}</th>)}{canEdit && <th aria-label="حذف" />}</tr></thead>
            <tbody>{people.map((userId) => (
              <tr key={userId}>
                <td><strong>{data.userName(userId)}</strong></td>
                {ROLES.map((role) => (
                  <td key={role.key}><input type="checkbox" aria-label={`${role.label} - ${data.userName(userId)}`} checked={draft[userId].includes(role.value)} disabled={!canEdit} onChange={() => toggle(userId, role.value)} /></td>
                ))}
                {canEdit && <td><button type="button" className="mt-icon danger" aria-label={`حذف ${data.userName(userId)}`} onClick={() => setDraft(Object.fromEntries(Object.entries(draft).filter(([id]) => id !== userId)))}><Trash2 size={15} /></button></td>}
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {people.length > 0 && (accountable.length === 0 || !people.some((userId) => draft[userId].includes(0))) && (
          <p className="docs-hint rc-warn">{[!people.some((userId) => draft[userId].includes(0)) && 'هنوز «مسئول اجرا» (R) مشخص نیست.', accountable.length === 0 && 'هنوز «پاسخگو» (A) مشخص نیست.'].filter(Boolean).join(' ')}</p>
        )}
      </div>
      <footer className="ue-foot">
        {error && <span className="ue-error" role="alert">{error}</span>}
        <div className="ue-foot-actions">
          <button className="ue-cancel" type="button" onClick={onClose} disabled={busy}>{canEdit ? 'انصراف' : 'بستن'}</button>
          {canEdit && <button className="ue-save" type="button" onClick={save} disabled={busy}>{busy ? 'در حال ذخیره...' : 'ذخیره'}</button>}
        </div>
      </footer>
    </Shell>
  )
}
