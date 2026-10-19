import { useState } from 'react'
import { Check, CircleX } from 'lucide-react'
import { formatJalali } from '../../utils/jalali'
import { Field, Shell } from '../project-management/DialogParts'
import { pmApi } from '../project-management/pmApi'
import { explainWorkflowError, instanceStatusOf, subjectLabel } from './workflowModel'

const dayOf = (value) => (value ? formatJalali(String(value).slice(0, 10)) : '')

/** The approval chain of one request: who each step waits for, what was decided so far, and (for a pending step) approve / reject. */
export default function InstanceDialog({ instance, name, projectName, data, perms, canDecide, readOnlyNote, onClose, onDone }) {
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const status = instanceStatusOf(instance.status)
  const pending = status.key === 'InProgress'
  const person = (id) => (id ? data.userName(id) : null)
  const steps = instance.steps?.length ? instance.steps : Array.from({ length: instance.totalSteps }, (_, index) => ({ order: index + 1, name: `مرحله ${(index + 1).toLocaleString('fa-IR')}`, approverUserId: null }))
  const decisionOf = (order) => instance.decisions?.find((item) => item.stepOrder === order)

  async function decide(approve) {
    if (!approve && !comment.trim()) { setError('دلیل رد را بنویسید تا ثبت‌کننده بداند چه چیزی باید اصلاح شود.'); return }
    setBusy(approve ? 'approve' : 'reject'); setError('')
    const result = await (approve ? pmApi.workflow.approve : pmApi.workflow.reject)(instance.id, comment.trim() || null)
    setBusy('')
    if (!result.isSuccess) { setError(explainWorkflowError(result)); return }
    onDone(approve ? `«${name || subjectLabel(instance.subjectType)}» تأیید شد.` : `«${name || subjectLabel(instance.subjectType)}» رد شد.`)
  }

  return (
    <Shell title={name || subjectLabel(instance.subjectType)} subtitle={[subjectLabel(instance.subjectType), projectName].filter(Boolean).join(' · ')} onClose={onClose} busy={Boolean(busy)} wide>
      <div className="ue-body">
        <p className="wf-state"><span className={`status-pill wf-${status.tone}`}>{status.label}</span>
          {pending && <span>مرحله‌ی {instance.currentStepOrder.toLocaleString('fa-IR')} از {instance.totalSteps.toLocaleString('fa-IR')}</span>}
          {instance.delegatedFromUserId && <span className="wf-via">به‌جای {person(instance.delegatedFromUserId)} (ارجاع)</span>}</p>
        <ol className="wf-steps" aria-label="مراحل تأیید">
          {steps.map((step) => {
            const decision = decisionOf(step.order)
            const current = pending && step.order === instance.currentStepOrder
            const state = decision ? (decision.approved ? 'done' : 'rejected') : current ? 'current' : 'todo'
            return (
              <li key={step.order} className={`wf-step wf-step-${state}`}>
                <strong>{step.name}</strong>
                <small>{step.approverUserId ? `تأییدکننده: ${person(step.approverUserId)}` : 'تأییدکننده‌ی مشخصی تعیین نشده است'}</small>
                {decision && (
                  <p>{decision.approved ? 'تأیید' : 'رد'} توسط {person(decision.decidedByUserId)}{decision.onBehalfOfUserId ? ` (به‌جای ${person(decision.onBehalfOfUserId)})` : ''} · {dayOf(decision.decidedAtUtc)}
                    {decision.comment && <em>«{decision.comment}»</em>}</p>
                )}
                {!decision && current && <p>منتظر تصمیم</p>}
              </li>
            )
          })}
        </ol>
        {pending && canDecide && (
          <Field label="توضیح" wide hint="برای رد کردن، نوشتن دلیل لازم است.">
            <textarea rows={3} maxLength={2000} value={comment} onChange={(e) => { setComment(e.target.value); setError('') }} />
          </Field>
        )}
        {pending && !canDecide && <p className="docs-hint">{readOnlyNote || 'برای تأیید یا رد، دسترسی «تأیید» یا «رد» گردش کار لازم است.'}</p>}
      </div>
      <footer className="ue-foot">
        {error && <span className="ue-error" role="alert">{error}</span>}
        <div className="ue-foot-actions">
          <button className="ue-cancel" type="button" onClick={onClose} disabled={Boolean(busy)}>بستن</button>
          {pending && canDecide && perms.reject && <button type="button" className="wf-reject" onClick={() => decide(false)} disabled={Boolean(busy)}><CircleX size={15} />{busy === 'reject' ? 'در حال ثبت...' : 'رد'}</button>}
          {pending && canDecide && perms.approve && <button type="button" className="ue-save" onClick={() => decide(true)} disabled={Boolean(busy)}><Check size={15} />{busy === 'approve' ? 'در حال ثبت...' : 'تأیید'}</button>}
        </div>
      </footer>
    </Shell>
  )
}
