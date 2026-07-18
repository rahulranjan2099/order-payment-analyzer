export type User = { id: string; name: string; email: string }

export type Session = { token: string; user: User }

export type AuthMode = 'signin' | 'signup'

export type UploadResult = {
  uploadId: string
  status: string
  ordersImported: number
  paymentsImported: number
}
