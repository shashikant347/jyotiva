import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PrefsProvider } from './context/PrefsContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <PrefsProvider>
    <AuthProvider>
      <BrowserRouter><App /></BrowserRouter>
    </AuthProvider>
  </PrefsProvider>,
)
