import { create } from 'zustand'

const useThemeStore = create((set) => ({
  dark: localStorage.getItem('airsunbox-theme') !== 'light',
  toggle: () => set((state) => {
    const newDark = !state.dark
    localStorage.setItem('airsunbox-theme', newDark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light')
    return { dark: newDark }
  }),
  init: () => {
    const dark = localStorage.getItem('airsunbox-theme') !== 'light'
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    return { dark }
  }
}))

export default useThemeStore
