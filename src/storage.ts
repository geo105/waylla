import { Preferences } from '@capacitor/preferences'

export type Estado = 'limpia' | 'alerta' | 'riesgo'
export type Fuente = 'offline' | 'gfw' | 'whisp'

export interface OfflineParcel {
  id: string
  socio: string
  vertices: [number, number][]
  areaHa: number
  estado: Estado
  fuente: Fuente
  detalle?: string
}

const PARCELS_KEY = 'waylla.parcels.v1'

function isOfflineParcel(value: unknown): value is OfflineParcel {
  if (!value || typeof value !== 'object') return false
  const parcel = value as Partial<OfflineParcel>
  return (
    typeof parcel.id === 'string' &&
    typeof parcel.socio === 'string' &&
    typeof parcel.areaHa === 'number' &&
    Array.isArray(parcel.vertices) &&
    parcel.vertices.length >= 3 &&
    parcel.vertices.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number',
    ) &&
    (parcel.estado === 'limpia' || parcel.estado === 'alerta' || parcel.estado === 'riesgo') &&
    (parcel.fuente === 'offline' || parcel.fuente === 'gfw' || parcel.fuente === 'whisp')
  )
}

/**
 * Returns null when this device has never saved parcels. An empty array means
 * the user intentionally cleared the local database, so demo records must not
 * be recreated on the next launch.
 */
export async function loadOfflineParcels(): Promise<OfflineParcel[] | null> {
  const { value } = await Preferences.get({ key: PARCELS_KEY })
  if (value === null) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    return parsed.filter(isOfflineParcel)
  } catch {
    return null
  }
}

export async function saveOfflineParcels(parcels: OfflineParcel[]): Promise<void> {
  await Preferences.set({ key: PARCELS_KEY, value: JSON.stringify(parcels) })
}

