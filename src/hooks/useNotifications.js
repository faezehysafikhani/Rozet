import { useCallback, useEffect, useState } from 'react'
import { notificationsApi, unwrap } from '../services/api'
import { notificationHub } from '../services/signalr'

/**
 * Notification list + unread badge, kept live through the notifications hub.
 * Server event: "NotificationReceived" (SignalRNotificationPublisher -> group user_{userId}).
 */
export function useNotifications(enabled = true) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    const [listResult, countResult] = await Promise.all([
      notificationsApi.list(1, 20),
      notificationsApi.unreadCount(),
    ])
    setItems(unwrap(listResult, []) || [])
    setUnread(unwrap(countResult, 0) || 0)
    setLoading(false)
  }, [enabled])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined
    notificationHub.start()
    return notificationHub.on('NotificationReceived', (notification) => {
      if (!notification) return
      setItems((current) => (current.some((n) => n.id === notification.id) ? current : [notification, ...current]))
      setUnread((count) => count + 1)
    })
  }, [enabled])

  const markAsRead = useCallback(async (id) => {
    const result = await notificationsApi.markAsRead(id)
    if (!result.isSuccess) return false
    setItems((current) => current.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    setUnread((count) => Math.max(0, count - 1))
    return true
  }, [])

  const markAllAsRead = useCallback(async () => {
    const result = await notificationsApi.markAllAsRead()
    if (!result.isSuccess) return false
    setItems((current) => current.map((n) => ({ ...n, isRead: true })))
    setUnread(0)
    return true
  }, [])

  return { items, unread, loading, refresh, markAsRead, markAllAsRead }
}
