import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import '@/lib/i18n'
import { initAuthListener } from '@/stores/authStore'
import { FullPageSpinner } from '@/components/ui/Spinner'

initAuthListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<FullPageSpinner />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Suspense>
  </StrictMode>,
)
