// -------------------------------------------------------------------
// Waylla · Servidor puente hacia Whisp (motor EUDR de la FAO / Open Foris)
//
// El frontend no puede llamar a Whisp directamente porque:
//   1) la clave de API no debe quedar expuesta en el navegador, y
//   2) Whisp usa un flujo asíncrono (enviar -> consultar estado -> resultado).
//
// Este servidor recibe el polígono de una parcela, consulta Whisp y
// devuelve un veredicto simple: { estado: 'limpia'|'alerta'|'riesgo', detalle }.
//
// SIN clave configurada -> responde en modo SIMULADO (claramente etiquetado),
// para poder probar el flujo completo antes de registrarte.
// -------------------------------------------------------------------

import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

const PORT = process.env.PORT || 8787
const WHISP_API_KEY = process.env.WHISP_API_KEY || ''
// Base de la API de Whisp. Verifica la URL vigente en la documentación de Open Foris.
const WHISP_BASE = process.env.WHISP_BASE_URL || 'https://whisp.openforis.org/api'

// Espera n milisegundos
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// Traduce la respuesta de Whisp a nuestro semáforo.
// Whisp devuelve indicadores por parcela (p. ej. pérdida de bosque posterior a 2020).
// Ajustaremos los nombres de campo exactos cuando veamos una respuesta real con tu clave.
function interpretarWhisp(resultado) {
  const txt = JSON.stringify(resultado).toLowerCase()
  // Señales de deforestación posterior a la línea base -> riesgo
  if (
    txt.includes('"eudr_risk":"high"') ||
    txt.includes('tree_cover_loss_after_2020') ||
    txt.includes('deforestation') && txt.includes('high')
  ) {
    return { estado: 'riesgo', detalle: 'Whisp: indicios de deforestación posterior a 2020.' }
  }
  if (txt.includes('"eudr_risk":"low"') || txt.includes('no_deforestation')) {
    return { estado: 'limpia', detalle: 'Whisp: sin deforestación posterior a 2020.' }
  }
  return { estado: 'alerta', detalle: 'Whisp: revisar manualmente (riesgo indeterminado).' }
}

// Llama a la API real de Whisp (flujo enviar -> consultar -> resultado)
async function consultarWhisp(geojson) {
  const cab = { 'Content-Type': 'application/json', 'X-API-KEY': WHISP_API_KEY }

  const envio = await fetch(`${WHISP_BASE}/submit/geojson`, {
    method: 'POST',
    headers: cab,
    body: JSON.stringify(geojson),
  })
  if (!envio.ok) throw new Error(`submit devolvió ${envio.status}`)
  const { token } = await envio.json()

  // Consulta el estado hasta que termine (máx. ~30 s)
  for (let i = 0; i < 30; i++) {
    await dormir(1000)
    const est = await fetch(`${WHISP_BASE}/status/${token}`, { headers: cab })
    if (!est.ok) continue
    const info = await est.json()
    if (info.status === 'completed' || info.status === 'done' || info.result) {
      const res = await fetch(`${WHISP_BASE}/generate-geojson/${token}`, { headers: cab })
      return interpretarWhisp(await res.json())
    }
    if (info.status === 'failed' || info.status === 'error') {
      throw new Error('Whisp reportó un error en el análisis')
    }
  }
  throw new Error('Whisp tardó demasiado en responder')
}

// Modo simulado: veredicto etiquetado como demo, según el centroide del polígono.
// NO es evidencia real; sirve solo para probar el flujo sin clave.
function simular(geojson) {
  try {
    const anillo = geojson.features[0].geometry.coordinates[0]
    const latProm = anillo.reduce((s, c) => s + c[1], 0) / anillo.length
    // Regla arbitraria de demostración
    const estados = ['limpia', 'alerta', 'riesgo']
    const idx = Math.abs(Math.round(latProm * 1000)) % 3
    return {
      estado: estados[idx],
      detalle: 'SIMULADO (sin clave Whisp) — solo para probar el flujo, no es evidencia real.',
    }
  } catch {
    return { estado: 'alerta', detalle: 'SIMULADO (sin clave Whisp).' }
  }
}

app.post('/verificar', async (req, res) => {
  const geojson = req.body
  if (!geojson?.features?.length) {
    return res.status(400).json({ error: 'Se esperaba un FeatureCollection con una parcela.' })
  }
  try {
    if (WHISP_API_KEY) {
      const r = await consultarWhisp(geojson)
      return res.json(r)
    }
    return res.json(simular(geojson))
  } catch (err) {
    console.error(err)
    return res.status(502).json({ error: `Fallo consultando Whisp: ${err.message}` })
  }
})

app.get('/', (_req, res) =>
  res.json({ ok: true, modo: WHISP_API_KEY ? 'whisp-real' : 'simulado' }),
)

app.listen(PORT, () => {
  console.log(`Waylla server escuchando en http://localhost:${PORT}`)
  console.log(`Modo: ${WHISP_API_KEY ? 'Whisp REAL' : 'SIMULADO (configura WHISP_API_KEY para el real)'}`)
})
