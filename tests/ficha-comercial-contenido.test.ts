import { describe, expect, it } from 'vitest';
import {
  avisosFicha, bloquesDescripcion, candidatosDestacados, dividendoReferencial,
  normalizarAjustesFicha, perfilFicha, MAX_BAJADA_FICHA, MAX_TITULO_FICHA,
} from '@/lib/ficha-comercial-contenido';
import type { PropiedadAdmin } from '@/lib/propiedades';

const base: PropiedadAdmin = {
  id: 7, estado: 'PUBLICADA', slug: 'casa-prueba', titulo: 'Casa en La Reina',
  tipo: 'casa', operacion: 'venta', condicion: 'usado', comuna: 'La Reina', sector: 'La Reina Alta',
  latitud: -33.4449435, longitud: -70.5267066,
  precio: { valor: 8900, moneda: 'UF' }, dormitorios: 4, banos: 3,
  estacionamientos: 2, bodegas: 1, superficieUtil: 180, superficieTotal: 200, terreno: 520,
  frente: 16, fondo: 32.5, orientacion: 'Norponiente', anio: 2008,
  etiquetas: ['Vista despejada'], resumen: 'Casa familiar en calle interior.',
  descripcion: ['Casa de dos pisos.'], caracteristicas: ['Piscina', 'Quincho'],
  destacada: false, publicada: '2026-11-19', ilustracion: { seed: 3, tono: 'dia' },
  imagenes: ['/fotos/a.jpg', '/fotos/b.jpg', '/fotos/c.jpg'],
};

const con = (cambios: Partial<PropiedadAdmin>): PropiedadAdmin => ({ ...base, ...cambios });

describe('contenido de la ficha comercial', () => {
  it('pone adelante lo que vende cada tipo de propiedad', () => {
    const casa = perfilFicha(base).pilares.map((pilar) => pilar.etiqueta);
    expect(casa).toEqual(['dormitorios', 'baños', 'construidos', 'de terreno']);

    const departamento = perfilFicha(con({ tipo: 'departamento', piso: 8 })).pilares.map((pilar) => pilar.etiqueta);
    expect(departamento).toEqual(['dormitorios', 'baños', 'útiles', 'superficie total']);

    const oficina = perfilFicha(con({ tipo: 'oficina', dormitorios: 0, piso: 12 })).pilares.map((pilar) => pilar.etiqueta);
    expect(oficina).toEqual(['útiles', 'superficie total', 'baños', 'estacionamientos']);
  });

  it('no repite en los datos lo que ya está en los pilares y arma las medidas del terreno', () => {
    const perfil = perfilFicha(base);
    const etiquetas = perfil.datos.map(([etiqueta]) => etiqueta);
    expect(etiquetas).not.toContain('Dormitorios');
    expect(etiquetas).not.toContain('Terreno');
    expect(perfil.datos).toContainEqual(['Medidas del terreno', '16 m de frente × 32,5 m de fondo']);
    expect(perfil.datos).toContainEqual(['Superficie total', '200 m²']);
  });

  it('cambia la banda de precios según venta, arriendo y segmento', () => {
    const venta = perfilFicha(base);
    expect(venta.precios.map(([etiqueta]) => etiqueta)).toEqual(['VENTA', 'VALOR POR M²', 'DIVIDENDO REFERENCIAL']);
    expect(venta.precios[1][1]).toBe('UF 49,4 / m²');
    expect(venta.notaPrecio).toContain('pie 20%');

    const arriendo = perfilFicha(con({
      operacion: 'arriendo', precio: { valor: 1_200_000, moneda: 'CLP', periodo: 'mes' }, gastosComunes: 180_000,
    }));
    expect(arriendo.precios.map(([etiqueta]) => etiqueta)).toEqual(['ARRIENDO MENSUAL', 'GASTOS COMUNES / MES', 'TOTAL MENSUAL REFERENCIAL']);
    expect(arriendo.precios[2][1]).toBe('$1.380.000');
    expect(arriendo.cierre.titulo).toBe('Agenda una visita.');

    const proyecto = perfilFicha(con({ condicion: 'nuevo' }));
    expect(proyecto.segmento).toContain('Proyecto de inversión');
    expect(proyecto.notaPrecio).toContain('Proyecto en venta');

    const sinPrecio = perfilFicha(con({ precio: { valor: 0, moneda: 'UF' } }));
    expect(sinPrecio.precios).toEqual([['VENTA', 'Valor a consultar']]);
  });

  it('calcula el dividendo solo para ventas con precio', () => {
    expect(dividendoReferencial(base)).toBe('UF 38,0 / mes');
    expect(dividendoReferencial(con({ precio: { valor: 142_000_000, moneda: 'CLP' } }))).toMatch(/^\$6\d{2}\.\d{3} \/ mes$/);
    expect(dividendoReferencial(con({ operacion: 'arriendo' }))).toBeNull();
    expect(dividendoReferencial(con({ precio: { valor: 0, moneda: 'UF' } }))).toBeNull();
  });

  it('respeta los destacados elegidos a mano y deja el resto fuera de la portada', () => {
    const candidatos = candidatosDestacados(base);
    expect(candidatos).toEqual(['2 estacionamientos', '1 bodega', 'Piscina', 'Quincho', 'Vista despejada']);
    const perfil = perfilFicha(base, { titulo: '', bajada: '', destacados: [3, 0], mapa: true });
    expect(perfil.destacados).toEqual(['Quincho', '2 estacionamientos']);
    expect(perfilFicha(base).destacados).toHaveLength(5);
  });

  it('usa el titular y la bajada de la ficha cuando vienen, y el aviso cuando no', () => {
    const propio = perfilFicha(base, { titulo: 'Casa con piscina a pasos del Parque', bajada: 'Lista para entrar.', destacados: [], mapa: true });
    expect(propio.titulo).toBe('Casa con piscina a pasos del Parque');
    expect(propio.bajada).toBe('Lista para entrar.');
    expect(perfilFicha(base).titulo).toBe('Casa en La Reina');
    expect(perfilFicha(base).bajada).toBe('Casa familiar en calle interior.');
  });

  it('separa en bloques la descripción pegada que traen los avisos importados', () => {
    const propiedad = con({
      descripcion: [[
        'Se vende impecable departamento en tercer piso.',
        'Características Principales:',
        'Superficie: 78,59 m² totales construidos.',
        'Piscina.',
        '- Acceso controlado.',
      ].join('\n')],
    });
    expect(bloquesDescripcion(propiedad)).toEqual([
      { tipo: 'parrafo', texto: 'Se vende impecable departamento en tercer piso.' },
      { tipo: 'subtitulo', texto: 'Características Principales' },
      { tipo: 'dato', etiqueta: 'Superficie', valor: '78,59 m² totales construidos.' },
      { tipo: 'item', texto: 'Piscina.' },
      { tipo: 'item', texto: 'Acceso controlado.' },
    ]);
  });

  it('avisa cuando el texto del aviso contradice la superficie registrada', () => {
    const propiedad = con({
      superficieUtil: 79, superficieTotal: 79, terreno: undefined,
      descripcion: ['Superficie: 78,59 m² totales construidos.'],
    });
    const avisos = avisosFicha(propiedad);
    expect(avisos[0].nivel).toBe('alerta');
    expect(avisos[0].texto).toContain('78,59 m²');
    expect(avisos[0].texto).toContain('79 m²');
    // Una terraza de 12 m² no contradice los 79 m² de la propiedad.
    expect(avisosFicha(con({ descripcion: ['Terraza de 12 m² y jardín.'] })).some((aviso) => aviso.nivel === 'alerta')).toBe(false);
  });

  it('avisa de lo que falta para una ficha completa', () => {
    const textos = avisosFicha(con({
      latitud: undefined, longitud: undefined, imagenes: [], precio: { valor: 0, moneda: 'UF' },
      anio: 0, orientacion: '',
    })).map((aviso) => aviso.texto).join(' | ');
    expect(textos).toContain('sin mapa');
    expect(textos).toContain('no tiene fotos');
    expect(textos).toContain('Valor a consultar');
    expect(textos).toContain('año de construcción, orientación');
    expect(avisosFicha(base)).toEqual([]);
  });

  it('valida los ajustes que llegan del panel sin guardar nada', () => {
    expect(normalizarAjustesFicha(undefined, base)).toEqual({ titulo: '', bajada: '', destacados: [], mapa: true });
    expect(normalizarAjustesFicha({ titulo: '  Casa\u0007 con  piscina ', mapa: false }, base))
      .toEqual({ titulo: 'Casa con piscina', bajada: '', destacados: [], mapa: false });
    expect(() => normalizarAjustesFicha({ titulo: 'x'.repeat(MAX_TITULO_FICHA + 1) }, base)).toThrow(/titular/);
    expect(() => normalizarAjustesFicha({ bajada: 'x'.repeat(MAX_BAJADA_FICHA + 1) }, base)).toThrow(/bajada/);
    expect(() => normalizarAjustesFicha({ titulo: 12 }, base)).toThrow();
    expect(() => normalizarAjustesFicha({ destacados: [0, 0] }, base)).toThrow(/destacados/);
    expect(() => normalizarAjustesFicha({ destacados: [99] }, base)).toThrow(/destacados/);
    expect(() => normalizarAjustesFicha({ destacados: [0, 1, 2, 3, 4, 0, 1] }, base)).toThrow(/destacados/);
    expect(() => normalizarAjustesFicha({ destacados: 'Piscina' }, base)).toThrow();
  });

  it('no repite la bajada como primer párrafo de la descripción', () => {
    const propiedad = con({
      resumen: 'Casa familiar en calle interior.',
      descripcion: ['Casa familiar en calle interior.\nPatio con quincho.'],
    });
    expect(bloquesDescripcion(propiedad, perfilFicha(propiedad).bajada))
      .toEqual([{ tipo: 'parrafo', texto: 'Patio con quincho.' }]);
    // Sin bajada que calce, la descripción queda completa.
    expect(bloquesDescripcion(propiedad, 'Otra bajada escrita a mano.')).toHaveLength(2);
    expect(bloquesDescripcion(propiedad)).toHaveLength(2);
  });
});
