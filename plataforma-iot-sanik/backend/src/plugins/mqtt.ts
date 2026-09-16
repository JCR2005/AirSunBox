import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import { processDevicePayload } from '../services/datalinkService.js'

async function mqttPlugin(app: FastifyInstance) {
  const client: MqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`)

  client.on('connect', () => {
    app.log.info('✅ Conectado al broker MQTT (EMQX)')
    client.subscribe('/v1/devices/+/data', { qos: 1 })
  })

  client.on('error', (err: Error) => {
    app.log.error(`❌ Error MQTT: ${err.message}`)
  })

  client.on('message', async (topic: string, message: Buffer) => {
    try {
      const parts = topic.split('/')
      const deviceToken = parts[3]
      const payload = JSON.parse(message.toString()) as Record<string, unknown>

      const { rows } = await app.db.query(
        'SELECT id FROM devices WHERE token = $1',
        [deviceToken]
      )

      if (!rows.length) {
        app.log.warn(`Token desconocido: ${deviceToken}`)
        return
      }

      const deviceId = rows[0].id as string

      await processDevicePayload(app, deviceId, payload, {
        strictNumbers: true,
        lowercaseVariables: false
      })

      app.log.info(`📡 Datos guardados — device: ${deviceId}`)

    } catch (err) {
      app.log.error(err)
      app.log.error(`Error procesando mensaje MQTT: ${(err as Error)?.message}`)
    }
  })

  app.decorate('mqtt', client)

  app.addHook('onClose', async () => {
    client.end()
  })
}

export default fp(mqttPlugin)