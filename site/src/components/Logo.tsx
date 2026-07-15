import type { CSSProperties } from 'react'
import AnonMark from './AnonMark'

type LogoProps = {
  size?: number
  showWordmark?: boolean
  className?: string
  href?: string
}

export default function Logo({
  size = 32,
  showWordmark = true,
  className = '',
  href = '#',
}: LogoProps) {
  return (
    <a
      href={href}
      className={`logo ${className}`}
      style={{ '--logo-size': `${size}px` } as CSSProperties}
    >
      <AnonMark />
      {showWordmark && <span className="logo-wordmark">Anon</span>}
    </a>
  )
}
