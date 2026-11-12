'use client';

import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

type Props = { turnstileSiteKey: string | null };

export function AccesoForm({ turnstileSiteKey }: Props) {
  const id = useId();
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'enviando'>('inicial');
  const [alerta, setAlerta] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const rut = String(datos.get('rut') ?? '').trim();
    const password = String(datos.get('password') ?? '');

    if (!rut || !password) {
      setAlerta('Escribe tu RUT y tu contraseña.');
      return;
    }

    setAlerta(null);
    setEstado('enviando');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rut,
          password,
          turnstile_token: datos.get('cf-turnstile-response') ?? '',
        }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string; debe_cambiar_clave?: boolean };

      if (!res.ok) {
        setAlerta(cuerpo.error ?? 'No pudimos validar tus datos.');
        setEstado('inicial');
        // El widget de Turnstile entrega un token de un solo uso.
        window.turnstile?.reset();
        return;
      }

      router.replace(cuerpo.debe_cambiar_clave ? '/panel/clave' : '/panel');
      router.refresh();
    } catch {
      setAlerta('No pudimos conectar. Revisa tu conexión e intenta de nuevo.');
      setEstado('inicial');
    }
  }

  return (
    <form className="acceso__form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-rut`}>
          RUT
        </label>
        <input
          className="field__control"
          id={`${id}-rut`}
          name="rut"
          type="text"
          inputMode="text"
          autoComplete="username"
          placeholder="12.345.678-9"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-password`}>
          Contraseña
        </label>
        <input
          className="field__control"
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {turnstileSiteKey ? (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-action="acceso-corporativo" data-theme="light" />
        </>
      ) : null}

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <button type="submit" className="button button--primary button--block" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

declare global {
  interface Window {
    turnstile?: { reset: (widget?: string) => void };
  }
}
