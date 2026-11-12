import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Gallery, type GalleryItem } from '@/components/Gallery';
import { Icon } from '@/components/Icon';
import { Illustration } from '@/components/Illustration';
import { LeadForm } from '@/components/LeadForm';
import { MortgageCalculator } from '@/components/MortgageCalculator';
import { PageHero } from '@/components/PageHero';
import { PropertyCard } from '@/components/PropertyCard';
import { varianteTipo } from '@/components/PropertyMedia';
import { tituloPropiedad, type Propiedad } from '@/data/properties';
import { site, whatsappHref } from '@/data/site';
import { formatNumero, formatPrecio, periodoPrecio } from '@/lib/format';
import { propiedadPorSlug, propiedadesPublicadas } from '@/lib/propiedades';

type Params = { params: Promise<{ slug: string }> };

// Sin generateStaticParams: las fichas salen de D1 y se arman en cada visita,
// para que publicar desde el panel no dependa de un deploy.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await propiedadPorSlug(slug);
  if (!p) return { title: 'Propiedad no encontrada' };
  return {
    title: `${tituloPropiedad(p)} · ${formatPrecio(p.precio)}`,
    description: p.resumen,
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
    p.gastosComunes ? { label: 'Gastos comunes', valor: `$${formatNumero(p.gastosComunes)} aprox.` } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <>
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
          <p className="property-head__price">
            {formatPrecio(p.precio)}
            {periodo ? <span className="property-head__period"> {periodo}</span> : null}
          </p>
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
                {p.descripcion.map((parrafo) => (
                  <p key={parrafo.slice(0, 24)}>{parrafo}</p>
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
              titulo="Agenda una visita"
              bajada={`${tituloPropiedad(p)} · ${formatPrecio(p.precio)}${periodo ? ` ${periodo}` : ''}`}
              propiedad={p.slug}
              boton="Solicitar visita"
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
