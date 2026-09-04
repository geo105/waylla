// Guarda el trabajo del técnico en el navegador para que no se pierda
// al recargar la página ni al perder la señal en campo.

import type { Lote, Parcela } from './tipos'
import type { EstadoDoc } from './Ruta'
import { PERFIL_VACIO, type Perfil } from './Vitrina'

const CLAVE = 'waylla.v1'

interface Guardado {
  parcelas: Parcela[]
  lotes: Lote[]
  cooperativa: string
  /** Estado manual de los documentos de la ruta al mercado. */
  docs: Record<string, EstadoDoc>
  /** Ficha pública de la organización en la vitrina. */
  perfil: Perfil
}

const VACIO: Guardado = {
  parcelas: [],
  lotes: [],
  cooperativa: '',
  docs: {},
  perfil: PERFIL_VACIO,
}

export function cargar(): Guardado {
  try {
    const crudo = window.localStorage.getItem(CLAVE)
    if (!crudo) return VACIO
    const datos = JSON.parse(crudo) as Partial<Guardado>
    return {
      parcelas: Array.isArray(datos.parcelas) ? datos.parcelas : [],
      lotes: Array.isArray(datos.lotes) ? datos.lotes : [],
      cooperativa: typeof datos.cooperativa === 'string' ? datos.cooperativa : '',
      docs: datos.docs && typeof datos.docs === 'object' ? datos.docs : {},
      perfil: { ...PERFIL_VACIO, ...(datos.perfil ?? {}) },
    }
  } catch {
    // Navegador en modo privado o almacenamiento bloqueado: se sigue sin guardar.
    return VACIO
  }
}

export function guardar(datos: Guardado): void {
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(datos))
  } catch {
    /* sin persistencia disponible; la sesión sigue funcionando en memoria */
  }
}

export function borrarTodo(): void {
  try {
    window.localStorage.removeItem(CLAVE)
  } catch {
    /* nada que hacer */
  }
}
