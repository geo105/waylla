import { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

// ---------------------------------------------------------------
// Waylla - Prototipo de trazabilidad EUDR para café y cacao
// Mapa satelital + delimitación de parcelas + semáforo de riesgo
// ---------------------------------------------------------------

type Estado = 'limpia' | 'alerta' | 'riesgo'

type Fuente = 'offline' | 'gfw' | 'whisp'

interface Parcela {
  id: string
  socio: string
  vertices: [number, number][] // [lat, lng]
  areaHa: number
  estado: Estado
  fuente: Fuente // cómo se determinó el estado
  detalle?: string // texto del veredicto del análisis online
  verificando?: boolean
  layer?: L.Polygon
}

// Etiqueta corta para el badge de cada parcela
const ETIQUETA_FUENTE: Record<Fuente, string> = {
  offline: 'offline',
  gfw: '✓ GFW',
  whisp: '✓ Whisp',
}

// Zonas de deforestación post-2020 (DEMO - en producción vienen de
// Global Forest Watch / Sentinel-2). Coordenadas cerca de Jaén, Cajamarca.
const ZONAS_DEFORESTADAS: [number, number][][] = [
  [
    [-5.687, -78.788],
    [-5.683, -78.776],
    [-5.692, -78.769],
    [-5.7, -78.774],
    [-5.698, -78.786],
  ],
  [
    [-5.716, -78.812],
    [-5.71, -78.803],
    [-5.717, -78.795],
    [-5.726, -78.801],
    [-5.724, -78.811],
  ],
]

// Parcelas de ejemplo ya "mapeadas" por el técnico
const PARCELAS_EJEMPLO: { socio: string; vertices: [number, number][] }[] = [
  {
    socio: 'M. Huamán',
    vertices: [
      [-5.676, -78.8065],
      [-5.6745, -78.803],
      [-5.677, -78.8012],
      [-5.6795, -78.8038],
      [-5.6785, -78.8068],
    ],
  },
  {
    socio: 'R. Delgado',
    vertices: [
      [-5.6905, -78.7955],
      [-5.6885, -78.7925],
      [-5.6912, -78.7902],
      [-5.6935, -78.793],
    ],
  },
  {
    socio: 'J. Cieza',
    vertices: [
      [-5.7135, -78.8085],
      [-5.7118, -78.8055],
      [-5.7146, -78.8032],
      [-5.7168, -78.8062],
    ],
  },
]

const COLORES: Record<Estado, string> = {
  limpia: '#2eae60',
  alerta: '#e9b44c',
  riesgo: '#d64545',
}

// Versión del dataset Hansen Global Forest Change para los tiles reales de GFW.
// Si la capa no carga, sube el número (v1.11 = datos hasta 2023, v1.12 = 2024, etc.).
const GFC_VERSION = 'gfc_v1.11'

// URL del backend que consulta Whisp (motor EUDR de la FAO). Ver carpeta server/.
const WHISP_API = import.meta.env.VITE_WHISP_API ?? 'http://localhost:8787'

// --- Geometría ---------------------------------------------------

// Área aproximada del polígono en hectáreas (proyección equirectangular local)
function areaHectareas(vertices: [number, number][]): number {
  if (vertices.length < 3) return 0
  const R = 6371000
  const lat0 = (vertices[0][0] * Math.PI) / 180
  const pts = vertices.map(([lat, lng]) => [
    ((lng * Math.PI) / 180) * R * Math.cos(lat0),
    ((lat * Math.PI) / 180) * R,
  ])
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % pts.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a / 2) / 10000
}

// Test punto-en-polígono (ray casting)
function puntoEnPoligono(p: [number, number], poly: [number, number][]): boolean {
  let dentro = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i]
    const [yj, xj] = poly[j]
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}

function distanciaM(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const la = (a[0] * Math.PI) / 180
  const x = dLng * Math.cos(la) * R
  const y = dLat * R
  return Math.sqrt(x * x + y * y)
}

// Semáforo: riesgo si algún vértice o el centroide cae en zona deforestada;
// alerta si está a menos de 600 m de una; limpia en el resto de casos.
function evaluarEstado(vertices: [number, number][]): Estado {
  const centroide: [number, number] = [
    vertices.reduce((s, v) => s + v[0], 0) / vertices.length,
    vertices.reduce((s, v) => s + v[1], 0) / vertices.length,
  ]
  const puntos = [...vertices, centroide]
  for (const zona of ZONAS_DEFORESTADAS) {
    if (puntos.some((p) => puntoEnPoligono(p, zona))) return 'riesgo'
  }
  for (const zona of ZONAS_DEFORESTADAS) {
    for (const p of puntos) {
      if (zona.some((z) => distanciaM(p, z) < 600)) return 'alerta'
    }
  }
  return 'limpia'
}

// --- Componente principal ---------------------------------------

function App() {
  const mapRef = useRef<L.Map | null>(null)
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const dibujoRef = useRef<{
    puntos: [number, number][]
    marcas: L.CircleMarker[]
    linea: L.Polyline | null
  }>({ puntos: [], marcas: [], linea: null })
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [dibujando, setDibujando] = useState(false)
  const [nVertices, setNVertices] = useState(0)
  const dibujandoRef = useRef(false)
  const contadorRef = useRef(1)

  const agregarParcela = useCallback((socio: string, vertices: [number, number][]) => {
    const map = mapRef.current
    if (!map) return
    const estado = evaluarEstado(vertices)
    const areaHa = areaHectareas(vertices)
    const id = `P-${String(contadorRef.current++).padStart(3, '0')}`
    const layer = L.polygon(vertices, {
      color: COLORES[estado],
      weight: 3,
      fillColor: COLORES[estado],
      fillOpacity: 0.25,
    }).addTo(map)
    layer.bindPopup(
      `<b>${id}</b> · ${socio}<br/>${areaHa.toFixed(2)} ha · <b style="color:${COLORES[estado]}">${estado}</b>`,
    )
    setParcelas((prev) => [...prev, { id, socio, vertices, areaHa, estado, fuente: 'offline', layer }])
  }, [])

  // Actualiza el color del polígono en el mapa según su estado
  const pintarLayer = (p: Parcela, estado: Estado) => {
    p.layer?.setStyle({ color: COLORES[estado], fillColor: COLORES[estado] })
  }

  // Nivel 2: envía la parcela al backend, que consulta Whisp (motor EUDR de la FAO)
  const verificarConWhisp = async (parcela: Parcela) => {
    setParcelas((prev) =>
      prev.map((p) => (p.id === parcela.id ? { ...p, verificando: true } : p)),
    )
    try {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: parcela.id, socio: parcela.socio },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [...parcela.vertices, parcela.vertices[0]].map(([lat, lng]) => [
                  Number(lng.toFixed(6)),
                  Number(lat.toFixed(6)),
                ]),
              ],
            },
          },
        ],
      }
      const resp = await fetch(`${WHISP_API}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geojson),
      })
      if (!resp.ok) throw new Error(`El servidor respondió ${resp.status}`)
      const data: { estado: Estado; detalle?: string; fuente?: Fuente } = await resp.json()
      setParcelas((prev) =>
        prev.map((p) => {
          if (p.id !== parcela.id) return p
          pintarLayer(p, data.estado)
          return {
            ...p,
            estado: data.estado,
            fuente: data.fuente ?? 'gfw',
            detalle: data.detalle,
            verificando: false,
          }
        }),
      )
    } catch (err) {
      setParcelas((prev) =>
        prev.map((p) => (p.id === parcela.id ? { ...p, verificando: false } : p)),
      )
      window.alert(
        'No se pudo verificar. ¿Está corriendo el servidor (carpeta server/, con "npm start")? ' +
          `Detalle: ${(err as Error).message}`,
      )
    }
  }

  const verificarTodas = async () => {
    for (const p of parcelas) {
      await verificarConWhisp(p)
    }
  }

  // Inicializa el mapa una sola vez
  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return
    const map = L.map(mapDivRef.current, { center: [-5.696, -78.795], zoom: 14 })
    mapRef.current = map

    // Imagen satelital (Esri World Imagery, uso libre con atribución)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
    ).addTo(map)

    // --- CAPA REAL: pérdida de bosque de Global Forest Watch / Hansen (UMD) ---
    // Píxeles rojos = pérdida de cobertura arbórea detectada por satélite.
    // Fuente pública (Hansen Global Forest Change), no requiere clave.
    const perdidaBosqueReal = L.tileLayer(
      `https://storage.googleapis.com/earthenginepartners-hansen/tiles/${GFC_VERSION}/loss_alpha/{z}/{x}/{y}.png`,
      {
        attribution: 'Pérdida de bosque: Hansen/UMD/Google/USGS/NASA (Global Forest Watch)',
        maxNativeZoom: 12, // los tiles existen hasta z12; Leaflet los amplía para zooms mayores
        maxZoom: 19,
        opacity: 0.8,
      },
    ).addTo(map)

    // Zonas de deforestación de referencia (demo, para el semáforo offline)
    const zonasDemo = L.layerGroup(
      ZONAS_DEFORESTADAS.map((zona) =>
        L.polygon(zona, {
          color: '#d64545',
          weight: 2,
          fillColor: '#d64545',
          fillOpacity: 0.35,
          dashArray: '6 4',
        }).bindTooltip('Zona de referencia para el semáforo offline (demo)', { sticky: true }),
      ),
    ).addTo(map)

    // Control para prender/apagar cada capa
    L.control
      .layers(
        undefined,
        {
          'Pérdida de bosque real (GFW)': perdidaBosqueReal,
          'Zonas de referencia (demo offline)': zonasDemo,
        },
        { collapsed: false, position: 'topright' },
      )
      .addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!dibujandoRef.current) return
      const d = dibujoRef.current
      const p: [number, number] = [e.latlng.lat, e.latlng.lng]
      d.puntos.push(p)
      d.marcas.push(
        L.circleMarker(p, { radius: 5, color: '#0fa3b1', fillColor: '#0fa3b1', fillOpacity: 1 }).addTo(
          map,
        ),
      )
      if (d.linea) d.linea.setLatLngs(d.puntos)
      else d.linea = L.polyline(d.puntos, { color: '#0fa3b1', weight: 2, dashArray: '4 4' }).addTo(map)
      setNVertices(d.puntos.length)
    })

    // Carga las parcelas de ejemplo
    PARCELAS_EJEMPLO.forEach((p) => agregarParcela(p.socio, p.vertices))

    return () => {
      // Limpieza (importante en dev: StrictMode monta el efecto dos veces)
      map.remove()
      mapRef.current = null
      setParcelas([])
      contadorRef.current = 1
    }
  }, [agregarParcela])

  const limpiarDibujo = () => {
    const d = dibujoRef.current
    d.marcas.forEach((m) => m.remove())
    d.linea?.remove()
    dibujoRef.current = { puntos: [], marcas: [], linea: null }
    setNVertices(0)
  }

  const iniciarDibujo = () => {
    dibujandoRef.current = true
    setDibujando(true)
    limpiarDibujo()
  }

  const cerrarPoligono = () => {
    const d = dibujoRef.current
    if (d.puntos.length < 3) {
      window.alert('Marca al menos 3 vértices caminando el perímetro (haz clic en el mapa).')
      return
    }
    const socio = window.prompt('Nombre del socio productor:', 'Socio nuevo') || 'Socio nuevo'
    agregarParcela(socio, [...d.puntos])
    limpiarDibujo()
    dibujandoRef.current = false
    setDibujando(false)
  }

  const cancelarDibujo = () => {
    limpiarDibujo()
    dibujandoRef.current = false
    setDibujando(false)
  }

  const verParcela = (p: Parcela) => {
    if (!mapRef.current || !p.layer) return
    mapRef.current.fitBounds(p.layer.getBounds(), { padding: [40, 40] })
    p.layer.openPopup()
  }

  // Exporta las parcelas como GeoJSON con la precisión que exige el EUDR
  const exportarGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      features: parcelas.map((p) => ({
        type: 'Feature',
        properties: {
          id: p.id,
          socio: p.socio,
          area_ha: Number(p.areaHa.toFixed(4)),
          estado_eudr: p.estado,
          linea_base: '2020-12-31',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [...p.vertices, p.vertices[0]].map(([lat, lng]) => [
              Number(lng.toFixed(6)),
              Number(lat.toFixed(6)),
            ]),
          ],
        },
      })),
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'waylla_parcelas.geojson'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const resumen = {
    limpia: parcelas.filter((p) => p.estado === 'limpia').length,
    alerta: parcelas.filter((p) => p.estado === 'alerta').length,
    riesgo: parcelas.filter((p) => p.estado === 'riesgo').length,
  }

  return (
    <div className="app">
      <header className="cabecera">
        <div>
          <h1>Waylla</h1>
          <span className="subtitulo">
            Trazabilidad libre de deforestación · Coop. Valle Alto (demo)
          </span>
        </div>
        <div className="resumen">
          <span className="chip limpia">{resumen.limpia} limpias</span>
          <span className="chip alerta">{resumen.alerta} en alerta</span>
          <span className="chip riesgo">{resumen.riesgo} en riesgo</span>
        </div>
      </header>

      <div className="contenido">
        <aside className="panel">
          <div className="acciones">
            {!dibujando ? (
              <button className="btn principal" onClick={iniciarDibujo}>
                + Nueva parcela
              </button>
            ) : (
              <>
                <p className="ayuda">
                  Haz clic en el mapa para marcar los vértices del perímetro ({nVertices} marcados).
                </p>
                <button className="btn principal" onClick={cerrarPoligono}>
                  Cerrar polígono
                </button>
                <button className="btn" onClick={cancelarDibujo}>
                  Cancelar
                </button>
              </>
            )}
            <button className="btn" onClick={exportarGeoJSON} disabled={parcelas.length === 0}>
              Exportar GeoJSON (EUDR)
            </button>
            <button
              className="btn whisp"
              onClick={verificarTodas}
              disabled={parcelas.length === 0 || parcelas.some((p) => p.verificando)}
            >
              {parcelas.some((p) => p.verificando)
                ? 'Analizando satélite…'
                : 'Verificar deforestación (online)'}
            </button>
          </div>

          <h2>Parcelas ({parcelas.length})</h2>
          <ul className="lista">
            {parcelas.map((p) => (
              <li key={p.id} onClick={() => verParcela(p)}>
                <span className="punto" style={{ background: COLORES[p.estado] }} />
                <div>
                  <strong>{p.id}</strong> · {p.socio}
                  <small>
                    {p.areaHa.toFixed(2)} ha · {p.estado}
                    <span className={`fuente ${p.fuente}`}>
                      {p.verificando ? '⏳…' : ETIQUETA_FUENTE[p.fuente]}
                    </span>
                  </small>
                </div>
              </li>
            ))}
          </ul>

          <footer className="nota">
            Las zonas rojas son deforestación posterior al 31/12/2020 (datos de demostración; en
            producción provienen de Sentinel-2 / Global Forest Watch). El semáforo se calcula al
            cerrar cada polígono.
          </footer>
        </aside>

        <div ref={mapDivRef} className="mapa" />
      </div>
    </div>
  )
}

export default App
