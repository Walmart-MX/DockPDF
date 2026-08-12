/**
 * ui/results.js
 *
 * Responsabilidad:
 *   Pintar la zona de resultados tras dividir el PDF: el sello circular
 *   "Despachado" (elemento de firma del rediseño), el resumen, y la
 *   grilla de descargas individuales. Equivalente a lo que hacía
 *   showDownloads() en la versión anterior, pero ahora la descarga del
 *   ZIP es la acción principal (ya ocurrió automáticamente al dividir) y
 *   esta grilla queda como respaldo para el caso raro de necesitar un
 *   solo archivo.
 *
 * No puede:
 *   - generar los archivos (eso es pdfWriteService.splitPdf)
 *   - decidir cuándo mostrarse/ocultarse (main.js controla la clase 'show'
 *     al iniciar un nuevo split o al resetear)
 */

/**
 * @typedef {Object} GeneratedFile
 * @property {string} filename
 * @property {string} url
 * @property {'CP'|'FITO'} type
 * @property {boolean} unified
 */

/**
 * @param {GeneratedFile[]} files
 * @param {number} rotatedPageCount
 */
export function renderResults(files, rotatedPageCount) {
  const zone = document.getElementById('results-zone');
  const grid = document.getElementById('results-grid');
  zone.classList.add('show');
  grid.innerHTML = '';

  const cpCount = files.filter((f) => f.type === 'CP' && !f.unified).length;
  const fitoCount = files.filter((f) => f.type === 'FITO').length;
  const uniCount = files.filter((f) => f.unified).length;

  document.getElementById('dispatch-stamp-count').textContent = files.length;

  const corrNote = rotatedPageCount > 0 ? ` · ${rotatedPageCount} pág. con rotación aplicada` : '';
  document.getElementById('results-summary').innerHTML =
    `<strong>${files.length} archivos</strong> · CP: ${cpCount} · FITO: ${fitoCount}${uniCount ? ` · Unificadas: ${uniCount}` : ''}${corrNote}`;

  files.forEach(({ filename, url, type, unified }) => {
    const rowClass = unified ? 'rt-unified' : `rt-${type.toLowerCase()}`;
    const div = document.createElement('div');
    div.className = `result-item ${rowClass}`;
    div.innerHTML = `
      <span class="result-icon">📄</span>
      <div class="result-info">
        <div class="result-name">${filename}</div>
        <div class="result-meta">${unified ? 'Unificada · ' : ''}${type}</div>
      </div>
      <a class="result-dl" href="${url}" download="${filename}">↓</a>`;
    grid.appendChild(div);
  });

  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Oculta la zona de resultados (usado al volver a dividir o al resetear). */
export function hideResults() {
  document.getElementById('results-zone').classList.remove('show');
  document.getElementById('results-grid').innerHTML = '';
}
