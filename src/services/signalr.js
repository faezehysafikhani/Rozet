import * as signalR from '@microsoft/signalr'
import { API_BASE_URL } from './config'
import { AuthTokenStore } from './authStore'

/**
 * One connection per hub, shared across the app.
 * The Core reads the JWT from the `access_token` query string for any path under /hubs
 * (see JwtBearerEvents.OnMessageReceived in NexusCore.Api/Program.cs).
 */
function createHub(path) {
  let connection = null
  const handlers = new Map() // eventName -> Set<fn>
  const statusHandlers = new Set()
  let starting = null
  let currentStatus = 'disconnected'

  const notifyStatus = (state) => {
    currentStatus = state
    statusHandlers.forEach((fn) => { try { fn(state) } catch (e) { console.error(e) } })
  }

  function dispatch(eventName, payload) {
    const set = handlers.get(eventName)
    if (!set) return
    set.forEach((fn) => { try { fn(payload) } catch (e) { console.error('SignalR handler error', e) } })
  }

  function build() {
    const conn = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}${path}`, {
        accessTokenFactory: () => AuthTokenStore.getAccessToken() || '',
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build()

    // Re-bind every already-subscribed event onto the new connection object.
    handlers.forEach((_set, eventName) => conn.on(eventName, (payload) => dispatch(eventName, payload)))

    conn.onreconnecting(() => notifyStatus('reconnecting'))
    conn.onreconnected(() => notifyStatus('connected'))
    conn.onclose(() => notifyStatus('disconnected'))
    return conn
  }

  return {
    /** Subscribe before or after start; binding survives reconnects. */
    on(eventName, handler) {
      if (!handlers.has(eventName)) {
        handlers.set(eventName, new Set())
        if (connection) connection.on(eventName, (payload) => dispatch(eventName, payload))
      }
      handlers.get(eventName).add(handler)
      return () => handlers.get(eventName)?.delete(handler)
    },

    onStatus(handler) {
      statusHandlers.add(handler)
      // Emit the current state immediately: a subscriber that mounts after the connection
      // was already established would otherwise sit on a stale 'disconnected'.
      try { handler(currentStatus) } catch (e) { console.error(e) }
      return () => statusHandlers.delete(handler)
    },

    get state() {
      return connection?.state ?? signalR.HubConnectionState.Disconnected
    },

    async start() {
      if (!AuthTokenStore.getAccessToken()) return null
      if (connection && connection.state === signalR.HubConnectionState.Connected) {
        notifyStatus('connected')
        return connection
      }
      if (starting) return starting

      if (!connection || connection.state === signalR.HubConnectionState.Disconnected) {
        connection = connection || build()
      }

      starting = (async () => {
        try {
          notifyStatus('connecting')
          await connection.start()
          notifyStatus('connected')
          return connection
        } catch (err) {
          console.warn(`اتصال SignalR به ${path} برقرار نشد:`, err?.message || err)
          notifyStatus('disconnected')
          return null
        } finally {
          starting = null
        }
      })()

      return starting
    },

    async invoke(method, ...args) {
      if (!connection || connection.state !== signalR.HubConnectionState.Connected) return false
      try {
        await connection.invoke(method, ...args)
        return true
      } catch (err) {
        console.warn(`فراخوانی ${method} روی هاب ناموفق بود:`, err?.message || err)
        return false
      }
    },

    async stop() {
      const conn = connection
      connection = null
      if (conn) {
        try { await conn.stop() } catch { /* ignore */ }
      }
      notifyStatus('disconnected')
    },
  }
}

// Hub routes come from app.MapHub<T>(...) in NexusCore.Api/Program.cs.
export const chatHub = createHub('/hubs/chat')
export const notificationHub = createHub('/hubs/notifications')

export async function startRealtime() {
  await Promise.all([chatHub.start(), notificationHub.start()])
}

export async function stopRealtime() {
  await Promise.all([chatHub.stop(), notificationHub.stop()])
}
