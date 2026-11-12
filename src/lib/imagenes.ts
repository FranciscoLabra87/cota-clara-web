// Validación de imágenes por firma real (magic bytes), no por el Content-Type
// que manda el cliente ni por la extensión del archivo: las dos se falsean.
// Portado del sistema de AG Casco Histórico.

export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

const EXTENSIONES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type MimeImagen = keyof typeof EXTENSIONES;

export const TIPOS_PERMITIDOS = Object.keys(EXTENSIONES) as MimeImagen[];

const empiezaCon = (bytes: Uint8Array, firma: number[]) =>
  bytes.length >= firma.length && firma.every((valor, i) => bytes[i] === valor);

export function detectarMime(bytes: Uint8Array): MimeImagen | null {
  if (empiezaCon(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (empiezaCon(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    empiezaCon(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export const extensionDe = (mime: MimeImagen) => EXTENSIONES[mime];

// La clave que se guarda en R2 y en la base. El UUID evita que dos fotos
// distintas choquen y que se pueda adivinar la clave de otra propiedad.
export function claveFoto(propiedadId: number, mime: MimeImagen) {
  return `propiedades/${propiedadId}/${Date.now()}-${crypto.randomUUID()}.${extensionDe(mime)}`;
}

// Las claves que llegan por URL se usan para leer de R2: solo se aceptan las
// que esta misma función podría haber generado.
export function claveValida(clave: string) {
  return /^propiedades\/\d+\/\d+-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(clave);
}
