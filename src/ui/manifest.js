/**
 * ui/manifest.js
 *
 * Responsabilidad:
 *   Pintar la retroalimentación en vivo mientras el usuario pega datos:
 *   los chips de conteo (rutas/FITO/unificadas), la barra de "estado del
 *   manifiesto" (coincide/sobran/faltan páginas, con las advertencias
 *   inline) y la tabla de detalle opcional (oculta por default — en el
 *   rediseño la vista previa ya no es un paso obligatorio, es un
 *   "ver detalle" que el usuario abre solo si lo necesita).
 *
 * Dependencias:
 *   - core/angle.js (normalizeAngle) — solo para pintar el badge de
 *     rotación en la tabla de detalle, uso cosmético.
 *
 * No puede:
 *   - calcular assignments, page match ni warnings (eso es domain/routes.js
 *     y domain/assignments.js — este módulo solo renderiza lo que le pasan)
 *   - decidir si la tabla de detalle está visible u oculta (eso lo hace
 *     el listener del botón "Ver detalle" en main.js, alternando el
 *     atributo hidden — este módulo solo la rellena de contenido)
 */

import { normalizeAngle } from '../core/angle.js';

/**
 * @param {{cpCount:number, fitoCount:number, uniCount:number}} stats
 */
export function renderChips({ cpCount, fitoCount, uniCount }) {
  const chips = document.getElementById('data-chips');
  const parts = [];
  if (cpCount > 0) parts.push(`<span class="chip chip-route">${cpCount} ruta${cpCount === 1 ? '' : 's'}</span>`);
  if (fitoCount > 0) parts.push(`<span class="chip chip-fito">${fitoCount} FITO</span>`);
  if (uniCount > 0) parts.push(`<span class="chip chip-uni">${uniCount} unificada${uniCount === 1 ? '' : 's'}</span>`);
  chips.innerHTML = parts.join('');
}

/**
 * Pinta la barra de "estado del manifiesto": une el resultado de
 * evaluatePageMatch con los warnings de computeMismatchWarnings en una
 * sola línea de lectura rápida, en vez de dos widgets separados como
 * tenía la versión anterior (sidebar + alerta inline).
 *
 * @param {import('../domain/routes.js').PageMatchResult} matchResult
 * @param {number} totalPages
 * @param {number} total
 * @param {string[]} warnings
 */
export function renderManifestStatus(matchResult, totalPages, total, warnings) {
  const section = document.getElementById('manifest-status');
  const icon = document.getElementById('status-icon');
  const line = document.getElementById('status-line');

  if (matchResult.state === 'none') {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const toneByState = { ok: 'tone-ok', warn: 'tone-warn', error: 'tone-error' };
  section.classList.remove('tone-ok', 'tone-warn', 'tone-error');
  section.classList.add(toneByState[matchResult.state]);

  const iconByState = { ok: '✓', warn: '⚠', error: '⛔' };
  icon.textContent = iconByState[matchResult.state];

  let mainText;
  if (matchResult.state === 'ok') {
    mainText = `<strong>Coincide.</strong> ${totalPages} páginas de PDF · ${total} archivos a generar.`;
  } else if (matchResult.state === 'warn') {
    mainText = `<strong>${matchResult.diff} página(s) sin nombre.</strong> PDF: ${totalPages} · Esperadas: ${total}.`;
  } else {
    mainText = `<strong>Faltan ${matchResult.diff} página(s).</strong> PDF: ${totalPages} · Esperadas: ${total}.`;
  }

  const extra = warnings.length ? ` ${warnings.join(' ')}` : '';
  line.innerHTML = mainText + extra;
}

/**
 * @typedef {Object} DetailRow
 * @property {string} filename
 * @property {'CP'|'FITO'} type
 * @property {boolean} unified
 */

/**
 * Rellena la tabla de detalle opcional. La visibilidad la controla main.js.
 * @param {DetailRow[]} rows
 * @param {number} totalPages
 * @param {Record<number, number>} pageRotations
 */
export function renderDetailTable(rows, totalPages, pageRotations) {
  const tbody = document.getElementById('detail-table-body');

  let html = '';
  rows.forEach(({ filename, type, unified }, i) => {
    const pageNum = i + 1;
    const inRange = totalPages === 0 || pageNum <= totalPages;
    const typeClass = unified ? 'unified' : type.toLowerCase();
    const tagLabel = unified ? `${type} · UNIF` : type;
    const rotDelta = pageRotations[i];
    const rotBadge = rotDelta ? `<span class="row-tag tag-rot">${normalizeAngle(rotDelta)}°</span>` : '';
    html += `<tr>
      <td class="td-num">${pageNum}</td>
      <td class="td-page">${inRange ? `Pág.&nbsp;${pageNum}` : '—'}</td>
      <td>${filename}</td>
      <td><span class="row-tag tag-${typeClass}">${tagLabel}</span>${rotBadge}${!inRange ? ' <span class="row-tag tag-warn">sin pág.</span>' : ''}</td>
    </tr>`;
  });

  tbody.innerHTML = html;
}

/**
 * @param {boolean} canDispatch
 */
export function updateDispatchButton(canDispatch) {
  document.getElementById('dispatch-btn').disabled = !canDispatch;
}
