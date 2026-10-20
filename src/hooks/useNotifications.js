import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationsApi, unwrap } from '../services/api'
import { notificationHub } from '../services/signalr'

const PAGE_SIZE = 20

const asList = (result) => (Array.isArray(unwrap(result, [])) ? unwrap(result, []) : [])

/**
 * Notification list + unread badge, kept live through the notifications hub.
 * Server event: "NotificationReceived" (SignalRNotificationPublisher -> group user_{userId},
 * which the hub joins on connect). Events missed while the connection was down are caught up
 * by a reload on every reconnect. `onReceive` is called with each notification that arrives live.
 */
export function useNotifications(enabled = true, { onReceive } = {}) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [live, setLive] = useState('disconnected')
  const page = useRef(1)
  const itemsRef = useRef([])
  const onReceiveRef = useRef(onReceive)
  const connectedBefore = useRef(false)

  useEffect(() => { onReceiveRef.current = onReceive }, [onReceive])
  useEffect(() => { itemsRef.current = items }, [items])

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const [listResult, countResult] = await Promise.all([
      notificationsApi.list(1, PAGE_SIZE),
      notificationsApi.unreadCount(),
    ])
    const list = asList(listResult)
    page.current = 1
    setItems(list)
    setHasMore(list.length >= PAGE_SIZE)
    setUnread(unwrap(countResult, 0) || 0)
    setLoading(false)
  }, [enabled])

  const loadMore = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const result = await notificationsApi.list(page.current + 1, PAGE_SIZE)
    if (result.isSuccess) {
      const more = asList(result)
      page.current += 1
      setItems((current) => [...current, ...more.filter((n) => !current.some((c) => c.id === n.id))])
      setHasMore(more.length >= PAGE_SIZE)
    }
    setLoading(false)
  }, [enabled])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined
    notificationHub.start()
    const offStatus = notificationHub.onStatus((state) => {
      setLive(state)
      if (state === 'connected') {
        // Not the first connection: something may have been published meanwhile.
        if (connectedBefore.current) refresh()
        connectedBefore.current = true
      }
    })
    const offEvent = notificationHub.on('NotificationReceived', (notification) => {
      if (!notification?.id) return
      if (itemsRef.current.some((n) => n.id === notification.id)) return
      setItems((current) => (current.some((n) => n.id === notification.id) ? current : [notification, ...current]))
      if (!notification.isRead) setUnread((count) => count + 1)
      onReceiveRef.current?.(notification)
    })
    return () => { offStatus(); offEvent() }
  }, [enabled, refresh])

  const markAsRead = useCallback(async (id) => {
    const wasUnread = itemsRef.current.some((n) => n.id === id && !n.isRead)
    const result = await notificationsApi.markAsRead(id)
    if (!result.isSuccess) return false
    setItems((current) => current.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    if (wasUnread) setUnread((count) => Math.max(0, count - 1))
    return true
  }, [])

  const markAllAsRead = useCallback(async () => {
    const result = await notificationsApi.markAllAsRead()
    if (!result.isSuccess) return false
    setItems((current) => current.map((n) => ({ ...n, isRead: true })))
    setUnread(0)
    return true
  }, [])

  return { items, unread, loading, hasMore, live, refresh, loadMore, markAsRead, markAllAsRead }
}
