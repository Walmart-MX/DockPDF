/**
 * core/sanitize.js
 *
 * Responsabilidad:
 *   Escapar texto antes de insertarlo vía innerHTML, cuando ese texto
 *   proviene de datos del usuario (pegados desde Excel, nombres de ruta,
 *   nombres de archivo derivados de ellos, etc.).
 *
 * Por qué existe:
 *   Varios módulos de ui/ construyen HTML con template strings e insertan
 *   valores derivados de texto pegado por el usuario (rutas, nombres de
 *   archivo). Sin escapar, un valor como `<img src=x onerror=alert(1)>`
 *   pegado en la tabla de Excel viajaría tal cual hasta el DOM. Ver
 *   diagnostico-modularizacion-dispatchdock.md, sección de deuda técnica.
 *
 * No puede:
 *   - sanitizar HTML "rico" (no es un sanitizer tipo DOMPurify) — solo
 *     escapa los caracteres especiales para que el texto se muestre
 *     literalmente, nunca se interprete como marcado ni rompa un atributo.
 */

// Reemplazo manual por tabla — deliberadamente NO usamos el truco de
// textContent/innerHTML de un <span> desconectado: ese truco escapa
// &, < y > pero NO comillas, y varios usos en ui/ insertan el valor
// también dentro de atributos HTML (ej. download="${filename}"), donde
// una comilla sin escapar rompe el atributo y abre la puerta a inyectar
// markup o manejadores de evento adicionales.
const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * @param {string} value
 * @returns {string} mismo texto, con &, <, >, " y ' escapados — seguro
 *   tanto en contenido de texto como dentro de un atributo entrecomillado.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
