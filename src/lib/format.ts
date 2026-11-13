import type { Precio } from '@/data/properties';

const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export function formatNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

const metros = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });

/** Metros con hasta dos decimales y sin ceros de relleno: 12,5 m y no 12,50 m. */
export const formatMetros = (valor: number) => `${metros.format(valor)} m`;

export function formatPrecio(precio: Precio): string {
  const base = precio.moneda === 'UF' ? `UF ${entero.format(precio.valor)}` : `$${entero.format(precio.valor)}`;
  return base;
}

export function periodoPrecio(precio: Precio): string | null {
  return precio.periodo === 'mes' ? '/ mes' : null;
}
