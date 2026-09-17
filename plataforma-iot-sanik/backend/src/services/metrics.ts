import { Registry, collectDefaultMetrics } from 'prom-client'

export const registry = new Registry()

export function registerDefaultMetrics(): void {
  collectDefaultMetrics({ register: registry, prefix: 'sanik_' })
}

export async function getMetrics(): Promise<string> {
  return registry.metrics()
}