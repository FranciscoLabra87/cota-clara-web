import { nombreTipo, tituloPropiedad, type Propiedad } from '@/data/properties';
import { site } from '@/data/site';
import { formatNumero, formatPrecio } from './format';
import type { FichaTecnica } from './ficha-tecnica';

export type FilaFicha = { etiqueta: string; valor: string };
export type SeccionFicha = { titulo: string; filas: FilaFicha[] };
const sinDato = 'No informado';
const texto = (v: string | undefined) => v?.trim() || sinDato;
const medida = (v: number | undefined, unidad: string) => v && v > 0 ? `${formatNumero(v, Number.isInteger(v) ? 0 : 2)} ${unidad}` : sinDato;
const monto = (v: number | undefined) => v == null ? sinDato : formatPrecio({ valor: v, moneda: 'CLP' });

/** Selección explícita de campos exportables: las notas nunca pasan a la versión cliente. */
export function presentarFicha(p: Propiedad & { id: number; estado: string }, f: FichaTecnica, interna: boolean) {
  const secciones: SeccionFicha[] = [
    { titulo: 'Identificación y condiciones', filas: [
      { etiqueta: 'Código', valor: `CC-${p.id}` },
      { etiqueta: 'Tipo / operación', valor: `${nombreTipo(p.tipo)} / ${p.operacion === 'venta' ? 'Venta' : 'Arriendo'}` },
      { etiqueta: 'Comuna / sector', valor: [p.comuna, p.sector].filter(Boolean).join(' / ') },
      { etiqueta: 'Precio publicado', valor: `${formatPrecio(p.precio)}${p.precio.periodo === 'mes' ? ' / mes' : ''}` },
      { etiqueta: 'Gastos comunes', valor: p.gastosComunes == null ? sinDato : `${monto(p.gastosComunes)} / mes` },
    ] },
    { titulo: 'Superficies y distribución', filas: [
      { etiqueta: 'Superficie útil', valor: medida(p.superficieUtil, 'm²') },
      { etiqueta: 'Superficie total', valor: medida(p.superficieTotal, 'm²') },
      { etiqueta: 'Terreno', valor: medida(p.terreno, 'm²') },
      { etiqueta: 'Frente / fondo', valor: `${medida(p.frente, 'm')} / ${medida(p.fondo, 'm')}` },
      { etiqueta: 'Dormitorios / baños', valor: `${p.dormitorios || sinDato} / ${p.banos || sinDato}` },
      { etiqueta: 'Estacionamientos / bodegas', valor: `${p.estacionamientos || sinDato} / ${p.bodegas || sinDato}` },
      { etiqueta: 'Piso / orientación', valor: `${p.piso ?? sinDato} / ${texto(p.orientacion)}` },
      { etiqueta: 'Año de construcción', valor: p.anio > 0 ? String(p.anio) : sinDato },
    ] },
    { titulo: 'Antecedentes técnicos y documentales', filas: [
      { etiqueta: 'Rol de avalúo SII', valor: texto(f.rolSii) },
      { etiqueta: 'Destino', valor: texto(f.destino) },
      { etiqueta: 'Avalúo fiscal', valor: monto(f.avaluoFiscal) },
      { etiqueta: 'Contribuciones', valor: f.contribuciones == null ? sinDato : `${monto(f.contribuciones)} / cuota trimestral` },
      { etiqueta: 'Materialidad', valor: texto(f.materialidad) },
      { etiqueta: 'Conservación / pisos', valor: `${texto(f.estadoConservacion)} / ${f.pisos ?? sinDato}` },
      { etiqueta: 'Calefacción', valor: texto(f.calefaccion) },
      { etiqueta: 'Recepción final', valor: texto(f.recepcionFinal) },
      { etiqueta: 'Inscripción CBR', valor: texto(f.inscripcion) },
    ] },
    { titulo: 'Trazabilidad de antecedentes', filas: [
      { etiqueta: 'Estado de revisión', valor: f.estadoAntecedentes || 'Pendientes' },
      { etiqueta: 'Fuente / documento', valor: texto(f.fuenteAntecedentes) },
      { etiqueta: 'Fecha de revisión', valor: f.fechaRevision ? f.fechaRevision.split('-').reverse().join('/') : sinDato },
      { etiqueta: 'Revisado por', valor: texto(f.revisadoPor) },
    ] },
  ];
  if (interna) secciones.push({ titulo: 'Uso interno · no compartir con clientes', filas: [
    { etiqueta: 'Estado en el sitio', valor: p.estado === 'PUBLICADA' ? 'Publicada' : 'Borrador' },
    { etiqueta: 'Observaciones internas', valor: texto(f.observaciones) },
  ] });
  return {
    titulo: tituloPropiedad(p),
    secciones,
    enlace: p.estado === 'PUBLICADA' ? `${site.url}/propiedades/${encodeURIComponent(p.slug)}` : null,
  };
}
