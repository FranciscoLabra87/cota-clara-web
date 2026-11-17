import { sesionDelPedido, type Sesion } from './sesion';

// Drive interno del equipo: fotos, videos y documentos en R2, bajo drive/.
// Cada usuario sube a su carpeta y todos ven todas las carpetas.
//
// Todo se sube por partes (multipart de R2), también un archivo chico: un
// solo camino de código. Cada parte viaja en su propio pedido, porque
// Cloudflare corta los pedidos de más de 100 MB; así un video de 2 GB sube
// igual. Las partes y las descargas las atiende el Worker propio (worker.ts)
// antes de Next, pasando el cuerpo directo a R2 sin copiarlo en JavaScript:
// en el plan gratis de Workers cada pedido tiene 10 ms de CPU, y copiar 10 MB
// a mano no cabría.
//
// No importa nada de Next ni de getCloudflareContext: recibe la base y el
// bucket como parámetros, para que lo use igual worker.ts.

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/** Tamaño de cada parte. R2 exige al menos 5 MiB en todas menos la última. */
export const PARTE = 10 * MIB;

/** Máximo por archivo. Un video de teléfono en 4K pesa unos 350 MB por minuto. */
export const MAX_ARCHIVO = 2 * GIB;

/**
 * Cuota total del Drive, si no se fija DRIVE_CUOTA_GB. El plan gratis de R2
 * incluye 10 GB al mes para toda la cuenta, fotos de las propiedades incluidas;
 * 8 GiB (8,6 GB) deja margen para ellas. Pasado el plan gratis, cada GB extra
 * cuesta US$ 0,015 al mes.
 */
export const CUOTA_POR_DEFECTO = 8 * GIB;

/** Archivos por subida que se aceptan en paralelo por persona. */
const MAX_SUBIDAS_ABIERTAS = 20;

export type Categoria = 'imagen' | 'video' | 'documento';

// La extensión decide el Content-Type con que se guarda y se sirve, nunca lo
// que diga el navegador. No hay HTML, SVG ni ejecutables: lo que se sirve
// desde el mismo dominio no puede correr código.
const TIPOS: Record<string, { tipo: string; categoria: Categoria }> = {
  jpg: { tipo: 'image/jpeg', categoria: 'imagen' },
  jpeg: { tipo: 'image/jpeg', categoria: 'imagen' },
  png: { tipo: 'image/png', categoria: 'imagen' },
  webp: { tipo: 'image/webp', categoria: 'imagen' },
  gif: { tipo: 'image/gif', categoria: 'imagen' },
  avif: { tipo: 'image/avif', categoria: 'imagen' },
  heic: { tipo: 'image/heic', categoria: 'imagen' },
  heif: { tipo: 'image/heif', categoria: 'imagen' },
  mp4: { tipo: 'video/mp4', categoria: 'video' },
  m4v: { tipo: 'video/x-m4v', categoria: 'video' },
  mov: { tipo: 'video/quicktime', categoria: 'video' },
  webm: { tipo: 'video/webm', categoria: 'video' },
  pdf: { tipo: 'application/pdf', categoria: 'documento' },
  doc: { tipo: 'application/msword', categoria: 'documento' },
  docx: { tipo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', categoria: 'documento' },
  xls: { tipo: 'application/vnd.ms-excel', categoria: 'documento' },
  xlsx: { tipo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', categoria: 'documento' },
  ppt: { tipo: 'application/vnd.ms-powerpoint', categoria: 'documento' },
  pptx: { tipo: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', categoria: 'documento' },
  csv: { tipo: 'text/csv', categoria: 'documento' },
  txt: { tipo: 'text/plain', categoria: 'documento' },
  zip: { tipo: 'application/zip', categoria: 'documento' },
  dwg: { tipo: 'application/acad', categoria: 'documento' },
  kmz: { tipo: 'application/vnd.google-earth.kmz', categoria: 'documento' },
};

export const EXTENSIONES = Object.keys(TIPOS);

/** Lo que el navegador puede mostrar en una pestaña. Lo demás se descarga. */
const EN_LINEA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/webm', 'application/pdf']);

export class ErrorDrive extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export type Entorno = { DB: D1Database; FOTOS: R2Bucket; DRIVE_CUOTA_GB?: string };

export function cuotaDe(env: Pick<Entorno, 'DRIVE_CUOTA_GB'>): number {
  const gb = Number(env.DRIVE_CUOTA_GB);
  return Number.isFinite(gb) && gb > 0 ? Math.floor(gb * GIB) : CUOTA_POR_DEFECTO;
}

export function tipoDe(nombre: string) {
  const ext = nombre.split('.').pop()?.toLowerCase() ?? '';
  return ext in TIPOS ? { ext, ...TIPOS[ext] } : null;
}

/**
 * El nombre que se muestra. Si el archivo vino dentro de una carpeta conserva
 * la ruta («Casa La Reina/fachada.jpg»), sin segmentos vacíos ni «..». Nunca se
 * usa para armar la clave de R2: esa la genera el servidor.
 */
export function limpiarNombre(nombre: unknown): string {
  if (typeof nombre !== 'string') return '';
  return nombre
    .replace(/\\/g, '/')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== '.' && s !== '..')
    .join('/')
    .slice(-200);
}

export const partesDe = (tamano: number) => Math.max(1, Math.ceil(tamano / PARTE));

/** Cuántos bytes tiene que traer la parte n (de 1 en adelante). */
export const tamanoDeParte = (tamano: number, n: number) => {
  const partes = partesDe(tamano);
  return n < partes ? PARTE : tamano - PARTE * (partes - 1);
};

// ─── Subida ───

type Fila = {
  id: number;
  usuario_id: number | null;
  clave: string;
  nombre: string;
  tipo: string;
  tamano: number;
  estado: 'subiendo' | 'listo';
  upload_id: string | null;
  creado_en: string;
};

/**
 * Las subidas que quedaron a medias hace más de un día (se cerró la pestaña,
 * se cortó la red) se abortan y se borran: así liberan la cuota. R2 igual las
 * abortaría solo a los 7 días, pero la cuota quedaría tomada esa semana.
 */
export async function limpiarAbandonadas(env: Entorno): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT id, clave, upload_id FROM drive_archivos
     WHERE estado = 'subiendo' AND creado_en < datetime('now', '-1 day') LIMIT 10`,
  ).all<Pick<Fila, 'id' | 'clave' | 'upload_id'>>();

  for (const fila of results) {
    if (fila.upload_id) {
      await env.FOTOS.resumeMultipartUpload(fila.clave, fila.upload_id)
        .abort()
        .catch(() => {});
    }
    await env.DB.prepare(`DELETE FROM drive_archivos WHERE id = ?`).bind(fila.id).run();
  }
  return results.length;
}

export type SubidaIniciada = { id: number; partes: number; tamanoParte: number; nombre: string };

export async function iniciarSubida(
  env: Entorno,
  datos: { usuarioId: number; nombre: unknown; tamano: unknown },
): Promise<SubidaIniciada> {
  const nombre = limpiarNombre(datos.nombre);
  if (!nombre) throw new ErrorDrive(400, 'Falta el nombre del archivo');

  const tipo = tipoDe(nombre);
  if (!tipo) throw new ErrorDrive(415, `Ese tipo de archivo no se acepta. Sirven: ${EXTENSIONES.join(', ')}`);

  const tamano = Number(datos.tamano);
  if (!Number.isSafeInteger(tamano) || tamano < 1) throw new ErrorDrive(400, 'El archivo está vacío');
  if (tamano > MAX_ARCHIVO) throw new ErrorDrive(413, 'El archivo pasa de 2 GB');

  await limpiarAbandonadas(env);

  const abiertas = await env.DB.prepare(`SELECT COUNT(*) AS n FROM drive_archivos WHERE usuario_id = ? AND estado = 'subiendo'`)
    .bind(datos.usuarioId)
    .first<{ n: number }>();
  if ((abiertas?.n ?? 0) >= MAX_SUBIDAS_ABIERTAS) {
    throw new ErrorDrive(429, 'Tienes demasiadas subidas a medias. Espera a que terminen o cancélalas.');
  }

  const clave = `drive/${datos.usuarioId}/${Date.now()}-${crypto.randomUUID()}.${tipo.ext}`;
  const cuota = cuotaDe(env);

  // La cuota se revisa y se reserva en una sola sentencia: D1 las ejecuta de
  // a una, así que dos subidas en paralelo no pueden pasarse entre las dos.
  const fila = await env.DB.prepare(
    `INSERT INTO drive_archivos (usuario_id, clave, nombre, tipo, tamano)
     SELECT ?1, ?2, ?3, ?4, ?5
     WHERE (SELECT COALESCE(SUM(tamano), 0) FROM drive_archivos) + ?5 <= ?6
     RETURNING id`,
  )
    .bind(datos.usuarioId, clave, nombre, tipo.tipo, tamano, cuota)
    .first<{ id: number }>();
  if (!fila) throw new ErrorDrive(507, 'El Drive está lleno. Borra archivos que ya no sirvan o pide subir la cuota.');

  try {
    const subida = await env.FOTOS.createMultipartUpload(clave, { httpMetadata: { contentType: tipo.tipo } });
    await env.DB.prepare(`UPDATE drive_archivos SET upload_id = ? WHERE id = ?`).bind(subida.uploadId, fila.id).run();
  } catch (e) {
    await env.DB.prepare(`DELETE FROM drive_archivos WHERE id = ?`).bind(fila.id).run();
    throw e;
  }

  return { id: fila.id, partes: partesDe(tamano), tamanoParte: PARTE, nombre };
}

/** La subida en curso de esa persona, o un error que explica por qué no. */
async function subidaPropia(env: Entorno, id: number, usuarioId: number): Promise<Fila & { upload_id: string }> {
  const fila = await env.DB.prepare(`SELECT * FROM drive_archivos WHERE id = ?`).bind(id).first<Fila>();
  if (!fila || fila.usuario_id !== usuarioId) throw new ErrorDrive(404, 'No existe esa subida');
  if (fila.estado !== 'subiendo' || !fila.upload_id) throw new ErrorDrive(409, 'Esa subida ya terminó');
  return fila as Fila & { upload_id: string };
}

/**
 * Sube la parte n. `largo` es el Content-Length del pedido: se exige exacto,
 * porque R2 necesita todas las partes del mismo tamaño menos la última.
 */
export async function subirParte(
  env: Entorno,
  datos: { id: number; n: number; usuarioId: number; largo: number | null; cuerpo: ReadableStream | ArrayBuffer | null },
): Promise<R2UploadedPart> {
  const fila = await subidaPropia(env, datos.id, datos.usuarioId);
  const partes = partesDe(fila.tamano);
  if (!Number.isInteger(datos.n) || datos.n < 1 || datos.n > partes) throw new ErrorDrive(400, 'Número de parte fuera de rango');
  if (datos.largo === null) throw new ErrorDrive(411, 'Falta el largo de la parte');

  const esperado = tamanoDeParte(fila.tamano, datos.n);
  if (datos.largo !== esperado) throw new ErrorDrive(400, `La parte ${datos.n} debía traer ${esperado} bytes y trajo ${datos.largo}`);
  if (!datos.cuerpo) throw new ErrorDrive(400, 'La parte vino vacía');

  try {
    return await env.FOTOS.resumeMultipartUpload(fila.clave, fila.upload_id).uploadPart(datos.n, datos.cuerpo);
  } catch {
    throw new ErrorDrive(409, 'R2 no aceptó la parte. Vuelve a intentarlo.');
  }
}

export async function completarSubida(
  env: Entorno,
  datos: { id: number; usuarioId: number; partes: unknown },
): Promise<{ id: number; nombre: string; tamano: number }> {
  const fila = await subidaPropia(env, datos.id, datos.usuarioId);
  const esperadas = partesDe(fila.tamano);

  const recibidas = Array.isArray(datos.partes) ? datos.partes : [];
  const partes: R2UploadedPart[] = recibidas
    .map((p) => p as { partNumber?: unknown; etag?: unknown })
    .filter((p) => Number.isInteger(p.partNumber) && typeof p.etag === 'string' && p.etag.length <= 200)
    .map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag) }))
    .sort((a, b) => a.partNumber - b.partNumber);

  const completas = partes.length === esperadas && partes.every((p, i) => p.partNumber === i + 1);
  if (!completas) throw new ErrorDrive(400, `Faltan partes: se esperaban ${esperadas}`);

  try {
    await env.FOTOS.resumeMultipartUpload(fila.clave, fila.upload_id).complete(partes);
  } catch {
    throw new ErrorDrive(409, 'R2 no pudo armar el archivo con esas partes');
  }

  // Se confirma contra lo que quedó guardado de verdad, no contra lo que dijo
  // el navegador: si el tamaño no calza, el archivo no queda.
  const objeto = await env.FOTOS.head(fila.clave);
  if (!objeto || objeto.size !== fila.tamano) {
    await env.FOTOS.delete(fila.clave);
    await env.DB.prepare(`DELETE FROM drive_archivos WHERE id = ?`).bind(fila.id).run();
    throw new ErrorDrive(422, 'El archivo llegó incompleto. Vuelve a subirlo.');
  }

  await env.DB.prepare(`UPDATE drive_archivos SET estado = 'listo', upload_id = NULL WHERE id = ?`).bind(fila.id).run();
  return { id: fila.id, nombre: fila.nombre, tamano: fila.tamano };
}

export async function cancelarSubida(env: Entorno, datos: { id: number; usuarioId: number }): Promise<void> {
  const fila = await subidaPropia(env, datos.id, datos.usuarioId);
  await env.FOTOS.resumeMultipartUpload(fila.clave, fila.upload_id)
    .abort()
    .catch(() => {});
  await env.DB.prepare(`DELETE FROM drive_archivos WHERE id = ?`).bind(fila.id).run();
}

// ─── Lectura y borrado ───

export type ArchivoDrive = {
  id: number;
  usuarioId: number | null;
  nombre: string;
  tipo: string;
  categoria: Categoria;
  tamano: number;
  creadoEn: string;
};

export type CarpetaDrive = { usuarioId: number; nombre: string; activo: boolean; archivos: ArchivoDrive[]; tamano: number };

export type Drive = { carpetas: CarpetaDrive[]; usado: number; cuota: number };

const categoriaDe = (tipo: string): Categoria => (tipo.startsWith('image/') ? 'imagen' : tipo.startsWith('video/') ? 'video' : 'documento');

/** Todas las carpetas, una por usuario, con sus archivos terminados, del más nuevo al más viejo. */
export async function leerDrive(env: Entorno): Promise<Drive> {
  const [usuarios, archivos, uso] = await env.DB.batch([
    env.DB.prepare(`SELECT id, nombre, activo FROM usuarios ORDER BY nombre`),
    env.DB.prepare(
      `SELECT id, usuario_id, nombre, tipo, tamano, creado_en FROM drive_archivos
       WHERE estado = 'listo' ORDER BY creado_en DESC, id DESC LIMIT 5000`,
    ),
    env.DB.prepare(`SELECT COALESCE(SUM(tamano), 0) AS usado FROM drive_archivos`),
  ]);

  const carpetas = new Map<number, CarpetaDrive>();
  for (const u of usuarios.results as { id: number; nombre: string; activo: number }[]) {
    carpetas.set(u.id, { usuarioId: u.id, nombre: u.nombre, activo: !!u.activo, archivos: [], tamano: 0 });
  }
  for (const a of archivos.results as { id: number; usuario_id: number | null; nombre: string; tipo: string; tamano: number; creado_en: string }[]) {
    const carpeta = a.usuario_id === null ? undefined : carpetas.get(a.usuario_id);
    if (!carpeta) continue;
    carpeta.archivos.push({
      id: a.id,
      usuarioId: a.usuario_id,
      nombre: a.nombre,
      tipo: a.tipo,
      categoria: categoriaDe(a.tipo),
      tamano: a.tamano,
      creadoEn: a.creado_en,
    });
    carpeta.tamano += a.tamano;
  }

  return {
    // Las carpetas sin archivos de cuentas desactivadas no aportan nada.
    carpetas: [...carpetas.values()].filter((c) => c.activo || c.archivos.length),
    usado: (uso.results[0] as { usado: number }).usado,
    cuota: cuotaDe(env),
  };
}

/** Borra un archivo terminado. Su dueño puede, y un administrador también. */
export async function borrarArchivo(env: Entorno, datos: { id: number; sesion: Sesion }): Promise<{ nombre: string }> {
  const fila = await env.DB.prepare(`SELECT id, usuario_id, clave, nombre, estado FROM drive_archivos WHERE id = ?`)
    .bind(datos.id)
    .first<Pick<Fila, 'id' | 'usuario_id' | 'clave' | 'nombre' | 'estado'>>();
  if (!fila || fila.estado !== 'listo') throw new ErrorDrive(404, 'No existe ese archivo');
  if (fila.usuario_id !== datos.sesion.usuario_id && datos.sesion.rol !== 'ADMIN') {
    throw new ErrorDrive(403, 'Solo su dueño o un administrador pueden borrar ese archivo');
  }
  await env.FOTOS.delete(fila.clave);
  await env.DB.prepare(`DELETE FROM drive_archivos WHERE id = ?`).bind(fila.id).run();
  return { nombre: fila.nombre };
}

// ─── Pedidos que atiende el Worker propio (y Next en desarrollo) ───

const CABECERAS_API = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; sandbox",
};

const respuestaJson = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: CABECERAS_API });

/** Qué ruta del Drive es, si es una de las dos que se atienden fuera de Next. */
export function rutaDrive(pathname: string): { tipo: 'parte'; id: number; n: number } | { tipo: 'archivo'; id: number } | null {
  const parte = /^\/drive\/subidas\/(\d{1,12})\/partes\/(\d{1,5})$/.exec(pathname);
  if (parte) return { tipo: 'parte', id: Number(parte[1]), n: Number(parte[2]) };
  const archivo = /^\/drive\/archivos\/(\d{1,12})$/.exec(pathname);
  if (archivo) return { tipo: 'archivo', id: Number(archivo[1]) };
  return null;
}

async function sesionOError(env: Entorno, request: Request): Promise<Sesion> {
  const sesion = await sesionDelPedido(env.DB, request);
  if (!sesion) throw new ErrorDrive(401, 'No autenticado');
  if (sesion.password_temporal) throw new ErrorDrive(403, 'Primero cambia tu contraseña');
  return sesion;
}

const comoRespuesta = (e: unknown) => {
  if (e instanceof ErrorDrive) return respuestaJson({ error: e.message }, e.status);
  console.error('[drive] error inesperado:', e instanceof Error ? e.message : e);
  return respuestaJson({ error: 'No pudimos completar la acción' }, 500);
};

/**
 * PUT /drive/subidas/:id/partes/:n. `cuerpo` es el stream del pedido cuando
 * lo atiende worker.ts (sin copiar) y un ArrayBuffer cuando lo atiende Next.
 */
export async function atenderParte(
  request: Request,
  env: Entorno,
  ruta: { id: number; n: number },
  cuerpo: ReadableStream | ArrayBuffer | null,
): Promise<Response> {
  if (request.method !== 'PUT') return respuestaJson({ error: 'Método no permitido' }, 405);
  try {
    const sesion = await sesionOError(env, request);
    const cabecera = request.headers.get('Content-Length');
    const largo = cabecera !== null && /^\d+$/.test(cabecera) ? Number(cabecera) : null;
    const parte = await subirParte(env, { id: ruta.id, n: ruta.n, usuarioId: sesion.usuario_id, largo, cuerpo });
    return respuestaJson({ partNumber: parte.partNumber, etag: parte.etag });
  } catch (e) {
    return comoRespuesta(e);
  }
}

/** El tramo que R2 entregó, en bytes desde el inicio. */
function tramoEntregado(rango: R2Range | undefined, tamano: number) {
  if (!rango) return null;
  if ('suffix' in rango && typeof rango.suffix === 'number') {
    const largo = Math.min(rango.suffix, tamano);
    return { inicio: tamano - largo, largo };
  }
  const inicio = 'offset' in rango && typeof rango.offset === 'number' ? rango.offset : 0;
  const largo = 'length' in rango && typeof rango.length === 'number' ? rango.length : tamano - inicio;
  return { inicio, largo };
}

/**
 * GET /drive/archivos/:id. Entrega el archivo directo desde R2, con soporte de
 * rangos para que los videos se puedan adelantar sin bajarlos enteros.
 */
export async function atenderArchivo(request: Request, env: Entorno, ruta: { id: number }): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return respuestaJson({ error: 'Método no permitido' }, 405);
  try {
    await sesionOError(env, request);
    const fila = await env.DB.prepare(`SELECT clave, nombre, tipo, estado FROM drive_archivos WHERE id = ?`)
      .bind(ruta.id)
      .first<Pick<Fila, 'clave' | 'nombre' | 'tipo' | 'estado'>>();
    if (!fila || fila.estado !== 'listo') throw new ErrorDrive(404, 'No existe ese archivo');

    const pideRango = request.headers.has('Range');
    let objeto: R2ObjectBody | R2Object | null;
    try {
      objeto = await env.FOTOS.get(fila.clave, { range: pideRango ? request.headers : undefined, onlyIf: request.headers });
    } catch {
      return new Response(null, { status: 416, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!objeto) throw new ErrorDrive(404, 'El archivo no está en el almacenamiento');

    const descargar = new URL(request.url).searchParams.has('descargar') || !EN_LINEA.has(fila.tipo);
    const base = fila.nombre.split('/').pop() || 'archivo';
    const cabeceras = new Headers({
      'Content-Type': fila.tipo,
      'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(base)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Accept-Ranges': 'bytes',
      ETag: objeto.httpEtag,
      // Privada: solo el navegador de quien tiene sesión. La clave del objeto
      // nunca se reutiliza, así que lo guardado no se queda viejo.
      'Cache-Control': 'private, max-age=86400',
    });
    // Lo que se descarga no se interpreta en el sitio aunque alguien lo abra.
    if (descargar) cabeceras.set('Content-Security-Policy', "default-src 'none'; sandbox");

    // Sin cuerpo: el navegador ya tiene esa versión (If-None-Match).
    if (!('body' in objeto)) return new Response(null, { status: 304, headers: cabeceras });

    const tramo = pideRango ? tramoEntregado(objeto.range, objeto.size) : null;
    if (tramo) {
      cabeceras.set('Content-Range', `bytes ${tramo.inicio}-${tramo.inicio + tramo.largo - 1}/${objeto.size}`);
      cabeceras.set('Content-Length', String(tramo.largo));
      return new Response(request.method === 'HEAD' ? null : objeto.body, { status: 206, headers: cabeceras });
    }
    cabeceras.set('Content-Length', String(objeto.size));
    return new Response(request.method === 'HEAD' ? null : objeto.body, { status: 200, headers: cabeceras });
  } catch (e) {
    return comoRespuesta(e);
  }
}
