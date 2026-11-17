import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  atenderArchivo,
  atenderParte,
  borrarArchivo,
  cancelarSubida,
  completarSubida,
  cuotaDe,
  iniciarSubida,
  leerDrive,
  limpiarAbandonadas,
  limpiarNombre,
  PARTE,
  partesDe,
  rutaDrive,
  tamanoDeParte,
  type Entorno,
} from '@/lib/drive';
import { pedir, sesionDePrueba } from './sesion';

// Corre contra la D1 y el R2 de miniflare: las subidas por partes son las de
// R2 de verdad, con su regla de 5 MiB mínimo por parte.
const entorno = (extra: Partial<Entorno> = {}): Entorno => ({ DB: env.DB, FOTOS: env.FOTOS, ...extra });

const bytes = (n: number, relleno = 7) => new Uint8Array(n).fill(relleno);

const ponerParte = (cookie: string | null, id: number, n: number, cuerpo: Uint8Array, largo = cuerpo.byteLength) =>
  atenderParte(
    pedir(`/drive/subidas/${id}/partes/${n}`, cookie, { method: 'PUT', headers: { 'Content-Length': String(largo) } }),
    entorno(),
    { id, n },
    cuerpo.buffer.slice(cuerpo.byteOffset, cuerpo.byteOffset + cuerpo.byteLength) as ArrayBuffer,
  );

/** Sube un archivo completo como lo haría el navegador. */
async function subirEntero(cookie: string, usuarioId: number, nombre: string, contenido: Uint8Array) {
  const subida = await iniciarSubida(entorno(), { usuarioId, nombre, tamano: contenido.byteLength });
  const partes = [];
  for (let n = 1; n <= subida.partes; n += 1) {
    const trozo = contenido.subarray((n - 1) * PARTE, Math.min(n * PARTE, contenido.byteLength));
    const res = await ponerParte(cookie, subida.id, n, trozo);
    expect(res.status).toBe(200);
    partes.push(await res.json());
  }
  return completarSubida(entorno(), { id: subida.id, usuarioId, partes });
}

let yo: Awaited<ReturnType<typeof sesionDePrueba>>;
beforeEach(async () => {
  yo = await sesionDePrueba({ rol: 'EDITOR' });
});

describe('cálculo de partes', () => {
  it('parte en trozos de 10 MiB y la última lleva el resto', () => {
    expect(partesDe(1)).toBe(1);
    expect(partesDe(PARTE)).toBe(1);
    expect(partesDe(PARTE + 1)).toBe(2);
    expect(tamanoDeParte(PARTE + 1, 1)).toBe(PARTE);
    expect(tamanoDeParte(PARTE + 1, 2)).toBe(1);
  });

  it('reconoce solo las dos rutas que atiende el Worker propio', () => {
    expect(rutaDrive('/drive/subidas/12/partes/3')).toEqual({ tipo: 'parte', id: 12, n: 3 });
    expect(rutaDrive('/drive/archivos/7')).toEqual({ tipo: 'archivo', id: 7 });
    expect(rutaDrive('/drive/archivos/7/x')).toBeNull();
    expect(rutaDrive('/drive/subidas/abc/partes/1')).toBeNull();
    expect(rutaDrive('/panel/drive')).toBeNull();
  });

  it('limpia el nombre pero conserva la carpeta de origen', () => {
    expect(limpiarNombre('Casa La Reina/fachada.jpg')).toBe('Casa La Reina/fachada.jpg');
    expect(limpiarNombre('..\\..\\secreto.pdf')).toBe('secreto.pdf');
    expect(limpiarNombre('a/../b//c.png')).toBe('a/b/c.png');
    expect(limpiarNombre('mal\u0000nombre.txt')).toBe('malnombre.txt');
    expect(limpiarNombre(42)).toBe('');
  });

  it('la cuota se puede subir con DRIVE_CUOTA_GB', () => {
    expect(cuotaDe({})).toBe(8 * 1024 ** 3);
    expect(cuotaDe({ DRIVE_CUOTA_GB: '50' })).toBe(50 * 1024 ** 3);
    expect(cuotaDe({ DRIVE_CUOTA_GB: 'mucho' })).toBe(8 * 1024 ** 3);
  });
});

describe('subir', () => {
  it('un archivo chico va en una sola parte y queda en la carpeta de quien lo subió', async () => {
    const archivo = await subirEntero(yo.cookie, yo.usuarioId, 'Visita/plano.pdf', bytes(1234));
    expect(archivo.tamano).toBe(1234);

    const drive = await leerDrive(entorno());
    const mia = drive.carpetas.find((c) => c.usuarioId === yo.usuarioId)!;
    expect(mia.archivos).toMatchObject([{ nombre: 'Visita/plano.pdf', tipo: 'application/pdf', categoria: 'documento', tamano: 1234 }]);
    expect(drive.usado).toBe(1234);
  });

  it('un video de varias partes se arma entero y en orden', async () => {
    const contenido = new Uint8Array(PARTE + 5);
    contenido.set(bytes(PARTE, 1));
    contenido.set(bytes(5, 2), PARTE);
    const archivo = await subirEntero(yo.cookie, yo.usuarioId, 'recorrido.mp4', contenido);
    expect(archivo.tamano).toBe(PARTE + 5);

    const res = await atenderArchivo(pedir(`/drive/archivos/${archivo.id}`, yo.cookie), entorno(), { id: archivo.id });
    const recibido = new Uint8Array(await res.arrayBuffer());
    expect(recibido.byteLength).toBe(PARTE + 5);
    expect(recibido[0]).toBe(1);
    expect(recibido[PARTE]).toBe(2);
  });

  it('rechaza tipos que no son fotos, videos ni documentos', async () => {
    for (const nombre of ['pagina.html', 'dibujo.svg', 'programa.exe', 'sin-extension']) {
      await expect(iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre, tamano: 10 })).rejects.toMatchObject({ status: 415 });
    }
  });

  it('rechaza el archivo vacío y el que pasa de 2 GB', async () => {
    await expect(iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.mp4', tamano: 2 * 1024 ** 3 + 1 })).rejects.toMatchObject({
      status: 413,
    });
  });

  it('exige que cada parte traiga exactamente los bytes que le tocan', async () => {
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'v.mp4', tamano: PARTE + 5 });
    expect((await ponerParte(yo.cookie, subida.id, 1, bytes(100))).status).toBe(400);
    expect((await ponerParte(yo.cookie, subida.id, 3, bytes(5))).status).toBe(400);
  });

  it('no deja completar si faltan partes', async () => {
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'v.mp4', tamano: PARTE + 5 });
    const res = await ponerParte(yo.cookie, subida.id, 1, bytes(PARTE));
    const parte = await res.json();
    await expect(completarSubida(entorno(), { id: subida.id, usuarioId: yo.usuarioId, partes: [parte] })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('cuota', () => {
  it('no deja empezar una subida que pase la cuota, contando las que van a medias', async () => {
    const chica = entorno({ DRIVE_CUOTA_GB: String(3000 / 1024 ** 3) });
    await iniciarSubida(chica, { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 2000 });
    await expect(iniciarSubida(chica, { usuarioId: yo.usuarioId, nombre: 'b.jpg', tamano: 2000 })).rejects.toMatchObject({ status: 507 });
  });

  it('cancelar libera el espacio reservado', async () => {
    const chica = entorno({ DRIVE_CUOTA_GB: String(3000 / 1024 ** 3) });
    const subida = await iniciarSubida(chica, { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 2000 });
    await cancelarSubida(chica, { id: subida.id, usuarioId: yo.usuarioId });
    await expect(iniciarSubida(chica, { usuarioId: yo.usuarioId, nombre: 'b.jpg', tamano: 2000 })).resolves.toMatchObject({ partes: 1 });
  });

  it('las subidas abandonadas hace más de un día se limpian solas', async () => {
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 2000 });
    await env.DB.prepare("UPDATE drive_archivos SET creado_en = datetime('now', '-2 days') WHERE id = ?").bind(subida.id).run();
    expect(await limpiarAbandonadas(entorno())).toBe(1);
    expect((await leerDrive(entorno())).usado).toBe(0);
  });
});

describe('permisos', () => {
  it('sin sesión no se sube ni se descarga', async () => {
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 10 });
    expect((await ponerParte(null, subida.id, 1, bytes(10))).status).toBe(401);
    const archivo = await subirEntero(yo.cookie, yo.usuarioId, 'b.jpg', bytes(10));
    expect((await atenderArchivo(pedir(`/drive/archivos/${archivo.id}`, null), entorno(), { id: archivo.id })).status).toBe(401);
  });

  it('nadie sube partes a la subida de otro', async () => {
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 10 });
    expect((await ponerParte(otro.cookie, subida.id, 1, bytes(10))).status).toBe(404);
  });

  it('todos ven y descargan los archivos de todos', async () => {
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    const archivo = await subirEntero(yo.cookie, yo.usuarioId, 'compartido.png', bytes(50));
    expect((await atenderArchivo(pedir(`/drive/archivos/${archivo.id}`, otro.cookie), entorno(), { id: archivo.id })).status).toBe(200);
  });

  it('borra su dueño o un administrador, nadie más', async () => {
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    const admin = await sesionDePrueba({ rol: 'ADMIN' });
    const sesionDe = async (usuarioId: number) => ({ usuario_id: usuarioId, rut_norm: '', nombre: '', rol: 'EDITOR' as const, password_temporal: 0 });

    const a = await subirEntero(yo.cookie, yo.usuarioId, 'a.jpg', bytes(10));
    await expect(borrarArchivo(entorno(), { id: a.id, sesion: await sesionDe(otro.usuarioId) })).rejects.toMatchObject({ status: 403 });
    await expect(borrarArchivo(entorno(), { id: a.id, sesion: await sesionDe(yo.usuarioId) })).resolves.toMatchObject({ nombre: 'a.jpg' });

    const b = await subirEntero(yo.cookie, yo.usuarioId, 'b.jpg', bytes(10));
    await borrarArchivo(entorno(), { id: b.id, sesion: { ...(await sesionDe(admin.usuarioId)), rol: 'ADMIN' } });
    expect((await leerDrive(entorno())).usado).toBe(0);
    const { objects } = await env.FOTOS.list({ prefix: 'drive/' });
    expect(objects).toHaveLength(0);
  });
});

describe('descargar', () => {
  it('fotos, videos y PDF se muestran; lo demás se descarga y no se interpreta', async () => {
    const foto = await subirEntero(yo.cookie, yo.usuarioId, 'fachada.jpg', bytes(20));
    const res = await atenderArchivo(pedir(`/drive/archivos/${foto.id}`, yo.cookie), entorno(), { id: foto.id });
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Content-Disposition')).toMatch(/^inline/);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');

    const planilla = await subirEntero(yo.cookie, yo.usuarioId, 'Gastos 2026.xlsx', bytes(20));
    const res2 = await atenderArchivo(pedir(`/drive/archivos/${planilla.id}`, yo.cookie), entorno(), { id: planilla.id });
    expect(res2.headers.get('Content-Disposition')).toBe("attachment; filename*=UTF-8''Gastos%202026.xlsx");
    expect(res2.headers.get('Content-Security-Policy')).toContain('sandbox');
  });

  it('con ?descargar=1 también la foto baja como archivo', async () => {
    const foto = await subirEntero(yo.cookie, yo.usuarioId, 'fachada.jpg', bytes(20));
    const res = await atenderArchivo(pedir(`/drive/archivos/${foto.id}?descargar=1`, yo.cookie), entorno(), { id: foto.id });
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment/);
  });

  it('entrega rangos, para adelantar un video sin bajarlo entero', async () => {
    const contenido = new Uint8Array(100).map((_, i) => i);
    const video = await subirEntero(yo.cookie, yo.usuarioId, 'v.mp4', contenido);
    const res = await atenderArchivo(pedir(`/drive/archivos/${video.id}`, yo.cookie, { headers: { Range: 'bytes=10-19' } }), entorno(), {
      id: video.id,
    });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 10-19/100');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('404 si el archivo todavía se está subiendo o no existe', async () => {
    const subida = await iniciarSubida(entorno(), { usuarioId: yo.usuarioId, nombre: 'a.jpg', tamano: 10 });
    expect((await atenderArchivo(pedir(`/drive/archivos/${subida.id}`, yo.cookie), entorno(), { id: subida.id })).status).toBe(404);
    expect((await atenderArchivo(pedir('/drive/archivos/9999', yo.cookie), entorno(), { id: 9999 })).status).toBe(404);
  });
});
