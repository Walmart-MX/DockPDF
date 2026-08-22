/**
 * services/identityService.js
 *
 * Responsabilidad:
 *   Nombre del usuario guardado localmente en el dispositivo (localStorage).
 *   No es una cuenta, no tiene contraseña, no se sincroniza — es
 *   exactamente lo que se decidió en el análisis: una etiqueta de texto
 *   libre para atribuir eventos, no una identidad gestionada.
 *
 * No puede:
 *   - hablar con Supabase ni con ningún servidor — esto es 100% local.
 *   - validar que el nombre sea "correcto" — cualquier texto no vacío es válido.
 */

const STORAGE_KEY = 'dispatchdock:userName';

/**
 * @returns {string|null}
 */
export function getStoredName() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // localStorage puede fallar en modo incógnito estricto — degradar sin reventar
  }
}

/**
 * @param {string} name
 */
export function setStoredName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Si no se puede guardar, la app sigue funcionando — solo se
    // preguntará el nombre de nuevo la próxima vez.
  }
}

/**
 * Saludo contextual según la hora del dispositivo.
 * @param {string} name
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getGreeting(name, date = new Date()) {
  const hour = date.getHours();
  const momento = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `${momento}, ${name}`;
}
