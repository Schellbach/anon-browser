# Threat model

## Assets

- Browsing privacy (trackers, scareware redirects)
- Vault passphrase and BIP39 seed / account xpub
- Bitcoin balances and receive addresses

## Trust boundaries

### Preload & IPC isolation (Wave 1 hardening - v0.3+)

Three trust classes with separate preloads:

1. **Chrome UI** (`renderer/chrome.html` → `preload-chrome.js`): 
   - Navigation controls, tab management, find-in-page
   - IPC handlers check `isChromeSender()` (chrome webContents allowlist)
   - Can invoke: `nav:*`, `tabs:*`, `window:*`, `shields:panel`, `find:*`, `bookmarks:toggle`

2. **Internal pages** (`anon://` → `file://` → `preload-internal.js`):
   - Settings, vault, bookmarks, history, downloads, newtab, agent pages
   - IPC handlers check `isInternalSender()` (chrome + internal webContents allowlist)
   - Can invoke: vault APIs, settings read/write, bookmarks CRUD, history, downloads, Tor config
   - Wallet operations require additional passphrase (even from internal pages)

3. **Web content** (https/http/onion → `preload-content.js`):
   - **Minimal/empty preload**: No `anonVault`, `anonNav`, or `anonDownloads` exposed
   - Cannot read settings, bookmarks, tab state (which includes URLs + vault balance), or Tor status
   - Cannot invoke navigation, window, or vault APIs
   - Separate BrowserView per tab; each web tab gets content preload
   - Internal tabs get internal preload

**Deny-by-default IPC**: Handlers reject calls from non-allowlisted senders. Even if a malicious page guesses an IPC channel name, the main process refuses it.

**Per-tab views**: Each tab owns its own BrowserView with the appropriate preload. Tab state (form input, scroll, navigation history) survives tab switches.

### Peerd (AI agent harness) — not integrated

- Peerd (v0.2.2.7, Apache-2.0) compatibility was investigated; see `docs/04-peerd-compatibility.md`.
- Electron 35.7.5 can preserve Peerd's isolation model (MV3 service worker, keyless offscreen-worker heap, `scripting`, `tabs`, no-Node contexts), but **cannot run the unmodified store-safe artifact** because `chrome.sidePanel`/`action`/`commands`/`tabGroups`/`notifications` are unimplemented.
- Per the no-shim / no-premature-fork rules, integration is **stopped** and deferred to the engine bake-off. Until then: Peerd never loads; web/extension pages already receive no `anonVault` (content preload is minimal); Vault IPC stays gated to trusted internal WebContents.

### Vault & wallet

- Vault keys never in content process or agent context; seed decrypted only in the main process while unlocked, re-verified on each spend
- Seed encrypted at rest: **scrypt** (N=16384, r=8, p=1, ~100ms, ~16MB memory) → AES-256-GCM, additionally wrapped with the OS keychain via Electron `safeStorage` when available
- Vault file (`vault.json`) has restrictive permissions (mode 0600, user read/write only) on Unix-like systems
- Auto-lock after 15 minutes of inactivity
- Bitcoin amount parsing uses bigint-only arithmetic; no IEEE floats (rejects over-precision >8 decimals for BTC)

### Privacy

- Shields cancel tracker/ad requests (Ghostery engine + compact host blocklist) when enabled
- Compact blocklist: focuses on tracker subdomains and ad networks; does **not** block first-party social media sites (you can visit facebook.com, tiktok.com, etc.)
- Scareware/fake-AV hosts blocked even as main-frame loads
- Tor windows use SOCKS proxy (if available); clearnet windows do not
- Session isolation: normal / private / Tor modes use separate Electron sessions (cookies, storage, cache isolated)
- Fingerprint resistance (optional): strips client hints, sends DNT and GPC headers
- HTTPS upgrade (optional): auto-upgrades http:// → https:// for main frames (skips .onion and localhost)
- Optional LLM page-risk assist (future): local/user-gated; fail closed; no cloud exfil by default

## Chain privacy

**Current (Wave 1 - v0.3):**
- Wallet sync and broadcast go to `mempool.space` over the normal session (clearnet, **not Tor by default**)
- This **leaks wallet addresses and balance** to mempool.space and any network observers
- For meaningful privacy, use watch-only mode with a hardware wallet or external signer, or wait for Wave 2 Tor routing
- Gap-limit address scanning (BIP84 receive + change chains)

**Wave 2 roadmap:**
- Routing wallet Esplora traffic through Tor when available, or explicit Settings choice
- User-run Esplora endpoint option

## Known limits (Electron v0.3+)

- **Hot wallet = same risk class as any in-browser wallet**; for meaningful sums use hardware or watch-only xpub import
- **Wallet chain privacy**: mempool.space sees your addresses and balance (clearnet); Tor routing is Wave 2+
- **On-chain only** (no Lightning yet); no coin-control / labeling
- **No code signing / notarization / updater** yet (needs certs)
- **Blocklist coverage**: Compact list is fallback; Ghostery engine is primary. Not Brave-grade; MVP-level. Focus is on known trackers and scareware, not exhaustive ad blocking.
- **Electron/Chromium fingerprinting**: Not Brave-grade yet; basic resistance (client hint stripping, DNT/GPC)

## Coinclave

On appliance builds, prefer watch-only browser wallet; spends go through the Vault app.
