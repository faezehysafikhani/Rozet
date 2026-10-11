// Tiny in-browser stand-in for the SignalR server push.
// mockServer.js emits events here; the mock hubs (mockHub.js) register themselves and
// forward them to whatever the hooks subscribed with hub.on(...).

const hubs = new Map() // hubName -> { dispatch(eventName, payload) }

export function registerHub(name, hub) {
  hubs.set(name, hub)
}

export function emit(hubName, eventName, payload) {
  hubs.get(hubName)?.dispatch(eventName, payload)
}
