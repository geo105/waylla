import { useState } from 'react'
import './Ruta.css'
import type { Lote, Parcela } from './tipos'
import { diagnosticarLote } from './tipos'

// ---------------------------------------------------------------
// Ruta al mercado
//
// Los productores de Expocafé fueron claros: el reglamento europeo es
// un trámite entre muchos. Esta pantalla ordena todo el camino hasta
// el embarque y marca solo lo que Waylla puede resolver por sí mismo.
// Las etapas y los documentos siguen la guía oficial de PROMPERÚ.
// ---------------------------------------------------------------

export type EstadoDoc = 'pendiente' | 'tramite' | 'listo'

interface Documento {
  id: string
  nombre: string
  entidad: string
  nota: string
  /** Waylla lo genera con los datos que ya tiene. */
  automatico?: boolean
  enlace?: { texto: string; url: string }
}

interface Etapa {
  id: string
  titulo: string
  resumen: string
  docs: Documento[]
}

export const ETAPAS: Etapa[] = [
  {
    id: 'formal',
    titulo: 'Formalización de la organización',
    resumen: 'Sin esto no se puede facturar ni declarar una exportación.',
    docs: [
      { id: 'ruc', nombre: 'RUC activo y afecto a renta de tercera categoría', entidad: 'SUNAT', nota: 'A nombre de la asociación o cooperativa, no de una persona.' },
      { id: 'registro', nombre: 'Inscripción vigente en Registros Públicos', entidad: 'SUNARP', nota: 'Con la junta directiva actualizada y poderes vigentes.' },
      { id: 'clave', nombre: 'Clave SOL y buzón electrónico habilitado', entidad: 'SUNAT', nota: 'Es por donde llegan las notificaciones de aduanas.' },
    ],
  },
  {
    id: 'sanitario',
    titulo: 'Habilitación sanitaria',
    resumen: 'Lo que permite que el grano salga del país como alimento.',
    docs: [
      { id: 'senasa-lugar', nombre: 'Registro del lugar de producción', entidad: 'SENASA', nota: 'Se tramita una vez y se renueva; aplica a las parcelas de los socios.' },
      { id: 'fito', nombre: 'Certificado fitosanitario de exportación', entidad: 'SENASA', nota: 'Se emite por embarque, después de la inspección.' },
      { id: 'planta', nombre: 'Registro de la planta de beneficio o acopio', entidad: 'SENASA / DIGESA', nota: 'Según dónde se procese y para qué mercado.' },
    ],
  },
  {
    id: 'origen',
    titulo: 'Origen verificado (Reglamento UE 2023/1115)',
    resumen: 'La parte que Waylla arma sola con lo que ya levantaron en campo.',
    docs: [
      { id: 'geo', nombre: 'Geolocalización de cada parcela a seis decimales', entidad: 'La cooperativa', nota: 'Se genera desde el mapa, con polígono completo si supera 4 ha.', automatico: true },
      { id: 'sin-defo', nombre: 'Prueba de no deforestación posterior al 31/12/2020', entidad: 'La cooperativa', nota: 'Contraste satelital contra la capa de pérdida de bosque.', automatico: true },
      { id: 'traza', nombre: 'Trazabilidad parcela – socio – lote', entidad: 'La cooperativa', nota: 'El expediente enlaza cada saco con las parcelas que lo produjeron.', automatico: true },
      { id: 'dds', nombre: 'Declaración de Diligencia Debida (DDS)', entidad: 'El importador europeo', nota: 'La presenta el comprador en la UE con el expediente que ustedes le entregan.', enlace: { texto: 'Reglamento (UE) 2023/1115', url: 'https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A32023R1115' } },
    ],
  },
  {
    id: 'comercial',
    titulo: 'Documentos comerciales',
    resumen: 'Lo que se acuerda con el comprador antes de mover el contenedor.',
    docs: [
      { id: 'proforma', nombre: 'Factura proforma', entidad: 'La cooperativa', nota: 'La oferta formal: cantidad, calidad, precio e Incoterm.' },
      { id: 'contrato', nombre: 'Contrato de compraventa internacional', entidad: 'Las partes', nota: 'Define calidad, plazos, penalidades y quién asume qué.' },
      { id: 'factura', nombre: 'Factura comercial de exportación', entidad: 'La cooperativa', nota: 'Emitida en el sistema de SUNAT, en la moneda pactada.' },
      { id: 'packing', nombre: 'Packing list', entidad: 'La cooperativa', nota: 'Sacos, pesos netos y brutos, y marcas de identificación del lote.' },
    ],
  },
  {
    id: 'aduana',
    titulo: 'Aduanas y transporte',
    resumen: 'El trámite de salida propiamente dicho.',
    docs: [
      { id: 'agente', nombre: 'Agente de aduanas designado', entidad: 'Agencia autorizada', nota: 'Obligatorio por encima de los umbrales de valor.' },
      { id: 'dam', nombre: 'Declaración Aduanera de Mercancías (DAM)', entidad: 'Agente de aduanas', nota: 'Para envíos menores existe la DSE o Exporta Fácil.', enlace: { texto: 'Documentos de exportación, PROMPERÚ', url: 'https://recursos.exportemos.pe/documentos-necesarios-exportar-2023.pdf' } },
      { id: 'remision', nombre: 'Guía de remisión', entidad: 'La cooperativa', nota: 'Acompaña el traslado del acopio al puerto.' },
      { id: 'bl', nombre: 'Conocimiento de embarque (B/L)', entidad: 'Naviera', nota: 'Se emite al embarcar y es el título de la mercadería.' },
      { id: 'seguro', nombre: 'Póliza o certificado de seguro', entidad: 'Aseguradora', nota: 'Depende del Incoterm acordado con el comprador.' },
    ],
  },
  {
    id: 'certificados',
    titulo: 'Certificados que abren mercado',
    resumen: 'No todos son obligatorios, pero definen el precio que les pagan.',
    docs: [
      { id: 'origen', nombre: 'Certificado de origen', entidad: 'Cámara de Comercio acreditada', nota: 'Permite acogerse a las preferencias arancelarias con la UE.' },
      { id: 'organico', nombre: 'Certificación orgánica', entidad: 'Certificadora acreditada', nota: 'Requiere periodo de transición y auditoría anual.' },
      { id: 'comercio', nombre: 'Comercio justo o equivalente', entidad: 'Fairtrade, Rainforest, UTZ', nota: 'Suele ser el que más pesa en el precio final.' },
    ],
  },
]

interface Props {
  cooperativa: string
  parcelas: Parcela[]
  lotes: Lote[]
  estados: Record<string, EstadoDoc>
  onCambiar: (id: string, estado: EstadoDoc) => void
}

const SIGUIENTE: Record<EstadoDoc, EstadoDoc> = {
  pendiente: 'tramite',
  tramite: 'listo',
  listo: 'pendiente',
}

const ROTULO: Record<EstadoDoc, string> = {
  pendiente: 'Falta',
  tramite: 'En trámite',
  listo: 'Listo',
}

export default function Ruta({ cooperativa, parcelas, lotes, estados, onCambiar }: Props) {
  const [abierta, setAbierta] = useState<string | null>('origen')

  // Los tres documentos del EUDR se marcan solos con lo que hay en la app.
  const verificadas = parcelas.filter((p) => p.fuente !== 'offline')
  const sinRiesgo = verificadas.filter((p) => p.estado !== 'riesgo')
  const hayLoteListo = lotes.some((l) => diagnosticarLote(l, parcelas).estado === 'listo')

  const auto: Record<string, EstadoDoc> = {
    geo: parcelas.length === 0 ? 'pendiente' : 'listo',
    'sin-defo':
      verificadas.length === 0
        ? 'pendiente'
        : sinRiesgo.length === verificadas.length && verificadas.length === parcelas.length
          ? 'listo'
          : 'tramite',
    traza: lotes.length === 0 ? 'pendiente' : hayLoteListo ? 'listo' : 'tramite',
  }

  const estadoDe = (d: Documento): EstadoDoc =>
    d.automatico ? (auto[d.id] ?? 'pendiente') : (estados[d.id] ?? 'pendiente')

  const todos = ETAPAS.flatMap((e) => e.docs)
  const listos = todos.filter((d) => estadoDe(d) === 'listo').length
  const avance = Math.round((listos / todos.length) * 100)

  const faltantes = todos.filter((d) => estadoDe(d) === 'pendiente')

  return (
    <div className="ruta">
      <header className="ruta-cab">
        <div>
          <h2>Ruta al mercado</h2>
          <p className="ruta-sub">
            Todo lo que {cooperativa.trim() || 'la organización'} necesita para poner un contenedor
            en Europa, en orden. Waylla resuelve por su cuenta los tres documentos de origen; el
            resto se marca a mano y sirve para saber qué falta y a quién pedírselo.
          </p>
        </div>
        <div className="medidor" role="img" aria-label={`Avance ${avance} por ciento`}>
          <strong>{avance}%</strong>
          <span>{listos} de {todos.length} documentos</span>
          <div className="barra"><i style={{ width: `${avance}%` }} /></div>
        </div>
      </header>

      {faltantes.length > 0 && (
        <p className="ruta-siguiente">
          <b>Lo siguiente:</b> {faltantes.slice(0, 3).map((d) => d.nombre).join(' · ')}
          {faltantes.length > 3 && ` · y ${faltantes.length - 3} más`}
        </p>
      )}

      <div className="etapas">
        {ETAPAS.map((etapa) => {
          const n = etapa.docs.filter((d) => estadoDe(d) === 'listo').length
          const completa = n === etapa.docs.length
          const abierto = abierta === etapa.id
          return (
            <section className={`etapa ${completa ? 'completa' : ''}`} key={etapa.id}>
              <button
                className="etapa-cab"
                onClick={() => setAbierta(abierto ? null : etapa.id)}
                aria-expanded={abierto}
              >
                <span className="etapa-t">{etapa.titulo}</span>
                <span className="etapa-r">{etapa.resumen}</span>
                <span className={`etapa-n ${completa ? 'ok' : ''}`}>
                  {n}/{etapa.docs.length}
                </span>
              </button>

              {abierto && (
                <ul className="docs">
                  {etapa.docs.map((d) => {
                    const est = estadoDe(d)
                    return (
                      <li key={d.id} className={est}>
                        <button
                          className="doc-estado"
                          onClick={() => !d.automatico && onCambiar(d.id, SIGUIENTE[est])}
                          disabled={d.automatico}
                          title={
                            d.automatico
                              ? 'Waylla lo determina con los datos de las parcelas'
                              : 'Cambiar estado'
                          }
                        >
                          {ROTULO[est]}
                        </button>
                        <div className="doc-cuerpo">
                          <strong>
                            {d.nombre}
                            {d.automatico && <span className="auto">lo arma Waylla</span>}
                          </strong>
                          <p>
                            {d.entidad} · {d.nota}
                            {d.enlace && (
                              <>
                                {' '}
                                <a href={d.enlace.url} target="_blank" rel="noopener noreferrer">
                                  {d.enlace.texto}
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <p className="ruta-aviso">
        Esta lista organiza requisitos publicados por SUNAT, SENASA y PROMPERÚ y no sustituye la
        asesoría de un agente de aduanas ni de un abogado. Los enlaces llevan siempre a la fuente
        oficial: Waylla no emite ningún documento del Estado.
      </p>
    </div>
  )
}
