import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandLogo } from '../components/BrandLogo'
import { FilePicker } from '../components/FilePicker'
import { API_URL, readError } from '../lib/api'
import type { Session, UploadResult } from '../types'

type UploadPageProps = { session: Session; onSignOut: () => void }

export function UploadPage({ session, onSignOut }: UploadPageProps) {
  const navigate = useNavigate()
  const [ordersFile, setOrdersFile] = useState<File | null>(null)
  const [paymentsFile, setPaymentsFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(''); setResult(null)
    if (!ordersFile && !paymentsFile) { setError('Choose at least one CSV file to import.'); return }
    const formData = new FormData()
    if (ordersFile) formData.append('ordersFile', ordersFile)
    if (paymentsFile) formData.append('paymentsFile', paymentsFile)
    setIsUploading(true)
    try {
      const response = await fetch(`${API_URL}/uploads/import`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` }, body: formData })
      if (response.status === 401) { onSignOut(); navigate('/sign-in', { replace: true }); return }
      if (!response.ok) throw new Error(await readError(response))
      setResult((await response.json()) as UploadResult)
      setOrdersFile(null); setPaymentsFile(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import could not be completed.')
    } finally { setIsUploading(false) }
  }

  return <main className="app-shell">
    <header className="topbar"><BrandLogo dark /><div className="account"><span>{session.user.name || session.user.email}</span><button onClick={onSignOut}>Sign out</button></div></header>
    <section className="workspace">
      <div className="page-intro"><p className="eyebrow">Data import</p><h1>Upload your CSV exports</h1><p>Import order and payment files together or one at a time. Files are processed securely and must be CSV files under 10 MB.</p></div>
      <form className="upload-card" onSubmit={upload}>
        <div className="upload-card-header"><div><h2>New import</h2><p>Select the exports you want to reconcile.</p></div><span className="csv-chip">CSV only</span></div>
        <div className="file-grid"><FilePicker label="Orders export" description="Order ID, dates, amounts, and status" file={ordersFile} onChange={setOrdersFile} /><FilePicker label="Payments export" description="Transaction references and settlements" file={paymentsFile} onChange={setPaymentsFile} /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {result && <div className="success-message" role="status"><span>✓</span><div><strong>Import completed</strong><p>{result.ordersImported} orders and {result.paymentsImported} payments were imported.</p></div></div>}
        <div className="upload-footer"><p>Required columns are validated before records are added.</p><button className="primary-button" disabled={isUploading}>{isUploading ? 'Importing…' : 'Import files'}</button></div>
      </form>
    </section>
  </main>
}
