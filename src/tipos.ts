// Modelo de datos compartido por todo Waylla.
// La cadena que exige el EUDR es: parcela -> socio -> lote -> expediente.

export type Estado = 'limpia' | 'alerta' | 'riesgo'

/** Cómo se determinó el estado de la parcela. */
export type Fuente = 'offline' | 'gfw' | 'whisp'

export type Producto = 'café' | 'cacao'

export interface Parcela {
  id: string
  socio: string
  comunidad: string
  vertices: [number, number][] // [lat, lng]
  areaHa: number
  estado: Estado
  fuente: Fuente
  detalle?: string
  fecha: string // ISO, día del levantamiento
  verificando?: boolean
}

export interface Lote {
  id: string
  codigo: string // p. ej. LOTE-2026-014
  producto: Producto
  pesoKg: number
  campana: string // p. ej. 2026-2027
  comprador: string // importador europeo
  parcelaIds: string[]
  fecha: string // ISO
}

export type EstadoLote = 'listo' | 'observado' | 'bloqueado' | 'vacio'

export interface Diagnostico {
  estado: EstadoLote
  parcelas: Parcela[]
  areaHa: number
  socios: number
  enRiesgo: Parcela[]
  enAlerta: Parcela[]
  sinVerificar: Parcela[]
  sobre4ha: number
  rendimientoKgHa: number
}

export const ETIQUETA_FUENTE: Record<Fuente, string> = {
  offline: 'sin verificar',
  gfw: 'verificado GFW',
  whisp: 'verificado Whisp',
}

export const COLORES: Record<Estado, string> = {
  limpia: '#2eae60',
  alerta: '#e9b44c',
  riesgo: '#d64545',
}

/**
 * Evalúa si un lote puede exportarse. Una sola parcela en riesgo bloquea
 * el embarque completo: así funciona la responsabilidad del operador bajo
 * el Reglamento (UE) 2023/1115.
 */
export function diagnosticarLote(lote: Lote, todas: Parcela[]): Diagnostico {
  const parcelas = todas.filter((p) => lote.parcelaIds.includes(p.id))
  const enRiesgo = parcelas.filter((p) => p.estado === 'riesgo')
  const enAlerta = parcelas.filter((p) => p.estado === 'alerta')
  const sinVerificar = parcelas.filter((p) => p.fuente === 'offline')
  const areaHa = parcelas.reduce((s, p) => s + p.areaHa, 0)

  let estado: EstadoLote = 'listo'
  if (parcelas.length === 0) estado = 'vacio'
  else if (enRiesgo.length > 0) estado = 'bloqueado'
  else if (enAlerta.length > 0 || sinVerificar.length > 0) estado = 'observado'

  return {
    estado,
    parcelas,
    areaHa,
    socios: new Set(parcelas.map((p) => p.socio)).size,
    enRiesgo,
    enAlerta,
    sinVerificar,
    sobre4ha: parcelas.filter((p) => p.areaHa > 4).length,
    rendimientoKgHa: areaHa > 0 ? lote.pesoKg / areaHa : 0,
  }
}

export const ROTULO_LOTE: Record<EstadoLote, string> = {
  listo: 'Listo para embarcar',
  observado: 'Con observaciones',
  bloqueado: 'Embarque bloqueado',
  vacio: 'Sin parcelas asignadas',
}
