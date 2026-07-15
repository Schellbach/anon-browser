# Threat model

## Assets

- Browsing privacy (trackers, scareware redirects)
- Vault passphrase and BIP39 seed / account xpub
- Bitcoin balances and receive addresses

## Trust boundaries

- Chrome UI ≠ web content (separate preloads; sensitive IPC gated to `file://` internal pages)
- Vault keys never in content process or agent context; seed decrypted only in the main process while unlocked, re-verified on each spend
- Seed encrypted at rest: scrypt-derived key → AES-256-GCM, additionally wrapped with the OS keychain via Electron `safeStorage` when available
- Shields cancel tracker/ad requests (filter engine + host list) when enabled; scareware/fake-AV hosts are blocked even as main-frame loads
- Tor windows use SOCKS; clearnet windows do not
- Optional LLM page-risk assist (future): local/user-gated; fail closed; no cloud exfil by default

## Chain privacy

- Wallet sync and broadcast go to mempool.space over the normal session (clearnet). This reveals wallet addresses to that endpoint. Routing wallet traffic through Tor / a user-run Esplora is a Wave 2+ item.
- Gap-limit address scanning (BIP84 receive + change chains).

## Known limits (Electron v0.3)

- Hot wallet = same risk class as any in-browser wallet; for meaningful sums use hardware or watch-only xpub import
- On-chain only (no Lightning yet); no coin-control / labeling
- No code signing / notarization / updater yet (needs certs)
- Filter lists refresh from the network; if unavailable, falls back to the compact host list
- Electron/Chromium fingerprinting parity is not Brave-grade yet

## Coinclave

On appliance builds, prefer watch-only browser wallet; spends go through the Vault app.
