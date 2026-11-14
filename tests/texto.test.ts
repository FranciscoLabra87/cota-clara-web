import { describe, expect, it } from 'vitest';
import { lineas, parrafos } from '@/lib/texto';

describe('párrafos de la descripción', () => {
  it('separa por línea en blanco y respeta los saltos de línea dentro de un párrafo', () => {
    expect(parrafos('Casa en La Reina\nDormitorios: 4\nBaños: 3\n\nSegundo párrafo.')).toEqual([
      'Casa en La Reina\nDormitorios: 4\nBaños: 3',
      'Segundo párrafo.',
    ]);
  });

  it('acepta líneas en blanco con espacios y saltos de Windows', () => {
    expect(parrafos('Uno.\r\n  \r\n\r\nDos.\r\nSigue dos.')).toEqual(['Uno.', 'Dos.\nSigue dos.']);
  });

  it('lo que el formulario muestra y vuelve a leer es exactamente lo guardado', () => {
    const guardado = ['Espectacular casa en La Reina Alta\nUbicada en un sector residencial', 'Precio conversable.'];
    expect(parrafos(guardado.join('\n\n'))).toEqual(guardado);
  });

  it('un texto vacío no deja párrafos', () => {
    expect(parrafos('')).toEqual([]);
    expect(parrafos('\n\n   \n')).toEqual([]);
  });
});

describe('líneas de las listas', () => {
  it('una entrada por línea, sin vacías ni espacios sobrantes', () => {
    expect(lineas('Piscina\r\n\n  Quincho  \nTerraza')).toEqual(['Piscina', 'Quincho', 'Terraza']);
  });
});
