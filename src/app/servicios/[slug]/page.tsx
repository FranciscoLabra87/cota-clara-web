import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { LeadForm } from '@/components/LeadForm';
import { PageHero } from '@/components/PageHero';
import { SectionHead } from '@/components/SectionHead';
import { buscarServicio, servicios } from '@/data/services';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return servicios.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const s = buscarServicio(slug);
  if (!s) return { title: 'Servicio no encontrado' };
  return { title: s.nombre, description: s.bajada };
}

export default async function ServicioPage({ params }: Params) {
  const { slug } = await params;
  const s = buscarServicio(slug);
  if (!s) notFound();
  const otros = servicios.filter((o) => o.slug !== s.slug);

  return (
    <>
      <PageHero migas={[{ href: '/', label: 'Inicio' }, { label: s.nombre }]} title={s.titular} lead={s.bajada}>
        <div className="page-hero__actions">
          <a className="button button--primary" href="#solicitud">
            {s.formulario === 'tasacion' ? 'Solicitar tasación' : 'Conversemos'}
            <Icon name="arrow" className="button__icon" />
          </a>
        </div>
      </PageHero>

      <section className="section section--after-hero" aria-labelledby="incluye-titulo">
        <div className="container split">
          <div className="split__main">
            <SectionHead id="incluye-titulo" eyebrow={s.nombre} title="Qué incluye" />
            <ul className="checklist checklist--grid">
              {s.incluye.map((item) => (
                <li key={item} className="checklist__item">
                  <Icon name="check" className="checklist__icon" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="split__aside">
            <div className="fees" id="honorarios">
              <p className="fees__title">Qué cobramos y por qué</p>
              <dl className="fees__list">
                {s.honorarios.map((h) => (
                  <div key={h.concepto} className="fees__item">
                    <dt className="fees__concept">{h.concepto}</dt>
                    <dd className="fees__detail">{h.detalle}</dd>
                  </div>
                ))}
              </dl>
              <p className="fees__note">Valores referenciales. Te entregamos los honorarios por escrito, sin letra chica, antes de firmar.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="pasos-titulo">
        <div className="container">
          <SectionHead id="pasos-titulo" eyebrow="Proceso" title="Cómo lo hacemos" />
          <ol className="process">
            {s.pasos.map((p, i) => (
              <li key={p.titulo} className="process__step">
                <span className="process__number">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="process__title">{p.titulo}</h3>
                <p className="process__text">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="solicitud-titulo" id="solicitud">
        <div className="container split split--center">
          <div className="split__main">
            <SectionHead id="solicitud-titulo" eyebrow="Preguntas frecuentes" title="Antes de empezar" />
            <div className="faq">
              {s.preguntas.map((q) => (
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
          <div className="split__aside">
            <LeadForm
              variante={s.formulario}
              titulo={s.formulario === 'tasacion' ? 'Solicita tu tasación' : `Conversemos sobre ${s.nombre.toLowerCase()}`}
              bajada="Sin compromiso. Respondemos en un día hábil."
              boton={s.formulario === 'tasacion' ? 'Solicitar tasación' : 'Enviar consulta'}
            />
          </div>
        </div>
      </section>

      <section className="section section--tint" aria-labelledby="otros-titulo">
        <div className="container">
          <SectionHead id="otros-titulo" eyebrow="Servicios" title="Otros servicios" />
          <ul className="services">
            {otros.map((o) => (
              <li key={o.slug} className="service-card">
                <span className="service-card__icon">
                  <Icon name={o.icono} />
                </span>
                <h3 className="service-card__title">{o.nombre}</h3>
                <p className="service-card__text">{o.resumen}</p>
                <Link className="service-card__link link-arrow" href={`/servicios/${o.slug}`}>
                  Conocer más
                  <Icon name="arrow" className="link-arrow__icon" />
                  <span className="visually-hidden"> sobre {o.nombre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
