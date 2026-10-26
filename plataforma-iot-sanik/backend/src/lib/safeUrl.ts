import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

// Destinos que un cliente no debe poder alcanzar desde el servidor a través
// de un webhook: la propia máquina, la red de Docker (Redis, Postgres, EMQX)
// y cualquier red privada o de enlace local.
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
  ['192.0.0.0', 24], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
] as const) blocked.addSubnet(net, prefix, 'ipv6')

function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family === 6) {
    // ::ffff:10.0.0.1 → se evalúa como IPv4
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
    if (mapped) return blocked.check(mapped[1], 'ipv4')
    return blocked.check(address, 'ipv6')
  }
  return true
}

// Validación de formato, sin red: para responder 400 al guardar la alerta.
export function parseWebhookUrl(raw: string): URL | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  return url
}

// Resuelve el host y exige que todas sus IPs sean públicas. Se llama justo
// antes de cada envío porque el DNS puede cambiar después de guardar.
export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = parseWebhookUrl(raw)
  if (!url) throw new Error('URL de webhook inválida (solo http/https)')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map(a => a.address)
  if (!addresses.length || addresses.some(isBlockedAddress)) {
    throw new Error(`El webhook apunta a una dirección interna o no permitida (${url.hostname})`)
  }
  return url
}
