export default function Shields() {
  return (
    <section className="section feature" id="shields">
      <div className="section-inner feature-inner">
        <div className="feature-copy">
          <h2 className="section-title">Shields on by default.</h2>
          <p className="section-lede">
            EasyList-class filtering, HTTPS upgrades, and a scareware blocklist
            for fake antivirus landers. Per-site controls when you need them.
          </p>
        </div>
        <div className="feature-visual shields-visual">
          <div className="shields-panel">
            <div className="shields-panel-head">
              <span>Shields</span>
              <span className="shields-toggle is-on">On</span>
            </div>
            <ul className="shields-list">
              <li>
                <span>Ads &amp; trackers</span>
                <span>Blocked</span>
              </li>
              <li>
                <span>HTTPS upgrade</span>
                <span>On</span>
              </li>
              <li>
                <span>Scareware hosts</span>
                <span>Blocked</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
