import fp from 'fastify-plugin'

// ─── Realtime: suscripciones por dispositivo + broadcast ────────────────────
//
// Mantiene el estado de conexiones WebSocket de la app:
//   - devicesToSockets: Map<deviceId, Set<socket>>   → para enviar datos
//   - socketsToDevices: Map<socket,   Set<deviceId>> → para limpiar al cerrar
//
// Expone:
//   app.realtime.subscribe(deviceId, socket)
//   app.realtime.unsubscribe(deviceId, socket)
//   app.realtime.unsubscribeAll(socket)      // al cerrar la conexión
//   app.realtime.broadcast(deviceId, variable, value, time)
async function realtimePlugin(app) {
  const devicesToSockets = new Map()
  const socketsToDevices = new Map()

  function subscribe(deviceId, socket) {
    if (!deviceId || !socket) return

    // deviceId → sockets
    if (!devicesToSockets.has(deviceId)) devicesToSockets.set(deviceId, new Set())
    devicesToSockets.get(deviceId).add(socket)

    // socket → deviceIds
    if (!socketsToDevices.has(socket)) socketsToDevices.set(socket, new Set())
    socketsToDevices.get(socket).add(deviceId)
  }

  function unsubscribe(deviceId, socket) {
    const sockets = devicesToSockets.get(deviceId)
    if (sockets) {
      sockets.delete(socket)
      if (sockets.size === 0) devicesToSockets.delete(deviceId)
    }

    const devices = socketsToDevices.get(socket)
    if (devices) {
      devices.delete(deviceId)
      if (devices.size === 0) socketsToDevices.delete(socket)
    }
  }

  function unsubscribeAll(socket) {
    const devices = socketsToDevices.get(socket) || []
    for (const deviceId of devices) {
      const sockets = devicesToSockets.get(deviceId)
      if (sockets) {
        sockets.delete(socket)
        if (sockets.size === 0) devicesToSockets.delete(deviceId)
      }
    }
    socketsToDevices.delete(socket)
  }

  function broadcast(deviceId, variable, value, time) {
    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || sockets.size === 0) return

    const message = JSON.stringify({ deviceId, variable, value, time })
    for (const socket of sockets) {
      try {
        if (socket.readyState === 1) socket.send(message)
      } catch (err) {
        app.log.error('Error enviando por WebSocket:', err.message)
      }
    }
  }

  app.decorate('realtime', { subscribe, unsubscribe, unsubscribeAll, broadcast })
}

export default fp(realtimePlugin)
