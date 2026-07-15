const mechanics = [
  {
    title: 'Private windows',
    body: 'When you want a clean slate. Nothing left behind when you close it.',
  },
  {
    title: 'Tor windows',
    body: 'When you need the Tor network. If Tor isn’t running, Anon won’t pretend ⸻ it stops.',
  },
  {
    title: 'Sensors stay off',
    body: 'Camera, microphone, and location ask first. They don’t get a free pass.',
  },
  {
    title: 'Search is just Search',
    body: 'No brand parade in the address bar. Private search on the open web. Onion search when you’re on Tor.',
  },
  {
    title: 'We don’t track you',
    body: 'No product analytics. Your browsing isn’t our business model.',
  },
]

export default function Privacy() {
  return (
    <section className="section privacy" id="privacy">
      <div className="section-inner">
        <h2 className="section-title">Privacy that stays out of the way.</h2>
        <p className="section-lede privacy-lede">
          Anon is built so the page you’re on can’t reach into the rest of your
          life. Here’s how that feels day to day.
        </p>
        <ol className="how-list">
          {mechanics.map((item) => (
            <li key={item.title} className="how-item">
              <h3 className="how-title">{item.title}</h3>
              <p className="how-body">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
