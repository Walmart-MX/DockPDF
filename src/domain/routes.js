/**
 * domain/routes.js
 *
 * Responsabilidad:
 *   Parsear listas de rutas escritas por el usuario y validar la
 *   correspondencia entre páginas del PDF y archivos esperados. Contiene
 *   la lógica que en index.html v1.0 vivía embebida dentro de refresh()
 *   (parseList ya existía suelta; evaluatePageMatch/computeMismatchWarnings
 *   son la misma lógica de esa función, movida tal cual sin cambiar
 *   ningún mensaje ni criterio).
 *
 * Entrada / Salida: ver JSDoc de cada función.
 *
 * No puede:
 *   - acceder al DOM
 *   - decidir CÓMO se muestra un mensaje (colores, iconos de UI) — solo
 *     devuelve el estado/los textos, la capa ui/preview.js decide el resto
 */

/**
 * Convierte el texto de una textarea (una ruta por línea o separadas por
 * coma) en un array de rutas limpias, sin vacíos.
 * @param {string} raw
 * @returns {string[]}
 */
export function parseList(raw) {
  return raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * @typedef {Object} PageMatchResult
 * @property {'none'|'ok'|'warn'|'error'} state
 * @property {number} [diff] - presente solo en 'warn' y 'error'
 */

/**
 * Compara páginas reales del PDF contra archivos esperados (assignments).
 * Mismos tres estados que index.html v1.0 (coincide / sobran / faltan).
 *
 * @param {number} totalPages - páginas reales del PDF
 * @param {number} totalAssignments - archivos que se van a generar
 * @returns {PageMatchResult}
 */
export function evaluatePageMatch(totalPages, totalAssignments) {
  if (!(totalPages > 0 && totalAssignments > 0)) return { state: 'none' };
  if (totalAssignments === totalPages) return { state: 'ok' };
  if (totalAssignments < totalPages) return { state: 'warn', diff: totalPages - totalAssignments };
  return { state: 'error', diff: totalAssignments - totalPages };
}

/**
 * Calcula los mensajes de advertencia inline (rutas FITO no encontradas en
 * la lista general, páginas sobrantes o faltantes). Mismos textos exactos
 * que index.html v1.0, incluyendo los prefijos ⚠/⛔ que la UI usa para
 * decidir el estilo del contenedor.
 *
 * @param {{allRoutes:string[], fitoRoutes:string[], totalPages:number, totalAssignments:number}} params
 * @returns {string[]}
 */
export function computeMismatchWarnings({ allRoutes, fitoRoutes, totalPages, totalAssignments }) {
  const allSet = new Set(allRoutes);
  const unknownFito = fitoRoutes.filter((r) => !allSet.has(r));
  const warns = [];

  if (unknownFito.length) {
    warns.push(`⚠ Rutas FITO no encontradas en lista general: ${unknownFito.join(', ')}`);
  }
  if (totalPages > 0 && totalAssignments !== totalPages) {
    if (totalAssignments < totalPages) {
      warns.push(`⚠ ${totalPages - totalAssignments} página(s) al final del PDF quedarán sin nombre.`);
    } else {
      warns.push(`⛔ Faltan ${totalAssignments - totalPages} página(s) — el PDF tiene ${totalPages} y se esperan ${totalAssignments}.`);
    }
  }
  return warns;
}
