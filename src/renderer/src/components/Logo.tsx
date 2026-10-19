import React from 'react'

export interface LogoProps {
  /** Size preset or custom pixel height */
  size?: 'xs' | 'sm' | 'md' | 'lg' | number
  /** Display variant */
  variant?: 'full' | 'icon' | 'compact'
  /** ASCII Box style */
  boxStyle?: 'ascii-box' | 'ascii-box-core' | 'ascii-cross' | 'ascii-block'
  /** Theme mode */
  theme?: 'auto' | 'light' | 'dark' | 'current'
  /** Additional CSS class names */
  className?: string
  /** Click handler */
  onClick?: () => void
}

/**
 * resourcedeck Logo
 * - Zero rounded corners (sharp 90° edges, crispEdges)
 * - ASCII box icon imitation
 * - Fraunces editorial serif font
 * - Strict dual-color palette: super dark grey (#121214) and super light grey (#f4f4f5)
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'sm',
  variant = 'full',
  boxStyle = 'ascii-box',
  theme = 'auto',
  className = '',
  onClick
}) => {
  // Sizing calculations
  let iconPx = 18
  let fontSize = 15
  let gapPx = 7

  if (typeof size === 'number') {
    iconPx = size
    fontSize = Math.round(size * 0.8)
    gapPx = Math.round(size * 0.35)
  } else {
    switch (size) {
      case 'xs':
        iconPx = 14
        fontSize = 13
        gapPx = 5
        break
      case 'sm':
        iconPx = 18
        fontSize = 15
        gapPx = 7
        break
      case 'md':
        iconPx = 24
        fontSize = 19
        gapPx = 9
        break
      case 'lg':
        iconPx = 30
        fontSize = 24
        gapPx = 12
        break
    }
  }

  // Strict Color Palette:
  // Super Dark Grey: #121214
  // Super Light Grey: #f4f4f5
  let fgColor = 'var(--text-primary, #121214)'

  if (theme === 'light') {
    fgColor = '#121214' // super dark grey on light
  } else if (theme === 'dark') {
    fgColor = '#f4f4f5' // super light grey on dark
  } else if (theme === 'current') {
    fgColor = 'currentColor'
  }

  // Render the ASCII Box Icon
  const renderAsciiIcon = () => {
    switch (boxStyle) {
      case 'ascii-box-core':
        // ASCII Box with centered flat core block: [ █ ]
        return (
          <svg
            width={iconPx}
            height={iconPx}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            {/* Sharp ASCII outer frame */}
            <rect
              x="2"
              y="2"
              width="24"
              height="24"
              stroke={fgColor}
              strokeWidth="2"
              shapeRendering="crispEdges"
            />
            {/* Sharp inner flat block */}
            <rect
              x="8"
              y="8"
              width="12"
              height="12"
              fill={fgColor}
              shapeRendering="crispEdges"
            />
          </svg>
        )

      case 'ascii-cross':
        // ASCII Corner-Cross Box (+---+ / |   | / +---+)
        return (
          <svg
            width={iconPx}
            height={iconPx}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            {/* Box frame */}
            <rect
              x="3"
              y="3"
              width="22"
              height="22"
              stroke={fgColor}
              strokeWidth="2"
              shapeRendering="crispEdges"
            />
            {/* Corner cross junctions (+) */}
            <path
              d="M0 4H6M4 0V6 M22 4H28M24 0V6 M0 24H6M4 22V28 M22 24H28M24 22V28"
              stroke={fgColor}
              strokeWidth="2"
              strokeLinecap="square"
              shapeRendering="crispEdges"
            />
          </svg>
        )

      case 'ascii-block':
        // ASCII Solid Full Block (█ U+2588)
        return (
          <svg
            width={iconPx}
            height={iconPx}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2"
              y="2"
              width="24"
              height="24"
              fill={fgColor}
              shapeRendering="crispEdges"
            />
          </svg>
        )

      case 'ascii-box':
      default:
        // Classic ASCII Terminal Box (┌──┐ / │  │ / └──┘)
        return (
          <svg
            width={iconPx}
            height={iconPx}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect
              x="2.5"
              y="2.5"
              width="23"
              height="23"
              stroke={fgColor}
              strokeWidth="2.5"
              shapeRendering="crispEdges"
            />
          </svg>
        )
    }
  }

  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        onClick={onClick}
        title="resourcedeck"
      >
        {renderAsciiIcon()}
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center select-none font-editorial lowercase ${className}`}
      style={{
        gap: `${gapPx}px`,
        color: fgColor,
        letterSpacing: '-0.02em',
        lineHeight: 1
      }}
      onClick={onClick}
      title="resourcedeck"
    >
      {renderAsciiIcon()}

      {variant === 'full' ? (
        <>
          <span
            className="hidden xl:inline font-semibold"
            style={{ fontSize: `${fontSize}px` }}
          >
            resourcedeck
          </span>
          <span
            className="xl:hidden font-semibold"
            style={{ fontSize: `${fontSize}px` }}
          >
            rd
          </span>
        </>
      ) : (
        <span
          className="font-semibold"
          style={{ fontSize: `${fontSize}px` }}
        >
          rd
        </span>
      )}
    </div>
  )
}

export default Logo
