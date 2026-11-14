/**
 * Serializa datos estructurados para un `<script type="application/ld+json">`.
 *
 * JSON.stringify no basta: deja pasar `</script>` tal cual, y un texto que
 * venga de la base (el nombre de una comuna, por ejemplo) podría cerrar el
 * bloque y abrir un script propio. Como la CSP permite scripts inline, ese
 * script correría. Se escapan los caracteres que el HTML interpreta; el JSON
 * resultante es equivalente y los buscadores lo leen igual.
 */
export function jsonLd(datos: unknown): string {
  return JSON.stringify(datos)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
