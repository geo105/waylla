# Waylla

Prototipo web de **trazabilidad libre de deforestación** para café y cacao peruano,
desarrollado para la **Disruptón 2026** (UTEC) — Eje 1: Sistemas de trazabilidad,
calidad y verificación.

## ¿Qué hace?

- Muestra un **mapa satelital** (Esri World Imagery) centrado en zona cafetalera de Jaén, Cajamarca.
- Permite **delimitar parcelas** haciendo clic en los vértices del perímetro (simula al técnico caminando la parcela).
- Calcula el **área en hectáreas** y evalúa un **semáforo de riesgo** cruzando cada polígono
  con zonas de deforestación posteriores al 31/12/2020 (datos de demostración; en producción
  vendrían de Sentinel-2 / Global Forest Watch).
- Exporta las parcelas como **GeoJSON con 6 decimales de precisión**, el formato que exige
  el reglamento europeo EUDR (UE 2023/1115).

## Cómo correrlo

```bash
npm install
npm run dev
```

## Stack

Vite + React 19 + TypeScript + Leaflet.

## Equipo

Proyecto del equipo [NOMBRE DEL EQUIPO] para la Disruptón 2026 — UTEC.
