/**
 * parser/excelTableParser.js
 *
 * Responsabilidad:
 *   Interpretar el texto pegado desde Excel (TSV) en index.html: detectar
 *   encabezados (RUTA/TRACTOR/CERT/UNIDAD, con sus variantes), construir
 *   las filas, aplicar domain/unification.js por grupo de tractor, y
 *   devolver las rutas ordenadas + el set de rutas con FITO. Es la misma
 *   lógica que vivía dentro de detectFromTable() en index.html v1.0 —
 *   se mueve tal cual, solo separando el parsing puro de sus efectos
 *   colaterales (llenar textareas, mostrar toasts), que quedan en main.js.
 *
 * Entrada / Salida: ver JSDoc de parseExcelTable().
 *
 * Dependencias:
 *   - domain/unification.js (shouldUnify)
 *
 * No puede:
 *   - acceder al DOM
 *   - mostrar toasts (si no encuentra encabezado, devuelve ok:false — quien
 *     llama decide cómo comunicarlo)
 */

import { shouldUnify } from '../domain/unification.js';

/**
 * @typedef {Object} ParsedTable
 * @property {boolean} ok
 * @property {string} [error] - 'header_not_found' cuando ok=false
 * @property {string[]} [orderedRoutes]
 * @property {Set<string>} [fitoSet]
 * @property {boolean} [hasUnidad]
 * @property {number} [unifiedCount]
 */

/**
 * @param {string} raw - texto pegado desde Excel, tal cual llega de la textarea
 * @returns {ParsedTable}
 */
export function parseExcelTable(raw) {
  const lines = raw.split('\n').map((l) => l.split('\t').map((c) => c.trim()));
  let headerIdx = -1, colRuta = -1, colTractor = -1, colCert = -1, colCaja = -1;

  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const row = lines[i].map((c) => c.toUpperCase());
    const rIdx = row.findIndex((c) => c === 'RUTA' || c === 'ROUTE');
    const tIdx = row.findIndex((c) => c.includes('TRACTOR') || c === 'TRACTO');
    const cIdx = row.findIndex((c) => c === 'CERT' || c === 'CERTIFICADO');
    const uIdx = row.findIndex((c) => c === 'UNIDAD' || c === 'CAJA' || c === 'TRAILER');
    if (rIdx >= 0 && tIdx >= 0) {
      headerIdx = i; colRuta = rIdx; colTractor = tIdx; colCert = cIdx; colCaja = uIdx;
      break;
    }
  }

  if (headerIdx < 0) {
    return { ok: false, error: 'header_not_found' };
  }

  const hasUnidad = colCaja >= 0;
  const dataLines = lines.slice(headerIdx + 1).filter((r) => r.length > Math.max(colRuta, colTractor));

  const allRows = [];
  const tractorGroups = {};
  for (const row of dataLines) {
    const ruta = row[colRuta]?.trim();
    const tractor = row[colTractor]?.trim();
    const cert = colCert >= 0 ? row[colCert]?.trim() : '';
    const caja = colCaja >= 0 ? row[colCaja]?.trim() : '';
    if (!ruta || !tractor) continue;
    const obj = { ruta, tractor, cert, caja };
    if (!tractorGroups[tractor]) tractorGroups[tractor] = [];
    tractorGroups[tractor].push(obj);
    allRows.push(obj);
  }

  // Aplicar el motor de unificación por grupo de tractor
  const unifiedMap = {};
  for (const routes of Object.values(tractorGroups)) {
    if (routes.length < 2) continue;
    const pairToUnify = [];
    for (let i = 0; i < routes.length; i++) {
      for (let j = i + 1; j < routes.length; j++) {
        if (shouldUnify(routes[i], routes[j])) {
          pairToUnify.push([routes[i].ruta, routes[j].ruta]);
        }
      }
    }
    for (const [a, b] of pairToUnify) {
      const sorted = [a, b].sort((x, y) => Number(x) - Number(y));
      const label = sorted.join('-');
      unifiedMap[a] = label;
      unifiedMap[b] = label;
    }
  }

  const seenLabels = new Set();
  const orderedRoutes = [];
  const fitoSet = new Set();

  for (const { ruta, cert } of allRows) {
    const label = unifiedMap[ruta] || ruta;
    if (!seenLabels.has(label)) { seenLabels.add(label); orderedRoutes.push(label); }
    if (cert && cert.toUpperCase().includes('FITO')) fitoSet.add(label);
  }

  const unifiedCount = new Set(Object.values(unifiedMap)).size;

  return { ok: true, orderedRoutes, fitoSet, hasUnidad, unifiedCount };
}
