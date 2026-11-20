import {
  PDFDocument, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb,
  type PDFFont, type PDFImage, type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { site } from '@/data/site';
import { formatNumero } from './format';
import { MAX_FOTOS_COMERCIAL_PDF } from './ficha-limites';
import { fuentesPdf } from './ficha-pdf-fuentes';
import {
  ajustesVacios, bloquesDescripcion, candidatosDestacados, perfilFicha,
  type AjustesFichaComercial,
} from './ficha-comercial-contenido';
import type { MapaFicha } from './ficha-mapa';
import type { PdfImagen } from './ficha-pdf';
import type { PropiedadAdmin } from './propiedades';

export type OpcionesFichaComercialPdf = {
  fecha: string;
  imagenes: PdfImagen[];
  /** Lo que el panel ajustó para esta descarga. Sin ajustes, todo sale del aviso. */
  ajustes?: AjustesFichaComercial;
  /** Teselas del mapa ya descargadas. Sin mapa, la ficha se arma sin esa página. */
  mapa?: MapaFicha | null;
};

const W = 595.28;
const H = 841.89;
const M = 36;
const ANCHO = W - M * 2;
const azul = rgb(0.045, 0.18, 0.28);
const azulMedio = rgb(0.15, 0.32, 0.42);
const terracota = rgb(0.79, 0.34, 0.19);
const gris = rgb(0.36, 0.4, 0.43);
const grisClaro = rgb(0.91, 0.93, 0.94);
const fondo = rgb(0.955, 0.965, 0.97);
const blanco = rgb(1, 1, 1);

/** Ficha de venta/arriendo creada solo con campos públicos del inventario. */
export async function generarFichaComercialPdf(
  propiedad: PropiedadAdmin,
  opciones: OpcionesFichaComercialPdf,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fuentes = fuentesPdf();
  const regular = await pdf.embedFont(fuentes.regular, { subset: true });
  const bold = await pdf.embedFont(fuentes.titulos, { subset: true });
  const perfil = perfilFicha(propiedad, opciones.ajustes ?? ajustesVacios);
  const titulo = perfil.titulo;
  const fotos: PDFImage[] = [];
  for (const imagen of opciones.imagenes.slice(0, MAX_FOTOS_COMERCIAL_PDF)) {
    fotos.push(imagen.formato === 'png' ? await pdf.embedPng(imagen.bytes) : await pdf.embedJpg(imagen.bytes));
  }

  pdf.setTitle(`Ficha comercial ${site.nombre} CC-${propiedad.id} - ${titulo}`);
  pdf.setAuthor(site.nombre);
  pdf.setSubject('Ficha comercial de propiedad');
  pdf.setLanguage('es-CL');

  function limpiar(valor: string, fuente: PDFFont = regular): string {
    const disponibles = new Set(fuente.getCharacterSet());
    return Array.from(valor.normalize('NFC').replace(/[\u0000-\u001f]/g, ' '))
      .map((caracter) => disponibles.has(caracter.codePointAt(0)!) ? caracter : ' ').join('');
  }

  function lineas(valor: string, ancho: number, size: number, fuente: PDFFont = regular): string[] {
    const palabras = limpiar(valor, fuente).split(/\s+/).filter(Boolean);
    const resultado: string[] = [];
    let actual = '';
    for (const palabra of palabras) {
      if (fuente.widthOfTextAtSize(palabra, size) > ancho) {
        if (actual) { resultado.push(actual); actual = ''; }
        let parte = '';
        for (const letra of palabra) {
          if (parte && fuente.widthOfTextAtSize(parte + letra, size) > ancho) {
            resultado.push(parte);
            parte = '';
          }
          parte += letra;
        }
        actual = parte;
      } else if (actual && fuente.widthOfTextAtSize(`${actual} ${palabra}`, size) > ancho) {
        resultado.push(actual);
        actual = palabra;
      } else actual = actual ? `${actual} ${palabra}` : palabra;
    }
    if (actual) resultado.push(actual);
    return resultado;
  }

  function recortar(filas: string[], maximo: number, ancho: number, size: number, fuente: PDFFont) {
    if (filas.length <= maximo) return filas;
    const visibles = filas.slice(0, maximo);
    let ultimo = visibles[maximo - 1];
    while (ultimo && fuente.widthOfTextAtSize(`${ultimo}...`, size) > ancho) ultimo = ultimo.slice(0, -1);
    visibles[maximo - 1] = `${ultimo.trimEnd()}...`;
    return visibles;
  }

  function texto(pagina: PDFPage, valor: string, x: number, top: number, size: number, fuente = regular, color = gris) {
    pagina.drawText(limpiar(valor, fuente), { x, y: H - top - size, size, font: fuente, color });
  }

  function bloque(
    pagina: PDFPage, valor: string, x: number, top: number, ancho: number,
    size: number, fuente = regular, color = gris, maximo?: number, interlinea = 1.35,
  ) {
    const filas = lineas(valor, ancho, size, fuente);
    const visibles = maximo ? recortar(filas, maximo, ancho, size, fuente) : filas;
    visibles.forEach((fila, indice) => texto(pagina, fila, x, top + indice * size * interlinea, size, fuente, color));
    return visibles.length * size * interlinea;
  }

  function foto(pagina: PDFPage, imagen: PDFImage | undefined, x: number, top: number, ancho: number, alto: number) {
    pagina.drawRectangle({ x, y: H - top - alto, width: ancho, height: alto, color: fondo });
    if (!imagen) return;
    const escala = Math.max(ancho / imagen.width, alto / imagen.height);
    const width = imagen.width * escala;
    const height = imagen.height * escala;
    // Recorte al marco; la imagen nunca invade otra celda de la galería.
    pagina.pushOperators(pushGraphicsState(), rectangle(x, H - top - alto, ancho, alto), clip(), endPath());
    pagina.drawImage(imagen, {
      x: x + (ancho - width) / 2,
      y: H - top - alto + (alto - height) / 2,
      width, height,
    });
    pagina.pushOperators(popGraphicsState());
  }

  function pagina(etiqueta: string) {
    const p = pdf.addPage([W, H]);
    p.drawSvgPath('M98.05 39 A47 47 0 1 0 98.05 81 L76 81 A29 29 0 1 1 76 39 Z',
      { x: M, y: H - 23, scale: 0.34, color: azul });
    p.drawLine({ start: { x: M + 19, y: H - 24 }, end: { x: M + 19, y: H - 63 }, thickness: 0.55, color: azul });
    p.drawLine({ start: { x: M, y: H - 43.4 }, end: { x: M + 35, y: H - 43.4 }, thickness: 0.55, color: azul });
    p.drawRectangle({ x: M + 33.3, y: H - 43.7, width: 4.8, height: 4.8, color: terracota });
    p.drawLine({ start: { x: M + 47, y: H - 29 }, end: { x: M + 47, y: H - 59 }, thickness: 0.65, color: azul });
    texto(p, 'COTA CLARA', M + 59, 28, 19, bold, azul);
    texto(p, 'PATRIMONIO INMOBILIARIO', M + 60, 51, 7.5, regular, azul);
    bloque(p, propiedad.comuna.toLocaleUpperCase('es-CL'), W - M - 150, 29, 150, 9, bold, azul, 2);
    texto(p, `CC-${propiedad.id}  |  ${opciones.fecha}`, W - M - 150, 58, 8);
    p.drawLine({ start: { x: M, y: H - 84 }, end: { x: W - M, y: H - 84 }, thickness: 0.7, color: grisClaro });
    p.drawLine({ start: { x: M, y: H - 84 }, end: { x: M + 28, y: H - 84 }, thickness: 1.5, color: terracota });
    p.drawLine({ start: { x: M, y: H - 795 }, end: { x: W - M, y: H - 795 }, thickness: 0.7, color: grisClaro });
    texto(p, site.lema, M, 805, 7.5, bold, azul);
    texto(p, etiqueta.toLocaleUpperCase('es-CL'), W / 2 - 34, 805, 6.5, regular, gris);
    texto(p, String(pdf.getPageCount()).padStart(2, '0'), W - M - 15, 803, 8, bold, azul);
    if (propiedad.estado !== 'PUBLICADA') texto(p, 'BORRADOR', W - M - 78, 100, 8, bold, terracota);
    return p;
  }

  // ─── Portada ───

  const portada = pagina('Ficha comercial');
  bloque(portada, perfil.encabezado.toLocaleUpperCase('es-CL'), M, 103, ANCHO - 90, 8, bold, terracota, 1);
  const alturaSegmento = perfil.segmento ? 13 : 0;
  if (perfil.segmento) bloque(portada, perfil.segmento, M, 116, ANCHO - 90, 8.5, regular, azulMedio, 1);
  const tituloTop = 124 + alturaSegmento;
  let tituloSize = 24;
  while (tituloSize > 16 && lineas(titulo, ANCHO, tituloSize, bold).length > 3) tituloSize -= 1;
  const tituloRecortado = lineas(titulo, ANCHO, tituloSize, bold).length > 4;
  const tituloAlto = bloque(portada, titulo, M, tituloTop, ANCHO, tituloSize, bold, azul, 4, 1.22);
  const bajadaTop = tituloTop + tituloAlto + 6;
  const bajadaAlto = perfil.bajada ? bloque(portada, perfil.bajada, M, bajadaTop, ANCHO, 10.5, regular, gris, 3) : 0;
  const fotoTop = Math.max(205 + alturaSegmento, bajadaTop + bajadaAlto + 14);
  const fotoAlto = Math.max(175, 462 - fotoTop);
  if (fotos.length >= 3) {
    const principal = ANCHO * 0.67;
    const lateral = ANCHO - principal - 8;
    foto(portada, fotos[0], M, fotoTop, principal, fotoAlto);
    foto(portada, fotos[1], M + principal + 8, fotoTop, lateral, (fotoAlto - 8) / 2);
    foto(portada, fotos[2], M + principal + 8, fotoTop + (fotoAlto + 8) / 2, lateral, (fotoAlto - 8) / 2);
  } else if (fotos.length === 2) {
    foto(portada, fotos[0], M, fotoTop, ANCHO * 0.62, fotoAlto);
    foto(portada, fotos[1], M + ANCHO * 0.62 + 8, fotoTop, ANCHO * 0.38 - 8, fotoAlto);
  } else if (fotos.length === 1) foto(portada, fotos[0], M, fotoTop, ANCHO, fotoAlto);
  else {
    foto(portada, undefined, M, fotoTop, ANCHO, fotoAlto);
    portada.drawRectangle({ x: M, y: H - fotoTop - fotoAlto, width: 5, height: fotoAlto, color: terracota });
    texto(portada, 'La propiedad, a tu alcance.', M + 26, fotoTop + fotoAlto / 2 - 22, 17, bold, azul);
    texto(portada, 'Solicita imágenes y coordina una visita.', M + 26, fotoTop + fotoAlto / 2 + 4, 10);
  }

  if (perfil.pilares.length) {
    const n = Math.min(perfil.pilares.length, 4);
    perfil.pilares.slice(0, n).forEach(({ valor, etiqueta }, indice) => {
      const x = M + indice * ANCHO / n;
      if (indice) portada.drawLine({ start: { x: x - 9, y: H - 486 }, end: { x: x - 9, y: H - 527 }, thickness: 0.6, color: grisClaro });
      texto(portada, valor, x, 481, valor.length > 9 ? 16 : 21, bold, azul);
      bloque(portada, etiqueta, x, 508, ANCHO / n - 12, 8.5, regular, gris, 1);
    });
  } else texto(portada, 'Consulta los detalles de esta propiedad con Cota Clara.', M, 493, 11, regular, azul);

  const destacadosPortada = perfil.destacados.filter((destacado) =>
    lineas(destacado, ANCHO / 2 - 28, 9.2, bold).length === 1);
  if (destacadosPortada.length) {
    portada.drawLine({ start: { x: M, y: H - 538 }, end: { x: W - M, y: H - 538 }, thickness: 0.6, color: grisClaro });
    destacadosPortada.forEach((destacado, indice) => {
      const x = M + (indice % 2) * ANCHO / 2;
      const y = 551 + Math.floor(indice / 2) * 26;
      texto(portada, '+', x, y - 2, 13, bold, terracota);
      bloque(portada, destacado, x + 16, y, ANCHO / 2 - 28, 9.2, bold, azul, 1);
    });
  }

  portada.drawRectangle({ x: M, y: H - 735, width: ANCHO, height: 83, color: azul });
  perfil.precios.forEach(([etiqueta, valor], indice) => {
    const columna = ANCHO / perfil.precios.length;
    const x = M + indice * columna + 14;
    if (indice) portada.drawLine({ start: { x: x - 11, y: H - 666 }, end: { x: x - 11, y: H - 722 }, thickness: 0.6, color: azulMedio });
    bloque(portada, etiqueta, x, 668, columna - 27, 7, bold, blanco, 1);
    let size = perfil.precios.length === 3 ? 17 : 21;
    while (size > 11 && bold.widthOfTextAtSize(limpiar(valor, bold), size) > columna - 27) size -= 0.5;
    texto(portada, valor, x, 691, size, bold, blanco);
  });
  bloque(portada, perfil.notaPrecio, M + 14, 721, ANCHO - 28, 6.5, regular, blanco, 1);
  texto(portada, perfil.cierre.titulo, M, 748, 14, bold, azul);
  texto(portada, `${site.telefono}   |   ${site.email}`, M, 771, 9, regular, gris);

  // ─── Ubicación ───

  const mapa = opciones.mapa;
  if (mapa) {
    const paginaMapa = pagina('Ubicación');
    texto(paginaMapa, 'DÓNDE ESTÁ', M, 104, 8, bold, terracota);
    texto(paginaMapa, 'La ubicación de la propiedad.', M, 124, 23, bold, azul);
    bloque(paginaMapa, perfil.ubicacion, M, 160, ANCHO, 10, regular, gris, 2);
    paginaMapa.drawLine({ start: { x: M, y: H - 190 }, end: { x: W - M, y: H - 190 }, thickness: 0.65, color: grisClaro });
    const mapaTop = 198;
    const celda = ANCHO / mapa.columnas;
    const mapaAlto = celda * mapa.filas;
    paginaMapa.drawRectangle({ x: M, y: H - mapaTop - mapaAlto, width: ANCHO, height: mapaAlto, color: fondo });
    paginaMapa.pushOperators(pushGraphicsState(), rectangle(M, H - mapaTop - mapaAlto, ANCHO, mapaAlto), clip(), endPath());
    for (const tesela of mapa.teselas) {
      const imagen = await pdf.embedPng(tesela.bytes);
      paginaMapa.drawImage(imagen, {
        x: M + tesela.columna * celda,
        y: H - mapaTop - (tesela.fila + 1) * celda,
        width: celda,
        height: celda,
      });
    }
    // El pin va dentro del recorte: nunca se dibuja fuera del marco del mapa.
    const pinX = M + mapa.pinX * ANCHO;
    const pinY = H - mapaTop - mapa.pinY * mapaAlto;
    paginaMapa.drawCircle({ x: pinX, y: pinY, size: 11, color: blanco, opacity: 0.85 });
    paginaMapa.drawCircle({ x: pinX, y: pinY, size: 7.5, color: terracota });
    paginaMapa.drawCircle({ x: pinX, y: pinY, size: 2.6, color: blanco });
    paginaMapa.pushOperators(popGraphicsState());
    paginaMapa.drawRectangle({
      x: M, y: H - mapaTop - mapaAlto, width: ANCHO, height: mapaAlto,
      borderColor: grisClaro, borderWidth: 0.8,
    });
    const bajoMapa = mapaTop + mapaAlto + 16;
    texto(paginaMapa, 'Ubicación referencial', M, bajoMapa, 9.5, bold, azul);
    bloque(paginaMapa,
      'El punto marca el sector de la propiedad; la dirección exacta se entrega al coordinar la visita.',
      M, bajoMapa + 15, ANCHO * 0.66, 9.5, regular, gris, 2);
    texto(paginaMapa, 'Coordenadas', M + ANCHO * 0.7, bajoMapa, 9.5, bold, azul);
    texto(paginaMapa, `${formatNumero(mapa.latitud, 5)}, ${formatNumero(mapa.longitud, 5)}`, M + ANCHO * 0.7, bajoMapa + 15, 9.5);
    texto(paginaMapa, mapa.atribucion, M, Math.min(bajoMapa + 46, 778), 7.5, regular, gris);
  }

  // ─── Fotos y detalles ───

  const adicionales = fotos.slice(3);
  const bloquesTexto = bloquesDescripcion(propiedad, perfil.bajada);
  const otrosDestacados = candidatosDestacados(propiedad).filter((candidato) =>
    !destacadosPortada.some((destacado) => destacado.toLocaleLowerCase('es-CL') === candidato.toLocaleLowerCase('es-CL')));
  const bajadaRecortada = !!perfil.bajada && lineas(perfil.bajada, ANCHO, 10.5).length > 3;
  const tieneTexto = tituloRecortado || bloquesTexto.length || otrosDestacados.length || perfil.datos.length || bajadaRecortada;
  if (adicionales.length || tieneTexto) {
    let y = 0;
    function nuevaPagina(tituloPagina = 'Más sobre esta propiedad.') {
      const nueva = pagina('Espacios y detalles');
      texto(nueva, 'CONOCE LA PROPIEDAD', M, 104, 8, bold, terracota);
      texto(nueva, tituloPagina, M, 124, 23, bold, azul);
      bloque(nueva, perfil.ubicacion, M, 160, ANCHO, 10, regular, gris, 2);
      nueva.drawLine({ start: { x: M, y: H - 190 }, end: { x: W - M, y: H - 190 }, thickness: 0.65, color: grisClaro });
      y = 207;
      return nueva;
    }
    let detallePagina!: PDFPage;
    function asegurar(alto: number) {
      if (y + alto > 754) detallePagina = nuevaPagina();
    }
    function seccion(tituloSeccion: string) {
      asegurar(47);
      texto(detallePagina, tituloSeccion.toLocaleUpperCase('es-CL'), M, y, 8.5, bold, terracota);
      y += 24;
    }
    function parrafo(valor: string, size = 10.5, fuente = regular, color = gris, sangria = 0) {
      const filas = lineas(valor, ANCHO - sangria, size, fuente);
      for (const fila of filas) {
        asegurar(17);
        texto(detallePagina, fila, M + sangria, y, size, fuente, color);
        y += size * 1.43;
      }
      y += 6;
    }
    for (let i = 0; i < adicionales.length; i += 3) {
      const grupo = adicionales.slice(i, i + 3);
      detallePagina = nuevaPagina('Más espacios para descubrir.');
      const topGaleria = y;
      if (grupo.length === 3) {
        foto(detallePagina, grupo[0], M, topGaleria, ANCHO * 0.61, 503);
        foto(detallePagina, grupo[1], M + ANCHO * 0.61 + 8, topGaleria, ANCHO * 0.39 - 8, 247.5);
        foto(detallePagina, grupo[2], M + ANCHO * 0.61 + 8, topGaleria + 255.5, ANCHO * 0.39 - 8, 247.5);
      } else if (grupo.length === 2) {
        foto(detallePagina, grupo[0], M, topGaleria, (ANCHO - 8) / 2, 503);
        foto(detallePagina, grupo[1], M + (ANCHO + 8) / 2, topGaleria, (ANCHO - 8) / 2, 503);
      } else foto(detallePagina, grupo[0], M, topGaleria, ANCHO, 503);
      texto(detallePagina, 'Fotografías del aviso de la propiedad.', M, 725, 8.5, regular, gris);
    }
    if (tieneTexto) detallePagina = nuevaPagina();
    if (tituloRecortado) {
      seccion('Nombre de la propiedad');
      parrafo(titulo);
    }
    if (bajadaRecortada) {
      seccion('En pocas palabras');
      parrafo(perfil.bajada);
    }
    if (bloquesTexto.length) {
      seccion('Acerca de la propiedad');
      for (const bloqueTexto of bloquesTexto) {
        if (bloqueTexto.tipo === 'parrafo') parrafo(bloqueTexto.texto);
        else if (bloqueTexto.tipo === 'subtitulo') {
          asegurar(34);
          y += 4;
          texto(detallePagina, bloqueTexto.texto, M, y, 10.5, bold, azul);
          y += 20;
        } else if (bloqueTexto.tipo === 'item') {
          asegurar(20);
          texto(detallePagina, '+', M, y - 1, 11, bold, terracota);
          parrafo(bloqueTexto.texto, 10, regular, gris, 15);
        } else {
          const filas = lineas(bloqueTexto.valor, ANCHO - 160, 10);
          const alto = Math.max(20, filas.length * 14.3 + 6);
          asegurar(alto);
          bloque(detallePagina, bloqueTexto.etiqueta, M, y, 148, 9.5, bold, azul, 2);
          filas.forEach((fila, indice) => texto(detallePagina, fila, M + 160, y + indice * 14.3, 10, regular, gris));
          y += alto;
        }
      }
    }
    if (otrosDestacados.length) {
      seccion(destacadosPortada.length ? 'Más características' : 'Características');
      for (const caracteristica of otrosDestacados) {
        const filas = lineas(caracteristica, ANCHO - 24, 9.7, bold);
        asegurar(filas.length * 14 + 10);
        texto(detallePagina, '+', M, y - 1, 12, bold, terracota);
        filas.forEach((fila, indice) => texto(detallePagina, fila, M + 17, y + indice * 14, 9.7, bold, azul));
        y += filas.length * 14 + 10;
      }
    }
    if (perfil.datos.length) {
      seccion('Datos de la propiedad');
      for (const [etiqueta, valor] of perfil.datos) {
        const filas = lineas(valor, ANCHO - 188, 10);
        const alto = Math.max(27, filas.length * 14 + 11);
        asegurar(alto);
        texto(detallePagina, etiqueta, M, y, 9.5, regular, gris);
        filas.forEach((fila, indice) => texto(detallePagina, fila, M + 188, y + indice * 14, 10, bold, azul));
        y += alto;
        detallePagina.drawLine({ start: { x: M, y: H - y + 7 }, end: { x: W - M, y: H - y + 7 }, thickness: 0.5, color: grisClaro });
      }
    }
  }

  return pdf.save();
}
