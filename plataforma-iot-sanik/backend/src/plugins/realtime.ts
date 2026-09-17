import fp from 'fastify-plugin'
import { randomUUID } from 'node:crypto'
import { createClient } from 'redis'
import type { FastifyInstance } from 'fastify'
import type { RealtimeService, RealtimeSocket } from '../types/index.js'

const REALTIME_CHANNEL_PREFIX = 'realtime:device:'
const PRESENCE_KEY_PREFIX = 'ws:presence:'
const INSTANCE_ID = randomUUID()

interface PresenceEntry {
  instanceId: string
  socketIds: string[]
  updatedAt: number
}

async function realtimePlugin(app: FastifyInstance) {
  const instanceId = INSTANCE_ID
  const devicesToSockets = new Map<string, Map<string, RealtimeSocket>>()
  const socketToDevices = new Map<RealtimeSocket, Set<string>>()
  const socketIdCounter = { current: 0 }

  const pubSub = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379)
    }
  })

  pubSub.on('error', (err) => {
    app.log.error(`Redis pub/sub error: ${(err as Error).message}`)
  })

  await pubSub.connect()
  app.log.info(`🔌 Realtime pub/sub conectado — instanceId: ${instanceId}`)

  function genSocketId(): string {
    return `${instanceId}:${++socketIdCounter.current}`
  }

  function getDeviceChannel(deviceId: string): string {
    return `${REALTIME_CHANNEL_PREFIX}${deviceId}`
  }

  async function addPresence(deviceId: string, socketId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${deviceId}`
    const entry: PresenceEntry = { instanceId, socketIds: [socketId], updatedAt: Date.now() }
    const existing = await pubSub.hGet(key, instanceId)
    if (existing) {
      const parsed = JSON.parse(existing) as PresenceEntry
      if (!parsed.socketIds.includes(socketId)) {
        parsed.socketIds.push(socketId)
        parsed.updatedAt = Date.now()
        await pubSub.hSet(key, instanceId, JSON.stringify(parsed))
      }
    } else {
      await pubSub.hSet(key, instanceId, JSON.stringify(entry))
    }
    await pubSub.expire(key, 3600)
  }

  async function removePresence(deviceId: string, socketId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${deviceId}`
    const existing = await pubSub.hGet(key, instanceId)
    if (existing) {
      const parsed = JSON.parse(existing) as PresenceEntry
      parsed.socketIds = parsed.socketIds.filter(id => id !== socketId)
      parsed.updatedAt = Date.now()
      if (parsed.socketIds.length === 0) {
        await pubSub.hDel(key, instanceId)
      } else {
        await pubSub.hSet(key, instanceId, JSON.stringify(parsed))
      }
    }
    const count = await pubSub.hLen(key)
    if (count === 0) {
      await pubSub.del(key)
    }
  }

  async function removeAllPresence(socketId: string): Promise<void> {
    const pattern = `${PRESENCE_KEY_PREFIX}*`
    const keys = await pubSub.keys(pattern)
    for (const key of keys) {
      const existing = await pubSub.hGet(key, instanceId)
      if (existing) {
        const parsed = JSON.parse(existing) as PresenceEntry
        const filtered = parsed.socketIds.filter(id => id !== socketId)
        if (filtered.length === 0) {
          await pubSub.hDel(key, instanceId)
        } else {
          parsed.socketIds = filtered
          parsed.updatedAt = Date.now()
          await pubSub.hSet(key, instanceId, JSON.stringify(parsed))
        }
      }
    }
  }

  function subscribe(deviceId: string, socket: RealtimeSocket) {
    if (!deviceId || !socket) return

    if (!devicesToSockets.has(deviceId)) devicesToSockets.set(deviceId, new Map())
    const socketId = genSocketId()
    devicesToSockets.get(deviceId)!.set(socketId, socket)

    if (!socketToDevices.has(socket)) socketToDevices.set(socket, new Set())
    socketToDevices.get(socket)!.add(deviceId)

    ;(socket as any).__sanik_socket_id = socketId
    addPresence(deviceId, socketId)
  }

  function unsubscribe(deviceId: string, socket: RealtimeSocket) {
    const socketId = (socket as any).__sanik_socket_id
    if (!socketId) return

    const sockets = devicesToSockets.get(deviceId)
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size === 0) devicesToSockets.delete(deviceId)
    }

    const devices = socketToDevices.get(socket)
    if (devices) {
      devices.delete(deviceId)
      if (devices.size === 0) socketToDevices.delete(socket)
    }

    removePresence(deviceId, socketId)
  }

  function unsubscribeAll(socket: RealtimeSocket) {
    const socketId = (socket as any).__sanik_socket_id
    const devices = socketToDevices.get(socket)
    if (devices) {
      for (const deviceId of devices) {
        const sockets = devicesToSockets.get(deviceId)
        if (sockets) {
          sockets.delete(socketId)
          if (sockets.size === 0) devicesToSockets.delete(deviceId)
        }
      }
    }
    socketToDevices.delete(socket)
    if (socketId) removeAllPresence(socketId)
  }

  function sendToSockets(deviceId: string, payload: unknown): void {
    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || sockets.size === 0) return

    const message = JSON.stringify(payload)
    for (const [, socket] of sockets) {
      try {
        if (socket.readyState === 1) socket.send(message)
      } catch (err) {
        app.log.error(`Error enviando por WebSocket: ${(err as Error).message}`)
      }
    }
  }

  async function broadcast(deviceId: string, variable: string, value: number, time: Date): Promise<void> {
    const payload = { deviceId, variable, value, time }
    sendToSockets(deviceId, payload)

    const channel = getDeviceChannel(deviceId)
    try {
      await pubSub.publish(channel, JSON.stringify({ ...payload, origin: instanceId }))
    } catch (err) {
      app.log.error(`Error publicando en Redis pub/sub: ${(err as Error).message}`)
    }
  }

  async function subscribeToDeviceChannel(deviceId: string): Promise<void> {
    const channel = getDeviceChannel(deviceId)
    await pubSub.subscribe(channel, (rawMessage: string) => {
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
  }

  async function unsubscribeFromDeviceChannel(deviceId: string): Promise<void> {
    const channel = getDeviceChannel(deviceId)
    await pubSub.unsubscribe(channel)
  }

  const originalSubscribe = subscribe
  const originalUnsubscribe = unsubscribe

  const wrappedSubscribe = async (deviceId: string, socket: RealtimeSocket) => {
    originalSubscribe(deviceId, socket)
    const sockets = devicesToSockets.get(deviceId)
    if (sockets && sockets.size === 1) {
      await subscribeToDeviceChannel(deviceId)
    }
  }

  const wrappedUnsubscribe = async (deviceId: string, socket: RealtimeSocket) => {
    originalUnsubscribe(deviceId, socket)
    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || sockets.size === 0) {
      await unsubscribeFromDeviceChannel(deviceId)
    }
  }

  app.addHook('onClose', async () => {
    await pubSub.quit()
  })

  const realtime: RealtimeService = {
    subscribe: wrappedSubscribe,
    unsubscribe: wrappedUnsubscribe,
    unsubscribeAll,
    broadcast
  }
  app.decorate('realtime', realtime)
}

export default fp(realtimePlugin)