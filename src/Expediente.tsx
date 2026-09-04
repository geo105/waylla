import './Expediente.css'
import { diagnosticarLote, ROTULO_LOTE, type Lote, type Parcela } from './tipos'

interface Props {
  lote: Lote
  parcelas: Parcela[]
  cooperativa: string
  onVolver: () => void
}

const LINEA_BASE = '2020-12-31'

function centroide(p: Parcela): [number, number] {
  const lat = p.vertices.reduce((s, v) => s + v[0], 0) / p.vertices.length
  const lng = p.vertices.reduce((s, v) => s + v[1], 0) / p.vertices.length
  return [lat, lng]
}

function anillo(p: Parcela) {
  return [...p.vertices, p.vertices[0]].map(([lat, lng]) => [
    Number(lng.toFixed(6)),
    Number(lat.toFixed(6)),
  ])
}

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nombre
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Expediente({ lote, parcelas, cooperativa, onVolver }: Props) {
  const d = diagnosticarLote(lote, parcelas)
  const coop = cooperativa.trim() || 'Cooperativa (sin nombre configurado)'

  const requisitos = [
    {
      titulo: 'Geolocalización con 6 decimales',
      cumple: d.parcelas.length > 0,
      nota: `${d.parcelas.length} ${
        d.parcelas.length === 1 ? 'parcela georreferenciada' : 'parcelas georreferenciadas'
      } con coordenadas a seis decimales.`,
    },
    {
      titulo: 'Polígono completo en parcelas mayores a 4 ha',
      cumple: true,
      nota:
        d.sobre4ha > 0
          ? `${d.sobre4ha} ${
              d.sobre4ha === 1 ? 'parcela supera' : 'parcelas superan'
            } las 4 ha y ${d.sobre4ha === 1 ? 'está registrada' : 'están registradas'} como polígono.`
          : 'Todas las parcelas se registraron como polígono, no como punto.',
    },
    {
      titulo: `Sin deforestación posterior al ${LINEA_BASE}`,
      cumple: d.enRiesgo.length === 0,
      nota:
        d.enRiesgo.length === 0
          ? 'Ninguna parcela presenta pérdida de cobertura arbórea dentro de su perímetro.'
          : `Pérdida detectada en ${d.enRiesgo.map((p) => p.id).join(', ')}.`,
    },
    {
      titulo: 'Verificación contra datos satelitales',
      cumple: d.sinVerificar.length === 0,
      nota:
        d.sinVerificar.length === 0
          ? 'Todas las parcelas contrastadas con la capa de pérdida de bosque de Global Forest Watch.'
          : `${d.sinVerificar.length} ${
              d.sinVerificar.length === 1 ? 'parcela pendiente' : 'parcelas pendientes'
            } de verificación en línea.`,
    },
    {
      titulo: 'Trazabilidad parcela – socio – lote',
      cumple: d.parcelas.length > 0 && d.socios > 0,
      nota: `El lote ${lote.codigo} enlaza ${d.parcelas.length} ${
        d.parcelas.length === 1 ? 'parcela' : 'parcelas'
      } de ${d.socios} ${d.socios === 1 ? 'socio' : 'socios'} con ${lote.pesoKg.toLocaleString(
        'es-PE',
      )} kg embarcados.`,
    },
  ]

  const exportarGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      properties: {
        lote: lote.codigo,
        cooperativa: coop,
        producto: lote.producto,
        peso_kg: lote.pesoKg,
        campana: lote.campana,
        comprador: lote.comprador,
        linea_base: LINEA_BASE,
        reglamento: 'UE 2023/1115',
      },
      features: d.parcelas.map((p) => ({
        type: 'Feature',
        properties: {
          id: p.id,
          socio: p.socio,
          comunidad: p.comunidad,
          area_ha: Number(p.areaHa.toFixed(4)),
          estado_eudr: p.estado,
          verificacion: p.fuente,
          fecha_levantamiento: p.fecha,
          lote: lote.codigo,
        },
        geometry: { type: 'Polygon', coordinates: [anillo(p)] },
      })),
    }
    descargar(`${lote.codigo}_parcelas.geojson`, JSON.stringify(fc, null, 2), 'application/geo+json')
  }

  const exportarExpediente = () => {
    const doc = {
      expediente: lote.codigo,
      emitido: new Date().toISOString(),
      cooperativa: coop,
      reglamento: 'Reglamento (UE) 2023/1115',
      linea_base: LINEA_BASE,
      lote: {
        codigo: lote.codigo,
        producto: lote.producto,
        peso_kg: lote.pesoKg,
        campana: lote.campana,
        comprador: lote.comprador,
      },
      resumen: {
        estado: d.estado,
        parcelas: d.parcelas.length,
        socios: d.socios,
        area_ha: Number(d.areaHa.toFixed(4)),
        parcelas_en_riesgo: d.enRiesgo.map((p) => p.id),
        parcelas_sin_verificar: d.sinVerificar.map((p) => p.id),
      },
      requisitos: requisitos.map((r) => ({ requisito: r.titulo, cumple: r.cumple, nota: r.nota })),
      parcelas: d.parcelas.map((p) => {
        const [lat, lng] = centroide(p)
        return {
          id: p.id,
          socio: p.socio,
          comunidad: p.comunidad,
          area_ha: Number(p.areaHa.toFixed(4)),
          centroide: { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) },
          poligono: anillo(p),
          estado_eudr: p.estado,
          verificacion: p.fuente,
          detalle: p.detalle ?? null,
          fecha_levantamiento: p.fecha,
        }
      }),
      nota_legal:
        'Documento de respaldo emitido por el operador de acopio. La Declaración de Diligencia ' +
        'Debida (DDS) ante la Comisión Europea la presenta el importador establecido en la UE.',
    }
    descargar(`${lote.codigo}_expediente.json`, JSON.stringify(doc, null, 2), 'application/json')
  }

  return (
    <div className="expediente">
      <div className="exp-barra no-imprimir">
        <button className="btn" onClick={onVolver}>
          Volver a lotes
        </button>
        <div className="exp-barra-der">
          <button className="btn" onClick={exportarGeoJSON}>
            Descargar GeoJSON
          </button>
          <button className="btn" onClick={exportarExpediente}>
            Descargar expediente
          </button>
          <button className="btn principal" onClick={() => window.print()}>
            Imprimir o guardar en PDF
          </button>
        </div>
      </div>

      <article className="hoja">
        <header className="hoja-cab">
          <div>
            <p className="hoja-rotulo">Expediente de diligencia debida · Reglamento (UE) 2023/1115</p>
            <h1>{lote.codigo}</h1>
            <p className="hoja-coop">{coop}</p>
          </div>
          <div className={`sello ${d.estado}`}>{ROTULO_LOTE[d.estado]}</div>
        </header>

        <section className="datos">
          <div>
            <span>Producto</span>
            <strong>{lote.producto}</strong>
          </div>
          <div>
            <span>Peso embarcado</span>
            <strong>{lote.pesoKg.toLocaleString('es-PE')} kg</strong>
          </div>
          <div>
            <span>Campaña</span>
            <strong>{lote.campana}</strong>
          </div>
          <div>
            <span>Comprador en la UE</span>
            <strong>{lote.comprador}</strong>
          </div>
          <div>
            <span>Parcelas</span>
            <strong>{d.parcelas.length}</strong>
          </div>
          <div>
            <span>Socios productores</span>
            <strong>{d.socios}</strong>
          </div>
          <div>
            <span>Superficie total</span>
            <strong>{d.areaHa.toFixed(2)} ha</strong>
          </div>
          <div>
            <span>Rendimiento declarado</span>
            <strong>{d.rendimientoKgHa.toFixed(0)} kg/ha</strong>
          </div>
        </section>

        <section>
          <h2>Requisitos verificados</h2>
          <ul className="requisitos">
            {requisitos.map((r) => (
              <li key={r.titulo} className={r.cumple ? 'ok' : 'no'}>
                <span className="marca" aria-hidden="true" />
                <div>
                  <strong>{r.titulo}</strong>
                  <p>{r.nota}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Parcelas incluidas</h2>
          <div className="tabla-envoltura">
            <table>
              <thead>
                <tr>
                  <th>Parcela</th>
                  <th>Socio</th>
                  <th>Comunidad</th>
                  <th>Área (ha)</th>
                  <th>Centroide (lat, lng)</th>
                  <th>Estado</th>
                  <th>Verificación</th>
                </tr>
              </thead>
              <tbody>
                {d.parcelas.map((p) => {
                  const [lat, lng] = centroide(p)
                  return (
                    <tr key={p.id}>
                      <td className="mono">{p.id}</td>
                      <td>{p.socio}</td>
                      <td>{p.comunidad || '—'}</td>
                      <td className="mono num">{p.areaHa.toFixed(2)}</td>
                      <td className="mono">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                      </td>
                      <td>
                        <span className={`pastilla ${p.estado}`}>{p.estado}</span>
                      </td>
                      <td className="chico">
                        {p.fuente === 'offline' ? 'pendiente' : 'satelital'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="hoja-pie">
          <p>
            Línea base de deforestación: {LINEA_BASE}. Coordenadas expresadas en WGS&nbsp;84 con seis
            decimales. Verificación de cobertura arbórea con datos de Hansen/UMD publicados por
            Global Forest Watch.
          </p>
          <p>
            Este expediente es el respaldo que el operador de acopio entrega al importador. La
            Declaración de Diligencia Debida ante la Comisión Europea la presenta el importador
            establecido en la Unión Europea.
          </p>
        </footer>
      </article>
    </div>
  )
}
