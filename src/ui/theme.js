/**
 * ui/theme.js
 *
 * Responsabilidad:
 *   Alternar el atributo data-theme en <html> entre 'light' y 'dark', y
 *   recordar la preferencia en localStorage. Si el usuario nunca eligió
 *   nada, respeta prefers-color-scheme del sistema operativo.
 *
 * No puede:
 *   - saber nada de PDFs, rutas ni del resto de la app — es un módulo de
 *     presentación puro, reusable en cualquier pantalla futura.
 */

import { iconSun, iconMoon } from './icons.js';

const STORAGE_KEY = 'dispatchdock-theme';

function getPreferredTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.innerHTML = theme === 'dark' ? iconSun() : iconMoon();
}

/**
 * Aplica el tema guardado/preferido y conecta el botón de alternar.
 * Idempotente — se puede llamar una sola vez al boot de la app.
 */
export function initTheme() {
  applyTheme(getPreferredTheme());

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  });
}
