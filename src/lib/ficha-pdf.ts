import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fuentesPdf } from './ficha-pdf-fuentes';
import { presentarFicha } from './ficha-presentacion';
import { formatNumero, formatPrecio } from './format';
import { site } from '@/data/site';
import type { PropiedadAdmin } from './propiedades';
import type { FichaTecnica } from './ficha-tecnica';

export type PdfImagen = { bytes: Uint8Array; formato: 'jpg' | 'png' };
export type OpcionesFichaPdf = { interna: boolean; fecha: string; imagenes: PdfImagen[] };
const W = 595.28, H = 841.89, M = 36, ANCHO = W - M * 2;
const azul = rgb(0.043, 0.184, 0.29), terra = rgb(0.776, 0.353, 0.196);
const gris = rgb(0.34, 0.38, 0.42), borde = rgb(0.88, 0.9, 0.91), blanco = rgb(1, 1, 1);

/** PDF de imprenta: texto y marca vectoriales, fuentes embebidas y fotos del inventario. */
export async function generarFichaPdf(p: PropiedadAdmin, antecedentes: FichaTecnica, opciones: OpcionesFichaPdf): Promise<Uint8Array> {
  // Construir desde lista permitida; la variante cliente jamás recibe las notas en sus secciones.
  const ficha = presentarFicha(p, antecedentes, opciones.interna);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fuentes = fuentesPdf();
  const regular = await pdf.embedFont(fuentes.regular, { subset: true });
  const bold = await pdf.embedFont(fuentes.titulos, { subset: true });
  pdf.setTitle(`Ficha ${site.nombre} CC-${p.id} - ${ficha.titulo}`);
  pdf.setAuthor(site.nombre);
  pdf.setSubject(opciones.interna ? 'Ficha de uso interno' : 'Ficha comercial para visitas');
  pdf.setLanguage('es-CL');
  const fotos: PDFImage[] = [];
  for (const foto of opciones.imagenes) {
    fotos.push(foto.formato === 'png' ? await pdf.embedPng(foto.bytes) : await pdf.embedJpg(foto.bytes));
  }

  // Evita controles y glifos no incluidos en la fuente, sin introducir fallos de exportación.
  function limpio(texto: string, fuente = regular) {
    const caracteres = new Set(fuente.getCharacterSet());
    return Array.from(texto.normalize('NFC').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' '))
      .map((c) => caracteres.has(c.codePointAt(0)!) ? c : c === '\n' ? '\n' : ' ').join('');
  }
  function lineas(texto: string, ancho: number, size: number, fuente: PDFFont = regular) {
    const resultado: string[] = [];
    for (const parrafo of limpio(texto, fuente).split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        if (fuente.widthOfTextAtSize(palabra, size) > ancho) {
          if (actual) { resultado.push(actual); actual = ''; }
          let trozo = '';
          for (const c of palabra) {
            if (fuente.widthOfTextAtSize(trozo + c, size) > ancho && trozo) { resultado.push(trozo); trozo = ''; }
            trozo += c;
          }
          actual = trozo;
        } else if (actual && fuente.widthOfTextAtSize(`${actual} ${palabra}`, size) > ancho) {
          resultado.push(actual); actual = palabra;
        } else actual = actual ? `${actual} ${palabra}` : palabra;
      }
      resultado.push(actual);
    }
    return resultado;
  }
  function texto(page: PDFPage, valor: string, x: number, top: number, size = 11, fuente = regular, color = gris) {
    page.drawText(limpio(valor, fuente), { x, y: H - top - size, size, font: fuente, color });
  }
  function bloque(page: PDFPage, valor: string, x: number, top: number, ancho: number, size = 11, fuente = regular, color = gris, maxLineas?: number) {
    let filas = lineas(valor, ancho, size, fuente);
    if (maxLineas && filas.length > maxLineas) {
      filas = filas.slice(0, maxLineas);
      while (fuente.widthOfTextAtSize(filas[filas.length - 1] + '...', size) > ancho) filas[filas.length - 1] = filas[filas.length - 1].slice(0, -1);
      filas[filas.length - 1] += '...';
    }
    filas.forEach((fila, i) => texto(page, fila, x, top + i * size * 1.4, size, fuente, color));
    return filas.length * size * 1.4;
  }
  function regla(page: PDFPage, top: number, color = borde) {
    page.drawLine({ start: { x: M, y: H - top }, end: { x: W - M, y: H - top }, thickness: 0.65, color });
  }
  function nueva(etiqueta: string) {
    const page = pdf.addPage([W, H]);
    page.drawSvgPath('M98.05 39 A47 47 0 1 0 98.05 81 L76 81 A29 29 0 1 1 76 39 Z', { x: M, y: H - 23, scale: 0.34, color: azul });
    page.drawLine({ start: { x: M + 19, y: H - 24 }, end: { x: M + 19, y: H - 63 }, thickness: 0.55, color: azul });
    page.drawLine({ start: { x: M, y: H - 43.4 }, end: { x: M + 35, y: H - 43.4 }, thickness: 0.55, color: azul });
    page.drawRectangle({ x: M + 33.3, y: H - 43.7, width: 4.8, height: 4.8, color: terra });
    page.drawLine({ start: { x: M + 47, y: H - 29 }, end: { x: M + 47, y: H - 59 }, thickness: 0.65, color: azul });
    texto(page, 'COTA CLARA', M + 59, 28, 19, bold, azul);
    texto(page, 'PATRIMONIO INMOBILIARIO', M + 60, 51, 7.5, regular, azul);
    bloque(page, p.comuna.toLocaleUpperCase('es-CL'), W - M - 145, 29, 145, 9, bold, azul, 2);
    texto(page, `CC-${p.id}  |  ${opciones.fecha}`, W - M - 145, 58, 8, regular, gris);
    regla(page, 83);
    page.drawLine({ start: { x: M, y: H - 83 }, end: { x: M + 28, y: H - 83 }, thickness: 1.1, color: terra });
    texto(page, etiqueta.toLocaleUpperCase('es-CL'), M, 100, 8, bold, terra);
    regla(page, H - 42);
    texto(page, `${site.telefono}  |  ${site.email}`, M, H - 57, 7.5, regular, azul);
    texto(page, site.lema, M, H - 29, 8, bold, azul);
    texto(page, opciones.interna ? 'USO INTERNO - CONFIDENCIAL' : 'FICHA COMERCIAL', 285, H - 28, 6.5, regular, gris);
    texto(page, String(pdf.getPageCount()).padStart(2, '0'), W - M - 15, H - 30, 9, bold, azul);
    if (p.estado !== 'PUBLICADA') texto(page, 'BORRADOR', W - M - 80, 100, 8, bold, terra);
    return page;
  }
  function fotoEn(page: PDFPage, foto: PDFImage, x: number, top: number, ancho: number, alto: number) {
    // Contener conserva el encuadre completo y evita cortar elementos de la propiedad.
    const escala = Math.min(ancho / foto.width, alto / foto.height);
    const width = foto.width * escala, height = foto.height * escala;
    page.drawRectangle({ x, y: H - top - alto, width: ancho, height: alto, color: rgb(.96,.97,.97) });
    page.drawImage(foto, { x: x + (ancho - width) / 2, y: H - top - alto + (alto - height) / 2, width, height });
  }

  const portada = nueva(`${p.operacion === 'venta' ? 'Venta' : 'Arriendo'} - ${p.comuna}`);
  let top = 125;
  top += bloque(portada, ficha.titulo, M, top, ANCHO, 25, bold, azul, 3) + 9;
  top += bloque(portada, p.resumen, M, top, ANCHO, 11, regular, gris, 3) + 17;
  const alturaFoto = Math.min(267, 495 - top);
  if (fotos[0]) fotoEn(portada, fotos[0], M, top, ANCHO, alturaFoto);
  else {
    portada.drawRectangle({ x: M, y: H - top - alturaFoto, width: ANCHO, height: alturaFoto, color: rgb(.96,.97,.97) });
    texto(portada, 'Fotografías disponibles al coordinar la visita', M + 25, top + alturaFoto / 2 - 6, 12, regular, azul);
  }
  top += alturaFoto + 20;
  const stats = [
    [p.dormitorios > 0 ? String(p.dormitorios) : '-', 'dormitorios'],
    [p.banos > 0 ? String(p.banos) : '-', 'baños'],
    [p.superficieUtil > 0 ? `${formatNumero(p.superficieUtil, Number.isInteger(p.superficieUtil) ? 0 : 2)} m²` : '-', 'útiles'],
    [p.superficieTotal > 0 ? `${formatNumero(p.superficieTotal, Number.isInteger(p.superficieTotal) ? 0 : 2)} m²` : '-', 'superficie total'],
  ];
  stats.forEach(([dato, label], i) => {
    const x = M + i * ANCHO / 4;
    texto(portada, dato, x, top, dato.length > 10 ? 15 : 21, bold, azul);
    texto(portada, label, x, top + 29, 9);
  });
  top += 64;
  const destacados = [...(p.estacionamientos > 0 ? [`${p.estacionamientos} estacionamiento${p.estacionamientos > 1 ? 's' : ''}`] : []), ...(p.bodegas > 0 ? [`${p.bodegas} bodega${p.bodegas > 1 ? 's' : ''}`] : []), ...p.caracteristicas].slice(0, 6);
  destacados.forEach((dato, i) => {
    const x = M + i % 2 * (ANCHO / 2), y = top + Math.floor(i / 2) * 21;
    texto(portada, '+', x, y - 1, 12, bold, terra);
    bloque(portada, dato, x + 15, y, ANCHO / 2 - 25, 9.5, bold, azul, 1);
  });
  top += Math.ceil(destacados.length / 2) * 21 + 19;

  const columnas: [string, string][] = [[p.operacion === 'arriendo' ? 'ARRIENDO' : 'VENTA', `${formatPrecio(p.precio)}${p.precio.periodo === 'mes' ? ' / mes' : ''}`]];
  if (p.gastosComunes != null) columnas.push(['GASTOS COMUNES / MES', formatPrecio({ valor: p.gastosComunes, moneda: 'CLP' })]);
  if (p.operacion === 'arriendo' && p.precio.moneda === 'CLP' && p.gastosComunes != null) columnas.push(['TOTAL MENSUAL DE REFERENCIA', formatPrecio({ valor: p.precio.valor + p.gastosComunes, moneda: 'CLP' })]);
  portada.drawRectangle({ x: M, y: H - top - 82, width: ANCHO, height: 82, color: azul });
  columnas.forEach(([label, dato], i) => {
    const x = M + 16 + i * ANCHO / columnas.length;
    texto(portada, label, x, top + 13, 6.5, bold, blanco);
    let size = columnas.length === 3 ? 18 : 22;
    while (bold.widthOfTextAtSize(dato, size) > ANCHO / columnas.length - 24) size -= .5;
    texto(portada, dato, x, top + 32, size, bold, blanco);
  });
  bloque(portada, p.operacion === 'arriendo' ? 'Gastos comunes variables. Consumos y condiciones de contratación se confirman con el corredor.' : 'Precio y disponibilidad sujetos a confirmación. Consulta honorarios y condiciones con el corredor.', M, top + 94, ANCHO, 8.5);
  bloque(portada, 'Antecedentes informativos: confirma superficies, documentación y estado actual al coordinar la visita.', M, top + 122, ANCHO, 8);

  // Galería opcional: se usan únicamente las imágenes seleccionadas, sin inventar nombres de ambientes.
  for (let i = 1; i < fotos.length; i += 2) {
    const page = nueva('Fotografías de la propiedad');
    texto(page, 'Conoce sus espacios.', M, 128, 24, bold, azul);
    texto(page, 'Imágenes seleccionadas del aviso de la propiedad.', M, 165, 11);
    fotoEn(page, fotos[i], M, 201, ANCHO, fotos[i + 1] ? 255 : 490);
    if (fotos[i + 1]) fotoEn(page, fotos[i + 1], M, 475, ANCHO, 255);
    texto(page, 'Confirma el estado actual y el equipamiento incluido al coordinar la visita.', M, 758, 8.5);
  }

  let page = nueva('Datos técnicos y condiciones'), y = 127;
  texto(page, 'Información para decidir.', M, y, 23, bold, azul); y += 45;
  function continuar(minimo: number) {
    if (y + minimo > H - 64) { page = nueva('Datos técnicos - continuación'); y = 130; }
  }
  const seccionesPdf = opciones.interna ? ficha.secciones : ficha.secciones
    .filter((s) => s.titulo !== 'Trazabilidad de antecedentes' || antecedentes.fuenteAntecedentes || antecedentes.fechaRevision || antecedentes.revisadoPor)
    .map((s) => ({ ...s, filas: s.filas.filter((f) => !['No informado', 'No informado / No informado'].includes(f.valor)) }))
    .filter((s) => s.filas.length);
  for (const seccion of seccionesPdf) {
    continuar(80);
    texto(page, seccion.titulo, M, y, 12, bold, azul); y += 24;
    for (const fila of seccion.filas) {
      const label = lineas(fila.etiqueta, 175, 10);
      const valor = lineas(fila.valor, ANCHO - 197, 10.5);
      const alto = Math.max(label.length * 14, valor.length * 14.7) + 10;
      continuar(alto);
      bloque(page, fila.etiqueta, M, y, 175, 10);
      bloque(page, fila.valor, M + 197, y, ANCHO - 197, 10.5, regular, azul);
      y += alto; regla(page, y - 8);
    }
    y += 16;
  }
  continuar(90);
  texto(page, 'Descripción y equipamiento', M, y, 12, bold, azul); y += 27;
  const descripcion = (p.descripcion.length ? p.descripcion : [p.resumen]).join('\n');
  for (const fila of lineas(descripcion, ANCHO, 11)) {
    continuar(17); texto(page, fila, M, y, 11); y += 16;
  }
  return pdf.save();
}
