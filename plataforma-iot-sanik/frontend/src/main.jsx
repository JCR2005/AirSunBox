import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Aplicar tema guardado antes de renderizar
const savedTheme = localStorage.getItem('sanik-theme')
document.documentElement.setAttribute('data-theme', savedTheme === 'light' ? 'light' : 'dark')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
