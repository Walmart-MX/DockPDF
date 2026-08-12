/**
 * services/pdfReadService.js
 *
 * Responsabilidad:
 *   Única puerta de entrada a pdfjsLib en toda la aplicación. Envuelve la
 *   carga del PDF, la lectura de metadata de páginas, el análisis de
 *   orientación (delegando el cálculo puro a domain/orientation.js) y el
 *   renderizado de miniaturas.
 *
 * Dependencias:
 *   - pdfjsLib: variable global expuesta por el <script> de pdf.js cargado
 *     vía CDN en index.html (sin bundler todavía — mismo mecanismo que ya
 *     usa el proyecto). Este módulo es el ÚNICO lugar del código que debe
 *     tocar `pdfjsLib` directamente.
 *   - domain/orientation.js (cálculo puro, sin pdf.js)
 *
 * Quién puede llamarlo:
 *   - el script principal de index.html (loadFile, analyzeOrientation, etc.)
 *   - en el futuro: app/useCases.js, cuando exista esa capa
 *
 * No puede:
 *   - tocar el DOM (salvo crear un <canvas> desconectado — ver nota en
 *     renderThumbnail)
 *   - mostrar toasts
 *   - decidir qué hacer con warnPages (eso lo decide quien llama)
 *
 * Nota sobre el ArrayBuffer:
 *   pdf.js "detacha" (neutraliza) el ArrayBuffer que recibe una vez lo
 *   consume. Como pdf-lib (en pdfWriteService) necesita leer el MISMO PDF
 *   original más adelante, este servicio conserva los bytes originales
 *   intactos y solo le pasa una COPIA a pdf.js (bytes.slice(0)). Mismo
 *   patrón que existía en index.html v1.0 — se preserva tal cual, es la
 *   parte más frágil de esta extracción.
 *
 * Requiere que el <script> de pdf.js (CDN) se haya cargado ANTES de que
 * este módulo se importe — en index.html eso ya ocurre porque los scripts
 * de librerías están en <head>, antes del <script type="module"> principal.
 */

import { analyzeOrientation as domainAnalyzeOrientation } from '../domain/orientation.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Carga un PDF y devuelve un "handle" con métodos de lectura.
 * Cada llamada produce un handle independiente — sin estado global
 * compartido entre PDFs distintos.
 *
 * @param {File} file
 * @returns {Promise<PdfReadHandle>}
 */
export async function loadPdf(file) {
  const originalBytes = await file.arrayBuffer();
  // Copia para pdf.js — el original se conserva intacto para pdfWriteService.
  const pdfDoc = await pdfjsLib.getDocument(originalBytes.slice(0)).promise;

  return {
    fileName: file.name,
    totalPages: pdfDoc.numPages,

    /**
     * Devuelve una COPIA de los bytes originales del PDF, lista para
     * pasarle a pdfWriteService.splitPdf(). Se devuelve copia nueva en
     * cada llamada para que cada consumidor tenga su propio buffer
     * no-detachable.
     * @returns {ArrayBuffer}
     */
    getRawBytes() {
      return originalBytes.slice(0);
    },

    /**
     * Metadata básica de una página (0-indexed), sin renderizar.
     * @param {number} pageIndex
     * @returns {Promise<{pageIndex:number, metaRot:number, width:number, height:number, isLandscape:boolean}>}
     */
    async getPageMeta(pageIndex) {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const vp = page.getViewport({ scale: 1 });
      const metaRot = page.rotate || 0;
      return {
        pageIndex,
        metaRot,
        width: vp.width,
        height: vp.height,
        isLandscape: vp.width > vp.height,
      };
    },

    /**
     * Analiza la orientación de TODAS las páginas del documento.
     * Reporta progreso vía onProgress (idéntico al loop de
     * analyzeOrientation en index.html v1.0, pero sin tocar el DOM).
     *
     * @param {(done:number, total:number) => void} [onProgress]
     * @returns {Promise<{dominantRot:number, warnPages:Array}>}
     */
    async analyzeOrientation(onProgress) {
      const readings = [];
      for (let i = 0; i < pdfDoc.numPages; i++) {
        const meta = await this.getPageMeta(i);
        readings.push({ pageIndex: i, metaRot: meta.metaRot });
        if (onProgress) onProgress(i + 1, pdfDoc.numPages);
      }
      return domainAnalyzeOrientation(readings);
    },

    /**
     * Renderiza una miniatura de la página a un <canvas> DESCONECTADO del
     * documento (no se inserta en el DOM aquí — quien llama decide dónde
     * colocarlo). Mismo cálculo de escala que index.html v1.0: el lado más
     * largo se ajusta a maxSize px.
     *
     * @param {number} pageIndex
     * @param {number} [maxSize=72]
     * @returns {Promise<HTMLCanvasElement>}
     */
    async renderThumbnail(pageIndex, maxSize = 72) {
      const page = await pdfDoc.getPage(pageIndex + 1);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = maxSize / Math.max(baseVp.width, baseVp.height);
      const vp = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      return canvas;
    },

    /** Libera recursos internos de pdf.js para este documento. */
    destroy() {
      pdfDoc.destroy();
    },
  };
}
