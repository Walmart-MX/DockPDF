/**
 * ui/toolsDrawer.js
 *
 * Responsabilidad:
 *   Mostrar/ocultar el cajón de herramientas de corrección de orientación.
 *   En el rediseño esto ya no es un "paso" obligatorio del wizard — es una
 *   herramienta que se queda oculta salvo que el usuario la pida, o que la
 *   detección de orientación encuentre un problema (mismo criterio
 *   "auto-abrir solo si hay advertencia" que tenía la versión anterior).
 *
 * No puede:
 *   - decidir CUÁNDO hay que abrirla automáticamente (main.js decide eso
 *     según el resultado de analyzeOrientation, y llama a openDrawer())
 */

export function openDrawer() {
  document.getElementById('tools-drawer').hidden = false;
}

export function closeDrawer() {
  document.getElementById('tools-drawer').hidden = true;
}

export function isDrawerOpen() {
  return !document.getElementById('tools-drawer').hidden;
}

export function toggleDrawer() {
  if (isDrawerOpen()) closeDrawer();
  else openDrawer();
}

/**
 * Marca/desmarca el botón "Herramientas" como visible y, opcionalmente,
 * con el acento de advertencia (cuando hay páginas por corregir).
 * @param {boolean} visible
 * @param {boolean} [hasWarning=false]
 */
export function setToolsToggleState(visible, hasWarning = false) {
  const btn = document.getElementById('tools-toggle');
  btn.classList.toggle('show', visible);
  btn.classList.toggle('has-warning', hasWarning);
}
