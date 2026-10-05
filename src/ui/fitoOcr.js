/**
 * ui/fitoOcr.js
 *
 * Responsabilidad:
 *   Pintar la sección de validación OCR de certificados FITO: botón,
 *   barra de progreso y lista de resultados por ruta. Orquesta
 *   services/ocrService + domain/fitoValidation, pero NO decide cuándo
 *   mostrarse — main.js llama a setOcrSectionVisible() según si hay PDF
 *   cargado y rutas FITO detectadas.
 *
 * No puede:
 *   - conocer pdfjsLib/Tesseract directamente (eso vive en los services)
 *   - decidir qué cuenta como FITO válido (domain/fitoValidation.js)
 *   - bloquear dispatchAndDownload — esto es puramente informativo, el
 *     operador decide qué hacer con la advertencia.
 */
import { recognizeText } from '../services/ocrService.js';
import { validateFitoText } from '../domain/fitoValidation.js';
import { iconCheckCircle, iconAlertTriangle } from './icons.js';

/** @param {boolean} visible */
export function setOcrSectionVisible(visible) {
  const section = document.getElementById('ocr-section');
  if (section) section.hidden = !visible;
}

function setProgress(visible, label, pct) {
  const progress = document.getElementById('ocr-progress');
  if (!progress) return;
  progress.hidden = !visible;
  if (!visible) return;
  document.getElementById('ocr-progress-label').textContent = label;
  document.getElementById('ocr-progress-fill').style.width = pct + '%';
}

function renderResults(items) {
  const container = document.getElementById('ocr-results');
  if (!container) return;
  container.innerHTML = items
    .map(({ route, result }) => {
      const icon = result.isLikelyFito ? iconCheckCircle() : iconAlertTriangle();
      const cls = result.isLikelyFito ? 'ok' : 'warn';
      const detail = result.isLikelyFito
        ? `${result.matchedCount}/${result.total} palabras clave encontradas`
        : `Solo ${result.matchedCount}/${result.total} palabras clave — revisar manualmente`;
      return `<div class="ocr-result-item ${cls}"><span class="ocr-result-icon">${icon}</span><div><div class="ocr-result-route">Ruta ${route}</div><div class="ocr-result-detail">${detail}</div></div></div>`;
    })
    .join('');
}

/**
 * Corre OCR sobre las páginas indicadas y pinta los resultados conforme
 * van terminando (no espera a procesar todas para mostrar la primera).
 *
 * @param {Object} pdfHandle - handle de pdfReadService (ya cargado)
 * @param {Array<{route:string, pageIndex:number}>} fitoPages
 */
export async function runFitoOcrValidation(pdfHandle, fitoPages) {
  if (!pdfHandle || !fitoPages.length) return;

  const btn = document.getElementById('ocr-validate-btn');
  btn.disabled = true;
  document.getElementById('ocr-results').innerHTML = '';
  setProgress(true, `Analizando 0 de ${fitoPages.length}...`, 0);

  const items = [];
  try {
    for (let i = 0; i < fitoPages.length; i++) {
      const { route, pageIndex } = fitoPages[i];
      setProgress(
        true,
        `Analizando página ${i + 1} de ${fitoPages.length} (ruta ${route})...`,
        Math.round((i / fitoPages.length) * 100)
      );
      const canvas = await pdfHandle.renderPageForOcr(pageIndex);
      const { text } = await recognizeText(canvas);
      const result = validateFitoText(text);
      items.push({ route, result });
      renderResults(items);
    }
    setProgress(false, '', 100);
    btn.textContent = 'Validar de nuevo con OCR';
  } catch (err) {
    setProgress(false, '', 0);
    document.getElementById('ocr-results').innerHTML =
      `<div class="ocr-result-item warn"><div class="ocr-result-route">No se pudo completar la validación OCR</div><div class="ocr-result-detail">${err.message}</div></div>`;
  } finally {
    btn.disabled = false;
  }
}
