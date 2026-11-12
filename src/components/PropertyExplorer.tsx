'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import { PropertyCard } from './PropertyCard';
import { comunasDisponibles, tipos, type Operacion, type Propiedad } from '@/data/properties';
import { filtrarPropiedades, filtrosVacios, opcionesPrecioDisponibles, type Filtros } from '@/lib/filters';

export function PropertyExplorer({ propiedades }: { propiedades: Propiedad[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();

  const [filtros, setFiltros] = useState<Filtros>(() => ({
    operacion: params.get('operacion') ?? '',
    tipo: params.get('tipo') ?? '',
    comuna: params.get('comuna') ?? '',
    dormitorios: params.get('dormitorios') ?? '',
    precio: params.get('precio') ?? '',
    orden: params.get('orden') ?? 'recientes',
  }));

  const resultados = useMemo(() => filtrarPropiedades([...propiedades], filtros), [propiedades, filtros]);
  const comunas = useMemo(() => comunasDisponibles(propiedades), [propiedades]);
  const monedasMixtas = new Set(resultados.map((p) => p.precio.moneda)).size > 1;
  const activos = Object.entries(filtros).some(([k, v]) => v && !(k === 'orden' && v === 'recientes'));

  function aplicar(next: Filtros) {
    setFiltros(next);
    const qs = new URLSearchParams(
      Object.entries(next).filter(([k, v]) => v && !(k === 'orden' && v === 'recientes')) as [string, string][],
    ).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const set = (key: keyof Filtros) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = { ...filtros, [key]: e.target.value };
    if (key === 'operacion') next.precio = '';
    aplicar(next);
  };

  const opcionesPrecio = filtros.operacion === 'venta' || filtros.operacion === 'arriendo'
    ? opcionesPrecioDisponibles(propiedades, filtros.operacion as Operacion)
    : [];

  return (
    <div className="explorer">
      <form className="filters" aria-label="Filtrar propiedades" onSubmit={(e) => e.preventDefault()}>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-op`}>
            Operación
          </label>
          <select className="field__control field__control--select" id={`${id}-op`} value={filtros.operacion} onChange={set('operacion')}>
            <option value="">Venta y arriendo</option>
            <option value="venta">Venta</option>
            <option value="arriendo">Arriendo</option>
          </select>
        </div>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-tipo`}>
            Tipo
          </label>
          <select className="field__control field__control--select" id={`${id}-tipo`} value={filtros.tipo} onChange={set('tipo')}>
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-comuna`}>
            Comuna
          </label>
          <select className="field__control field__control--select" id={`${id}-comuna`} value={filtros.comuna} onChange={set('comuna')}>
            <option value="">Todas</option>
            {comunas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-dorm`}>
            Dormitorios
          </label>
          <select className="field__control field__control--select" id={`${id}-dorm`} value={filtros.dormitorios} onChange={set('dormitorios')}>
            <option value="">Indiferente</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} o más
              </option>
            ))}
          </select>
        </div>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-precio`}>
            Precio
          </label>
          <select
            className="field__control field__control--select"
            id={`${id}-precio`}
            value={filtros.precio}
            onChange={set('precio')}
            disabled={!filtros.operacion}
          >
            <option value="">{filtros.operacion ? 'Sin límite' : 'Elige operación'}</option>
            {opcionesPrecio.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field filters__field">
          <label className="field__label" htmlFor={`${id}-orden`}>
            Ordenar
          </label>
          <select className="field__control field__control--select" id={`${id}-orden`} value={filtros.orden} onChange={set('orden')}>
            <option value="recientes">Más recientes</option>
            <option value="precio-asc">{monedasMixtas ? 'UF primero · menor precio' : 'Menor precio'}</option>
            <option value="precio-desc">{monedasMixtas ? 'UF primero · mayor precio' : 'Mayor precio'}</option>
            <option value="superficie">Mayor superficie</option>
          </select>
        </div>
      </form>

      <div className="explorer__bar">
        <p className="explorer__count" aria-live="polite">
          {resultados.length === 1 ? '1 propiedad' : `${resultados.length} propiedades`}
        </p>
        {activos ? (
          <button type="button" className="explorer__reset" onClick={() => aplicar(filtrosVacios)}>
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {resultados.length > 0 ? (
        <ul className="properties">
          {resultados.map((p) => (
            <li key={p.slug} className="properties__item">
              <PropertyCard propiedad={p} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="explorer__empty">
          <p className="explorer__empty-title">No hay propiedades con esos filtros.</p>
          <p className="explorer__empty-text">Prueba con otra comuna o déjanos tu búsqueda y te avisamos cuando aparezca una.</p>
          <button type="button" className="button button--outline" onClick={() => aplicar(filtrosVacios)}>
            Ver todas las propiedades
          </button>
        </div>
      )}
    </div>
  );
}
