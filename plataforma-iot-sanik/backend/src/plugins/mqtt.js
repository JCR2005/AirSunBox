import fp from 'fastify-plugin'
import mqtt from 'mqtt'
import { evaluateDeviceAlerts } from '../utils/alerting.js'
import { getDeviceVariableScope, isLabelAllowed } from '../utils/deviceScope.js'

async function mqttPlugin(app) {
  const client = mqtt.connect(`mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`)

  client.on('connect', () => {
    app.log.info('✅ Conectado al broker MQTT (EMQX)')
    // Escuchar datos de TODOS los dispositivos
    client.subscribe('/v1/devices/+/data', { qos: 1 })
  })

  client.on('error', (err) => {
    app.log.error('❌ Error MQTT:', err.message)
  })

  // Cuando llega un dato del ESP32
  client.on('message', async (topic, message) => {
    try {
      // topic ejemplo: /v1/devices/TOKEN_DEL_DEVICE/data
      const parts = topic.split('/')
      const deviceToken = parts[3]
      const payload = JSON.parse(message.toString())

      // Buscar el dispositivo por token
      const { rows } = await app.db.query(
        'SELECT id FROM devices WHERE token = $1',
        [deviceToken]
      )

      if (!rows.length) {
        app.log.warn(`Token desconocido: ${deviceToken}`)
        return
      }

      const deviceId = rows[0].id
      const now = new Date()

      // Alcance de variables del dispositivo (orgs tipo B: solo las de su espacio)
      const scope = await getDeviceVariableScope(app, deviceId)

      // Guardar cada variable en TimescaleDB
      for (const [variable, value] of Object.entries(payload)) {
        if (typeof value !== 'number') continue

        if (!isLabelAllowed(scope, variable)) {
          app.log.warn(`Variable "${variable}" no pertenece al espacio — ignorada (device ${deviceId})`)
          continue
        }

        // Registrar la variable del dispositivo (si no existe)
        await app.db.query(
          `INSERT INTO device_variables (device_id, variable_label)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [deviceId, variable]
        )

        await app.db.query(
          'INSERT INTO dots (time, device_id, variable, value) VALUES ($1, $2, $3, $4)',
          [now, deviceId, variable, value]
        )

        // Actualizar último valor en Redis (para tiempo real)
        await app.redis.set(
          `last:${deviceId}:${variable}`,
          JSON.stringify({ value, time: now }),
          { EX: 86400 } // expira en 24 horas
        )

        // Notificar a los clientes suscritos al WebSocket (tiempo real)
        app.realtime.broadcast(deviceId, variable, value, now)
      }

      // Actualizar last_seen del dispositivo
      await app.db.query(
        'UPDATE devices SET last_seen = $1 WHERE id = $2',
        [now, deviceId]
      )

      // Evaluar alertas activas de la estación
      await evaluateDeviceAlerts(app, deviceId)

      app.log.info(`📡 Datos guardados — device: ${deviceId}`)

    } catch (err) {
      app.log.error(err)
      app.log.error('Error procesando mensaje MQTT:', err?.message, '\n', err?.stack)
    }
  })

  app.decorate('mqtt', client)

  app.addHook('onClose', async () => {
    client.end()
  })
}

export default fp(mqttPlugin)
