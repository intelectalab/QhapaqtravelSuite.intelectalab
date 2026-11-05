/**
 * Valores esperados calculados con el prototipo (window.BookingEngine.quote / dayStatus)
 * sobre proto/index.html, con window.TODAY = 2026-09-29 y los datos de seeds/*.json.
 * Mismos números que pest/Datasets/prd011.php. Si cambian las semillas, recalcular
 * con el script del README («Recalcular valores esperados»).
 */
export const TODAY = '2026-09-29';

export const PRD011 = {
  code: 'PRD-011',
  slug: 'peru-clasico-10d9n', // catalog_products.slug (seeds/products.json)
  name: 'Perú Clásico 10D/9N: Lima, Arequipa, Puno y Cusco',

  /** Disponibilidad por rangos (availability.ranges del producto). */
  ranges: [
    { id: 'RG-1101', from: '2026-10-02', to: '2026-10-06', status: 'disponible', capacityPerDay: 12 },
    { id: 'RG-1102', from: '2026-10-07', to: '2026-10-09', status: 'cerrado', capacityPerDay: 0, note: 'Ocupado: grupo privado con toda la capacidad de guías' },
    { id: 'RG-1103', from: '2026-10-10', to: '2026-10-14', status: 'disponible', capacityPerDay: 12 },
  ],
  /** dayStatus con 2 asientos (valor por defecto del widget: 2 ADT). */
  daysFor2Seats: {
    '2026-10-01': { status: 'cerrado', left: 0 },     // antes del primer rango: «Sin salida programada»
    '2026-10-02': { status: 'disponible', left: 12 },
    '2026-10-06': { status: 'disponible', left: 12 },
    '2026-10-07': { status: 'cerrado', left: 0 },     // «Ocupado / cerrado»
    '2026-10-08': { status: 'cerrado', left: 0 },
    '2026-10-09': { status: 'cerrado', left: 0 },
    '2026-10-10': { status: 'disponible', left: 3 },  // «Últimos 3 cupos» (9 vendidos en semillas)
    '2026-10-12': { status: 'disponible', left: 9 },
    '2026-10-14': { status: 'disponible', left: 9 },
  },
  /** dayStatus con 4 asientos: el 10/10 ya no alcanza. */
  daysFor4Seats: { '2026-10-10': { status: 'sin_cupo', left: 3 }, '2026-10-12': { status: 'disponible', left: 9 } },

  /** Reglas de pasajeros del producto (paxRules). */
  pax: {
    ageType: { 3: 'INF', 4: 'CHD', 10: 'CHD', 11: 'ADT' },
    valid: [{ adt: 2, chd: 1, inf: 1, seats: 3 }, { adt: 2, chd: 2, inf: 2, seats: 4 }], // infantes no ocupan asiento
    invalid: [
      { adt: 2, chd: 5, inf: 0, error: 'Máximo 2 niño(s) de 4 a 10 años por cada adulto.' },
      { adt: 2, chd: 0, inf: 3, error: 'Máximo 1 infante(s) de 0 a 3 años por cada adulto.' },
      { adt: 0, chd: 1, inf: 0, error: 'Se requiere al menos 1 adulto(s) (11+ años).' },
      { adt: 16, chd: 1, inf: 0, error: 'Máximo 16 pasajeros por reserva.' },
    ],
  },
};

/**
 * Caso canónico PRD-011 (brief del kit): 12/10/2026 · 2 ADT + 1 CHD + 1 INF · alojamiento 3* en
 * las 4 ciudades (1 Doble + 1 Simple por ciudad) · Museo Larco ×3 · adelanto 30 % · canal Directo.
 */
export const CANONICAL_PEN = {
  currency: 'PEN',
  lines: {
    'base-adt': { qty: 2, unit: '5572.60', amount: '11145.20' },  // 1490 USD × 3.74
    'base-chd': { qty: 1, unit: '4076.60', amount: '4076.60' },   // tarifa Niño 1090 USD × 3.74
    'base-inf': { qty: 1, unit: '0.00', amount: '0.00' },         // infante no paga
    'addon-ADD-1101': { qty: 3, unit: '50.00', amount: '150.00' },
    'lodge-LEG-1-Doble': { qty: 1, amount: '317.90' },
    'lodge-LEG-1-Simple': { qty: 1, amount: '261.80' },
    'lodge-LEG-2-Doble': { qty: 2, amount: '508.64' },
    'lodge-LEG-2-Simple': { qty: 2, amount: '411.40' },
    'lodge-LEG-3-Doble': { qty: 2, amount: '463.76' },
    'lodge-LEG-3-Simple': { qty: 2, amount: '374.00' },
    'lodge-LEG-4-Doble': { qty: 4, amount: '897.60' },
    'lodge-LEG-4-Simple': { qty: 4, amount: '718.08' },
  },
  subtotal: '19324.98', total: '19324.98', depositPct: 30, deposit: '5797.49', balance: '13527.49',
  balanceDue: '2026-09-29', // 12/10 − 30 días < hoy → hoy + advertencia «La salida es cercana…»
  rooms: 8, nights: 9,
};
export const CANONICAL_USD = { subtotal: '5167.11', total: '5167.11', deposit: '1550.13', balance: '3616.98' };

/**
 * Escenario UI del widget/checkout (E2E-W1 de la esp. 17): igual que el canónico pero Museo Larco ×1
 * (un clic) y moneda USD. Luego se quita Lima (2 líneas de alojamiento).
 */
export const WIDGET_USD = {
  before: { total: '5140.37', deposit: '1542.11', balance: '3598.26', rooms: 8, nights: 9 },
  afterRemoveLima: { total: '4985.37', deposit: '1495.61', balance: '3489.76', rooms: 6, nights: 8 },
  afterRemoveLimaTotalMode: { total: '4985.37', deposit: '4985.37', balance: '0.00' },
};

/** Caso E2E-09 (esp. 04 T-R10). */
export const E2E09 = { reservation: 'RES-2026-000348', penalty: '53480.00', refund: '0.00', penaltyReceivable: '30036.00' };

/** Formateo de montos como lo muestra la UI (es-PE, 2 decimales). */
export const money = (v: string) => Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
