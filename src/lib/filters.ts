import type { Operacion, Propiedad } from '@/data/properties';

/** Precio máximo: UF para venta, pesos mensuales para arriendo. */
export const rangosPrecio: Record<Operacion, { value: string; label: string }[]> = {
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

export type Filtros = {
  operacion: string;
  tipo: string;
  comuna: string;
  dormitorios: string;
  precio: string;
  orden: string;
};

export const filtrosVacios: Filtros = { operacion: '', tipo: '', comuna: '', dormitorios: '', precio: '', orden: 'recientes' };

export function filtrarPropiedades(lista: Propiedad[], f: Filtros): Propiedad[] {
  const max = Number(f.precio) || 0;
  const resultado = lista.filter((p) => {
    if (f.operacion && p.operacion !== f.operacion) return false;
    if (f.tipo && p.tipo !== f.tipo) return false;
    if (f.comuna && p.comuna !== f.comuna) return false;
    if (f.dormitorios && p.dormitorios < Number(f.dormitorios)) return false;
    if (max && f.operacion) {
      const enPesos = p.precio.moneda === 'CLP';
      if (f.operacion === 'arriendo' && enPesos && p.precio.valor > max) return false;
      if (f.operacion === 'venta' && !enPesos && p.precio.valor > max) return false;
    }
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
