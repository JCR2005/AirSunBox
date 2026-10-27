import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_URL || ''

const useAuthStore = create((set, get) => ({
  token: localStorage.getItem('airsunbox_token') || null,
  user: JSON.parse(localStorage.getItem('airsunbox_user') || 'null'),
  org: JSON.parse(localStorage.getItem('airsunbox_org') || 'null'),
  twoFactorStatus: null,
  backupCodes: [],
  twoFactorLoading: false,
  twoFactorError: null,

  login: (token, user, org) => {
    localStorage.setItem('airsunbox_token', token)
    localStorage.setItem('airsunbox_user', JSON.stringify(user))
    localStorage.setItem('airsunbox_org', JSON.stringify(org))
    set({ token, user, org })
  },

  // Refleja en la sesión los cambios del propio perfil (nombre en el menú)
  updateUser: (changes) => {
    const user = { ...get().user, ...changes }
    localStorage.setItem('airsunbox_user', JSON.stringify(user))
    set({ user })
  },

  logout: () => {
    // Invalida el token también en el servidor. No se espera la respuesta:
    // la sesión local se cierra igual aunque no haya conexión.
    const { token } = get()
    if (token) {
      fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        keepalive: true
      }).catch(() => {})
    }
    localStorage.removeItem('airsunbox_token')
    localStorage.removeItem('airsunbox_user')
    localStorage.removeItem('airsunbox_org')
    set({ token: null, user: null, org: null, twoFactorStatus: null, backupCodes: [] })
  },

  fetch2faStatus: async () => {
    const { token } = get()
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        set({ twoFactorStatus: data })
      }
    } catch (e) {
      console.error('Error fetching 2FA status:', e)
    }
  },

  send2faCode: async () => {
    const { token } = get()
    if (!token) return { ok: false, error: 'No autenticado' }
    set({ twoFactorLoading: true, twoFactorError: null })
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/send-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el código')
      set({ twoFactorLoading: false })
      return { ok: true }
    } catch (e) {
      set({ twoFactorError: e.message, twoFactorLoading: false })
      return { ok: false, error: e.message }
    }
  },

  enable2fa: async (code) => {
    const { token } = get()
    if (!token) return { ok: false, error: 'No autenticado' }
    set({ twoFactorLoading: true, twoFactorError: null })
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al activar 2FA')
      
      // Update status after enabling
      await get().fetch2faStatus()
      set({ backupCodes: data.backupCodes || [], twoFactorLoading: false })
      return { ok: true, backupCodes: data.backupCodes }
    } catch (e) {
      set({ twoFactorError: e.message, twoFactorLoading: false })
      return { ok: false, error: e.message }
    }
  },

  disable2fa: async (code) => {
    const { token } = get()
    if (!token) return { ok: false, error: 'No autenticado' }
    set({ twoFactorLoading: true, twoFactorError: null })
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al desactivar 2FA')
      
      await get().fetch2faStatus()
      set({ backupCodes: [], twoFactorLoading: false })
      return { ok: true }
    } catch (e) {
      set({ twoFactorError: e.message, twoFactorLoading: false })
      return { ok: false, error: e.message }
    }
  }
}))

export default useAuthStore