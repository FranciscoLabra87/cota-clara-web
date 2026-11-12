import { getCloudflareContext } from '@opennextjs/cloudflare';

// Verificación anti-bot de Cloudflare. Es opcional: mientras no haya
// TURNSTILE_SECRET_KEY, el login funciona sin el widget. Apenas se define el
// secreto pasa a ser obligatorio, para que no quede a medias por descuido.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const ACCION_TURNSTILE = 'acceso-corporativo';

async function variables() {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as Record<string, string | undefined>;
}

function limpiar(valor: string | undefined) {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto || null;
}

export async function siteKeyTurnstile() {
  return limpiar((await variables()).TURNSTILE_SITE_KEY);
}

export type ResultadoTurnstile = { ok: true } | { ok: false; mensaje: string; status: number };

export async function verificarTurnstile(request: Request, token: unknown): Promise<ResultadoTurnstile> {
  const vars = await variables();
  const secreto = limpiar(vars.TURNSTILE_SECRET_KEY);
  const exigido = String(vars.TURNSTILE_REQUIRED || '').toLowerCase() === 'true' || !!secreto;

  if (!exigido) return { ok: true };
  if (!secreto) return { ok: false, mensaje: 'La verificación anti-bot no está configurada', status: 503 };

  const respuesta = typeof token === 'string' ? token.trim() : '';
  if (!respuesta || respuesta.length > 2048) {
    return { ok: false, mensaje: 'Completa la verificación anti-bot', status: 400 };
  }

  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For');
  const cuerpo: Record<string, string> = { secret: secreto, response: respuesta, idempotency_key: crypto.randomUUID() };
  if (ip) cuerpo.remoteip = ip;

  try {
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const validacion = (await res.json().catch(() => ({}))) as { success?: boolean; action?: string };
    if (!res.ok || !validacion.success || validacion.action !== ACCION_TURNSTILE) {
      return { ok: false, mensaje: 'Verificación anti-bot inválida', status: 400 };
    }
  } catch (e) {
    console.error('[turnstile] falló la validación:', e);
    return { ok: false, mensaje: 'No pudimos validar la verificación anti-bot', status: 400 };
  }

  return { ok: true };
}
