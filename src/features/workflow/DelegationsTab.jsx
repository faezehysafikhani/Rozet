import { useState } from 'react'
import { Plus, Undo2 } from 'lucide-react'
import JalaliDateInput from '../../components/JalaliDateInput'
import { useAuth } from '../../services/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import { formatJalali, todayIso } from '../../utils/jalali'
import { Field, Footer, Shell } from '../project-management/DialogParts'
import { pmApi } from '../project-management/pmApi'
import { useLoader } from '../project-management/useLoader'
import { SUBJECT_TYPES, explainWorkflowError, subjectLabel, toWorkflowOutcome } from './workflowModel'

const orNull = (value) => (String(value ?? '').trim() === '' ? null : String(value).trim())

function stateOf(item, today) {
  if (item.isRevoked) return { label: 'لغو شد', tone: 'danger' }
  if (item.endDate < today) return { label: 'تمام شد', tone: 'muted' }
  if (item.startDate > today) return { label: 'در پیش', tone: 'pending' }
  return { label: 'فعال', tone: 'success' }
}

function DelegationDialog({ data, perms, me, onClose, onDone }) {
  const [form, setForm] = useState({ delegatorUserId: '', delegateUserId: '', startDate: todayIso(), endDate: '', subjectType: '', reason: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (!form.delegateUserId) { setError('جانشین را انتخاب کنید.'); return }
    if (!form.startDate || !form.endDate) { setError('تاریخ شروع و پایان را کامل وارد کنید.'); return }
    if (form.endDate < form.startDate) { setError('تاریخ پایان نباید قبل از تاریخ شروع باشد.'); return }
    setBusy(true)
    const result = await pmApi.workflow.delegations.create({
      delegateUserId: form.delegateUserId, startDate: form.startDate, endDate: form.endDate,
      subjectType: orNull(form.subjectType), reason: orNull(form.reason), delegatorUserId: orNull(form.delegatorUserId),
    })
    setBusy(false)
    if (!result.isSuccess) { setError(explainWorkflowError(result)); return }
    onDone('ارجاع ثبت شد. در این بازه جانشین، تأییدهای شما را در کارتابل خودش می‌بیند.')
  }

  const others = data.users.filter((user) => user.id !== (form.delegatorUserId || me))
  return (
    <Shell title="ارجاع تأییدها" subtitle="برای مدتی تأییدها را به جانشین بسپارید" onClose={onClose} busy={busy} wide>
      <form onSubmit={submit} noValidate>
        <div className="ue-body"><div className="ue-grid">
          {perms.configure && (
            <Field label="ارجاع‌دهنده" hint="به‌صورت پیش‌فرض خودتان؛ با دسترسی مدیریت گردش کار می‌توانید برای دیگری ثبت کنید.">
              <select value={form.delegatorUserId} onChange={(e) => set('delegatorUserId', e.target.value)}>
                <option value="">خودم</option>{data.users.filter((user) => user.id !== me).map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}
              </select>
            </Field>
          )}
          <Field label="جانشین *"><select value={form.delegateUserId} onChange={(e) => set('delegateUserId', e.target.value)}><option value="">انتخاب کنید...</option>{others.map((user) => <option key={user.id} value={user.id}>{user.displayName || user.email}</option>)}</select></Field>
          <Field label="از تاریخ *"><JalaliDateInput value={form.startDate} onChange={(value) => set('startDate', value)} yearsAhead={3} /></Field>
          <Field label="تا تاریخ *"><JalaliDateInput value={form.endDate} onChange={(value) => set('endDate', value)} yearsAhead={3} /></Field>
          <Field label="نوع تأیید" hint="خالی یعنی همه‌ی انواع تأیید.">
            <select value={form.subjectType} onChange={(e) => set('subjectType', e.target.value)}><option value="">همه‌ی انواع</option>{Object.entries(SUBJECT_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </Field>
          <Field label="دلیل" wide><input value={form.reason} maxLength={500} onChange={(e) => set('reason', e.target.value)} placeholder="مثلاً مأموریت یا مرخصی" /></Field>
        </div></div>
        <Footer error={error} busy={busy} onClose={onClose} submitLabel="ثبت ارجاع" busyLabel="در حال ثبت..." />
      </form>
    </Shell>
  )
}

/** ارجاع تأییدها: handing my approvals to a substitute for a period (Workflow delegations). */
export default function DelegationsTab({ data, perms, say }) {
  const { user } = useAuth()
  const list = useLoader(() => pmApi.workflow.delegations.list(), 'delegations', perms.view, { list: true, explain: explainWorkflowError })
  const { confirm, dialog } = useConfirm()
  const [creating, setCreating] = useState(false)
  const today = todayIso()
  const me = user?.id

  function askRevoke(item) {
    confirm({
      title: 'لغو ارجاع', message: `ارجاع تأییدهای ${data.userName(item.delegatorUserId)} به ${data.userName(item.delegateUserId)} لغو می‌شود. از این لحظه تأییدها دوباره فقط در کارتابل خود او می‌ماند.`, confirmLabel: 'لغو ارجاع', danger: true,
      run: async () => {
        const outcome = toWorkflowOutcome(await pmApi.workflow.delegations.revoke(item.id))
        if (outcome.ok) { say('success', 'ارجاع لغو شد.'); list.reload() }
        return outcome
      },
    })
  }

  return (
    <>
      <div className="tk-filters">
        <p className="docs-hint" style={{ margin: 0 }}>ارجاعِ تأیید با ارجاع وظیفه فرق دارد: اینجا جانشین برای مدتی به‌جای شما درخواست‌های تأیید را می‌بیند و تصمیم می‌گیرد.</p>
        {perms.approve && <button type="button" className="bl-button sch-primary" onClick={() => setCreating(true)}><Plus size={15} />ارجاع جدید</button>}
      </div>
      {list.error ? <p className="data-state data-state--error">{list.error} <button type="button" className="prj-clear" onClick={list.reload}>تلاش دوباره</button></p>
        : list.loading && !list.value.length ? <p className="data-state">در حال دریافت ارجاع‌ها...</p>
        : !list.value.length ? <p className="data-state">ارجاع تأییدی ثبت نشده است.</p> : (
          <div className="table-scroll"><table className="users-table wf-table" style={{ minWidth: 820 }}>
            <thead><tr><th>ارجاع‌دهنده</th><th>جانشین</th><th>بازه</th><th>نوع تأیید</th><th>دلیل</th><th>وضعیت</th><th>عملیات</th></tr></thead>
            <tbody>{list.value.map((item) => {
              const state = stateOf(item, today)
              const mayRevoke = perms.approve && !item.isRevoked && item.endDate >= today && (item.delegatorUserId === me || perms.configure)
              return (
                <tr key={item.id}>
                  <td>{data.userName(item.delegatorUserId)}{item.delegatorUserId === me && <small className="bl-note">شما</small>}</td>
                  <td>{data.userName(item.delegateUserId)}{item.delegateUserId === me && <small className="bl-note">شما</small>}</td>
                  <td className="sch-date">{formatJalali(item.startDate)} تا {formatJalali(item.endDate)}</td>
                  <td>{item.subjectType ? subjectLabel(item.subjectType) : 'همه‌ی انواع'}</td>
                  <td>{item.reason || '—'}</td>
                  <td><span className={`status-pill wf-${state.tone}`}>{state.label}</span></td>
                  <td>{mayRevoke ? <div className="row-actions"><button type="button" className="danger" aria-label="لغو ارجاع" title="لغو ارجاع" onClick={() => askRevoke(item)}><Undo2 size={15} /></button></div> : '—'}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      {creating && <DelegationDialog data={data} perms={perms} me={me} onClose={() => setCreating(false)} onDone={(text) => { setCreating(false); say('success', text); list.reload() }} />}
      {dialog}
    </>
  )
}
