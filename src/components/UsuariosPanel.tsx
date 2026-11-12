'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

export type UsuarioFila = {
  id: number;
  rut: string;
  nombre: string;
  email: string | null;
  rol: string;
  activo: number;
  password_temporal: number;
  ultimo_login: string | null;
};

type ClaveEntregada = { nombre: string; clave: string };

export function UsuariosPanel({ usuarios, yoId }: { usuarios: UsuarioFila[]; yoId: number }) {
  const id = useId();
  const router = useRouter();
  const [trabajando, setTrabajando] = useState(false);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [clave, setClave] = useState<ClaveEntregada | null>(null);

  async function pedir(url: string, body?: unknown) {
    setAlerta(null);
    setTrabajando(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const cuerpo = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        setAlerta(typeof cuerpo.error === 'string' ? cuerpo.error : 'No pudimos completar la acción.');
        return null;
      }
      router.refresh();
      return cuerpo;
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
      return null;
    } finally {
      setTrabajando(false);
    }
  }

  async function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = new FormData(form);
    const cuerpo = await pedir('/api/panel/usuarios', {
      rut: datos.get('rut'),
      nombre: datos.get('nombre'),
      email: datos.get('email'),
      rol: datos.get('rol'),
    });
    if (cuerpo?.clave_temporal) {
      setClave({ nombre: String(datos.get('nombre') ?? ''), clave: String(cuerpo.clave_temporal) });
      form.reset();
    }
  }

  async function resetear(usuario: UsuarioFila) {
    const cuerpo = await pedir(`/api/panel/usuarios/${usuario.id}/reset-clave`);
    if (cuerpo?.clave_temporal) setClave({ nombre: usuario.nombre, clave: String(cuerpo.clave_temporal) });
  }

  return (
    <>
      <h1 className="panel__title">Usuarios</h1>
      <p className="panel__intro">
        Cada cuenta nueva parte con una contraseña temporal que se muestra una sola vez. Pásasela por un medio seguro: la
        persona la cambia al entrar.
      </p>

      {clave ? (
        <div className="panel__clave" role="status">
          <p className="panel__clave-titulo">Contraseña temporal de {clave.nombre}</p>
          <p className="panel__clave-valor">{clave.clave}</p>
          <p className="panel__clave-nota">
            No se vuelve a mostrar. Si la pierdes, resetea la contraseña y se genera otra.
          </p>
          <button type="button" className="button button--outline button--sm" onClick={() => setClave(null)}>
            Ya la copié
          </button>
        </div>
      ) : null}

      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}

      <div className="panel__tabla-envoltorio">
        <table className="panel__tabla">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">RUT</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Último ingreso</th>
              <th scope="col">
                <span className="visually-hidden">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className={u.activo ? undefined : 'panel__fila--inactiva'}>
                <td>
                  {u.nombre}
                  {u.id === yoId ? <span className="panel__etiqueta">tú</span> : null}
                </td>
                <td>{u.rut}</td>
                <td>{u.rol === 'ADMIN' ? 'Administrador' : 'Editor'}</td>
                <td>
                  {u.activo ? (u.password_temporal ? 'Clave temporal pendiente' : 'Activo') : 'Desactivado'}
                </td>
                <td>{u.ultimo_login ?? 'Nunca'}</td>
                <td className="panel__acciones">
                  <button type="button" className="panel__accion" onClick={() => resetear(u)} disabled={trabajando}>
                    Resetear clave
                  </button>
                  {u.id === yoId ? null : (
                    <button
                      type="button"
                      className="panel__accion"
                      onClick={() => pedir(`/api/panel/usuarios/${u.id}/estado`, { activo: !u.activo })}
                      disabled={trabajando}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="panel__subtitulo">Agregar una cuenta</h2>
      <form className="panel__form" onSubmit={crear}>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-nombre`}>
            Nombre
          </label>
          <input className="field__control" id={`${id}-nombre`} name="nombre" type="text" required />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-rut`}>
            RUT
          </label>
          <input className="field__control" id={`${id}-rut`} name="rut" type="text" placeholder="12.345.678-9" required />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-email`}>
            Correo <span className="field__optional">(opcional)</span>
          </label>
          <input className="field__control" id={`${id}-email`} name="email" type="email" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-rol`}>
            Rol
          </label>
          <select className="field__control field__control--select" id={`${id}-rol`} name="rol" defaultValue="EDITOR">
            <option value="EDITOR">Editor · carga y edita propiedades</option>
            <option value="ADMIN">Administrador · además gestiona usuarios</option>
          </select>
        </div>
        <button type="submit" className="button button--primary" disabled={trabajando}>
          Crear cuenta
        </button>
      </form>
    </>
  );
}
