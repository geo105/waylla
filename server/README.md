# Servidor de verificación de Waylla

Este servidor recibe el polígono de una parcela y devuelve un veredicto de
deforestación `{ estado, detalle, fuente }` que la app usa para pintar el semáforo.

Tiene **dos motores**:

## Motor A — Hansen / Global Forest Watch (por defecto, SIN clave) ✅

Lee los **píxeles reales de pérdida de bosque** de Global Forest Watch (dataset
Hansen/UMD) —los mismos puntos rojos que ves en el mapa— y comprueba si caen
dentro del polígono de la parcela:

- pérdida **dentro** del polígono → `riesgo`
- pérdida **cerca** del borde → `alerta`
- **sin** pérdida → `limpia`

No necesita clave ni registro. Funciona apenas lo enciendes.

## Motor B — Whisp / FAO (opcional, con clave)

Si defines `WHISP_API_KEY`, el servidor usa **Whisp** (Open Foris, FAO), el motor
oficial de análisis EUDR. Copia `.env.example` como `.env` y pega tu clave.

## Cómo correrlo

```bash
cd server
npm install
npm start
```

Verás `Motor: Hansen/GFW real, gfc_v1.11`. Deja esta terminal abierta.

En la app, dale a **"Verificar deforestación (online)"**: cada parcela se manda a
`POST http://localhost:8787/verificar` y el semáforo se actualiza con el resultado
real, marcando la parcela con el badge **✓ GFW** (o **✓ Whisp** si usas ese motor).

## Notas

- Si la capa no carga o el análisis falla, revisa `GFC_VERSION` (por defecto
  `gfc_v1.11`). Súbela si Global Forest Watch publica una versión más nueva.
- Los tiles Hansen muestran pérdida acumulada; para un filtrado estricto posterior
  a 2020, el Motor B (Whisp) es más preciso. Para el prototipo, el Motor A ya
  detecta deforestación real bajo la parcela.
