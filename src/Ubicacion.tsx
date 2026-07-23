import { useState } from 'react'
import './Ubicacion.css'
import Logo from './Logo'

export interface Ubic {
  center: [number, number]
  zoom: number
  conEjemplos: boolean
  nombre: string
}

// Zonas cafetaleras / cacaoteras del Perú con coordenadas predefinidas.
const ZONAS: Ubic[] = [
  { nombre: 'Jaén (Cajamarca) · demo', center: [-5.696, -78.795], zoom: 13, conEjemplos: true },
  { nombre: 'Tarapoto (San Martín)', center: [-6.4869, -76.3656], zoom: 13, conEjemplos: false },
  { nombre: 'Moyobamba (San Martín)', center: [-6.0339, -76.9723], zoom: 13, conEjemplos: false },
  { nombre: 'La Merced / Chanchamayo (Junín)', center: [-11.057, -75.333], zoom: 13, conEjemplos: false },
  { nombre: 'Satipo (Junín)', center: [-11.252, -74.637], zoom: 12, conEjemplos: false },
  { nombre: 'Quillabamba (Cusco)', center: [-12.866, -72.691], zoom: 13, conEjemplos: false },
  { nombre: 'Villa Rica (Pasco)', center: [-10.734, -75.269], zoom: 13, conEjemplos: false },
  { nombre: 'Bagua (Amazonas)', center: [-5.645, -78.44], zoom: 12, conEjemplos: false },
]

interface ResultadoOSM {
  display_name: string
  lat: string
  lon: string
}

export default function Ubicacion({
  onElegir,
  onVolver,
}: {
  onElegir: (u: Ubic) => void
  onVolver: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ResultadoOSM[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!busqueda.trim()) return
    setCargando(true)
    setError('')
    setResultados([])
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=pe&q=${encodeURIComponent(
        busqueda,
      )}`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'es' } })
      if (!resp.ok) throw new Error('búsqueda no disponible')
      const data: ResultadoOSM[] = await resp.json()
      if (data.length === 0) setError('No se encontró ese lugar. Prueba con otra ciudad o distrito.')
      setResultados(data)
    } catch {
      setError('No se pudo buscar ahora. Elige una zona de la lista de abajo.')
    } finally {
      setCargando(false)
    }
  }

  const elegirResultado = (r: ResultadoOSM) => {
    onElegir({
      center: [parseFloat(r.lat), parseFloat(r.lon)],
      zoom: 13,
      conEjemplos: false,
      nombre: r.display_name.split(',').slice(0, 2).join(', '),
    })
  }

  return (
    <div className="ubic">
      <header className="u-top">
        <span className="u-logo">
          <Logo size={30} /> Waylla
        </span>
        <button className="u-volver" onClick={onVolver}>
          ← Volver
        </button>
      </header>

      <div className="u-cuerpo">
        <h1>¿Dónde está tu cooperativa?</h1>
        <p className="u-sub">
          El mapa se abrirá centrado en la zona que elijas, con la capa de deforestación de esa
          región.
        </p>

        <form className="u-buscador" onSubmit={buscar}>
          <input
            type="text"
            placeholder="Busca una ciudad o distrito (ej. Jaén, Pichanaki, Bagua)"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button type="submit" disabled={cargando}>
            {cargando ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {error && <p className="u-error">{error}</p>}

        {resultados.length > 0 && (
          <ul className="u-resultados">
            {resultados.map((r, i) => (
              <li key={i} onClick={() => elegirResultado(r)}>
                📍 {r.display_name}
              </li>
            ))}
          </ul>
        )}

        <div className="u-divisor">o elige una zona cafetalera / cacaotera</div>

        <div className="u-zonas">
          {ZONAS.map((z) => (
            <button key={z.nombre} className="u-zona" onClick={() => onElegir(z)}>
              <span className="u-zona-nombre">{z.nombre}</span>
              {z.conEjemplos && <span className="u-zona-tag">con parcelas de ejemplo</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
