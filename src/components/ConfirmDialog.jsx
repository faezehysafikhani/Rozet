import { useCallback, useEffect, useRef, useState } from 'react'
import './shared.css'

/**
 * A confirmation prompt, mostly for deletes. `onConfirm` may be async and return { ok: false, error }
 * (see toOutcome in features/project-management/pmErrors.js) or throw, to keep the dialog open and show
 * why; any other result closes it through `onCancel`.
 */
export function ConfirmDialog({ title, message, confirmLabel = 'تأیید', cancelLabel = 'انصراف', danger = false, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const confirmRef = useRef(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && !busy && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  async function confirm() {
    setBusy(true); setError('')
    try {
      const outcome = await onConfirm()
      if (outcome && outcome.ok === false) { setError(outcome.error || 'عملیات انجام نشد.'); setBusy(false); return }
    } catch (failure) {
      setError(failure?.message || 'عملیات انجام نشد.'); setBusy(false); return
    }
    setBusy(false)
    onCancel()
  }

  return (
    <div className="cf-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div className="cf-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-title" aria-describedby="cf-message" dir="rtl">
        <h3 id="cf-title">{title}</h3>
        <p id="cf-message">{message}</p>
        {error && <div className="cf-error" role="alert">{error}</div>}
        <div className="cf-actions">
          <button type="button" ref={confirmRef} className={`cf-confirm${danger ? ' cf-confirm--danger' : ''}`} onClick={confirm} disabled={busy}>{busy ? 'در حال انجام...' : confirmLabel}</button>
          <button type="button" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  )
}

/**
 * const { confirm, dialog } = useConfirm()
 * ... render {dialog} once, then:  confirm({ title, message, danger: true, run: () => api.delete(id) })
 * `run` is the action; it is only called after the user agrees, and a failed result keeps the dialog open.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const confirm = useCallback((options) => setRequest(options), [])
  const dialog = request
    ? <ConfirmDialog {...request} onConfirm={request.run} onCancel={() => setRequest(null)} />
    : null
  return { confirm, dialog }
}
