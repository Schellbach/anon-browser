import Logo from './Logo'
import { primaryDownload } from '../lib/downloads'

const links = [
  { href: '#shields', label: 'Shields' },
  { href: '#vault', label: 'Bitcoin Vault' },
  { href: '#privacy', label: 'Privacy' },
]

export default function Header() {
  const download = primaryDownload()

  return (
    <header className="header">
      <div className="header-inner">
        <Logo size={28} />
        <nav className="header-nav" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="header-link">
              {link.label}
            </a>
          ))}
        </nav>
        <a href={download.href} className="btn btn-primary header-cta">
          Download
        </a>
      </div>
    </header>
  )
}
