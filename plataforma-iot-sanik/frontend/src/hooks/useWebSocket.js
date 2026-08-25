import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.DEV ? 'ws://localhost:3000/ws' : '/ws')

// Hook de tiempo real por WebSocket.
// Recibe un array de deviceId (puede cambiar) y devuelve:
//   lastValues: { [deviceId]: { [variable]: { value, time } } }
//   connected:  booleano, true cuando la conexión está activa
//
// Mantiene una sola conexión, re-suscribe al cambiar los deviceId y
// se reconecta automáticamente si se cae.
export function useWebSocket(deviceIds = []) {
  const [lastValues, setLastValues] = useState({})
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const readyRef = useRef(false)
  const reconnectRef = useRef(null)
  const idsRef = useRef([])

  // Mantener los ids siempre actualizados sin depender del closure
  useEffect(() => {
    idsRef.current = Array.isArray(deviceIds) ? deviceIds : []
  }, [deviceIds])

  const subscribeAll = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    for (const id of idsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', deviceId: id }))
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      try {
        const ws = new WebSocket(WS_URL)
        wsRef.current = ws
        readyRef.current = false

        ws.onopen = () => {
          if (cancelled || !wsRef.current) return
          readyRef.current = true
          setConnected(true)
          subscribeAll()
        }

        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data)
            if (!data.deviceId || !data.variable) return
            setLastValues(prev => ({
              ...prev,
              [data.deviceId]: {
                ...(prev[data.deviceId] || {}),
                [data.variable]: { value: data.value, time: data.time }
              }
            }))
          } catch {}
        }

        ws.onclose = () => {
          setConnected(false)
          if (cancelled || !wsRef.current) return
          if (!reconnectRef.current) {
            reconnectRef.current = setTimeout(() => {
              reconnectRef.current = null
              connect()
            }, 3000)
          }
        }

        ws.onerror = () => {
          try { ws.close() } catch {}
        }
      } catch {}
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
        reconnectRef.current = null
      }
      if (wsRef.current) {
        try { wsRef.current.close() } catch {}
        wsRef.current = null
      }
    }
  }, [subscribeAll])

  // Re-suscribir cuando cambian los deviceId
  useEffect(() => {
    if (readyRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      subscribeAll()
    }
  }, [deviceIds, subscribeAll])

  return { lastValues, connected }
}
