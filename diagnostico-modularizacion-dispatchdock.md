# Diagnóstico de arquitectura — DispatchDock v1.0
### Base para la modularización (sin implementar todavía)

> Nota de nomenclatura: el brief recibido se refiere al proyecto como "SmartDispatch"; el archivo fuente lo identifica como "DispatchDock — CEDIS Walmart" v1.0. Este diagnóstico asume que es el mismo proyecto y usa el nombre real del código: **DispatchDock**. Además, parte del trabajo de Fase 1 (Vite + extracción de módulos puros) ya está en curso — este documento lo tiene en cuenta en vez de proponer arrancar de cero.

---

## 1. Arquitectura actual

Todo vive en un único archivo (`index.html`, ~1000 líneas de JS embebido) con tres capas entrelazadas sin separación:

```
index.html
 ├── <style> CSS embebido (variables de diseño, componentes, responsive)
 ├── <body> HTML con 5 paneles secuenciales (wizard de 5 pasos)
 └── <script> inline
      ├── Estado global (8 variables de módulo)
      ├── Reglas de negocio (RULES, shouldUnify)
      ├── Lógica de parsing/transformación (parseList, buildAssignments)
      ├── Integración directa con pdfjsLib y PDFLib (vía CDN, sin SRI)
      ├── Manipulación directa del DOM (~40 llamadas a getElementById)
      ├── Handlers inline en HTML (onclick="...")
      └── Generación de archivos (Blob, ObjectURL, JSZip)
```

No hay build step, no hay módulos ES, no hay tests. El flujo entre pasos (1→5) está controlado por `setStep()`, que muta clases CSS directamente — es a la vez el "router" de la aplicación y una función de renderizado.

## 2. Responsabilidades detectadas

| Categoría | Funciones / bloques |
|---|---|
| **Dominio (reglas de negocio)** | `RULES`, `shouldUnify`, `buildAssignments`, `parseList`, `makeFilename`, `normalizeAngle` |
| **PDF (carga/lectura)** | `loadFile` (mitad carga, mitad UI), `analyzeOrientation`, `renderThumbnails`, `renderOneThumbnail` |
| **PDF (corrección)** | `rotateAll`, `resetAll`, `rotatePage`, `resetPage`, `autoFixOrientation`, `markThumbCorrection`, `markThumbWarn` |
| **PDF (exportación)** | `splitPDF` (usa `PDFLib.PDFDocument`) |
| **Parsing Excel** | `detectFromTable` (parseo TSV + detección de encabezados + aplicación de `shouldUnify`) — mezclado con actualización de DOM y toasts |
| **Estado / orquestación** | `setStep`, `refresh` (recalcula stats + valida + repinta preview, todo junto) |
| **UI / DOM** | `togglePanel`, `selectThumbPage`, `onPageSelectChange`, `showDownloads`, `toast`, `dismissToast` |
| **Exportación de archivos** | `downloadZip` (JSZip), generación de Blob/ObjectURL en `splitPDF` y `showDownloads` |

**Observación clave:** casi ninguna función es "pura". `detectFromTable`, `splitPDF`, `refresh` y `loadFile` mezclan cálculo + validación + efectos secundarios de DOM + toasts en el mismo bloque. Son los candidatos de mayor prioridad para separar.

## 3. Dependencias

- **pdf.js 3.11.174** — vía CDN (`cdnjs.cloudflare.com`), sin Subresource Integrity. Usado para: lectura de páginas, viewport, rotación detectada (`page.rotate`), renderizado de miniaturas en `<canvas>`.
  - ⚠️ **CVE conocido**: `GHSA-wgrm-67xf-hhpq` (RCE vía PDF malicioso) — ya identificado en tu auditoría previa, pendiente de tu aprobación por ser breaking change.
- **pdf-lib 1.17.1** — vía CDN, sin SRI. Usado en `splitPDF` para copiar páginas, aplicar rotación y generar los PDFs finales.
- **jszip 3.10.1** — vía CDN, sin SRI. Usado en `downloadZip`.
- **Google Fonts (Inter)** — vía `@import`, no crítico pero también sin control de versión local.

En tu Fase 1 ya migraste `pdf-lib`, `pdfjs-dist` y `jszip` a paquetes npm locales — eso resuelve el riesgo de cadena de suministro para este `index.html` una vez se integre con el build de Vite.

## 4. Estado global actual

```js
let pdfFile           = null;   // File — entrada cruda del usuario
let totalPages         = 0;      // derivado de pdfBytes, pero cacheado
let pdfBytes           = null;   // ArrayBuffer del PDF original
let pageRotations      = {};     // { pageIndex: deltaAngle } — correcciones manuales
let warnPages          = [];     // [{pageIndex, currentRot, suggestedDelta}]
let generatedFiles     = [];     // [{filename, bytes, url, type, unified}]
let currentStep        = 1;      // 1–5, controla wizard
let selectedThumbPage  = null;   // índice de miniatura seleccionada — 100% UI
```

Clasificación:
- **Persistente durante la sesión (dominio/PDF):** `pdfFile`, `pdfBytes`, `totalPages`, `pageRotations`, `generatedFiles`.
- **Derivado, no debería vivir en variables propias:** `totalPages` (se puede derivar de `pdfBytes` procesado), `warnPages` (resultado de `analyzeOrientation`, se recalcula, no se debería mutar desde fuera).
- **Exclusivamente UI:** `selectedThumbPage`, `currentStep` (aunque `currentStep` también gatea qué paneles están "unlocked", lo cual es lógica de flujo, no puramente visual — hay que decidir si vive en domain/app state o en UI state).
- **Implícito en el DOM, no en JS:** los valores de `all-input`, `fito-input`, `table-input` — el "estado" real de rutas vive en `<textarea>`, se lee bajo demanda con `parseList`. Esto es una fuente de acoplamiento fuerte a la UI que conviene resolver.

## 5. Funciones críticas (mayor riesgo si se rompen)

1. **`shouldUnify` / `RULES`** — corazón del negocio. Ya identificaste esto correctamente como prioridad de aislamiento y testing en tu Fase 1.
2. **`detectFromTable`** — parsing de Excel pegado + aplicación de unificación + construcción de rutas ordenadas + detección FITO. Alta complejidad ciclomática, cero tests, produce el input que alimenta todo el resto del flujo.
3. **`splitPDF`** — es la única función que efectivamente genera el output real (los PDFs). Un bug aquí no se nota hasta que el usuario abre el archivo descargado.
4. **`refresh`** — se ejecuta en cada `input` de las tres textareas; recalcula stats, validaciones y la tabla de preview. Es el punto de sincronización entre "lo que el usuario escribió" y "lo que se va a generar". Cualquier reordenamiento de fases debe preservar cuándo se llama.
5. **`analyzeOrientation`** — recorre todas las páginas con pdf.js, calcula rotación dominante, y decide si expandir el panel de corrección automáticamente. Efectos colaterales de UI mezclados con el cálculo.

## 6. Reglas de negocio detectadas

- **Unificación de rutas** (`RULES`, orden importa — la primera regla que no devuelve `null` gana):
  1. Tractores distintos → nunca unificar.
  2. Mismo tractor + misma caja/unidad → NO unificar (viaje repetido / económico).
  3. Mismo tractor + caja distinta → unificar.
  4. Fallback: mismo tractor sin info de caja → unificar (comportamiento legado, documentado como tal en el propio código).
- **Nomenclatura de archivos:** `"{ruta} {tipo}.pdf"` (`makeFilename`), tipo ∈ {CP, FITO}.
- **Rutas unificadas se etiquetan con guión**, ordenadas numéricamente ascendente (`sorted.join('-')`), no en orden de aparición.
- **FITO es opcional por ruta**, se determina por si la celda `CERT` contiene el substring `"FITO"` (case-insensitive) — no es un valor exacto, es un `includes`.
- **Validación de páginas:** compara `assignments.length` (páginas esperadas) contra `totalPages` (páginas reales del PDF) — tres estados: coincide, sobran páginas del PDF sin nombrar, o faltan páginas.
- **Detección de columnas Excel** es tolerante: busca encabezados en las primeras 5 filas, acepta variantes (`TRACTOR`/`TRACTO`, `UNIDAD`/`CAJA`/`TRAILER`).
- **Corrección de orientación:** la rotación "dominante" (moda estadística de `page.rotate` entre todas las páginas) se asume correcta; las páginas que se desvían son las "sospechosas". Esto es una heurística, no una verdad absoluta — vale la pena documentarla como tal en el dominio.

## 7. Problemas de acoplamiento

- **UI y dominio en la misma función**: `detectFromTable`, `splitPDF`, `refresh`, `loadFile`, `analyzeOrientation` — todas leen del DOM, calculan, y escriben al DOM/toast en el mismo cuerpo.
- **Estado de "rutas" vive en el DOM**, no en JS — cualquier lógica que necesite `allRoutes`/`fitoRoutes` debe pasar por `document.getElementById(...).value`, incluso `splitPDF`.
- **`pdfjsLib` y `PDFLib` se usan directamente en 6+ lugares distintos** en vez de detrás de una única puerta de entrada — cualquier cambio de librería (ej. resolver el CVE) obliga a tocar múltiples funciones.
- **40+ `document.getElementById`** dispersos, varios repetidos entre funciones (ej. `page-select` se lee en `rotatePage`, `resetPage`, `onPageSelectChange`, `reviewManually`).
- **Handlers `onclick=` inline en HTML** (~20 casos) — atan el marcado a nombres de función globales; un rediseño de interfaz no puede tocar el HTML sin also tocar el JS y viceversa.
- **`toast()` se llama desde código de dominio/procesamiento** (ej. dentro de `detectFromTable`, `splitPDF`) — la lógica de negocio decide cómo notificarse al usuario, en vez de devolver un resultado y dejar que la capa de aplicación decida.
- **XSS ya identificado por ti**: `innerHTML` con valores pegados de Excel sin escapar (en `detectFromTable`, en la tabla de preview de `refresh`) — confirmo que sigue presente en este `index.html`; tu `sanitize.js` ya extraído es el fix correcto, falta cablearlo aquí.

## 8. Riesgos del refactor

| Riesgo | Mitigación propuesta |
|---|---|
| Romper el orden de ejecución `loadFile → analyzeOrientation + renderThumbnails (en paralelo) → refresh` | Mantener este orden como contrato explícito del caso de uso `loadPdf`, documentado y cubierto por una prueba manual/checklist antes de avanzar de fase. |
| Perder la sincronía entre `pageRotations` (usado en preview, en miniaturas, y en `splitPDF`) | Centralizar en un único store de estado con una sola función de mutación (`setPageRotation`), no tres lugares que lo tocan directamente. |
| Cambiar el comportamiento del heurístico de orientación al "limpiarlo" | Extraerlo tal cual a `domain/orientation.js` sin tocar la lógica (moda estadística + comparación con dominante), solo mover, no reescribir. |
| ArrayBuffer detachment de `pdfBytes` (pdf.js y pdf-lib comparten el buffer, ya se maneja con `.slice(0)`) | Preservar exactamente este patrón al mover a un `pdfService` — es un detalle sutil que si se pierde rompe silenciosamente. |
| El CVE de `pdfjs-dist` sigue pendiente | No resolverlo dentro de esta fase de modularización — mover el código tal cual con la versión actual, dejar la actualización como tarea aparte (ya coordinada contigo). |
| Vite + ES Modules cambia cómo se abre la app localmente (ya no sirve doble-clic sobre `index.html` sin build) | Documentar explícitamente este cambio de flujo de ejecución como parte de la Fase F (bootstrap), no asumirlo implícito. |

## 9. Arquitectura modular propuesta

Partiendo de lo que ya extrajiste (`src/core`, `src/parser`, `src/utils`) y del brief recibido, propongo converger en esto — es una fusión, no una reescritura de tu estructura ya iniciada:

```
src/
├── domain/                    # lógica de negocio pura, sin DOM, sin librerías externas
│   ├── unification.js         # RULES + shouldUnify  (ya existe como unification-engine.js — renombrar o mantener alias)
│   ├── assignments.js         # buildAssignments, makeFilename (ya existe como assignment-builder.js)
│   ├── routes.js              # parseList, validación de correspondencia página/ruta
│   └── orientation.js         # heurística de rotación dominante (nuevo — hoy vive dentro de analyzeOrientation)
│
├── parser/
│   └── excel-table-parser.js  # ya existe — detección de encabezados + construcción de filas
│
├── core/
│   ├── angle.js                # ya existe — normalizeAngle
│   └── sanitize.js             # ya existe — escapeHtml
│
├── services/                   # única puerta de entrada a librerías externas
│   ├── pdfReadService.js       # envuelve pdfjsLib: load, getPageCount, getPage, analyzeOrientation, renderThumbnail
│   ├── pdfWriteService.js      # envuelve PDFLib: split, applyRotation, createBlob
│   └── zipService.js           # envuelve JSZip
│
├── app/
│   ├── state.js                # store único, con funciones de mutación explícitas (no variables sueltas)
│   └── useCases.js             # loadPdf, detectRoutes, splitAndExport — orquestan domain + services, sin tocar DOM
│
└── ui/
    ├── panels.js                # togglePanel, setStep (lectura del store, sin lógica de negocio)
    ├── thumbnails.js            # render de miniaturas, selección — consume pdfReadService vía use case
    ├── preview.js                # tabla de preview, refresh de stats
    ├── notifications.js          # toast/dismissToast
    └── main.js                   # bootstrap: conecta eventos del DOM a los use cases
```

Diferencia clave respecto al brief original: no separo `processors/` de `services/` como carpetas distintas, porque en este código ambas cosas coinciden (los "procesadores" de PDF son, en la práctica, los envoltorios de las librerías). Si más adelante aparece un procesador que no dependa de una librería externa (ej. un segundo formato de entrada que no sea Excel), ahí sí se justifica separar `processors/` de `services/`.

## 10. Árbol de carpetas (resumen ejecutable)

```
DispatchDock/
├── index.html          (solo shell + puntos de montaje, sin lógica)
├── vite.config.js       (ya existe)
├── package.json         (ya existe)
├── src/
│   ├── domain/
│   ├── parser/
│   ├── core/
│   ├── services/
│   ├── app/
│   ├── ui/
│   └── main.js
└── assets/
    └── css/             (extraer el <style> actual, sin cambios de valores)
```

## 11. Plan de migración por fases (continuación de tu Fase 1)

Dado que ya completaste buena parte de la Fase B ("Extraer Core") del brief, propongo:

- **Fase A — Inventario** ✅ completado con este diagnóstico.
- **Fase B — Extraer Core/Domain** — en curso. Falta: `routes.js` (parseList + validación página/ruta) y `orientation.js` (heurística, hoy embebida en `analyzeOrientation`).
- **Fase C — Extraer PDF (services)** — pendiente. Aislar `pdfjsLib`/`PDFLib` detrás de `pdfReadService`/`pdfWriteService`. Este es el paso de mayor riesgo por el patrón de `ArrayBuffer.slice(0)` — requiere cuidado especial.
- **Fase D — Extraer exportación** — pendiente. `zipService.js`, mover la generación de Blob/ObjectURL fuera de `splitPDF`.
- **Fase E — Extraer UI** — pendiente. Reemplazar `onclick=` inline por listeners en `main.js`; separar `toast`, `panels`, `thumbnails`, `preview`.
- **Fase F — Bootstrap** — pendiente. `main.js` como único punto de entrada; documentar el cambio de flujo de ejecución local (Vite dev server / build, ya no doble-clic sobre el HTML).
- **Fase G — Validación** — checklist manual del flujo completo (cargar → orientar → corregir → detectar → unificar → validar páginas → preview → dividir → generar → ZIP) contra la versión de referencia (este `index.html`).

Cada fase se implementa y se verifica antes de pasar a la siguiente, siguiendo el protocolo de 5 pasos que ya aprobaste (explicar → justificar → riesgos → implementar → verificar).

## 12. Qué conservar exactamente sin modificar

- El orden y contenido exacto de `RULES` (incluyendo el fallback "legado" documentado en el propio comentario del código).
- El heurístico de orientación dominante tal cual está (moda estadística de `page.rotate`).
- El patrón `pdfBytes.slice(0)` para evitar el detachment del ArrayBuffer entre pdf.js y pdf-lib.
- La detección tolerante de encabezados Excel (variantes de nombre de columna, búsqueda en las primeras 5 filas).
- El comportamiento de `includes('FITO')` para detectar certificación (no es un match exacto, es intencional).
- El comportamiento de página/ruta cuando no coinciden (los tres estados: exacto, sobran, faltan) y sus mensajes.
- Todos los textos visibles al usuario (español, CEDIS Walmart) — cero cambios de copy en esta fase.

## 13. Elementos a dejar preparados para el futuro rediseño

- **Ningún módulo de `domain/` o `services/` debe importar nada de `ui/`** — esto es lo que garantiza que el rediseño solo toque `ui/` y `app/main.js`.
- Los use cases en `app/useCases.js` deben devolver datos/resultados, nunca llamar a `toast()` o tocar el DOM directamente — que la UI decida cómo mostrarlo (abre la puerta a, por ejemplo, un futuro dashboard que muestre los mismos resultados sin toasts).
- El store en `app/state.js` debe exponer solo funciones de mutación con nombre (`setPageRotation`, `setGeneratedFiles`, etc.), nunca las variables crudas — así una futura UI (o incluso un panel de administración) puede suscribirse sin acoplarse a la forma interna.
- Mantener `pdfReadService`/`pdfWriteService` como la única frontera con `pdfjs-dist`/`pdf-lib` — cuando resuelvas el CVE con la versión nueva, el cambio debería quedar contenido ahí.
- Documentar el heurístico de orientación como heurística (no regla fija) en el propio módulo — así una futura mejora de detección no requiere tocar el resto del sistema.

---

**Sin implementar todavía**, tal como pediste. Quedo a la espera de tu aprobación para arrancar con la Fase C (services de PDF), que es la que continúa naturalmente después de lo que ya tienes hecho en Fase B.
