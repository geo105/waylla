# Servidor Waylla → Whisp

Este pequeño servidor conecta la app Waylla con **Whisp**, el motor de análisis
de deforestación de la FAO (Open Foris) usado para el cumplimiento del EUDR.

## ¿Por qué hace falta un servidor?

La app (el navegador) no puede llamar a Whisp directamente porque la clave de API
no debe quedar expuesta y porque Whisp usa un flujo asíncrono. Este servidor guarda
la clave de forma segura y hace las llamadas por ti.

## Cómo correrlo

```bash
cd server
npm install
npm start
```

Verás `Waylla server escuchando en http://localhost:8787`.

- **Sin clave:** funciona en **modo simulado** (devuelve un veredicto de demostración,
  claramente etiquetado). Sirve para probar que todo el flujo funciona.
- **Con clave real:** regístrate gratis en <https://whisp.openforis.org>, copia
  `.env.example` como `.env`, pega tu `WHISP_API_KEY`, y reinicia. Ahora el veredicto
  es real, calculado por Whisp sobre datos satelitales.

## Cómo lo usa la app

En Waylla, dale a **"Verificar con Whisp (online)"**. La app manda cada parcela a
`POST http://localhost:8787/verificar` y recibe `{ estado, detalle }`, que actualiza
el color del semáforo y marca la parcela como verificada.

> Nota: los nombres exactos de los campos que devuelve Whisp pueden variar. Cuando
> tengas tu clave y veamos una respuesta real, ajustamos la función `interpretarWhisp`
> en `index.js` (está comentada para eso).
