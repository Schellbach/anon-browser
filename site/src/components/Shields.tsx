export default function Shields() {
  return (
    <section className="section feature" id="shields">
      <div className="section-inner feature-inner">
        <div className="feature-copy">
          <h2 className="section-title">Shields up.</h2>
          <p className="section-lede">
            Ads and trackers are blocked before they load. Scareware pages too.
            Connections upgrade to HTTPS. You can turn Shields off for a site ⸻
            they’re on for everything else.
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
                <span>Scareware</span>
                <span>Blocked</span>
              </li>
              <li>
                <span>HTTPS</span>
                <span>On</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
