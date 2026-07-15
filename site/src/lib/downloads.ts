/** Release hosting — update when assets land on GitHub Releases or a CDN. */
export const RELEASES_URL = 'https://github.com/Schellbach/anon-browser/releases/latest'
export const REPO_URL = 'https://github.com/Schellbach/anon-browser'
export const VERSION = '0.3.0'

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
    detail: 'Apple Silicon · DMG',
    href: RELEASES_URL,
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
    detail: 'Coming soon',
    href: RELEASES_URL,
    available: false,
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
