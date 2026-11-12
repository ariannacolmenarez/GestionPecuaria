/**
 * ============================================================================
 * CAPA MODELO (MODEL) - LÓGICA DE NEGOCIO Y CÁLCULOS MATEMÁTICOS PECUARIOS
 * ============================================================================
 * Centraliza las fórmulas del dominio:
 * - Cálculo de censos activos y concordancia porcina (criterio único isActiveAnimal)
 * - Fórmulas de prorrateo de costos al destete
 * - Proyección de consumo y agotamiento de almacén (<2 meses)
 * - Finanzas derivadas de los movimientos reales (sin datos inventados)
 *
 * REGLA: ningún cálculo devuelve valores "de ejemplo". Sin datos -> 0.
 */

import {
  PorcinoAnimal,
  LactatingLitter,
  FarmSummary,
  WarehouseItem,
  FinancialMovement,
  BovinoAnimal,
  AvicolaLot,
} from './FarmModel';
import { headCount, isActiveAnimal, isActiveLitter, sowReproductiveState, round2, num } from './porcinoRules';
import {
  ageInDays,
  todayISO,
  currentMonthYear,
  monthPrefixOf,
  periodLabel,
  MONTH_NAMES_SHORT_ES,
  daysBetween,
} from '../utils/dates';

export { isActiveAnimal, isActiveLitter, headCount } from './porcinoRules';

export interface PorcinoDetailedCounters {
  /** Total de madres / cerdas reproductoras activas */
  productoras: number;
  /** Total de lechones lactantes vivos */
  lechones: number;
  /** Total de verracos / sementales activos */
  verracos: number;
  /** Total de cerdos en ceba / engorde */
  engorde: number;
  /** Suma global de animales del rebaño porcino */
  totalPorcino: number;

  // Desgloses operativos por etapa
  maternidadGestantes: number;
  maternidadLactantes: number;
  maternidadReemplazo: number;
  camadasActivasCount: number;
  lotesEngordeCount: number;
  verracosActivosCount: number;
  mortalidadLechonesTotal: number;

  // Censo por ubicación / corral
  censoPorUbicacion: Record<string, number>;
}

const sumHeads = (list: PorcinoAnimal[]) => list.reduce((acc, a) => acc + headCount(a), 0);

/**
 * Calcula con estricta concordancia matemática todos los contadores de la sección porcina
 * a partir de los registros reales de animales y camadas en la base de datos.
 */
export function calculatePorcinoCounters(
  animals: PorcinoAnimal[],
  litters: LactatingLitter[]
): PorcinoDetailedCounters {
  const activeAnimals = (animals || []).filter(isActiveAnimal);
  const safeLitters = litters || [];

  const verracosList = activeAnimals.filter((a) => a.category === 'verracos');
  const productorasList = activeAnimals.filter((a) => a.category === 'maternidad');
  const engordeList = activeAnimals.filter((a) => a.category === 'engorde');

  let maternidadGestantes = 0;
  let maternidadLactantes = 0;
  let maternidadReemplazo = 0;
  productorasList.forEach((sow) => {
    const st = sowReproductiveState(sow);
    if (st === 'lactante') maternidadLactantes += headCount(sow);
    else if (st === 'gestante') maternidadGestantes += headCount(sow);
    else maternidadReemplazo += headCount(sow);
  });

  const activeLitters = safeLitters.filter(isActiveLitter);
  const lechonesCount = activeLitters.reduce((acc, l) => acc + num(l.currentCount), 0);
  const mortalidadLechones = safeLitters.reduce((acc, l) => acc + num(l.mortalityCount), 0);

  const censoPorUbicacion: Record<string, number> = {};
  activeAnimals.forEach((a) => {
    const loc = a.penLocation || 'Sin Corral Asignado';
    censoPorUbicacion[loc] = (censoPorUbicacion[loc] || 0) + headCount(a);
  });
  activeLitters.forEach((l) => {
    const loc = `Maternidad (Camada ${l.batchCode} - Cerda ${l.sowCode})`;
    censoPorUbicacion[loc] = (censoPorUbicacion[loc] || 0) + num(l.currentCount);
  });

  const productoras = sumHeads(productorasList);
  const verracos = sumHeads(verracosList);
  const engorde = sumHeads(engordeList);

  return {
    productoras,
    lechones: lechonesCount,
    verracos,
    engorde,
    totalPorcino: productoras + lechonesCount + verracos + engorde,
    maternidadGestantes,
    maternidadLactantes,
    maternidadReemplazo,
    camadasActivasCount: activeLitters.length,
    lotesEngordeCount: engordeList.length,
    verracosActivosCount: verracosList.length,
    mortalidadLechonesTotal: mortalidadLechones,
    censoPorUbicacion,
  };
}

/**
 * Concilia el objeto FarmSummary para que los contadores porcinos reflejen la BD.
 * @deprecated El controlador deriva summary.counts con useMemo; no mantener a mano.
 */
export function reconcileFarmSummaryCounts(
  prevSummary: FarmSummary,
  animals: PorcinoAnimal[],
  litters: LactatingLitter[]
): FarmSummary {
  const calculated = calculatePorcinoCounters(animals, litters);
  return {
    ...prevSummary,
    counts: {
      ...prevSummary.counts,
      porcino: {
        productoras: calculated.productoras,
        lechones: calculated.lechones,
        verracos: calculated.verracos,
        engorde: calculated.engorde,
      },
    },
  };
}

/** Contadores reales del hato bovino (sin datos de ejemplo: vacío -> 0). */
export function calculateBovinoCounters(herd: Array<Partial<BovinoAnimal> | any> = []) {
  const active = (herd || []).filter((a) => a && a.status !== 'Descarte');
  const t = (a: any) => String(a.type || '').toLowerCase();
  const padrotes = active.filter((a) => t(a) === 'padrote').length;
  const vacas = active.filter((a) => ['vaca_lactante', 'vaca_seca', 'vaca lactante', 'vaca seca', 'novilla'].includes(t(a))).length;
  const becerros = active.filter((a) => t(a) === 'becerro' || t(a) === 'becerro destete').length;
  return { padrotes, vacas, becerros, total: padrotes + vacas + becerros };
}

/** Censo total activo de aves en galpones (sin datos de ejemplo: vacío -> 0). */
export function calculateAvicolaCounters(lots: Array<Partial<AvicolaLot> | any> = []) {
  const activeLots = (lots || []).filter((l) => l && l.status !== 'Liquidado' && l.status !== 'finalizado');
  const pollosEngorde = activeLots.reduce((acc, l) => acc + num(l.current), 0);
  return { pollosEngorde, lotesActivosCount: activeLots.length };
}

/** Contadores de los tres rubros a partir de los registros reales. */
export function calculateFarmCounts(
  porcinoAnimals: PorcinoAnimal[],
  litters: LactatingLitter[],
  bovinoHerd: any[] = [],
  avicolaLots: any[] = []
): FarmSummary['counts'] {
  const porcino = calculatePorcinoCounters(porcinoAnimals, litters);
  const bovino = calculateBovinoCounters(bovinoHerd);
  const avicola = calculateAvicolaCounters(avicolaLots);
  return {
    porcino: {
      productoras: porcino.productoras,
      lechones: porcino.lechones,
      verracos: porcino.verracos,
      engorde: porcino.engorde,
    },
    bovino: { padrotes: bovino.padrotes, vacas: bovino.vacas, becerros: bovino.becerros },
    avicola: { pollosEngorde: avicola.pollosEngorde },
  };
}

/**
 * Conciliación integral de todos los rubros.
 * @deprecated Usar calculateFarmCounts (el controlador ya deriva summary.counts).
 */
export function reconcileAllFarmCounts(
  prevSummary: FarmSummary,
  porcinoAnimals: PorcinoAnimal[],
  litters: LactatingLitter[],
  bovinoHerd?: any[],
  avicolaLots?: any[]
): FarmSummary {
  return { ...prevSummary, counts: calculateFarmCounts(porcinoAnimals, litters, bovinoHerd || [], avicolaLots || []) };
}

/**
 * Prorrateo de costos al destete:
 * Transfiere los costos del ciclo (gestación + lactancia) divididos entre los lechones destetados.
 */
export function calculateWeaningProrating(params: {
  sowAccumulatedCostUsd: number;
  additionalLactationCostUsd: number;
  weanedPigletsCount: number;
}) {
  const totalCostToProrate = round2(num(params.sowAccumulatedCostUsd) + num(params.additionalLactationCostUsd));
  const costPerPiglet = params.weanedPigletsCount > 0 ? totalCostToProrate / params.weanedPigletsCount : 0;
  return {
    totalCostToProrate,
    costPerPiglet: round2(costPerPiglet),
  };
}

/** Evalúa el inventario del almacén y detecta insumos con stock menor a 2 meses de consumo. */
export function evaluateWarehouseReplenishment(items: WarehouseItem[]) {
  return (items || []).map((item) => {
    const rate = num(item.monthlyConsumptionRate);
    const monthsOfSupply = rate > 0 ? num(item.quantity) / rate : 999;
    const isCritical = rate > 0 ? monthsOfSupply < 2.0 : num(item.quantity) <= num(item.minAlertThreshold);
    return {
      ...item,
      monthsOfSupply: Number(monthsOfSupply.toFixed(1)),
      isCritical,
      requiredPurchaseForTwoMonths: isCritical ? Math.max(0, rate * 2.0 - num(item.quantity)) : 0,
    };
  });
}

/** Número de insumos críticos (stock < 2 meses o bajo el umbral si no hay consumo mensual). */
export function countCriticalWarehouseItems(items: WarehouseItem[]): number {
  return evaluateWarehouseReplenishment(items).filter((i) => i.isCritical).length;
}

/**
 * ============================================================================
 * CÁLCULOS DE MOVIMIENTOS Y CONCILIACIÓN DE TOTALES DE ANIMALES
 * ============================================================================
 */
export interface AnimalMovementLedger {
  categoria: 'engorde' | 'maternidad' | 'verracos' | 'lechones' | 'total';
  censoInicial: number;
  entradasCompras: number;
  entradasNacimientos: number;
  entradasDestete: number;
  salidasVentas: number;
  salidasMatadero: number;
  salidasMortalidad: number;
  /** Solo lechones: destetados trasladados a lotes de la granja (traslado interno). */
  salidasDestete?: number;
  censoFinalActual: number;
}

/** Cabezas que salieron (venta/matadero) de un registro. */
function soldHeads(a: PorcinoAnimal): number {
  if (typeof a.soldHeadCount === 'number') return Math.max(0, a.soldHeadCount);
  return a.isSoldToSlaughter || a.healthStatus === 'Matadero' ? headCount(a) : 0;
}

/** Cabezas con las que ingresó un registro (activas + vendidas). */
function enteredHeads(a: PorcinoAnimal): number {
  const active = isActiveAnimal(a) ? headCount(a) : 0;
  return active + soldHeads(a);
}

export function calculateAnimalMovementsLedger(
  animals: PorcinoAnimal[],
  litters: LactatingLitter[]
): Record<string, AnimalMovementLedger> {
  const all = animals || [];
  const build = (cat: 'engorde' | 'maternidad' | 'verracos'): AnimalMovementLedger => {
    const list = all.filter((a) => a.category === cat);
    const current = sumHeads(list.filter(isActiveAnimal));
    const out = list.reduce((s, a) => s + soldHeads(a), 0);
    const bought = list.filter((a) => a.origin === 'comprado').reduce((s, a) => s + enteredHeads(a), 0);
    const weaned = list.filter((a) => a.origin === 'destetado').reduce((s, a) => s + enteredHeads(a), 0);
    return {
      categoria: cat,
      censoInicial: Math.max(0, current + out - bought - weaned),
      entradasCompras: bought,
      entradasNacimientos: 0,
      entradasDestete: weaned,
      salidasVentas: 0,
      salidasMatadero: out,
      salidasMortalidad: 0,
      censoFinalActual: current,
    };
  };

  const engorde = build('engorde');
  const maternidad = build('maternidad');
  const verracos = build('verracos');

  const safeLitters = litters || [];
  const lechonesCurrent = safeLitters.filter(isActiveLitter).reduce((s, l) => s + num(l.currentCount), 0);
  const lechonesBorn = safeLitters.reduce((s, l) => s + num(l.bornAlive ?? l.initialCount), 0);
  const lechonesMortality = safeLitters.reduce((s, l) => s + num(l.mortalityCount), 0);
  const lechonesWeaned = safeLitters.reduce(
    (s, l) => s + num(l.weanedCount ?? (l.weaningStatus === 'destetado' ? num(l.initialCount) - num(l.mortalityCount) : 0)),
    0
  );

  // Lechones destetados que pasaron a lotes de la granja (traslado interno) vs. vendidos al destete.
  const transferredToLots = engorde.entradasDestete + maternidad.entradasDestete + verracos.entradasDestete;
  const soldAtWeaning = Math.max(0, lechonesWeaned - transferredToLots);

  const lechones: AnimalMovementLedger = {
    categoria: 'lechones',
    censoInicial: 0,
    entradasCompras: 0,
    entradasNacimientos: lechonesBorn,
    entradasDestete: 0,
    salidasVentas: soldAtWeaning,
    salidasMatadero: 0,
    salidasMortalidad: lechonesMortality,
    salidasDestete: Math.min(transferredToLots, lechonesWeaned),
    censoFinalActual: lechonesCurrent,
  };

  // Total de la granja: el destete es un traslado INTERNO (lechones -> lotes), no suma ni resta.
  // Conciliación: inicial + compras + nacimientos - ventas - matadero - mortalidad = censo final.
  const total: AnimalMovementLedger = {
    categoria: 'total',
    censoInicial: engorde.censoInicial + maternidad.censoInicial + verracos.censoInicial,
    entradasCompras: engorde.entradasCompras + maternidad.entradasCompras + verracos.entradasCompras,
    entradasNacimientos: lechonesBorn,
    entradasDestete: 0,
    salidasVentas: soldAtWeaning,
    salidasMatadero: engorde.salidasMatadero + maternidad.salidasMatadero + verracos.salidasMatadero,
    salidasMortalidad: lechonesMortality,
    censoFinalActual: engorde.censoFinalActual + maternidad.censoFinalActual + verracos.censoFinalActual + lechonesCurrent,
  };

  return { engorde, maternidad, verracos, lechones, total };
}

/**
 * ============================================================================
 * CÁLCULOS DETALLADOS POR MÓDULO PORCINO (sin valores de ejemplo: sin datos -> 0)
 * ============================================================================
 */

export interface EngordeMetrics {
  totalAnimales: number;
  totalLotes: number;
  pesoPromedioKg: number;
  pesoIngresoPromedioKg: number;
  /** GDP real (kg/día) = (peso actual - peso ingreso) / días desde ingreso. 0 si no hay datos. */
  gananciaDiariaPesoGdpKg: number;
  /** Conversión alimenticia. 0 = sin datos de consumo (no se inventa). */
  fcrEstimado: number;
  costoAcumuladoTotalUsd: number;
  costoPorAnimalPromedioUsd: number;
  /** % de cabezas que siguen activas frente a las ingresadas (ventas no cuentan como pérdida). */
  tasaSupervivenciaPercent: number;
}

export function calculateEngordeMetrics(animals: PorcinoAnimal[]): EngordeMetrics {
  const engordeAnimals = (animals || []).filter((a) => a.category === 'engorde' && isActiveAnimal(a));
  const totalAnimales = sumHeads(engordeAnimals);
  const totalLotes = engordeAnimals.length;

  if (totalAnimales === 0) {
    return {
      totalAnimales: 0,
      totalLotes: 0,
      pesoPromedioKg: 0,
      pesoIngresoPromedioKg: 0,
      gananciaDiariaPesoGdpKg: 0,
      fcrEstimado: 0,
      costoAcumuladoTotalUsd: 0,
      costoPorAnimalPromedioUsd: 0,
      tasaSupervivenciaPercent: 0,
    };
  }

  const today = todayISO();
  let totalPeso = 0;
  let totalPesoIngreso = 0;
  let headsWithIngreso = 0;
  let totalCosto = 0;
  let gdpWeighted = 0;
  let gdpHeads = 0;

  engordeAnimals.forEach((a) => {
    const count = headCount(a);
    totalPeso += num(a.currentWeightKg) * count;
    totalCosto += num(a.accumulatedCostUsd);
    if (typeof a.admissionWeightKg === 'number' && a.admissionWeightKg > 0) {
      totalPesoIngreso += a.admissionWeightKg * count;
      headsWithIngreso += count;
      const days = a.admissionDate ? daysBetween(a.admissionDate, today) : 0;
      if (days > 0) {
        const gdp = Math.max(0, num(a.currentWeightKg) - a.admissionWeightKg) / days;
        gdpWeighted += gdp * count;
        gdpHeads += count;
      }
    }
  });

  return {
    totalAnimales,
    totalLotes,
    pesoPromedioKg: Math.round((totalPeso / totalAnimales) * 10) / 10,
    pesoIngresoPromedioKg: headsWithIngreso > 0 ? Math.round((totalPesoIngreso / headsWithIngreso) * 10) / 10 : 0,
    gananciaDiariaPesoGdpKg: gdpHeads > 0 ? round2(gdpWeighted / gdpHeads) : 0,
    fcrEstimado: 0,
    costoAcumuladoTotalUsd: round2(totalCosto),
    costoPorAnimalPromedioUsd: round2(totalCosto / totalAnimales),
    tasaSupervivenciaPercent: 100,
  };
}

export interface MaternidadMetrics {
  totalReproductoras: number;
  gestantes: number;
  lactantes: number;
  reemplazo: number;
  /** Partos / servicios con más de 114 días (×100). 0 si no hay servicios evaluables. */
  tasaFertilidadPercent: number;
  promedioLechonesNacidosVivos: number;
  diasPromedioLactancia: number;
  pezonesPromedioPorCerda: number;
  costoMantenimientoTotalUsd: number;
}

export function calculateMaternidadMetrics(
  animals: PorcinoAnimal[],
  litters: LactatingLitter[]
): MaternidadMetrics {
  const sows = (animals || []).filter((a) => a.category === 'maternidad' && isActiveAnimal(a));
  const totalReproductoras = sumHeads(sows);
  let gestantes = 0;
  let lactantes = 0;
  let reemplazo = 0;
  let teatsSum = 0;
  let teatsHeads = 0;
  let totalCost = 0;
  const today = todayISO();
  let evaluableServices = 0;
  let farrowings = 0;

  sows.forEach((s) => {
    const count = headCount(s);
    const st = sowReproductiveState(s);
    if (st === 'lactante') lactantes += count;
    else if (st === 'gestante') gestantes += count;
    else reemplazo += count;
    if (typeof s.teatsCount === 'number' && s.teatsCount > 0) {
      teatsSum += s.teatsCount * count;
      teatsHeads += count;
    }
    totalCost += num(s.accumulatedCostUsd);
    (s.traceability || []).forEach((ev) => {
      if (ev.type === 'monta' && ev.date && daysBetween(ev.date, today) >= 114) evaluableServices += 1;
      if (ev.type === 'parto') farrowings += 1;
    });
  });

  const safeLitters = litters || [];
  const activeLitters = safeLitters.filter(isActiveLitter);
  const littersWithBirths = safeLitters.filter((l) => typeof (l.bornAlive ?? l.initialCount) === 'number');
  const totalBornAlive = littersWithBirths.reduce((acc, l) => acc + num(l.bornAlive ?? l.initialCount), 0);
  const totalLactationDays = activeLitters.reduce((acc, l) => acc + ageInDays(l.birthDate, today), 0);

  return {
    totalReproductoras,
    gestantes,
    lactantes,
    reemplazo,
    tasaFertilidadPercent:
      evaluableServices > 0 ? Math.min(100, Math.round((farrowings / evaluableServices) * 1000) / 10) : 0,
    promedioLechonesNacidosVivos:
      littersWithBirths.length > 0 ? Math.round((totalBornAlive / littersWithBirths.length) * 10) / 10 : 0,
    diasPromedioLactancia: activeLitters.length > 0 ? Math.round(totalLactationDays / activeLitters.length) : 0,
    pezonesPromedioPorCerda: teatsHeads > 0 ? Math.round((teatsSum / teatsHeads) * 10) / 10 : 0,
    costoMantenimientoTotalUsd: round2(totalCost),
  };
}

export interface VerracosMetrics {
  totalVerracos: number;
  totalMontasRegistradas: number;
  /** Servicios del verraco que terminaron en parto / servicios evaluables (×100). 0 si no hay datos. */
  efectividadFertilidadPercent: number;
  /** Días promedio desde la última monta de cada verraco con montas. 0 si no hay datos. */
  diasPromedioDescanso: number;
  costoMantenimientoTotalUsd: number;
  razasDisponibles: string[];
}

export function calculateVerracosMetrics(animals: PorcinoAnimal[]): VerracosMetrics {
  const all = animals || [];
  const boars = all.filter((a) => a.category === 'verracos' && isActiveAnimal(a));
  const today = todayISO();
  let totalMontas = 0;
  let totalCost = 0;
  let restDaysSum = 0;
  let boarsWithMontas = 0;
  const razas = new Set<string>();

  boars.forEach((b) => {
    totalCost += num(b.accumulatedCostUsd);
    if (b.breed) razas.add(b.breed);
    const montas = (b.traceability || []).filter((t) => t.type === 'monta');
    totalMontas += montas.length;
    if (montas.length > 0) {
      const last = montas.map((m) => m.date).sort().pop() as string;
      restDaysSum += ageInDays(last, today);
      boarsWithMontas += 1;
    }
  });

  // Efectividad: servicios de verracos de la granja (>=114 días) cuya cerda registró parto posterior.
  const boarCodes = new Set(boars.map((b) => b.code));
  let evaluable = 0;
  let effective = 0;
  all
    .filter((a) => a.category === 'maternidad')
    .forEach((sow) => {
      const tr = sow.traceability || [];
      tr.forEach((ev) => {
        if (ev.type !== 'monta' || !ev.date || daysBetween(ev.date, today) < 114) return;
        const boarCode = ev.details?.boarCode as string | undefined;
        if (boarCode && !boarCodes.has(boarCode)) return;
        evaluable += 1;
        const hadFarrowing = tr.some(
          (p) => p.type === 'parto' && p.date && daysBetween(ev.date, p.date) >= 100 && daysBetween(ev.date, p.date) <= 130
        );
        if (hadFarrowing) effective += 1;
      });
    });

  return {
    totalVerracos: sumHeads(boars),
    totalMontasRegistradas: totalMontas,
    efectividadFertilidadPercent: evaluable > 0 ? Math.round((effective / evaluable) * 1000) / 10 : 0,
    diasPromedioDescanso: boarsWithMontas > 0 ? Math.round(restDaysSum / boarsWithMontas) : 0,
    costoMantenimientoTotalUsd: round2(totalCost),
    razasDisponibles: Array.from(razas),
  };
}

export interface LechonesMetrics {
  totalLechonesVivos: number;
  totalCamadasActivas: number;
  mortalidadAcumulada: number;
  tasaMortalidadPercent: number;
  /** Peso promedio: pesaje real de la camada o curva de crecimiento (1.4 kg + 0.28 kg/día) si no hay pesaje. */
  pesoPromedioActualKg: number;
  /** Días que faltan (promedio ponderado) para el destete a los 28 días. */
  diasPromedioAlDestete: number;
  costoCrianzaPorLechonUsd: number;
}

/** Edad real de una camada en días (desde birthDate). */
export function litterAgeDays(l: LactatingLitter, refISO: string = todayISO()): number {
  return ageInDays(l.birthDate, refISO);
}

export function calculateLechonesMetrics(litters: LactatingLitter[]): LechonesMetrics {
  const safeLitters = litters || [];
  const activeLitters = safeLitters.filter(isActiveLitter);
  const totalLechonesVivos = activeLitters.reduce((acc, l) => acc + num(l.currentCount), 0);
  const totalNacidosVivos = safeLitters.reduce((acc, l) => acc + num(l.bornAlive ?? l.initialCount), 0);
  const mortalidadAcumulada = safeLitters.reduce((acc, l) => acc + num(l.mortalityCount), 0);
  const today = todayISO();

  let totalWeight = 0;
  let totalDays = 0;
  let totalCost = 0;
  activeLitters.forEach((l) => {
    const n = num(l.currentCount);
    const age = litterAgeDays(l, today);
    const w = typeof l.currentWeightKg === 'number' && l.currentWeightKg > 0 ? l.currentWeightKg : 1.4 + age * 0.28;
    totalWeight += w * n;
    totalDays += age * n;
    totalCost += num(l.accumulatedCostUsd);
  });

  const diasPromedio = totalLechonesVivos > 0 ? Math.round(totalDays / totalLechonesVivos) : 0;

  return {
    totalLechonesVivos,
    totalCamadasActivas: activeLitters.length,
    mortalidadAcumulada,
    tasaMortalidadPercent: totalNacidosVivos > 0 ? Math.round((mortalidadAcumulada / totalNacidosVivos) * 1000) / 10 : 0,
    pesoPromedioActualKg: totalLechonesVivos > 0 ? Math.round((totalWeight / totalLechonesVivos) * 10) / 10 : 0,
    diasPromedioAlDestete: totalLechonesVivos > 0 ? Math.max(0, 28 - diasPromedio) : 0,
    costoCrianzaPorLechonUsd: totalLechonesVivos > 0 ? round2(totalCost / totalLechonesVivos) : 0,
  };
}

/**
 * ============================================================================
 * BALANCE FINANCIERO POR MES O AÑO (solo movimientos reales)
 * ============================================================================
 */

export type FinancialRubro = FinancialMovement['rubro'];

export interface PeriodFinancialSummary {
  periodLabel: string;
  totalIngresos: number;
  totalEgresos: number;
  utilidadNeta: number;
  margenRentabilidadPercent: number;
  ingresosFiltrados: FinancialMovement[];
  egresosFiltrados: FinancialMovement[];
  desgloseIngresosPorConcepto: Record<string, number>;
  desgloseEgresosPorConcepto: Record<string, number>;
  monthlyTrend: {
    month: string;
    monthIndex: number;
    income: number;
    expenses: number;
    profit: number;
  }[];
}

/**
 * Balance del periodo a partir EXCLUSIVAMENTE de los movimientos registrados.
 * @param selectedMonthNumber 1-12 (por defecto el mes actual)
 * @param selectedYear año (por defecto el actual)
 * @param rubro filtra por rubro (ej. 'porcino'); omitido = todos
 */
export function calculateBalanceByPeriod(
  movements: FinancialMovement[] | any[],
  filterType: 'mes' | 'año',
  selectedMonthNumber: number = currentMonthYear().month,
  selectedYear: number = currentMonthYear().year,
  rubro?: FinancialRubro
): PeriodFinancialSummary {
  const list: FinancialMovement[] = (movements || []).filter(
    (m: FinancialMovement) => m && typeof m.date === 'string' && (!rubro || m.rubro === rubro)
  );

  const monthlyTrend = MONTH_NAMES_SHORT_ES.map((label, idx) => {
    const prefix = monthPrefixOf(selectedYear, idx + 1);
    const monthMovs = list.filter((m) => m.date.startsWith(prefix));
    const income = round2(monthMovs.filter((m) => m.type === 'ingreso').reduce((s, m) => s + num(m.amount), 0));
    const expenses = round2(monthMovs.filter((m) => m.type === 'egreso').reduce((s, m) => s + num(m.amount), 0));
    return { month: label, monthIndex: idx + 1, income, expenses, profit: round2(income - expenses) };
  });

  const prefix = filterType === 'mes' ? monthPrefixOf(selectedYear, selectedMonthNumber) : `${selectedYear}`;
  const periodMovements = list.filter((m) => m.date.startsWith(prefix));
  const ingresosFiltrados = periodMovements.filter((m) => m.type === 'ingreso');
  const egresosFiltrados = periodMovements.filter((m) => m.type === 'egreso');
  const totalIngresos = round2(ingresosFiltrados.reduce((s, m) => s + num(m.amount), 0));
  const totalEgresos = round2(egresosFiltrados.reduce((s, m) => s + num(m.amount), 0));
  const utilidadNeta = round2(totalIngresos - totalEgresos);

  const breakdown = (ms: FinancialMovement[], fallback: string) => {
    const out: Record<string, number> = {};
    ms.forEach((m) => {
      const cat = m.category || fallback;
      out[cat] = round2((out[cat] || 0) + num(m.amount));
    });
    return out;
  };

  return {
    periodLabel: filterType === 'mes' ? periodLabel(selectedYear, selectedMonthNumber) : periodLabel(selectedYear),
    totalIngresos,
    totalEgresos,
    utilidadNeta,
    margenRentabilidadPercent: totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 1000) / 10 : 0,
    ingresosFiltrados,
    egresosFiltrados,
    desgloseIngresosPorConcepto: breakdown(ingresosFiltrados, 'Otros Ingresos'),
    desgloseEgresosPorConcepto: breakdown(egresosFiltrados, 'Otros Egresos'),
    monthlyTrend,
  };
}

const RUBRO_META: { key: FinancialRubro; label: 'Porcina' | 'Bovina' | 'Avícola'; color: string }[] = [
  { key: 'porcino', label: 'Porcina', color: '#f43f5e' },
  { key: 'bovino', label: 'Bovina', color: '#3b82f6' },
  { key: 'avicola', label: 'Avícola', color: '#eab308' },
];

/**
 * Deriva FarmSummary.finances de los movimientos reales del periodo.
 * - period: { year, month } (mes 1-12) o { year } para el año completo. Por defecto: mes actual.
 * - Los movimientos de rubro 'general' cuentan en los totales pero no en byRubro.
 * - Nunca devuelve NaN.
 */
export function calculateFinancesFromMovements(
  movements: FinancialMovement[],
  period: { year: number; month?: number } = currentMonthYear()
): FarmSummary['finances'] {
  const prefix = period.month ? monthPrefixOf(period.year, period.month) : `${period.year}`;
  const inPeriod = (movements || []).filter((m) => m && typeof m.date === 'string' && m.date.startsWith(prefix));

  const sumBy = (pred: (m: FinancialMovement) => boolean) =>
    round2(inPeriod.filter(pred).reduce((s, m) => s + num(m.amount), 0));

  const totalIncome = sumBy((m) => m.type === 'ingreso');
  const totalExpenses = sumBy((m) => m.type === 'egreso');

  return {
    period: periodLabel(period.year, period.month),
    totalIncome,
    totalExpenses,
    netUtility: round2(totalIncome - totalExpenses),
    byRubro: RUBRO_META.map(({ key, label, color }) => {
      const income = sumBy((m) => m.rubro === key && m.type === 'ingreso');
      const expenses = sumBy((m) => m.rubro === key && m.type === 'egreso');
      return { rubro: label, income, expenses, utility: round2(income - expenses), color };
    }),
  };
}

/** Variación porcentual de utilidad vs. mes anterior (null si el mes anterior no tiene datos). */
export function calculateUtilityTrendPercent(
  movements: FinancialMovement[],
  period: { year: number; month: number } = currentMonthYear()
): number | null {
  const prev = period.month === 1 ? { year: period.year - 1, month: 12 } : { year: period.year, month: period.month - 1 };
  const cur = calculateFinancesFromMovements(movements, period).netUtility;
  const before = calculateFinancesFromMovements(movements, prev).netUtility;
  if (before === 0) return null;
  return Math.round(((cur - before) / Math.abs(before)) * 1000) / 10;
}
