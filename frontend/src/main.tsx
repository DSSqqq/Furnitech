import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
// mobile.css временно отключён — см. desktop-layout.css (фикс. ширина 1280, pinch-zoom на телефоне).
// import './mobile.css'
import './desktop-layout.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
