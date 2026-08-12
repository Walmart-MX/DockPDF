/**
 * core/angle.js
 *
 * Responsabilidad:
 *   Normalizar un ángulo de rotación a un valor entre 0 y 359.
 *   Idéntico a normalizeAngle() en index.html v1.0 — se mueve tal cual.
 *
 * Entrada: a (number) — ángulo, puede ser negativo o mayor a 360
 * Salida: number — ángulo normalizado en [0, 360)
 *
 * No puede: nada más — es una función pura de una línea.
 */

export function normalizeAngle(a) {
  return ((a % 360) + 360) % 360;
}
