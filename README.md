# DispatchDock — CEDIS Walmart

Herramienta de despacho: procesa PDFs escaneados de rutas, los empareja
contra datos pegados desde Excel, corrige orientación de páginas, detecta
rutas unificadas (mismo tractor, distinta caja) y genera un PDF por
ruta/tipo (CP, FITO) con exportación en ZIP.

Este documento cierra la Fase F de la modularización: cómo correr el
proyecto ahora que `index.html` pasó de monolito a cascarón + módulos ES.

---

## Cómo correr el proyecto localmente

**Importante — esto cambió respecto a la versión monolítica anterior:**
`index.html` ahora carga `src/main.js` como `<script type="module">`. Los
navegadores bloquean módulos ES cargados por `file://` (política CORS), así
que **ya no funciona abrir `index.html` con doble clic**. Hay que servirlo
con cualquier servidor local simple — no hace falta instalar nada más que
lo que ya tengas:

```bash
# Opción 1 — Python (viene preinstalado en la mayoría de los sistemas)
python3 -m http.server 8080

# Opción 2 — Node (si tienes Node instalado, sin necesidad de package.json)
npx serve .
```

Luego abre `http://localhost:8080` (o el puerto que indique la consola).

No se agregó `package.json` ni ninguna herramienta de build a propósito —
seguimos sin bundler, tal como se definió al inicio del proyecto. `npx
serve` es solo un servidor estático, no un paso de compilación.

---

## Estructura del proyecto

```
DispatchDock/
├── index.html                  HTML + CSS puro. Cero JavaScript, cero onclick=.
└── src/
    ├── main.js                 Único punto de entrada: estado de sesión,
    │                           orquestación, wiring de eventos.
    │
    ├── core/
    │   └── angle.js            normalizeAngle — utilidad pura de ángulos.
    │
    ├── domain/                 Lógica de negocio pura. Sin DOM, sin librerías externas.
    │   ├── unification.js      RULES + shouldUnify (unificación por tractor/caja).
    │   ├── assignments.js      buildAssignments + makeFilename.
    │   ├── routes.js           parseList, evaluatePageMatch, computeMismatchWarnings.
    │   └── orientation.js      Heurística de rotación dominante.
    │
    ├── parser/
    │   └── excelTableParser.js Parsing del texto pegado desde Excel (TSV).
    │
    ├── services/                Única puerta de entrada a cada librería CDN.
    │   ├── pdfReadService.js   pdfjsLib — carga, metadata, miniaturas, orientación.
    │   ├── pdfWriteService.js  PDFLib — genera los PDFs individuales.
    │   ├── zipService.js       JSZip — construye el blob del ZIP.
    │   └── fileService.js      Descarga de blobs, nombres de archivo (sin librería externa).
    │
    └── ui/                      Renderizado y DOM. No conoce reglas de negocio.
        ├── notifications.js    toast / dismissToast.
        ├── panels.js            Navegación del wizard (setStep) y colapso de paneles.
        ├── thumbnails.js       Tira de miniaturas y selección de página.
        ├── preview.js           Stats, validación de páginas, tabla de vista previa.
        └── downloads.js        Grilla de archivos generados.
```

**Regla que se mantuvo en todas las fases:** `domain/` y `services/` no
importan nada de `ui/`. Esto es lo que permite que un futuro rediseño de
interfaz solo toque `ui/` y `main.js`, sin tocar la lógica de negocio ni
los servicios.

---

## Qué se preservó exactamente, sin cambios de comportamiento

- El orden de las reglas de unificación (`RULES`), incluyendo el
  comportamiento legado de la Regla 4 (mismo tractor sin info de caja →
  unifica por default).
- El heurístico de orientación dominante (moda estadística de `page.rotate`).
- El patrón `bytes.slice(0)` para que pdf.js no "detache" el ArrayBuffer
  que pdf-lib necesita después.
- El comportamiento del panel 1 en `loadFile`: usa `togglePanel` (toggle
  real), no una versión que solo colapsa — si cargas un segundo PDF, el
  panel 1 se reabre. Es así en el original; no se "corrigió".
- Todos los textos visibles al usuario, en español, sin cambios de copy.
- Los tres estados de validación de páginas (coincide / sobran / faltan) y
  sus mensajes exactos.

---

## Deuda técnica conocida (no resuelta en esta fase, a propósito)

| Ítem | Estado |
|---|---|
| `pdfjs-dist` en la versión CDN tiene un CVE conocido (`GHSA-wgrm-67xf-hhpq`, RCE vía PDF malicioso) | Pendiente de tu aprobación — la actualización rompe la API en varios puntos. |
| `innerHTML` con nombres de ruta/archivo sin escapar (en `ui/preview.js` y `ui/downloads.js`) | Riesgo de XSS si alguien pega datos maliciosos en el Excel. Ya identificado, no corregido — cambiar esto altera comportamiento (habría que decidir qué caracteres se escapan) y no era parte del alcance de "modularizar sin romper". |
| Sin `app/state.js` centralizado con mutadores nombrados | `main.js` sigue usando variables `let` sueltas para el estado de sesión (`pdfFile`, `pageRotations`, etc.), tal como estaba. Es la recomendación pendiente del diagnóstico original para un futuro rediseño, no bloqueante ahora. |
| `revokeGeneratedUrls`/`revokeUrl` (liberación de ObjectURLs entre splits sucesivos) | Implementadas y disponibles en los servicios, pero no activadas — el original tampoco liberaba esas URLs. |
| Sin tests automatizados | Los módulos de `domain/` y `parser/` son funciones puras — listos para testear cuando se decida agregar un framework de pruebas, pero no hay ninguno configurado todavía. |
| Sin SRI (Subresource Integrity) en los `<script>` de CDN | Mismo riesgo que tenía la v1.0, no se tocó. |

---

## Checklist de validación manual (Fase G)

Antes de dar por cerrada la modularización, prueba esto contra un PDF real
y compáralo con tu copia de referencia del monolito original:

- [ ] Cargar un PDF → miniaturas se renderizan, contador de páginas correcto.
- [ ] Cargar un **segundo** PDF sin refrescar la página → confirma el
      comportamiento del panel 1 descrito arriba.
- [ ] PDF con páginas en distinta orientación → aparece el banner de
      advertencia con los 3 botones (Corregir automáticamente / Revisar
      manualmente / Ignorar) — cada uno debe funcionar.
- [ ] Rotar una página individual y luego resetearla.
- [ ] Rotar todas las páginas y luego resetear todas.
- [ ] Pegar una tabla de Excel válida (con y sin columna UNIDAD) →
      detección automática llena los textareas y muestra los chips
      correctos.
- [ ] Pegar texto sin encabezado RUTA/TRACTOR → debe mostrar el toast de
      error, sin romper nada.
- [ ] Configurar rutas manualmente (sin usar detección automática).
- [ ] Caso de rutas unificadas (mismo tractor, distinta caja) → aparecen
      con guión y tag "UNIF" en la vista previa.
- [ ] Caso de páginas sobrantes/faltantes → mensajes de advertencia/error
      correctos en el sidebar y en la alerta inline.
- [ ] Dividir el PDF → se generan los archivos, cada uno con el nombre
      correcto y la rotación aplicada donde corresponda.
- [ ] Descargar un archivo individual.
- [ ] Descargar el ZIP completo.
- [ ] Confirmar en consola del navegador que no hay errores ni warnings
      inesperados durante todo el flujo.

---

## Qué sigue (no bloqueante, para cuando decidas continuar)

- Completar la Fase G con el checklist de arriba.
- Decidir si se actualiza `pdfjs-dist` (resuelve el CVE, requiere ajustar
  `pdfReadService.js` a la API nueva).
- Evaluar si vale la pena introducir `app/state.js` con mutadores nombrados
  antes de empezar el rediseño de interfaz — facilitaría que una futura UI
  (o un dashboard) se suscriba al estado sin acoplarse a variables sueltas.
- Rediseño de interfaz: con `domain/` y `services/` completamente aislados
  de `ui/`, este es el momento en el que "cambiamos la capa UI; el dominio,
  servicios y procesamiento permanecen" — el objetivo original del proyecto.
