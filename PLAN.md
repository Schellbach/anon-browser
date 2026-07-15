# Anon Browser — Build Plan (agent handoff)

**Status:** Wave 1 Electron app is shippable. Wave 2 = engine bake-off — Chromium is one option, not destiny.  
**Codename:** Anon Browser  
**Workspace:** `/Users/ras/.cursor/plans/anonbrowser`  
**Related:** [Coinclave](../coinclave/) (appliance / bank — separate product), [anoncomputer.com](https://anoncomputer.com)

---

## 1. Thesis

**Anon is a standalone privacy browser with a built-in Bitcoin Vault — shipping on Electron now; engines chosen by bake-off, with frontier agents as leverage, not as the pitch.**

Users should get:

- A real app they can install and try (Wave 1 Electron)
- Shields that stop trackers / scareware redirects
- A real Bitcoin Vault (receive / send / watch-only) — amounts in Coin Standard (¢ / ₿)
- Anon brand (annona mark)

**Not** an “AI browser.” **Not** a Coin Standard marketing vehicle. LLMs/agents are **build leverage**. The product is: **private browser + Bitcoin Vault**.

**Why Electron on GitHub is justified:** this is the **current product** — Vault, shields, Tor windows, packaging — while a parallel **engine portfolio** finds what agents can keep green without marrying Chromium rebase risk early.

---

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Category | Standalone privacy browser with Bitcoin Vault (Origin-*shaped* UX, not Brave-locked) |
| Business model | Free to use; no BAT / Rewards / attention token (internal constraint, not the pitch) |
| Money UX | Integer coins on-chain; UI uses Coin Standard (¢ / ₿) via `vault/coins.js` |
| Brand | Anon / annona mark; copper `#C17F59`, seal green `#3D8B6E` — use sparingly; chrome stays utilitarian |
| Engine path | **Current:** Electron Wave 1 (this repo). **Next:** multi-engine bake-off. Chromium/Brave-core is *a candidate*, not the only exit. |
| Bake-off candidates | Electron deepen · CEF/embedded Chromium · system WebView · Gecko fork · Ladybird · Servo experiments · hybrid (hard pages on borrow-engine, Anon chrome + Vault owned) |
| Score bake-off on | Real-site load · Vault key isolation · agent-maintainability week-to-week · privacy controls · packaging cost |
| Vault v1 | Hot wallet / watch-receive in browser; Coinclave Vault app remains the bank for keys on appliance |
| Agent surface | Discreet toolbar stub OK; **not** the marketing pitch; keys never in agent context |
| Search | Silent private search backend; UI says only “Search” |
| Telemetry | Off by default; no P3A-style ping in Anon builds |
| Out of scope | Camoufox / anti-detect; BAT/Rewards clone; agent-harness as product identity; Coin Standard as product identity; declaring one engine “forever” before bake-off |

---

## 3. Coinclave boundary

| Surface | Role |
|---|---|
| Anon Browser (laptop) | Daily privacy browser; hot/watch Vault |
| Anon Browser on Sanctum | Human web chrome + shields |
| Coinclave Vault app | Bank — keys, LN, Fedimint, spend policy |
| Hunter | Outbound agent plane — **never** holds keys |

Browser content process must never see seed material. Agent plane (if any) is keyless.

---

## 4. What exists today (v0.3 Electron — Wave 1 done)

Working shell in this repo (`npm start` → `env -u ELECTRON_RUN_AS_NODE electron .`):

- Multi-window: normal / private / Tor (SOCKS to external `tor` or Tor Browser)
- Tabs, omnibox, bookmarks bar, history, settings
- **Real shields:** EasyList-class engine (`@ghostery/adblocker`, uBO/Brave filter family) with a local cache + weekly refresh; compact host list + curated scareware/fake-AV host list as main-frame block + fallback; per-site shields popup panel
- **Bitcoin Vault:** BIP84 (native segwit) hot wallet or watch-only xpub/zpub import; seed encrypted at rest (scrypt→AES-256-GCM, wrapped with OS keychain via `safeStorage`); balance/txs/receive+QR via mempool.space Esplora; on-chain send with fee estimate + coin selection; auto-lock; amounts as ¢ / ₿ via `formatCoin`/`parseCoinInput`
- **Browser basics:** downloads manager (progress/cancel/open/reveal), find-in-page, zoom, built-in PDF viewer, external-protocol prompt, bookmark import (Chrome/Brave JSON + Netscape HTML)
- **Packaged:** `npm run pack` → `dist/mac-arm64/Anon.app` (baked `icon.icns`, `computer.anon.browser`); `npm run dist` → `.dmg`. Dev Dock brand script still patches unpackaged runs
- Sensitive IPC (vault/settings/history/downloads) gated to `file://` internal pages only
- Toolbar: Vault + Agent (stub) + Shields panel

**Known gaps (for Wave 2+):** Electron ceiling vs real Chromium; macOS signing/notarization uses ad-hoc identity (`identity: null`) until certs exist; Lightning not wired (on-chain only); send is main-process hot-key signing (fine for hot wallet, appliance routes to Vault app).

---

## 5. Frontier LLM leverage (how we cheat the hard problems)

Use coding agents + frontier models to compress work that used to need specialists. Prefer **local, inspectable, deterministic runtime** with LLM help in the loop — not “cloud AI decides privacy.”

| Hard problem | Traditional cost | LLM leverage |
|---|---|---|
| Filter / scareware quality | EasyList maintainers + security team | Generate + triage filter rules from redirect graphs / known lander patterns; propose blocklist diffs; human/CI accept |
| Phishing / fake AV pages | Heuristic + Safe Browsing | On-device or optional local classifier: “is this a scareware interstitial?” → block / warn; never auto-download |
| Chromium / Brave rebase | Full-time browser eng | Agent-assisted patch porting, conflict resolution, GN flag audit when compiling out Rewards/Leo |
| Extension / site compat | QA farm | Agent-driven Playwright suites; failure → minimal fix PRs |
| Import (Chrome/Brave/Firefox) | Parsers + edge cases | Generate importers + golden fixtures from sample export blobs |
| Vault UX | Design + wallet eng | Coin Standard (¢ / ₿) via `vault/coins.js`; BIP21 wire amounts unchanged |
| Threat model / release notes | Docs burden | Keep `docs/03-threat-model.md` honest; agent updates when features land |
| Packaging / CI | Release eng | electron-builder → later Chromium CI matrices authored by agent from templates |

**Rules for agents building this:**

1. Privacy defaults win over convenience features.
2. Money UI is Coin Standard (¢ / ₿) via `vault/coins.js` — no rewards tokens, no alternate units.
3. Never put keys in renderer content or agent context.
4. Prefer boring Chromium/Electron APIs over novel frameworks.
5. Every wave ships something a user can click (signed build, shield win, or receive coins) — not only docs.
6. When using LLMs at **runtime**, fail closed; user can disable; no cloud exfil of page content by default.

---

## 6. Build waves (handoff order)

### Wave 0 — Hygiene ✅ done

- [x] Document run/packaging in README; keep `ELECTRON_RUN_AS_NODE` unset in scripts
- [x] Expand scareware/redirect hosts from real incidents into `privacy/blocklist.js` (`BADWARE_HOSTS`)
- [x] Smoke checklist: newtab, shields toggle, private, Tor, Vault create/unlock, Agent stub

### Wave 1 — Viable Electron product ✅ done

Goal: someone can download Anon and use it as a Bitcoin privacy browser preview.

1. **Shields that matter** ✅
   - [x] EasyList-class engine (`@ghostery/adblocker`) with local cache + weekly refresh; compact list + scareware host list as fallback/main-frame block
   - [x] Per-site shields panel (BrowserWindow popup, not just a counter)
   - [ ] LLM-assisted rule suggestions → reviewed into repo lists (deferred to Wave 3 runtime assist)

2. **Bitcoin Vault** ✅
   - [x] BIP84 seed wallet + import mnemonic/xpub/zpub (watch-only); receive address + BIP21 `bitcoin:` URI + QR
   - [x] Display as Coin Standard (¢ / ₿) via `formatCoin` / `parseCoinInput`
   - [x] "Hot wallet" labeling; passphrase (scrypt→AES-GCM) + OS keychain (`safeStorage`)
   - [x] Send path on-chain (mempool.space); Lightning later or via Coinclave handoff

3. **Installable app** ✅
   - [x] electron-builder: macOS `.app`/`.dmg`, `productName: Anon`, baked `brand/icon.icns`
   - [ ] Signing/notarization + auto-update (needs Apple certs — `identity` currently null)
   - [x] Dock plist hack now dev-only; packaged bundle is self-branded

4. **Browser basics** ✅
   - [x] Downloads UI, find-in-page, zoom, PDF, external protocol prompts
   - [x] Import bookmarks (Chrome/Brave JSON + Netscape HTML)

5. **Tor** ✅
   - [x] Detect SOCKS; fail closed to Settings (with install hint), not a blank scare

**Exit criteria Wave 1:** ✅ packaged build (notarize-ready pending certs); shields use real filter lists + block known scareware landers; Vault shows a real receive address and on-chain balance; README one-command run for testers.

### Wave 2 — Engine bake-off (portfolio, agent-driven)

Goal: keep **more than one** engine option alive; pick a successor (or hybrid) by evidence — not by Chromium destiny.

Electron remains the **public product** until a candidate beats it on the scorecard below.

| Candidate | Hypothesis | Kill criteria |
|---|---|---|
| Deepen Electron | Ceiling is acceptable for Bitcoin-privacy niche | Sites/privacy users need can’t clear |
| CEF / embedded Chromium | Chromium render without full Brave fork | Rebase/CVE cost ≈ full fork |
| System WebView | Tiny shell, OS-updated engine | Privacy controls too weak |
| Gecko fork | Non-Google engine story | Fork treadmill not agent-sustainable |
| Ladybird | Independent engine; agents + tests push coverage | Can’t load target site set in N weeks |
| Servo + chrome | Experimental layout path | Never reaches browse+Vault demo |
| Hybrid | Borrow engine for hard pages; own chrome+Vault | Architecture too complex to ship |

1. Define a small **compat corpus** (news, search, mempool, exchanges, docs) + Vault isolation checklist
2. Stand up thin spikes (agent-built) for 2–3 candidates in parallel
3. Weekly score: site pass rate · Vault boundary · CI green · human hours vs agent hours
4. Optional Chromium/Brave-core spike only if bake-off shows embedded Chromium wins *and* rebase is affordable
5. Do **not** freeze Electron until a successor ships an installable nightly with Vault entrypoint

**Exit criteria Wave 2:** written bake-off report + chosen path (or “stay Electron”); if leaving Electron, installable nightly on the winner with Anon Vault entrypoint.

### Wave 3 — Feature-rich private daily driver (on winning engine)

- Extensions / password policy / sync — only after engine choice
- Fingerprint resistance defaults (honest docs — no Camoufox claims)
- Optional local “page risk” assist — user-gated, no cloud by default
- Coinclave Sanctum: watch-only browser wallet; spend via Vault app
- Keep Electron preview as legacy if the product moves to another engine

### Wave 4 — Coinclave + Hunter

- Appliance builds disable hot seed; route to Vault app
- Hunter uses browser as web surface only; never keys
- Agent toolbar may wire to local/runtime later — still not the product name

---

## 7. Architecture (target)

```
┌─────────────────────────────────────────────────────────┐
│  Anon chrome (tabs, omnibox, shields, vault, agent)     │
├─────────────────────────────────────────────────────────┤
│  Privacy session                                        │
│   • filter engine (lists + per-site)                    │
│   • HTTPS upgrade, DNT/GPC                              │
│   • Tor partition (SOCKS)                               │
│   • optional local risk heuristics / LLM assist         │
├─────────────────────────────────────────────────────────┤
│  Content (untrusted)     │  Vault process (keys)        │
│  web pages               │  passphrase / seed / xpub    │
│  no key access           │  ¢ / ₿ display               │
└─────────────────────────────────────────────────────────┘
         │                              │
         │                              ▼
         │                     Coinclave Vault app (bank)
         ▼
    clearnet / .onion
```

**This app** implements that in Electron (BrowserView + main-process vault).  
**Bake-off winners** must map the same boundaries onto whatever engine is chosen (content untrusted; Vault privileged; no keys in agent context).

---

## 8. Repo map (for coding agents)

| Path | Role |
|---|---|
| `src/main.js` | Windows, tabs, IPC, menu, shields panel, downloads/find/zoom |
| `src/privacy-session.js` | Session shields / HTTPS / Tor proxy / permissions |
| `src/filter-engine.js` | EasyList-class engine load/cache/refresh + match |
| `src/wallet.js` | **Real BIP84 wallet** — seed/xpub, encryption, Esplora sync, send |
| `src/downloads.js` | Download item tracking |
| `src/bookmark-import.js` | Chrome/Brave JSON + Netscape HTML parser |
| `vault/coins.js` | Coin Standard (¢ / ₿) parse + format |
| `privacy/blocklist.js` | Compact host list + `BADWARE_HOSTS` scareware list |
| `renderer/*` | Chrome + internal pages (vault, downloads, shields-panel, …) |
| `brand/` | annona mark, `icon.png` / `icon.icns`, fonts |
| `scripts/brand-electron-app.js` | Dev Dock name/icon for unpackaged runs |
| `docs/01-product.md` | Product brief |
| `docs/02-llm-leverage.md` | How LLMs are used (not the pitch) |
| `docs/03-threat-model.md` | Threat model (keep honest) |

---

## 9. Definition of done (user-facing)

A prospective user can:

1. Install Anon without Node
2. Browse with shields that block trackers and common scareware redirects
3. Open Vault, see balance/receive in ¢ or ₿, fund a real address
4. Open a Tor window when Tor is available
5. Never see BAT, Rewards, or ad-network upsells
6. Trust that agent features (if any) cannot spend without Vault policy

---

## 10. Agent execution notes

When a coding harness picks this up:

1. **Electron app first** — polish Wave 1 gaps (DMG, destroy-wallet UI, signing when certs exist). Public GitHub is intentional.
2. **Wave 2 = bake-off spikes**, not “bootstrap Brave-core by default.”
3. Prefer vertical slices users can click; for engines, prefer scored spikes over manifesto forks.
4. Keep UI deslopped: utilitarian chrome, no marketing landing pages in-app.
5. Run with `env -u ELECTRON_RUN_AS_NODE` on macOS under Cursor.
6. Do not commit secrets; do not weaken Tor/Vault isolation for demo convenience.
7. Never put keys or seed material in any LLM/agent context.

---

## 11. Phase status

| Phase | Status |
|---|---|
| 0 Spec + brand | Done |
| 0.1 Electron MVP | Done |
| 0.2 Private / bookmarks / history / Tor / deslop | Done |
| 1 Viable Electron app (shields + vault + package) | **Done — public product preview** |
| **2 Engine bake-off (portfolio)** | **Next** |
| 3 Feature-rich daily driver (on winner) | After bake-off |
| 4 Coinclave Sanctum / Hunter | Later |
