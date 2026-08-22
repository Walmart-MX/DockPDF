/**
 * ui/identity.js
 *
 * Responsabilidad:
 *   Pintar el prompt de "¿cómo te llamas?" (primera visita) o el saludo
 *   contextual (visitas siguientes) en el slot del topbar. Consume
 *   services/identityService.js para leer/guardar el nombre — este módulo
 *   no toca localStorage directamente.
 *
 * No puede:
 *   - saber nada de Supabase, calendario ni PDFs.
 *   - decidir SI debe mostrarse — main.js consulta
 *     config/features.js::isCalendarFeatureEnabled() antes de llamar a init().
 */

import { getStoredName, setStoredName, getGreeting } from '../services/identityService.js';
import { escapeHtml } from '../core/sanitize.js';

/**
 * Pinta el prompt o el saludo, según si ya hay un nombre guardado.
 * Idempotente — se puede llamar varias veces sin duplicar nada.
 */
export function initIdentity() {
  const name = getStoredName();
  if (name) {
    renderGreeting(name);
  } else {
    renderPrompt();
  }
}

function renderGreeting(name) {
  const slot = document.getElementById('identity-slot');
  slot.innerHTML = `<span class="identity-greeting">${escapeHtml(getGreeting(name))}</span>`;
}

function renderPrompt() {
  const slot = document.getElementById('identity-slot');
  slot.innerHTML = `
    <form class="identity-prompt" id="identity-form">
      <input class="identity-input" id="identity-input" type="text" placeholder="¿Cómo te llamas?" autocomplete="off" maxlength="40">
      <button class="identity-submit" type="submit">✓</button>
    </form>`;

  const form = document.getElementById('identity-form');
  const input = document.getElementById('identity-input');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    setStoredName(value);
    renderGreeting(value);
  });
}
