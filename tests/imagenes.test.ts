import { describe, expect, it } from 'vitest';
import { claveFoto, claveValida, detectarMime, extensionDe, TIPOS_PERMITIDOS } from '@/lib/imagenes';

const bytes = (...valores: number[]) => new Uint8Array(valores);

// Cabeceras reales, con relleno detrás para que no pasen por ser cortas.
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);

describe('detección por bytes reales', () => {
  it('reconoce JPG, PNG y WEBP', () => {
    expect(detectarMime(JPEG)).toBe('image/jpeg');
    expect(detectarMime(PNG)).toBe('image/png');
    expect(detectarMime(WEBP)).toBe('image/webp');
  });

  it('rechaza un archivo de texto aunque se llame .png', () => {
    expect(detectarMime(new TextEncoder().encode('<?php system($_GET[0]); ?>'))).toBeNull();
    expect(detectarMime(new TextEncoder().encode('hola'))).toBeNull();
  });

  it('rechaza un RIFF que no es WEBP, como un WAV', () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
    expect(detectarMime(wav)).toBeNull();
  });

  it('rechaza una cabecera cortada', () => {
    expect(detectarMime(PNG.slice(0, 4))).toBeNull();
    expect(detectarMime(WEBP.slice(0, 8))).toBeNull();
    expect(detectarMime(new Uint8Array(0))).toBeNull();
  });
});

describe('claves de R2', () => {
  it('la clave que genera es una clave que acepta', () => {
    for (const mime of TIPOS_PERMITIDOS) {
      const clave = claveFoto(7, mime);
      expect(clave.startsWith('propiedades/7/')).toBe(true);
      expect(clave.endsWith(`.${extensionDe(mime)}`)).toBe(true);
      expect(claveValida(clave)).toBe(true);
    }
  });

  it('dos fotos seguidas de la misma propiedad no chocan', () => {
    expect(claveFoto(1, 'image/png')).not.toBe(claveFoto(1, 'image/png'));
  });

  it('acepta una foto importada con ID, orden y hash de contenido', () => {
    expect(claveValida('palma-fuentes/202057/001-46fe146278d3.jpg')).toBe(true);
    expect(claveValida('palma-fuentes/202057/001-46fe146278d3.svg')).toBe(false);
    expect(claveValida('palma-fuentes/202057/../001-46fe146278d3.jpg')).toBe(false);
  });

  it('rechaza salirse de la carpeta o inventar una clave', () => {
    const malas = [
      'propiedades/1/../../etc/passwd',
      '../propiedades/1/1700000000-00000000-0000-0000-0000-000000000000.png',
      'propiedades/1/1700000000-00000000-0000-0000-0000-000000000000.svg',
      'propiedades/1/archivo.png',
      'propiedades//1700000000-00000000-0000-0000-0000-000000000000.png',
      'otra-carpeta/1/1700000000-00000000-0000-0000-0000-000000000000.png',
      '',
    ];
    for (const clave of malas) expect(claveValida(clave)).toBe(false);
  });
});
