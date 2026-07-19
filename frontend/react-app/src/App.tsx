import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { API_URL } from './lib/api'
import { clearSession, getSession } from './lib/session'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { UploadPage } from './pages/UploadPage'
import type { Session } from './types'
import './App.css'

function App() {
  const [session, setSession] = useState<Session | null>(getSession)

  useEffect(() => {
    if (!session?.token) return
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((response) => { if (response.status === 401) { clearSession(); setSession(null) } })
      .catch(() => undefined)
  }, [session?.token])

  const signOut = () => { clearSession(); setSession(null) }
  const redirect = session ? '/upload' : '/sign-in'

  return <Routes>
    <Route path="/" element={<Navigate to={redirect} replace />} />
    <Route path="/sign-in" element={session ? <Navigate to="/upload" replace /> : <AuthPage mode="signin" onAuthenticated={setSession} />} />
    <Route path="/sign-up" element={session ? <Navigate to="/upload" replace /> : <AuthPage mode="signup" onAuthenticated={setSession} />} />
    <Route path="/upload" element={session ? <UploadPage session={session} onSignOut={signOut} /> : <Navigate to="/sign-in" replace />} />
    <Route path="/dashboard" element={session ? <DashboardPage session={session} onSignOut={signOut} /> : <Navigate to="/sign-in" replace />} />
    <Route path="*" element={<Navigate to={redirect} replace />} />
  </Routes>
}

export default App
