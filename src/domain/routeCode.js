/**
 * domain/routeCode.js
 *
 * Responsabilidad:
 *   Decodificar un string de ruta (tal como sale de domain/assignments.js
 *   — "1301", "1301-1", "2101-2102") en sus componentes operativos: día
 *   operativo (primer dígito), WAVE (segundo dígito), número de ruta
 *   (últimos dos). Distingue dos usos del guión que hoy son ambiguos si
 *   no se separan explícitamente:
 *     - Unificación (domain/unification.js): dos códigos de 4 dígitos
 *       completos unidos, ej. "2101-2102" — dos rutas reales.
 *     - Partición/adicional: un código de 4 dígitos + un sufijo corto de
 *       1-2 dígitos, ej. "1301-1" — sigue siendo la ruta base "1301".
 *
 * Entrada / Salida: ver JSDoc de parseRouteCode().
 *
 * No puede:
 *   - acceder al DOM
 *   - saber nada de PDFs, Excel ni Supabase — recibe strings, devuelve datos.
 *   - decidir si dos rutas se unifican (eso ya pasó antes, en
 *     domain/unification.js — este módulo solo interpreta el resultado)
 *
 * Supuesto documentado (confirmado con ejemplos reales del usuario):
 *   para efectos de a qué día+WAVE pertenece un código, el sufijo después
 *   del guión (si es de 1-2 dígitos) es irrelevante — solo importa la
 *   parte de 4 dígitos antes del guión. No se distingue "partición real"
 *   de "ruta adicional" porque, para el propósito de este módulo (marcar
 *   a qué WAVE pertenece), es la misma decodificación.
 */

const WAVE_MIN = 1;
const WAVE_MAX = 4;
const OPERATIONAL_DAY_MIN = 1;
const OPERATIONAL_DAY_MAX = 7;

/**
 * @typedef {Object} DecodedBase
 * @property {string} code - el código de 4 dígitos decodificado
 * @property {number} operationalDay - 1-7 (sábado=1), o null si el dígito no es válido
 * @property {number} wave - 1-4, o null si el dígito no es válido
 * @property {string} routeNumber - últimos dos dígitos, tal cual (string, conserva ceros a la izquierda)
 * @property {boolean} valid - true si el código tiene 4 dígitos y día/WAVE están en rango
 */

/**
 * Decodifica un código base de 4 dígitos. No maneja guiones — eso lo hace
 * parseRouteCode().
 * @param {string} code4
 * @returns {DecodedBase}
 */
function decodeBase(code4) {
  if (!/^\d{4}$/.test(code4)) {
    return { code: code4, operationalDay: null, wave: null, routeNumber: null, valid: false };
  }
  const operationalDay = Number(code4[0]);
  const wave = Number(code4[1]);
  const routeNumber = code4.slice(2);
  const valid =
    operationalDay >= OPERATIONAL_DAY_MIN &&
    operationalDay <= OPERATIONAL_DAY_MAX &&
    wave >= WAVE_MIN &&
    wave <= WAVE_MAX;
  return { code: code4, operationalDay: valid ? operationalDay : null, wave: valid ? wave : null, routeNumber, valid };
}

/**
 * @typedef {Object} ParsedRouteCode
 * @property {'single'|'split'|'unified'|'invalid'} kind
 * @property {string} raw - el string original, sin modificar
 * @property {DecodedBase[]} bases - uno o dos elementos decodificados;
 *   para 'split' es un solo elemento (el sufijo no se decodifica, solo se
 *   conserva en splitSuffix); para 'unified' son dos, uno por cada ruta.
 * @property {string} [splitSuffix] - solo presente si kind === 'split'
 */

/**
 * Decodifica un código de ruta completo, tal como aparece en
 * domain/assignments.js (allRoutes / route de un Assignment).
 *
 * @param {string} raw
 * @returns {ParsedRouteCode}
 */
export function parseRouteCode(raw) {
  const trimmed = (raw || '').trim();
  const parts = trimmed.split('-');

  if (parts.length === 1) {
    const base = decodeBase(parts[0]);
    return { kind: base.valid ? 'single' : 'invalid', raw: trimmed, bases: [base] };
  }

  if (parts.length === 2) {
    const [first, second] = parts;
    if (/^\d{4}$/.test(second)) {
      // Unificación: dos códigos completos.
      const baseA = decodeBase(first);
      const baseB = decodeBase(second);
      const kind = baseA.valid && baseB.valid ? 'unified' : 'invalid';
      return { kind, raw: trimmed, bases: [baseA, baseB] };
    }
    if (/^\d{1,2}$/.test(second)) {
      // Partición/adicional: el sufijo no se decodifica, solo se conserva.
      const base = decodeBase(first);
      return { kind: base.valid ? 'split' : 'invalid', raw: trimmed, bases: [base], splitSuffix: second };
    }
  }

  return { kind: 'invalid', raw: trimmed, bases: [] };
}

/**
 * Dado un array de códigos de ruta (ej. el `allRoutes` que ya arma
 * excelTableParser), devuelve el set de WAVEs (1-4) que aparecen. Es la
 * función que alimenta directamente los 4 círculos W1-W4 de la UI.
 *
 * Códigos inválidos se ignoran silenciosamente aquí — quien llama puede
 * inspeccionar cada parseRouteCode() individualmente si necesita reportar
 * cuáles fallaron.
 *
 * @param {string[]} routeCodes
 * @returns {Set<number>}
 */
export function getWavesPresent(routeCodes) {
  const waves = new Set();
  for (const code of routeCodes) {
    const parsed = parseRouteCode(code);
    for (const base of parsed.bases) {
      if (base.valid) waves.add(base.wave);
    }
  }
  return waves;
}

/**
 * Igual que getWavesPresent pero también agrupa por día operativo — útil
 * cuando una sola acción de despacho mezcla códigos de más de un día.
 *
 * @param {string[]} routeCodes
 * @returns {Map<number, Set<number>>} día operativo (1-7) → set de WAVEs
 */
export function getWavesByOperationalDay(routeCodes) {
  const byDay = new Map();
  for (const code of routeCodes) {
    const parsed = parseRouteCode(code);
    for (const base of parsed.bases) {
      if (!base.valid) continue;
      if (!byDay.has(base.operationalDay)) byDay.set(base.operationalDay, new Set());
      byDay.get(base.operationalDay).add(base.wave);
    }
  }
  return byDay;
}
