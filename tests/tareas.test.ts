import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { comoJson, pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const tareas = await import('@/lib/tareas');
const crm = await import('@/lib/crm');
const { POST: crearRuta } = await import('../src/app/api/panel/tareas/route');
const { PATCH: cambiarRuta, DELETE: borrarRuta } = await import('../src/app/api/panel/tareas/[id]/route');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });
const vacia = { titulo: 'Llamar a Juan', detalle: '', responsableId: null, venceEn: null, propiedadId: null, interesadoId: null };

let propiedadId = 0;
beforeEach(async () => {
  const fila = await env.DB.prepare(
    `INSERT INTO propiedades (slug, titulo, tipo, operacion, comuna, precio_valor, precio_moneda, publicada)
     VALUES ('casa-quilpue', 'Casa en Quilpué', 'casa', 'venta', 'Quilpué', 5000, 'UF', '2026-11-17') RETURNING id`,
  ).first<{ id: number }>();
  propiedadId = fila!.id;
});

describe('validación', () => {
  it('pide título y una fecha válida', () => {
    expect(tareas.validarTarea({ titulo: 'x' }).ok).toBe(false);
    expect(tareas.validarTarea({ titulo: 'Llamar', venceEn: '2026-13-40' }).ok).toBe(false);
    expect(tareas.validarTarea({ titulo: 'Llamar', responsableId: 'abc' }).ok).toBe(false);
    expect(tareas.validarTarea({ titulo: 'Llamar', venceEn: '', responsableId: '' })).toMatchObject({
      ok: true,
      datos: { venceEn: null, responsableId: null },
    });
  });
});

describe('tareas', () => {
  it('una tarea ligada a un interesado toma la propiedad de él', async () => {
    const yo = await sesionDePrueba();
    const juan = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId);

    await tareas.crearTarea({ ...vacia, interesadoId: juan, responsableId: yo.usuarioId }, yo.usuarioId);

    const [t] = await tareas.listarTareas({ propiedadId });
    expect(t).toMatchObject({ propiedadId, propiedadTitulo: 'Casa en Quilpué', interesadoNombre: 'Juan', estado: 'pendiente' });
  });

  it('no asigna a una cuenta desactivada', async () => {
    const yo = await sesionDePrueba();
    const baja = await sesionDePrueba({ activo: false });
    await expect(tareas.crearTarea({ ...vacia, responsableId: baja.usuarioId }, yo.usuarioId)).rejects.toMatchObject({ status: 422 });
  });

  it('al pasar a Hecha anota cuándo, y al volver atrás lo limpia', async () => {
    const yo = await sesionDePrueba();
    const id = await tareas.crearTarea(vacia, yo.usuarioId);

    await tareas.moverTarea(id, 'hecha');
    expect((await env.DB.prepare('SELECT completada_en FROM tareas WHERE id = ?').bind(id).first<{ completada_en: string | null }>())!.completada_en).not.toBeNull();
    await tareas.moverTarea(id, 'en_curso');
    expect((await env.DB.prepare('SELECT completada_en FROM tareas WHERE id = ?').bind(id).first<{ completada_en: string | null }>())!.completada_en).toBeNull();
  });

  it('las hechas hace más de 30 días salen del tablero', async () => {
    const yo = await sesionDePrueba();
    const vieja = await tareas.crearTarea({ ...vacia, titulo: 'Vieja' }, yo.usuarioId);
    await tareas.crearTarea({ ...vacia, titulo: 'Abierta' }, yo.usuarioId);
    await env.DB.prepare(`UPDATE tareas SET estado = 'hecha', completada_en = datetime('now', '-40 days') WHERE id = ?`).bind(vieja).run();

    expect((await tareas.listarTareas()).map((t) => t.titulo)).toEqual(['Abierta']);
  });

  it('cuenta las pendientes de cada persona y cuáles vencieron', async () => {
    const yo = await sesionDePrueba();
    await tareas.crearTarea({ ...vacia, responsableId: yo.usuarioId, venceEn: '2026-11-10' }, yo.usuarioId);
    await tareas.crearTarea({ ...vacia, responsableId: yo.usuarioId, venceEn: '2026-11-30' }, yo.usuarioId);
    const hecha = await tareas.crearTarea({ ...vacia, responsableId: yo.usuarioId, venceEn: '2026-11-01' }, yo.usuarioId);
    await tareas.moverTarea(hecha, 'hecha');

    expect(await tareas.pendientesDe(yo.usuarioId, '2026-11-17')).toEqual({ abiertas: 2, vencidas: 1 });
  });

  it('borrar la propiedad deja la tarea, sin enlace', async () => {
    const yo = await sesionDePrueba();
    const id = await tareas.crearTarea({ ...vacia, propiedadId }, yo.usuarioId);
    await env.DB.prepare('DELETE FROM propiedades WHERE id = ?').bind(propiedadId).run();
    const fila = await env.DB.prepare('SELECT propiedad_id FROM tareas WHERE id = ?').bind(id).first<{ propiedad_id: number | null }>();
    expect(fila).toEqual({ propiedad_id: null });
  });
});

describe('endpoints de tareas', () => {
  it('sin sesión responde 401', async () => {
    const res = await crearRuta(pedir('/api/panel/tareas', null, comoJson({ titulo: 'Llamar' })));
    expect(res.status).toBe(401);
  });

  it('crea, edita, mueve y borra', async () => {
    const yo = await sesionDePrueba({ rol: 'EDITOR' });
    const creada = await crearRuta(pedir('/api/panel/tareas', yo.cookie, comoJson({ titulo: 'Llamar', responsableId: String(yo.usuarioId), propiedadId: String(propiedadId) })));
    expect(creada.status).toBe(201);
    const { id } = (await creada.json()) as { id: number };

    const editada = await cambiarRuta(pedir(`/api/panel/tareas/${id}`, yo.cookie, { ...comoJson({ titulo: 'Llamar a Juan', venceEn: '2026-11-20' }), method: 'PATCH' }), ruta(id));
    expect(editada.status).toBe(200);
    const movida = await cambiarRuta(pedir(`/api/panel/tareas/${id}`, yo.cookie, { ...comoJson({ estado: 'en_curso' }), method: 'PATCH' }), ruta(id));
    expect(movida.status).toBe(200);
    const mala = await cambiarRuta(pedir(`/api/panel/tareas/${id}`, yo.cookie, { ...comoJson({ estado: 'archivada' }), method: 'PATCH' }), ruta(id));
    expect(mala.status).toBe(422);

    const [t] = await tareas.listarTareas();
    expect(t).toMatchObject({ titulo: 'Llamar a Juan', venceEn: '2026-11-20', estado: 'en_curso' });

    const borrada = await borrarRuta(pedir(`/api/panel/tareas/${id}`, yo.cookie, { method: 'DELETE' }), ruta(id));
    expect(borrada.status).toBe(200);
  });

  it('un editor no borra la tarea de otro; un administrador sí', async () => {
    const autora = await sesionDePrueba({ rol: 'EDITOR' });
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    const admin = await sesionDePrueba({ rol: 'ADMIN' });
    const id = await tareas.crearTarea(vacia, autora.usuarioId);

    expect((await borrarRuta(pedir(`/api/panel/tareas/${id}`, otro.cookie, { method: 'DELETE' }), ruta(id))).status).toBe(403);
    expect((await borrarRuta(pedir(`/api/panel/tareas/${id}`, admin.cookie, { method: 'DELETE' }), ruta(id))).status).toBe(200);
  });
});
