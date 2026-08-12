/**
 * ui/thumbnails.js
 *
 * Responsabilidad:
 *   Renderizar la tira de miniaturas, manejar la selección de página y
 *   pintar los badges de advertencia/corrección. Idéntico al bloque de
 *   THUMBNAILS + ROTATION CONTROLS (parte de DOM) de index.html v1.0.
 *   selectedThumbPage era estado de módulo en el script original y sigue
 *   siéndolo aquí — es "exclusivamente UI" según el diagnóstico, así que
 *   vive encapsulado en este archivo en vez de en main.js.
 *
 * Entrada / Salida: ver JSDoc de cada función.
 *
 * Dependencias:
 *   - pdfHandle (de pdfReadService) se recibe como parámetro — este módulo
 *     no importa services/pdfReadService.js directamente, solo usa el
 *     método .renderThumbnail() del handle que le pasan.
 *
 * No puede:
 *   - decidir CUÁNTO rotar una página (eso vive en main.js, que conoce
 *     pageRotations) — solo pinta el ángulo que le indican.
 *   - mostrar toasts.
 */

let selectedThumbPage = null; // 0-based index — estado exclusivo de UI

/**
 * Renderiza la tira completa de miniaturas (placeholders primero, luego
 * cada una se completa de forma asíncrona).
 * @param {Object} pdfHandle - handle devuelto por pdfReadService.loadPdf
 * @param {number} totalPages
 */
export async function renderThumbnails(pdfHandle, totalPages) {
  const strip = document.getElementById('thumb-strip');
  strip.innerHTML = '';

  for (let i = 0; i < totalPages; i++) {
    const placeholder = document.createElement('div');
    placeholder.className = 'thumb-item';
    placeholder.id = `thumb-${i}`;
    placeholder.innerHTML = `<div class="thumb-canvas-wrap"><div class="thumb-loading"><div class="thumb-spinner"></div></div></div><div class="thumb-num">Pág.${i + 1}</div>`;
    placeholder.addEventListener('click', () => selectThumbPage(i));
    strip.appendChild(placeholder);

    renderOneThumbnail(pdfHandle, i);
  }
}

async function renderOneThumbnail(pdfHandle, idx) {
  const canvas = await pdfHandle.renderThumbnail(idx, 72);
  const item = document.getElementById(`thumb-${idx}`);
  if (!item) return;
  const wrap = item.querySelector('.thumb-canvas-wrap');
  wrap.innerHTML = '';
  wrap.appendChild(canvas);
}

/**
 * Selecciona una miniatura (resalta visualmente y sincroniza el <select>
 * de página individual).
 * @param {number} idx
 */
export function selectThumbPage(idx) {
  if (selectedThumbPage !== null) {
    const old = document.getElementById(`thumb-${selectedThumbPage}`);
    if (old) old.classList.remove('selected');
  }
  selectedThumbPage = idx;
  const el = document.getElementById(`thumb-${idx}`);
  if (el) {
    el.classList.add('selected');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  document.getElementById('page-select').value = idx;
}

/**
 * Marca/desmarca el badge de advertencia (⚠) en una miniatura.
 * @param {number} idx
 * @param {boolean} on
 */
export function markThumbWarn(idx, on) {
  const item = document.getElementById(`thumb-${idx}`);
  if (!item) return;
  item.classList.toggle('has-warn', on);
  const wrap = item.querySelector('.thumb-canvas-wrap');
  let badge = wrap.querySelector('.thumb-badge');
  if (on && !badge) {
    badge = document.createElement('div');
    badge.className = 'thumb-badge';
    badge.textContent = '⚠';
    wrap.appendChild(badge);
  } else if (!on && badge) {
    badge.remove();
  }
}

/**
 * Marca una miniatura como corregida y pinta el ángulo resultante.
 * Recibe el ángulo YA normalizado (0-359) — quien llama (main.js) es
 * dueño de pageRotations y decide qué ángulo mostrar.
 * @param {number} idx
 * @param {number} rotationAngle - ángulo normalizado; 0 se pinta como "✓"
 */
export function markThumbCorrection(idx, rotationAngle) {
  const item = document.getElementById(`thumb-${idx}`);
  if (!item) return;
  item.classList.remove('has-warn');
  item.classList.add('has-correction');
  const wrap = item.querySelector('.thumb-canvas-wrap');
  let badge = wrap.querySelector('.thumb-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'thumb-badge correction';
    wrap.appendChild(badge);
  }
  badge.className = 'thumb-badge correction';
  badge.textContent = rotationAngle ? `${rotationAngle}°` : '✓';
}

/**
 * Quita la marca de corrección de una miniatura (usado por resetAll/resetPage).
 * @param {number} idx
 */
export function clearThumbCorrection(idx) {
  const item = document.getElementById(`thumb-${idx}`);
  if (item) {
    item.classList.remove('has-correction');
    const badge = item.querySelector('.thumb-badge.correction');
    if (badge) badge.remove();
  }
}

/**
 * Lee el índice de página actualmente elegido en el <select>.
 * @returns {number|null}
 */
export function getSelectedPageIndex() {
  const v = document.getElementById('page-select').value;
  return v === '' ? null : parseInt(v, 10);
}

/** Handler del evento 'change' del <select> de página. */
export function onPageSelectChange() {
  const idx = getSelectedPageIndex();
  if (idx !== null) selectThumbPage(idx);
}
