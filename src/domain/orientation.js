/**
 * domain/orientation.js
 *
 * Responsabilidad:
 *   Determinar la orientación "dominante" de un conjunto de páginas y
 *   detectar cuáles se desvían de ella. Es la misma heurística que existía
 *   embebida en analyzeOrientation() en index.html v1.0 — se mueve tal cual,
 *   sin cambiar el criterio (moda estadística de page.rotate).
 *
 * Entrada:
 *   pageReadings: Array<{ pageIndex: number, metaRot: number }>
 *     metaRot = rotación reportada por el PDF (page.rotate en pdf.js)
 *
 * Salida:
 *   {
 *     dominantRot: number,
 *     warnPages: Array<{ pageIndex, currentRot, suggestedDelta }>
 *   }
 *
 * No puede:
 *   - acceder al DOM
 *   - acceder a pdfjsLib o PDFLib directamente
 *   - mostrar toasts ni actualizar UI
 *   - decidir si el panel de corrección se expande o no (eso es UI)
 *
 * Nota: esto es una heurística, no una verdad absoluta — la rotación más
 * frecuente entre las páginas se asume correcta. Documentado aquí a propósito
 * para que una futura mejora del criterio de detección no requiera tocar
 * nada fuera de este archivo.
 */

export function analyzeOrientation(pageReadings) {
  if (!pageReadings || pageReadings.length === 0) {
    return { dominantRot: 0, warnPages: [] };
  }

  // Moda estadística de metaRot — mismo criterio que index.html v1.0
  const rotCounts = {};
  pageReadings.forEach((r) => {
    rotCounts[r.metaRot] = (rotCounts[r.metaRot] || 0) + 1;
  });

  const dominantRot = parseInt(
    Object.entries(rotCounts).sort((a, b) => b[1] - a[1])[0][0],
    10
  );

  const warnPages = pageReadings
    .filter((r) => r.metaRot !== dominantRot)
    .map((r) => ({
      pageIndex: r.pageIndex,
      currentRot: r.metaRot,
      suggestedDelta: (dominantRot - r.metaRot + 360) % 360,
    }));

  return { dominantRot, warnPages };
}
