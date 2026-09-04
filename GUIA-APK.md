# Waylla Campo Offline — guía de instalación

Esta edición se instala en Android como un archivo `.apk`. No necesita un servidor de ChatGPT,
Node ni una laptop para abrirse. El mapa satelital y la búsqueda de ciudades sí requieren señal;
la captura, el semáforo demostrativo, el guardado y la exportación de parcelas funcionan sin ella.

## Crear el APK en esta computadora

Requisitos: Android Studio 2025.2.1 o posterior, JDK 21 y Android SDK 36.

```powershell
npm ci
npm run android:apk
```

El archivo se crea en:

`android\app\build\outputs\apk\debug\app-debug.apk`

## Crear el APK desde GitHub

1. Sube estos cambios al repositorio de Waylla.
2. En GitHub abre **Actions** → **Crear APK Android** → **Run workflow**.
3. Cuando termine, abre la ejecución y descarga el artefacto **waylla-campo-apk**.
4. Descomprime el ZIP para obtener `app-debug.apk`.

GitHub solo se usa para compilar el archivo. Una vez instalado, Waylla se ejecuta localmente en el
teléfono.

## Instalar en el teléfono

1. Envía `app-debug.apk` al teléfono por cable, Drive, WhatsApp o correo.
2. Ábrelo desde **Archivos**.
3. Android pedirá autorizar **Instalar apps desconocidas** para esa aplicación; habilítalo solo para
   completar esta instalación.
4. Pulsa **Instalar** y abre **Waylla Campo**.

## Prueba rápida antes de la feria

1. Abre **Jaén (Cajamarca) · demo**.
2. Activa modo avión.
3. Pulsa **Nueva parcela**, marca al menos tres puntos y elige **Cerrar y guardar**.
4. Cierra por completo Waylla y vuelve a abrirla: la parcela debe seguir allí.
5. Pulsa **Compartir GeoJSON** y envía el archivo a otro teléfono.

Usa datos ficticios durante la feria. El semáforo offline es una demostración preliminar y no
constituye por sí solo una verificación EUDR oficial. Desinstalar la app borra los datos locales.
