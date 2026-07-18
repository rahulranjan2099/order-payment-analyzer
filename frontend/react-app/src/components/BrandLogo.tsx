export function BrandLogo({ dark = false }: { dark?: boolean }) {
  return <div className={`logo ${dark ? 'dark-logo' : ''}`}><span>↗</span> Ledgerly</div>
}
