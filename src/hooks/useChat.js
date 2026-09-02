import { useCallback, useEffect, useRef, useState } from 'react'
import { chatApi, usersApi, unwrap, PersianMessages } from '../services/api'
import { chatHub } from '../services/signalr'
import { AuthTokenStore } from '../services/authStore'

/**
 * Direct-conversation chat: conversation list, message history and live delivery.
 *
 * Server event: "MessageReceived" -> group conversation:{id} (Chat.Api/Endpoints/MessageEndpoints).
 * ChatHub.OnConnectedAsync auto-joins every conversation the caller participates in;
 * JoinConversation is invoked explicitly for conversations created after connect.
 *
 * Sending never depends on the realtime echo: the message is appended locally from the id
 * the API returns, and the echo is de-duplicated by that same id.
 */
export function useChat(enabled = true) {
  const [conversations, setConversations] = useState([])
  const [directory, setDirectory] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [connection, setConnection] = useState('disconnected')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [directoryError, setDirectoryError] = useState('')
  const activeIdRef = useRef(null)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const loadConversations = useCallback(async () => {
    if (!enabled) return []
    const result = await chatApi.conversations()
    if (!result.isSuccess) {
      setError(PersianMessages.error(result.error))
      setLoadingConversations(false)
      return []
    }
    setError('')
    // Direct-only view: the Core may also return Group conversations.
    const list = (unwrap(result, []) || []).filter((c) => c.type !== 'Group' && c.type !== 1)
    setConversations(list)
    setLoadingConversations(false)
    return list
  }, [enabled])

  // Chat stores participants as bare ids; display names live in the identity module.
  const loadDirectory = useCallback(async () => {
    if (!enabled) return
    const result = await usersApi.list({ pageSize: 100 })
    if (!result.isSuccess) {
      setDirectoryError('برای شروع گفت‌وگوی جدید به دسترسی «مشاهده فهرست کاربران» نیاز دارید.')
      return
    }
    setDirectoryError('')
    setDirectory(unwrap(result)?.items || [])
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    ;(async () => {
      const list = await loadConversations()
      await loadDirectory()
      if (list.length && !activeIdRef.current) setActiveId(list[0].id)
    })()
  }, [enabled, loadConversations, loadDirectory])

  useEffect(() => {
    if (!enabled) return undefined
    chatHub.start()
    const offStatus = chatHub.onStatus(setConnection)
    const offMessage = chatHub.on('MessageReceived', (message) => {
      if (!message) return
      const currentUserId = AuthTokenStore.getUserId()
      if (message.conversationId === activeIdRef.current) {
        setMessages((current) => {
          if (current.some((m) => m.id === message.id)) return current
          return [...current, {
            id: message.id,
            senderUserId: message.senderUserId,
            text: message.text,
            sentAt: message.sentAt,
            isOwnMessage: message.senderUserId === currentUserId,
            isRead: false,
          }]
        })
      }
      setConversations((current) => {
        const known = current.some((c) => c.id === message.conversationId)
        // A message for an unknown conversation means someone started one with us.
        if (!known) {
          loadConversations()
          return current
        }
        return current.map((c) => c.id === message.conversationId
          ? { ...c, lastMessage: message.text, lastMessageAt: message.sentAt }
          : c)
      })
    })
    return () => { offStatus(); offMessage() }
  }, [enabled, loadConversations])

  useEffect(() => {
    if (!enabled || !activeId) { setMessages([]); return undefined }
    let cancelled = false
    setLoadingMessages(true)
    ;(async () => {
      const result = await chatApi.messages(activeId, 1, 100)
      if (cancelled) return
      if (!result.isSuccess) {
        setError(PersianMessages.error(result.error))
        setMessages([])
      } else {
        setError('')
        setMessages(unwrap(result, []) || [])
      }
      setLoadingMessages(false)
      chatHub.invoke('JoinConversation', activeId)
    })()
    return () => { cancelled = true }
  }, [enabled, activeId])

  const sendMessage = useCallback(async (text) => {
    const conversationId = activeIdRef.current
    const body = (text || '').trim()
    if (!conversationId) { setError('ابتدا یک گفت‌وگو را انتخاب کنید.'); return false }
    if (!body) return false

    setSending(true)
    setError('')
    const result = await chatApi.send(conversationId, body)
    setSending(false)

    if (!result.isSuccess) {
      setError(PersianMessages.error(result.error))
      return false
    }

    const messageId = unwrap(result)
    const sentAt = new Date().toISOString()
    setMessages((current) => {
      if (messageId && current.some((m) => m.id === messageId)) return current
      return [...current, {
        id: messageId || `local-${Date.now()}`,
        senderUserId: AuthTokenStore.getUserId(),
        text: body,
        sentAt,
        isOwnMessage: true,
        isRead: false,
      }]
    })
    setConversations((current) => current.map((c) =>
      c.id === conversationId ? { ...c, lastMessage: body, lastMessageAt: sentAt } : c))
    return true
  }, [])

  const startDirect = useCallback(async (otherUserId) => {
    setError('')
    // Reuse an existing direct conversation with this person instead of creating a duplicate.
    const existing = conversations.find((c) => (c.participantIds || []).includes(otherUserId))
    if (existing) { setActiveId(existing.id); return existing.id }

    const result = await chatApi.createDirect(otherUserId)
    if (!result.isSuccess) {
      setError(PersianMessages.error(result.error))
      return null
    }
    const conversationId = unwrap(result)
    if (!conversationId) return null
    await loadConversations()
    await chatHub.invoke('JoinConversation', conversationId)
    setActiveId(conversationId)
    return conversationId
  }, [conversations, loadConversations])

  return {
    conversations, directory, directoryError,
    activeId, setActiveId, messages,
    connection, loadingConversations, loadingMessages, sending,
    error, setError, sendMessage, startDirect,
    refresh: loadConversations,
  }
}
