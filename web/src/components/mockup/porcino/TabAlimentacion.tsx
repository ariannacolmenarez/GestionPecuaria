import React, { useMemo, useState } from 'react';
import { Activity, Baby, Heart, Layers, RotateCcw, Settings, Sparkles } from 'lucide-react';
import { ProductionFeedingPlan, ProductionType, WarehouseItem } from '../../../types';
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

const PLAN_TABS: { id: ProductionType; label: string; icon: React.ReactNode; ring: string }[] = [
  { id: 'engorde', label: 'Engorde Comercial', icon: <Layers className="w-3.5 h-3.5" />, ring: 'text-emerald-800 ring-emerald-300' },
  { id: 'maternidad', label: 'Maternidad & Cerdas', icon: <Heart className="w-3.5 h-3.5" />, ring: 'text-rose-800 ring-rose-300' },
  { id: 'verracos', label: 'Verracos Sementales', icon: <Activity className="w-3.5 h-3.5" />, ring: 'text-blue-800 ring-blue-300' },
  { id: 'lechones', label: 'Lechones Lactantes', icon: <Baby className="w-3.5 h-3.5" />, ring: 'text-amber-800 ring-amber-300' },
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
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      kgGestation,
      kgLactation,
      kgEngorde,
      total,
      bags: Math.ceil(total / BAG_KG),
      bagsGestation: Math.ceil(kgGestation / BAG_KG),
      bagsLactation: Math.ceil(kgLactation / BAG_KG),
      bagsEngorde: Math.ceil(kgEngorde / BAG_KG),
      pctGestation: pct(kgGestation),
      pctLactation: pct(kgLactation),
      pctEngorde: pct(kgEngorde),
      cost: costPerKg !== null ? total * costPerKg : null,
    };
  }, [gest.value, lact.value, eng.value, engKgPerDay, costPerKg]);

  const anyOverride = gest.isOverridden || lact.isOverridden || eng.isOverridden;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-800">Planes Nutricionales por Tipo de Producción</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Alimento, rango de peso, días del ciclo, consumo diario y total por etapa
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenConfig(selectedType)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurar Plan</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
          {PLAN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedType(t.id)}
              className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedType === t.id ? `bg-white shadow-xs ring-1 ${t.ring}` : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!activePlan ? (
        <p className="text-[11px] text-slate-400 italic text-center py-4">No hay planes de alimentación configurados.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 flex-wrap gap-1">
            <span className="text-xs font-bold text-slate-700">
              {activePlan.typeName} ({activePlan.phases.length} etapas)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                Duración: {planTotals.days} días
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Consumo: {planTotals.kg.toFixed(1)} kg / animal
              </span>
            </div>
          </div>

          {activePlan.phases.map((phase) => (
            <div
              key={phase.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      {phase.daysRange}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      Estado: {phase.animalState}
                    </span>
                  </div>
                  <h4 className="font-black text-slate-900 text-sm mt-1.5">{phase.stageName}</h4>
                  <p className="text-xs text-amber-900 font-semibold flex items-center gap-1 mt-0.5">
                    <span className="text-slate-500 font-medium">Alimento:</span>
                    <strong className="text-slate-900">{phase.feedName}</strong>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-black text-emerald-800 block">{phase.dailyConsumptionKg} kg / día</span>
                  <span className="text-[10px] text-slate-500 block">
                    Peso: <strong>{phase.weightRangeKg}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Total: <strong>{phase.totalFeedKg} kg / etapa</strong>
                  </span>
                </div>
              </div>
              {phase.description && (
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {phase.description}
                </p>
              )}
              {phase.transitionProtocol && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                  <span className="text-[11px] font-bold text-amber-900 block">{phase.transitionProtocol.title}</span>
                  <div className="space-y-1.5 text-xs">
                    {phase.transitionProtocol.days.map((d, idx) => (
                      <div
                        key={idx}
                        className="bg-white/80 p-2 rounded-lg border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px]"
                      >
                        <span className="font-bold text-slate-800">{d.dayLabel}:</span>
                        <span className="text-slate-600">{d.formula}</span>
                        <strong className="text-amber-900 text-right">{d.totalPerDay}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Calculadora de bultos inicializada con el censo real */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3.5 border border-slate-700/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h4 className="font-bold text-xs text-white">Calculadora de Bultos Requeridos (30 días)</h4>
          </div>
          {anyOverride ? (
            <button
              type="button"
              onClick={() => {
                gest.reset();
                lact.reset();
                eng.reset();
              }}
              className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Usar censo real
            </button>
          ) : (
            <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
              Censo real • Bulto 40 kg
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ['Cerdas Gestación', gest, `${KG_GESTATION} kg/d`],
                ['Cerdas Lactancia', lact, `${KG_LACTATION} kg/d`],
              ] as const
            ).map(([label, field, rate]) => (
              <div key={label} className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-300 font-medium">{label}:</label>
                  <span className="text-[9px] text-slate-400">{rate}</span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={field.value}
                  onChange={(e) => field.set(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                />
              </div>
            ))}
          </div>

          <div className="bg-slate-800/90 p-3 rounded-xl border border-emerald-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <label className="text-xs font-bold text-emerald-300">Cerdos de Engorde / Cebo</label>
              </div>
              <span className="text-[10px] text-slate-300">
                Consumo: <strong>{engKgPerDay} kg/día/animal</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">N° de cerdos:</span>
                <input
                  type="number"
                  min="0"
                  value={eng.value}
                  onChange={(e) => eng.set(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-0.5">Kg/día por animal:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="4.0"
                  value={engKgPerDay}
                  onChange={(e) => setEngKgPerDay(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[9px] text-slate-400">Etapa:</span>
              {(
                [
                  [1.2, 'Pre-cebo (1.2k)'],
                  [2.0, 'Crecimiento (2.0k)'],
                  [2.6, 'Engorde Final (2.6k)'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEngKgPerDay(v)}
                  className={`text-[9px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    engKgPerDay === v ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 block truncate">Gestación</span>
              <strong className="text-white text-xs block">{calc.bagsGestation} bultos</strong>
              <span className="text-[9px] text-slate-400">({calc.kgGestation.toLocaleString()} kg)</span>
            </div>
            <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 block truncate">Lactancia</span>
              <strong className="text-white text-xs block">{calc.bagsLactation} bultos</strong>
              <span className="text-[9px] text-slate-400">({calc.kgLactation.toLocaleString()} kg)</span>
            </div>
            <div className="bg-emerald-950/50 p-2 rounded-xl border border-emerald-800/60">
              <span className="text-emerald-300 font-bold block truncate">Engorde</span>
              <strong className="text-emerald-400 text-xs block">{calc.bagsEngorde} bultos</strong>
              <span className="text-[9px] text-emerald-200/80">({calc.kgEngorde.toLocaleString()} kg)</span>
            </div>
          </div>

          {calc.total > 0 && (
            <div>
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                <div style={{ width: `${calc.pctGestation}%` }} className="bg-blue-500" />
                <div style={{ width: `${calc.pctLactation}%` }} className="bg-purple-500" />
                <div style={{ width: `${calc.pctEngorde}%` }} className="bg-emerald-500" />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                <span>Gestación: {calc.pctGestation}%</span>
                <span>Lactancia: {calc.pctLactation}%</span>
                <span className="text-emerald-400 font-bold">Engorde: {calc.pctEngorde}%</span>
              </div>
            </div>
          )}

          <div className="bg-black/40 rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Consumo Mensual Total</span>
              <strong className="text-base text-emerald-400">{calc.total.toLocaleString()} kg</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Bultos (40kg) Requeridos</span>
              <strong className="text-base text-white">
                {calc.bags} sacos{calc.cost !== null && calc.total > 0 ? ` (~$${money(calc.cost)})` : ''}
              </strong>
              {calc.cost === null && calc.total > 0 && (
                <span className="text-[9px] text-slate-400 block">Registra alimentos con costo en almacén para estimar el gasto</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
