import { useEffect, useState } from 'react'
import AnonMark from './AnonMark'
import BrowserFrame from './BrowserFrame'
import { primaryDownload } from '../lib/downloads'

export default function Hero() {
  const [download, setDownload] = useState(primaryDownload('mac'))

  useEffect(() => {
    setDownload(primaryDownload())
  }, [])

  return (
    <section className="hero">
      <div className="hero-brand" aria-hidden="true">
        <AnonMark className="hero-mark" />
      </div>
      <div className="hero-copy">
        <p className="hero-brand-name">Anon</p>
        <h1 className="hero-title">The privacy browser.</h1>
        <p className="hero-lede">
          Private by default. Bitcoin built in.
        </p>
        <div className="hero-actions">
          <a href={download.href} className="btn btn-primary btn-lg">
            Download for {download.label}
          </a>
          <a href="#download" className="btn btn-ghost btn-lg">
            All platforms
          </a>
        </div>
      </div>
      <div className="hero-product">
        <BrowserFrame />
      </div>
    </section>
  )
}
