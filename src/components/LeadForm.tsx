'use client';

import Link from 'next/link';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { comunas } from '@/data/site';
import { tipos } from '@/data/properties';
import { registrarSolicitudEnviada } from '@/lib/analytics';
import { LIMITES_LEAD, MOTIVOS_TASACION, validarLead, type ErroresLead, type VarianteLead } from '@/lib/validar-lead';

type Props = {
  variante: VarianteLead;
  titulo: string;
  bajada?: string;
  propiedad?: string;
  boton?: string;
  /** Opciones de «¿Qué necesitas?»; la segunda pide fecha. Solo en la ficha. */
  motivos?: readonly string[];
  /**
   * Id del formulario, para enlazarlo desde la página. `#<ancla>` lleva al
   * formulario y `#<ancla>-reunion` además elige la segunda opción de motivos.
   */
  ancla?: string;
};

export function LeadForm({ variante, titulo, bajada, propiedad, boton, motivos, ancla }: Props) {
  const id = useId();
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo' | 'error'>('inicial');
  const [errores, setErrores] = useState<ErroresLead>({});
  const [errorEnvio, setErrorEnvio] = useState('');
  const [motivo, setMotivo] = useState(motivos?.[0] ?? '');
  const pideFecha = variante === 'visita' && (!motivos || motivo === motivos[1]);

  // Los botones de la cabecera de la ficha enlazan acá. El navegador ya hace
  // el scroll; esto elige el motivo y deja el cursor en el nombre.
  useEffect(() => {
    if (!ancla || !motivos) return;
    const leer = () => {
      const hash = window.location.hash;
      if (hash !== `#${ancla}` && hash !== `#${ancla}-reunion`) return;
      if (hash === `#${ancla}-reunion`) setMotivo(motivos[1]);
      document.getElementById(`${id}-nombre`)?.focus({ preventScroll: true });
    };
    leer();
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, [ancla, motivos, id]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(Array.from(new FormData(form).entries()).map(([k, v]) => [k, String(v)]));
    const validacion = validarLead({ ...datos, variante, propiedad });
    setErrorEnvio('');
    setErrores(validacion.ok ? {} : validacion.errores);
    if (!validacion.ok) {
      const primero = Object.keys(validacion.errores)[0];
      form.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setEstado('enviando');
    try {
      const res = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, ...validacion.lead }),
      });
      if (!res.ok) {
        const fallo = await res.json().catch(() => null) as { error?: string; errores?: ErroresLead } | null;
        if (res.status === 422 && fallo?.errores) {
          setErrores(fallo.errores);
          form.querySelector<HTMLElement>(`[name="${Object.keys(fallo.errores)[0]}"]`)?.focus();
        }
        setErrorEnvio(fallo?.error || 'No pudimos enviar tu solicitud. Inténtalo más tarde.');
        setEstado('error');
        return;
      }
      registrarSolicitudEnviada(variante);
      form.reset();
      setEstado('listo');
    } catch {
      setErrorEnvio('No pudimos enviar tu solicitud. Inténtalo más tarde.');
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

  const campo = (name: keyof ErroresLead) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': errores[name] ? true : undefined,
    'aria-describedby': errores[name] ? `${id}-${name}-error` : undefined,
  });
  const error = (name: keyof ErroresLead) =>
    errores[name] ? (
      <span className="field__error" id={`${id}-${name}-error`}>
        {errores[name]}
      </span>
    ) : null;
  const fieldClass = (name: keyof ErroresLead) => `field${errores[name] ? ' field--invalid' : ''}`;

  return (
    <form className="lead-form" id={ancla} noValidate onSubmit={onSubmit} aria-labelledby={`${id}-titulo`}>
      {ancla ? <div className="lead-form__ancla" id={`${ancla}-reunion`} /> : null}
      <div className="lead-form__head">
        <p className="lead-form__title" id={`${id}-titulo`}>
          {titulo}
        </p>
        {bajada ? <p className="lead-form__intro">{bajada}</p> : null}
      </div>

      {motivos ? (
        <fieldset className="lead-form__motivos" aria-invalid={errores.motivo ? true : undefined} aria-describedby={errores.motivo ? `${id}-motivo-error` : undefined}>
          <legend className="field__label">¿Qué necesitas?</legend>
          {motivos.map((m) => (
            <label key={m} className={`lead-form__motivo${motivo === m ? ' lead-form__motivo--activo' : ''}`}>
              <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
              <span>{m}</span>
            </label>
          ))}
          {error('motivo')}
        </fieldset>
      ) : null}

      {variante === 'tasacion' ? (
        <div className="lead-form__row">
          <div className={fieldClass('tipo')}>
            <label className="field__label" htmlFor={`${id}-tipo`}>
              Tipo de propiedad
            </label>
            <select className="field__control field__control--select" defaultValue="" required {...campo('tipo')}>
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
            <select className="field__control field__control--select" defaultValue="" required {...campo('comuna')}>
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
          <div className={fieldClass('motivo')}>
            <label className="field__label" htmlFor={`${id}-motivo`}>
              Motivo
            </label>
            <select className="field__control field__control--select" defaultValue="Vender" {...campo('motivo')}>
              {MOTIVOS_TASACION.map((opcion) => <option key={opcion}>{opcion}</option>)}
            </select>
            {error('motivo')}
          </div>
        </div>
      ) : null}

      <div className="lead-form__row">
        <div className={fieldClass('nombre')}>
          <label className="field__label" htmlFor={`${id}-nombre`}>
            Nombre
          </label>
          <input className="field__control" type="text" autoComplete="name" maxLength={LIMITES_LEAD.nombre} required {...campo('nombre')} />
          {error('nombre')}
        </div>
        <div className={fieldClass('telefono')}>
          <label className="field__label" htmlFor={`${id}-telefono`}>
            Teléfono <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" type="tel" autoComplete="tel" inputMode="tel" maxLength={LIMITES_LEAD.telefono} {...campo('telefono')} />
          {error('telefono')}
        </div>
      </div>

      <div className={fieldClass('email')}>
        <label className="field__label" htmlFor={`${id}-email`}>
          Correo
        </label>
        <input className="field__control" type="email" autoComplete="email" maxLength={LIMITES_LEAD.email} required {...campo('email')} />
        {error('email')}
      </div>

      {pideFecha ? (
        <div className={fieldClass('fecha')}>
          <label className="field__label" htmlFor={`${id}-fecha`}>
            Fecha preferida <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" type="date" {...campo('fecha')} />
          {error('fecha')}
        </div>
      ) : null}

      {variante !== 'tasacion' ? (
        <div className={fieldClass('mensaje')}>
          <label className="field__label" htmlFor={`${id}-mensaje`}>
            Mensaje {variante === 'visita' ? <span className="field__optional">(opcional)</span> : null}
          </label>
          <textarea className="field__control field__control--textarea" rows={4} maxLength={LIMITES_LEAD.mensaje} required={variante === 'contacto'} {...campo('mensaje')} />
          {error('mensaje')}
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
            Autorizo a Cota Clara a contactarme por esta solicitud según su <Link href="/privacidad">política de privacidad</Link>.
          </span>
        </label>
        {error('acepto')}
      </div>

      {estado === 'error' ? (
        <p className="lead-form__alert" role="alert">
          {errorEnvio || 'No pudimos enviar tu solicitud. Inténtalo más tarde.'}
        </p>
      ) : null}

      <button type="submit" className="button button--primary button--block" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : boton ?? 'Enviar'}
      </button>
    </form>
  );
}
