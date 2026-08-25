import { create } from 'zustand'

const useAuthStore = create((set) => ({
  token: localStorage.getItem('sanik_token') || null,
  user: JSON.parse(localStorage.getItem('sanik_user') || 'null'),
  org: JSON.parse(localStorage.getItem('sanik_org') || 'null'),

  login: (token, user, org) => {
    localStorage.setItem('sanik_token', token)
    localStorage.setItem('sanik_user', JSON.stringify(user))
    localStorage.setItem('sanik_org', JSON.stringify(org))
    set({ token, user, org })
  },

  logout: () => {
    localStorage.removeItem('sanik_token')
    localStorage.removeItem('sanik_user')
    localStorage.removeItem('sanik_org')
    set({ token: null, user: null, org: null })
  }
}))

export default useAuthStore
