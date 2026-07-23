// Ilustración flat de café y cacao para la portada.
export default function Arte() {
  return (
    <svg viewBox="0 0 320 340" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* halo suave */}
      <circle cx="165" cy="170" r="150" fill="#ffffff" opacity="0.10" />

      {/* ---- Rama de café con cerezas ---- */}
      <path
        d="M60 300 C 80 230, 70 170, 120 120"
        stroke="#6b4a2b"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* hojas */}
      <path d="M72 235 C 40 225, 34 250, 60 262 C 84 258, 90 246, 72 235 Z" fill="#2f9e57" />
      <path d="M92 185 C 122 172, 132 196, 108 210 C 84 208, 78 196, 92 185 Z" fill="#3aae63" />
      {/* cerezas */}
      <circle cx="118" cy="126" r="17" fill="#d64545" />
      <circle cx="146" cy="132" r="16" fill="#c23b3b" />
      <circle cx="132" cy="104" r="15" fill="#e05a5a" />
      <circle cx="112" cy="120" r="4" fill="#ffffff" opacity="0.6" />
      <circle cx="140" cy="126" r="4" fill="#ffffff" opacity="0.5" />

      {/* ---- Vaina de cacao ---- */}
      <g transform="rotate(14 210 200)">
        <defs>
          <linearGradient id="pod" x1="170" y1="120" x2="250" y2="280" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f0b24a" />
            <stop offset="1" stopColor="#c9721f" />
          </linearGradient>
        </defs>
        <path
          d="M210 118 C 258 140, 262 250, 210 286 C 158 250, 162 140, 210 118 Z"
          fill="url(#pod)"
          stroke="#a75d16"
          strokeWidth="3"
        />
        <path d="M210 128 C 196 190, 196 230, 210 278" stroke="#a75d16" strokeWidth="2.5" opacity="0.6" />
        <path d="M232 138 C 224 190, 224 232, 232 268" stroke="#a75d16" strokeWidth="2.5" opacity="0.5" />
        <path d="M188 138 C 196 190, 196 232, 188 268" stroke="#a75d16" strokeWidth="2.5" opacity="0.5" />
        <path d="M210 118 C 208 104, 214 98, 222 96" stroke="#6b4a2b" strokeWidth="5" strokeLinecap="round" />
        <path d="M222 96 C 238 88, 250 96, 246 110 C 232 114, 222 108 222 96 Z" fill="#3aae63" />
      </g>

      {/* granos de café sueltos */}
      <g fill="#6b4a2b">
        <ellipse cx="96" cy="300" rx="13" ry="9" transform="rotate(-25 96 300)" />
        <ellipse cx="128" cy="312" rx="13" ry="9" transform="rotate(-10 128 312)" />
      </g>
      <path d="M90 298 C 96 304, 96 304, 102 302" stroke="#4a3218" strokeWidth="1.6" />
      <path d="M122 310 C 128 316, 128 316, 134 314" stroke="#4a3218" strokeWidth="1.6" />
    </svg>
  )
}
