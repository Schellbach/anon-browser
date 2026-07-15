export default function Vault() {
  return (
    <section className="section feature feature-reverse" id="vault">
      <div className="section-inner feature-inner">
        <div className="feature-copy">
          <h2 className="section-title">Bitcoin Vault.</h2>
          <p className="section-lede">
            Create a seed or import a mnemonic, xpub, or zpub. Receive and send
            on-chain. Seed encrypted at rest, wrapped by the OS keychain.
          </p>
        </div>
        <div className="feature-visual vault-visual">
          <div className="vault-card">
            <div className="vault-card-head">
              <span>Bitcoin Vault</span>
              <span className="vault-badge">Hot wallet</span>
            </div>
            <p className="vault-balance-label">Receive</p>
            <p className="vault-balance vault-address">bc1q…anon</p>
            <p className="vault-note">
              Encrypted at rest · auto-locks
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
