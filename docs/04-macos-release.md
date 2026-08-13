# macOS signing and notarization

Anon uses `electron-builder` to produce a Developer ID-signed, hardened, and
Apple-notarized Apple Silicon DMG. Signing and notarization run in the
**Signed macOS release** GitHub Actions workflow (`workflow_dispatch` only).

For downloadable **unsigned** macOS + Linux builds that do not need this
setup, see [`docs/05-packaging.md`](./05-packaging.md) and the **Preview
release** workflow.

## Current blocker

Anon Computer needs an active [Apple Developer Program][developer-program]
membership. Apple will not issue a Developer ID Application certificate or
accept a notarization submission without one.

Repository signing config is ready, but notarized builds remain blocked until
the membership and GitHub `release` environment secrets below are in place.
Unsigned preview Releases can ship without them.

## One-time Apple setup

1. Enroll Anon Computer in the Apple Developer Program and complete any
   pending agreements.
2. Create a **Developer ID Application** certificate. Do not use an App Store
   distribution certificate.
3. Install the certificate and its private key in Keychain Access, then export
   both as a password-protected `.p12`.
4. In App Store Connect, enable API access if necessary and create a **Team API
   Key** under Users and Access → Integrations. Give it the Developer role.
   Download the `.p8` file immediately; Apple only offers it once.
5. Record the API key ID and issuer UUID.

Do not commit the `.p12`, `.p8`, their passwords, or their base64 encodings.
The repository ignores these file types as a second line of defense.

## GitHub environment and secrets

Create a GitHub Actions environment named `release`. Requiring a reviewer for
this environment is recommended because access to its secrets can produce an
official Anon binary.

Add these environment secrets:

| Secret | Value |
|---|---|
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded Developer ID Application `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_API_KEY_P8_BASE64` | Base64-encoded App Store Connect Team API `.p8` |
| `APPLE_API_KEY_ID` | App Store Connect API key ID |
| `APPLE_API_ISSUER` | App Store Connect API issuer UUID |

On macOS, create the base64 values without writing another plaintext copy:

```bash
base64 < DeveloperIDApplication.p12 | pbcopy
base64 < AuthKey_KEYID.p8 | pbcopy
```

Paste each clipboard value directly into its corresponding GitHub secret.

## Release workflow

Start **Signed macOS release** manually from the Actions tab (requires the
`release` environment secrets). It:

1. Installs dependencies and runs the test suite.
2. Imports the Developer ID certificate through `electron-builder`.
3. Builds the Apple Silicon application with Hardened Runtime.
4. Submits the signed app to Apple's notary service using the API key.
5. Staples and validates the notarization ticket.
6. Verifies the signature with `codesign` and Gatekeeper with `spctl`.
7. Generates checksums and uploads the signed DMG as a workflow artifact.
8. Attaches the DMG to the GitHub Release for `v<package.json version>`
   (creates the release if needed) and clears the prerelease flag.

Unsigned preview assets are published separately when you push a `v*` tag
(see [`docs/05-packaging.md`](./05-packaging.md)). Keep `package.json`
`version` aligned with that tag.

## Local verification

After downloading the workflow artifact:

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Anon.app
codesign --display --verbose=4 /Applications/Anon.app
xcrun stapler validate /Applications/Anon.app
spctl --assess --type execute --verbose=4 /Applications/Anon.app
```

The signature output should identify Anon Computer's Developer ID team,
`stapler` should validate the ticket, and `spctl` should report `accepted`.

For a realistic Gatekeeper test, download the DMG through a browser on a Mac
that has never run the build. Moving a local file does not always attach the
same quarantine metadata as an Internet download.

## Credential handling

- Restrict the App Store Connect key to the minimum working role.
- Protect the GitHub `release` environment with required reviewers.
- Never print decoded credentials in workflow logs.
- Revoke and replace a credential immediately if it is exposed.
- Rotate the certificate before it expires and verify a release after every
  credential change.

[developer-program]: https://developer.apple.com/programs/
