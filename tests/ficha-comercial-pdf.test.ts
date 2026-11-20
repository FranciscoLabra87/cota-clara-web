import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generarFichaComercialPdf } from '@/lib/ficha-comercial-pdf';
import type { MapaFicha } from '@/lib/ficha-mapa';
import type { PropiedadAdmin } from '@/lib/propiedades';

const propiedad: PropiedadAdmin = {
  id: 81, estado: 'BORRADOR', slug: 'casa-prueba', titulo: 'Casa de prueba',
  tipo: 'casa', operacion: 'venta', condicion: 'usado', comuna: 'La Reina', sector: '',
  precio: { valor: 8900, moneda: 'UF' }, dormitorios: 0, banos: 0,
  estacionamientos: 0, bodegas: 0, superficieUtil: 0, superficieTotal: 0,
  orientacion: '', anio: 0, etiquetas: [], resumen: 'Conoce esta propiedad.',
  descripcion: [], caracteristicas: [], destacada: false, publicada: '2026-11-19',
  ilustracion: { seed: 1, tono: 'dia' },
};

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));

describe('ficha comercial visual', () => {
  it('genera una portada A4 para un borrador sin fotos ni métricas informadas', async () => {
    const bytes = await generarFichaComercialPdf(propiedad, { fecha: '19 de noviembre de 2026', imagenes: [] });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getSubject()).toBe('Ficha comercial de propiedad');
    expect(pdf.getTitle()).toContain('Casa de prueba');
    expect(pdf.getPages()[0].getWidth()).toBeCloseTo(595.28);
    expect(pdf.getPages()[0].getHeight()).toBeCloseTo(841.89);
  });

  it('pagina 12 fotografías, descripción extensa y atributos adicionales', async () => {
    const texto = 'Descripción amplia de los espacios de la propiedad y de su distribución. '.repeat(28);
    const completa = {
      ...propiedad,
      descripcion: [texto, texto, texto],
      caracteristicas: Array.from({ length: 16 }, (_, i) => `Característica ${i + 1}`),
      terreno: 540, frente: 18, fondo: 30, piso: 2, orientacion: 'Norte', anio: 2008,
      etiquetas: ['Jardín', 'Vista abierta'],
    };
    const imagenes = Array.from({ length: 12 }, () => ({ bytes: png, formato: 'png' as const }));
    const bytes = await generarFichaComercialPdf(completa, { fecha: '19 de noviembre de 2026', imagenes });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(6);
    expect(pdf.getPages().every((pagina) => Math.abs(pagina.getWidth() - 595.28) < 0.01)).toBe(true);
  });
  it('agrega la página de ubicación con las teselas del mapa', async () => {
    const mapa: MapaFicha = {
      zoom: 16, columnas: 3, filas: 2, pinX: 0.5, pinY: 0.5,
      claves: [], atribucion: 'Mapa © OpenStreetMap contributors (ODbL)',
      latitud: -33.4449435, longitud: -70.5267066,
      teselas: Array.from({ length: 6 }, (_, indice) => ({
        columna: indice % 3, fila: Math.floor(indice / 3), bytes: png,
      })),
    };
    const sinMapa = await PDFDocument.load(await generarFichaComercialPdf(propiedad, { fecha: 'hoy', imagenes: [] }));
    const conMapa = await PDFDocument.load(await generarFichaComercialPdf(propiedad, { fecha: 'hoy', imagenes: [], mapa }));
    expect(conMapa.getPageCount()).toBe(sinMapa.getPageCount() + 1);
  });

  it('usa el titular y los destacados elegidos en el panel', async () => {
    const completa = { ...propiedad, caracteristicas: ['Piscina', 'Quincho', 'Bodega equipada'] };
    const bytes = await generarFichaComercialPdf(completa, {
      fecha: '19 de noviembre de 2026',
      imagenes: [],
      ajustes: { titulo: 'Casa con piscina en La Reina', bajada: 'Lista para entrar.', destacados: [1], mapa: false },
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toContain('Casa con piscina en La Reina');
    expect(pdf.getTitle()).not.toContain('Casa de prueba');
  });
});
