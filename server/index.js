// -------------------------------------------------------------------
// Waylla · Servidor de verificación de deforestación (EUDR)
//
// Dos motores de análisis:
//   A) HANSEN/GFW (por defecto, SIN clave): lee los píxeles reales de
//      pérdida de bosque de Global Forest Watch (dataset Hansen/UMD) que
//      caen dentro del polígono de la parcela. Si hay pérdida dentro -> riesgo.
//   B) WHISP (opcional, con clave): motor oficial de la FAO (Open Foris).
//      Se activa si defines WHISP_API_KEY.
//
// El frontend manda un polígono y recibe { estado, detalle, fuente }.
// -------------------------------------------------------------------

import express from 'express'
import cors from 'cors'
import { PNG } from 'pngjs'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

const PORT = process.env.PORT || 8787
const WHISP_API_KEY = process.env.WHISP_API_KEY || ''
const WHISP_BASE = process.env.WHISP_BASE_URL || 'https://whisp.openforis.org/api'
// Versión del dataset Hansen Global Forest Change (mismos tiles que muestra el mapa)
const GFC_VERSION = process.env.GFC_VERSION || 'gfc_v1.11'
const Z = 12 // nivel de zoom de los tiles Hansen (máximo nativo)
const BUFFER_PX = 4 // margen (en píxeles) para marcar "alerta" por cercanía
const RIESGO_HA = 0.5 // pérdida mínima dentro de la parcela para marcar "riesgo"

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Matemática de tiles (Web Mercator / slippy map) ----------

function lngLatAPixelGlobal(lng, lat, z) {
  const n = Math.pow(2, z)
  const x = ((lng + 180) / 360) * n * 256
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n * 256
  return { x, y }
}

function pixelGlobalALngLat(x, y, z) {
  const n = Math.pow(2, z)
  const lng = (x / (n * 256)) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (n * 256))))
  const lat = (latRad * 180) / Math.PI
  return { lng, lat }
}

// Punto dentro de polígono (ray casting). anillo = [[lng,lat], ...]
function puntoEnPoligono(lng, lat, anillo) {
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const xi = anillo[i][0]
    const yi = anillo[i][1]
    const xj = anillo[j][0]
    const yj = anillo[j][1]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro
    }
  }
  return dentro
}

// ¿Es un píxel de pérdida de bosque? (los tiles loss_alpha son rojizos)
function esPerdida(r, g, b, a) {
  return a > 10 && r > 120 && r > g + 40 && r > b + 40
}

// Descarga y decodifica un tile Hansen; devuelve el objeto PNG o null.
async function traerTile(tx, ty) {
  const url = `https://storage.googleapis.com/earthenginepartners-hansen/tiles/${GFC_VERSION}/loss_alpha/${Z}/${tx}/${ty}.png`
  const resp = await fetch(url)
  if (!resp.ok) return null
  const buf = Buffer.from(await resp.arrayBuffer())
  return PNG.sync.read(buf)
}

// Analiza el polígono contra los tiles reales de Hansen/GFW.
export async function analizarHansen(anillo) {
  // Caja envolvente en píxeles globales (con margen para "alerta")
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [lng, lat] of anillo) {
    const p = lngLatAPixelGlobal(lng, lat, Z)
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  minX -= BUFFER_PX
  minY -= BUFFER_PX
  maxX += BUFFER_PX
  maxY += BUFFER_PX

  const cache = new Map()
  let dentro = 0
  let cerca = 0

  for (let gx = Math.floor(minX); gx <= Math.floor(maxX); gx++) {
    for (let gy = Math.floor(minY); gy <= Math.floor(maxY); gy++) {
      const tx = Math.floor(gx / 256)
      const ty = Math.floor(gy / 256)
      const key = `${tx}/${ty}`
      if (!cache.has(key)) cache.set(key, await traerTile(tx, ty))
      const png = cache.get(key)
      if (!png) continue
      const px = gx - tx * 256
      const py = gy - ty * 256
      if (px < 0 || py < 0 || px >= png.width || py >= png.height) continue
      const idx = (png.width * py + px) << 2
      if (!esPerdida(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3])) continue
      // Es un píxel de pérdida: ¿está dentro del polígono?
      const { lng, lat } = pixelGlobalALngLat(gx + 0.5, gy + 0.5, Z)
      if (puntoEnPoligono(lng, lat, anillo)) dentro++
      else cerca++
    }
  }

  if (cache.size > 0 && [...cache.values()].every((v) => v === null)) {
    throw new Error('No se pudieron leer los tiles de Hansen (¿versión GFC_VERSION correcta?)')
  }

  // Área aproximada de cada píxel a este zoom y latitud (en hectáreas)
  const latC = anillo.reduce((s, c) => s + c[1], 0) / anillo.length
  const mppx = (156543.03392 * Math.cos((latC * Math.PI) / 180)) / Math.pow(2, Z)
  const haPorPixel = (mppx * mppx) / 10000
  const perdidaHa = dentro * haPorPixel

  // Clasificación con umbral: un píxel histórico aislado no condena la parcela.
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
          ? `Hansen/GFW: pérdida menor dentro de la parcela (~${perdidaHa.toFixed(2)} ha); revisar.`
          : `Hansen/GFW: pérdida de bosque cerca del borde.`,
    }
  }
  return {
    estado: 'limpia',
    fuente: 'gfw',
    detalle: 'Hansen/GFW: sin pérdida de bosque detectada dentro ni cerca de la parcela.',
  }
}

// ---------- Motor B: Whisp (opcional, con clave) ----------

function interpretarWhisp(resultado) {
  const txt = JSON.stringify(resultado).toLowerCase()
  if (
    txt.includes('"eudr_risk":"high"') ||
    txt.includes('tree_cover_loss_after_2020') ||
    (txt.includes('deforestation') && txt.includes('high'))
  ) {
    return { estado: 'riesgo', fuente: 'whisp', detalle: 'Whisp: indicios de deforestación posterior a 2020.' }
  }
  if (txt.includes('"eudr_risk":"low"') || txt.includes('no_deforestation')) {
    return { estado: 'limpia', fuente: 'whisp', detalle: 'Whisp: sin deforestación posterior a 2020.' }
  }
  return { estado: 'alerta', fuente: 'whisp', detalle: 'Whisp: riesgo indeterminado, revisar manualmente.' }
}

async function consultarWhisp(geojson) {
  const cab = { 'Content-Type': 'application/json', 'X-API-KEY': WHISP_API_KEY }
  const envio = await fetch(`${WHISP_BASE}/submit/geojson`, {
    method: 'POST',
    headers: cab,
    body: JSON.stringify(geojson),
  })
  if (!envio.ok) throw new Error(`submit devolvió ${envio.status}`)
  const { token } = await envio.json()
  for (let i = 0; i < 30; i++) {
    await dormir(1000)
    const est = await fetch(`${WHISP_BASE}/status/${token}`, { headers: cab })
    if (!est.ok) continue
    const info = await est.json()
    if (info.status === 'completed' || info.status === 'done' || info.result) {
      const res = await fetch(`${WHISP_BASE}/generate-geojson/${token}`, { headers: cab })
      return interpretarWhisp(await res.json())
    }
    if (info.status === 'failed' || info.status === 'error') throw new Error('Whisp reportó un error')
  }
  throw new Error('Whisp tardó demasiado en responder')
}

// ---------- Endpoint ----------

app.post('/verificar', async (req, res) => {
  const geojson = req.body
  const anillo = geojson?.features?.[0]?.geometry?.coordinates?.[0]
  if (!anillo || anillo.length < 4) {
    return res.status(400).json({ error: 'Se esperaba un polígono válido (FeatureCollection).' })
  }
  try {
    if (WHISP_API_KEY) return res.json(await consultarWhisp(geojson))
    return res.json(await analizarHansen(anillo))
  } catch (err) {
    console.error(err)
    return res.status(502).json({ error: `Fallo en el análisis: ${err.message}` })
  }
})

app.get('/', (_req, res) =>
  res.json({ ok: true, motor: WHISP_API_KEY ? 'whisp' : 'hansen-gfw', version: GFC_VERSION }),
)

app.listen(PORT, () => {
  console.log(`Waylla server en http://localhost:${PORT}`)
  console.log(`Motor: ${WHISP_API_KEY ? 'Whisp (FAO)' : `Hansen/GFW real, ${GFC_VERSION}`}`)
})
