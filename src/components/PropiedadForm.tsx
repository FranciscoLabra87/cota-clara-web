'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { tipos } from '@/data/properties';
import type { PropiedadAdmin } from '@/lib/propiedades';

type Foto = { id: number; url: string };

type Props = {
  propiedad?: PropiedadAdmin;
  fotos?: Foto[];
  comunas: string[];
};

const lineas = (valor: string) =>
  valor
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

const hoy = () => new Date().toISOString().slice(0, 10);

export function PropiedadForm({ propiedad, fotos = [], comunas }: Props) {
  const id = useId();
  const router = useRouter();
  const editando = !!propiedad;

  const [estado, setEstado] = useState<'inicial' | 'guardando'>('inicial');
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listaFotos, setListaFotos] = useState<Foto[]>(fotos);
  const [subiendo, setSubiendo] = useState(false);
  const [ordenando, setOrdenando] = useState(false);

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const cuerpo = {
      slug: datos.get('slug'),
      titulo: datos.get('titulo'),
      tipo: datos.get('tipo'),
      operacion: datos.get('operacion'),
      comuna: datos.get('comuna'),
      sector: datos.get('sector'),
      precioValor: datos.get('precioValor'),
      precioMoneda: datos.get('precioMoneda'),
      dormitorios: datos.get('dormitorios'),
      banos: datos.get('banos'),
      estacionamientos: datos.get('estacionamientos'),
      bodegas: datos.get('bodegas'),
      superficieUtil: datos.get('superficieUtil'),
      superficieTotal: datos.get('superficieTotal'),
      terreno: datos.get('terreno'),
      piso: datos.get('piso'),
      orientacion: datos.get('orientacion'),
      anio: datos.get('anio'),
      gastosComunes: datos.get('gastosComunes'),
      etiquetas: lineas(String(datos.get('etiquetas') ?? '')),
      resumen: datos.get('resumen'),
      descripcion: lineas(String(datos.get('descripcion') ?? '')),
      caracteristicas: lineas(String(datos.get('caracteristicas') ?? '')),
      destacada: datos.get('destacada') === 'on',
      publicada: datos.get('publicada'),
      estado: datos.get('estado'),
      ilustracionSeed: datos.get('ilustracionSeed'),
      ilustracionTono: datos.get('ilustracionTono'),
    };

    setAlerta(null);
    setAviso(null);
    setEstado('guardando');

    try {
      const res = await fetch(editando ? `/api/panel/propiedades/${propiedad.id}` : '/api/panel/propiedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const respuesta = (await res.json().catch(() => ({}))) as { error?: string; id?: number };

      if (!res.ok) {
        setAlerta(respuesta.error ?? 'No pudimos guardar la propiedad.');
        setEstado('inicial');
        return;
      }

      if (editando) {
        setAviso('Cambios guardados.');
        setEstado('inicial');
        router.refresh();
      } else {
        // Las fotos necesitan que la propiedad exista: se siguen cargando en
        // la pantalla de edición.
        router.replace(`/panel/propiedades/${respuesta.id}`);
        router.refresh();
      }
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
      setEstado('inicial');
    }
  }

  async function subirFoto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!propiedad) return;
    const form = e.currentTarget;
    const datos = new FormData(form);
    if (!(datos.get('foto') as File)?.size) {
      setAlerta('Elige una imagen.');
      return;
    }

    setAlerta(null);
    setSubiendo(true);
    try {
      const res = await fetch(`/api/panel/propiedades/${propiedad.id}/fotos`, { method: 'POST', body: datos });
      const respuesta = (await res.json().catch(() => ({}))) as { error?: string; id?: number; url?: string };
      if (!res.ok || !respuesta.id || !respuesta.url) {
        setAlerta(respuesta.error ?? 'No pudimos subir la foto.');
        return;
      }
      setListaFotos((actual) => [...actual, { id: respuesta.id!, url: respuesta.url! }]);
      form.reset();
      router.refresh();
    } catch {
      setAlerta('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setSubiendo(false);
    }
  }

  // Mueve la foto en pantalla al tiro y manda el orden completo. Si el
  // servidor lo rechaza, la lista vuelve a como estaba.
  async function moverFoto(desde: number, hacia: number) {
    if (!propiedad || hacia < 0 || hacia >= listaFotos.length) return;

    const previa = listaFotos;
    const nueva = [...listaFotos];
    const [movida] = nueva.splice(desde, 1);
    nueva.splice(hacia, 0, movida);

    setAlerta(null);
    setListaFotos(nueva);
    setOrdenando(true);
    try {
      const res = await fetch(`/api/panel/propiedades/${propiedad.id}/fotos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: nueva.map((f) => f.id) }),
      });
      if (!res.ok) {
        const respuesta = (await res.json().catch(() => ({}))) as { error?: string };
        setListaFotos(previa);
        setAlerta(respuesta.error ?? 'No pudimos cambiar el orden.');
        return;
      }
      router.refresh();
    } catch {
      setListaFotos(previa);
      setAlerta('No pudimos conectar. Intenta de nuevo.');
    } finally {
      setOrdenando(false);
    }
  }

  async function borrarFoto(foto: Foto) {
    if (!propiedad) return;
    const res = await fetch(`/api/panel/propiedades/${propiedad.id}/fotos/${foto.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setAlerta('No pudimos borrar la foto.');
      return;
    }
    setListaFotos((actual) => actual.filter((f) => f.id !== foto.id));
    router.refresh();
  }

  const campo = (nombre: string) => ({ id: `${id}-${nombre}`, name: nombre });

  return (
    <>
      {alerta ? (
        <p className="acceso__alerta" role="alert">
          {alerta}
        </p>
      ) : null}
      {aviso ? (
        <p className="panel__aviso" role="status">
          {aviso}
        </p>
      ) : null}

      <form className="panel__form panel__form--ancho" onSubmit={guardar}>
        <fieldset className="panel__fieldset">
          <legend className="panel__legend">Qué es y dónde está</legend>
          <div className="panel__rejilla">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-tipo`}>
                Tipo
              </label>
              <select className="field__control field__control--select" defaultValue={propiedad?.tipo ?? 'departamento'} {...campo('tipo')}>
                {tipos.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-operacion`}>
                Operación
              </label>
              <select className="field__control field__control--select" defaultValue={propiedad?.operacion ?? 'venta'} {...campo('operacion')}>
                <option value="venta">Venta</option>
                <option value="arriendo">Arriendo</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-comuna`}>
                Comuna
              </label>
              <input className="field__control" list={`${id}-comunas`} defaultValue={propiedad?.comuna ?? ''} required {...campo('comuna')} />
              <datalist id={`${id}-comunas`}>
                {comunas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-sector`}>
                Sector <span className="field__optional">(opcional)</span>
              </label>
              <input className="field__control" defaultValue={propiedad?.sector ?? ''} {...campo('sector')} />
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-titulo`}>
              Título <span className="field__optional">(opcional)</span>
            </label>
            <input className="field__control" maxLength={160} defaultValue={propiedad?.titulo ?? ''} placeholder="Casa en Peña Blanca" {...campo('titulo')} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-slug`}>
              Enlace <span className="field__optional">(se arma solo si lo dejas vacío)</span>
            </label>
            <input className="field__control" defaultValue={propiedad?.slug ?? ''} placeholder="departamento-providencia-pedro-de-valdivia" {...campo('slug')} />
            <span className="field__hint">Queda como /propiedades/…. Cambiarlo rompe el enlace anterior.</span>
          </div>
        </fieldset>

        <fieldset className="panel__fieldset">
          <legend className="panel__legend">Precio</legend>
          <div className="panel__rejilla">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-precioValor`}>
                Valor
              </label>
              <input className="field__control" type="number" min="1" defaultValue={propiedad?.precio.valor ?? ''} required {...campo('precioValor')} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-precioMoneda`}>
                Moneda
              </label>
              <select className="field__control field__control--select" defaultValue={propiedad?.precio.moneda ?? 'UF'} {...campo('precioMoneda')}>
                <option value="UF">UF</option>
                <option value="CLP">Pesos</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-gastosComunes`}>
                Gastos comunes <span className="field__optional">(opcional)</span>
              </label>
              <input className="field__control" type="number" min="0" defaultValue={propiedad?.gastosComunes ?? ''} {...campo('gastosComunes')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="panel__fieldset">
          <legend className="panel__legend">Superficies y espacios</legend>
          <div className="panel__rejilla">
            {(
              [
                ['dormitorios', 'Dormitorios', propiedad?.dormitorios],
                ['banos', 'Baños', propiedad?.banos],
                ['estacionamientos', 'Estacionamientos', propiedad?.estacionamientos],
                ['bodegas', 'Bodegas', propiedad?.bodegas],
                ['superficieUtil', 'Superficie útil (m²)', propiedad?.superficieUtil],
                ['superficieTotal', 'Superficie total (m²)', propiedad?.superficieTotal],
                ['terreno', 'Terreno (m²)', propiedad?.terreno],
                ['piso', 'Piso', propiedad?.piso],
                ['anio', 'Año', propiedad?.anio],
              ] as const
            ).map(([nombre, etiqueta, valor]) => (
              <div className="field" key={nombre}>
                <label className="field__label" htmlFor={`${id}-${nombre}`}>
                  {etiqueta}
                </label>
                <input className="field__control" type="number" min="0" defaultValue={valor ?? ''} {...campo(nombre)} />
              </div>
            ))}
            <div className="field">
              <label className="field__label" htmlFor={`${id}-orientacion`}>
                Orientación
              </label>
              <input className="field__control" defaultValue={propiedad?.orientacion ?? ''} placeholder="Nororiente" {...campo('orientacion')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="panel__fieldset">
          <legend className="panel__legend">Textos</legend>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-resumen`}>
              Resumen
            </label>
            <textarea className="field__control field__control--textarea" rows={2} maxLength={300} defaultValue={propiedad?.resumen ?? ''} required {...campo('resumen')} />
            <span className="field__hint">Es la frase que se ve en la tarjeta del listado.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-descripcion`}>
              Descripción
            </label>
            <textarea className="field__control field__control--textarea" rows={6} defaultValue={(propiedad?.descripcion ?? []).join('\n')} {...campo('descripcion')} />
            <span className="field__hint">Un párrafo por línea.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-caracteristicas`}>
              Características
            </label>
            <textarea className="field__control field__control--textarea" rows={5} defaultValue={(propiedad?.caracteristicas ?? []).join('\n')} {...campo('caracteristicas')} />
            <span className="field__hint">Una por línea. Salen como lista en la ficha.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${id}-etiquetas`}>
              Etiquetas <span className="field__optional">(opcional)</span>
            </label>
            <textarea className="field__control field__control--textarea" rows={2} defaultValue={(propiedad?.etiquetas ?? []).join('\n')} {...campo('etiquetas')} />
            <span className="field__hint">Una por línea, por ejemplo &laquo;Con informe de valor&raquo;.</span>
          </div>
        </fieldset>

        <fieldset className="panel__fieldset">
          <legend className="panel__legend">Publicación</legend>
          <div className="panel__rejilla">
            <div className="field">
              <label className="field__label" htmlFor={`${id}-publicada`}>
                Fecha
              </label>
              <input className="field__control" type="date" defaultValue={propiedad?.publicada ?? hoy()} required {...campo('publicada')} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-estado`}>
                Estado
              </label>
              <select className="field__control field__control--select" defaultValue={propiedad?.estado ?? 'BORRADOR'} {...campo('estado')}>
                <option value="BORRADOR">Borrador · no se ve en el sitio</option>
                <option value="PUBLICADA">Publicada · visible para todos</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-ilustracionSeed`}>
                Ilustración
              </label>
              <input className="field__control" type="number" min="0" max="999" defaultValue={propiedad?.ilustracion.seed ?? 1} {...campo('ilustracionSeed')} />
              <span className="field__hint">Cambia el dibujo que se usa mientras no haya fotos.</span>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-ilustracionTono`}>
                Tono
              </label>
              <select className="field__control field__control--select" defaultValue={propiedad?.ilustracion.tono ?? 'dia'} {...campo('ilustracionTono')}>
                <option value="dia">Día</option>
                <option value="atardecer">Atardecer</option>
              </select>
            </div>
          </div>
          <div className="field field--check">
            <label className="field__check" htmlFor={`${id}-destacada`}>
              <input type="checkbox" defaultChecked={propiedad?.destacada ?? false} {...campo('destacada')} />
              <span>Destacada en la portada</span>
            </label>
          </div>
        </fieldset>

        <button type="submit" className="button button--primary" disabled={estado === 'guardando'}>
          {estado === 'guardando' ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear propiedad'}
        </button>
      </form>

      {editando ? (
        <>
          <h2 className="panel__subtitulo">Fotos</h2>
          <p className="panel__intro">
            JPG, PNG o WEBP, hasta 5 MB cada una. Si no hay fotos, la ficha muestra la ilustración. La primera es la
            portada: la que sale en el listado y arriba en la ficha. Con las flechas cambias el orden.
          </p>

          {listaFotos.length ? (
            <ul className="panel__fotos">
              {listaFotos.map((foto, i) => (
                <li className="panel__foto" key={foto.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="panel__foto-img" src={foto.url} alt={`Foto ${i + 1}`} loading="lazy" />
                  {i === 0 ? <span className="panel__foto-portada">Portada</span> : null}
                  <div className="panel__acciones panel__acciones--foto">
                    <button
                      type="button"
                      className="panel__accion panel__accion--orden"
                      onClick={() => moverFoto(i, i - 1)}
                      disabled={i === 0 || ordenando}
                      aria-label={`Mover la foto ${i + 1} hacia atrás`}
                      title="Mover hacia atrás"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      className="panel__accion panel__accion--orden"
                      onClick={() => moverFoto(i, i + 1)}
                      disabled={i === listaFotos.length - 1 || ordenando}
                      aria-label={`Mover la foto ${i + 1} hacia adelante`}
                      title="Mover hacia adelante"
                    >
                      →
                    </button>
                    <button type="button" className="panel__accion" onClick={() => borrarFoto(foto)} disabled={ordenando}>
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel__intro">Todavía no hay fotos cargadas.</p>
          )}

          <form className="panel__form" onSubmit={subirFoto}>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-foto`}>
                Agregar una foto
              </label>
              <input className="field__control" type="file" id={`${id}-foto`} name="foto" accept="image/jpeg,image/png,image/webp" required />
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`${id}-alt`}>
                Descripción de la imagen <span className="field__optional">(opcional)</span>
              </label>
              <input className="field__control" id={`${id}-alt`} name="alt" maxLength={160} />
            </div>
            <button type="submit" className="button button--outline" disabled={subiendo}>
              {subiendo ? 'Subiendo…' : 'Subir foto'}
            </button>
          </form>
        </>
      ) : null}
    </>
  );
}
