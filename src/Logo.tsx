// Logo de Waylla: una "W" sobre un tile verde con un brote de hoja.
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Waylla"
      role="img"
    >
      <defs>
        <linearGradient id="waylla-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2aa35a" />
          <stop offset="1" stopColor="#0e4d2b" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#waylla-g)" />
      {/* La "W" */}
      <path
        d="M12 17 L18 33 L24 23 L30 33 L36 17"
        stroke="#ffffff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Brote de hoja sobre el pico central */}
      <path d="M24 8 C27 11 27 15.5 24 17 C21 15.5 21 11 24 8 Z" fill="#bff0c8" />
      <line x1="24" y1="10.5" x2="24" y2="16" stroke="#2aa35a" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}
