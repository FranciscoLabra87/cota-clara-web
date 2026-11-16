import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pedir, sesionDePrueba } from './sesion';

vi.mock('@/lib/db', () => ({
  obtenerDB: async () => env.DB,
  obtenerFotos: async () => env.FOTOS,
}));

const { PUT: guardar } = await import('../src/app/api/panel/propiedades/[id]/ficha/route');
const { fichaDe } = await import('@/lib/ficha-tecnica');

let propiedadId = 0;
let cookie = '';
let usuarioId = 0;
beforeEach(async () => {
  const sesion = await sesionDePrueba({ rol: 'EDITOR' });
  cookie = sesion.cookie;
  usuarioId = sesion.usuarioId;
  const fila = await env.DB.prepare(
    `INSERT INTO propiedades (slug, tipo, operacion, comuna, precio_valor, precio_moneda, publicada)
     VALUES ('casa-prueba', 'casa', 'venta', 'Providencia', 7890, 'UF', '2026-11-15') RETURNING id`,
  ).first<{ id: number }>();
  propiedadId = fila!.id;
});

const enviar = (datos: unknown, sesion: string | null = cookie, id: string | number = propiedadId) =>
  guardar(
    pedir(`/api/panel/propiedades/${id}/ficha`, sesion, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
      body: JSON.stringify(datos),
    }),
    { params: Promise.resolve({ id: String(id) }) },
  );

const antecedentes = () => ({
  rolSii: '1234 - 56',
  destino: 'Habitacional',
  avaluoFiscal: '125.400.000',
  contribuciones: 150000,
  materialidad: 'Hormigón armado',
  estadoConservacion: 'Bueno',
  pisos: '2',
  calefaccion: 'Radiadores',
  recepcionFinal: 'Sí',
  inscripcion: 'Fojas 123, número 456, año 2018, CBR de Santiago',
  observaciones: 'Nota interna de prueba',
  fuenteAntecedentes: 'Certificado aportado por propietario',
  fechaRevision: '2026-11-15',
  revisadoPor: 'Profesional de prueba',
  estadoAntecedentes: 'Informados',
});

describe('acceso a los antecedentes de ficha', () => {
  it('rechaza guardar sin sesión y no escribe nada', async () => {
    expect((await enviar(antecedentes(), null)).status).toBe(401);
    expect(await fichaDe(propiedadId)).toEqual({});
  });

  it('rechaza clave temporal, cuenta inactiva y sesión vencida', async () => {
    for (const opciones of [{ claveTemporal: true }, { activo: false }, { expirada: true }]) {
      const sesion = await sesionDePrueba(opciones);
      const res = await enviar(antecedentes(), sesion.cookie);
      expect(res.status).toBe('claveTemporal' in opciones ? 403 : 401);
    }
    expect(await fichaDe(propiedadId)).toEqual({});
  });

  it('permite al editor guardar la ficha de un borrador sin publicarlo', async () => {
    const respuesta = await enviar(antecedentes());
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true, datos: {
      ...antecedentes(), rolSii: '1234-56', avaluoFiscal: 125400000, pisos: 2,
    } });
    expect(await fichaDe(propiedadId)).toEqual({
      ...antecedentes(), rolSii: '1234-56', avaluoFiscal: 125400000, pisos: 2,
    });
    const propiedad = await env.DB.prepare('SELECT estado FROM propiedades WHERE id = ?').bind(propiedadId).first<{ estado: string }>();
    expect(propiedad?.estado).toBe('BORRADOR');
  });

  it('rechaza id no válido y propiedad inexistente', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) expect((await enviar({}, cookie, id)).status).toBe(400);
    expect((await enviar({}, cookie, 999999)).status).toBe(404);
  });
});

describe('integridad y persistencia de ficha', () => {
  it('rechaza null, arreglos, primitivas y JSON roto como solicitud inválida', async () => {
    for (const cuerpo of [null, [], ['x'], 15, 'texto', true]) expect((await enviar(cuerpo)).status).toBe(400);
    const res = await guardar(
      pedir(`/api/panel/propiedades/${propiedadId}/ficha`, cookie, { method: 'PUT', body: '{' }),
      { params: Promise.resolve({ id: String(propiedadId) }) },
    );
    expect(res.status).toBe(400);
    expect(await fichaDe(propiedadId)).toEqual({});
  });

  it('no cambia la ficha guardada cuando llega un valor inválido', async () => {
    await enviar(antecedentes());
    expect((await enviar({ ...antecedentes(), fechaRevision: '2026-02-31' })).status).toBe(422);
    expect((await fichaDe(propiedadId)).fechaRevision).toBe('2026-11-15');
  });

  it('no guarda una revisión documental sin responsable y devuelve los datos normalizados cuando está completa', async () => {
    const datos = { ...antecedentes(), estadoAntecedentes: 'Revisados documentalmente' };
    expect((await enviar({ ...datos, revisadoPor: '' })).status).toBe(422);
    expect(await fichaDe(propiedadId)).toEqual({});
    const respuesta = await enviar(datos);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toMatchObject({ ok: true, datos: {
      estadoAntecedentes: 'Revisados documentalmente',
      fuenteAntecedentes: datos.fuenteAntecedentes,
      fechaRevision: datos.fechaRevision,
      revisadoPor: datos.revisadoPor,
      rolSii: '1234-56',
    } });
  });

  it('reemplaza y permite limpiar datos sin dejar duplicados ni valores antiguos', async () => {
    await enviar(antecedentes());
    await enviar({ destino: 'Oficina', estadoAntecedentes: 'Pendientes' });
    expect(await fichaDe(propiedadId)).toEqual({ destino: 'Oficina', estadoAntecedentes: 'Pendientes' });
    await enviar({ destino: '', fechaRevision: '', observaciones: '' });
    expect(await fichaDe(propiedadId)).toEqual({});
    const fila = await env.DB.prepare('SELECT COUNT(*) AS total FROM propiedad_ficha WHERE propiedad_id = ?')
      .bind(propiedadId).first<{ total: number }>();
    expect(fila?.total).toBe(1);
  });

  it('registra responsable e id, sin copiar antecedentes privados a la bitácora', async () => {
    await enviar(antecedentes());
    const evento = await env.DB.prepare(
      `SELECT usuario_id, detalle, ip FROM log_eventos WHERE accion = 'FICHA_TECNICA_GUARDADA'`,
    ).first<{ usuario_id: number; detalle: string; ip: string }>();
    expect(evento?.usuario_id).toBe(usuarioId);
    expect(JSON.parse(evento!.detalle)).toEqual({ propiedad_id: propiedadId });
    expect(evento?.ip).toBe('203.0.113.10');
    expect(evento?.detalle).not.toContain('Nota interna');
  });
});
