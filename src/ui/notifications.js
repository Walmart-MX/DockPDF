/**
 * ui/notifications.js
 *
 * Responsabilidad:
 *   Mostrar y descartar notificaciones toast. Idéntico a toast()/
 *   dismissToast() de index.html v1.0.
 *
 * Entrada / Salida: ver JSDoc de cada función.
 *
 * No puede:
 *   - saber nada de PDFs, rutas ni servicios — solo recibe strings.
 */

import { iconCheckCircle, iconAlertCircle, iconAlertTriangle, iconInfo } from './icons.js';

/**
 * @param {string} msg
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {string} [sub='']
 */
export function toast(msg, type = 'info', sub = '') {
  const container = document.getElementById('toast-container');
  const icons = { success: iconCheckCircle(), error: iconAlertCircle(), warning: iconAlertTriangle(), info: iconInfo() };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-icon">${icons[type] || icons.info}</div><div class="toast-body"><div class="toast-msg">${msg}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
  el.addEventListener('click', () => dismissToast(el));
  container.appendChild(el);
  setTimeout(() => dismissToast(el), 4000);
}

/**
 * @param {HTMLElement} el
 */
export function dismissToast(el) {
  el.classList.add('hiding');
  setTimeout(() => el.remove(), 200);
}
