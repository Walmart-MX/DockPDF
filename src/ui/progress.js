/**
 * ui/progress.js
 *
 * Responsabilidad:
 *   Pintar la fila de estado "PDF pendiente/listo" y "Datos pendientes/
 *   listos" que vive debajo del header (ver index.html #progress-row).
 *   Puramente visual — no decide nada, solo refleja los booleanos que le
 *   pasa main.js en cada refresh().
 *
 * No puede:
 *   - calcular si el PDF o los datos están listos (eso lo decide main.js,
 *     que conoce pdfFile y las assignments).
 */
import { iconCheckCircle } from './icons.js';

const pendingIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>';

function setItem(id, done, pendingLabel, doneLabel) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'progress-item' + (done ? ' is-done' : '');
  el.innerHTML = (done ? iconCheckCircle() : pendingIcon) + ' ' + (done ? doneLabel : pendingLabel);
}

/**
 * @param {boolean} pdfReady
 * @param {boolean} dataReady
 */
export function renderProgress(pdfReady, dataReady) {
  setItem('progress-pdf', pdfReady, 'PDF pendiente', 'PDF listo');
  setItem('progress-data', dataReady, 'Datos pendientes', 'Datos listos');
}
