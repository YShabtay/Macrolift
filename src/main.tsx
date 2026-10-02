import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import { RestTimerProvider } from './context/TimerContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <RestTimerProvider>
          <App />
        </RestTimerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
)
