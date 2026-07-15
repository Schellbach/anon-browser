# Peerd compatibility — investigation & decision

**Status:** Investigation complete. Implementation **stopped at the decision gate** per the task's "stop rather than weaken" rule. Peerd compatibility is now an **engine-bake-off requirement**, not a live feature.

**Target:** Peerd v0.2.7, commit `0ce8e1ee74c63162e26e1eb5630d804559880871`, Apache-2.0.
**Target artifact:** the **store-safe** Chromium profile (`manifests/base.json` + `store.patch.json`, `debugger` stripped, `peerd-distributed`/dweb removed) — *not* the checked-in `extension/manifest.json` dev profile.
**Probe host:** Electron 35.7.5 (Anon's current engine), via a runnable MV3 probe extension + harness at `../peerd-probe/` (outside product source). Evidence: `../peerd-probe/probe-results.json`.

---

## 1. What "store-safe Peerd" requires

From `manifests/base.json` (store channel = base + `store.patch.json`; `gen-manifest.ts` strips `debugger` and the dweb module for store):

- `background.service_worker` (MV3 service worker, module)
- `permissions`: `storage`, `unlimitedStorage`, `sidePanel`, `scripting`, `tabs`, `tabGroups`, `activeTab`, `idle`, `offscreen`, `notifications`, `alarms` (store drops `debugger`)
- `host_permissions`: `<all_urls>`
- `side_panel.default_path` → `sidepanel/sidepanel.html` (Peerd's **primary UI**)
- `sandbox.pages` → `engine-tabs/app-tab/runner.html`
- `content_security_policy.extension_pages`: `script-src 'self' 'wasm-unsafe-eval' ...`
- `cross_origin_embedder_policy: require-corp`, `cross_origin_opener_policy: same-origin`
- Web platform in extension/offscreen pages: Web Workers, WASM, OPFS, IndexedDB, WebAuthn PRF

Peerd's security model (from `SECURITY.md`): a privileged **service worker**; a **keyless offscreen document** that runs page-reading actors in **separate worker heaps** (untrusted content never reaches the main agent or provider credentials); **centralized egress gates** with SSRF/redirect/sensitive-origin/audit enforcement; provider credentials in an encrypted vault with exact-origin egress.

---

## 2. Capability matrix (Electron 35.7.5, probed)

Legend: ✓ present & functional · ✗ absent (probed) · ⚠ partial/conditional

| Capability | Required by Peerd | Electron 35.7.5 | Probe evidence |
|---|---|---|---|
| MV3 `service_worker` background | privileged service context | ✓ runs | SW reported `hasServiceWorkerGlobalScope:true`, `hasChrome:true`, fired `activate`, created alarm |
| `chrome.offscreen.createDocument` | keyless actor heap | ✓ works | SW `offscreenCreate:"ok"`; offscreen WebContents loaded |
| **Workers inside offscreen doc** | keyless actor heap | ✓ works | harness `executeJavaScript` on offscreen WebContents: `workerRan:true`, message echoed, `crossOriginIsolated:true` |
| `chrome.scripting.executeScript` | page automation | ✓ works | executed in a real tab, returned `document.title` = `"peerd-test-target"` |
| `chrome.tabs.query` | tab enumeration/targeting | ✓ works | enumerated 3 tabs (offscreen, probe, test page) |
| `chrome.storage` / `unlimitedStorage` | extension storage | ✓ present | `storage` object exposed |
| `chrome.alarms` | scheduling | ✓ present | alarm created |
| `chrome.idle` | idle detection | ✓ present | object exposed |
| `chrome.runtime` | lifecycle | ✓ present | object exposed |
| WASM (`wasm-unsafe-eval`) | extension pages | ✓ works | `WebAssembly` present; CSP honored |
| OPFS / IndexedDB | local storage | ✓ works | both present |
| WebAuthn PRF | key derivation | ✓ works | `getClientCapabilities` present |
| COOP/COEP isolation | cross-origin isolation | ✓ works | `crossOriginIsolated:true` |
| Web/Shared/Service Workers | actor heaps | ✓ present | all present in extension pages |
| WebRTC | (deferred P2P) | ✓ present | gated off by policy; deferred |
| No Node / FS in extension contexts | isolation | ✓ | contextIsolation + `nodeIntegration:false`; extension pages have no Node |
| **`chrome.sidePanel` + `side_panel` key** | **primary UI** | **✗ absent** | `typeof chrome.sidePanel` = `undefined` (SW + page); load warning: `Permission 'sidePanel' is unknown` |
| `chrome.action` | toolbar toggle | ✗ absent | `undefined` (Peerd's MV3 action button) |
| `chrome.commands` | "pull-in-peerd" shortcut | ✗ absent | `undefined` |
| `chrome.tabGroups` | tab grouping | ✗ absent | `undefined`; `Permission 'tabGroups' is unknown` |
| `chrome.notifications` | user notifications | ✗ absent | `undefined`; `Permission 'notifications' is unknown` |
| `chrome.declarativeNetRequest` / `cookies` / `webNavigation` | (not required by store) | ✗ absent | `undefined` |

Note: fetch from an offscreen document to `http://` is restricted (offscreen reports never arrived via fetch), but **workers and scripts in the offscreen doc execute normally** — proven by direct `webContents.executeJavaScript` on the offscreen WebContents. The keyless heap is real.

---

## 3. Decision gate

| Gate criterion (from task) | Verdict on Electron 35.7.5 |
|---|---|
| Stable, independent page/tab identities | **Now satisfied on `main`** (PR #1): each tab owns its own `BrowserView` with the appropriate preload; tab state survives switches. (Earlier note about a shared BrowserView is obsolete.) |
| A real keyless actor heap for untrusted page content | **Preservable** — offscreen doc + workers run, `crossOriginIsolated`. |
| A privileged service context inaccessible to web content | **Preservable** — MV3 service worker runs. |
| Centralized egress and permission enforcement | **Preservable** — Peerd's own SW/offscreen logic; host APIs present. |
| Complete exclusion from internal/private/Tor/Vault | **Preservable** — via gating + trusted-context IPC (Phase 2). |
| No Node or filesystem access from Peerd contexts | **Preservable** — extension contexts have no Node. |

**The isolation model is preservable on Electron.** The gate does **not** fail on security-model grounds.

---

## 4. Why implementation still stops

The task's preferred hierarchy requires, in order: (1) run the **unmodified** store-safe artifact; (2) small **upstreamable** host adapters; (3) a narrow Anon compat layer **outside** Peerd; (4) a minimal patch set; (5) no broad fork unless 1–4 are impossible. It also mandates: load **only a verified Peerd package/checkout**, **no shims**, and "a side panel rendering is not sufficient to claim Peerd compatibility."

On Electron 35.7.5 the **unmodified store artifact cannot run**:

- `chrome.sidePanel` and the `side_panel` manifest key are **not implemented** (rejected as an "unknown permission" at load). Peerd's entire UI is the side panel.
- `chrome.action`, `chrome.commands`, `chrome.tabGroups`, `chrome.notifications` are **absent**; `tabGroups`/`notifications` are also rejected as "unknown permissions."

You cannot "adapter" a missing host API into existence. Options 2–3 cannot conjure `chrome.sidePanel`/`chrome.action`. Reaching a working integration therefore requires **option 4 — patching Peerd** to drop/replace `sidePanel`/`action`/`commands`/`tabGroups`/`notifications` (e.g., render the panel in an Anon-owned `BrowserView`, use Anon-native notifications). A patched Peerd is **neither the verified store package nor a clean checkout**, which conflicts with the hard constraint "load only a verified Peerd package or development checkout," and with "do not create a broad fork unless every earlier option is proven impossible." A side-panel-only render is explicitly disallowed as a compatibility claim.

**Note on prerequisites already satisfied:** PR #1 (`wave1-security-hardening`, now on `main`) landed the Phase-2/3 groundwork this task called for — three trust-class preloads with deny-by-default IPC, a minimal/empty web-content preload (no `anonVault`/`anonNav`/`anonDownloads` on web pages), and per-tab `BrowserView` with surviving state. So the *isolation* prerequisites for Peerd are met; the sole remaining blocker is the missing **extension-API surface** (`sidePanel`/`action`/`commands`/`tabGroups`/`notifications`), which is an engine limitation, not an Anon boundary weakness.

Per the task's overriding rule — *do not conceal limitations with shims; stop rather than weaken the model* — the correct action is to **stop**, record evidence, and convert Peerd compatibility into an **engine-bake-off requirement**. We do **not** patch/fork Peerd now and do **not** ship a shim.

---

## 5. Chosen architecture (for the future engine that passes)

When an engine candidate implements the missing API surface, the integration architecture is:

- `src/compat/peerd/` loads **only** the verified store artifact into the **normal** session, pinned by extension ID + version + commit + package hash.
- Disabled by default behind a Labs/Experimental setting with an immediate kill switch; absent from private/Tor/internal/Vault.
- Preload/IPC isolation and per-tab views are **already in place on `main`** (PR #1): web/extension pages get no `anonVault`; Vault IPC is gated to trusted internal WebContents by exact identity + route.
- Anon host enforces: only `http/https` tabs; deny `anon:`, `file:`, `chrome:`, foreign `chrome-extension:`, `devtools:`, `data:`; deny private/Tor enumeration; revoke grants on disable; redacted local audit log.
- Peerd's own offscreen keyless heap, egress gates, and encrypted provider vault are preserved unmodified.
- No Anon telemetry, no Peerd cloud, no remote code, no generic extension loader.

---

## 6. Engine-bake-off requirement (added to PLAN Wave 2)

A candidate engine must pass **all** of:

1. Everything Electron 35.7.5 already provides (MV3 SW, `offscreen`+workers, `scripting`, `tabs`, `storage`/`unlimitedStorage`, `alarms`, `idle`, COOP/COEP, WASM, OPFS, WebAuthn PRF, no-Node contexts).
2. **`chrome.sidePanel` + `side_panel` manifest key** (Peerd's primary UI) — the differentiator Electron fails.
3. `chrome.action`, `chrome.commands`, `chrome.tabGroups`, `chrome.notifications`.
4. Stable per-tab identities with live session state (Anon Phase-3 refactor, engine-independent).
5. A privileged service context and a keyless offscreen-worker heap, both unreachable by web content.

Score each candidate (Electron-deepen, CEF/embedded Chromium, system WebView, Gecko fork, Ladybird, Servo, hybrid) on this list. **Chromium-based candidates (CEF / a Brave-core fork) are the most likely to satisfy 2–3** because the APIs originate there; Electron's stripped extension surface is the specific gap.

---

## 7. Deferred capabilities (unchanged from task)

WebRTC/P2P and distributed agents · WebVM/CheerpX · generic extension support · unattended routines · agent operation in private/Tor · any Bitcoin-related agent capability · public marketing claims.

---

## 8. Honest verdict

This is an **architectural spike, not "Peerd Core compatible."** The security model is preservable on Electron, but the unmodified verified store artifact cannot run because of a missing extension-API surface (`sidePanel`/`action`/`commands`/`tabGroups`/`notifications`). Per the task's no-shim / no-premature-fork rules, implementation is stopped and Peerd compatibility is deferred to the engine bake-off.
