/**
 * ============================================================================
 * DATOS DE REFERENCIA TÉCNICA - POLLOS DE ENGORDE (NO SON DATOS DE DEMO)
 * ============================================================================
 * Tablas estándar de la industria (aproximadas a las guías de líneas comerciales
 * tipo Cobb 500 / Ross 308) para:
 *  - Peso ideal por día (machos / hembras), días 1..56.
 *  - Consumo de alimento g/pollo/día, días 1..56.
 *  - Etapas de alimentación (ajustadas a los días de producción del lote).
 *  - Plan sanitario base sugerido por día de vida (el usuario lo activa/edita).
 * Son constantes técnicas: ningún registro de la granja se crea a partir de aquí
 * salvo que el usuario lo pida al crear un lote.
 */

import { AvicolaBreed, AvicolaStage } from './FarmModel';

export const AVICOLA_BREEDS: AvicolaBreed[] = ['Sin raza', 'Cobb 500', 'Ross 308', 'Hubbard', 'Arbor Acres', 'Otra'];
export const AVICOLA_PRODUCTION_DAY_SHORTCUTS = [35, 42, 45, 49, 56];
export const AVICOLA_DEFAULT_PRODUCTION_DAYS = 42;
export const AVICOLA_MIN_PRODUCTION_DAYS = 28;
export const AVICOLA_MAX_PRODUCTION_DAYS = 90;
/** Peso de un bulto estándar de alimento (kg). */
export const FEED_BAG_KG = 40;
export const AVICOLA_STAGES: AvicolaStage[] = ['Preinicio', 'Inicio', 'Engorde', 'Finalización'];

/** Último día con valores explícitos en las tablas (días posteriores usan el último valor). */
export const REFERENCE_TABLE_LAST_DAY = 56;

/** Factor de ajuste del peso ideal según la línea genética (1 = tabla base). */
export const BREED_WEIGHT_FACTOR: Record<string, number> = {
  'Sin raza': 1,
  'Cobb 500': 1,
  'Ross 308': 1,
  Hubbard: 0.97,
  'Arbor Acres': 0.99,
  Otra: 1,
};

// ----------------------------------------------------------------------------
// Construcción de tablas por interpolación lineal entre puntos de control
// ----------------------------------------------------------------------------
function buildTable(points: Array<[number, number]>, lastDay: number): number[] {
  // Devuelve un arreglo indexado por día (índice 0 sin uso).
  const out: number[] = [0];
  for (let day = 1; day <= lastDay; day++) {
    const exact = points.find((p) => p[0] === day);
    if (exact) {
      out.push(exact[1]);
      continue;
    }
    let lo = points[0];
    let hi = points[points.length - 1];
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i][0] <= day && points[i + 1][0] >= day) {
        lo = points[i];
        hi = points[i + 1];
        break;
      }
    }
    const t = hi[0] === lo[0] ? 0 : (day - lo[0]) / (hi[0] - lo[0]);
    out.push(Math.round(lo[1] + (hi[1] - lo[1]) * t));
  }
  return out;
}

/** Peso corporal ideal (g) machos: días 1-14 explícitos, luego puntos semanales. */
const MALE_POINTS: Array<[number, number]> = [
  [1, 42], [2, 55], [3, 72], [4, 93], [5, 118], [6, 148], [7, 181], [8, 219], [9, 260], [10, 305],
  [11, 355], [12, 409], [13, 467], [14, 528], [21, 1000], [28, 1560], [35, 2150], [42, 2720],
  [49, 3250], [56, 3720],
];
/** Peso corporal ideal (g) hembras. */
const FEMALE_POINTS: Array<[number, number]> = [
  [1, 41], [2, 53], [3, 68], [4, 87], [5, 108], [6, 133], [7, 161], [8, 192], [9, 226], [10, 263],
  [11, 304], [12, 348], [13, 396], [14, 446], [21, 840], [28, 1300], [35, 1780], [42, 2250],
  [49, 2680], [56, 3060],
];
/** Consumo de alimento g/pollo/día. */
const FEED_POINTS: Array<[number, number]> = [
  [1, 16], [2, 18], [3, 21], [4, 24], [5, 27], [6, 31], [7, 35], [14, 75], [21, 115], [28, 146],
  [35, 166], [42, 179], [49, 186], [56, 190],
];

const MALE_TABLE = buildTable(MALE_POINTS, REFERENCE_TABLE_LAST_DAY);
const FEMALE_TABLE = buildTable(FEMALE_POINTS, REFERENCE_TABLE_LAST_DAY);
const FEED_TABLE = buildTable(FEED_POINTS, REFERENCE_TABLE_LAST_DAY);

const clampDay = (day: number) => Math.min(REFERENCE_TABLE_LAST_DAY, Math.max(1, Math.round(day || 1)));

export interface IdealWeightRow {
  day: number;
  malesG: number;
  femalesG: number;
  /** Promedio mixto (machos + hembras) / 2. */
  mixedG: number;
}

/** Peso ideal para un día de vida y raza. */
export function idealWeightForDay(day: number, breed: string = 'Sin raza'): IdealWeightRow {
  const d = clampDay(day);
  const f = BREED_WEIGHT_FACTOR[breed] ?? 1;
  const malesG = Math.round(MALE_TABLE[d] * f);
  const femalesG = Math.round(FEMALE_TABLE[d] * f);
  return { day: Math.round(day || 1), malesG, femalesG, mixedG: Math.round((malesG + femalesG) / 2) };
}

/** Tabla de peso ideal días 1..hasta (por defecto 56). */
export function idealWeightTable(breed: string = 'Sin raza', toDay: number = REFERENCE_TABLE_LAST_DAY): IdealWeightRow[] {
  const last = Math.max(1, Math.round(toDay));
  return Array.from({ length: last }, (_, i) => idealWeightForDay(i + 1, breed));
}

/** Consumo de alimento g/pollo para un día de vida. */
export function feedGramsPerBirdForDay(day: number): number {
  return FEED_TABLE[clampDay(day)];
}

// ----------------------------------------------------------------------------
// Etapas de alimentación
// ----------------------------------------------------------------------------
export interface StageRange {
  stage: AvicolaStage;
  fromDay: number;
  toDay: number;
}

/**
 * Etapas ajustadas a los días de producción (ciclo base de 42 días):
 * Preinicio 1-10, Inicio 11-21, Engorde 22-(P-7), Finalización (P-6)-P.
 * Con ciclos cortos la Finalización empieza como mínimo el día 23.
 */
export function stageRanges(productionDays: number): StageRange[] {
  const P = Math.max(AVICOLA_MIN_PRODUCTION_DAYS, Math.round(productionDays || AVICOLA_DEFAULT_PRODUCTION_DAYS));
  const finStart = Math.max(23, P - 6);
  return [
    { stage: 'Preinicio', fromDay: 1, toDay: 10 },
    { stage: 'Inicio', fromDay: 11, toDay: 21 },
    { stage: 'Engorde', fromDay: 22, toDay: finStart - 1 },
    { stage: 'Finalización', fromDay: finStart, toDay: P },
  ];
}

// ----------------------------------------------------------------------------
// Plan sanitario base sugerido
// ----------------------------------------------------------------------------
export type AvicolaActivityKind =
  | 'vacuna'
  | 'vitamina'
  | 'medicamento'
  | 'desinfeccion'
  | 'cama'
  | 'pesaje'
  | 'alimentacion'
  | 'otro';

export const AVICOLA_ACTIVITY_KINDS: { key: AvicolaActivityKind; label: string }[] = [
  { key: 'vacuna', label: 'Vacuna' },
  { key: 'vitamina', label: 'Vitaminas' },
  { key: 'medicamento', label: 'Medicamento' },
  { key: 'desinfeccion', label: 'Desinfección' },
  { key: 'cama', label: 'Cambio / manejo de cama' },
  { key: 'pesaje', label: 'Pesaje' },
  { key: 'alimentacion', label: 'Cambio de alimento' },
  { key: 'otro', label: 'Otro' },
];

export interface AvicolaPlanItem {
  /** Clave estable del paso (protocolKey de la tarea). */
  key: string;
  /** Día de vida (1 = día de inicio). Negativo = días antes del sacrificio (ej. -7). */
  day: number;
  kind: AvicolaActivityKind;
  title: string;
  procedure: string;
  medicament?: string;
  dosage?: string;
  /** Activado por defecto en el formulario de nuevo lote. */
  defaultEnabled: boolean;
}

/**
 * Plan sanitario base de pollo de engorde (referencia general; ajustar al
 * programa del veterinario y a la situación epidemiológica de la zona).
 */
export const AVICOLA_BASE_SANITARY_PLAN: AvicolaPlanItem[] = [
  { key: 'desinfeccion_d1', day: 1, kind: 'desinfeccion', title: 'Recepción: galpón desinfectado y cama nueva', procedure: 'Verificar desinfección del galpón, cama seca, temperatura de criadora 32-33 °C y agua limpia antes de recibir los pollitos.', defaultEnabled: true },
  { key: 'vitaminas_d1', day: 1, kind: 'vitamina', title: 'Vitaminas y electrolitos (días 1 a 3)', procedure: 'Suministrar vitaminas + electrolitos en el agua de bebida durante los primeros 3 días para reducir el estrés de transporte.', medicament: 'Vitaminas + electrolitos', dosage: 'Según etiqueta, en agua', defaultEnabled: true },
  { key: 'newcastle_bronquitis_d7', day: 7, kind: 'vacuna', title: 'Vacuna Newcastle + Bronquitis', procedure: 'Vacunación ocular o en agua de bebida contra Newcastle y Bronquitis infecciosa.', medicament: 'Vacuna Newcastle + Bronquitis (cepa B1/Mass)', dosage: '1 dosis por ave', defaultEnabled: true },
  { key: 'pesaje_d7', day: 7, kind: 'pesaje', title: 'Pesaje de control semana 1', procedure: 'Pesar una muestra (mínimo 2% o 50 aves) y registrar el peso promedio.', defaultEnabled: false },
  { key: 'alimento_inicio_d11', day: 11, kind: 'alimentacion', title: 'Cambio a alimento de Inicio', procedure: 'Pasar de alimento preinicio a inicio de forma gradual (mezcla 2 días).', defaultEnabled: false },
  { key: 'gumboro_d14', day: 14, kind: 'vacuna', title: 'Vacuna Gumboro', procedure: 'Vacunación contra Gumboro (enfermedad infecciosa de la bursa) en agua de bebida.', medicament: 'Vacuna Gumboro intermedia', dosage: '1 dosis por ave', defaultEnabled: true },
  { key: 'pesaje_d14', day: 14, kind: 'pesaje', title: 'Pesaje de control semana 2', procedure: 'Pesar una muestra y comparar con la tabla de peso ideal.', defaultEnabled: false },
  { key: 'newcastle_refuerzo_d21', day: 21, kind: 'vacuna', title: 'Refuerzo Newcastle', procedure: 'Revacunación contra Newcastle en agua de bebida.', medicament: 'Vacuna Newcastle (La Sota)', dosage: '1 dosis por ave', defaultEnabled: true },
  { key: 'pesaje_d21', day: 21, kind: 'pesaje', title: 'Pesaje de control semana 3', procedure: 'Pesar una muestra y comparar con la tabla de peso ideal.', defaultEnabled: false },
  { key: 'alimento_engorde_d22', day: 22, kind: 'alimentacion', title: 'Cambio a alimento de Engorde', procedure: 'Pasar de alimento de inicio a engorde de forma gradual.', defaultEnabled: false },
  { key: 'cama_d21', day: 21, kind: 'cama', title: 'Manejo de cama (remover / cambiar zonas húmedas)', procedure: 'Remover la cama y reemplazar zonas húmedas o apelmazadas bajo bebederos.', defaultEnabled: false },
  { key: 'pesaje_d28', day: 28, kind: 'pesaje', title: 'Pesaje de control semana 4', procedure: 'Pesar una muestra y comparar con la tabla de peso ideal.', defaultEnabled: false },
  { key: 'pesaje_d35', day: 35, kind: 'pesaje', title: 'Pesaje de control semana 5', procedure: 'Pesar una muestra y comparar con la tabla de peso ideal.', defaultEnabled: false },
  { key: 'retiro_medicamentos', day: -7, kind: 'medicamento', title: 'Inicio de retiro de medicamentos', procedure: 'Suspender antibióticos/coccidiostatos con periodo de retiro antes del sacrificio.', defaultEnabled: true },
  { key: 'ayuno_sacrificio', day: 0, kind: 'otro', title: 'Ayuno previo al sacrificio (8-12 h)', procedure: 'Retirar el alimento 8 a 12 horas antes del sacrificio; mantener el agua.', defaultEnabled: true },
];

/**
 * Resuelve el día de vida real de un paso del plan:
 * day > 0 -> ese día; day <= 0 -> relativo al día de sacrificio (0 = día de sacrificio, -7 = 7 días antes).
 */
export function resolvePlanDay(item: Pick<AvicolaPlanItem, 'day'>, productionDays: number): number {
  const P = Math.max(1, Math.round(productionDays || AVICOLA_DEFAULT_PRODUCTION_DAYS));
  const d = item.day > 0 ? item.day : P + item.day;
  return Math.max(1, Math.round(d));
}

/** Plan base aplicable a un ciclo (descarta pasos posteriores al sacrificio). */
export function basePlanForCycle(productionDays: number): Array<AvicolaPlanItem & { lifeDay: number }> {
  const P = Math.max(1, Math.round(productionDays || AVICOLA_DEFAULT_PRODUCTION_DAYS));
  return AVICOLA_BASE_SANITARY_PLAN.map((p) => ({ ...p, lifeDay: resolvePlanDay(p, P) }))
    .filter((p) => p.lifeDay <= P)
    .sort((a, b) => a.lifeDay - b.lifeDay);
}

// ----------------------------------------------------------------------------
// Unidades
// ----------------------------------------------------------------------------
export const AVICOLA_EXPENSE_CATEGORIES = [
  'Alimento',
  'Pollos',
  'Bebedero',
  'Comedero',
  'Vitaminas',
  'Sanidad',
  'Mano de obra',
  'Otros',
] as const;

export const AVICOLA_EXPENSE_UNITS: { key: 'kg' | 'g' | 'lb' | 'bulto40' | 'ton' | 'unidad'; label: string; priceLabel: string; kgFactor: number | null }[] = [
  { key: 'kg', label: 'Kilos', priceLabel: 'Precio por kilo', kgFactor: 1 },
  { key: 'g', label: 'Gramos', priceLabel: 'Precio por gramo', kgFactor: 0.001 },
  { key: 'lb', label: 'Libras', priceLabel: 'Precio por libra', kgFactor: 0.45359237 },
  { key: 'bulto40', label: 'Bultos (40kg)', priceLabel: 'Precio por bulto de 40 kg', kgFactor: FEED_BAG_KG },
  { key: 'ton', label: 'Toneladas', priceLabel: 'Precio por tonelada', kgFactor: 1000 },
  { key: 'unidad', label: 'Unidades', priceLabel: 'Precio por unidad', kgFactor: null },
];

export const AVICOLA_SALE_UNITS: { key: 'lb' | 'kg' | 'g' | 'unidad'; label: string; priceLabel: string }[] = [
  { key: 'lb', label: 'Libras', priceLabel: 'Precio por libra' },
  { key: 'kg', label: 'Kilos', priceLabel: 'Precio por kilo' },
  { key: 'g', label: 'Gramos', priceLabel: 'Precio por gramo' },
  { key: 'unidad', label: 'Unidades', priceLabel: 'Precio por unidad' },
];

export const AVICOLA_PRODUCTS: { key: 'pollo' | 'menudencia' | 'otros'; label: string }[] = [
  { key: 'pollo', label: 'Pollo' },
  { key: 'menudencia', label: 'Menudencia' },
  { key: 'otros', label: 'Otros' },
];

/** Factor a kg de una unidad de peso (null si no es de peso). */
export function kgFactor(unit: string | undefined): number | null {
  switch (unit) {
    case 'kg':
      return 1;
    case 'g':
      return 0.001;
    case 'lb':
      return 0.45359237;
    case 'bulto40':
      return FEED_BAG_KG;
    case 'ton':
      return 1000;
    default:
      return null;
  }
}
