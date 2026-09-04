import './Landing.css'
import Logo from './Logo'
import Arte from './Arte'
import IconoReq from './IconoReq'

// Página de inicio: presenta Waylla y explica cómo usarla antes de entrar al mapa.
export default function Landing({ onComenzar }: { onComenzar: () => void }) {
  const pasos = [
    {
      n: 1,
      titulo: 'Ubícate en el mapa',
      texto:
        'Elige una zona guardada. Si hay señal verás el mapa satelital; sin señal podrás continuar con el fondo y las referencias incluidas.',
    },
    {
      n: 2,
      titulo: 'Dibuja la parcela',
      texto:
        'Pulsa "Nueva parcela" y haz clic en cada esquina del terreno, como si caminaras su perímetro. Cierra el polígono y ponle el nombre del socio.',
    },
    {
      n: 3,
      titulo: 'Verifica la deforestación',
      texto:
        'Sin señal obtienes una alerta preliminar al instante. Con conexión, Waylla contrasta la parcela contra la capa real de pérdida de bosque de Global Forest Watch y confirma el veredicto.',
    },
    {
      n: 4,
      titulo: 'Arma el lote y emite el expediente',
      texto:
        'Agrupa las parcelas de varios socios en el lote que se embarca. Si una sola tiene pérdida de bosque, el sistema detiene el lote y te dice cuál. Si está limpio, genera el expediente con las coordenadas a seis decimales para el comprador.',
    },
    {
      n: 5,
      titulo: 'Completa la ruta y publica tu ficha',
      texto:
        'Ese expediente es uno de los veintidós documentos que exige una exportación. Waylla ordena los demás, marca cuáles faltan y quién los emite, y publica una ficha con tu origen verificado para que los compradores te encuentren.',
    },
  ]

  return (
    <div className="landing">
      <header className="l-top">
        <span className="l-logo">
          <Logo size={32} /> Waylla
        </span>
        <span className="l-tag">Café y cacao sin deforestación</span>
      </header>

      <section className="l-hero">
        <div className="l-hero-txt">
          <h1>
            Trazabilidad <span>libre de deforestación</span>
            <br />
            para el café y el cacao peruano
          </h1>
          <p className="l-lead">
            Desde diciembre de 2026, la Unión Europea solo comprará café y cacao que demuestre
            que no proviene de tierras deforestadas. Waylla ayuda a las cooperativas a georreferenciar
            sus parcelas, verificarlas contra datos satelitales y generar el expediente que exige la norma.
          </p>
          <button className="l-cta" onClick={onComenzar}>
            Abrir Waylla Campo →
          </button>
          <p className="l-nota">Aplicación instalable · guarda las parcelas en este dispositivo · funciona sin servidor</p>
        </div>
        <div className="l-hero-art">
          <Arte />
        </div>
      </section>

      <section className="l-seccion">
        <h2>¿Por qué importa?</h2>
        <div className="l-datos">
          <div className="l-dato">
            <strong>55%</strong>
            <span>del café peruano exportado va a la Unión Europea</span>
          </div>
          <div className="l-dato">
            <strong>220 mil+</strong>
            <span>familias productoras de café y cacao en el país</span>
          </div>
          <div className="l-dato">
            <strong>Dic 2026</strong>
            <span>entra en vigencia la exigencia del reglamento EUDR</span>
          </div>
        </div>
      </section>

      <section className="l-seccion l-requisitos">
        <h2>Lo que Europa exige para dejar entrar tu café</h2>
        <p className="l-req-sub">Cuatro pruebas obligatorias bajo el reglamento EUDR. Waylla te ayuda a cumplir cada una.</p>
        <div className="l-reqs">
          <div className="l-req">
            <span className="l-req-ico"><IconoReq tipo="pin" /></span>
            <h3>Geolocalización</h3>
            <p>Las coordenadas de cada parcela con 6 decimales de precisión (polígono completo si supera 4 ha).</p>
          </div>
          <div className="l-req">
            <span className="l-req-ico"><IconoReq tipo="hoja" /></span>
            <h3>Cero deforestación</h3>
            <p>Prueba satelital de que la tierra no fue deforestada después del 31 de diciembre de 2020.</p>
          </div>
          <div className="l-req">
            <span className="l-req-ico"><IconoReq tipo="doc" /></span>
            <h3>Declaración (DDS)</h3>
            <p>Una Declaración de Diligencia Debida ante la Comisión Europea. Sin ella, el contenedor no entra.</p>
          </div>
          <div className="l-req">
            <span className="l-req-ico"><IconoReq tipo="trazas" /></span>
            <h3>Trazabilidad</h3>
            <p>El grano rastreado desde la parcela hasta el lote y el contenedor de exportación.</p>
          </div>
        </div>
      </section>

      <section className="l-seccion">
        <h2>Cómo funciona</h2>
        <div className="l-pasos">
          {pasos.map((p) => (
            <div className="l-paso" key={p.n}>
              <div className="l-num">{p.n}</div>
              <div>
                <h3>{p.titulo}</h3>
                <p>{p.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="l-seccion l-modos">
        <div className="l-modo">
          <h3><IconoReq tipo="offline" size={24} /> Modo offline</h3>
          <p>
            En el campo, sin señal, el técnico captura, guarda y exporta parcelas. Los registros
            permanecen en el teléfono al cerrar y volver a abrir la aplicación.
          </p>
        </div>
        <div className="l-modo">
          <h3><IconoReq tipo="online" size={24} /> Modo online</h3>
          <p>
            Con conexión, Waylla contrasta la parcela con la pérdida de bosque real de Global Forest
            Watch (y opcionalmente con Whisp, el motor oficial de la FAO para el EUDR).
          </p>
        </div>
      </section>

      <section className="l-final">
        <h2>¿List@ para empezar?</h2>
        <button className="l-cta" onClick={onComenzar}>
          Ir al mapa →
        </button>
      </section>

      <footer className="l-footer">
        Waylla · Trazabilidad libre de deforestación para el café y el cacao peruano · Perú, 2026
      </footer>
    </div>
  )
}
