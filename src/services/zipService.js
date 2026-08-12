/**
 * services/zipService.js
 *
 * Responsabilidad:
 *   Única puerta de entrada a JSZip en toda la aplicación. Construye un
 *   Blob de tipo ZIP a partir de los archivos generados por
 *   pdfWriteService.splitPdf(). Equivalente exacto de la parte de
 *   compresión que existía dentro de downloadZip() en index.html v1.0
 *   (misma compresión DEFLATE nivel 6, mismo reporte de progreso).
 *
 * Entrada / Salida: ver JSDoc de buildZip() abajo.
 *
 * Dependencias:
 *   - JSZip: variable global expuesta por el <script> de jszip cargado vía
 *     CDN en index.html. Este módulo es el ÚNICO lugar del código que debe
 *     tocar `JSZip` directamente.
 *
 * Quién puede llamarlo:
 *   - el script principal de index.html (downloadZip)
 *   - en el futuro: app/useCases.js, cuando exista esa capa
 *
 * No puede:
 *   - disparar la descarga en sí (eso es services/fileService.js)
 *   - tocar el DOM ni mostrar toasts
 *   - decidir el nombre del archivo ZIP (eso también es fileService.js)
 */

/**
 * @typedef {Object} GeneratedFile
 * @property {string} filename
 * @property {Uint8Array} bytes
 */

/**
 * Construye un Blob ZIP a partir de los archivos generados.
 *
 * @param {GeneratedFile[]} files
 * @param {(percent:number) => void} [onProgress] - porcentaje entero 0-100
 * @returns {Promise<Blob>}
 */
export async function buildZip(files, onProgress) {
  const zip = new JSZip();
  files.forEach(({ filename, bytes }) => zip.file(filename, bytes));

  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      if (onProgress) onProgress(Math.round(meta.percent));
    }
  );
}
