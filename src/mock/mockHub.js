import { AuthTokenStore } from '../services/authStore'
import { registerHub } from './bus'

/**
 * Drop-in replacement for createHub() in services/signalr.js.
 * Same public surface (on / onStatus / state / start / invoke / stop) but no network:
 * "connecting" is instant and server pushes arrive through mock/bus.js.
 */
export function createMockHub(name) {
  const handlers = new Map() // eventName -> Set<fn>
  const statusHandlers = new Set()
  let status = 'disconnected'

  const notifyStatus = (next) => {
    status = next
    statusHandlers.forEach((fn) => { try { fn(next) } catch (e) { console.error(e) } })
  }

  const hub = {
    dispatch(eventName, payload) {
      if (status !== 'connected') return
      handlers.get(eventName)?.forEach((fn) => {
        try { fn(payload) } catch (e) { console.error('Mock hub handler error', e) }
      })
    },

    on(eventName, handler) {
      if (!handlers.has(eventName)) handlers.set(eventName, new Set())
      handlers.get(eventName).add(handler)
      return () => handlers.get(eventName)?.delete(handler)
    },

    onStatus(handler) {
      statusHandlers.add(handler)
      try { handler(status) } catch (e) { console.error(e) }
      return () => statusHandlers.delete(handler)
    },

    get state() {
      return status === 'connected' ? 'Connected' : 'Disconnected'
    },

    async start() {
      if (!AuthTokenStore.getAccessToken()) return null
      if (status !== 'connected') {
        notifyStatus('connecting')
        notifyStatus('connected')
      }
      return hub
    },

    async invoke() {
      return status === 'connected'
    },

    async stop() {
      notifyStatus('disconnected')
    },
  }

  registerHub(name, hub)
  return hub
}
