import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lead } from '@/lib/leads';
import { comoJson, pedir, sesionDePrueba } from './sesion';

// El CRM corre contra la D1 de miniflare: las consultas, el ON DELETE CASCADE
// y el UNIQUE de solicitud_id son los de SQLite de verdad.
vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const crm = await import('@/lib/crm');
const { POST: crearRuta } = await import('../src/app/api/panel/crm/interesados/route');
const { PATCH: cambiarRuta, DELETE: borrarRuta } = await import('../src/app/api/panel/crm/interesados/[id]/route');
const { POST: actividadRuta } = await import('../src/app/api/panel/crm/interesados/[id]/actividades/route');
const { POST: contacto } = await import('../src/app/api/contacto/route');

const ruta = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

async function nuevaPropiedad(slug: string) {
  const fila = await env.DB.prepare(
    `INSERT INTO propiedades (slug, tipo, operacion, comuna, precio_valor, precio_moneda, publicada)
     VALUES (?, 'casa', 'venta', 'Quilpué', 5000, 'UF', '2026-11-17') RETURNING id`,
  )
    .bind(slug)
    .first<{ id: number }>();
  return fila!.id;
}

const lead = (extra: Partial<Lead> = {}): Lead => ({
  variante: 'visita',
  nombre: 'Camila Rojas',
  email: 'camila@example.com',
  telefono: '+56 9 1234 5678',
  tipo: '',
  comuna: '',
  motivo: '',
  fecha: '2026-11-20',
  mensaje: 'Puedo en la tarde.',
  propiedad: 'casa-quilpue',
  ...extra,
});

async function nuevaSolicitud() {
  const fila = await env.DB.prepare(
    `INSERT INTO solicitudes (variante, nombre, email) VALUES ('visita', 'Camila Rojas', 'camila@example.com') RETURNING id`,
  ).first<{ id: number }>();
  return fila!.id;
}

let propiedadId = 0;
beforeEach(async () => {
  propiedadId = await nuevaPropiedad('casa-quilpue');
});

describe('interesados y etapas', () => {
  it('crea un interesado en la etapa Nuevo y lo lista en su propiedad', async () => {
    const yo = await sesionDePrueba({ rol: 'EDITOR' });
    const id = await crm.crearInteresado(propiedadId, { nombre: 'Juan Pérez', telefono: '+56 9 8765 4321', email: '' }, yo.usuarioId);

    const lista = await crm.interesadosDe(propiedadId);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id, nombre: 'Juan Pérez', etapa: 'nuevo', origen: 'manual', creadoPor: yo.usuarioId });
  });

  it('no crea interesados en una propiedad que no existe', async () => {
    const yo = await sesionDePrueba();
    await expect(crm.crearInteresado(9999, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId)).rejects.toMatchObject({ status: 404 });
  });

  it('mover de etapa deja el cambio en el historial con quién lo hizo', async () => {
    const yo = await sesionDePrueba();
    const id = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId);

    await crm.moverEtapa(id, 'agendada', yo.usuarioId);
    await crm.moverEtapa(id, 'agendada', yo.usuarioId); // la misma etapa no duplica el registro

    expect((await crm.interesadosDe(propiedadId))[0].etapa).toBe('agendada');
    const historial = await crm.actividadesDe(propiedadId);
    expect(historial).toHaveLength(1);
    expect(historial[0]).toMatchObject({ tipo: 'etapa', detalle: 'agendada', usuarioNombre: expect.stringMatching(/^Persona/) });
  });

  it('una nota sin texto se rechaza; una llamada sin observación no', async () => {
    const yo = await sesionDePrueba();
    const id = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId);

    await expect(crm.registrarActividad(id, 'nota', '', yo.usuarioId)).rejects.toMatchObject({ status: 422 });
    await crm.registrarActividad(id, 'llamada', '', yo.usuarioId);
    expect(await crm.actividadesDe(propiedadId)).toHaveLength(1);
  });
});

describe('resumen de cada propiedad', () => {
  it('cuenta interesados activos, llamadas y visitas físicas, y muestra el último contacto', async () => {
    const yo = await sesionDePrueba();
    const juan = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId);
    const ana = await crm.crearInteresado(propiedadId, { nombre: 'Ana', telefono: '', email: '' }, yo.usuarioId);

    await crm.registrarActividad(juan, 'llamada', 'Quiere ver el patio.', yo.usuarioId);
    await crm.registrarActividad(juan, 'visita', 'Le gustó, pide rebaja.', yo.usuarioId);
    await crm.registrarActividad(ana, 'llamada', 'No contestó.', yo.usuarioId);
    await crm.registrarActividad(ana, 'nota', 'Volver a llamar el lunes.', yo.usuarioId); // una nota no es contacto
    await crm.moverEtapa(ana, 'descartado', yo.usuarioId);
    // Las fechas de SQLite van al segundo: se fija la de Ana para saber cuál es la última.
    await env.DB.prepare(`UPDATE crm_actividades SET fecha = datetime('now', '+1 minute') WHERE detalle = 'No contestó.'`).run();

    const resumen = (await crm.resumenes()).get(propiedadId)!;
    expect(resumen).toMatchObject({ interesados: 2, activos: 1, llamadas: 2, visitas: 1 });
    expect(resumen.ultimo).toMatchObject({ tipo: 'llamada', interesadoNombre: 'Ana' });
  });

  it('una propiedad sin interesados no aparece en el resumen', async () => {
    expect((await crm.resumenes()).has(propiedadId)).toBe(false);
  });
});

describe('solicitudes del sitio', () => {
  it('una visita pedida desde una ficha entra como interesado con su mensaje', async () => {
    const solicitud = await nuevaSolicitud();
    const id = await crm.interesadoDesdeSolicitud(solicitud, lead());

    expect(id).not.toBeNull();
    const [interesado] = await crm.interesadosDe(propiedadId);
    expect(interesado).toMatchObject({ nombre: 'Camila Rojas', origen: 'formulario', etapa: 'nuevo' });
    const [nota] = await crm.actividadesDe(propiedadId);
    expect(nota).toMatchObject({ tipo: 'nota', usuarioNombre: null });
    expect(nota.detalle).toContain('2026-11-20');
    expect(nota.detalle).toContain('Puedo en la tarde.');
  });

  it('no la duplica si llega dos veces', async () => {
    const solicitud = await nuevaSolicitud();
    await crm.interesadoDesdeSolicitud(solicitud, lead());
    expect(await crm.interesadoDesdeSolicitud(solicitud, lead())).toBeNull();
    expect(await crm.interesadosDe(propiedadId)).toHaveLength(1);
  });

  it('el formulario «Agenda una visita» de la ficha deja al interesado en el CRM', async () => {
    const res = await contacto(
      pedir('/api/contacto', null, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
        body: JSON.stringify({ variante: 'visita', nombre: 'Camila Rojas', email: 'camila@example.com', acepto: 'si', propiedad: 'casa-quilpue' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(await crm.interesadosDe(propiedadId)).toMatchObject([{ nombre: 'Camila Rojas', origen: 'formulario' }]);
  });

  it('ignora las consultas que no son visitas y las propiedades que no existen', async () => {
    expect(await crm.interesadoDesdeSolicitud(await nuevaSolicitud(), lead({ variante: 'contacto' }))).toBeNull();
    expect(await crm.interesadoDesdeSolicitud(await nuevaSolicitud(), lead({ propiedad: 'no-existe' }))).toBeNull();
    expect(await crm.interesadosDe(propiedadId)).toHaveLength(0);
  });
});

describe('endpoints del CRM', () => {
  it('sin sesión responde 401', async () => {
    const res = await crearRuta(pedir('/api/panel/crm/interesados', null, comoJson({ propiedadId, nombre: 'Juan' })));
    expect(res.status).toBe(401);
  });

  it('valida el nombre y el correo', async () => {
    const yo = await sesionDePrueba({ rol: 'EDITOR' });
    const sinNombre = await crearRuta(pedir('/api/panel/crm/interesados', yo.cookie, comoJson({ propiedadId, nombre: 'J' })));
    expect(sinNombre.status).toBe(422);
    const malCorreo = await crearRuta(pedir('/api/panel/crm/interesados', yo.cookie, comoJson({ propiedadId, nombre: 'Juan', email: 'no-es-correo' })));
    expect(malCorreo.status).toBe(422);
  });

  it('crea, mueve, registra y borra de punta a punta', async () => {
    const yo = await sesionDePrueba({ rol: 'EDITOR' });
    const creado = await crearRuta(pedir('/api/panel/crm/interesados', yo.cookie, comoJson({ propiedadId, nombre: 'Juan', telefono: '+56 9 1111 2222' })));
    expect(creado.status).toBe(201);
    const { id } = (await creado.json()) as { id: number };

    const movido = await cambiarRuta(pedir(`/api/panel/crm/interesados/${id}`, yo.cookie, { ...comoJson({ etapa: 'visito' }), method: 'PATCH' }), ruta(id));
    expect(movido.status).toBe(200);
    const etapaMala = await cambiarRuta(pedir(`/api/panel/crm/interesados/${id}`, yo.cookie, { ...comoJson({ etapa: 'ganado' }), method: 'PATCH' }), ruta(id));
    expect(etapaMala.status).toBe(422);

    const llamada = await actividadRuta(pedir(`/api/panel/crm/interesados/${id}/actividades`, yo.cookie, comoJson({ tipo: 'visita', detalle: 'Vino con su pareja.' })), ruta(id));
    expect(llamada.status).toBe(201);
    const tipoMalo = await actividadRuta(pedir(`/api/panel/crm/interesados/${id}/actividades`, yo.cookie, comoJson({ tipo: 'fax' })), ruta(id));
    expect(tipoMalo.status).toBe(422);

    const borrado = await borrarRuta(pedir(`/api/panel/crm/interesados/${id}`, yo.cookie, { method: 'DELETE' }), ruta(id));
    expect(borrado.status).toBe(200);
    // El historial cae con el interesado.
    const { n } = (await env.DB.prepare('SELECT COUNT(*) AS n FROM crm_actividades').first<{ n: number }>())!;
    expect(n).toBe(0);
  });

  it('un editor no borra lo que agregó otro; un administrador sí', async () => {
    const duena = await sesionDePrueba({ rol: 'EDITOR' });
    const otro = await sesionDePrueba({ rol: 'EDITOR' });
    const admin = await sesionDePrueba({ rol: 'ADMIN' });
    const id = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, duena.usuarioId);

    const ajeno = await borrarRuta(pedir(`/api/panel/crm/interesados/${id}`, otro.cookie, { method: 'DELETE' }), ruta(id));
    expect(ajeno.status).toBe(403);
    const deAdmin = await borrarRuta(pedir(`/api/panel/crm/interesados/${id}`, admin.cookie, { method: 'DELETE' }), ruta(id));
    expect(deAdmin.status).toBe(200);
  });

  it('borrar la propiedad borra su CRM', async () => {
    const yo = await sesionDePrueba();
    const id = await crm.crearInteresado(propiedadId, { nombre: 'Juan', telefono: '', email: '' }, yo.usuarioId);
    await crm.registrarActividad(id, 'llamada', 'Hola.', yo.usuarioId);
    await env.DB.prepare('DELETE FROM propiedades WHERE id = ?').bind(propiedadId).run();
    const { n } = (await env.DB.prepare('SELECT COUNT(*) AS n FROM crm_actividades').first<{ n: number }>())!;
    expect(n).toBe(0);
  });
});
