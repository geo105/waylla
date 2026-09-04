import { useState } from 'react'
import './Vitrina.css'
import type { Parcela } from './tipos'

// ---------------------------------------------------------------
// Vitrina de origen verificado
//
// El segundo pedido de los productores en Expocafé: que la plataforma
// también sirva para que los encuentren. La ficha se arma sola con las
// parcelas ya verificadas, así que el sello no se puede inventar.
// ---------------------------------------------------------------

export interface Perfil {
  altitud: string
  variedades: string
  certificaciones: string
  descripcion: string
  contacto: string
}

export const PERFIL_VACIO: Perfil = {
  altitud: '',
  variedades: '',
  certificaciones: '',
  descripcion: '',
  contacto: '',
}

// Organizaciones con las que el equipo conversó en la Semana del Café del VRAEM 2026.
// Son contactos iniciales, no cuentas registradas: por eso aparecen sin
// sello y sin datos personales de nadie.
const RED = [
  { nombre: 'Cooperativa Agraria Cafetalera El Quinacho', zona: 'Sivia, VRAEM (Ayacucho)', nota: 'Exporta café y cacao; primera de la zona con certificación UTZ.' },
  { nombre: 'Cooperativa Tropical', zona: 'Selva central', nota: 'Interesada en la vitrina y en contactar compradores directos.' },
  { nombre: 'Asociación APROCEK', zona: 'VRAEM', nota: 'Marca propia D\'Elva; vende en ferias y busca canal de exportación.' },
  { nombre: 'Asociación de las Alturas del VRAEM', zona: 'VRAEM', nota: 'Aún sin asesoría para el trámite de exportación.' },
  { nombre: 'Asociación de Productores de Café Villa Vista Chunguilamar', zona: 'Selva central', nota: 'Busca completar los documentos que le faltan para exportar.' },
  { nombre: 'Asociación Caprichos Santa Rosa', zona: 'VRAEM', nota: 'Producción orgánica; sin canal de venta directo a Europa.' },
  { nombre: 'Valle Inka Huasi', zona: 'Cusco / selva alta', nota: 'Contacto inicial en feria.' },
]

interface Props {
  cooperativa: string
  parcelas: Parcela[]
  perfil: Perfil
  onCambiar: (perfil: Perfil) => void
}

export default function Vitrina({ cooperativa, parcelas, perfil, onCambiar }: Props) {
  const [editando, setEditando] = useState(false)

  const verificadas = parcelas.filter((p) => p.fuente !== 'offline')
  const conRiesgo = verificadas.filter((p) => p.estado === 'riesgo')
  const hectareas = parcelas.reduce((s, p) => s + p.areaHa, 0)
  const socios = new Set(parcelas.map((p) => p.socio)).size

  const sellada = verificadas.length > 0 && verificadas.length === parcelas.length && conRiesgo.length === 0
  const nombre = cooperativa.trim() || 'Tu organización'

  const campo = (k: keyof Perfil, v: string) => onCambiar({ ...perfil, [k]: v })

  return (
    <div className="vitrina">
      <header className="vit-cab">
        <div>
          <h2>Vitrina de origen verificado</h2>
          <p className="vit-sub">
            Cumplir la norma sirve de poco si nadie los encuentra. Esta ficha se arma sola con las
            parcelas que ya verificaron: el comprador no tiene que creerles, puede comprobarlo.
          </p>
        </div>
        <button className="btn" onClick={() => setEditando(!editando)}>
          {editando ? 'Ver la ficha' : 'Editar la ficha'}
        </button>
      </header>

      {editando ? (
        <form className="vit-form" onSubmit={(e) => { e.preventDefault(); setEditando(false) }}>
          <label>
            Altitud
            <input value={perfil.altitud} onChange={(e) => campo('altitud', e.target.value)} placeholder="1 200 – 1 800 msnm" />
          </label>
          <label>
            Variedades
            <input value={perfil.variedades} onChange={(e) => campo('variedades', e.target.value)} placeholder="Typica, Caturra, Bourbón" />
          </label>
          <label>
            Certificaciones
            <input value={perfil.certificaciones} onChange={(e) => campo('certificaciones', e.target.value)} placeholder="Orgánico, Fairtrade" />
          </label>
          <label>
            Contacto comercial
            <input value={perfil.contacto} onChange={(e) => campo('contacto', e.target.value)} placeholder="Correo de la cooperativa" />
          </label>
          <label className="ancho">
            Descripción
            <textarea
              rows={3}
              value={perfil.descripcion}
              onChange={(e) => campo('descripcion', e.target.value)}
              placeholder="Qué hace distinto a este café: taza, proceso, historia de la organización."
            />
          </label>
          <button className="btn principal" type="submit">Guardar ficha</button>
        </form>
      ) : (
        <article className={`ficha ${sellada ? 'sellada' : ''}`}>
          <div className="ficha-cab">
            <div>
              <h3>{nombre}</h3>
              {perfil.altitud && <p className="ficha-alt">{perfil.altitud}</p>}
            </div>
            <div className={`sello-origen ${sellada ? 'ok' : 'no'}`}>
              {sellada ? 'Origen verificado' : 'Verificación incompleta'}
            </div>
          </div>

          {perfil.descripcion && <p className="ficha-desc">{perfil.descripcion}</p>}

          <div className="ficha-datos">
            <div><span>Parcelas verificadas</span><strong>{verificadas.length} de {parcelas.length}</strong></div>
            <div><span>Superficie</span><strong>{hectareas.toFixed(1)} ha</strong></div>
            <div><span>Socios productores</span><strong>{socios}</strong></div>
            <div><span>Pérdida de bosque desde 2020</span><strong>{conRiesgo.length === 0 ? 'Ninguna' : `${conRiesgo.length} parcela(s)`}</strong></div>
          </div>

          {(perfil.variedades || perfil.certificaciones) && (
            <div className="ficha-tags">
              {perfil.variedades.split(',').filter((v) => v.trim()).map((v) => (
                <span className="tag" key={v}>{v.trim()}</span>
              ))}
              {perfil.certificaciones.split(',').filter((v) => v.trim()).map((v) => (
                <span className="tag cert" key={v}>{v.trim()}</span>
              ))}
            </div>
          )}

          <footer className="ficha-pie">
            {sellada ? (
              <p>
                El sello se calcula con los polígonos de las parcelas y la capa satelital de pérdida
                de bosque. Cualquier comprador puede pedir el expediente y comprobar cada coordenada.
              </p>
            ) : (
              <p>
                Faltan parcelas por verificar en línea. El sello aparece cuando todas están
                contrastadas contra los datos satelitales y ninguna presenta pérdida de bosque.
              </p>
            )}
            {perfil.contacto && <p className="ficha-contacto">Contacto comercial: {perfil.contacto}</p>}
          </footer>
        </article>
      )}

      <section className="red">
        <h3>Red de organizaciones</h3>
        <p className="red-sub">
          El otro pedido de la feria: poder encontrarse entre asociaciones para juntar volumen y
          compartir compradores. Estas son las organizaciones con las que conversamos en la Semana
          del Café del VRAEM 2026; figuran como contacto inicial, todavía sin cuenta ni datos
          personales publicados.
        </p>
        <ul className="red-lista">
          {RED.map((o) => (
            <li key={o.nombre}>
              <div>
                <strong>{o.nombre}</strong>
                <small>{o.zona}</small>
                <p>{o.nota}</p>
              </div>
              <span className="estado-red">En contacto</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
