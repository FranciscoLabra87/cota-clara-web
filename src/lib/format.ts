import type { Precio, Propiedad } from '@/data/properties';

const entero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const uf = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 4 });

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
  const base = precio.moneda === 'UF' ? `UF ${uf.format(precio.valor)}` : `$${entero.format(precio.valor)}`;
  return base;
}

export function periodoPrecio(precio: Precio): string | null {
  return precio.periodo === 'mes' ? '/ mes' : null;
}

/** Los gastos comunes se guardan en CLP. No sumarlos a un canon expresado en UF. */
export function totalMensualArriendo(p: Pick<Propiedad, 'operacion' | 'precio' | 'gastosComunes'>): number | null {
  if (p.operacion !== 'arriendo' || p.precio.moneda !== 'CLP' || p.gastosComunes == null) return null;
  if (!Number.isFinite(p.precio.valor) || !Number.isFinite(p.gastosComunes) || p.precio.valor < 0 || p.gastosComunes < 0) return null;
  return p.precio.valor + p.gastosComunes;
}
