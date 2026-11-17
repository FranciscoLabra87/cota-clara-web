import { describe, expect, it } from 'vitest';
import { presentarFicha } from '../src/lib/ficha-presentacion';
import type { Propiedad } from '../src/data/properties';

const propiedad: Propiedad & { id: number; estado: string } = {
  id: 34, estado: 'PUBLICADA', slug: 'departamento-prueba', titulo: 'Departamento de prueba',
  tipo: 'departamento', operacion: 'arriendo', condicion: 'usado', comuna: 'Providencia', sector: '',
  precio: { valor: 650000, moneda: 'CLP', periodo: 'mes' }, dormitorios: 2, banos: 1,
  estacionamientos: 0, bodegas: 0, superficieUtil: 68.5, superficieTotal: 72, orientacion: '', anio: 0,
  etiquetas: [], resumen: 'Ejemplo', descripcion: [], caracteristicas: [], destacada: false,
  publicada: '2026-11-15', ilustracion: { seed: 1, tono: 'dia' },
};

describe('presentación de ficha técnica', () => {
  it('excluye notas internas del documento para cliente incluso si existen', () => {
    const cliente = presentarFicha(propiedad, { observaciones: 'NOTA PRIVADA DEL EQUIPO' }, false);
    expect(JSON.stringify(cliente)).not.toContain('NOTA PRIVADA');
    expect(cliente.secciones.some((s) => s.titulo.includes('Uso interno'))).toBe(false);
    expect(JSON.stringify(presentarFicha(propiedad, { observaciones: 'NOTA PRIVADA DEL EQUIPO' }, true))).toContain('NOTA PRIVADA');
  });

  it('no convierte antecedentes ausentes en cero ni en verificados', () => {
    const texto = JSON.stringify(presentarFicha(propiedad, {}, false));
    expect(texto).toContain('No informado');
    expect(texto).toContain('Pendientes');
    expect(texto).not.toContain('Revisados documentalmente');
    const cero = presentarFicha(propiedad, { contribuciones: 0 }, false);
    expect(JSON.stringify(cero)).toContain('$0 / cuota trimestral');
  });

  it('preserva precisión, moneda y período y no expone enlace público en borrador', () => {
    const datos = presentarFicha({ ...propiedad, estado: 'BORRADOR' }, {}, false);
    expect(datos.enlace).toBeNull();
    expect(JSON.stringify(datos)).toContain('68,50 m²');
    expect(JSON.stringify(datos)).toContain('$650.000 / mes');
  });
});
