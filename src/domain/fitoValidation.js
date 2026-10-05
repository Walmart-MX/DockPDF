/**
 * domain/fitoValidation.js
 *
 * Responsabilidad:
 *   Decidir, a partir de texto ya extraído por OCR, si una página "parece"
 *   un certificado fitosanitario real. Es una heurística de palabras
 *   clave — NUNCA una prueba legal/oficial — por eso el resultado debe
 *   usarse como advertencia para que el operador revise, nunca como
 *   bloqueo automático.
 *
 * No puede:
 *   - tocar el DOM, pdfjsLib ni Tesseract directamente — recibe texto
 *     plano y devuelve un veredicto. Función pura, fácil de testear.
 */

// Frases fijas que, según el formato oficial del Servicio Nacional de
// Sanidad, Inocuidad y Calidad Agroalimentaria (SENASICA), siempre
// aparecen en un Certificado Fitosanitario para la Movilización
// Nacional — confirmadas contra un ejemplar real durante la evaluación
// de viabilidad de esta función (10/10 encontradas, 76% confianza OCR).
export const FITO_KEYWORDS = [
  'SECRETARIA DE AGRICULTURA',
  'DESARROLLO RURAL',
  'SERVICIO NACIONAL DE SANIDAD',
  'INOCUIDAD Y CALIDAD AGROALIMENTARIA',
  'CERTIFICADO FITOSANITARIO',
  'MOVILIZACION NACIONAL',
  'PRODUCTOS VEGETALES',
  'DECLARACIONES ADICIONALES',
  'NOMBRE Y DOMICILIO DEL SOLICITANTE',
  'NOMBRE Y DOMICILIO DEL DESTINATARIO',
];

// Si se reconoce al menos esta fracción de las palabras clave, se considera
// que el documento "parece" un FITO real. No es un umbral mágico — 60%
// tolera el ruido normal de OCR en sellos/tablas sin dejar pasar como
// válido un documento que claramente no es un certificado.
const MIN_MATCH_RATIO = 0.6;

function normalize(text) {
  return String(text || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos para comparar sin importar como los leyó el OCR
    .replace(/\s+/g, ' ');
}

/**
 * @typedef {Object} FitoValidationResult
 * @property {boolean} isLikelyFito
 * @property {number} matchedCount
 * @property {number} total
 * @property {string[]} missingKeywords
 */

/**
 * @param {string} ocrText - texto crudo devuelto por el OCR
 * @returns {FitoValidationResult}
 */
export function validateFitoText(ocrText) {
  const normText = normalize(ocrText);
  const results = FITO_KEYWORDS.map((kw) => ({ kw, found: normText.includes(normalize(kw)) }));
  const matchedCount = results.filter((r) => r.found).length;
  const missingKeywords = results.filter((r) => !r.found).map((r) => r.kw);
  const isLikelyFito = matchedCount / FITO_KEYWORDS.length >= MIN_MATCH_RATIO;
  return { isLikelyFito, matchedCount, total: FITO_KEYWORDS.length, missingKeywords };
}
