/**
 * services/ocrService.js
 *
 * Responsabilidad:
 *   Única puerta de entrada a Tesseract.js. Carga la librería y el
 *   worker SOLO cuando se pide una validación OCR por primera vez —
 *   nunca en el arranque de la app. Esto es intencional: OCR es una
 *   herramienta opcional ("Validar FITO con OCR"), no debe pagar su
 *   costo (descarga + inicialización) quien no la usa.
 *
 * Dependencias:
 *   - Tesseract.js, inyectado dinámicamente vía <script> (CDN) la
 *     primera vez que se llama a recognizeText().
 *   - assets/tessdata/spa.traineddata — paquete de idioma español servido
 *     desde el propio origen. Esto NO es cosmético: el CDN oficial de
 *     tessdata y cdnjs están bloqueados por el firewall corporativo (ver
 *     sesión de evaluación de viabilidad); sin este archivo local, OCR
 *     se queda colgado descargando el paquete de idioma para siempre.
 *
 * No puede:
 *   - decidir qué hacer con el texto reconocido (eso es
 *     domain/fitoValidation.js) ni tocar el DOM de resultados (ui/).
 */

const TESSERACT_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/tesseract.min.js';
const LANG_PATH = './assets/tessdata'; // Tesseract busca aquí `${lang}.traineddata`

let scriptPromise = null;
let workerPromise = null;

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TESSERACT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Tesseract.js desde el CDN.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

async function getWorker(onProgress) {
  if (!workerPromise) {
    await loadTesseractScript();
    workerPromise = window.Tesseract.createWorker('spa', 1, {
      langPath: LANG_PATH,
      gzip: false,
      logger: onProgress,
    });
  }
  return workerPromise;
}

/**
 * Reconoce el texto de un <canvas> (una página ya renderizada en alta
 * resolución por pdfReadService.renderPageForOcr). Reusa el mismo worker
 * entre llamadas sucesivas — crear un worker de Tesseract es costoso,
 * no vale la pena repetirlo por cada página.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {(info: {status:string, progress:number}) => void} [onProgress]
 * @returns {Promise<{text:string, confidence:number}>}
 */
export async function recognizeText(canvas, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas);
  return { text: data.text, confidence: data.confidence };
}

/** Libera el worker de OCR. No es obligatorio llamarlo — es una optimización
 * de memoria para sesiones largas, no afecta la corrección del resultado. */
export async function terminateOcr() {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
  }
}
