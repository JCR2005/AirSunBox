import { test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

async function j(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) }
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

test('GET /health responde ok', async () => {
  const { status, body } = await j('/health')
  assert.equal(status, 200)
  assert.equal(body.status, 'ok')
  assert.equal(body.service, 'sanik-backend')
})

test('GET /api/public/devices devuelve lista', async () => {
  const { status, body } = await j('/api/public/devices')
  assert.equal(status, 200)
  assert.ok(Array.isArray(body))
})

test('GET /api/public/reports/stats devuelve métricas globales', async () => {
  const { status, body } = await j('/api/public/reports/stats')
  assert.equal(status, 200)
  assert.ok(typeof body.total_clients === 'number' || typeof body.total_clients === 'string')
  assert.ok(typeof body.total_devices === 'number' || typeof body.total_devices === 'string')
})

test('GET /api/public/devices/:id/aqi maneja datos inexistentes', async () => {
  const { status, body } = await j('/api/public/devices/00000000-0000-0000-0000-000000000000/aqi')
  assert.equal(status, 200)
  assert.equal(body.aqi, null)
})

test('rutas autenticadas devuelven 401 sin token', async () => {
  const { status, body } = await j('/api/devices')
  assert.equal(status, 401)
  assert.ok(body.error)
})