import type { Operacion, Precio, Propiedad } from '@/data/properties';

export type OpcionPrecio = { value: string; label: string };

/** Conserva los enlaces existentes: UF para venta y CLP para arriendo. */
export const rangosPrecio: Record<Operacion, OpcionPrecio[]> = {
  venta: [
    { value: '8000', label: 'Hasta UF 8.000' },
    { value: '12000', label: 'Hasta UF 12.000' },
    { value: '20000', label: 'Hasta UF 20.000' },
  ],
  arriendo: [
    { value: '1000000', label: 'Hasta $1.000.000' },
    { value: '1500000', label: 'Hasta $1.500.000' },
    { value: '2000000', label: 'Hasta $2.000.000' },
  ],
};

const monedaPrincipal: Record<Operacion, Precio['moneda']> = { venta: 'UF', arriendo: 'CLP' };
const formatoNumero = new Intl.NumberFormat('es-CL');
const textoPrecio = (moneda: Precio['moneda'], valor: number) =>
  moneda === 'UF' ? `UF ${formatoNumero.format(valor)}` : `$${formatoNumero.format(valor)}`;

/** Los topes de la segunda moneda salen de los precios publicados. */
export function opcionesPrecioDisponibles(propiedades: Propiedad[], operacion: Operacion): OpcionPrecio[] {
  const precios = propiedades.filter((p) => p.operacion === operacion).map((p) => p.precio);
  if (!precios.length) return rangosPrecio[operacion];

  const principal = monedaPrincipal[operacion];
  const monedas = new Set(precios.map((p) => p.moneda));
  const opciones: OpcionPrecio[] = [];

  for (const moneda of [principal, principal === 'UF' ? 'CLP' : 'UF'] as const) {
    if (!monedas.has(moneda)) continue;
    const valores = [...new Set(precios.filter((p) => p.moneda === moneda).map((p) => p.valor))].sort((a, b) => a - b);
    if (monedas.size > 1) opciones.push({ value: moneda, label: `Solo ${moneda === 'UF' ? 'UF' : 'pesos'} (sin límite)` });

    if (moneda === principal) {
      opciones.push(...rangosPrecio[operacion]);
      const mayorTope = Math.max(...rangosPrecio[operacion].map((r) => Number(r.value)));
      const mayorPrecio = valores.at(-1) ?? 0;
      if (mayorPrecio > mayorTope) {
        opciones.push({ value: `${moneda}:${mayorPrecio}`, label: `Hasta ${textoPrecio(moneda, mayorPrecio)}` });
      }
    } else {
      const indices = [0, Math.floor((valores.length - 1) / 2), valores.length - 1];
      for (const valor of [...new Set(indices.map((i) => valores[i]))]) {
        opciones.push({ value: `${moneda}:${valor}`, label: `Hasta ${textoPrecio(moneda, valor)}` });
      }
    }
  }
  return opciones;
}

export type Filtros = {
  operacion: string;
  tipo: string;
  comuna: string;
  dormitorios: string;
  precio: string;
  orden: string;
};

export const filtrosVacios: Filtros = { operacion: '', tipo: '', comuna: '', dormitorios: '', precio: '', orden: 'recientes' };

function precioSeleccionado(precio: string, operacion: string): { moneda: Precio['moneda']; max?: number } | null {
  if (!operacion || !precio) return null;
  const partes = /^(?:(UF|CLP)(?::([1-9]\d*))?|([1-9]\d*))$/.exec(precio);
  if (!partes) return null;
  const moneda = (partes[1] || monedaPrincipal[operacion as Operacion]) as Precio['moneda'];
  const max = partes[2] || partes[3];
  if (!max) return { moneda };
  const numero = Number(max);
  return Number.isSafeInteger(numero) ? { moneda, max: numero } : null;
}

export function filtrarPropiedades(lista: Propiedad[], f: Filtros): Propiedad[] {
  const precio = precioSeleccionado(f.precio, f.operacion);
  const resultado = lista.filter((p) => {
    if (f.operacion && p.operacion !== f.operacion) return false;
    if (f.tipo && p.tipo !== f.tipo) return false;
    if (f.comuna && p.comuna !== f.comuna) return false;
    if (f.dormitorios && p.dormitorios < Number(f.dormitorios)) return false;
    if (precio && (p.precio.moneda !== precio.moneda || (precio.max && p.precio.valor > precio.max))) return false;
    return true;
  });
  const porMoneda = (a: Propiedad, b: Propiedad) => (a.precio.moneda === b.precio.moneda ? 0 : a.precio.moneda === 'UF' ? -1 : 1);
  switch (f.orden) {
    case 'precio-asc':
      return resultado.sort((a, b) => porMoneda(a, b) || a.precio.valor - b.precio.valor);
    case 'precio-desc':
      return resultado.sort((a, b) => porMoneda(a, b) || b.precio.valor - a.precio.valor);
    case 'superficie':
      return resultado.sort((a, b) => b.superficieUtil - a.superficieUtil);
    default:
      return resultado.sort((a, b) => b.publicada.localeCompare(a.publicada));
  }
}
