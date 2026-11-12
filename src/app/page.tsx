import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { Illustration } from '@/components/Illustration';
import { LeadForm } from '@/components/LeadForm';
import { PropertyCard } from '@/components/PropertyCard';
import { SearchBar } from '@/components/SearchBar';
import { SectionHead } from '@/components/SectionHead';
import { comunasDisponibles } from '@/data/properties';
import { servicios } from '@/data/services';
import { site, whatsappHref } from '@/data/site';
import { opcionesPrecioDisponibles } from '@/lib/filters';
import { propiedadesPublicadas } from '@/lib/propiedades';

// La portada muestra las destacadas y cuenta propiedades por comuna, así que
// también lee de D1 en cada visita.
export const dynamic = 'force-dynamic';

const pilares: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'target', titulo: 'Precisión técnica', texto: 'Valoramos con comparables reales y metodología, no con intuición.' },
  { icono: 'doc', titulo: 'Transparencia', texto: 'Te mostramos qué sabemos, qué no y por qué recomendamos lo que recomendamos.' },
  { icono: 'shield', titulo: 'Experiencia', texto: 'Acompañamos cada etapa, desde la tasación hasta la firma de la escritura.' },
];

const pasos = [
  { titulo: 'Diagnóstico', texto: 'Entendemos tu objetivo y visitamos la propiedad.' },
  { titulo: 'Informe de valor', texto: 'Rango de precio, comparables y escenarios.' },
  { titulo: 'Estrategia', texto: 'Definimos contigo precio, difusión y plazos.' },
  { titulo: 'Ejecución y seguimiento', texto: 'Reporte semanal y ajustes con evidencia.' },
];

const preguntas = [
  {
    pregunta: '¿Por qué hacer una tasación antes de publicar?',
    respuesta:
      'Porque publicar con un precio mal calibrado alarga los plazos y debilita la negociación. El informe de valor te da un rango defendible y una estrategia antes de salir al mercado.',
  },
  {
    pregunta: '¿Cuánto cobran?',
    respuesta: 'Publicamos nuestros honorarios y te los entregamos por escrito antes de firmar. Revisa el detalle en cada servicio.',
  },
  {
    pregunta: '¿En qué comunas trabajan?',
    respuesta: 'Publicamos propiedades en distintas comunas de las regiones Metropolitana, de Valparaíso y de Coquimbo. Revisa el buscador para ver la oferta disponible y consúltanos por otras zonas.',
  },
  {
    pregunta: '¿Qué recibo cada semana mientras vendo?',
    respuesta: 'Un reporte con visitas, consultas calificadas, ofertas, comentarios de los interesados y nuestra recomendación: mantener, ajustar la presentación o revisar el precio.',
  },
];

// Ejemplo del informe de valor que se muestra en la portada.
const informe = { bajo: 9400, base: 9640, alto: 9850, publicar: 9990, min: 9200, max: 10200 };
const pos = (v: number) => `${((v - informe.min) / (informe.max - informe.min)) * 100}%`;

export default async function HomePage() {
  const propiedades = await propiedadesPublicadas();
  const destacadas = propiedades.filter((p) => p.destacada);
  const comunasConPropiedades = comunasDisponibles(propiedades);
  const porComuna = comunasConPropiedades.map((c) => ({ comuna: c, total: propiedades.filter((p) => p.comuna === c).length }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: 'Cota Clara · Patrimonio Inmobiliario',
            url: site.url,
            email: site.email,
            telephone: site.telefono,
            slogan: site.lema,
            areaServed: comunasConPropiedades.map((c) => ({ '@type': 'City', name: c })),
          }),
        }}
      />

      <section className="hero" aria-labelledby="hero-titulo">
        <div className="hero__media" aria-hidden="true">
          <Illustration variant="skyline" seed={8} tono="atardecer" className="hero__art" />
        </div>
        <div className="hero__overlay" aria-hidden="true" />
        <div className="hero__inner container">
          <div className="hero__content">
            <span className="eyebrow eyebrow--light">Corretaje · Tasaciones · Asesoría · Gestión de patrimonio</span>
            <h1 className="hero__title" id="hero-titulo">
              Tu patrimonio inmobiliario, <span className="hero__title-accent">con respaldo.</span>
            </h1>
            <p className="hero__lead">
              Combinamos precisión técnica, transparencia y experiencia para que cada decisión sobre tu propiedad parta de datos reales.
            </p>
            <div className="hero__actions">
              <Link className="button button--primary" href="/propiedades">
                Ver propiedades
                <Icon name="arrow" className="button__icon" />
              </Link>
              <Link className="button button--outline-light" href="/servicios/tasaciones">
                Tasar mi propiedad
              </Link>
            </div>
          </div>
          <SearchBar
            comunas={comunasConPropiedades}
            opcionesPrecio={{
              venta: opcionesPrecioDisponibles(propiedades, 'venta'),
              arriendo: opcionesPrecioDisponibles(propiedades, 'arriendo'),
            }}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="concepto-titulo">
        <div className="container intro">
          <div className="intro__statement">
            <span className="eyebrow">Concepto de marca</span>
            <h2 className="intro__title" id="concepto-titulo">
              {site.concepto}
            </h2>
            <p className="intro__motto">{site.lema}</p>
          </div>
          <ul className="intro__pillars">
            {pilares.map((p) => (
              <li key={p.titulo} className="pillar">
                <span className="pillar__icon">
                  <Icon name={p.icono} />
                </span>
                <div className="pillar__body">
                  <h3 className="pillar__title">{p.titulo}</h3>
                  <p className="pillar__text">{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="servicios-titulo">
        <div className="container">
          <SectionHead
            id="servicios-titulo"
            eyebrow="Servicios"
            title="Todo lo que tu propiedad necesita, con un mismo criterio"
            lead="Vender, arrendar, tasar o administrar: cada servicio parte por entender el valor."
          />
          <ul className="services">
            {servicios.map((s) => (
              <li key={s.slug} className="service-card">
                <span className="service-card__icon">
                  <Icon name={s.icono} />
                </span>
                <h3 className="service-card__title">{s.nombre}</h3>
                <p className="service-card__text">{s.resumen}</p>
                <Link className="service-card__link link-arrow" href={`/servicios/${s.slug}`}>
                  Conocer más
                  <Icon name="arrow" className="link-arrow__icon" />
                  <span className="visually-hidden"> sobre {s.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="destacadas-titulo">
        <div className="container">
          <SectionHead
            id="destacadas-titulo"
            eyebrow="Propiedades"
            title="Propiedades destacadas"
            lead="Explora las propiedades disponibles y revisa los datos de cada ficha."
            link={{ href: '/propiedades', label: 'Ver todas las propiedades' }}
          />
          <ul className="properties">
            {destacadas.map((p) => (
              <li key={p.slug} className="properties__item">
                <PropertyCard propiedad={p} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="informe-titulo">
        <div className="container report">
          <div className="report__copy">
            <span className="eyebrow">Informe de valor</span>
            <h2 className="report__title" id="informe-titulo">
              Así se ve una decisión informada
            </h2>
            <p className="report__lead">
              No te decimos solo un número. Te mostramos el rango de mercado, los comparables que usamos y los que descartamos, el precio de
              publicación que recomendamos y cuándo revisarlo.
            </p>
            <ul className="checklist">
              {['Comparables verificados', 'Rango bajo, base y alto', 'Supuestos y limitaciones a la vista', 'Reunión para explicártelo'].map((t) => (
                <li key={t} className="checklist__item">
                  <Icon name="check" className="checklist__icon" />
                  {t}
                </li>
              ))}
            </ul>
            <Link className="button button--dark" href="/servicios/tasaciones">
              Solicitar mi informe
              <Icon name="arrow" className="button__icon" />
            </Link>
          </div>

          <figure className="report__card" aria-label="Ejemplo de informe de valor">
            <div className="report__head">
              <span className="report__label">Departamento · Providencia · 96 m²</span>
              <span className="report__date">Ejemplo · 11 nov 2026</span>
            </div>
            <p className="report__range-title">Rango de valor de mercado</p>
            <p className="report__figure">
              UF 9.400 <span className="report__dash">–</span> 9.850
            </p>
            <div className="range" aria-hidden="true">
              <div className="range__track" />
              <div className="range__band" style={{ left: pos(informe.bajo), width: `calc(${pos(informe.alto)} - ${pos(informe.bajo)})` }} />
              <span className="range__mark range__mark--base" style={{ left: pos(informe.base) }}>
                <span className="range__tag range__tag--base">Base 9.640</span>
              </span>
              <span className="range__mark range__mark--publicar" style={{ left: pos(informe.publicar) }}>
                <span className="range__tag">Publicar 9.990</span>
              </span>
              <span className="range__end" style={{ left: pos(informe.bajo) }}>
                9.400
              </span>
              <span className="range__end" style={{ left: pos(informe.alto) }}>
                9.850
              </span>
            </div>
            <dl className="report__stats">
              <div className="report__stat">
                <dt>Comparables</dt>
                <dd>14 analizados</dd>
              </div>
              <div className="report__stat">
                <dt>Evidencia</dt>
                <dd>Cierres verificados</dd>
              </div>
              <div className="report__stat">
                <dt>Revisión</dt>
                <dd>En 21 días</dd>
              </div>
            </dl>
            <figcaption className="report__note">
              «Con la evidencia disponible hoy, estimamos un rango entre 9.400 y 9.850 UF. Recomendamos publicar en 9.990 UF y revisar la
              respuesta en 21 días.»
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section section--dark appraisal-section" aria-labelledby="tasacion-titulo">
        <div className="container appraisal">
          <div className="appraisal__copy">
            <span className="eyebrow eyebrow--light">Tasaciones</span>
            <h2 className="appraisal__title" id="tasacion-titulo">
              ¿Cuánto vale realmente tu propiedad?
            </h2>
            <p className="appraisal__lead">
              Cuéntanos qué propiedad quieres tasar y para qué. Te contactamos para agendar la visita técnica.
            </p>
            <ul className="appraisal__list">
              <li>
                <Icon name="check" /> Para vender, arrendar, heredar o comprar con respaldo
              </li>
              <li>
                <Icon name="check" /> Visita técnica y comparables reales del sector
              </li>
              <li>
                <Icon name="check" /> El avalúo fiscal no es el valor comercial: te explicamos la diferencia
              </li>
            </ul>
          </div>
          <div className="appraisal__form">
            <LeadForm variante="tasacion" titulo="Solicita tu tasación" bajada="Sin compromiso. Respondemos en un día hábil." boton="Solicitar tasación" />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="proceso-titulo">
        <div className="container">
          <SectionHead id="proceso-titulo" eyebrow="Cómo trabajamos" title="Primero entendemos el valor. Después tomamos la decisión." />
          <ol className="process">
            {pasos.map((p, i) => (
              <li key={p.titulo} className="process__step">
                <span className="process__number">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="process__title">{p.titulo}</h3>
                <p className="process__text">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {porComuna.length ? (
        <section className="section section--tint" aria-labelledby="comunas-titulo">
          <div className="container">
            <SectionHead id="comunas-titulo" eyebrow="Explora por comuna" title="Encuentra propiedades por ubicación" lead="Revisa las propiedades disponibles en cada comuna." />
            <ul className="zones">
              {porComuna.map(({ comuna, total }) => (
                <li key={comuna} className="zones__item">
                  <Link className="zone-card" href={`/propiedades?comuna=${encodeURIComponent(comuna)}`}>
                    <span className="zone-card__name">{comuna}</span>
                    <span className="zone-card__count">{total === 1 ? '1 propiedad' : `${total} propiedades`}</span>
                    <Icon name="arrow" className="zone-card__icon" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="section" aria-labelledby="faq-titulo">
        <div className="container faq-layout">
          <SectionHead id="faq-titulo" eyebrow="Preguntas frecuentes" title="Lo que más nos preguntan" />
          <div className="faq">
            {preguntas.map((q) => (
              <details key={q.pregunta} className="faq__item">
                <summary className="faq__question">
                  {q.pregunta}
                  <Icon name="plus" className="faq__icon" />
                </summary>
                <p className="faq__answer">{q.respuesta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--flush" aria-labelledby="conversemos-titulo">
        <div className="container">
          <div className="talk">
            <div className="talk__copy">
              <span className="eyebrow eyebrow--light">¿Conversemos?</span>
              <h2 className="talk__title" id="conversemos-titulo">
                Agenda una reunión y revisemos tu caso
              </h2>
              <p className="talk__lead">{site.horario}</p>
            </div>
            <div className="talk__channels">
              <a className="talk__channel" href={`tel:${site.telefonoHref}`}>
                <Icon name="phone" /> {site.telefono}
              </a>
              <a className="talk__channel" href={`mailto:${site.email}`}>
                <Icon name="mail" /> {site.email}
              </a>
              <div className="talk__actions">
                <Link className="button button--primary" href="/contacto">
                  Agendar reunión
                </Link>
                <a className="button button--outline-light" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" className="button__icon button__icon--static" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
