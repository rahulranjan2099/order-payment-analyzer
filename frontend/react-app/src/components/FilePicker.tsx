type FilePickerProps = {
  label: string
  description: string
  file: File | null
  onChange: (file: File | null) => void
}

export function FilePicker({ label, description, file, onChange }: FilePickerProps) {
  return (
    <label className={`file-picker ${file ? 'has-file' : ''}`}>
      <input type="file" accept=".csv,text/csv" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      <span className="file-icon" aria-hidden="true">⇧</span>
      <span className="file-copy">
        <strong>{file?.name ?? label}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(1)} KB · ready to import` : description}</small>
      </span>
      <span className="file-action">{file ? 'Replace' : 'Choose CSV'}</span>
    </label>
  )
}
