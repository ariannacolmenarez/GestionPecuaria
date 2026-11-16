import React, { useMemo, useState } from 'react';
import { Activity, Baby, Calculator, Heart, Layers, RotateCcw, Settings } from 'lucide-react';
import { ProductionFeedingPlan, ProductionType, WarehouseItem } from '../../../types';
import { FieldLabel, inputClass } from '../../common/ui';
import { money } from './shared';

export interface TabAlimentacionProps {
  feedingPlans: ProductionFeedingPlan[];
  /** Censo real usado para inicializar la calculadora. */
  census: { gestantes: number; lactantes: number; engorde: number };
  warehouseItems: WarehouseItem[];
  onOpenConfig: (type: ProductionType) => void;
}

const BAG_KG = 40;
const KG_GESTATION = 2.8;
const KG_LACTATION = 6.5;

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';

const PLAN_TABS: { id: ProductionType; label: string; Icon: React.ElementType }[] = [
  { id: 'engorde', label: 'Engorde', Icon: Layers },
  { id: 'maternidad', label: 'Madres', Icon: Heart },
  { id: 'verracos', label: 'Verracos', Icon: Activity },
  { id: 'lechones', label: 'Lechones', Icon: Baby },
];

/** Costo promedio por kg de alimento según el almacén real (null si no hay datos). */
function averageFeedCostPerKg(items: WarehouseItem[]): number | null {
  let kg = 0;
  let cost = 0;
  items
    .filter((i) => i.category === 'alimentos' && i.unitCostUsd > 0)
    .forEach((i) => {
      const perKg = i.unit === 'kg' ? i.unitCostUsd : i.unit === 'bultos (40kg)' ? i.unitCostUsd / BAG_KG : null;
      if (perKg === null) return;
      const weight = Math.max(1, i.unit === 'kg' ? i.quantity : i.quantity * BAG_KG);
      kg += weight;
      cost += perKg * weight;
    });
  return kg > 0 ? cost / kg : null;
}

/** Entrada numérica con valor por defecto del censo (null = usar censo). */
function useCensusOverride(censusValue: number) {
  const [override, setOverride] = useState<number | null>(null);
  return {
    value: override ?? censusValue,
    isOverridden: override !== null && override !== censusValue,
    set: (v: number) => setOverride(Math.max(0, v)),
    reset: () => setOverride(null),
  };
}

export const TabAlimentacion: React.FC<TabAlimentacionProps> = ({ feedingPlans, census, warehouseItems, onOpenConfig }) => {
  const [selectedType, setSelectedType] = useState<ProductionType>('engorde');
  const gest = useCensusOverride(census.gestantes);
  const lact = useCensusOverride(census.lactantes);
  const eng = useCensusOverride(census.engorde);
  const [engKgPerDay, setEngKgPerDay] = useState(2.2);

  const activePlan = useMemo(
    () => feedingPlans.find((p) => p.productionType === selectedType) || feedingPlans[0],
    [feedingPlans, selectedType]
  );
  const planTotals = useMemo(
    () => ({
      days: activePlan ? activePlan.phases.reduce((s, ph) => s + ph.durationDays, 0) : 0,
      kg: activePlan ? activePlan.phases.reduce((s, ph) => s + ph.totalFeedKg, 0) : 0,
    }),
    [activePlan]
  );

  const costPerKg = useMemo(() => averageFeedCostPerKg(warehouseItems), [warehouseItems]);

  const calc = useMemo(() => {
    const kgGestation = Math.round(gest.value * KG_GESTATION * 30);
    const kgLactation = Math.round(lact.value * KG_LACTATION * 30);
    const kgEngorde = Math.round(eng.value * engKgPerDay * 30);
    const total = kgGestation + kgLactation + kgEngorde;
    return {
      kgGestation,
      kgLactation,
      kgEngorde,
      total,
      bags: Math.ceil(total / BAG_KG),
      bagsGestation: Math.ceil(kgGestation / BAG_KG),
      bagsLactation: Math.ceil(kgLactation / BAG_KG),
      bagsEngorde: Math.ceil(kgEngorde / BAG_KG),
      cost: costPerKg !== null ? total * costPerKg : null,
    };
  }, [gest.value, lact.value, eng.value, engKgPerDay, costPerKg]);

  const anyOverride = gest.isOverridden || lact.isOverridden || eng.isOverridden;

  const countInput = (id: string, value: number, set: (v: number) => void) => (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min="0"
      value={value || ''}
      placeholder="0"
      onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
      className={`${inputClass} font-bold`}
    />
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Plan por tipo de animal */}
      <section aria-labelledby="alim-plan" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 id="alim-plan" className="text-base font-bold text-slate-900">
            Plan de alimento
          </h3>
          <button
            type="button"
            onClick={() => onOpenConfig(selectedType)}
            className={`min-h-11 inline-flex items-center gap-1.5 px-3 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-900 rounded-xl text-sm font-bold ${FOCUS}`}
          >
            <Settings aria-hidden="true" className="w-4 h-4" />
            Cambiar plan
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200 rounded-xl" role="tablist" aria-label="Tipo de animal">
          {PLAN_TABS.map((t) => {
            const sel = selectedType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={sel}
                onClick={() => setSelectedType(t.id)}
                className={`min-h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors ${FOCUS} ${
                  sel ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <t.Icon aria-hidden="true" className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {!activePlan ? (
          <p className="text-sm text-slate-700 text-center py-4 bg-white rounded-2xl border border-slate-200">
            No hay planes de alimento configurados.
          </p>
        ) : (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">{activePlan.phases.length} etapas</strong> · {planTotals.days} días · come{' '}
              {planTotals.kg.toFixed(1)} kg por animal
            </p>

            {activePlan.phases.map((phase) => (
              <div key={phase.id} className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-900">{phase.daysRange}</p>
                    <h4 className="font-bold text-slate-900 text-base leading-snug">{phase.stageName}</h4>
                    <p className="text-sm text-slate-700">
                      Alimento: <strong className="text-slate-900">{phase.feedName}</strong>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-base font-bold text-emerald-800">{phase.dailyConsumptionKg} kg/día</span>
                    <span className="block text-xs text-slate-600">Peso {phase.weightRangeKg}</span>
                    <span className="block text-xs text-slate-600">{phase.totalFeedKg} kg en la etapa</span>
                  </div>
                </div>
                {phase.animalState && <p className="text-xs text-slate-600">Estado: {phase.animalState}</p>}
                {phase.description && <p className="text-sm text-slate-700 leading-relaxed">{phase.description}</p>}
                {phase.transitionProtocol && (
                  <details className="bg-amber-50 border border-amber-200 rounded-xl">
                    <summary className={`min-h-11 px-3 flex items-center text-sm font-bold text-amber-900 cursor-pointer rounded-xl ${FOCUS}`}>
                      {phase.transitionProtocol.title}
                    </summary>
                    <ul className="px-3 pb-3 space-y-1.5">
                      {phase.transitionProtocol.days.map((d, idx) => (
                        <li key={idx} className="bg-white p-2 rounded-lg border border-amber-200 text-sm">
                          <span className="font-bold text-slate-900">{d.dayLabel}: </span>
                          <span className="text-slate-700">{d.formula}</span>
                          <strong className="block text-amber-900">{d.totalPerDay}</strong>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Calculadora de bultos para 30 días, inicializada con el censo real */}
      <section aria-labelledby="alim-calc" className="bg-white rounded-2xl p-3.5 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id="alim-calc" className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calculator aria-hidden="true" className="w-5 h-5 text-emerald-700" /> Bultos para 30 días
          </h3>
          {anyOverride && (
            <button
              type="button"
              onClick={() => {
                gest.reset();
                lact.reset();
                eng.reset();
              }}
              className={`min-h-11 px-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-800 rounded-xl hover:bg-emerald-50 ${FOCUS}`}
            >
              <RotateCcw aria-hidden="true" className="w-4 h-4" /> Usar conteo real
            </button>
          )}
        </div>

        {/* Resultado primero */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-emerald-900 block">Necesitas</span>
            <strong className="text-2xl font-bold text-emerald-900">{calc.bags} bultos</strong>
            <span className="text-xs text-emerald-900 block">de {BAG_KG} kg · {calc.total.toLocaleString()} kg</span>
          </div>
          <div className="text-right">
            {calc.cost !== null && calc.total > 0 ? (
              <>
                <span className="text-xs font-semibold text-emerald-900 block">Costo aprox.</span>
                <strong className="text-lg font-bold text-emerald-900">${money(calc.cost)}</strong>
              </>
            ) : (
              calc.total > 0 && <span className="text-xs text-slate-700 block max-w-36">Registra alimentos con costo en el almacén para ver el costo</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ['Preñadas', calc.bagsGestation],
              ['Criando', calc.bagsLactation],
              ['Engorde', calc.bagsEngorde],
            ] as const
          ).map(([l, b]) => (
            <div key={l} className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 block">{l}</span>
              <strong className="text-sm text-slate-900 block">{b} bultos</strong>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="alim-gest" hint={`${KG_GESTATION} kg al día`}>
              Cerdas preñadas
            </FieldLabel>
            {countInput('alim-gest', gest.value, gest.set)}
          </div>
          <div>
            <FieldLabel htmlFor="alim-lact" hint={`${KG_LACTATION} kg al día`}>
              Cerdas criando
            </FieldLabel>
            {countInput('alim-lact', lact.value, lact.set)}
          </div>
          <div>
            <FieldLabel htmlFor="alim-eng">Cerdos de engorde</FieldLabel>
            {countInput('alim-eng', eng.value, eng.set)}
          </div>
          <div>
            <FieldLabel htmlFor="alim-kg">Kg al día por cerdo</FieldLabel>
            <input
              id="alim-kg"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.5"
              max="4.0"
              value={engKgPerDay || ''}
              placeholder="0"
              onChange={(e) => setEngKgPerDay(Math.max(0, parseFloat(e.target.value) || 0))}
              className={`${inputClass} font-bold`}
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Etapa del engorde">
          {(
            [
              [1.2, 'Inicio', '1.2 kg'],
              [2.0, 'Crecimiento', '2.0 kg'],
              [2.6, 'Final', '2.6 kg'],
            ] as const
          ).map(([v, label, kg]) => (
            <button
              key={v}
              type="button"
              onClick={() => setEngKgPerDay(v)}
              aria-pressed={engKgPerDay === v}
              className={`min-h-11 px-1 rounded-xl text-xs font-bold leading-tight transition-colors ${FOCUS} ${
                engKgPerDay === v ? 'bg-emerald-700 text-white' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {label}
              <span className="block font-semibold">{kg}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
