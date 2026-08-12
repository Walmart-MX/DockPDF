/**
 * services/pdfWriteService.js
 *
 * Responsabilidad:
 *   Única puerta de entrada a PDFLib en toda la aplicación. Genera los PDFs
 *   individuales (uno por asignación ruta/tipo) a partir del PDF original,
 *   aplicando las rotaciones acumuladas por página. Es el equivalente
 *   exacto de splitPDF() en index.html v1.0, con la generación de
 *   Blob/ObjectURL incluida (se preserva junto al split porque en la
 *   versión original ambas cosas ocurrían en el mismo paso — separarlas
 *   ahora sería un cambio de comportamiento, no solo de estructura).
 *
 * Dependencias:
 *   - PDFLib: variable global expuesta por el <script> de pdf-lib cargado
 *     vía CDN en index.html. Este módulo es el ÚNICO lugar del código que
 *     debe tocar `PDFLib` directamente.
 *   - core/angle.js (normalizeAngle)
 *
 * Quién puede llamarlo:
 *   - el script principal de index.html (splitPDF)
 *   - en el futuro: app/useCases.js, cuando exista esa capa
 *
 * No puede:
 *   - leer del DOM (assignments y pageRotations le llegan como parámetros)
 *   - mostrar toasts ni actualizar barras de progreso directamente
 *     (usa el callback onProgress, quien llama decide cómo pintarlo)
 *   - decidir nombres de archivo (eso lo resuelve makeFilename antes de
 *     llamar a este servicio — sigue viviendo en index.html por ahora)
 */

import { normalizeAngle } from '../core/angle.js';

/**
 * @typedef {Object} SplitAssignment
 * @property {string} filename  - nombre final del archivo (ya resuelto antes de llamar)
 * @property {string} type      - 'CP' | 'FITO'
 * @property {boolean} unified  - true si la ruta es una unificación (guión)
 */

/**
 * Divide el PDF original en un archivo por cada assignment, en el mismo
 * orden en que aparecen (assignment[i] ↔ página i del PDF original).
 * Idéntico en semántica a splitPDF() de index.html v1.0:
 *   - limit = min(assignments.length, totalPages) — nunca lee páginas
 *     inexistentes ni genera más archivos que assignments.
 *   - la rotación aplicada es ROTACIÓN ORIGINAL DE LA PÁGINA + delta manual,
 *     nunca reemplaza la rotación original.
 *
 * @param {ArrayBuffer} rawBytes  - copia de los bytes del PDF original (ver pdfReadService.getRawBytes)
 * @param {SplitAssignment[]} assignments
 * @param {Record<number, number>} pageRotations - { pageIndex: deltaAngle }
 * @param {(done:number, total:number) => void} [onProgress]
 * @returns {Promise<Array<{filename:string, bytes:Uint8Array, url:string, type:string, unified:boolean}>>}
 */
export async function splitPdf(rawBytes, assignments, pageRotations, onProgress) {
  const srcDoc = await PDFLib.PDFDocument.load(rawBytes);
  const totalPages = srcDoc.getPageCount();
  const limit = Math.min(assignments.length, totalPages);

  const generatedFiles = [];

  for (let i = 0; i < limit; i++) {
    const { filename, type, unified } = assignments[i];

    const newDoc = await PDFLib.PDFDocument.create();
    const [copied] = await newDoc.copyPages(srcDoc, [i]);

    const rotDelta = pageRotations[i];
    if (rotDelta) {
      const currentRot = copied.getRotation().angle;
      copied.setRotation(PDFLib.degrees(normalizeAngle(currentRot + rotDelta)));
    }

    newDoc.addPage(copied);
    const bytes = await newDoc.save();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    generatedFiles.push({ filename, bytes, url, type, unified });

    if (onProgress) onProgress(i + 1, limit);
  }

  return generatedFiles;
}

/**
 * Libera los ObjectURLs generados por splitPdf(). Debe llamarse cuando ya
 * no se necesitan (ej. antes de un nuevo split), para evitar memory leaks
 * — riesgo ya señalado en el diagnóstico (sección 19). index.html v1.0 no
 * liberaba estas URLs entre splits sucesivos; se añade aquí como utilidad
 * disponible, sin forzar su uso todavía (activarla sería un cambio de
 * comportamiento fuera de esta fase — queda como MEJORA FUTURA).
 *
 * @param {Array<{url:string}>} generatedFiles
 */
export function revokeGeneratedUrls(generatedFiles) {
  generatedFiles.forEach(({ url }) => URL.revokeObjectURL(url));
}
