/**
 * config/features.js
 *
 * Responsabilidad:
 *   Un solo interruptor para toda la capa de "calendario operativo /
 *   selector de día / registro compartido en Supabase". Si en la práctica
 *   esto no aporta valor, se apaga cambiando UNA línea aquí — nada más en
 *   el proyecto necesita tocarse, ni siquiera revertir commits.
 *
 * Cómo se usa:
 *   - Cualquier módulo nuevo de esta funcionalidad (ui/dayContext.js,
 *     services/supabaseClient.js, etc.) debe consultar
 *     isCalendarFeatureEnabled() antes de hacer cualquier cosa visible o
 *     de red — nunca asumir que está activo.
 *   - main.js solo llama a la wiring de esta funcionalidad si
 *     isCalendarFeatureEnabled() es true.
 *
 * Dos niveles de apagado, independientes:
 *   1. Manual: CALENDAR_FEATURE_ENABLED = false aquí abajo.
 *   2. Automático: si no hay URL/anon key de Supabase configuradas (ver
 *      config/supabase.js), la función también devuelve false — así el
 *      proyecto funciona igual que hoy con solo NO configurar Supabase,
 *      sin tener que acordarse de tocar este archivo.
 */

const CALENDAR_FEATURE_ENABLED = true;

/**
 * @returns {boolean}
 */
export function isCalendarFeatureEnabled() {
  if (!CALENDAR_FEATURE_ENABLED) return false;
  // La comprobación de configuración de Supabase se agrega en la Fase 3
  // (cuando exista config/supabase.js) — por ahora, sin Supabase todavía,
  // esta función solo refleja el interruptor manual.
  return true;
}
