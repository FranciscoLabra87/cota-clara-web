import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generarFichaPdf } from '@/lib/ficha-pdf';
import type { PropiedadAdmin } from '@/lib/propiedades';

const p: PropiedadAdmin = {
  id: 42, estado: 'PUBLICADA', slug: 'departamento-prueba', titulo: 'Departamento · Ñuñoa',
  tipo: 'departamento', operacion: 'arriendo', condicion: 'usado', comuna: 'Ñuñoa', sector: '',
  precio: { valor: 600000, moneda: 'CLP', periodo: 'mes' }, gastosComunes: 110000,
  dormitorios: 3, banos: 2, estacionamientos: 1, bodegas: 1, superficieUtil: 72, superficieTotal: 77,
  orientacion: '', anio: 0, etiquetas: [], resumen: 'Propiedad para prueba de generación.',
  descripcion: ['Descripción con acentos y caracteres: áéíóú ñ m².'], caracteristicas: ['Terraza', 'Piscina'],
  destacada: false, publicada: '2026-11-15', ilustracion: { seed: 1, tono: 'dia' },
};

describe('generación real de PDF dentro del runtime Worker', () => {
  it('genera A4 con fuentes embebidas y metadatos sin notas internas', async () => {
    const bytes = await generarFichaPdf(p, { observaciones: 'NOTA PRIVADA' }, { interna: false, fecha: '15/11/2026', imagenes: [] });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toContain('Ñuñoa');
    expect(pdf.getSubject()).toBe('Ficha comercial para visitas');
    expect(pdf.getAuthor()).toBe('Cota Clara');
    expect(JSON.stringify([pdf.getTitle(), pdf.getSubject(), pdf.getKeywords()])).not.toContain('NOTA PRIVADA');
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28);
      expect(page.getHeight()).toBeCloseTo(841.89);
    }
  });

  it('admite fotos PNG y texto largo sin fallar la descarga', async () => {
    const imagen = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
    const bytes = await generarFichaPdf({ ...p, titulo: 'Departamento amplio '.repeat(15), descripcion: ['Descripción extensa con información. '.repeat(400)] }, {
      observaciones: 'Nota interna de prueba. '.repeat(35),
    }, { interna: true, fecha: '15/11/2026', imagenes: [{ bytes: imagen, formato: 'png' }] });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getSubject()).toBe('Ficha de uso interno');
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });
});
