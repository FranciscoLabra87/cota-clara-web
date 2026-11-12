import Link from 'next/link';
import { Icon } from './Icon';
import { PropertyMedia } from './PropertyMedia';
import { formatNumero, formatPrecio, periodoPrecio } from '@/lib/format';
import { tituloPropiedad, type Propiedad } from '@/data/properties';

export function PropertyCard({ propiedad, headingLevel = 3 }: { propiedad: Propiedad; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const periodo = periodoPrecio(propiedad.precio);
  const titulo = tituloPropiedad(propiedad);
  const tieneSpecs = [propiedad.dormitorios, propiedad.banos, propiedad.estacionamientos, propiedad.superficieUtil].some((n) => n > 0);
  return (
    <article className="property-card">
      <div className="property-card__media">
        <PropertyMedia propiedad={propiedad} className="property-card__image" />
        <span className={`badge badge--${propiedad.operacion} property-card__badge`}>
          {propiedad.operacion === 'venta' ? 'En venta' : 'En arriendo'}
        </span>
        {propiedad.etiquetas[0] ? <span className="property-card__tag">{propiedad.etiquetas[0]}</span> : null}
      </div>
      <div className="property-card__body">
        <p className="property-card__location">
          <Icon name="pin" className="property-card__location-icon" />
          {propiedad.sector || propiedad.comuna}
        </p>
        <Heading className="property-card__title">
          <Link className="property-card__link" href={`/propiedades/${propiedad.slug}`}>
            {titulo}
          </Link>
        </Heading>
        {tieneSpecs ? (
          <ul className="property-card__specs" aria-label="Características principales">
            {propiedad.dormitorios > 0 ? (
              <li className="property-card__spec">
                <Icon name="bed" className="property-card__spec-icon" />
                {propiedad.dormitorios}
                <span className="visually-hidden"> dormitorios</span>
              </li>
            ) : null}
            {propiedad.banos > 0 ? (
              <li className="property-card__spec">
                <Icon name="bath" className="property-card__spec-icon" />
                {propiedad.banos}
                <span className="visually-hidden"> baños</span>
              </li>
            ) : null}
            {propiedad.estacionamientos > 0 ? (
              <li className="property-card__spec">
                <Icon name="car" className="property-card__spec-icon" />
                {propiedad.estacionamientos}
                <span className="visually-hidden"> estacionamientos</span>
              </li>
            ) : null}
            {propiedad.superficieUtil > 0 ? (
              <li className="property-card__spec">
                <Icon name="area" className="property-card__spec-icon" />
                {formatNumero(propiedad.superficieUtil)} m²
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="property-card__footer">
          <p className="property-card__price">
            {formatPrecio(propiedad.precio)}
            {periodo ? <span className="property-card__period"> {periodo}</span> : null}
          </p>
          <span className="property-card__go" aria-hidden="true">
            <Icon name="arrow" className="property-card__go-icon" />
          </span>
        </div>
      </div>
    </article>
  );
}
