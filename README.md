# Anon Browser

Privacy browser with a built-in Bitcoin Vault.

**This repo is the Electron product trunk** — a real preview you can run and package. The next wave is an **engine bake-off** (Chromium is one candidate among several), not a forced Brave-core fork. See [`PLAN.md`](./PLAN.md).

**Marketing site** (anoncomputer.com): [`site/`](./site/) — download-first public page. No Coinclave tease.

```bash
npm install
npm start
```

```bash
cd site && npm install && npm run dev
```

Node 20+. Scripts unset `ELECTRON_RUN_AS_NODE` (required under Cursor).

## Features (v0.3, Wave 1)

- **Shields** — EasyList-class filtering (`@ghostery/adblocker`) with a local cache + weekly refresh, a curated scareware / fake-AV host list blocked even as full-page loads, and a per-site shields panel. HTTPS upgrade + DNT/GPC.
- **Bitcoin Vault** — real BIP84 (native segwit) wallet. Create a seed or import a mnemonic / xpub / zpub (watch-only). Seed is encrypted at rest (scrypt → AES-256-GCM, wrapped with the OS keychain via Electron `safeStorage`). Balance, transactions, receive address + QR, and on-chain send via mempool.space. Auto-locks after inactivity.
- **Browser basics** — downloads manager, find-in-page (`⌘F`), zoom, built-in PDF viewer, external-protocol prompts, bookmark import (Chrome/Brave JSON + Netscape HTML).
- **Windows** — normal / private / Tor.

## Package

```bash
npm run pack   # dist/mac-arm64/Anon.app
npm run dist   # dist/Anon-<version>.dmg
```

Bundles are branded (`Anon`, `computer.anon.browser`, baked `brand/icon.icns`). macOS signing/notarization needs Apple certs (currently ad-hoc, `identity: null`).

## Tor

`brew install tor && brew services start tor` (or Tor Browser `:9150`). Settings → Tor. `⌘⇧T` Tor window · `⌘⇧V` Vault · `⌘⇧J` Downloads.

## Vault networks

Settings → Vault switches new wallets between `mainnet` and `testnet` (uses mempool.space testnet). Existing wallets keep the network they were created with.

## Honest limits

- Electron ceiling (not a Chromium/Brave daily-driver fork — yet, and maybe never)
- Hot wallet risk class; clearnet mempool.space for chain data (see [`docs/03-threat-model.md`](./docs/03-threat-model.md))
- Not notarized for Gatekeeper-friendly stranger installs

**Next:** Wave 2 engine bake-off in `PLAN.md` — score Electron deepen / CEF / WebView / Gecko / Ladybird / hybrid with agents; pick by evidence.
