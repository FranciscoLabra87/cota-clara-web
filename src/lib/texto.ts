// Cómo se parte el texto de los campos de varias líneas del panel. Va aparte
// y sin dependencias para que lo usen igual el formulario, en el navegador, y
// la validación, en el servidor: si cada uno partiera a su manera, guardar
// una ficha sin tocarla podría cambiarla.

/** Una entrada por línea, sin líneas vacías. Para etiquetas y características. */
export const lineas = (valor: string) =>
  valor
    .replace(/\r/g, '')
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean);

/**
 * Párrafos separados por una línea en blanco. Los saltos de línea dentro de un
 * párrafo se respetan: una ficha puede poner «Dormitorios: 4» y «Baños: 3» en
 * líneas seguidas sin que cada una quede como un párrafo aparte.
 */
export const parrafos = (valor: string) =>
  valor
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean);
