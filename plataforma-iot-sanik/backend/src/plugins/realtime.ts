import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import type { RealtimeService, RealtimeSocket } from '../types/index.js'

async function realtimePlugin(app: FastifyInstance) {
  const devicesToSockets = new Map<string, Set<RealtimeSocket>>()
  const socketsToDevices = new Map<RealtimeSocket, Set<string>>()

  function subscribe(deviceId: string, socket: RealtimeSocket) {
    if (!deviceId || !socket) return

    if (!devicesToSockets.has(deviceId)) devicesToSockets.set(deviceId, new Set())
    devicesToSockets.get(deviceId)!.add(socket)

    if (!socketsToDevices.has(socket)) socketsToDevices.set(socket, new Set())
    socketsToDevices.get(socket)!.add(deviceId)
  }

  function unsubscribe(deviceId: string, socket: RealtimeSocket) {
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

  function unsubscribeAll(socket: RealtimeSocket) {
    const devices = socketsToDevices.get(socket)
    if (devices) {
      for (const deviceId of devices) {
        const sockets = devicesToSockets.get(deviceId)
        if (sockets) {
          sockets.delete(socket)
          if (sockets.size === 0) devicesToSockets.delete(deviceId)
        }
      }
    }
    socketsToDevices.delete(socket)
  }

  function broadcast(deviceId: string, variable: string, value: number, time: Date) {
    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || sockets.size === 0) return

    const message = JSON.stringify({ deviceId, variable, value, time })
    for (const socket of sockets) {
      try {
        if (socket.readyState === 1) socket.send(message)
      } catch (err) {
        app.log.error(`Error enviando por WebSocket: ${(err as Error).message}`)
      }
    }
  }

  const realtime: RealtimeService = { subscribe, unsubscribe, unsubscribeAll, broadcast }
  app.decorate('realtime', realtime)
}

export default fp(realtimePlugin)