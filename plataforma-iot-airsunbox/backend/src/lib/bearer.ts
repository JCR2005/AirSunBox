import type { FastifyRequest } from 'fastify'

// Token crudo del encabezado Authorization ("Bearer <token>"), o '' si no hay
export function bearerToken(req: FastifyRequest): string {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}
