export default function Privacy() {
  return (
    <section className="section feature" id="privacy">
      <div className="section-inner feature-inner">
        <div className="feature-copy">
          <h2 className="section-title">Normal. Private. Tor.</h2>
          <p className="section-lede">
            Private windows leave no history. Tor windows use your local SOCKS
            proxy and fail closed if Tor isn’t running.
          </p>
        </div>
        <div className="feature-visual privacy-visual">
          <div className="window-modes">
            <div className="window-mode">
              <span className="window-mode-label">Normal</span>
              <span className="window-mode-desc">Daily browsing</span>
            </div>
            <div className="window-mode is-private">
              <span className="window-mode-label">Private</span>
              <span className="window-mode-desc">No history</span>
            </div>
            <div className="window-mode is-tor">
              <span className="window-mode-label">Tor</span>
              <span className="window-mode-desc">Fail closed</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
