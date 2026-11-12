import { NextResponse } from 'next/server';

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

  const lead = {
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

  // Conectar aquí el envío real (correo transaccional o CRM) antes de publicar el sitio.
  console.info('[lead]', JSON.stringify(lead));

  return NextResponse.json({ ok: true });
}
