'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { comunas } from '@/data/site';
import { tipos } from '@/data/properties';

type Variante = 'tasacion' | 'contacto' | 'visita';

type Props = {
  variante: Variante;
  titulo: string;
  bajada?: string;
  propiedad?: string;
  boton?: string;
};

type Errores = Partial<Record<string, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validar(datos: Record<string, string>, variante: Variante): Errores {
  const e: Errores = {};
  if ((datos.nombre ?? '').trim().length < 2) e.nombre = 'Escribe tu nombre.';
  if (!EMAIL.test((datos.email ?? '').trim())) e.email = 'Escribe un correo válido, por ejemplo nombre@correo.cl.';
  const fono = (datos.telefono ?? '').replace(/\D/g, '');
  if (fono && fono.length < 8) e.telefono = 'Revisa el teléfono: debe tener al menos 8 dígitos.';
  if (variante === 'tasacion') {
    if (!datos.tipo) e.tipo = 'Elige el tipo de propiedad.';
    if (!datos.comuna) e.comuna = 'Elige la comuna.';
  }
  if (!datos.acepto) e.acepto = 'Necesitamos tu autorización para contactarte.';
  return e;
}

export function LeadForm({ variante, titulo, bajada, propiedad, boton }: Props) {
  const id = useId();
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo' | 'error'>('inicial');
  const [errores, setErrores] = useState<Errores>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(Array.from(new FormData(form).entries()).map(([k, v]) => [k, String(v)]));
    const nuevos = validar(datos, variante);
    setErrores(nuevos);
    const primero = Object.keys(nuevos)[0];
    if (primero) {
      form.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setEstado('enviando');
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, variante, propiedad }),
      });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }

  if (estado === 'listo') {
    return (
      <div className="lead-form lead-form--done" role="status">
        <span className="lead-form__done-icon">
          <Icon name="check" />
        </span>
        <p className="lead-form__title">Recibimos tu solicitud</p>
        <p className="lead-form__intro">Te contactaremos dentro del próximo día hábil para coordinar los siguientes pasos.</p>
        <button type="button" className="button button--outline" onClick={() => setEstado('inicial')}>
          Enviar otra solicitud
        </button>
      </div>
    );
  }

  const campo = (name: string) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': errores[name] ? true : undefined,
    'aria-describedby': errores[name] ? `${id}-${name}-error` : undefined,
  });
  const error = (name: string) =>
    errores[name] ? (
      <span className="field__error" id={`${id}-${name}-error`}>
        {errores[name]}
      </span>
    ) : null;
  const fieldClass = (name: string) => `field${errores[name] ? ' field--invalid' : ''}`;

  return (
    <form className="lead-form" noValidate onSubmit={onSubmit} aria-labelledby={`${id}-titulo`}>
      <div className="lead-form__head">
        <p className="lead-form__title" id={`${id}-titulo`}>
          {titulo}
        </p>
        {bajada ? <p className="lead-form__intro">{bajada}</p> : null}
      </div>

      {variante === 'tasacion' ? (
        <div className="lead-form__row">
          <div className={fieldClass('tipo')}>
            <label className="field__label" htmlFor={`${id}-tipo`}>
              Tipo de propiedad
            </label>
            <select className="field__control field__control--select" defaultValue="" {...campo('tipo')}>
              <option value="">Elige una opción</option>
              {tipos.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {error('tipo')}
          </div>
          <div className={fieldClass('comuna')}>
            <label className="field__label" htmlFor={`${id}-comuna`}>
              Comuna
            </label>
            <select className="field__control field__control--select" defaultValue="" {...campo('comuna')}>
              <option value="">Elige una opción</option>
              {comunas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Otra">Otra comuna</option>
            </select>
            {error('comuna')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-motivo`}>
              Motivo
            </label>
            <select className="field__control field__control--select" defaultValue="Vender" {...campo('motivo')}>
              <option>Vender</option>
              <option>Arrendar</option>
              <option>Herencia o partición</option>
              <option>Comprar con respaldo</option>
              <option>Otro</option>
            </select>
          </div>
        </div>
      ) : null}

      <div className="lead-form__row">
        <div className={fieldClass('nombre')}>
          <label className="field__label" htmlFor={`${id}-nombre`}>
            Nombre
          </label>
          <input className="field__control" type="text" autoComplete="name" {...campo('nombre')} />
          {error('nombre')}
        </div>
        <div className={fieldClass('telefono')}>
          <label className="field__label" htmlFor={`${id}-telefono`}>
            Teléfono <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" type="tel" autoComplete="tel" inputMode="tel" {...campo('telefono')} />
          {error('telefono')}
        </div>
      </div>

      <div className={fieldClass('email')}>
        <label className="field__label" htmlFor={`${id}-email`}>
          Correo
        </label>
        <input className="field__control" type="email" autoComplete="email" {...campo('email')} />
        {error('email')}
      </div>

      {variante === 'visita' ? (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-fecha`}>
            Fecha preferida <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" type="date" {...campo('fecha')} />
        </div>
      ) : null}

      {variante !== 'tasacion' ? (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-mensaje`}>
            Mensaje <span className="field__optional">(opcional)</span>
          </label>
          <textarea className="field__control field__control--textarea" rows={4} {...campo('mensaje')} />
        </div>
      ) : null}

      <div className="lead-form__honeypot" aria-hidden="true">
        <label htmlFor={`${id}-empresa`}>No completar</label>
        <input id={`${id}-empresa`} name="empresa" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={`${fieldClass('acepto')} field--check`}>
        <label className="field__check" htmlFor={`${id}-acepto`}>
          <input type="checkbox" value="si" {...campo('acepto')} />
          <span>
            Autorizo a Cota Clara a contactarme por esta solicitud según su <Link href="/contacto">política de privacidad</Link>.
          </span>
        </label>
        {error('acepto')}
      </div>

      {estado === 'error' ? (
        <p className="lead-form__alert" role="alert">
          No pudimos enviar tu solicitud. Inténtalo de nuevo o escríbenos a contacto@cotaclara.cl.
        </p>
      ) : null}

      <button type="submit" className="button button--primary button--block" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : boton ?? 'Enviar'}
      </button>
    </form>
  );
}
