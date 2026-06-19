import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { ThemeProvider } from './ThemeProvider'
import { applyTheme, readStoredTheme } from './theme'
import { API_ORIGIN } from './apiBase'
import App from './App.tsx'

// На проде фронт (Vercel) и бэкенд (Render) — разные origin. Заранее открываем
// соединение (DNS + TLS) к бэкенду, чтобы первый запрос справочников не ждал handshake.
function preconnectBackend() {
  if (!API_ORIGIN) return
  for (const rel of ['preconnect', 'dns-prefetch']) {
    const link = document.createElement('link')
    link.rel = rel
    link.href = API_ORIGIN
    if (rel === 'preconnect') link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }
}
preconnectBackend()

applyTheme(readStoredTheme())
// mobile.css временно отключён — см. desktop-layout.css (фикс. ширина 1280, pinch-zoom на телефоне).
// import './mobile.css'
import './desktop-layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
