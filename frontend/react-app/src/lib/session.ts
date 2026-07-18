import type { Session } from '../types'

const SESSION_KEY = 'order-payment-analyzer.session'

export const getSession = (): Session | null => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null
  } catch {
    return null
  }
}

export const saveSession = (session: Session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session))

export const clearSession = () => localStorage.removeItem(SESSION_KEY)
