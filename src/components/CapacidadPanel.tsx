import type { Capacidad } from '@/lib/capacidad';

const GIB = 1024 ** 3;
const FORMATO = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });

function peso(bytes: number): string {
  if (bytes < 1024) return `${FORMATO.format(bytes)} B`;
  if (bytes < 1024 ** 2) return `${FORMATO.format(bytes / 1024)} KiB`;
  if (bytes < GIB) return `${FORMATO.format(bytes / 1024 ** 2)} MiB`;
  return `${FORMATO.format(bytes / GIB)} GiB`;
}

function Barra({ usado, total, etiqueta }: { usado: number; total: number; etiqueta: string }) {
  const porcentaje = total > 0 ? Math.min(100, (usado / total) * 100) : 0;
  return (
    <div className="capacidad__barra" role="progressbar" aria-label={etiqueta} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(porcentaje)}>
      <span className="capacidad__barra-valor" style={{ width: `${porcentaje}%` }} />
    </div>
  );
}

export function CapacidadPanel({ datos }: { datos: Capacidad }) {
  return (
    <section className="capacidad" aria-labelledby="capacidad-titulo">
      <div className="capacidad__encabezado">
        <div>
          <h2 className="panel__subtitulo capacidad__titulo" id="capacidad-titulo">Utilización de espacio</h2>
          <p className="capacidad__intro">Estado de la base de datos, archivos y código. Las cifras se consultan al abrir este panel.</p>
        </div>
      </div>
      <div className="capacidad__grid">
        <article className="capacidad__tarjeta">
          <h3>Base de datos · D1</h3>
          <p className="capacidad__numero">{datos.d1 ? peso(datos.d1.bytes) : 'No disponible'}</p>
          {datos.d1 ? <Barra usado={datos.d1.bytes} total={datos.d1.limiteFree} etiqueta="Uso de D1 frente al límite del plan Free" /> : null}
          <p className="capacidad__detalle">Referencia: 500 MB por base en Workers Free; 10 GB en Paid.</p>
          <a href="https://developers.cloudflare.com/d1/platform/limits/" target="_blank" rel="noopener noreferrer">Ver límites D1</a>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Archivos · R2</h3>
          <p className="capacidad__numero">{datos.r2 ? `${datos.r2.completo ? '' : '≥ '}${peso(datos.r2.bytes)}` : 'No disponible'}</p>
          <p className="capacidad__detalle">{datos.r2 ? `${datos.r2.objetos} objetos${datos.r2.completo ? '' : ' contabilizados (total parcial)'}` : 'No pudimos leer el bucket.'}</p>
          {datos.r2 ? (
            <dl className="capacidad__desglose">
              <div><dt>Drive</dt><dd>{peso(datos.r2.bytesDrive)}</dd></div>
              <div><dt>Fotos y otros</dt><dd>{peso(datos.r2.bytesFotos)}</dd></div>
            </dl>
          ) : null}
          <p className="capacidad__detalle">R2 no tiene tope fijo por bucket. El plan incluye 10 GB-mes de almacenamiento Standard sin cargo.</p>
          <a href="https://developers.cloudflare.com/r2/pricing/" target="_blank" rel="noopener noreferrer">Ver precios R2</a>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Drive del equipo</h3>
          <p className="capacidad__numero">{datos.d1 ? `${peso(datos.d1.reservadoDrive)} / ${peso(datos.d1.cuotaDrive)}` : 'No disponible'}</p>
          {datos.d1 ? <Barra usado={datos.d1.reservadoDrive} total={datos.d1.cuotaDrive} etiqueta="Cuota ocupada del Drive" /> : null}
          <p className="capacidad__detalle">{datos.d1 ? `${datos.d1.archivosDrive} archivos registrados, incluidas las subidas en curso. ` : ''}Máximo por archivo: {peso(datos.maxArchivo)}.</p>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Código · GitHub</h3>
          <p className="capacidad__numero">{datos.github ? `≈ ${peso(datos.github.bytesAproximados)}` : 'No disponible'}</p>
          <p className="capacidad__detalle">Tamaño orientativo del repositorio. GitHub bloquea archivos individuales mayores de 100 MiB.</p>
          <a href="https://github.com/FranciscoLabra87/cota-clara-web" target="_blank" rel="noopener noreferrer">Abrir repositorio</a>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Correo · WireNet</h3>
          <p className="capacidad__numero">792 KB / 2 GB</p>
          <Barra usado={792_000} total={2_000_000_000} etiqueta="Espacio del hosting usado según la captura de cPanel" />
          <p className="capacidad__detalle">0 de 5 casillas creadas. Lectura de cPanel compartida el 17 de noviembre de 2026; consulta cPanel para el valor actual.</p>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Aplicación · Cloudflare Workers</h3>
          <p className="capacidad__numero">{datos.build?.workerBytes != null ? `${peso(datos.build.workerBytes)} / 64 MiB` : 'Límite 64 MiB'}</p>
          {datos.build?.workerBytes != null ? <Barra usado={datos.build.workerBytes} total={64 * 1024 ** 2} etiqueta="Tamaño del Worker frente al límite" /> : null}
          <p className="capacidad__detalle">Paquete sin comprimir, medido en la última compilación.</p>
          <a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank" rel="noopener noreferrer">Ver límites Workers</a>
        </article>

        <article className="capacidad__tarjeta">
          <h3>Recursos estáticos del sitio</h3>
          <p className="capacidad__numero">{datos.build ? peso(datos.build.assetsBytes) : 'No disponible'}</p>
          <p className="capacidad__detalle">{datos.build ? `${datos.build.assetsArchivos} archivos en la última compilación. El mayor pesa ${peso(datos.build.assetMaxBytes)}.` : 'La medición se incorpora en el próximo despliegue.'}</p>
          <p className="capacidad__detalle">Workers Free admite hasta 20.000 archivos estáticos, con máximo de 25 MiB por archivo.</p>
          <a href="https://developers.cloudflare.com/workers/platform/limits/" target="_blank" rel="noopener noreferrer">Ver límites de recursos</a>
        </article>
      </div>
    </section>
  );
}
