import { REPO_URL } from '../lib/downloads'
import Logo from './Logo'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Logo size={24} />
        <div className="footer-meta">
          <p>Anon Computer, Inc.</p>
          <p className="footer-muted">Privacy browser · Bitcoin Vault</p>
        </div>
        <div className="footer-links">
          <a href={REPO_URL} rel="noopener noreferrer">
            GitHub
          </a>
          <a href="#download">Download</a>
        </div>
      </div>
    </footer>
  )
}
