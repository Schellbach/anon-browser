# Anon Browser

Privacy browser with a built-in Bitcoin Vault.

**This repo is the current Anon Browser app** — a real preview you can run and package. The next wave is an **engine bake-off** (Chromium is one candidate among several), not a forced Brave-core fork. See [`PLAN.md`](./PLAN.md).

```bash
npm install
npm start
```

```bash
cd site && npm install && npm run dev
```

Node 22.12+. Scripts unset `ELECTRON_RUN_AS_NODE` (required under Cursor).
The desktop runtime is pinned to **Electron 43.1.1 / Chromium 150**; weekly
Dependabot checks keep Electron updates visible.

```bash
npm test   # unit suite + real Electron runtime smoke
```

## Features (v0.3, Wave 1)

- **Shields** — EasyList-class filtering (`@ghostery/adblocker`) with a local cache + weekly refresh, a curated scareware / fake-AV host list blocked even as full-page loads, and a per-site shields panel. HTTPS upgrade + DNT/GPC.
- **Bitcoin Vault** — real BIP84 (native segwit) wallet. Create a seed or import a mnemonic / xpub / zpub (watch-only). Seed is encrypted at rest (scrypt → AES-256-GCM, wrapped with the OS keychain via Electron `safeStorage`). Balance, transactions, receive address + QR, and on-chain send via mempool.space. Auto-locks after inactivity.
- **Browser basics** — downloads manager, find-in-page (`⌘F`), zoom, built-in PDF viewer, external-protocol prompts, bookmark import (Chrome/Brave JSON + Netscape HTML).
- **Windows** — normal / private / Tor.

## Package

```bash
npm run pack        # unpackaged app dir under dist/
npm run dist:mac    # unsigned Apple Silicon DMG + zip (run on macOS)
npm run dist:linux  # Linux x64 AppImage + tar.gz
```

Bundles are branded (`Anon`, `computer.anon.browser`, baked `brand/icon.icns`).
Full packaging and release docs: [`docs/05-packaging.md`](./docs/05-packaging.md).

### Publish a GitHub Release (unsigned preview)

```bash
git tag v0.3.0
git push origin v0.3.0
```

That runs **Preview release** and attaches macOS (unsigned) + Linux artifacts to
the GitHub Release. macOS builds are **not notarized** until Apple Developer
credentials exist — see [`docs/04-macos-release.md`](./docs/04-macos-release.md).

## Tor

`brew install tor && brew services start tor` (or Tor Browser `:9150`). Settings → Tor. `⌘⇧T` Tor window · `⌘⇧V` Vault · `⌘⇧J` Downloads.

## Vault networks

Settings → Vault switches new wallets between `mainnet` and `testnet` (uses mempool.space testnet). Existing wallets keep the network they were created with.

## Honest limits

- Electron ceiling (not a Chromium/Brave daily-driver fork — yet, and maybe never)
- Hot wallet risk class; clearnet mempool.space for chain data (see [`docs/03-threat-model.md`](./docs/03-threat-model.md))
- Reduced Chromium user agent removes the Electron token, but does not make the runtime indistinguishable from Chrome or Brave
- Current Mac downloads are unsigned/unnotarized until Apple Developer enrollment is complete (Linux AppImage has no Apple Gatekeeper step)

**Next:** Wave 2 engine bake-off in `PLAN.md` — score Electron deepen / CEF / WebView / Gecko / Ladybird / hybrid with agents; pick by evidence.

## License

Anon Browser's source code is available under the [MIT License](./LICENSE).
Third-party components remain subject to their respective licenses.

The Anon names, wordmarks, annona mark, application icons, and related branding
are not licensed for confusing or endorsement-implying use. See
[TRADEMARKS.md](./TRADEMARKS.md).
