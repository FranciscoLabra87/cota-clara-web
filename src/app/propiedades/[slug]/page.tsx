import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ContadorVisita } from '@/components/ContadorVisita';
import { Gallery, type GalleryItem } from '@/components/Gallery';
import { Icon } from '@/components/Icon';
import { Illustration } from '@/components/Illustration';
import { LeadForm } from '@/components/LeadForm';
import { MortgageCalculator } from '@/components/MortgageCalculator';
import { PageHero } from '@/components/PageHero';
import { PropertyCard } from '@/components/PropertyCard';
import { varianteTipo } from '@/components/PropertyMedia';
import { TablaTipologias } from '@/components/TablaTipologias';
import { motivosFicha, tituloPropiedad, type Propiedad } from '@/data/properties';
import { site, whatsappHref } from '@/data/site';
import { formatMetros, formatNumero, formatPrecio, periodoPrecio } from '@/lib/format';
import { propiedadPorSlug, propiedadesPublicadas } from '@/lib/propiedades';
import { stockPublicoPorSlug } from '@/lib/unidades';

type Params = { params: Promise<{ slug: string }> };

// Sin generateStaticParams: las fichas salen de D1 y se arman en cada visita,
// para que publicar desde el panel no dependa de un deploy.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await propiedadPorSlug(slug);
  if (!p) return { title: 'Propiedad no encontrada' };

  const titulo = `${tituloPropiedad(p)} · ${formatPrecio(p.precio)}`;

  // La portada es la vista previa al compartir la ficha por WhatsApp o redes.
  // Su URL se arma con el host que recibió la visita y no con site.url: hasta
  // que el dominio propio apunte al sitio, una URL de cotaclara.cl no carga y
  // la vista previa saldría sin foto.
  const host = (await headers()).get('host');
  const portada = p.imagenes?.[0] && host ? `https://${host}${p.imagenes[0]}` : null;
  // Sin fotos, la vista previa es la imagen de marca, no la primera foto que
  // encuentre el robot de la red social.
  const vistaPrevia = portada ?? (host ? `https://${host}/og.png` : '/og.png');

  return {
    title: titulo,
    description: p.resumen,
    // La canónica sí va al dominio propio (metadataBase): es la que deben
    // guardar los buscadores, aunque la ficha se abra desde otra dirección.
    alternates: { canonical: `/propiedades/${p.slug}` },
    // Next no mezcla este bloque con el del layout: lo reemplaza entero, así
    // que el nombre del sitio y el idioma se repiten acá.
    openGraph: {
      type: 'website',
      locale: 'es_CL',
      siteName: 'Cota Clara · Patrimonio Inmobiliario',
      title: titulo,
      description: p.resumen,
      images: [{ url: vistaPrevia, alt: tituloPropiedad(p) }],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: p.resumen,
      images: [vistaPrevia],
    },
  };
}

function galeria(p: Propiedad): GalleryItem[] {
  if (p.imagenes?.length) return p.imagenes.map((src, i) => ({ kind: 'foto' as const, src, label: `Foto ${i + 1}` }));
  const fotos: GalleryItem[] = [
    { kind: 'ilustracion', label: 'Fachada', variant: varianteTipo(p.tipo), seed: p.ilustracion.seed, tono: p.ilustracion.tono },
    {
      kind: 'ilustracion',
      label: 'Vista al atardecer',
      variant: varianteTipo(p.tipo),
      seed: p.ilustracion.seed,
      tono: p.ilustracion.tono === 'dia' ? 'atardecer' : 'dia',
    },
  ];
  const items = [...fotos];
  if (p.superficieUtil > 0) {
    items.push({
      kind: 'ilustracion',
      label: 'Planta referencial',
      variant: 'plano',
      dormitorios: p.dormitorios,
      superficie: p.superficieUtil,
      planta: p.tipo === 'oficina' ? 'oficina' : 'vivienda',
    });
  }
  if (p.sector) items.push({ kind: 'ilustracion', label: 'Entorno', variant: 'mapa', seed: p.ilustracion.seed, etiqueta: p.sector });
  return items;
}

export default async function PropiedadPage({ params }: Params) {
  const { slug } = await params;
  const p = await propiedadPorSlug(slug);
  if (!p) notFound();

  const periodo = periodoPrecio(p.precio);
  const ubicacion = [p.sector, p.comuna].filter(Boolean).join(', ');
  // El stock se consulta solo si el resumen dice que hay unidades: así una
  // ficha de retail no paga dos consultas por nada.
  const stock = p.stock?.total ? await stockPublicoPorSlug(p.slug) : null;
  const publicadas = await propiedadesPublicadas();
  const relacionadas = publicadas.filter((o) => o.slug !== p.slug && (o.comuna === p.comuna || o.operacion === p.operacion)).slice(0, 3);

  const ficha = [
    p.dormitorios > 0 ? { icono: 'bed' as const, label: 'Dormitorios', valor: String(p.dormitorios) } : null,
    p.banos > 0 ? { icono: 'bath' as const, label: 'Baños', valor: String(p.banos) } : null,
    p.estacionamientos > 0 ? { icono: 'car' as const, label: 'Estacionamientos', valor: String(p.estacionamientos) } : null,
    p.superficieUtil > 0 ? { icono: 'area' as const, label: 'Superficie útil', valor: `${formatNumero(p.superficieUtil)} m²` } : null,
    p.terreno && p.terreno > 0
      ? { icono: 'area' as const, label: 'Terreno', valor: `${formatNumero(p.terreno)} m²` }
      : p.superficieTotal > p.superficieUtil ? { icono: 'area' as const, label: 'Superficie total', valor: `${formatNumero(p.superficieTotal)} m²` } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  const datos = [
    p.orientacion ? { label: 'Orientación', valor: p.orientacion } : null,
    p.anio > 0 ? { label: 'Año de construcción', valor: String(p.anio) } : null,
    p.piso ? { label: 'Piso', valor: String(p.piso) } : null,
    p.bodegas > 0 ? { label: 'Bodegas', valor: String(p.bodegas) } : null,
    // Con las dos medidas va una sola línea; con una sola, se dice cuál es.
    p.frente && p.fondo
      ? { label: 'Dimensiones del terreno', valor: `${formatMetros(p.frente)} de frente × ${formatMetros(p.fondo)} de fondo` }
      : p.frente
        ? { label: 'Frente del terreno', valor: formatMetros(p.frente) }
        : p.fondo
          ? { label: 'Fondo del terreno', valor: formatMetros(p.fondo) }
          : null,
    p.gastosComunes ? { label: 'Gastos comunes', valor: `$${formatNumero(p.gastosComunes)} aprox.` } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
      <ContadorVisita slug={p.slug} />
      <PageHero
        migas={[{ href: '/', label: 'Inicio' }, { href: '/propiedades', label: 'Propiedades' }, { label: tituloPropiedad(p) }]}
        title={tituloPropiedad(p)}
      >
        <div className="property-head">
          <div className="property-head__meta">
            <span className={`badge badge--${p.operacion}`}>{p.operacion === 'venta' ? 'En venta' : 'En arriendo'}</span>
            {p.etiquetas.map((e) => (
              <span key={e} className="badge badge--outline-light">
                {e}
              </span>
            ))}
            <span className="property-head__location">
              <Icon name="pin" /> {ubicacion}
            </span>
          </div>
          <div className="property-head__cierre">
            <p className="property-head__price">
              {/* En un proyecto el precio es el de la unidad disponible más barata. */}
              {p.stock?.disponibles ? <span className="property-head__desde">Desde </span> : null}
              {formatPrecio(p.precio)}
              {periodo ? <span className="property-head__period"> {periodo}</span> : null}
            </p>
            {/* El propósito de la ficha: que pidan información o una reunión. Llevan al formulario de la columna. */}
            <div className="property-head__acciones">
              <a className="button button--primary" href="#solicitar">
                Pedir información
              </a>
              <a className="button button--outline-light" href="#solicitar-reunion">
                Agendar una reunión
              </a>
            </div>
          </div>
        </div>
      </PageHero>

      <section className="section section--after-hero section--tint">
        <div className="container property">
          <div className="property__main">
            <Gallery items={galeria(p)} />

            {ficha.length ? <ul className="specs">
              {ficha.map((f) => (
                <li key={f.label} className="specs__item">
                  <Icon name={f.icono} className="specs__icon" />
                  <span className="specs__value">{f.valor}</span>
                  <span className="specs__label">{f.label}</span>
                </li>
              ))}
            </ul> : null}

            <div className="property__block">
              <h2 className="property__title">Descripción</h2>
              <div className="property__text">
                {/* La posición como clave: dos párrafos pueden empezar igual. */}
                {p.descripcion.map((parrafo, i) => (
                  <p key={i}>{parrafo}</p>
                ))}
              </div>
              {datos.length ? <dl className="facts">
                {datos.map((d) => (
                  <div key={d.label} className="facts__item">
                    <dt className="facts__label">{d.label}</dt>
                    <dd className="facts__value">{d.valor}</dd>
                  </div>
                ))}
              </dl> : null}
            </div>

            {stock ? (
              <div className="property__block" id="unidades">
                <h2 className="property__title">Unidades y tipologías</h2>
                <p className="property__text">
                  {stock.resumen.disponibles > 0
                    ? `${formatNumero(stock.resumen.disponibles)} ${stock.resumen.disponibles === 1 ? 'unidad disponible' : 'unidades disponibles'}. Los precios están en UF y pueden cambiar sin aviso.`
                    : 'No quedan unidades disponibles en este proyecto. Escríbenos y te avisamos de la próxima etapa.'}
                </p>
                <TablaTipologias tipologias={stock.tipologias} unidades={stock.unidades} />
              </div>
            ) : null}

            <div className="property__block">
              <h2 className="property__title">Características</h2>
              <ul className="features">
                {p.caracteristicas.map((c) => (
                  <li key={c} className="features__item">
                    <Icon name="check" className="features__icon" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            <div className="property__block">
              <h2 className="property__title">Ubicación</h2>
              <p className="property__text">{ubicacion}.</p>
              {p.sector ? (
                <div className="property__map">
                  <Illustration variant="mapa" seed={p.ilustracion.seed} etiqueta={p.sector} label={`Mapa referencial de ${ubicacion}`} />
                </div>
              ) : null}
            </div>

            {p.operacion === 'venta' && p.precio.moneda === 'UF' ? (
              <div className="property__block">
                <h2 className="property__title">Calcula tu dividendo</h2>
                <p className="property__text">Ajusta el pie, el plazo y la tasa para estimar el dividendo mensual de un crédito hipotecario.</p>
                <MortgageCalculator precioUF={p.precio.valor} />
              </div>
            ) : null}
          </div>

          <aside className="property__aside" aria-label="Contacto">
            <LeadForm
              variante="visita"
              titulo="¿Te interesa esta propiedad?"
              bajada={`${tituloPropiedad(p)} · ${formatPrecio(p.precio)}${periodo ? ` ${periodo}` : ''}`}
              propiedad={p.slug}
              boton="Enviar solicitud"
              motivos={motivosFicha}
              ancla="solicitar"
            />
            <div className="agent-card">
              <span className="agent-card__avatar" aria-hidden="true">
                CC
              </span>
              <div className="agent-card__body">
                <p className="agent-card__name">Equipo Cota Clara</p>
                <p className="agent-card__role">{site.horario}</p>
              </div>
              <div className="agent-card__actions">
                <a className="agent-card__action" href={`tel:${site.telefonoHref}`} aria-label={`Llamar al ${site.telefono}`}>
                  <Icon name="phone" />
                </a>
                <a
                  className="agent-card__action"
                  href={whatsappHref(`Hola, me interesa la propiedad ${tituloPropiedad(p)} (${p.slug}).`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Escribir por WhatsApp"
                >
                  <Icon name="whatsapp" />
                </a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {relacionadas.length ? (
        <section className="section" aria-labelledby="relacionadas-titulo">
          <div className="container">
            <div className="section-head">
              <div className="section-head__text">
                <span className="eyebrow">También te puede interesar</span>
                <h2 className="section-head__title" id="relacionadas-titulo">
                  Propiedades similares
                </h2>
              </div>
              <Link className="link-arrow" href="/propiedades">
                Ver todas
                <Icon name="arrow" className="link-arrow__icon" />
              </Link>
            </div>
            <ul className="properties">
              {relacionadas.map((o) => (
                <li key={o.slug} className="properties__item">
                  <PropertyCard propiedad={o} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
