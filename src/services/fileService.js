/**
 * services/fileService.js
 *
 * Responsabilidad:
 *   Utilidades genéricas de descarga y nombres de archivo en el navegador.
 *   No conoce nada de PDFs ni de rutas — solo sabe disparar una descarga a
 *   partir de un Blob y liberar ObjectURLs. Equivalente exacto de la parte
 *   final de downloadZip() en index.html v1.0 (creación de <a>, click,
 *   revoke) y de la convención de nombre `rutas_YYYY-MM-DD.zip`.
 *
 * Entrada / Salida: ver JSDoc de cada función abajo.
 *
 * Dependencias:
 *   - Solo APIs nativas del navegador (Blob, URL, document.createElement).
 *     No importa pdf-lib, pdfjs-dist ni jszip.
 *
 * Quién puede llamarlo:
 *   - el script principal de index.html (downloadZip)
 *   - cualquier otro flujo futuro que necesite disparar una descarga
 *
 * No puede:
 *   - construir el contenido del archivo (eso es zipService/pdfWriteService)
 *   - mostrar toasts ni decidir cuándo descargar — solo ejecuta la descarga
 *     cuando se le pide
 */

/**
 * Dispara la descarga de un Blob con el nombre indicado. Crea un <a>
 * temporal, dispara el click, y libera el ObjectURL inmediatamente después
 * — mismo patrón que index.html v1.0 usaba inline dentro de downloadZip().
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Libera un ObjectURL previamente creado (por ejemplo, los que genera
 * pdfWriteService.splitPdf para cada archivo individual). Utilidad
 * disponible para cuando se decida activar la limpieza entre splits
 * sucesivos — ver nota de "MEJORA FUTURA" en pdfWriteService.js.
 *
 * @param {string} url
 */
export function revokeUrl(url) {
  URL.revokeObjectURL(url);
}

/**
 * Genera el nombre por defecto del ZIP de salida, con la fecha del día.
 * Idéntico al literal `rutas_${new Date().toISOString().slice(0,10)}.zip`
 * de index.html v1.0.
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function buildZipFilename(date = new Date()) {
  return `rutas_${date.toISOString().slice(0, 10)}.zip`;
}
