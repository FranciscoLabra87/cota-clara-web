import { NextResponse } from 'next/server';
import { enviarLead, type Lead } from '@/lib/leads';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  // Campo trampa para bots: si viene completo, se descarta sin avisar.
  if (texto(body.empresa)) return NextResponse.json({ ok: true });

  const lead: Lead = {
    variante: texto(body.variante, 20),
    nombre: texto(body.nombre, 120),
    email: texto(body.email, 160),
    telefono: texto(body.telefono, 40),
    tipo: texto(body.tipo, 40),
    comuna: texto(body.comuna, 60),
    motivo: texto(body.motivo, 60),
    fecha: texto(body.fecha, 20),
    mensaje: texto(body.mensaje, 2000),
    propiedad: texto(body.propiedad, 120),
  };

  if (lead.nombre.length < 2 || !EMAIL.test(lead.email) || !texto(body.acepto)) {
    return NextResponse.json({ ok: false, error: 'Faltan datos obligatorios' }, { status: 422 });
  }

  const envio = await enviarLead(lead);

  if (envio.estado === 'error') {
    // El correo no salió: dejamos el lead en el log para no perderlo y avisamos al
    // formulario, que ofrece el correo de respaldo.
    console.error('[lead] no se pudo enviar:', envio.detalle, JSON.stringify(lead));
    return NextResponse.json({ ok: false, error: 'No pudimos enviar tu solicitud' }, { status: 502 });
  }

  if (envio.estado === 'sin-configurar') {
    console.warn('[lead] falta RESEND_API_KEY o LEADS_FROM: el lead solo queda en este log');
  }

  console.info('[lead]', envio.estado, JSON.stringify(lead));

  return NextResponse.json({ ok: true });
}
