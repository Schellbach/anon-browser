# Packaging and releases

Anon Browser uses [electron-builder](https://www.electron.build/) to produce
desktop installers. Wave 1 ships **unsigned preview** builds so
[GitHub Releases](https://github.com/Schellbach/anon-browser/releases) are not
empty while Apple Developer enrollment is pending.

## What you can download today

| Platform | Artifact | Signed? |
|---|---|---|
| macOS Apple Silicon | `Anon-<version>-arm64-mac.dmg` / `.zip` | No (Gatekeeper warn) |
| Linux x64 | `Anon-<version>-x86_64-linux.AppImage` / `Anon-<version>-x64-linux.tar.gz` | N/A |
| Windows | — | Not yet |

Unsigned macOS builds are a **preview**. Users must right-click → Open (or clear
quarantine) the first time. Do not market them as notarized.

## Local builds

Requires Node 22.12+.

```bash
npm ci
npm test          # unit + Electron smoke (Electron smoke needs a display / macOS CI)
npm run pack      # unpackaged dir under dist/
```

### Linux (this works on Linux CI and most Linux desktops)

```bash
npm run dist:linux
# → dist/Anon-0.3.0-x86_64-linux.AppImage
# → dist/Anon-0.3.0-x64-linux.tar.gz
```

Run the AppImage:

```bash
chmod +x dist/Anon-*-linux.AppImage
./dist/Anon-*-linux.AppImage
```

### macOS unsigned (run on a Mac, or via GitHub Actions `macos-14`)

```bash
npm run dist:mac
# → dist/Anon-0.3.0-arm64-mac.dmg
# → dist/Anon-0.3.0-arm64-mac.zip
```

`CSC_IDENTITY_AUTO_DISCOVERY=false` is set so electron-builder does not look for
a signing identity.

### macOS signed + notarized (needs Apple credentials)

```bash
# Export CSC_LINK, CSC_KEY_PASSWORD, APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER
npm run dist:mac:signed
```

Full enrollment and GitHub secret steps: [`docs/04-macos-release.md`](./04-macos-release.md).

## Cut a GitHub Release (unsigned preview)

After merging to `main`:

```bash
# package.json version should match the tag (currently 0.3.0)
git checkout main
git pull
git tag v0.3.0
git push origin v0.3.0
```

That triggers **Preview release** (`.github/workflows/release-preview.yml`), which:

1. Builds Linux AppImage + tar.gz on Ubuntu
2. Builds unsigned macOS DMG + zip on `macos-14`
3. Creates a **prerelease** on GitHub with those assets + `SHA256SUMS`

Manual dry-run without a tag: Actions → **Preview release** → Run workflow.
Artifacts upload to the workflow run; only tag pushes publish a Release.

To replace assets on an existing tag, delete/re-push the tag or re-run the
workflow after fixing the build (the publish job uses `gh release upload --clobber`).

## Official signed macOS DMG (blocked without Apple)

1. Complete [`docs/04-macos-release.md`](./04-macos-release.md) (Developer Program +
   `release` environment secrets).
2. Actions → **Signed macOS release** → Run workflow.
3. The job notarizes the DMG and attaches it to `v<package.json version>`,
   clearing the prerelease flag.

Until step 1 is done, that workflow will fail on the credential check — that is
expected. Use Preview release instead.

## Marketing site download buttons

In-repo site (`site/src/lib/downloads.ts`) points at:

`https://github.com/Schellbach/anon-browser/releases/latest`

After the first `v*` tag publishes assets, `/releases/latest` resolves and the
anoncomputer.com Download CTA works (redeploy the site if VERSION / platform
flags change). Direct asset URLs (optional hardening):

```text
https://github.com/Schellbach/anon-browser/releases/download/v0.3.0/Anon-0.3.0-arm64-mac.dmg
https://github.com/Schellbach/anon-browser/releases/download/v0.3.0/Anon-0.3.0-x86_64-linux.AppImage
```

If production still hard-codes a different URL, change the Download href to the
Release above (one-line change on anoncomputer.com / Netlify).

## Still blocked without the founder’s Apple account

- Developer ID Application certificate
- Notarization (Gatekeeper “accepted” without right-click Open)
- Stapled ticket on the DMG
- Marketing copy that claims a signed Mac download

Unsigned preview + Linux AppImage are intentional stopgaps so Releases are not
a dead end.
