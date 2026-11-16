import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { guardarFicha, validarFicha } from '@/lib/ficha-tecnica';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { propiedadPorId } from '@/lib/propiedades';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// Guarda los antecedentes técnicos de una propiedad. Reemplaza el conjunto
// completo: lo que el formulario manda vacío queda sin dato.
export async function PUT(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Propiedad no válida', 400);
  if (!(await propiedadPorId(id))) return errorJson('No existe esa propiedad', 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorJson('Solicitud inválida', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorJson('Solicitud inválida', 400);

  const validacion = validarFicha(body);
  if (!validacion.ok) return errorJson(validacion.error, 422);

  await guardarFicha(id, validacion.datos);
  await registrar('FICHA_TECNICA_GUARDADA', {
    usuarioId: acceso.sesion.usuario_id,
    detalle: { propiedad_id: id },
    ip: ipDe(request),
  });

  return json({ ok: true, datos: validacion.datos });
}
