import { create } from 'zustand'

const useThemeStore = create((set) => ({
  dark: localStorage.getItem('sanik-theme') !== 'light',
  toggle: () => set((state) => {
    const newDark = !state.dark
    localStorage.setItem('sanik-theme', newDark ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : 'light')
    return { dark: newDark }
  }),
  init: () => {
    const dark = localStorage.getItem('sanik-theme') !== 'light'
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    return { dark }
  }
}))

export default useThemeStore
