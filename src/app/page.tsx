import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { HeroStats } from '@/components/HeroStats';
import { Illustration } from '@/components/Illustration';
import { LeadForm } from '@/components/LeadForm';
import { PartnersCarousel } from '@/components/PartnersCarousel';
import { PropertyCard } from '@/components/PropertyCard';
import { PropertyMap, type MapProperty } from '@/components/PropertyMap';
import { SearchBar } from '@/components/SearchBar';
import { SectionHead } from '@/components/SectionHead';
import { comunasDisponibles, segmentos, tituloPropiedad } from '@/data/properties';
import { servicios } from '@/data/services';
import { mapaHref, site, whatsappHref } from '@/data/site';
import { opcionesPrecioDisponibles } from '@/lib/filters';
import { formatPrecio } from '@/lib/format';
import { jsonLd } from '@/lib/json-ld';
import { metadatosPagina } from '@/lib/metadata';
import { propiedadesPublicadas, vitrina } from '@/lib/propiedades';

// La portada muestra una vitrina por segmento y cuenta propiedades por comuna, así que
// también lee de D1 en cada visita.
export const dynamic = 'force-dynamic';

export const metadata = {
  ...metadatosPagina(
    'Cota Clara · Patrimonio Inmobiliario',
    'Corretaje, tasaciones, asesoría y gestión de patrimonio inmobiliario en Santiago. Decisiones sobre tu propiedad con precisión técnica y transparencia.',
    '/',
  ),
  title: { absolute: 'Cota Clara · Patrimonio Inmobiliario' },
};

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
  // Una vitrina por segmento; la que no tiene propiedades publicadas no se muestra.
  const vitrinas = (['nuevo', 'usado'] as const)
    .map((condicion) => ({ condicion, lista: vitrina(propiedades, condicion) }))
    .filter((v) => v.lista.length > 0);
  const comunasConPropiedades = comunasDisponibles(propiedades);
  const propiedadesMapa: MapProperty[] = propiedades.flatMap((p) =>
    p.latitud != null && p.longitud != null && Number.isFinite(p.latitud) && Number.isFinite(p.longitud)
      ? [{
          slug: p.slug,
          titulo: tituloPropiedad(p),
          comuna: p.comuna,
          sector: p.sector,
          latitud: p.latitud,
          longitud: p.longitud,
          precio: formatPrecio(p.precio),
          operacion: p.operacion,
        }]
      : [],
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Con jsonLd y no JSON.stringify: las comunas vienen de la base.
          __html: jsonLd({
            '@context': 'https://schema.org',
            '@type': 'RealEstateAgent',
            name: 'Cota Clara · Patrimonio Inmobiliario',
            url: site.url,
            email: site.email,
            telephone: site.telefono,
            address: {
              '@type': 'PostalAddress',
              streetAddress: `${site.calle}, ${site.edificio}`,
              addressLocality: site.comuna,
              addressRegion: 'Región Metropolitana',
              addressCountry: 'CL',
            },
            hasMap: mapaHref,
            slogan: site.lema,
            areaServed: comunasConPropiedades.map((c) => ({ '@type': 'City', name: c })),
          }),
        }}
      />

      <section className="hero" aria-labelledby="hero-titulo">
        <div className="hero__media" aria-hidden="true">
          <Illustration variant="skyline" seed={8} tono="atardecer" className="hero__art" />
          <div className="hero__photo" />
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
              <Link className="button button--outline-light" href="/propiedades?operacion=arriendo">
                Ver arriendos
              </Link>
              <Link className="button button--outline-light" href="/servicios/tasaciones">
                Tasar mi propiedad
              </Link>
              <a className="hero__contact-link" href="#contacto">
                Cuéntanos tu caso <Icon name="arrow" />
              </a>
            </div>
          </div>
          <HeroStats />
          <SearchBar
            comunas={comunasConPropiedades}
            opcionesPrecio={{
              venta: opcionesPrecioDisponibles(propiedades, 'venta'),
              arriendo: opcionesPrecioDisponibles(propiedades, 'arriendo'),
            }}
          />
          <PartnersCarousel />
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

      {vitrinas.map(({ condicion, lista }, i) => {
        const segmento = segmentos[condicion];
        return (
          // La segunda va pegada a la primera: son dos vitrinas seguidas, no dos bandas.
          <section key={condicion} className={i > 0 ? 'section section--flush' : 'section'} aria-labelledby={`vitrina-${condicion}-titulo`}>
            <div className="container">
              <SectionHead
                id={`vitrina-${condicion}-titulo`}
                eyebrow={condicion === 'nuevo' ? 'Nuevos' : 'Usados'}
                title={segmento.label}
                lead={segmento.lead}
                link={{ href: segmento.href, label: condicion === 'nuevo' ? 'Ver todos los proyectos' : 'Ver todas las propiedades usadas' }}
              />
              <ul className="properties">
                {lista.map((p) => (
                  <li key={p.slug} className="properties__item">
                    <PropertyCard propiedad={p} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}

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

      {propiedadesMapa.length ? (
        <section className="section section--tint" aria-labelledby="comunas-titulo">
          <div className="container">
            <SectionHead id="comunas-titulo" eyebrow="Explora por comuna" title="Encuentra propiedades por ubicación" lead="Revisa las propiedades disponibles en cada comuna." />
            <PropertyMap propiedades={propiedadesMapa} />
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

      <section className="section section--flush" id="contacto" aria-labelledby="conversemos-titulo">
        <div className="container">
          <div className="talk">
            <div className="talk__copy">
              <span className="eyebrow eyebrow--light">¿Conversemos?</span>
              <h2 className="talk__title" id="conversemos-titulo">
                Cuéntanos qué necesitas
              </h2>
              <p className="talk__lead">Vender, arrendar, tasar o administrar: escríbenos y revisaremos tu caso contigo.</p>
              <div className="talk__channels">
                <a className="talk__channel" href={`mailto:${site.email}`}>
                  <Icon name="mail" /> {site.email}
                </a>
                <a className="talk__channel" href={whatsappHref()} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" /> WhatsApp
                </a>
              </div>
              <p className="talk__lead">{site.horario}</p>
            </div>
            <div className="talk__form">
              <LeadForm variante="contacto" titulo="Hablemos de tu proyecto" bajada="Deja tu consulta y te responderemos por correo." boton="Enviar consulta" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
