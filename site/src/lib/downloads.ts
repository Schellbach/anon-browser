/** Release hosting — assets come from GitHub Releases (Preview release workflow). */
export const RELEASES_URL = 'https://github.com/Schellbach/anon-browser/releases/latest'
export const REPO_URL = 'https://github.com/Schellbach/anon-browser'
export const VERSION = '0.3.0'

/** Direct asset URLs once `v${VERSION}` is published; fall back to /releases/latest. */
export const MAC_DMG_URL =
  `https://github.com/Schellbach/anon-browser/releases/download/v${VERSION}/Anon-${VERSION}-arm64-mac.dmg`
export const LINUX_APPIMAGE_URL =
  `https://github.com/Schellbach/anon-browser/releases/download/v${VERSION}/Anon-${VERSION}-x86_64-linux.AppImage`

export type PlatformId = 'mac' | 'windows' | 'linux' | 'other'

export type DownloadOption = {
  id: PlatformId
  label: string
  detail: string
  href: string
  available: boolean
}

export const DOWNLOADS: DownloadOption[] = [
  {
    id: 'mac',
    label: 'macOS',
    detail: 'Apple Silicon · unsigned DMG',
    href: MAC_DMG_URL,
    available: true,
  },
  {
    id: 'windows',
    label: 'Windows',
    detail: 'Coming soon',
    href: RELEASES_URL,
    available: false,
  },
  {
    id: 'linux',
    label: 'Linux',
    detail: 'x64 · AppImage',
    href: LINUX_APPIMAGE_URL,
    available: true,
  },
]

export function detectPlatform(): PlatformId {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'other'
}

export function primaryDownload(platform: PlatformId = detectPlatform()): DownloadOption {
  const match = DOWNLOADS.find((d) => d.id === platform && d.available)
  return match ?? DOWNLOADS.find((d) => d.available) ?? DOWNLOADS[0]
}
