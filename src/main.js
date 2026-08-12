/**
 * main.js
 *
 * Responsabilidad:
 *   Único punto de entrada de DispatchDock (rediseño de interfaz). Misma
 *   responsabilidad que la versión anterior — estado de sesión, orquestación
 *   de servicios/dominio/UI, wiring de eventos — pero el flujo cambia para
 *   reflejar el uso real: cargar PDF, pegar datos, y un solo botón que
 *   divide Y descarga el ZIP (en vez de dos pasos separados). La detección
 *   desde Excel corre automáticamente al pegar, sin botón "Detectar".
 *
 * No contiene:
 *   - lógica de negocio (domain/)
 *   - acceso directo a pdfjsLib/PDFLib/JSZip (services/)
 *   - construcción de HTML de componentes específicos (ui/)
 */

import { loadPdf } from './services/pdfReadService.js';
import { splitPdf } from './services/pdfWriteService.js';
import { buildZip } from './services/zipService.js';
import { downloadBlob, buildZipFilename } from './services/fileService.js';
import { normalizeAngle } from './core/angle.js';
import { buildAssignments, makeFilename } from './domain/assignments.js';
import { parseList, evaluatePageMatch, computeMismatchWarnings } from './domain/routes.js';
import { parseExcelTable } from './parser/excelTableParser.js';
import { toast } from './ui/notifications.js';
import { setDeskStatus } from './ui/status.js';
import { openDrawer, closeDrawer, toggleDrawer, setToolsToggleState } from './ui/toolsDrawer.js';
import {
  renderThumbnails,
  selectThumbPage,
  markThumbWarn,
  markThumbCorrection,
  clearThumbCorrection,
  getSelectedPageIndex,
  onPageSelectChange,
} from './ui/thumbnails.js';
import { renderChips, renderManifestStatus, renderDetailTable, updateDispatchButton } from './ui/manifest.js';
import { renderResults, hideResults } from './ui/results.js';

// ══════════════════════════════════════════
//  STATE (estado de sesión — no de UI)
// ══════════════════════════════════════════
let pdfFile = null;
let totalPages = 0;
let pdfHandle = null;
let pageRotations = {}; // { pageIndex: angleDelta }
let warnPages = []; // [{ pageIndex, currentRot, suggestedDelta }]
let generatedFiles = [];

// ══════════════════════════════════════════
//  DOM REFS
// ══════════════════════════════════════════
const dz = document.getElementById('drop-zone');
const fi = document.getElementById('file-input');
const tableInput = document.getElementById('table-input');
const allInput = document.getElementById('all-input');
const fitoInput = document.getElementById('fito-input');

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ══════════════════════════════════════════
//  FILE LOAD
// ══════════════════════════════════════════
async function loadFile(f) {
  pdfFile = f;
  pdfHandle = await loadPdf(f);
  totalPages = pdfHandle.totalPages;
  pageRotations = {};
  warnPages = [];
  generatedFiles = [];

  dz.classList.add('has-file');
  document.getElementById('dz-loaded-name').textContent = f.name;
  document.getElementById('dz-loaded-pages').textContent = `${totalPages} páginas`;

  const sel = document.getElementById('page-select');
  sel.innerHTML = '<option value="">— página —</option>';
  for (let i = 1; i <= totalPages; i++) sel.innerHTML += `<option value="${i - 1}">Página ${i}</option>`;

  hideResults();
  document.getElementById('detail-table').hidden = true;
  document.getElementById('detail-toggle').textContent = 'Ver detalle';

  toast(`PDF cargado — ${totalPages} páginas`, 'success', f.name);

  // Miniaturas + análisis de orientación en paralelo — la herramienta de
  // corrección solo se abre sola si encuentra un problema real.
  renderThumbnails(pdfHandle, totalPages);
  analyzeOrientation();
  refresh();
}

// ══════════════════════════════════════════
//  ORIENTATION DETECTION
// ══════════════════════════════════════════
async function analyzeOrientation() {
  const banner = document.getElementById('orient-banner');
  const bTitle = document.getElementById('orient-banner-title');
  const bSub = document.getElementById('orient-banner-sub');
  const bProg = document.getElementById('orient-progress');
  const bFill = document.getElementById('orient-progress-fill');
  const bActs = document.getElementById('orient-actions');

  banner.className = 'orient-banner scanning';
  bTitle.textContent = 'Analizando orientación de páginas...';
  bSub.textContent = `Revisando ${totalPages} páginas`;
  bProg.style.display = 'block';
  bFill.style.width = '0%';
  bActs.innerHTML = '';

  const { dominantRot, warnPages: detectedWarnPages } = await pdfHandle.analyzeOrientation((done, total) => {
    bFill.style.width = Math.round((done / total) * 100) + '%';
  });
  warnPages = detectedWarnPages;
  bProg.style.display = 'none';

  if (warnPages.length === 0) {
    banner.className = 'orient-banner';
    banner.style.display = 'none';
    setToolsToggleState(true, false); // herramienta disponible, sin urgencia — se queda cerrada
    return;
  }

  banner.className = 'orient-banner warn';
  const pageNums = warnPages.map((w) => `Pág.${w.pageIndex + 1}`).join(', ');
  bTitle.textContent = `⚠ ${warnPages.length} página(s) con orientación diferente`;
  bSub.textContent = `Orientación dominante: ${dominantRot}°. Páginas afectadas: ${pageNums}.`;

  bActs.innerHTML = '';
  bActs.appendChild(makeOrientActionButton('btn-sm btn-sm-amber', '✓ Corregir automáticamente', autoFixOrientation));
  bActs.appendChild(makeOrientActionButton('btn-sm btn-sm-outline', '👁 Revisar manualmente', reviewManually));
  bActs.appendChild(makeOrientActionButton('btn-sm btn-sm-ghost', 'Ignorar', dismissOrientBanner));

  setToolsToggleState(true, true); // esta vez sí hay algo que revisar — se destaca
  openDrawer();
  document.getElementById('tools-drawer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  warnPages.forEach((w) => markThumbWarn(w.pageIndex, true));
}

function makeOrientActionButton(className, label, onClick) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function autoFixOrientation() {
  warnPages.forEach((w) => {
    pageRotations[w.pageIndex] = (pageRotations[w.pageIndex] || 0) + w.suggestedDelta;
    markThumbCorrection(w.pageIndex, normalizeAngle(pageRotations[w.pageIndex]));
  });
  const banner = document.getElementById('orient-banner');
  banner.className = 'orient-banner ok';
  document.getElementById('orient-banner-title').textContent = `✓ ${warnPages.length} página(s) corregida(s)`;
  document.getElementById('orient-banner-sub').textContent = 'Correcciones aplicadas automáticamente. Puedes ajustar manualmente desde la tira de miniaturas.';
  document.getElementById('orient-actions').innerHTML = '';
  toast(`${warnPages.length} página(s) corregidas automáticamente`, 'success');
  refresh();
}

function reviewManually() {
  if (warnPages.length > 0) {
    selectThumbPage(warnPages[0].pageIndex);
  }
}

function dismissOrientBanner() {
  document.getElementById('orient-banner').style.display = 'none';
}

// ══════════════════════════════════════════
//  ROTATION CONTROLS
// ══════════════════════════════════════════
function rotateAll(delta) {
  for (let i = 0; i < totalPages; i++) {
    pageRotations[i] = (pageRotations[i] || 0) + delta;
    if (pageRotations[i] === 0) delete pageRotations[i];
    markThumbCorrection(i, normalizeAngle(pageRotations[i] || 0));
  }
  toast(`Todas las páginas rotadas ${delta > 0 ? '+' : ''}${delta}°`, 'info');
  refresh();
}

function resetAll() {
  pageRotations = {};
  for (let i = 0; i < totalPages; i++) clearThumbCorrection(i);
  toast('Correcciones de rotación eliminadas', 'info');
  refresh();
}

function rotatePage(delta) {
  const idx = getSelectedPageIndex();
  if (idx === null) return toast('Selecciona una página primero', 'warning');
  pageRotations[idx] = (pageRotations[idx] || 0) + delta;
  if (pageRotations[idx] === 0) delete pageRotations[idx];
  markThumbCorrection(idx, normalizeAngle(pageRotations[idx] || 0));
  toast(`Pág.${idx + 1} rotada ${delta > 0 ? '+' : ''}${delta}°`, 'info');
  refresh();
}

function resetPage() {
  const idx = getSelectedPageIndex();
  if (idx === null) return;
  delete pageRotations[idx];
  clearThumbCorrection(idx);
  refresh();
}

// ══════════════════════════════════════════
//  AUTO-DETECT FROM EXCEL TABLE (en vivo, sin botón)
// ══════════════════════════════════════════
const runAutoDetect = debounce(() => {
  const raw = tableInput.value.trim();
  if (!raw) return;

  const result = parseExcelTable(raw);
  if (!result.ok) return; // silencioso mientras el usuario sigue pegando/editando

  allInput.value = result.orderedRoutes.join('\n');
  fitoInput.value = [...result.fitoSet].join('\n');
  refresh();

  if (!result.hasUnidad) {
    document.getElementById('data-chips').insertAdjacentHTML('beforeend', '<span class="chip chip-warn">⚠ Sin columna UNIDAD</span>');
  }
}, 400);

// ══════════════════════════════════════════
//  LIVE REFRESH
// ══════════════════════════════════════════
function refresh() {
  const allRoutes = parseList(allInput.value);
  const fitoRoutes = parseList(fitoInput.value);
  const fitoSet = new Set(fitoRoutes);
  const assignments = buildAssignments(allRoutes, fitoSet);

  const cpCount = assignments.filter((a) => a.type === 'CP' && !a.unified).length;
  const fitoCount = assignments.filter((a) => a.type === 'FITO').length;
  const uniCount = allRoutes.filter((r) => r.includes('-')).length;
  const total = assignments.length;

  renderChips({ cpCount, fitoCount, uniCount });
  renderManifestStatus(
    evaluatePageMatch(totalPages, total),
    totalPages,
    total,
    computeMismatchWarnings({ allRoutes, fitoRoutes, totalPages, totalAssignments: total })
  );

  const detailRows = assignments.map((a) => ({ ...a, filename: makeFilename(a.route, a.type) }));
  renderDetailTable(detailRows, totalPages, pageRotations);

  const canDispatch = !!pdfFile && assignments.length > 0;
  updateDispatchButton(canDispatch);

  if (canDispatch) {
    setDeskStatus('Listo para dividir', 'ready');
  } else if (pdfFile) {
    setDeskStatus(`PDF listo — ${totalPages} páginas · pega los datos`, 'ready');
  } else if (total > 0) {
    setDeskStatus('Datos listos — carga el PDF', 'ready');
  } else {
    setDeskStatus('Sin PDF cargado', 'idle');
  }
}

// ══════════════════════════════════════════
//  DIVIDIR + DESCARGAR ZIP (acción única)
// ══════════════════════════════════════════
async function dispatchAndDownload() {
  if (!pdfFile) return toast('Selecciona un archivo PDF primero', 'error');
  const allRoutes = parseList(allInput.value);
  const fitoRoutes = parseList(fitoInput.value);
  if (!allRoutes.length) return toast('Agrega las rutas primero', 'error');

  const assignments = buildAssignments(allRoutes, new Set(fitoRoutes));

  const dispatchBtn = document.getElementById('dispatch-btn');
  dispatchBtn.disabled = true;
  dispatchBtn.textContent = 'Procesando…';

  const progressEl = document.getElementById('action-progress');
  const fillEl = document.getElementById('ap-fill');
  const labelEl = document.getElementById('ap-label-text');
  const pctEl = document.getElementById('ap-pct');
  progressEl.classList.add('show');
  hideResults();
  generatedFiles = [];

  const splitAssignments = assignments.map(({ route, type, unified }) => ({
    filename: makeFilename(route, type),
    type,
    unified,
  }));

  generatedFiles = await splitPdf(pdfHandle.getRawBytes(), splitAssignments, pageRotations, (done, limit) => {
    const pct = Math.round((done / limit) * 100);
    fillEl.style.width = pct + '%';
    labelEl.textContent = `Generando ${done} de ${limit}`;
    pctEl.textContent = pct + '%';
  });

  labelEl.textContent = 'Comprimiendo…';
  const zipBlob = await buildZip(generatedFiles, (pct) => {
    fillEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';
  });
  downloadBlob(zipBlob, buildZipFilename());

  progressEl.classList.remove('show');
  dispatchBtn.textContent = 'Dividir y descargar ZIP';

  renderResults(generatedFiles, Object.keys(pageRotations).length);
  setDeskStatus(`${generatedFiles.length} archivos generados`, 'done');
  toast(`✅ ${generatedFiles.length} archivos generados y ZIP descargado`, 'success');

  refresh(); // recalcula el estado real del botón (por si se vuelve a dividir)
}

async function downloadZipAgain() {
  if (!generatedFiles.length) return;
  const btn = document.getElementById('zip-btn');
  btn.disabled = true;
  btn.textContent = 'Preparando…';

  const zipBlob = await buildZip(generatedFiles);
  downloadBlob(zipBlob, buildZipFilename());

  btn.disabled = false;
  btn.textContent = 'Descargar ZIP de nuevo';
  toast('⬇ ZIP descargado', 'success');
}

// ══════════════════════════════════════════
//  RESET
// ══════════════════════════════════════════
function resetApp() {
  pdfFile = null;
  totalPages = 0;
  pdfHandle = null;
  pageRotations = {};
  warnPages = [];
  generatedFiles = [];

  fi.value = '';
  dz.classList.remove('has-file');
  document.getElementById('dz-loaded-name').textContent = '—';
  document.getElementById('dz-loaded-pages').textContent = '';

  setToolsToggleState(false, false);
  closeDrawer();
  document.getElementById('orient-banner').style.display = 'none';
  document.getElementById('thumb-strip').innerHTML = '';
  document.getElementById('page-select').innerHTML = '<option value="">— página —</option>';

  tableInput.value = '';
  allInput.value = '';
  fitoInput.value = '';
  document.getElementById('data-chips').innerHTML = '';

  document.getElementById('manifest-status').hidden = true;
  document.getElementById('detail-table').hidden = true;
  document.getElementById('detail-toggle').textContent = 'Ver detalle';

  hideResults();
  updateDispatchButton(false);
  setDeskStatus('Sin PDF cargado', 'idle');
}

// ══════════════════════════════════════════
//  EVENT WIRING
// ══════════════════════════════════════════
dz.addEventListener('click', () => {
  if (!dz.classList.contains('has-file')) fi.click(); // una vez cargado, solo "Cambiar" reabre el picker
});
document.getElementById('dz-change-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  fi.click();
});
dz.addEventListener('dragover', (e) => {
  e.preventDefault();
  dz.classList.add('drag-over');
});
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
dz.addEventListener('drop', (e) => {
  e.preventDefault();
  dz.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') loadFile(f);
  else toast('Solo se aceptan archivos .pdf', 'error');
});
fi.addEventListener('change', () => {
  if (fi.files[0]) loadFile(fi.files[0]);
});

document.getElementById('tools-toggle').addEventListener('click', toggleDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);

document.querySelectorAll('[data-rotate-all]').forEach((btn) => {
  btn.addEventListener('click', () => rotateAll(parseInt(btn.dataset.rotateAll, 10)));
});
document.getElementById('rot-all-reset').addEventListener('click', resetAll);
document.querySelectorAll('[data-rotate-page]').forEach((btn) => {
  btn.addEventListener('click', () => rotatePage(parseInt(btn.dataset.rotatePage, 10)));
});
document.getElementById('rot-page-reset').addEventListener('click', resetPage);
document.getElementById('page-select').addEventListener('change', onPageSelectChange);

tableInput.addEventListener('input', runAutoDetect);
allInput.addEventListener('input', refresh);
fitoInput.addEventListener('input', refresh);

document.getElementById('detail-toggle').addEventListener('click', () => {
  const table = document.getElementById('detail-table');
  const btn = document.getElementById('detail-toggle');
  table.hidden = !table.hidden;
  btn.textContent = table.hidden ? 'Ver detalle' : 'Ocultar detalle';
});

document.getElementById('dispatch-btn').addEventListener('click', dispatchAndDownload);
document.getElementById('zip-btn').addEventListener('click', downloadZipAgain);
document.getElementById('reset-btn').addEventListener('click', resetApp);
