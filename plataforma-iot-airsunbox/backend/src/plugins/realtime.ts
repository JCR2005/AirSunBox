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
  // Un id estable por socket (se asigna en la primera suscripción). Antes se
  // generaba uno nuevo en cada subscribe y se pisaba el anterior, así que al
  // cerrar quedaban sockets huérfanos en los otros dispositivos.
  const socketIds = new WeakMap<RealtimeSocket, string>()

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

  // Redis pone una conexión en modo "subscriber" al usar subscribe(), y en ese
  // estado solo admite (P|S)SUBSCRIBE / (P|S)UNSUBSCRIBE / PING / QUIT / RESET.
  // Los hashes de presencia (hGet/hSet/keys/expire) necesitan su propia
  // conexión, o Redis responde "ERR Can't execute 'hget'" y el proceso muere.
  const presence = pubSub.duplicate()

  presence.on('error', (err) => {
    app.log.error(`Redis presence error: ${(err as Error).message}`)
  })

  await presence.connect()

  function socketIdOf(socket: RealtimeSocket): string {
    let id = socketIds.get(socket)
    if (!id) {
      id = `${instanceId}:${++socketIdCounter.current}`
      socketIds.set(socket, id)
    }
    return id
  }

  function getDeviceChannel(deviceId: string): string {
    return `${REALTIME_CHANNEL_PREFIX}${deviceId}`
  }

  async function addPresence(deviceId: string, socketId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${deviceId}`
    const entry: PresenceEntry = { instanceId, socketIds: [socketId], updatedAt: Date.now() }
    const existing = await presence.hGet(key, instanceId)
    if (existing) {
      const parsed = JSON.parse(existing) as PresenceEntry
      if (!parsed.socketIds.includes(socketId)) {
        parsed.socketIds.push(socketId)
        parsed.updatedAt = Date.now()
        await presence.hSet(key, instanceId, JSON.stringify(parsed))
      }
    } else {
      await presence.hSet(key, instanceId, JSON.stringify(entry))
    }
    await presence.expire(key, 3600)
  }

  async function removePresence(deviceId: string, socketId: string): Promise<void> {
    const key = `${PRESENCE_KEY_PREFIX}${deviceId}`
    const existing = await presence.hGet(key, instanceId)
    if (existing) {
      const parsed = JSON.parse(existing) as PresenceEntry
      parsed.socketIds = parsed.socketIds.filter(id => id !== socketId)
      parsed.updatedAt = Date.now()
      if (parsed.socketIds.length === 0) {
        await presence.hDel(key, instanceId)
      } else {
        await presence.hSet(key, instanceId, JSON.stringify(parsed))
      }
    }
    const count = await presence.hLen(key)
    if (count === 0) {
      await presence.del(key)
    }
  }

  function logPresenceError(err: unknown) {
    app.log.error(`Error actualizando presencia: ${(err as Error).message}`)
  }

  async function subscribe(deviceId: string, socket: RealtimeSocket): Promise<void> {
    if (!deviceId || !socket) return
    const socketId = socketIdOf(socket)

    let sockets = devicesToSockets.get(deviceId)
    if (!sockets) devicesToSockets.set(deviceId, sockets = new Map())
    if (sockets.has(socketId)) return // ya suscrito: evita mensajes duplicados
    sockets.set(socketId, socket)

    let devices = socketToDevices.get(socket)
    if (!devices) socketToDevices.set(socket, devices = new Set())
    devices.add(deviceId)

    addPresence(deviceId, socketId).catch(logPresenceError)
    // Primer interesado en esta instancia: escuchar lo que publiquen las demás
    if (sockets.size === 1) await subscribeToDeviceChannel(deviceId)
  }

  async function unsubscribe(deviceId: string, socket: RealtimeSocket): Promise<void> {
    const socketId = socketIds.get(socket)
    if (!socketId) return

    const devices = socketToDevices.get(socket)
    if (devices) {
      devices.delete(deviceId)
      if (devices.size === 0) socketToDevices.delete(socket)
    }

    const sockets = devicesToSockets.get(deviceId)
    if (!sockets || !sockets.delete(socketId)) return
    removePresence(deviceId, socketId).catch(logPresenceError)
    if (sockets.size === 0) {
      devicesToSockets.delete(deviceId)
      await unsubscribeFromDeviceChannel(deviceId)
    }
  }

  async function unsubscribeAll(socket: RealtimeSocket): Promise<void> {
    const devices = socketToDevices.get(socket)
    if (!devices) return
    await Promise.allSettled([...devices].map(deviceId => unsubscribe(deviceId, socket)))
    socketToDevices.delete(socket)
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

  app.addHook('onClose', async () => {
    await Promise.allSettled([pubSub.quit(), presence.quit()])
  })

  const realtime: RealtimeService = {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    broadcast
  }
  app.decorate('realtime', realtime)
}

export default fp(realtimePlugin)