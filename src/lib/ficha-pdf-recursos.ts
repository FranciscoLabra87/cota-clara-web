import { getCloudflareContext } from '@opennextjs/cloudflare';
import { obtenerFotos } from './db';
import { claveValida, detectarMime } from './imagenes';
import type { PdfImagen } from './ficha-pdf';

export const MAX_FOTOS_PDF = 6;
const MAX_FOTO_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const MAX_PIXELES = 16_000_000;

export class ErrorRecursosPdf extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 422 | 503) { super(message); }
}

/** Lee solo cabeceras, antes de que el generador descomprima una imagen PNG. */
function comprobarDimensiones(bytes: Uint8Array, formato: 'jpg' | 'png') {
  let ancho = 0;
  let alto = 0;
  if (formato === 'png' && bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') {
    const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    ancho = vista.getUint32(16);
    alto = vista.getUint32(20);
  } else if (formato === 'jpg') {
    let posicion = 2;
    while (posicion + 3 < bytes.length) {
      if (bytes[posicion] !== 0xff) break;
      while (bytes[posicion] === 0xff) posicion += 1;
      const marcador = bytes[posicion++];
      if (marcador === 0xda || marcador === 0xd9) break;
      if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd8)) continue;
      if (posicion + 1 >= bytes.length) break;
      const largo = bytes[posicion] * 256 + bytes[posicion + 1];
      if (largo < 2 || posicion + largo > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marcador) && largo >= 8) {
        alto = bytes[posicion + 3] * 256 + bytes[posicion + 4];
        ancho = bytes[posicion + 5] * 256 + bytes[posicion + 6];
        break;
      }
      posicion += largo;
    }
  }
  if (!ancho || !alto) throw new ErrorRecursosPdf('Una foto no tiene dimensiones válidas. Reemplázala o genera sin esa foto.', 422);
  if (ancho * alto > MAX_PIXELES) throw new ErrorRecursosPdf('Una foto supera los 16 megapíxeles. Reduce su resolución o genera sin esa foto.', 422);
}

/** Se aceptan únicamente posiciones de las fotos ya asociadas a esta propiedad. */
export function seleccionarFotosPdf(valor: string | null, disponibles: string[]): string[] {
  if (valor === 'ninguna') return [];
  if (valor === null) return disponibles.slice(0, MAX_FOTOS_PDF);
  if (!/^\d+(?:,\d+)*$/.test(valor)) {
    throw new ErrorRecursosPdf('Selecciona las fotos de la propiedad o elige generar sin fotos.', 400);
  }
  const indices = valor.split(',').map(Number);
  if (indices.length > MAX_FOTOS_PDF || new Set(indices).size !== indices.length ||
      indices.some((indice) => !Number.isSafeInteger(indice) || indice >= disponibles.length)) {
    throw new ErrorRecursosPdf('Selecciona hasta 6 fotos distintas de esta propiedad.', 400);
  }
  return indices.map((indice) => disponibles[indice]);
}

/** No hay fetch de URLs: solo claves guardadas y validadas dentro del bucket propio. */
export async function cargarFotosPdf(urls: string[]): Promise<PdfImagen[]> {
  if (!urls.length) return [];
  const claves = urls.map((url) => {
    const clave = url.startsWith('/fotos/') ? url.slice('/fotos/'.length) : '';
    if (!claveValida(clave)) throw new ErrorRecursosPdf('Una foto no tiene una ubicación válida. Revisa las fotos de la propiedad.', 422);
    return clave;
  });
  try {
    const bucket = await obtenerFotos();
    const imagenes: PdfImagen[] = [];
    let total = 0;
    for (let i = 0; i < claves.length; i += 1) {
      const objeto = await bucket.get(claves[i]);
      if (!objeto) throw new ErrorRecursosPdf(`La foto seleccionada ${i + 1} ya no está disponible. Recarga la propiedad o genera sin esa foto.`, 404);
      if (objeto.size < 1 || objeto.size > MAX_FOTO_BYTES || total + objeto.size > MAX_TOTAL_BYTES) {
        throw new ErrorRecursosPdf('Las fotos superan el límite del PDF: 4 MB por foto y 16 MB en total. Reduce la selección o genera sin fotos.', 422);
      }
      let bytes = new Uint8Array(await objeto.arrayBuffer());
      const entradaBytes = bytes.length;
      const mime = detectarMime(bytes);
      if (!mime) throw new ErrorRecursosPdf(`La foto seleccionada ${i + 1} no es un archivo JPG, PNG o WEBP válido. Reemplázala o genera sin ella.`, 422);
      let formato: PdfImagen['formato'] = mime === 'image/png' ? 'png' : 'jpg';
      if (mime === 'image/webp') {
        const { env } = await getCloudflareContext({ async: true });
        if (!env.IMAGES) throw new ErrorRecursosPdf('La conversión de fotos WEBP no está disponible. Elige fotos JPG/PNG o genera sin fotos.', 503);
        const resultado = await env.IMAGES
          .input(new Blob([new Uint8Array(bytes).buffer]).stream())
          .transform({ width: 1600, height: 1200, fit: 'scale-down' })
          .output({ format: 'image/jpeg', quality: 85, anim: false });
        const respuesta = resultado.response();
        if (!respuesta.ok) throw new ErrorRecursosPdf('No pudimos convertir una foto WEBP. Intenta con JPG/PNG o genera sin esa foto.', 503);
        bytes = new Uint8Array(await respuesta.arrayBuffer());
        if (detectarMime(bytes) !== 'image/jpeg') throw new ErrorRecursosPdf('La conversión de una foto WEBP no produjo un JPG válido. Reemplázala o genera sin esa foto.', 503);
        formato = 'jpg';
      }
      comprobarDimensiones(bytes, formato);
      const uso = Math.max(entradaBytes, bytes.length);
      if (bytes.length > MAX_FOTO_BYTES || total + uso > MAX_TOTAL_BYTES) {
        throw new ErrorRecursosPdf('Las fotos superan el límite del PDF. Reduce la selección o genera sin fotos.', 422);
      }
      total += uso;
      imagenes.push({ bytes, formato });
    }
    return imagenes;
  } catch (error) {
    if (error instanceof ErrorRecursosPdf) throw error;
    console.error('[ficha-pdf] No se pudieron preparar las fotos');
    throw new ErrorRecursosPdf('No pudimos preparar las fotos. Intenta de nuevo, selecciona JPG/PNG o genera sin fotos.', 503);
  }
}
