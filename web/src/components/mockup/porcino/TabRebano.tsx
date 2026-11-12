import React, { useMemo, useState } from 'react';
import { Activity, Baby, Binary, Plus, Truck } from 'lucide-react';
import { LactatingLitter, PorcinoAnimal, PorcinoCategory } from '../../../types';
import {
  AnimalMovementLedger,
  EngordeMetrics,
  LechonesMetrics,
  MaternidadMetrics,
  PorcinoDetailedCounters,
  VerracosMetrics,
  isActiveAnimal,
  headCount,
} from '../../../models/PorcinoCalculations';
import { metric, money } from './shared';

const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&auto=format&fit=crop&q=80';

export interface TabRebanoProps {
  animals: PorcinoAnimal[];
  litters: LactatingLitter[];
  counters: PorcinoDetailedCounters;
  engorde: EngordeMetrics;
  maternidad: MaternidadMetrics;
  verracos: VerracosMetrics;
  lechones: LechonesMetrics;
  ledgerTotal: AnimalMovementLedger;
  onOpenCensus: () => void;
  onOpenSale: (category?: string) => void;
  onOpenWeaning: () => void;
  onOpenCategory: (category: PorcinoCategory | 'lechones') => void;
  onOpenNewBoar: () => void;
  onSelectAnimal: (animal: PorcinoAnimal) => void;
}

type TraceFilter = 'todos' | 'engorde' | 'maternidad' | 'verracos' | 'bajas';

const CategoryCard: React.FC<{
  title: string;
  img: string;
  count: number;
  subtitle: string;
  badge: string;
  badgeClass: string;
  onClick: () => void;
}> = ({ title, img, count, subtitle, badge, badgeClass, onClick }) => (
  <div
    onClick={onClick}
    className="bg-slate-200/70 hover:bg-slate-200 border border-slate-300/80 rounded-xl p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
  >
    <span className="text-xs font-bold text-slate-800 text-center mb-1">{title}</span>
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-xs p-1 mb-2 flex items-center justify-center">
      <img src={img} alt={title} loading="lazy" className="w-full h-full object-cover rounded-lg" />
    </div>
    <div className="text-center w-full">
      <span className="text-xl font-black text-slate-900 block leading-tight">{count}</span>
      <span className="text-[10px] text-slate-600 font-semibold block">{subtitle}</span>
      <span className={`text-[9px] px-1 py-0.2 rounded font-bold mt-0.5 inline-block ${badgeClass}`}>{badge}</span>
    </div>
  </div>
);

export const TabRebano: React.FC<TabRebanoProps> = ({
  animals,
  litters,
  counters,
  engorde,
  maternidad,
  verracos,
  lechones,
  ledgerTotal,
  onOpenCensus,
  onOpenSale,
  onOpenWeaning,
  onOpenCategory,
  onOpenNewBoar,
  onSelectAnimal,
}) => {
  const [filter, setFilter] = useState<TraceFilter>('todos');

  const active = useMemo(() => animals.filter(isActiveAnimal), [animals]);
  const filterCounts = useMemo(
    () => ({
      todos: active.length,
      engorde: active.filter((a) => a.category === 'engorde').length,
      maternidad: active.filter((a) => a.category === 'maternidad').length,
      verracos: active.filter((a) => a.category === 'verracos').length,
      bajas: animals.length - active.length,
    }),
    [animals, active]
  );
  const visible = useMemo(() => {
    if (filter === 'bajas') return animals.filter((a) => !isActiveAnimal(a));
    return active.filter((a) => filter === 'todos' || a.category === filter);
  }, [animals, active, filter]);

  const isEmptyFarm = animals.length === 0 && litters.length === 0;
  const entradas = ledgerTotal.entradasNacimientos + ledgerTotal.entradasCompras + ledgerTotal.entradasDestete;
  const salidas = ledgerTotal.salidasMatadero + ledgerTotal.salidasVentas + ledgerTotal.salidasMortalidad;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-800 tracking-tight">Rebaño Porcino Activo</h3>
          <p className="text-[11px] text-slate-500">
            Total en granja: <strong>{counters.totalPorcino}</strong> animales
          </p>
        </div>

        <div className="flex gap-1.5 flex-wrap justify-end">
          <button
            onClick={onOpenCensus}
            className="flex items-center gap-1 text-xs font-bold bg-rose-50 text-rose-800 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer shadow-xs"
            title="Auditoría de Censo y Contadores en Vivo"
          >
            <Binary className="w-3.5 h-3.5 text-rose-600" /> Censo en Vivo
          </button>
          <button
            onClick={() => onOpenSale('engorde')}
            disabled={active.length === 0}
            className="flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
            title="Salida a Matadero / Liquidación de Venta"
          >
            <Truck className="w-3.5 h-3.5 text-emerald-600" /> Salida a Matadero
          </button>
          <button
            onClick={onOpenWeaning}
            disabled={counters.camadasActivasCount === 0}
            className="flex items-center gap-1 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={counters.camadasActivasCount === 0 ? 'No hay camadas en lactancia' : 'Registrar destete de una camada'}
          >
            <Baby className="w-3.5 h-3.5" /> Destete
          </button>
        </div>
      </div>

      {isEmptyFarm && (
        <div className="bg-white rounded-2xl p-4 border border-dashed border-rose-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-800">Tu granja está lista para empezar</p>
          <p className="text-[11px] text-slate-500">
            Aún no hay animales registrados. Da de alta tu primer lote de engorde, una cerda reproductora o un verraco.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 pt-1">
            <button
              onClick={() => onOpenCategory('engorde')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Lote de engorde
            </button>
            <button
              onClick={() => onOpenCategory('maternidad')}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Cerda reproductora
            </button>
            <button
              onClick={onOpenNewBoar}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Verraco
            </button>
          </div>
        </div>
      )}

      {/* GridView de 3 columnas con métricas reales */}
      <div className="grid grid-cols-3 gap-2.5">
        <CategoryCard
          title="Engorde"
          img="https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=200&auto=format&fit=crop&q=80"
          count={counters.engorde}
          subtitle={`${counters.lotesEngordeCount} lotes • ${metric(engorde.pesoPromedioKg, ' kg')}`}
          badge={`GDP: ${metric(engorde.gananciaDiariaPesoGdpKg, ' kg/d', 2)}`}
          badgeClass="text-emerald-700 bg-emerald-100/70"
          onClick={() => onOpenCategory('engorde')}
        />
        <CategoryCard
          title="Maternidad"
          img="https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&auto=format&fit=crop&q=80"
          count={counters.productoras}
          subtitle={`${counters.maternidadGestantes}g / ${counters.maternidadLactantes}l`}
          badge={`LNV: ${metric(maternidad.promedioLechonesNacidosVivos, ' lech.', 1)}`}
          badgeClass="text-rose-700 bg-rose-100/70"
          onClick={() => onOpenCategory('maternidad')}
        />
        <CategoryCard
          title="Verracos"
          img="https://images.unsplash.com/photo-1545468800-856f6620f779?w=200&auto=format&fit=crop&q=80"
          count={counters.verracos}
          subtitle="Padrillos"
          badge={`${verracos.totalMontasRegistradas} montas`}
          badgeClass="text-blue-700 bg-blue-100/70"
          onClick={() => onOpenCategory('verracos')}
        />
      </div>

      {/* Lechones en lactancia */}
      <div
        onClick={() => onOpenCategory('lechones')}
        className="bg-white hover:bg-amber-50/40 rounded-2xl p-3.5 border border-amber-200/90 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-xs">
            🐷
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <span>Lechones en Lactancia</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">Ver Camadas</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              {counters.camadasActivasCount === 0
                ? 'Sin camadas en lactancia'
                : `${counters.camadasActivasCount} camadas activas • ${metric(lechones.pesoPromedioActualKg, ' kg', 1)} prom. • Destete en ~${lechones.diasPromedioAlDestete}d`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg font-black text-amber-950">{counters.lechones}</span>
          <span className="text-[10px] text-amber-700 font-semibold block">lechones vivos</span>
          <span className="text-[9px] text-slate-400 block font-medium">
            Bajas: {lechones.mortalidadAcumulada} ({metric(lechones.tasaMortalidadPercent, '%', 1)})
          </span>
        </div>
      </div>

      {/* Conciliación de movimientos */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-600" />
            Conciliación de Movimientos del Rebaño
          </span>
          <span className="text-[10px] font-black text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
            Censo Conciliado
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
          <div className="bg-white p-2 rounded-xl border border-slate-200">
            <span className="text-slate-400 block">Censo Inicial</span>
            <strong className="text-slate-800 text-xs block">{ledgerTotal.censoInicial}</strong>
          </div>
          <div className="bg-white p-2 rounded-xl border border-emerald-200 text-emerald-800">
            <span className="text-emerald-600 block">(+) Entradas</span>
            <strong className="text-emerald-700 text-xs block">+{entradas}</strong>
          </div>
          <div className="bg-white p-2 rounded-xl border border-rose-200 text-rose-800">
            <span className="text-rose-600 block">(-) Salidas</span>
            <strong className="text-rose-700 text-xs block">-{salidas}</strong>
          </div>
          <div className="bg-rose-900 text-white p-2 rounded-xl border border-rose-950">
            <span className="text-rose-200 block">(=) Total Activo</span>
            <strong className="text-white text-xs block">{ledgerTotal.censoFinalActual}</strong>
          </div>
        </div>
      </div>

      {/* Trazabilidad */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-800 block">Trazabilidad de Animales Registrados</span>
            <span className="text-[10px] text-slate-400">
              Inspecciona historial clínico, pesajes, partos, montas y traslados
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px] font-bold">
          {(['todos', 'engorde', 'maternidad', 'verracos', 'bajas'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-colors cursor-pointer whitespace-nowrap ${
                filter === cat ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'bajas' ? 'Vendidos / bajas' : cat} ({filterCounts[cat]})
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {visible.length === 0 ? (
            <p className="text-[11px] text-slate-400 italic text-center py-3">
              {animals.length === 0 ? 'Todavía no hay animales registrados.' : 'No hay animales en este filtro.'}
            </p>
          ) : (
            visible.map((a) => {
              const activeAnimal = isActiveAnimal(a);
              const heads = headCount(a);
              return (
                <div
                  key={a.id}
                  onClick={() => onSelectAnimal(a)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all group ${
                    activeAnimal
                      ? 'bg-slate-50 hover:bg-emerald-50/40 border-slate-100 hover:border-emerald-300'
                      : 'bg-slate-100/70 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={a.photoUrl || FALLBACK_PHOTO}
                      alt={a.code}
                      loading="lazy"
                      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-xs group-hover:border-emerald-400 transition-colors"
                    />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-slate-900 font-bold group-hover:text-emerald-700 transition-colors">
                          {a.code}
                        </strong>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded">
                          {a.category}
                        </span>
                        {heads > 1 && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
                            {heads} cab.
                          </span>
                        )}
                        {!activeAnimal && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded">
                            {a.isSoldToSlaughter || a.healthStatus === 'Matadero' ? 'Vendido' : 'Baja'}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {(a.traceability?.length ?? 0)} eventos
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{a.stage || a.healthStatus}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {metric(a.currentWeightKg, ' kg')}
                    </span>
                    <p className="text-[10px] text-slate-400">Costo: ${money(a.accumulatedCostUsd)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
