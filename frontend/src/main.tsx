import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
// Должен импортироваться последним: содержит все @media-переопределения
// для ширин ≤1024px / ≤768px / ≤560px, перебивает базовые стили каскадом.
import './mobile.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
