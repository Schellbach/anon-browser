import { useEffect, useState } from 'react'
import { DOWNLOADS, REPO_URL, VERSION, primaryDownload } from '../lib/downloads'
import type { DownloadOption } from '../lib/downloads'

export default function Download() {
  const [primary, setPrimary] = useState<DownloadOption>(primaryDownload('mac'))

  useEffect(() => {
    setPrimary(primaryDownload())
  }, [])

  const available = DOWNLOADS.filter((item) => item.available)

  return (
    <section className="section download" id="download">
      <div className="section-inner download-inner">
        <h2 className="section-title">Download Anon.</h2>
        <p className="section-lede">
          macOS Apple Silicon. Open source on GitHub.
        </p>
        <a href={primary.href} className="btn btn-primary btn-lg download-primary">
          Download for {primary.label}
        </a>
        <p className="download-version">v{VERSION}</p>
        {available.length > 1 && (
          <ul className="download-platforms">
            {available.map((item) => (
              <li key={item.id}>
                <a href={item.href} className="download-platform is-available">
                  <span className="download-platform-label">{item.label}</span>
                  <span className="download-platform-detail">{item.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="download-source">
          <a href={REPO_URL} rel="noopener noreferrer">
            Source on GitHub
          </a>
        </p>
      </div>
    </section>
  )
}
