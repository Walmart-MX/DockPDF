/**
 * domain/assignments.js
 *
 * Responsabilidad:
 *   Construir la lista de asignaciones (una por archivo a generar: CP y,
 *   si aplica, FITO) a partir de las rutas configuradas, y resolver el
 *   nombre de archivo de cada una. Idéntico a buildAssignments/makeFilename
 *   de index.html v1.0.
 *
 * Entrada / Salida: ver JSDoc de cada función.
 *
 * No puede:
 *   - acceder al DOM
 *   - mostrar toasts
 *   - decidir si dos rutas se unifican (eso es domain/unification.js —
 *     aquí solo se usa el resultado, vía el guión en el string de ruta)
 */

/**
 * @typedef {Object} Assignment
 * @property {string} route
 * @property {'CP'|'FITO'} type
 * @property {boolean} unified
 */

/**
 * @param {string[]} allRoutes - rutas en orden de escaneo (unificadas con guión, ej. "2101-2102")
 * @param {Set<string>} fitoSet - subconjunto de allRoutes que además requieren FITO
 * @returns {Assignment[]}
 */
export function buildAssignments(allRoutes, fitoSet) {
  return allRoutes.flatMap((route) => {
    const a = [{ route, type: 'CP', unified: route.includes('-') }];
    if (fitoSet.has(route)) a.push({ route, type: 'FITO', unified: route.includes('-') });
    return a;
  });
}

/**
 * @param {string} route
 * @param {'CP'|'FITO'} type
 * @returns {string}
 */
export function makeFilename(route, type) {
  return `${route} ${type}.pdf`;
}
