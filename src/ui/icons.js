/**
 * ui/icons.js
 *
 * Responsabilidad:
 *   Única fuente de iconos SVG inline de la aplicación. Reemplaza los
 *   emojis que usaban antes toasts, badges de estado, miniaturas y
 *   resultados por un set consistente estilo Lucide (stroke, sin relleno).
 *   Cada función devuelve un string de markup SVG listo para insertar vía
 *   innerHTML — no hay dependencia de ninguna librería externa ni CDN.
 *
 * Por qué existe:
 *   Antes de esto, cada módulo de ui/ tenía su propio mapa de emojis
 *   (notifications.js, manifest.js, thumbnails.js) — mezcla de estilos
 *   visuales (emoji de SO vs texto plano) y cero control sobre tamaño o
 *   color. Centralizarlo aquí da consistencia y permite que el ícono
 *   herede currentColor (se tiñe solo según el contexto donde se use).
 *
 * No puede:
 *   - saber nada de lógica de negocio, DOM real ni estado de la app —
 *     son funciones puras que devuelven texto.
 */

const svg = (paths, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

export const iconCheck = () => svg('<path d="M20 6L9 17l-5-5"/>');
export const iconCheckCircle = () => svg('<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>');
export const iconAlertTriangle = () => svg('<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>');
export const iconAlertCircle = () => svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>');
export const iconInfo = () => svg('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>');
export const iconX = () => svg('<path d="M18 6L6 18M6 6l12 12"/>');
export const iconFile = () => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>');
export const iconSun = () => svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
export const iconMoon = () => svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>');
