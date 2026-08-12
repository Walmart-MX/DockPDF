/**
 * ui/status.js
 *
 * Responsabilidad:
 *   Actualizar el badge de estado del topbar. Reemplaza la navegación de
 *   5 pasos de la versión anterior — en el rediseño no hay wizard, solo un
 *   indicador de lectura rápida ("¿en qué punto estoy?").
 *
 * No puede:
 *   - saber nada de PDFs, rutas ni dominio — solo recibe texto y un tono.
 */

const TONE_CLASSES = ['tone-idle', 'tone-ready', 'tone-warn', 'tone-done'];

/**
 * @param {string} text
 * @param {'idle'|'ready'|'warn'|'done'} [tone='idle']
 */
export function setDeskStatus(text, tone = 'idle') {
  const el = document.getElementById('desk-status');
  el.textContent = text;
  el.classList.remove(...TONE_CLASSES);
  el.classList.add('tone-' + tone);
}
