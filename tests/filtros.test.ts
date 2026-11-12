import { describe, expect, it } from 'vitest';
import type { Propiedad } from '@/data/properties';
import { filtrarPropiedades, filtrosVacios, rangosPrecio } from '@/lib/filters';

const propiedad = (p: Partial<Propiedad> & { slug: string }): Propiedad => ({
  tipo: 'departamento',
  operacion: 'venta',
  comuna: 'Providencia',
  sector: '',
  precio: { valor: 7000, moneda: 'UF' },
  dormitorios: 2,
  banos: 2,
  estacionamientos: 1,
  bodegas: 1,
  superficieUtil: 80,
  superficieTotal: 90,
  orientacion: 'Norte',
  anio: 2015,
  etiquetas: [],
  resumen: '',
  descripcion: [],
  caracteristicas: [],
  destacada: false,
  publicada: '2026-01-01',
  ilustracion: { seed: 1, tono: 'dia' },
  ...p,
});

const inventario: Propiedad[] = [
  propiedad({ slug: 'depto-barato', precio: { valor: 6000, moneda: 'UF' }, superficieUtil: 60, publicada: '2026-03-01' }),
  propiedad({ slug: 'depto-caro', precio: { valor: 15000, moneda: 'UF' }, superficieUtil: 140, dormitorios: 4, publicada: '2026-01-15' }),
  propiedad({ slug: 'casa-nunoa', tipo: 'casa', comuna: 'Ñuñoa', precio: { valor: 9000, moneda: 'UF' }, superficieUtil: 120, dormitorios: 3, publicada: '2026-02-01' }),
  propiedad({
    slug: 'arriendo-oficina',
    tipo: 'oficina',
    operacion: 'arriendo',
    precio: { valor: 1200000, moneda: 'CLP', periodo: 'mes' },
    superficieUtil: 45,
    dormitorios: 0,
    publicada: '2026-04-01',
  }),
];

const slugs = (f: Partial<typeof filtrosVacios>) =>
  filtrarPropiedades(inventario, { ...filtrosVacios, ...f }).map((p) => p.slug);

describe('filtros', () => {
  it('sin filtros devuelve todo, de lo más nuevo a lo más viejo', () => {
    expect(slugs({})).toEqual(['arriendo-oficina', 'depto-barato', 'casa-nunoa', 'depto-caro']);
  });

  it('filtra por operación, tipo y comuna', () => {
    expect(slugs({ operacion: 'arriendo' })).toEqual(['arriendo-oficina']);
    expect(slugs({ tipo: 'casa' })).toEqual(['casa-nunoa']);
    expect(slugs({ comuna: 'Ñuñoa' })).toEqual(['casa-nunoa']);
  });

  it('los dormitorios son un mínimo, no un igual', () => {
    expect(slugs({ dormitorios: '3' })).toEqual(['casa-nunoa', 'depto-caro']);
  });

  it('el tope de precio solo aplica a la moneda de esa operación', () => {
    expect(slugs({ operacion: 'venta', precio: '8000' })).toEqual(['depto-barato']);
    expect(slugs({ operacion: 'arriendo', precio: '1000000' })).toEqual([]);
    expect(slugs({ operacion: 'arriendo', precio: '1500000' })).toEqual(['arriendo-oficina']);
  });

  it('sin operación elegida el tope de precio no filtra nada', () => {
    expect(slugs({ precio: '8000' })).toHaveLength(4);
  });

  it('ordena por precio dejando las UF antes que los pesos', () => {
    expect(slugs({ orden: 'precio-asc' })).toEqual(['depto-barato', 'casa-nunoa', 'depto-caro', 'arriendo-oficina']);
    expect(slugs({ orden: 'precio-desc' })).toEqual(['depto-caro', 'casa-nunoa', 'depto-barato', 'arriendo-oficina']);
  });

  it('ordena por superficie de mayor a menor', () => {
    expect(slugs({ orden: 'superficie' })).toEqual(['depto-caro', 'casa-nunoa', 'depto-barato', 'arriendo-oficina']);
  });

  it('no toca la lista original', () => {
    const antes = inventario.map((p) => p.slug);
    filtrarPropiedades(inventario, { ...filtrosVacios, orden: 'precio-desc' });
    expect(inventario.map((p) => p.slug)).toEqual(antes);
  });

  it('los rangos que se ofrecen están en la moneda de su operación', () => {
    expect(rangosPrecio.venta.map((r) => r.label)).toEqual(expect.arrayContaining([expect.stringContaining('UF')]));
    expect(rangosPrecio.arriendo.map((r) => r.label)).toEqual(expect.arrayContaining([expect.stringContaining('$')]));
  });
});
