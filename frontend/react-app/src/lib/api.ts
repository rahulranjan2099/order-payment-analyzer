export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '')

export const readError = async (response: Response) => {
  try {
    const body = (await response.json()) as { error?: string; message?: string }
    return body.error ?? body.message ?? 'Something went wrong. Please try again.'
  } catch {
    return 'Something went wrong. Please try again.'
  }
}
