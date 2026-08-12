/**
 * domain/unification.js
 *
 * Responsabilidad:
 *   Determinar si dos registros (ruta+tractor+caja) deben unificarse en un
 *   mismo archivo CP/FITO. Idéntico a RULES/shouldUnify de index.html v1.0
 *   — se mueve tal cual, sin cambiar el orden ni el criterio de las reglas.
 *
 * Entrada:
 *   a, b: { ruta, tractor, caja, cert }
 *
 * Salida:
 *   boolean
 *
 * No puede:
 *   - acceder al DOM
 *   - mostrar toasts
 *   - depender de pdf.js/pdf-lib
 *
 * Nota: la Regla 4 (fallback) es un comportamiento legado documentado desde
 * la versión original — mismo tractor sin info de caja se unifica por
 * default. No se "limpia" en esta extracción, se preserva a propósito.
 */

export const RULES = [
  // Regla 1: tractores distintos → nunca unificar
  (a, b) => (a.tractor !== b.tractor ? false : null),
  // Regla 2: mismo tractor + misma caja → segundo viaje / económico → NO unificar
  (a, b) => (a.caja && b.caja && a.caja === b.caja ? false : null),
  // Regla 3: mismo tractor + caja distinta → unificar
  (a, b) => (a.caja && b.caja && a.caja !== b.caja ? true : null),
  // Regla 4: fallback — mismo tractor, sin info de caja → unificar (comportamiento legado)
  () => true,
];

export function shouldUnify(a, b) {
  for (const rule of RULES) {
    const r = rule(a, b);
    if (r !== null) return r;
  }
  return true;
}
