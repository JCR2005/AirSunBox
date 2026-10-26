import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'

async function mqttPlugin(app: FastifyInstance) {
  const clientId = `sanik-backend-${process.env.HOSTNAME || 'local'}-${Date.now()}`
  const client: MqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST || 'localhost'}:${process.env.MQTT_PORT || 1883}`, {
    clientId,
    clean: true
  })

  client.on('connect', () => {
    app.log.info(`✅ Conectado al broker MQTT (EMQX) — clientId: ${clientId}`)
    // Los equipos publican en "/v1/devices/{TOKEN}/data" (con barra inicial,
    // ver README). En MQTT esa barra crea un nivel vacío, así que se suscribe
    // también a la variante sin barra para no depender del firmware.
    const topics = [
      '$share/sanik-ingest//v1/devices/+/data',
      '$share/sanik-ingest/v1/devices/+/data'
    ]
    client.subscribe(topics, { qos: 1 }, (err) => {
      if (err) app.log.error(`❌ Error suscribiendo a ${topics.join(', ')}: ${err.message}`)
      else app.log.info(`📥 Suscrito a shared subscription: ${topics.join(', ')}`)
    })
  })

  client.on('error', (err: Error) => {
    app.log.error(`❌ Error MQTT: ${err.message}`)
  })

  client.on('message', async (topic: string, message: Buffer) => {
    try {
      // .../devices/{TOKEN}/data — el token es el penúltimo nivel, con o sin "/" inicial
      const parts = topic.split('/')
      const deviceToken = parts[parts.length - 2]
      if (!deviceToken) return
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

      await app.ingestQueue.enqueue({
        deviceId,
        payload,
        // Minúsculas como la ingesta HTTP: las lecturas (gráficas, catálogo)
        // buscan siempre el nombre en minúsculas
        options: { strictNumbers: true, lowercaseVariables: true }
      })

      app.log.debug(`📥 Encolado ingesta — device: ${deviceId}`)

    } catch (err) {
      app.log.error(err)
      app.log.error(`Error encolando mensaje MQTT: ${(err as Error)?.message}`)
    }
  })

  app.decorate('mqtt', client)

  app.addHook('onClose', async () => {
    client.end()
  })
}

export default fp(mqttPlugin)