export default function BrowserFrame() {
  return (
    <div className="browser" aria-hidden="true">
      <div className="browser-titlebar">
        <div className="browser-traffic">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-tabs">
          <div className="browser-tab is-active">
            <span className="browser-tab-favicon" />
            <span>New Tab</span>
          </div>
        </div>
      </div>
      <div className="browser-toolbar">
        <div className="browser-nav">
          <span className="browser-nav-btn" />
          <span className="browser-nav-btn" />
          <span className="browser-nav-btn" />
        </div>
        <div className="browser-omnibox">
          <span className="browser-lock" />
          <span>Search or enter address</span>
        </div>
        <div className="browser-tools">
          <span className="browser-shields">
            <span className="browser-shields-count">Shields</span>
          </span>
        </div>
      </div>
      <div className="browser-content">
        <div className="browser-newtab">
          <div className="browser-search">
            <span>Search or enter address</span>
          </div>
        </div>
      </div>
    </div>
  )
}
