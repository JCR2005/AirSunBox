import fp from 'fastify-plugin'
import { randomUUID } from 'node:crypto'
import { createClient } from 'redis'
import type { FastifyInstance } from 'fastify'
import type { RealtimeService, RealtimeSocket } from '../types/index.js'

const REALTIME_CHANNEL = 'realtime:data'

async function realtimePlugin(app: FastifyInstance) {
  const instanceId = randomUUID()
  const devicesToSockets = new Map<string, Set<RealtimeSocket>>()
  const socketsToDevices = new Map<RealtimeSocket, Set<string>>()

  const pubSub = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379)
    }
  })

  pubSub.on('error', (err) => {
    app.log.error(`Redis pub/sub error: ${(err as Error).message}`)
  })

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

  function sendToSockets(deviceId: string, payload: unknown) {
    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || sockets.size === 0) return

    const message = JSON.stringify(payload)
    for (const socket of sockets) {
      try {
        if (socket.readyState === 1) socket.send(message)
      } catch (err) {
        app.log.error(`Error enviando por WebSocket: ${(err as Error).message}`)
      }
    }
  }

  async function broadcast(deviceId: string, variable: string, value: number, time: Date) {
    const payload = { deviceId, variable, value, time }
    sendToSockets(deviceId, payload)

    try {
      await pubSub.publish(REALTIME_CHANNEL, JSON.stringify({ ...payload, origin: instanceId }))
    } catch (err) {
      app.log.error(`Error publicando en Redis pub/sub: ${(err as Error).message}`)
    }
  }

  await pubSub.connect()
  await pubSub.subscribe(REALTIME_CHANNEL, (rawMessage: string) => {
    try {
      const data = JSON.parse(rawMessage) as {
        deviceId?: string
        variable?: string
        value?: number
        time?: Date
        origin?: string
      }

      if (data.origin === instanceId) return
      if (!data.deviceId) return

      sendToSockets(data.deviceId, {
        deviceId: data.deviceId,
        variable: data.variable,
        value: data.value,
        time: data.time
      })
    } catch (err) {
      app.log.error(`Mensaje Redis inválido: ${(err as Error).message}`)
    }
  })

  app.addHook('onClose', async () => {
    await pubSub.quit()
  })

  const realtime: RealtimeService = { subscribe, unsubscribe, unsubscribeAll, broadcast }
  app.decorate('realtime', realtime)
}

export default fp(realtimePlugin)