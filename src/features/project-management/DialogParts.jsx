import { X } from 'lucide-react'
import './dialogParts.css'

/** Pieces shared by the project-management dialogs: field label, modal shell and the error/cancel/save footer. */
export const Field = ({ label, children, wide, hint }) => <label className="ue-field" style={wide ? { gridColumn: '1 / -1' } : undefined}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>

export function Shell({ title, subtitle, onClose, busy, children, wide }) {
  return (
    <div className="ue-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <div className={`ue-modal ${wide === 'xl' ? 'sch-modal sch-modal-xl' : wide ? 'sch-modal' : 'sch-modal-sm'}`} role="dialog" aria-modal="true" aria-label={title} dir="rtl">
        <header className="ue-head">
          <div className="ue-head-title"><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
          <button className="ue-close" type="button" onClick={onClose} disabled={busy} aria-label="بستن"><X size={17} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

export const Footer = ({ error, busy, onClose, submitLabel, busyLabel }) => (
  <footer className="ue-foot">
    {error && <span className="ue-error" role="alert">{error}</span>}
    <div className="ue-foot-actions">
      <button className="ue-cancel" type="button" onClick={onClose} disabled={busy}>انصراف</button>
      <button className="ue-save" type="submit" disabled={busy}>{busy ? busyLabel : submitLabel}</button>
    </div>
  </footer>
)
