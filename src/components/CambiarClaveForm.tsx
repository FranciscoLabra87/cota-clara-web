'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

export function CambiarClaveForm({ obligatorio }: { obligatorio: boolean }) {
  const id = useId();
  const router = useRouter();
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo'>('inicial');
  const [alerta, setAlerta] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const actual = String(datos.get('actual') ?? '');
    const nueva = String(datos.get('nueva') ?? '');
    const repetida = String(datos.get('repetida') ?? '');

    if (nueva !== repetida) {
      setAlerta('Las dos contraseñas nuevas no coinciden.');
      return;
    }

    setAlerta(null);
    setEstado('enviando');

    try {
      const res = await fetch('/api/auth/cambiar-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setAlerta(cuerpo.error ?? 'No pudimos cambiar la contraseña.');
        setEstado('inicial');
        return;
      }

      setEstado('listo');
      router.replace('/panel');
      router.refresh();
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
      setEstado('inicial');
    }
  }

  return (
    <form className="acceso__form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${id}-actual`}>
          {obligatorio ? 'Contraseña temporal' : 'Contraseña actual'}
        </label>
        <input
          className="field__control"
          id={`${id}-actual`}
          name="actual"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-nueva`}>
          Contraseña nueva
        </label>
        <input
          className="field__control"
          id={`${id}-nueva`}
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
        />
        <span className="field__hint">Al menos 10 caracteres, con una letra y un número.</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-repetida`}>
          Repite la contraseña nueva
        </label>
        <input
          className="field__control"
          id={`${id}-repetida`}
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <button type="submit" className="button button--primary button--block" disabled={estado !== 'inicial'}>
        {estado === 'inicial' ? 'Guardar contraseña' : 'Guardando…'}
      </button>
    </form>
  );
}
