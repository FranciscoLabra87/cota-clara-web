import { errorJson, ipDe, json, registrar } from '@/lib/auth';
import { exigirSesionApi, idDeRuta } from '@/lib/panel-api';
import { enviarRespuesta } from '@/lib/respuesta-email';
import {
  eliminarSolicitud,
  marcarRespuestaEnviada,
  marcarRespuestaFallida,
  prepararRespuesta,
  reintentarRespuesta,
  solicitudExiste,
  type SolicitudParaEnvio,
} from '@/lib/solicitudes';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function terminarEnvio(request: Request, solicitud: SolicitudParaEnvio, usuarioId: number) {
  const envio = await enviarRespuesta(solicitud);
  if (envio.estado === 'enviado') {
    if (!(await marcarRespuestaEnviada(solicitud.id, solicitud.clave, envio.id))) {
      return errorJson('El correo salió, pero no pudimos actualizar el ticket. Revisa su estado antes de reintentar.', 502);
    }
    await registrar('SOLICITUD_RESPONDIDA', { usuarioId, detalle: { id: solicitud.id }, ip: ipDe(request) });
    return json({ ok: true });
  }
  if (envio.estado === 'error' || envio.estado === 'sin-configurar') {
    await marcarRespuestaFallida(solicitud.id, solicitud.clave);
    console.error('[solicitud] falló la respuesta', solicitud.id, envio.estado === 'error' ? envio.detalle : 'correo sin configurar');
    return errorJson('No se envió el correo. El texto quedó guardado para reintentar.', 502);
  }
  // Una excepción de red no demuestra si Resend aceptó el correo. El mismo
  // contenido y la misma clave permiten reintentar sin duplicarlo.
  console.error('[solicitud] resultado incierto del envío', solicitud.id, envio.detalle);
  return errorJson('No pudimos confirmar el envío. Espera dos minutos y reintenta desde el ticket.', 503);
}

export async function POST(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;
  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Solicitud no válida', 400);
  if (!process.env.RESEND_API_KEY || !process.env.LEADS_FROM) {
    return errorJson('El envío de correos aún no está configurado. La solicitud permanece pendiente.', 503);
  }

  let body: Record<string, unknown>;
  try {
    const recibido: unknown = await request.json();
    if (!recibido || typeof recibido !== 'object' || Array.isArray(recibido)) throw new Error('Cuerpo inválido');
    body = recibido as Record<string, unknown>;
  } catch {
    return errorJson('Respuesta no válida', 400);
  }
  const respuesta = typeof body.respuesta === 'string' ? body.respuesta.trim() : '';
  const nota = typeof body.nota === 'string' ? body.nota.trim() : '';
  if (respuesta.length < 10 || respuesta.length > 4000 || nota.length < 3 || nota.length > 500) {
    return errorJson('Escribe una respuesta de 10 a 4000 caracteres y una nota interna de 3 a 500.', 422);
  }

  const solicitud = await prepararRespuesta(id, acceso.sesion.usuario_id, respuesta, nota);
  if (!solicitud) {
    return (await solicitudExiste(id))
      ? errorJson('Este ticket ya está en gestión o respondido. Actualiza la lista.', 409)
      : errorJson('No existe esa solicitud', 404);
  }
  return terminarEnvio(request, solicitud, acceso.sesion.usuario_id);
}

export async function PATCH(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;
  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Solicitud no válida', 400);
  if (!process.env.RESEND_API_KEY || !process.env.LEADS_FROM) {
    return errorJson('El envío de correos aún no está configurado. La respuesta quedó guardada para reintentar.', 503);
  }
  const solicitud = await reintentarRespuesta(id);
  if (!solicitud) {
    return (await solicitudExiste(id))
      ? errorJson('No se puede reintentar todavía. Actualiza la lista o revisa el envío en Resend.', 409)
      : errorJson('No existe esa solicitud', 404);
  }
  return terminarEnvio(request, solicitud, acceso.sesion.usuario_id);
}

// Borrar una solicitud es lo que cumple la promesa de privacidad del sitio:
// quien escribió puede pedir que se eliminen sus datos.
export async function DELETE(request: Request, { params }: Params) {
  const acceso = await exigirSesionApi(request);
  if (!acceso.ok) return acceso.respuesta;

  const id = idDeRuta((await params).id);
  if (!id) return errorJson('Solicitud no válida', 400);

  const resultado = await eliminarSolicitud(id);
  if (resultado === 'no-existe') return errorJson('No existe esa solicitud', 404);
  if (resultado === 'enviando') return errorJson('Espera a que termine el envío antes de borrar esta solicitud', 409);

  // En la bitácora queda quién la borró y cuál, sin los datos de la persona.
  await registrar('SOLICITUD_ELIMINADA', { usuarioId: acceso.sesion.usuario_id, detalle: { id }, ip: ipDe(request) });
  return json({ ok: true });
}
