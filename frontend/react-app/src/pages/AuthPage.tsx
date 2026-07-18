import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { API_URL, readError } from '../lib/api'
import { saveSession } from '../lib/session'
import type { AuthMode, Session } from '../types'

type AuthPageProps = { mode: AuthMode; onAuthenticated: (session: Session) => void }

export function AuthPage({ mode, onAuthenticated }: AuthPageProps) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/auth/${mode === 'signin' ? 'login' : 'signup'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? { name, email, password } : { email, password }),
      })
      if (!response.ok) throw new Error(await readError(response))
      const session = (await response.json()) as Session
      saveSession(session)
      onAuthenticated(session)
      navigate('/upload', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to continue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <main className="auth-layout">
    <section className="brand-panel">
      <BrandLogo />
      <div className="brand-content"><p className="eyebrow">Reconciliation made clear</p><h1>Bring every order and payment into focus.</h1><p>Securely import your CSV exports and give your finance team one reliable view of the numbers.</p></div>
      <div className="brand-stat"><strong>2 files</strong><span>One clean import</span></div>
    </section>
    <section className="auth-panel">
      <form className="auth-card" onSubmit={submit}>
        <div className="tab-list" aria-label="Authentication mode"><Link className={mode === 'signin' ? 'active' : ''} to="/sign-in">Sign in</Link><Link className={mode === 'signup' ? 'active' : ''} to="/sign-up">Create account</Link></div>
        <div className="form-heading"><h2>{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h2><p>{mode === 'signin' ? 'Sign in to import and reconcile your data.' : 'Start importing your order and payment data.'}</p></div>
        {mode === 'signup' && <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" autoComplete="name" /></label>}
        <label>Email address<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={4} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 4 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>
    </section>
  </main>
}
