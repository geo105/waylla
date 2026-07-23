// Íconos vectoriales (sin emojis) para tarjetas de requisitos y modos.
type Tipo = 'pin' | 'hoja' | 'doc' | 'trazas' | 'offline' | 'online'

export default function IconoReq({ tipo, size = 42 }: { tipo: Tipo; size?: number }) {
  const comun = {
    width: size,
    height: size,
    viewBox: '0 0 40 40',
    fill: 'none',
    stroke: '#1b7a43',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    xmlns: 'http://www.w3.org/2000/svg',
  }

  if (tipo === 'pin')
    return (
      <svg {...comun} aria-hidden="true">
        <path d="M20 5c-6 0-11 4.6-11 11 0 8 11 19 11 19s11-11 11-19c0-6.4-5-11-11-11Z" />
        <circle cx="20" cy="16" r="4" />
      </svg>
    )

  if (tipo === 'hoja')
    return (
      <svg {...comun} aria-hidden="true">
        <path d="M30 7C16 7 9 15 9 27c0 0 0 0 0 0 12 0 21-8 21-20Z" />
        <path d="M13 25c5-6 10-10 15-13" />
      </svg>
    )

  if (tipo === 'doc')
    return (
      <svg {...comun} aria-hidden="true">
        <path d="M12 5h10l6 6v24H12Z" />
        <path d="M22 5v6h6" />
        <path d="M16 20h9M16 25h9M16 30h6" />
      </svg>
    )

  if (tipo === 'online')
    return (
      <svg {...comun} aria-hidden="true">
        <path d="M13 23a10 10 0 0 1 14 0" />
        <path d="M9 19a16 16 0 0 1 22 0" />
        <path d="M5 15a22 22 0 0 1 30 0" />
        <circle cx="20" cy="28" r="2.4" fill="#1b7a43" stroke="none" />
      </svg>
    )

  if (tipo === 'offline')
    return (
      <svg {...comun} aria-hidden="true">
        <path d="M13 23a10 10 0 0 1 14 0" />
        <path d="M9 19a16 16 0 0 1 22 0" />
        <path d="M5 15a22 22 0 0 1 30 0" />
        <circle cx="20" cy="28" r="2.4" fill="#1b7a43" stroke="none" />
        <path d="M7 8 L33 34" stroke="#d64545" />
      </svg>
    )

  return (
    <svg {...comun} aria-hidden="true">
      <circle cx="8" cy="20" r="3.6" fill="#1b7a43" stroke="none" />
      <circle cx="20" cy="20" r="3.6" fill="#1b7a43" stroke="none" />
      <circle cx="32" cy="20" r="3.6" fill="#1b7a43" stroke="none" />
      <path d="M11.6 20h4.8M23.6 20h4.8" />
    </svg>
  )
}
