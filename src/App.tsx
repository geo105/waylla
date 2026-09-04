import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import 'leaflet/dist/leaflet.css'
import './App.css'
import Landing from './Landing'
import Ubicacion, { type Ubic } from './Ubicacion'
import Logo from './Logo'
import './Extras.css'
import { analizarEnNavegador } from './hansen'
import Lotes from './Lotes'
import Expediente from './Expediente'
import Ruta, { type EstadoDoc } from './Ruta'
import Vitrina, { PERFIL_VACIO, type Perfil } from './Vitrina'
import { diagnosticarLote, type Lote, type Parcela as ParcelaEUDR } from './tipos'
import {
  loadOfflineParcels,
  saveOfflineParcels,
  type Estado,
  type Fuente,
  type OfflineParcel,
} from './storage'

interface Parcela extends OfflineParcel {
  verificando?: boolean
  layer?: L.Polygon
}

const ETIQUETA_FUENTE: Record<Fuente, string> = {
  offline: 'guardado local',
  gfw: '✓ GFW',
  whisp: '✓ Whisp',
}

// Zonas de referencia incluidas dentro de la aplicación. Permiten mostrar el
// flujo completo de la feria aunque el teléfono no tenga señal.
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

const GFC_VERSION = 'gfc_v1.11'
const WHISP_API = import.meta.env.VITE_WHISP_API as string | undefined

function areaHectareas(vertices: [number, number][]): number {
  if (vertices.length < 3) return 0
  const radius = 6371000
  const lat0 = (vertices[0][0] * Math.PI) / 180
  const points = vertices.map(([lat, lng]) => [
    ((lng * Math.PI) / 180) * radius * Math.cos(lat0),
    ((lat * Math.PI) / 180) * radius,
  ])
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index]
    const [x2, y2] = points[(index + 1) % points.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2) / 10000
}

function puntoEnPoligono(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [lat, lng] = polygon[index]
    const [previousLat, previousLng] = polygon[previous]
    if (
      lat > point[0] !== previousLat > point[0] &&
      point[1] < ((previousLng - lng) * (point[0] - lat)) / (previousLat - lat) + lng
    ) {
      inside = !inside
    }
  }
  return inside
}

function distanciaM(a: [number, number], b: [number, number]): number {
  const radius = 6371000
  const deltaLat = ((b[0] - a[0]) * Math.PI) / 180
  const deltaLng = ((b[1] - a[1]) * Math.PI) / 180
  const latitude = (a[0] * Math.PI) / 180
  const x = deltaLng * Math.cos(latitude) * radius
  const y = deltaLat * radius
  return Math.sqrt(x * x + y * y)
}

function evaluarEstado(vertices: [number, number][]): Estado {
  const centroide: [number, number] = [
    vertices.reduce((sum, vertex) => sum + vertex[0], 0) / vertices.length,
    vertices.reduce((sum, vertex) => sum + vertex[1], 0) / vertices.length,
  ]
  const points = [...vertices, centroide]

  for (const zone of ZONAS_DEFORESTADAS) {
    if (points.some((point) => puntoEnPoligono(point, zone))) return 'riesgo'
  }
  for (const zone of ZONAS_DEFORESTADAS) {
    for (const point of points) {
      if (zone.some((zonePoint) => distanciaM(point, zonePoint) < 600)) return 'alerta'
    }
  }
  return 'limpia'
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[character] ??
      character,
  )
}

function toOfflineParcel(parcel: Parcela): OfflineParcel {
  return {
    id: parcel.id,
    socio: parcel.socio,
    vertices: parcel.vertices,
    areaHa: parcel.areaHa,
    estado: parcel.estado,
    fuente: parcel.fuente,
    detalle: parcel.detalle,
  }
}

function MapaApp({
  ubic,
  onInicio,
  onParcelas,
}: {
  ubic: Ubic
  onInicio: () => void
  onParcelas?: (p: Parcela[]) => void
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapDivRef = useRef<HTMLDivElement | null>(null)
  const satelliteLayerRef = useRef<L.TileLayer | null>(null)
  const forestLayerRef = useRef<L.TileLayer | null>(null)
  const dibujoRef = useRef<{
    puntos: [number, number][]
    marcas: L.CircleMarker[]
    linea: L.Polyline | null
  }>({ puntos: [], marcas: [], linea: null })
  const dibujandoRef = useRef(false)
  const contadorRef = useRef(1)
  const [parcelas, setParcelas] = useState<Parcela[]>([])

  // Comparte las parcelas con las pantallas de lotes, ruta y vitrina.
  useEffect(() => {
    onParcelas?.(parcelas)
  }, [parcelas, onParcelas])
  const [dibujando, setDibujando] = useState(false)
  const [nVertices, setNVertices] = useState(0)
  const [solicitandoNombre, setSolicitandoNombre] = useState(false)
  const [nombreSocio, setNombreSocio] = useState('Productor de prueba')
  const [hidratado, setHidratado] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const agregarParcela = useCallback(
    (socio: string, vertices: [number, number][], saved?: OfflineParcel) => {
      const map = mapRef.current
      if (!map) return

      const estado = saved?.estado ?? evaluarEstado(vertices)
      const areaHa = saved?.areaHa ?? areaHectareas(vertices)
      const id = saved?.id ?? `P-${String(contadorRef.current).padStart(3, '0')}`
      const idNumber = Number.parseInt(id.replace(/\D/g, ''), 10)
      if (Number.isFinite(idNumber)) contadorRef.current = Math.max(contadorRef.current, idNumber + 1)
      else contadorRef.current += 1

      const layer = L.polygon(vertices, {
        color: COLORES[estado],
        weight: 3,
        fillColor: COLORES[estado],
        fillOpacity: 0.28,
      }).addTo(map)
      layer.bindPopup(
        `<b>${escapeHtml(id)}</b> · ${escapeHtml(socio)}<br/>${areaHa.toFixed(2)} ha · <b style="color:${COLORES[estado]}">${estado}</b>`,
      )

      setParcelas((previous) => {
        if (previous.some((parcel) => parcel.id === id)) {
          layer.remove()
          return previous
        }
        return [
          ...previous,
          {
            id,
            socio,
            vertices,
            areaHa,
            estado,
            fuente: saved?.fuente ?? 'offline',
            detalle: saved?.detalle,
            layer,
          },
        ]
      })
    },
    [],
  )

  useEffect(() => {
    if (mapRef.current || !mapDivRef.current) return
    let active = true
    const map = L.map(mapDivRef.current, { center: ubic.center, zoom: ubic.zoom, zoomControl: true })
    mapRef.current = map

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics', maxZoom: 19 },
    )
    const forestLayer = L.tileLayer(
      `https://storage.googleapis.com/earthenginepartners-hansen/tiles/${GFC_VERSION}/loss_alpha/{z}/{x}/{y}.png`,
      {
        attribution: 'Pérdida de bosque: Hansen/UMD/Google/USGS/NASA',
        maxNativeZoom: 12,
        maxZoom: 19,
        opacity: 0.8,
      },
    )
    satelliteLayerRef.current = satelliteLayer
    forestLayerRef.current = forestLayer
    if (navigator.onLine) {
      satelliteLayer.addTo(map)
      forestLayer.addTo(map)
    }

    const zonasDemo = L.layerGroup(
      ZONAS_DEFORESTADAS.map((zone) =>
        L.polygon(zone, {
          color: '#d64545',
          weight: 2,
          fillColor: '#d64545',
          fillOpacity: 0.35,
          dashArray: '6 4',
        }).bindTooltip('Zona de referencia incluida para la demostración offline', { sticky: true }),
      ),
    ).addTo(map)

    L.control
      .layers(
        { 'Satélite Esri (online)': satelliteLayer },
        {
          'Pérdida de bosque GFW (online)': forestLayer,
          'Zonas de referencia (offline)': zonasDemo,
        },
        { collapsed: true, position: 'topright' },
      )
      .addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!dibujandoRef.current) return
      const drawing = dibujoRef.current
      const point: [number, number] = [event.latlng.lat, event.latlng.lng]
      drawing.puntos.push(point)
      drawing.marcas.push(
        L.circleMarker(point, {
          radius: 5,
          color: '#0fa3b1',
          fillColor: '#0fa3b1',
          fillOpacity: 1,
        }).addTo(map),
      )
      if (drawing.linea) drawing.linea.setLatLngs(drawing.puntos)
      else {
        drawing.linea = L.polyline(drawing.puntos, {
          color: '#0fa3b1',
          weight: 2,
          dashArray: '4 4',
        }).addTo(map)
      }
      setNVertices(drawing.puntos.length)
    })

    const hydrate = async () => {
      try {
        const stored = await loadOfflineParcels()
        if (!active) return
        if (stored === null && ubic.conEjemplos) {
          PARCELAS_EJEMPLO.forEach((parcel) => agregarParcela(parcel.socio, parcel.vertices))
        } else {
          stored?.forEach((parcel) => agregarParcela(parcel.socio, parcel.vertices, parcel))
        }
      } finally {
        if (active) setHidratado(true)
      }
    }
    void hydrate()

    return () => {
      active = false
      map.remove()
      mapRef.current = null
      satelliteLayerRef.current = null
      forestLayerRef.current = null
    }
  }, [agregarParcela, ubic])

  useEffect(() => {
    const map = mapRef.current
    const satellite = satelliteLayerRef.current
    const forest = forestLayerRef.current
    if (!map || !satellite || !forest) return

    if (online) {
      if (!map.hasLayer(satellite)) satellite.addTo(map)
      if (!map.hasLayer(forest)) forest.addTo(map)
    } else {
      if (map.hasLayer(satellite)) map.removeLayer(satellite)
      if (map.hasLayer(forest)) map.removeLayer(forest)
    }
  }, [online])

  useEffect(() => {
    if (!hidratado) return
    const save = async () => {
      try {
        await saveOfflineParcels(parcelas.map(toOfflineParcel))
        setErrorGuardado(false)
      } catch {
        setErrorGuardado(true)
      }
    }
    void save()
  }, [hidratado, parcelas])

  const limpiarDibujo = () => {
    const drawing = dibujoRef.current
    drawing.marcas.forEach((marker) => marker.remove())
    drawing.linea?.remove()
    dibujoRef.current = { puntos: [], marcas: [], linea: null }
    setNVertices(0)
  }

  const iniciarDibujo = () => {
    dibujandoRef.current = true
    setDibujando(true)
    setSolicitandoNombre(false)
    setNombreSocio('Productor de prueba')
    limpiarDibujo()
  }

  const solicitarCierre = () => {
    const drawing = dibujoRef.current
    if (drawing.puntos.length < 3) {
      window.alert('Marca al menos 3 vértices en el mapa para cerrar la parcela.')
      return
    }
    setSolicitandoNombre(true)
  }

  const confirmarParcela = () => {
    agregarParcela(nombreSocio.trim() || 'Productor de prueba', [...dibujoRef.current.puntos])
    limpiarDibujo()
    dibujandoRef.current = false
    setDibujando(false)
    setSolicitandoNombre(false)
  }

  const cancelarDibujo = () => {
    limpiarDibujo()
    dibujandoRef.current = false
    setDibujando(false)
    setSolicitandoNombre(false)
  }

  const verParcela = (parcel: Parcela) => {
    if (!mapRef.current || !parcel.layer) return
    mapRef.current.fitBounds(parcel.layer.getBounds(), { padding: [40, 40] })
    parcel.layer.openPopup()
  }

  const eliminarParcela = (parcel: Parcela) => {
    if (!window.confirm(`¿Eliminar ${parcel.id} de este teléfono?`)) return
    parcel.layer?.remove()
    setParcelas((previous) => previous.filter((item) => item.id !== parcel.id))
  }

  const borrarDatosLocales = () => {
    if (!window.confirm('¿Borrar todas las parcelas guardadas en este teléfono?')) return
    parcelas.forEach((parcel) => parcel.layer?.remove())
    setParcelas([])
  }

  const pintarLayer = (parcel: Parcela, estado: Estado) => {
    parcel.layer?.setStyle({ color: COLORES[estado], fillColor: COLORES[estado] })
  }

  const verificarConWhisp = async (parcel: Parcela) => {
    // Sin servidor configurado el análisis corre en el propio navegador,
    // así la verificación también funciona en la web publicada.
    if (!online) return
    setParcelas((previous) =>
      previous.map((item) => (item.id === parcel.id ? { ...item, verificando: true } : item)),
    )
    try {
      const geojson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: parcel.id, socio: parcel.socio },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [...parcel.vertices, parcel.vertices[0]].map(([lat, lng]) => [
                  Number(lng.toFixed(6)),
                  Number(lat.toFixed(6)),
                ]),
              ],
            },
          },
        ],
      }
      const anillo = geojson.features[0].geometry.coordinates[0] as [number, number][]

      const porServidor = async () => {
        const response = await fetch(`${WHISP_API}/verificar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geojson),
        })
        if (!response.ok) throw new Error(`El servicio respondió ${response.status}`)
        return (await response.json()) as { estado: Estado; detalle?: string; fuente?: Fuente }
      }

      let data: { estado: Estado; detalle?: string; fuente?: Fuente }
      if (WHISP_API) {
        try {
          data = await porServidor()
        } catch {
          data = await analizarEnNavegador(anillo)
        }
      } else {
        data = await analizarEnNavegador(anillo)
      }
      setParcelas((previous) =>
        previous.map((item) => {
          if (item.id !== parcel.id) return item
          pintarLayer(item, data.estado)
          return {
            ...item,
            estado: data.estado,
            fuente: data.fuente ?? 'gfw',
            detalle: data.detalle,
            verificando: false,
          }
        }),
      )
    } catch (error) {
      setParcelas((previous) =>
        previous.map((item) => (item.id === parcel.id ? { ...item, verificando: false } : item)),
      )
      window.alert(
        'No se pudo verificar en línea. El semáforo sin conexión sigue siendo válido. ' +
          `Detalle: ${(error as Error).message}`,
      )
    }
  }

  const verificarTodas = async () => {
    for (const parcel of parcelas) await verificarConWhisp(parcel)
  }

  const exportarGeoJSON = async () => {
    const featureCollection = {
      type: 'FeatureCollection',
      features: parcelas.map((parcel) => ({
        type: 'Feature',
        properties: {
          id: parcel.id,
          socio: parcel.socio,
          area_ha: Number(parcel.areaHa.toFixed(4)),
          estado_eudr: parcel.estado,
          linea_base: '2020-12-31',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [...parcel.vertices, parcel.vertices[0]].map(([lat, lng]) => [
              Number(lng.toFixed(6)),
              Number(lat.toFixed(6)),
            ]),
          ],
        },
      })),
    }
    const json = JSON.stringify(featureCollection, null, 2)
    const fileName = `waylla_parcelas_${new Date().toISOString().slice(0, 10)}.geojson`

    if (Capacitor.isNativePlatform()) {
      const saved = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      })
      await Share.share({
        title: 'Parcelas Waylla',
        text: 'Archivo GeoJSON exportado desde Waylla Campo',
        url: saved.uri,
        dialogTitle: 'Compartir parcelas',
      })
      return
    }

    const file = new File([json], fileName, {
      type: 'application/geo+json',
    })

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Parcelas Waylla', files: [file] })
      return
    }

    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(file)
    anchor.download = file.name
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  const resumen = {
    limpia: parcelas.filter((parcel) => parcel.estado === 'limpia').length,
    alerta: parcelas.filter((parcel) => parcel.estado === 'alerta').length,
    riesgo: parcelas.filter((parcel) => parcel.estado === 'riesgo').length,
  }

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cab-izq">
          <button className="btn-inicio" onClick={onInicio} title="Volver al inicio">
            ← Inicio
          </button>
          <div>
            <h1>
              <Logo size={24} /> Waylla Campo
            </h1>
            <span className="subtitulo">{ubic.nombre}</span>
          </div>
        </div>
        <div className="estado-app">
          <span className={`conexion ${online ? 'online' : 'offline'}`}>
            {online ? '● En línea' : '● Modo offline'}
          </span>
          <div className="resumen">
            <span className="chip limpia">{resumen.limpia} limpias</span>
            <span className="chip alerta">{resumen.alerta} alerta</span>
            <span className="chip riesgo">{resumen.riesgo} riesgo</span>
          </div>
        </div>
      </header>

      <div className="contenido">
        <aside className="panel">
          <div className={`estado-guardado ${errorGuardado ? 'error' : ''}`}>
            {errorGuardado
              ? 'No se pudo guardar. Revisa el espacio del teléfono.'
              : '✓ Parcelas guardadas en este dispositivo'}
          </div>

          <div className="acciones">
            {!dibujando ? (
              <button className="btn principal" onClick={iniciarDibujo}>
                + Nueva parcela
              </button>
            ) : solicitandoNombre ? (
              <div className="form-parcela">
                <label htmlFor="nombre-socio">Nombre del productor</label>
                <input
                  id="nombre-socio"
                  value={nombreSocio}
                  onChange={(event) => setNombreSocio(event.target.value)}
                  autoFocus
                />
                <button className="btn principal" onClick={confirmarParcela}>
                  Guardar parcela en el teléfono
                </button>
                <button className="btn" onClick={() => setSolicitandoNombre(false)}>
                  Volver al mapa
                </button>
              </div>
            ) : (
              <>
                <p className="ayuda">
                  Toca el mapa para marcar el perímetro ({nVertices} vértices).
                </p>
                <button className="btn principal" onClick={solicitarCierre}>
                  Cerrar y guardar
                </button>
                <button className="btn" onClick={cancelarDibujo}>
                  Cancelar
                </button>
              </>
            )}
            <button className="btn" onClick={exportarGeoJSON} disabled={parcelas.length === 0}>
              Compartir GeoJSON
            </button>
            <button
              className="btn whisp"
              onClick={verificarTodas}
              disabled={
                !online || !WHISP_API || parcelas.length === 0 || parcelas.some((parcel) => parcel.verificando)
              }
              title={!WHISP_API ? 'Esta edición funciona sin servidor. El servicio online se conectará después.' : ''}
            >
              {parcelas.some((parcel) => parcel.verificando)
                ? 'Analizando satélite…'
                : online && WHISP_API
                  ? 'Verificar con satélite'
                  : 'Verificación online no disponible'}
            </button>
          </div>

          <div className="panel-titulo">
            <h2>Parcelas ({parcelas.length})</h2>
            <button className="btn-texto peligro" onClick={borrarDatosLocales} disabled={parcelas.length === 0}>
              Borrar todas
            </button>
          </div>
          <ul className="lista">
            {parcelas.map((parcel) => (
              <li key={parcel.id} onClick={() => verParcela(parcel)}>
                <span className="punto" style={{ background: COLORES[parcel.estado] }} />
                <div className="parcela-info">
                  <strong>{parcel.id}</strong> · {parcel.socio}
                  <small>
                    {parcel.areaHa.toFixed(2)} ha · {parcel.estado}
                    <span className={`fuente ${parcel.fuente}`}>
                      {parcel.verificando ? 'analizando…' : ETIQUETA_FUENTE[parcel.fuente]}
                    </span>
                  </small>
                </div>
                <button
                  className="eliminar-parcela"
                  aria-label={`Eliminar ${parcel.id}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    eliminarParcela(parcel)
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <footer className="nota">
            El semáforo offline es una evaluación preliminar con zonas de demostración incluidas en
            el teléfono. No reemplaza la verificación satelital oficial para un expediente EUDR.
          </footer>
        </aside>

        <div className="map-stage">
          {!online && (
            <div className="offline-banner">
              Sin Internet: puedes dibujar, guardar y exportar. El fondo satelital volverá cuando haya señal.
            </div>
          )}
          <div ref={mapDivRef} className="mapa" />
          <div className="offline-place">{ubic.nombre}</div>
        </div>
      </div>
    </div>
  )
}

type Paso = 'parcelas' | 'lotes' | 'ruta' | 'vitrina'

// El recorrido que sigue una cooperativa, de la chacra al comprador.
const PASOS: { id: Paso; n: number; titulo: string; proposito: string }[] = [
  {
    id: 'parcelas',
    n: 1,
    titulo: 'Parcelas',
    proposito:
      'Levanta el polígono de cada parcela con seis decimales y contrástalo contra la capa satelital de pérdida de bosque.',
  },
  {
    id: 'lotes',
    n: 2,
    titulo: 'Lotes y expediente',
    proposito:
      'Agrupa las parcelas de los socios en el lote que se embarca y emite el expediente de diligencia debida para el comprador.',
  },
  {
    id: 'ruta',
    n: 3,
    titulo: 'Ruta al mercado',
    proposito:
      'Controla los veintidós documentos que exige una exportación: cuáles faltan, quién los emite y en qué orden.',
  },
  {
    id: 'vitrina',
    n: 4,
    titulo: 'Vitrina',
    proposito:
      'Publica la ficha de la organización con el sello de origen verificado y accede al directorio de asociaciones.',
  },
]

const CLAVE_EXTRA = 'waylla.extra.v1'

interface Extra {
  cooperativa: string
  lotes: Lote[]
  docs: Record<string, EstadoDoc>
  perfil: Perfil
}

function guardado(): Extra {
  const vacio: Extra = { cooperativa: '', lotes: [], docs: {}, perfil: PERFIL_VACIO }
  try {
    const crudo = window.localStorage.getItem(CLAVE_EXTRA)
    if (!crudo) return vacio
    const d = JSON.parse(crudo) as Partial<Extra>
    return {
      cooperativa: typeof d.cooperativa === 'string' ? d.cooperativa : '',
      lotes: Array.isArray(d.lotes) ? d.lotes : [],
      docs: d.docs && typeof d.docs === 'object' ? d.docs : {},
      perfil: { ...PERFIL_VACIO, ...(d.perfil ?? {}) },
    }
  } catch {
    return vacio
  }
}

function App() {
  const [vista, setVista] = useState<'inicio' | 'ubicacion' | 'mapa'>('inicio')
  const [ubic, setUbic] = useState<Ubic | null>(null)
  const [pestana, setPestana] = useState<
    'parcelas' | 'lotes' | 'expediente' | 'ruta' | 'vitrina'
  >('parcelas')

  // Estado que comparten las pantallas nuevas
  const [parcelas, setParcelas] = useState<Parcela[]>([])
  const [lotes, setLotes] = useState<Lote[]>(() => guardado().lotes)
  const [cooperativa, setCooperativa] = useState(() => guardado().cooperativa)
  const [docs, setDocs] = useState<Record<string, EstadoDoc>>(() => guardado().docs)
  const [perfil, setPerfil] = useState<Perfil>(() => guardado().perfil)

  // Los lotes, el avance de la ruta y la ficha sobreviven a un recargado.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CLAVE_EXTRA,
        JSON.stringify({ cooperativa, lotes, docs, perfil }),
      )
    } catch {
      /* almacenamiento bloqueado: la sesión sigue en memoria */
    }
  }, [cooperativa, lotes, docs, perfil])
  const [loteAbierto, setLoteAbierto] = useState<string | null>(null)

  // Las pantallas nuevas piden comunidad y fecha, que la captura del mapa
  // todavía no registra; se completan con valores vacíos.
  const parcelasEUDR: ParcelaEUDR[] = parcelas.map((p) => ({
    id: p.id,
    socio: p.socio,
    vertices: p.vertices,
    areaHa: p.areaHa,
    estado: p.estado,
    fuente: p.fuente,
    comunidad: (p as { comunidad?: string }).comunidad ?? '',
    fecha: (p as { fecha?: string }).fecha ?? new Date().toISOString().slice(0, 10),
    detalle: (p as { detalle?: string }).detalle,
  }))

  // El expediente pertenece al paso 2, aunque sea una pantalla aparte.
  const pasoActivo: Paso = pestana === 'expediente' ? 'lotes' : pestana
  const iPaso = PASOS.findIndex((x) => x.id === pasoActivo)
  const paso = PASOS[iPaso]
  const irAPaso = (i: number) => {
    const destino = PASOS[Math.min(PASOS.length - 1, Math.max(0, i))]
    setPestana(destino.id)
  }

  const lote = lotes.find((l) => l.id === loteAbierto) ?? null
  const bloqueados = lotes.filter(
    (l) => diagnosticarLote(l, parcelasEUDR).estado === 'bloqueado',
  ).length

  const volverInicio = () => {
    setUbic(null)
    setPestana('parcelas')
    setVista('inicio')
  }

  if (vista === 'inicio') return <Landing onComenzar={() => setVista('ubicacion')} />

  if (vista === 'ubicacion' || !ubic) {
    return (
      <Ubicacion
        onElegir={(location) => {
          setUbic(location)
          setPestana('parcelas')
          setVista('mapa')
        }}
        onVolver={() => setVista('inicio')}
      />
    )
  }

  const barraCoop = (
    <div className="coop-barra">
      <label>
        Cooperativa
        <input
          value={cooperativa}
          onChange={(e) => setCooperativa(e.target.value)}
          placeholder="Nombre de la cooperativa"
        />
      </label>
    </div>
  )

  return (
    <>
      {/* El mapa se mantiene montado para no perder las capas de Leaflet */}
      <div style={{ display: pestana === 'parcelas' ? 'contents' : 'none' }}>
        <MapaApp ubic={ubic} onInicio={volverInicio} onParcelas={setParcelas} />
      </div>

      {pestana !== 'parcelas' && (
        <div className="pantalla-extra">
          <div className="paso-cab">
            <div className="paso-id">
              <span className="paso-n">Paso {paso.n} de {PASOS.length}</span>
              <strong>{paso.titulo}</strong>
            </div>
            <p className="paso-proposito">{paso.proposito}</p>
          </div>
          {barraCoop}
          {pestana === 'lotes' && (
            <Lotes
              parcelas={parcelasEUDR}
              lotes={lotes}
              onCrear={(l) => setLotes((prev) => [...prev, l])}
              onActualizar={(l) => setLotes((prev) => prev.map((x) => (x.id === l.id ? l : x)))}
              onEliminar={(id) => setLotes((prev) => prev.filter((x) => x.id !== id))}
              onVerExpediente={(id) => {
                setLoteAbierto(id)
                setPestana('expediente')
              }}
            />
          )}
          {pestana === 'expediente' && lote && (
            <Expediente
              lote={lote}
              parcelas={parcelasEUDR}
              cooperativa={cooperativa}
              onVolver={() => setPestana('lotes')}
            />
          )}
          {pestana === 'ruta' && (
            <Ruta
              cooperativa={cooperativa}
              parcelas={parcelasEUDR}
              lotes={lotes}
              estados={docs}
              onCambiar={(id, estado) => setDocs((prev) => ({ ...prev, [id]: estado }))}
            />
          )}
          {pestana === 'vitrina' && (
            <Vitrina
              cooperativa={cooperativa}
              parcelas={parcelasEUDR}
              perfil={perfil}
              onCambiar={setPerfil}
            />
          )}
        </div>
      )}

      <nav className="nav-flotante" aria-label="Recorrido de Waylla">
        <button className="nav-inicio" onClick={volverInicio} title="Volver a la portada">
          Inicio
        </button>

        <span className="nav-sep" aria-hidden="true" />

        <button
          className="nav-mover"
          onClick={() => irAPaso(iPaso - 1)}
          disabled={iPaso <= 0}
          title="Paso anterior"
        >
          ‹ Anterior
        </button>

        {PASOS.map((x, i) => (
          <button
            key={x.id}
            className={pasoActivo === x.id ? 'activa' : ''}
            onClick={() => irAPaso(i)}
            aria-current={pasoActivo === x.id ? 'step' : undefined}
          >
            <span className="paso-marca">{x.n}</span>
            {x.titulo}
            {x.id === 'parcelas' && parcelas.length > 0 && (
              <span className="cuenta">{parcelas.length}</span>
            )}
            {x.id === 'lotes' && lotes.length > 0 && <span className="cuenta">{lotes.length}</span>}
            {x.id === 'lotes' && bloqueados > 0 && (
              <span className="alerta-punto" title="Lote bloqueado" />
            )}
          </button>
        ))}

        <button
          className="nav-mover"
          onClick={() => irAPaso(iPaso + 1)}
          disabled={iPaso >= PASOS.length - 1}
          title="Paso siguiente"
        >
          Siguiente ›
        </button>
      </nav>
    </>
  )
}

export default App
