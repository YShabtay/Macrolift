import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { sanitizeAndMigrateStorage } from './utils/dataMigration'
import { installChunkErrorRecovery } from './utils/chunkRecovery'
import { installControllerChangeReload } from './utils/swReload'
import './utils/pwaInstall' // starts capturing the browser's install prompt before any screen asks for it
import App from './App.tsx'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'
import { RestTimerProvider } from './context/TimerContext'

// A stale tab after a deploy recovers by itself (one silent reload) instead of showing an error, and an accepted update reloads once.
installChunkErrorRecovery()
installControllerChangeReload()

// Repair saved data from older app versions before any component reads it.
sanitizeAndMigrateStorage()

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
