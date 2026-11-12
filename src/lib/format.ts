import type { Precio } from '@/data/properties';

const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

export function formatNumero(valor: number, decimales = 0): string {
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
}

export function formatPrecio(precio: Precio): string {
  const base = precio.moneda === 'UF' ? `UF ${entero.format(precio.valor)}` : `$${entero.format(precio.valor)}`;
  return base;
}

export function periodoPrecio(precio: Precio): string | null {
  return precio.periodo === 'mes' ? '/ mes' : null;
}
