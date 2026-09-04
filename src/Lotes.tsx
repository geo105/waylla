import { useState } from 'react'
import './Lotes.css'
import {
  COLORES,
  diagnosticarLote,
  ROTULO_LOTE,
  type Lote,
  type Parcela,
  type Producto,
} from './tipos'

interface Props {
  parcelas: Parcela[]
  lotes: Lote[]
  onCrear: (lote: Lote) => void
  onActualizar: (lote: Lote) => void
  onEliminar: (id: string) => void
  onVerExpediente: (id: string) => void
}

const hoy = () => new Date().toISOString().slice(0, 10)

function codigoSugerido(n: number) {
  return `LOTE-${new Date().getFullYear()}-${String(n + 1).padStart(3, '0')}`
}

export default function Lotes({
  parcelas,
  lotes,
  onCrear,
  onActualizar,
  onEliminar,
  onVerExpediente,
}: Props) {
  const [creando, setCreando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(lotes[0]?.id ?? null)

  const [producto, setProducto] = useState<Producto>('café')
  const [pesoKg, setPesoKg] = useState('1200')
  const [comprador, setComprador] = useState('')
  const [campana, setCampana] = useState('2026-2027')

  const crear = (e: React.FormEvent) => {
    e.preventDefault()
    const lote: Lote = {
      id: `L${Date.now()}`,
      codigo: codigoSugerido(lotes.length),
      producto,
      pesoKg: Number(pesoKg) || 0,
      campana: campana.trim() || '2026-2027',
      comprador: comprador.trim() || 'Importador por asignar',
      parcelaIds: [],
      fecha: hoy(),
    }
    onCrear(lote)
    setAbierto(lote.id)
    setCreando(false)
    setComprador('')
  }

  const alternarParcela = (lote: Lote, parcelaId: string) => {
    const dentro = lote.parcelaIds.includes(parcelaId)
    onActualizar({
      ...lote,
      parcelaIds: dentro
        ? lote.parcelaIds.filter((i) => i !== parcelaId)
        : [...lote.parcelaIds, parcelaId],
    })
  }

  return (
    <div className="lotes">
      <div className="lotes-cab">
        <div>
          <h2>Lotes de exportación</h2>
          <p className="lotes-sub">
            Aquí se une lo que el reglamento exige unir: qué parcelas, de qué socios, entraron en el
            saco que se embarca. Una sola parcela en riesgo detiene el lote completo.
          </p>
        </div>
        {!creando && (
          <button className="btn principal" onClick={() => setCreando(true)}>
            Nuevo lote
          </button>
        )}
      </div>

      {creando && (
        <form className="form-lote" onSubmit={crear}>
          <label>
            Producto
            <select value={producto} onChange={(e) => setProducto(e.target.value as Producto)}>
              <option value="café">Café</option>
              <option value="cacao">Cacao</option>
            </select>
          </label>
          <label>
            Peso (kg)
            <input
              type="number"
              min="1"
              value={pesoKg}
              onChange={(e) => setPesoKg(e.target.value)}
              required
            />
          </label>
          <label>
            Campaña
            <input value={campana} onChange={(e) => setCampana(e.target.value)} />
          </label>
          <label className="ancho">
            Comprador en la UE
            <input
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Nombre del importador"
            />
          </label>
          <div className="form-acciones">
            <button className="btn principal" type="submit">
              Crear lote
            </button>
            <button className="btn" type="button" onClick={() => setCreando(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {lotes.length === 0 && !creando && (
        <p className="vacio">
          Todavía no hay lotes. Crea uno y asígnale las parcelas que aportaron grano.
        </p>
      )}

      <div className="lista-lotes">
        {lotes.map((lote) => {
          const d = diagnosticarLote(lote, parcelas)
          const expandido = abierto === lote.id
          return (
            <article className={`lote ${d.estado}`} key={lote.id}>
              <button
                className="lote-cab"
                onClick={() => setAbierto(expandido ? null : lote.id)}
                aria-expanded={expandido}
              >
                <span className="lote-codigo">{lote.codigo}</span>
                <span className="lote-meta">
                  {lote.producto} · {lote.pesoKg.toLocaleString('es-PE')} kg · {d.parcelas.length}{' '}
                  {d.parcelas.length === 1 ? 'parcela' : 'parcelas'} · {d.socios}{' '}
                  {d.socios === 1 ? 'socio' : 'socios'} · {d.areaHa.toFixed(1)} ha
                </span>
                <span className={`estado-lote ${d.estado}`}>{ROTULO_LOTE[d.estado]}</span>
              </button>

              {expandido && (
                <div className="lote-cuerpo">
                  {d.estado === 'bloqueado' && (
                    <p className="aviso rojo">
                      No se puede emitir el expediente: {d.enRiesgo.map((p) => p.id).join(', ')}{' '}
                      {d.enRiesgo.length === 1 ? 'presenta' : 'presentan'} pérdida de bosque
                      posterior al 31/12/2020. Retira esas parcelas del lote o sustenta el caso ante
                      el comprador.
                    </p>
                  )}
                  {d.estado === 'observado' && (
                    <p className="aviso ambar">
                      {d.sinVerificar.length > 0 &&
                        `${d.sinVerificar.length} ${
                          d.sinVerificar.length === 1 ? 'parcela' : 'parcelas'
                        } sin verificación satelital. `}
                      {d.enAlerta.length > 0 &&
                        `${d.enAlerta.length} en alerta por cercanía a zona deforestada. `}
                      Se puede emitir el expediente, pero conviene resolverlo antes del embarque.
                    </p>
                  )}
                  {d.estado === 'listo' && (
                    <p className="aviso verde">
                      Todas las parcelas verificadas y sin pérdida de bosque. El expediente está
                      listo para entregarse al comprador.
                    </p>
                  )}

                  <div className="asignar">
                    <h3>Parcelas del lote</h3>
                    {parcelas.length === 0 ? (
                      <p className="vacio pequeno">
                        Primero mapea parcelas en la pestaña Parcelas.
                      </p>
                    ) : (
                      <ul className="check-parcelas">
                        {parcelas.map((p) => (
                          <li key={p.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={lote.parcelaIds.includes(p.id)}
                                onChange={() => alternarParcela(lote, p.id)}
                              />
                              <span
                                className="punto"
                                style={{ background: COLORES[p.estado] }}
                                aria-hidden="true"
                              />
                              <span className="cp-id">{p.id}</span>
                              <span className="cp-socio">{p.socio}</span>
                              <span className="cp-ha">{p.areaHa.toFixed(2)} ha</span>
                              <span className={`cp-estado ${p.estado}`}>{p.estado}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="lote-acciones">
                    <button
                      className="btn principal"
                      onClick={() => onVerExpediente(lote.id)}
                      disabled={d.parcelas.length === 0}
                    >
                      Ver expediente
                    </button>
                    <button className="btn peligro" onClick={() => onEliminar(lote.id)}>
                      Eliminar lote
                    </button>
                  </div>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
