// ---------------------------------------------------------------
// Verificación de deforestación directamente en el navegador.
//
// Repite el mismo análisis que hace el servidor (carpeta server/) pero
// leyendo los tiles de Hansen/Global Forest Watch con un canvas, sin
// backend. Sirve para que la verificación funcione en la web publicada,
// donde no hay servidor corriendo.
//
// Puede fallar si el servidor de tiles no autoriza la lectura de píxeles
// desde otro dominio (CORS). En ese caso se avisa y el semáforo sin
// conexión sigue siendo válido.
// ---------------------------------------------------------------

import type { Estado, Fuente } from './tipos'

export interface Veredicto {
  estado: Estado
  fuente: Fuente
  detalle: string
}

const GFC_VERSION = 'gfc_v1.11'
const Z = 12 // zoom máximo con tiles nativos
const BUFFER_PX = 4 // margen en píxeles para marcar "alerta" por cercanía
const RIESGO_HA = 0.5 // pérdida mínima dentro de la parcela para marcar "riesgo"
const MAX_TILES = 12 // tope de descargas por parcela

// --- Matemática de tiles (Web Mercator) ---

function lngLatAPixelGlobal(lng: number, lat: number) {
  const n = Math.pow(2, Z)
  const x = ((lng + 180) / 360) * n * 256
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n * 256
  return { x, y }
}

function pixelGlobalALngLat(x: number, y: number) {
  const n = Math.pow(2, Z)
  const lng = (x / (n * 256)) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (n * 256))))
  return { lng, lat: (latRad * 180) / Math.PI }
}

/** anillo = [[lng, lat], ...] */
function puntoEnPoligono(lng: number, lat: number, anillo: [number, number][]) {
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}

/** Los tiles loss_alpha marcan la pérdida con píxeles rojizos. */
function esPerdida(r: number, g: number, b: number, a: number) {
  return a > 10 && r > 120 && r > g + 40 && r > b + 40
}

// --- Lectura de tiles ---

function cargarTile(tx: number, ty: number): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const corta = setTimeout(() => resolve(null), 9000)

    img.onload = () => {
      clearTimeout(corta)
      try {
        const cv = document.createElement('canvas')
        cv.width = img.naturalWidth || 256
        cv.height = img.naturalHeight || 256
        const g = cv.getContext('2d', { willReadFrequently: true })
        if (!g) return resolve(null)
        g.drawImage(img, 0, 0)
        // Si el servidor no autorizó la lectura, esto lanza SecurityError.
        resolve(g.getImageData(0, 0, cv.width, cv.height))
      } catch {
        resolve(null)
      }
    }

    img.onerror = () => {
      clearTimeout(corta)
      resolve(null)
    }

    img.src = `https://storage.googleapis.com/earthenginepartners-hansen/tiles/${GFC_VERSION}/loss_alpha/${Z}/${tx}/${ty}.png`
  })
}

// --- Análisis ---

export async function analizarEnNavegador(anillo: [number, number][]): Promise<Veredicto> {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [lng, lat] of anillo) {
    const p = lngLatAPixelGlobal(lng, lat)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  minX -= BUFFER_PX
  minY -= BUFFER_PX
  maxX += BUFFER_PX
  maxY += BUFFER_PX

  // Qué tiles hacen falta
  const tiles = new Map<string, ImageData | null>()
  const pedidos: { tx: number; ty: number; key: string }[] = []
  for (let tx = Math.floor(minX / 256); tx <= Math.floor(maxX / 256); tx++) {
    for (let ty = Math.floor(minY / 256); ty <= Math.floor(maxY / 256); ty++) {
      const key = `${tx}/${ty}`
      if (!tiles.has(key)) {
        tiles.set(key, null)
        pedidos.push({ tx, ty, key })
      }
    }
  }

  if (pedidos.length > MAX_TILES) {
    throw new Error('La parcela abarca demasiado terreno para analizarla en el navegador.')
  }

  const datos = await Promise.all(pedidos.map((p) => cargarTile(p.tx, p.ty)))
  pedidos.forEach((p, i) => tiles.set(p.key, datos[i]))

  if ([...tiles.values()].every((v) => v === null)) {
    throw new Error(
      'El navegador no pudo leer los datos satelitales de Global Forest Watch (el servidor de tiles no autoriza la lectura desde esta página).',
    )
  }

  let dentro = 0
  let cerca = 0

  for (let gx = Math.floor(minX); gx <= Math.floor(maxX); gx++) {
    for (let gy = Math.floor(minY); gy <= Math.floor(maxY); gy++) {
      const tx = Math.floor(gx / 256)
      const ty = Math.floor(gy / 256)
      const img = tiles.get(`${tx}/${ty}`)
      if (!img) continue
      const px = gx - tx * 256
      const py = gy - ty * 256
      if (px < 0 || py < 0 || px >= img.width || py >= img.height) continue
      const i = (img.width * py + px) << 2
      if (!esPerdida(img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3])) continue
      const { lng, lat } = pixelGlobalALngLat(gx + 0.5, gy + 0.5)
      if (puntoEnPoligono(lng, lat, anillo)) dentro++
      else cerca++
    }
  }

  // Superficie que representa cada píxel a este zoom y latitud
  const latC = anillo.reduce((s, c) => s + c[1], 0) / anillo.length
  const mppx = (156543.03392 * Math.cos((latC * Math.PI) / 180)) / Math.pow(2, Z)
  const haPorPixel = (mppx * mppx) / 10000
  const perdidaHa = dentro * haPorPixel

  if (perdidaHa >= RIESGO_HA) {
    return {
      estado: 'riesgo',
      fuente: 'gfw',
      detalle: `Hansen/GFW: ~${perdidaHa.toFixed(2)} ha de pérdida de bosque dentro de la parcela.`,
    }
  }
  if (dentro > 0 || cerca > 0) {
    return {
      estado: 'alerta',
      fuente: 'gfw',
      detalle:
        dentro > 0
          ? `Hansen/GFW: pérdida menor dentro de la parcela (~${perdidaHa.toFixed(2)} ha); conviene revisar.`
          : 'Hansen/GFW: pérdida de bosque detectada cerca del borde.',
    }
  }
  return {
    estado: 'limpia',
    fuente: 'gfw',
    detalle: 'Hansen/GFW: sin pérdida de cobertura arbórea dentro ni junto a la parcela.',
  }
}
