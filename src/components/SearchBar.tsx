'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { comunas } from '@/data/site';
import { tipos, type Operacion } from '@/data/properties';
import { rangosPrecio } from '@/lib/filters';

export function SearchBar() {
  const router = useRouter();
  const id = useId();
  const [operacion, setOperacion] = useState<Operacion>('venta');

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const params = new URLSearchParams({ operacion });
    for (const key of ['tipo', 'comuna', 'precio']) {
      const value = String(data.get(key) ?? '');
      if (value) params.set(key, value);
    }
    router.push(`/propiedades?${params.toString()}`);
  }

  return (
    <form className="search" onSubmit={onSubmit} role="search" aria-label="Buscar propiedades">
      <div className="search__tabs" role="radiogroup" aria-label="Operación">
        {(['venta', 'arriendo'] as const).map((op) => (
          <button
            key={op}
            type="button"
            role="radio"
            aria-checked={operacion === op}
            className={`search__tab${operacion === op ? ' search__tab--active' : ''}`}
            onClick={() => setOperacion(op)}
          >
            {op === 'venta' ? 'Comprar' : 'Arrendar'}
          </button>
        ))}
      </div>
      <div className="search__fields">
        <div className="field search__field">
          <label className="field__label" htmlFor={`${id}-tipo`}>
            Tipo
          </label>
          <select className="field__control field__control--select" id={`${id}-tipo`} name="tipo" defaultValue="">
            <option value="">Todos</option>
            {tipos.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field search__field">
          <label className="field__label" htmlFor={`${id}-comuna`}>
            Comuna
          </label>
          <select className="field__control field__control--select" id={`${id}-comuna`} name="comuna" defaultValue="">
            <option value="">Todas</option>
            {comunas.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field search__field">
          <label className="field__label" htmlFor={`${id}-precio`}>
            Precio
          </label>
          <select className="field__control field__control--select" id={`${id}-precio`} name="precio" defaultValue="" key={operacion}>
            <option value="">Sin límite</option>
            {rangosPrecio[operacion].map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button button--primary search__submit">
          <Icon name="search" className="button__icon button__icon--static" />
          Buscar
        </button>
      </div>
    </form>
  );
}
