/**
 * domain/walmartCalendar.js
 *
 * Responsabilidad:
 *   Traducir una fecha calendario a las coordenadas operativas de Walmart:
 *   día operativo (sábado=1 ... viernes=7) y semana fiscal (año 4-5-4,
 *   arranca el sábado de la semana que contiene el 1 de febrero). También
 *   formatea fechas para el nombre del ZIP y para mostrar en pantalla.
 *
 * Entrada / Salida: ver JSDoc de cada función.
 *
 * No puede:
 *   - acceder al DOM
 *   - saber nada de rutas, PDFs ni Supabase — solo fechas.
 *
 * Sobre la fórmula de semana fiscal:
 *   Validada contra un dato real confirmado por el usuario: la semana 28
 *   del año fiscal 2027 (FY27) arranca el sábado 8 de agosto de 2026. La
 *   fórmula de abajo reproduce exactamente esa fecha — no es una
 *   estimación, es aritmética de calendario verificada.
 *
 *   Convención de nombre de año fiscal: el año fiscal que arranca en
 *   febrero de un año calendario Y se llama "FY(Y+1)" — igual que Walmart
 *   nombra su año fiscal por el año en el que termina (~enero del año
 *   siguiente), no por el año en que empieza.
 *
 * Límite conocido, sin resolver a propósito:
 *   Los años fiscales 4-5-4 ocasionalmente tienen 53 semanas en vez de 52
 *   (realineación periódica). Esta implementación no falla con eso —
 *   siempre recalcula el inicio de cada año fiscal desde el 1 de febrero
 *   real de ese año, en vez de asumir 364 días fijos — pero no hay manera
 *   de confirmar sin una fuente oficial si un año específico tiene 53
 *   semanas. Si alguna semana se ve "corrida" en un año así, es la señal
 *   de que hay que revisar este caso con un dato real de ese año, igual
 *   que se hizo para validar la fórmula base.
 */

const SPANISH_MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SPANISH_DAYS_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Día operativo Walmart: sábado = 1, ..., viernes = 7.
 * @param {Date} date
 * @returns {number} 1-7
 */
export function getOperationalDay(date) {
  const jsWeekday = date.getDay(); // 0=domingo ... 6=sábado
  return ((jsWeekday - 6 + 7) % 7) + 1;
}

/**
 * Sábado que arranca la semana (sáb-vie) que contiene el 1 de febrero del
 * año calendario dado. Es el inicio del año fiscal que se llama
 * "FY(calendarYear + 1)".
 * @param {number} calendarYear
 * @returns {Date}
 */
function fiscalYearStart(calendarYear) {
  const feb1 = new Date(calendarYear, 1, 1); // mes 1 = febrero (0-indexed)
  const jsWeekday = feb1.getDay(); // 0=domingo ... 6=sábado
  const daysSinceSaturday = (jsWeekday - 6 + 7) % 7;
  const start = new Date(feb1);
  start.setDate(feb1.getDate() - daysSinceSaturday);
  return start;
}

/**
 * Semana fiscal Walmart para una fecha dada.
 * @param {Date} date
 * @returns {{fiscalYear: number, week: number}} fiscalYear ya viene como
 *   "27" para FY27 (año en que termina el año fiscal), week es 1-53.
 */
export function getFiscalWeek(date) {
  // La fecha puede caer en el año fiscal que arrancó en febrero del mismo
  // año calendario, o en el que arrancó en febrero del año anterior (si
  // la fecha es de enero, antes de que arranque el nuevo año fiscal).
  const candidates = [date.getFullYear(), date.getFullYear() - 1];

  for (const calendarYear of candidates) {
    const start = fiscalYearStart(calendarYear);
    if (date < start) continue;
    const diffDays = Math.round((date - start) / 86400000);
    const week = Math.floor(diffDays / 7) + 1;
    // Un año fiscal nunca pasa de 53 semanas — si da más, esta no es la
    // candidata correcta (la fecha ya pertenece al siguiente año fiscal).
    if (week <= 53) {
      return { fiscalYear: (calendarYear + 1) % 100, week };
    }
  }

  // No debería llegar aquí con fechas razonables — devuelve un valor
  // marcado como inválido en vez de reventar, para que quien llama decida.
  return { fiscalYear: null, week: null };
}

/**
 * Formato compacto día-mes para el nombre del ZIP, ej. "09-08".
 * @param {Date} date
 * @returns {string}
 */
export function formatDayMonth(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}`;
}

/**
 * Formato legible para UI, ej. "Sáb 9 Ago".
 * @param {Date} date
 * @returns {string}
 */
export function formatFriendly(date) {
  const dayName = SPANISH_DAYS_SHORT[date.getDay()];
  const dayNum = date.getDate();
  const monthName = SPANISH_MONTHS_SHORT[date.getMonth()];
  const capitalized = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${capitalized(dayName)} ${dayNum} ${capitalized(monthName)}`;
}

/**
 * Etiqueta de semana fiscal para UI/nombre de archivo, ej. "SW28".
 * @param {Date} date
 * @returns {string}
 */
export function formatFiscalWeekLabel(date) {
  const { week } = getFiscalWeek(date);
  if (week === null) return 'SW?';
  return `SW${week}`;
}
