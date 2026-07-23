# Waylla

Prototipo web de **trazabilidad libre de deforestación** para café y cacao peruano,
desarrollado para la **Disruptón 2026** (UTEC) — Eje 1: Sistemas de trazabilidad,
calidad y verificación.

## ¿Qué hace?

- Muestra un **mapa satelital** (Esri World Imagery) centrado en zona cafetalera de Jaén, Cajamarca.
- Superpone una **capa real de pérdida de bosque de Global Forest Watch** (dataset Hansen/UMD),
  que se puede prender o apagar.
- Permite **delimitar parcelas** haciendo clic en los vértices del perímetro (simula al técnico
  caminando la parcela), calcula el **área en hectáreas** y les asigna un **semáforo de riesgo**.
- Tiene **dos modos de verificación**:
  - **Offline** (sin internet): semáforo geométrico rápido, cruzando la parcela con zonas de
    referencia. Pensado para el técnico en campo sin señal.
  - **Online** (botón *Verificar con Whisp*): envía la parcela al motor **Whisp** de la FAO
    (Open Foris), la herramienta oficial de análisis EUDR, y trae el veredicto real.
- Exporta las parcelas como **GeoJSON con 6 decimales de precisión**, el formato que exige
  el reglamento europeo EUDR (UE 2023/1115).

## Cómo correrlo

**App (frontend):**

```bash
npm install
npm run dev
```

**Servidor de Whisp (opcional, para la verificación online):**

```bash
cd server
npm install
npm start
```

Sin clave de Whisp, el servidor funciona en **modo simulado** (útil para probar el flujo).
Para el análisis real, regístrate gratis en <https://whisp.openforis.org> y sigue las
instrucciones de `server/README.md`.

## Stack

Vite + React 19 + TypeScript + Leaflet (frontend) · Express (servidor puente a Whisp).

## Equipo

Proyecto del equipo [NOMBRE DEL EQUIPO] para la Disruptón 2026 — UTEC.
