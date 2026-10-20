import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { unwrap } from '../../services/api'
import { chatHub } from '../../services/signalr'
import { chatCenterApi } from './chatApi'
import { explainChatError, normalizeMessage, threadKey } from './chatModel'

// Fallback cadence for what the hub cannot tell us (a conversation someone else just created
// is not joined yet, so its first messages arrive only through this refresh).
const REFRESH_MS = 15000

const listOf = (result) => (Array.isArray(unwrap(result, [])) ? unwrap(result, []) : [])

const countsOf = (result, idKey) => Object.fromEntries(
  listOf(result).filter((row) => row[idKey]).map((row) => [row[idKey], row.count || 0]),
)

const isGroupType = (type) => type === 'Group' || type === 1

/**
 * Personal and team chat on top of the Core's addressed endpoints, kept live by the chat hub.
 *
 * The hub delivers "MessageReceived" only to connections that joined `conversation:{id}` -
 * nothing is joined automatically - so every conversation of the caller is joined after the
 * connection is up and again after each reconnect (groups do not survive one).
 * Sending never waits for the echo: the message is appended from the API response and the
 * echo is de-duplicated by id. Edits and deletes have no hub event; they show on the next
 * reload of the thread.
 */
export function useChatCenter({ meId, enabled = true }) {
  const [contacts, setContacts] = useState([])
  const [teams, setTeams] = useState([])
  const [unread, setUnread] = useState({ direct: {}, team: {} })
  const [activity, setActivity] = useState({})
  const [active, setActive] = useState(null) // { kind: 'direct' | 'team', id }
  const [messages, setMessages] = useState([])
  const [connection, setConnection] = useState('disconnected')
  const [loadingLists, setLoadingLists] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [directoryError, setDirectoryError] = useState('')
  const [teamsError, setTeamsError] = useState('')

  const activeRef = useRef(null)
  const teamsRef = useRef([])
  const meRef = useRef(meId)
  const conversationOf = useRef(new Map()) // conversationId -> { kind, id }
  const typeOf = useRef(new Map()) // conversationId -> Core conversation type
  const joined = useRef(new Set())
  const connectionRef = useRef('disconnected')
  const edits = useRef(0) // bumped by local send/edit/delete so an older reload cannot overwrite them

  useEffect(() => { activeRef.current = active }, [active])
  useEffect(() => { teamsRef.current = teams }, [teams])
  useEffect(() => { meRef.current = meId }, [meId])

  const touch = useCallback((key, at = Date.now()) => {
    setActivity((current) => ({ ...current, [key]: Math.max(current[key] || 0, at) }))
  }, [])

  const bumpUnread = useCallback((kind, id, delta) => {
    setUnread((current) => ({
      ...current,
      [kind]: { ...current[kind], [id]: Math.max(0, (current[kind][id] || 0) + delta) },
    }))
  }, [])

  const clearUnread = useCallback((kind, id) => {
    setUnread((current) => (current[kind][id]
      ? { ...current, [kind]: { ...current[kind], [id]: 0 } }
      : current))
  }, [])

  // ---------- hub groups ----------
  const joinConversation = useCallback(async (conversationId) => {
    if (!conversationId || joined.current.has(conversationId)) return
    if (await chatHub.invoke('JoinConversation', conversationId)) joined.current.add(conversationId)
  }, [])

  const syncConversations = useCallback(async () => {
    const result = await chatCenterApi.conversations()
    if (!result.isSuccess) return
    for (const conversation of listOf(result)) {
      typeOf.current.set(conversation.id, conversation.type)
      await joinConversation(conversation.id)
    }
  }, [joinConversation])

  // A team's conversation id is only known from its messages; one message is enough.
  const learnTeamConversations = useCallback(async () => {
    await Promise.all(teamsRef.current.map(async (team) => {
      const result = await chatCenterApi.teamMessages(team.id, 1, 1)
      const first = listOf(result)[0]
      if (first?.conversationId) {
        conversationOf.current.set(first.conversationId, { kind: 'team', id: team.id })
        await joinConversation(first.conversationId)
      }
    }))
  }, [joinConversation])

  // ---------- lists ----------
  const loadCounts = useCallback(async () => {
    const [direct, team] = await Promise.all([chatCenterApi.directUnread(), chatCenterApi.teamUnread()])
    setUnread((current) => ({
      direct: direct.isSuccess ? countsOf(direct, 'senderUserId') : current.direct,
      team: team.isSuccess ? countsOf(team, 'teamId') : current.team,
    }))
  }, [])

  const loadLists = useCallback(async () => {
    const [directory, mine] = await Promise.all([chatCenterApi.directory(), chatCenterApi.myTeams()])
    if (directory.isSuccess) {
      setDirectoryError('')
      setContacts(listOf(directory).filter((contact) => contact.id !== meRef.current))
    } else {
      setDirectoryError(explainChatError(directory))
    }
    if (mine.isSuccess) {
      setTeamsError('')
      const list = listOf(mine).filter((team) => team.isActive !== false)
      teamsRef.current = list
      setTeams(list)
    } else {
      setTeamsError(explainChatError(mine))
    }
    await loadCounts()
    setLoadingLists(false)
  }, [loadCounts])

  // ---------- one thread ----------
  const fetchThread = useCallback(async (thread) => {
    const result = thread.kind === 'team'
      ? await chatCenterApi.teamMessages(thread.id)
      : await chatCenterApi.directMessages(thread.id)
    if (!result.isSuccess) return { error: explainChatError(result) }
    const list = listOf(result).map((raw) => normalizeMessage(raw, meRef.current))
    const conversationId = list[0]?.conversationId
    if (conversationId) {
      conversationOf.current.set(conversationId, thread)
      joinConversation(conversationId)
    }
    return { list }
  }, [joinConversation])

  const markRead = useCallback(async (thread) => {
    clearUnread(thread.kind, thread.id)
    if (thread.kind === 'team') await chatCenterApi.markTeamRead(thread.id)
    else await chatCenterApi.markDirectRead(thread.id)
  }, [clearUnread])

  const reloadActive = useCallback(async ({ silent = true } = {}) => {
    const thread = activeRef.current
    if (!thread) return
    if (!silent) setLoadingMessages(true)
    const stamp = edits.current
    const { list, error: failure } = await fetchThread(thread)
    const current = activeRef.current
    if (!current || current.kind !== thread.kind || current.id !== thread.id) return
    if (stamp !== edits.current) { if (!silent) setLoadingMessages(false); return }
    if (failure) { if (!silent) setError(failure) } else setMessages(list)
    if (!silent) setLoadingMessages(false)
  }, [fetchThread])

  const openThread = useCallback(async (kind, id) => {
    const thread = { kind, id }
    activeRef.current = thread
    setActive(thread)
    setMessages([])
    setError('')
    await reloadActive({ silent: false })
    if (activeRef.current?.id === id) {
      markRead(thread)
    }
  }, [markRead, reloadActive])

  const closeThread = useCallback(() => {
    activeRef.current = null
    setActive(null)
    setMessages([])
  }, [])

  const sendMessage = useCallback(async ({ text, file }) => {
    const thread = activeRef.current
    if (!thread || sending) return false
    setSending(true)
    setError('')
    const result = thread.kind === 'team'
      ? await chatCenterApi.sendTeam(thread.id, { text, file })
      : await chatCenterApi.sendDirect(thread.id, { text, file })
    setSending(false)
    if (!result.isSuccess) {
      setError(explainChatError(result))
      return false
    }
    edits.current += 1
    const message = normalizeMessage(unwrap(result, {}) || {}, meRef.current)
    if (message.id) {
      conversationOf.current.set(message.conversationId, thread)
      joinConversation(message.conversationId)
      touch(threadKey(thread.kind, thread.id))
      const current = activeRef.current
      if (current && current.kind === thread.kind && current.id === thread.id) {
        setMessages((list) => (list.some((m) => m.id === message.id) ? list : [...list, { ...message, isOwn: true }]))
      }
    }
    return true
  }, [joinConversation, sending, touch])

  const editMessage = useCallback(async (messageId, text) => {
    const result = await chatCenterApi.editMessage(messageId, text)
    if (!result.isSuccess) { setError(explainChatError(result)); return false }
    edits.current += 1
    setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, text, editedAt: new Date().toISOString() } : m)))
    return true
  }, [])

  const deleteMessage = useCallback(async (messageId) => {
    const result = await chatCenterApi.deleteMessage(messageId)
    if (!result.isSuccess) { setError(explainChatError(result)); return false }
    edits.current += 1
    setMessages((list) => list.filter((m) => m.id !== messageId))
    return true
  }, [])

  // ---------- live delivery ----------
  const handleIncoming = useCallback(async (event) => {
    if (!event?.id) return
    let thread = conversationOf.current.get(event.conversationId)

    if (!thread) {
      // A conversation we have not met yet: find out whose it is.
      await syncConversations()
      const type = typeOf.current.get(event.conversationId)
      if (isGroupType(type)) await learnTeamConversations()
      else if (event.senderUserId !== meRef.current) {
        thread = { kind: 'direct', id: event.senderUserId }
        conversationOf.current.set(event.conversationId, thread)
      }
      thread = conversationOf.current.get(event.conversationId)
      if (!thread) return
    }

    const own = event.senderUserId === meRef.current
    touch(threadKey(thread.kind, thread.id))
    const current = activeRef.current
    if (current && current.kind === thread.kind && current.id === thread.id) {
      setMessages((list) => (list.some((m) => m.id === event.id) ? list : [...list, normalizeMessage(event, meRef.current)]))
      if (!own) {
        // The event has no attachment or sender name: take the full message from the API.
        await reloadActive()
        markRead(thread)
      }
    } else if (!own) {
      bumpUnread(thread.kind, thread.id, 1)
    }
  }, [bumpUnread, learnTeamConversations, markRead, reloadActive, syncConversations, touch])

  // ---------- lifecycle ----------
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    ;(async () => {
      await loadLists()
      if (!alive) return
      await syncConversations()
      if (alive) learnTeamConversations()
    })()
    return () => { alive = false }
  }, [enabled, learnTeamConversations, loadLists, syncConversations])

  useEffect(() => {
    if (!enabled) return undefined
    chatHub.start()
    const offStatus = chatHub.onStatus((state) => {
      const was = connectionRef.current
      connectionRef.current = state
      setConnection(state)
      if (state === 'connected' && was !== 'connected') {
        // Groups die with the old connection: join again, then catch up on what was missed.
        joined.current.clear()
        for (const id of conversationOf.current.keys()) joinConversation(id)
        syncConversations().then(() => { loadCounts(); reloadActive() })
      }
    })
    const offMessage = chatHub.on('MessageReceived', handleIncoming)
    return () => { offStatus(); offMessage() }
  }, [enabled, handleIncoming, joinConversation, loadCounts, reloadActive, syncConversations])

  useEffect(() => {
    if (!enabled) return undefined
    const timer = setInterval(() => {
      loadCounts()
      syncConversations()
      const thread = activeRef.current
      const known = thread && [...conversationOf.current.values()].some((t) => t.kind === thread.kind && t.id === thread.id)
      // Live delivery covers a thread whose conversation is joined; anything else is polled.
      if (thread && (connectionRef.current !== 'connected' || !known)) reloadActive()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [enabled, loadCounts, reloadActive, syncConversations])

  const refresh = useCallback(async () => {
    setLoadingLists(true)
    await loadLists()
    await syncConversations()
    await reloadActive()
  }, [loadLists, reloadActive, syncConversations])

  const totalUnread = useMemo(
    () => Object.values(unread.direct).reduce((a, b) => a + b, 0) + Object.values(unread.team).reduce((a, b) => a + b, 0),
    [unread],
  )

  return {
    contacts, teams, unread, activity, totalUnread, active, messages, connection,
    loadingLists, loadingMessages, sending, error, setError, directoryError, teamsError,
    openThread, closeThread, sendMessage, editMessage, deleteMessage, refresh,
  }
}
