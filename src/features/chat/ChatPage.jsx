import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, Check, CheckCheck, Download, FileText, MessageCircle, Paperclip, Pencil, Plus, RefreshCw,
  Search, Send, Trash2, TriangleAlert, Users, X,
} from 'lucide-react'
import { useAuth } from '../../services/AuthContext'
import { chatCenterApi } from './chatApi'
import { useChatCenter } from './useChatCenter'
import {
  MAX_ATTACHMENT_BYTES, MAX_TEXT_LENGTH, dayLabel, explainChatError, formatClock, formatSize, initialsOf, threadKey,
} from './chatModel'
import './chat.css'

const TONES = 5

const toneOf = (key) => {
  let sum = 0
  for (const char of String(key)) sum += char.charCodeAt(0)
  return sum % TONES
}

async function saveAttachment(message, onError) {
  const result = await chatCenterApi.attachment(message.id)
  if (!result.isSuccess) { onError(explainChatError(result)); return }
  const url = URL.createObjectURL(result.value)
  const link = document.createElement('a')
  link.href = url
  link.download = message.attachment?.fileName || 'attachment'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ChatPage() {
  const { user } = useAuth()
  const chat = useChatCenter({ meId: user?.id, enabled: true })
  const {
    contacts, teams, unread, activity, active, messages, connection,
    loadingLists, loadingMessages, sending, error, setError, directoryError, teamsError,
    openThread, closeThread, sendMessage, editMessage, deleteMessage, refresh,
  } = chat

  const [tab, setTab] = useState('direct')
  const [listSearch, setListSearch] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [file, setFile] = useState(null)
  const [editing, setEditing] = useState(null) // { id, text }
  const [confirmingId, setConfirmingId] = useState('')
  const [mobilePane, setMobilePane] = useState('list')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  const nameOf = useMemo(() => {
    const map = new Map(contacts.map((contact) => [contact.id, contact.displayName]))
    if (user?.id) map.set(user.id, user.displayName || 'شما')
    return (id) => map.get(id) || 'همکار'
  }, [contacts, user])

  const sortRows = (rows, kind, labelOf) => rows
    .map((row) => ({
      ...row,
      key: threadKey(kind, row.id),
      label: labelOf(row),
      unreadCount: unread[kind]?.[row.id] || 0,
    }))
    .filter((row) => !listSearch.trim() || row.label.includes(listSearch.trim()))
    .sort((a, b) => ((activity[b.key] || 0) - (activity[a.key] || 0))
      || (b.unreadCount - a.unreadCount)
      || a.label.localeCompare(b.label, 'fa'))

  const directRows = useMemo(
    () => sortRows(contacts, 'direct', (c) => c.displayName || ''),
    [contacts, unread, activity, listSearch],
  )
  const teamRows = useMemo(
    () => sortRows(teams, 'team', (t) => t.name || ''),
    [teams, unread, activity, listSearch],
  )
  const rows = tab === 'team' ? teamRows : directRows
  const directUnread = Object.values(unread.direct).reduce((a, b) => a + b, 0)
  const teamUnread = Object.values(unread.team).reduce((a, b) => a + b, 0)

  const selected = useMemo(() => {
    if (!active) return null
    if (active.kind === 'team') {
      const team = teams.find((t) => t.id === active.id)
      return team ? { kind: 'team', id: team.id, label: team.name, sub: `چت گروهی تیم · ${(team.members || []).length.toLocaleString('fa-IR')} عضو` } : null
    }
    const contact = contacts.find((c) => c.id === active.id)
    return contact ? { kind: 'direct', id: contact.id, label: contact.displayName, sub: 'پیام شخصی' } : null
  }, [active, contacts, teams])

  const shown = useMemo(
    () => (messageSearch.trim() ? messages.filter((m) => m.text.includes(messageSearch.trim())) : messages),
    [messages, messageSearch],
  )

  const timeline = useMemo(() => {
    const out = []
    let lastDay = null
    for (const message of shown) {
      const day = dayLabel(message.sentAt)
      if (day && day !== lastDay) {
        out.push({ kind: 'day', id: `day-${day}-${message.id}`, label: day })
        lastDay = day
      }
      out.push({ kind: 'message', id: message.id, message })
    }
    return out
  }, [shown])

  const status = connection === 'connected'
    ? { label: 'برخط', tone: 'online' }
    : connection === 'reconnecting' || connection === 'connecting'
      ? { label: 'در حال اتصال', tone: 'pending' }
      : { label: 'اتصال بی‌درنگ برقرار نیست', tone: 'offline' }

  useEffect(() => {
    if (messageSearch) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [timeline.length, active, messageSearch])

  function open(kind, id) {
    setMessageSearch('')
    setSearchOpen(false)
    setDraft('')
    setFile(null)
    setEditing(null)
    setConfirmingId('')
    setMobilePane('conversation')
    openThread(kind, id)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function pickFile(event) {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    if (picked.size > MAX_ATTACHMENT_BYTES) {
      setError(`حجم پیوست بیش از ${formatSize(MAX_ATTACHMENT_BYTES)} است.`)
      return
    }
    setError('')
    setFile(picked)
  }

  async function handleSend(event) {
    event?.preventDefault()
    const text = draft.trim()
    if ((!text && !file) || sending) return
    if (text.length > MAX_TEXT_LENGTH) {
      setError(`پیام می‌تواند حداکثر ${MAX_TEXT_LENGTH.toLocaleString('fa-IR')} نویسه باشد.`)
      return
    }
    const ok = await sendMessage({ text, file })
    if (ok) { setDraft(''); setFile(null) }
    inputRef.current?.focus()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  async function saveEdit() {
    const text = editing?.text.trim()
    if (!text) return
    if (await editMessage(editing.id, text)) setEditing(null)
  }

  async function confirmDelete(id) {
    await deleteMessage(id)
    setConfirmingId('')
  }

  return (
    <div className="rz-chat">
      <header className="rz-chat__heading">
        <div>
          <span>ارتباطات سازمانی</span>
          <h1>چت و گفت‌وگوی آنلاین</h1>
          <p>پیام شخصی به همکاران و چت گروهی تیم‌های کاری</p>
        </div>
        <div className="rz-chat__heading-actions">
          <span className={`rz-chat__status rz-chat__status--${status.tone}`}><i />{status.label}</span>
          <button type="button" onClick={refresh} title="به‌روزرسانی"><RefreshCw size={16} />به‌روزرسانی</button>
        </div>
      </header>

      <div className={`rz-chat__shell rz-chat__shell--${mobilePane}`}>
        <aside className="rz-chat__sidebar">
          <div className="ct-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'direct'} className={tab === 'direct' ? 'is-active' : ''} onClick={() => setTab('direct')}>
              <MessageCircle size={15} />همکاران{directUnread > 0 && <b>{directUnread.toLocaleString('fa-IR')}</b>}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'is-active' : ''} onClick={() => setTab('team')}>
              <Users size={15} />تیم‌ها{teamUnread > 0 && <b>{teamUnread.toLocaleString('fa-IR')}</b>}
            </button>
          </div>

          <label className="rz-chat__search">
            <Search size={16} />
            <input value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder={tab === 'team' ? 'جست‌وجوی تیم...' : 'جست‌وجوی همکار...'} />
            {listSearch && <button type="button" onClick={() => setListSearch('')}><X size={14} /></button>}
          </label>

          <div className="rz-chat__scroll">
            {loadingLists && <p className="rz-chat__empty">در حال بارگذاری...</p>}
            {!loadingLists && rows.map((row) => (
              <button
                type="button"
                key={row.key}
                className={`rz-chat__row ${active && threadKey(active.kind, active.id) === row.key ? 'is-active' : ''}`}
                onClick={() => open(tab, row.id)}
              >
                <span className={`rz-chat__avatar tone-${toneOf(row.id)}`}>
                  {tab === 'team' ? <Users size={18} /> : initialsOf(row.label)}
                </span>
                <span className="rz-chat__row-body">
                  <strong>{row.label}</strong>
                  <small>{tab === 'team' ? `${(row.members || []).length.toLocaleString('fa-IR')} عضو` : 'پیام شخصی'}</small>
                </span>
                {row.unreadCount > 0 && <b className="ct-badge">{row.unreadCount.toLocaleString('fa-IR')}</b>}
              </button>
            ))}
            {!loadingLists && !rows.length && (
              <div className="rz-chat__empty rz-chat__empty--cta">
                <MessageCircle size={30} />
                <p>
                  {listSearch
                    ? 'موردی با این نام پیدا نشد.'
                    : tab === 'team'
                      ? (teamsError || 'هنوز عضو هیچ تیمی نیستید. تیم‌ها را در «تنظیمات › تیم کاری من» می‌سازید.')
                      : (directoryError || 'همکاری برای گفت‌وگو پیدا نشد.')}
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="rz-chat__main">
          {selected ? (
            <>
              <header className="rz-chat__main-head">
                <button type="button" className="rz-chat__back" onClick={() => { setMobilePane('list'); closeThread() }} title="بازگشت"><ChevronLeft size={20} /></button>
                <span className={`rz-chat__avatar tone-${toneOf(selected.id)}`}>
                  {selected.kind === 'team' ? <Users size={18} /> : initialsOf(selected.label)}
                </span>
                <div className="rz-chat__main-title">
                  <strong>{selected.label}</strong>
                  <small>{selected.sub}</small>
                </div>
                <button
                  type="button"
                  className={`rz-chat__icon ${searchOpen ? 'is-active' : ''}`}
                  onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setMessageSearch('') }}
                  title="جست‌وجو در پیام‌ها"
                >
                  <Search size={18} />
                </button>
              </header>

              {searchOpen && (
                <div className="rz-chat__msg-search">
                  <Search size={16} />
                  <input autoFocus value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} placeholder="جست‌وجو در این گفت‌وگو..." />
                  <small>{messageSearch ? `${shown.length.toLocaleString('fa-IR')} نتیجه` : `${messages.length.toLocaleString('fa-IR')} پیام`}</small>
                  <button type="button" onClick={() => { setMessageSearch(''); setSearchOpen(false) }}><X size={16} /></button>
                </div>
              )}

              <div className="rz-chat__messages" ref={scrollRef}>
                {loadingMessages && <p className="rz-chat__empty">در حال بارگذاری پیام‌ها...</p>}

                {!loadingMessages && timeline.map((row) => row.kind === 'day' ? (
                  <span className="rz-chat__day" key={row.id}>{row.label}</span>
                ) : (
                  <article className={`rz-chat__bubble ${row.message.isOwn ? 'is-mine' : ''}`} key={row.id} data-message-id={row.message.id}>
                    {!row.message.isOwn && (
                      <span className="rz-chat__bubble-avatar">{initialsOf(row.message.senderName || nameOf(row.message.senderUserId)).slice(0, 1)}</span>
                    )}
                    <div className="rz-chat__bubble-body">
                      {!row.message.isOwn && selected.kind === 'team' && <strong>{row.message.senderName || nameOf(row.message.senderUserId)}</strong>}
                      {editing?.id === row.message.id ? (
                        <div className="ct-edit">
                          <textarea
                            autoFocus
                            value={editing.text}
                            onChange={(e) => setEditing({ id: editing.id, text: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null) }}
                            maxLength={MAX_TEXT_LENGTH}
                          />
                          <span>
                            <button type="button" onClick={saveEdit} disabled={!editing.text.trim()}><Check size={14} />ذخیره</button>
                            <button type="button" className="is-ghost" onClick={() => setEditing(null)}>انصراف</button>
                          </span>
                        </div>
                      ) : (
                        <>
                          {row.message.text && <p>{row.message.text}</p>}
                          {row.message.attachment && (
                            <button type="button" className="ct-attachment" onClick={() => saveAttachment(row.message, setError)} title="دریافت پیوست">
                              <FileText size={18} />
                              <span>
                                <strong>{row.message.attachment.fileName}</strong>
                                <small>{formatSize(row.message.attachment.sizeBytes)}</small>
                              </span>
                              <Download size={16} />
                            </button>
                          )}
                        </>
                      )}
                      <time>
                        {formatClock(row.message.sentAt)}
                        {row.message.editedAt && <em>ویرایش‌شده</em>}
                        {row.message.isOwn && selected.kind === 'direct' && (
                          <CheckCheck size={13} className={row.message.isRead ? 'ct-read' : ''} aria-label={row.message.isRead ? 'خوانده شد' : 'ارسال شد'} />
                        )}
                        {row.message.isOwn && editing?.id !== row.message.id && (
                          confirmingId === row.message.id ? (
                            <span className="ct-confirm">
                              حذف شود؟
                              <button type="button" onClick={() => confirmDelete(row.message.id)}>بله</button>
                              <button type="button" onClick={() => setConfirmingId('')}>خیر</button>
                            </span>
                          ) : (
                            <span className="ct-actions">
                              {row.message.text && !row.message.attachment && (
                                <button type="button" title="ویرایش" onClick={() => setEditing({ id: row.message.id, text: row.message.text })}><Pencil size={13} /></button>
                              )}
                              <button type="button" title="حذف" onClick={() => setConfirmingId(row.message.id)}><Trash2 size={13} /></button>
                            </span>
                          )
                        )}
                      </time>
                    </div>
                  </article>
                ))}

                {!loadingMessages && !messages.length && (
                  <div className="rz-chat__empty rz-chat__empty--cta">
                    <MessageCircle size={30} />
                    <p>{selected.kind === 'team' ? 'هنوز پیامی در این تیم نیست؛ اولین پیام را بفرستید.' : 'اولین پیام را بفرستید.'}</p>
                  </div>
                )}
                {!loadingMessages && messages.length > 0 && messageSearch && !shown.length && (
                  <p className="rz-chat__empty">پیامی با این عبارت یافت نشد.</p>
                )}
              </div>

              {error && (
                <p className="rz-chat__error" role="alert">
                  <TriangleAlert size={15} />{error}
                  <button type="button" onClick={() => setError('')}><X size={14} /></button>
                </p>
              )}

              {file && (
                <div className="ct-pending-file">
                  <FileText size={16} />
                  <span>{file.name}</span>
                  <small>{formatSize(file.size)}</small>
                  <button type="button" onClick={() => setFile(null)} title="حذف پیوست"><X size={14} /></button>
                </div>
              )}

              <form className="rz-chat__composer" onSubmit={handleSend}>
                <input ref={fileRef} type="file" hidden onChange={pickFile} data-testid="chat-file" />
                <button type="button" className="rz-chat__icon" title={`پیوست (حداکثر ${formatSize(MAX_ATTACHMENT_BYTES)})`} onClick={() => fileRef.current?.click()}>
                  <Paperclip size={18} />
                </button>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`پیام به ${selected.label}...`}
                  aria-label="متن پیام"
                />
                <button type="submit" className="rz-chat__send" disabled={(!draft.trim() && !file) || sending}>
                  <Send size={17} /><span>{sending ? 'در حال ارسال' : 'ارسال'}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="rz-chat__placeholder">
              <MessageCircle size={44} />
              <h3>گفت‌وگویی انتخاب نشده است</h3>
              <p>از فهرست کنار، یکی از همکاران را برای پیام شخصی یا یکی از تیم‌ها را برای چت گروهی باز کنید.</p>
              {error && <p className="rz-chat__error" role="alert"><TriangleAlert size={15} />{error}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
