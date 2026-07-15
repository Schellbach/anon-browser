import type { CSSProperties } from 'react'
import AnonMark from './AnonMark'
import { useTheme } from '../context/ThemeContext'

type LogoProps = {
  size?: number
  showWordmark?: boolean
  className?: string
  interactive?: boolean
}

export default function Logo({
  size = 32,
  showWordmark = true,
  className = '',
  interactive = false,
}: LogoProps) {
  const { theme, toggleTheme } = useTheme()

  const mark = interactive ? (
    <button
      type="button"
      className="logo-fruit-btn theme-toggle"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      aria-pressed={theme === 'dark'}
    >
      <AnonMark />
    </button>
  ) : (
    <AnonMark />
  )

  return (
    <div
      className={`logo ${className}`}
      style={{ '--logo-size': `${size}px` } as CSSProperties}
    >
      {mark}
      {showWordmark &&
        (interactive ? (
          <a href="#" className="logo-wordmark">
            Anon
          </a>
        ) : (
          <span className="logo-wordmark">Anon</span>
        ))}
    </div>
  )
}
