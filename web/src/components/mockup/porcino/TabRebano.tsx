import React, { useMemo, useState } from 'react';
import { Baby, Binary, ChevronRight, Plus, Search, Truck } from 'lucide-react';
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
import { inputClass } from '../../common/ui';
import { metric, money } from './shared';
import { CategoryIcon, iconCategoryOf } from './CategoryIcon';

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

const FILTER_LABEL: Record<TraceFilter, string> = {
  todos: 'Todos',
  engorde: 'Engorde',
  maternidad: 'Madres',
  verracos: 'Verracos',
  bajas: 'Vendidos / muertos',
};

const CATEGORY_LABEL: Record<string, string> = {
  engorde: 'Engorde',
  maternidad: 'Madre',
  verracos: 'Verraco',
  lechones: 'Lechones',
};

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2';

/** Fila de grupo: icono, nombre, cantidad grande y 1–2 datos en palabras. */
const GroupRow: React.FC<{
  title: string;
  category: 'engorde' | 'maternidad' | 'verracos' | 'lechones';
  count: number;
  unit: string;
  details: string[];
  onClick: () => void;
}> = ({ title, category, count, unit, details, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full min-h-16 px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100 ${FOCUS}`}
  >
    <CategoryIcon category={category} />
    <span className="flex-1 min-w-0">
      <span className="block text-base font-bold text-slate-900">{title}</span>
      {details.map((d) => (
        <span key={d} className="block text-xs text-slate-600 leading-snug">
          {d}
        </span>
      ))}
    </span>
    <span className="text-right shrink-0">
      <span className="block text-xl font-bold text-slate-900 leading-tight">{count}</span>
      <span className="block text-xs text-slate-600">{unit}</span>
    </span>
    <ChevronRight aria-hidden="true" className="w-5 h-5 text-slate-600 shrink-0" />
  </button>
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
  const [search, setSearch] = useState('');

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
    const base = filter === 'bajas' ? animals.filter((a) => !isActiveAnimal(a)) : active.filter((a) => filter === 'todos' || a.category === filter);
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((a) => [a.code, a.penLocation, a.breed].some((f) => !!f && String(f).toLowerCase().includes(q)));
  }, [animals, active, filter, search]);

  const isEmptyFarm = animals.length === 0 && litters.length === 0;
  const entradas = ledgerTotal.entradasNacimientos + ledgerTotal.entradasCompras + ledgerTotal.entradasDestete;
  const salidas = ledgerTotal.salidasMatadero + ledgerTotal.salidasVentas + ledgerTotal.salidasMortalidad;
  const noLitters = counters.camadasActivasCount === 0;
  const noActive = active.length === 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div>
        <h3 className="text-base font-bold text-slate-900">
          {counters.totalPorcino} cerdos en la granja
        </h3>
        {(entradas > 0 || salidas > 0) && (
          <p className="text-xs text-slate-600">
            Desde el inicio: entraron {entradas} · salieron {salidas}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onOpenCensus}
          className={`min-h-11 px-2 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 ${FOCUS}`}
        >
          <Binary aria-hidden="true" className="w-4 h-4 shrink-0" /> Conteo
        </button>
        <button
          type="button"
          onClick={() => onOpenSale('engorde')}
          disabled={noActive}
          aria-describedby={noActive ? 'rebano-sin-animales' : undefined}
          className={`min-h-11 px-2 rounded-xl bg-emerald-700 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`}
        >
          <Truck aria-hidden="true" className="w-4 h-4 shrink-0" /> Vender
        </button>
        <button
          type="button"
          onClick={onOpenWeaning}
          disabled={noLitters}
          aria-describedby={noLitters ? 'rebano-sin-camadas' : undefined}
          className={`min-h-11 px-2 rounded-xl bg-rose-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS}`}
        >
          <Baby aria-hidden="true" className="w-4 h-4 shrink-0" /> Destete
        </button>
      </div>
      {(noActive || noLitters) && !isEmptyFarm && (
        <div className="text-xs text-slate-600 space-y-0.5 -mt-2">
          {noActive && <p id="rebano-sin-animales">Vender: no hay animales activos.</p>}
          {noLitters && <p id="rebano-sin-camadas">Destete: no hay camadas criando (registra primero un parto).</p>}
        </div>
      )}

      {isEmptyFarm && (
        <div className="bg-white rounded-2xl p-4 border-2 border-dashed border-rose-300 text-center space-y-3">
          <p className="text-base font-bold text-slate-900">Tu granja está lista para empezar</p>
          <p className="text-sm text-slate-700">Aún no hay animales. Registra tu primer lote de engorde, una cerda o un verraco.</p>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => onOpenCategory('engorde')}
              className={`min-h-11 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 rounded-xl border border-emerald-300 ${FOCUS}`}
            >
              <Plus aria-hidden="true" className="w-4 h-4" /> Lote de engorde
            </button>
            <button
              type="button"
              onClick={() => onOpenCategory('maternidad')}
              className={`min-h-11 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 rounded-xl border border-rose-300 ${FOCUS}`}
            >
              <Plus aria-hidden="true" className="w-4 h-4" /> Cerda madre
            </button>
            <button
              type="button"
              onClick={onOpenNewBoar}
              className={`min-h-11 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 rounded-xl border border-blue-300 ${FOCUS}`}
            >
              <Plus aria-hidden="true" className="w-4 h-4" /> Verraco
            </button>
          </div>
        </div>
      )}

      {/* Grupos: una fila por grupo con su cantidad y datos clave en palabras */}
      <section aria-label="Grupos" className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
        <GroupRow
          title="Engorde"
          category="engorde"
          count={counters.engorde}
          unit="cerdos"
          details={[
            `${counters.lotesEngordeCount} lotes · peso promedio ${metric(engorde.pesoPromedioKg, ' kg')}`,
            `Ganancia diaria: ${metric(engorde.gananciaDiariaPesoGdpKg, ' kg', 2)}`,
          ]}
          onClick={() => onOpenCategory('engorde')}
        />
        <GroupRow
          title="Madres"
          category="maternidad"
          count={counters.productoras}
          unit="cerdas"
          details={[
            `${counters.maternidadGestantes} preñadas · ${counters.maternidadLactantes} criando`,
            `Nacidos vivos por parto: ${metric(maternidad.promedioLechonesNacidosVivos, '', 1)}`,
          ]}
          onClick={() => onOpenCategory('maternidad')}
        />
        <GroupRow
          title="Verracos"
          category="verracos"
          count={counters.verracos}
          unit="machos"
          details={[`${verracos.totalMontasRegistradas} montas registradas`]}
          onClick={() => onOpenCategory('verracos')}
        />
        <GroupRow
          title="Lechones criando"
          category="lechones"
          count={counters.lechones}
          unit="vivos"
          details={
            noLitters
              ? ['Sin camadas criando']
              : [
                  `${counters.camadasActivasCount} camadas · peso ${metric(lechones.pesoPromedioActualKg, ' kg', 1)} · destete en ~${lechones.diasPromedioAlDestete} días`,
                  `Muertos: ${lechones.mortalidadAcumulada} (${metric(lechones.tasaMortalidadPercent, '%', 1)})`,
                ]
          }
          onClick={() => onOpenCategory('lechones')}
        />
      </section>

      {/* Lista de animales con búsqueda por arete */}
      <section aria-labelledby="rebano-lista" className="space-y-2.5">
        <h3 id="rebano-lista" className="text-base font-bold text-slate-900">
          Buscar un animal
        </h3>
        <div className="relative">
          <Search aria-hidden="true" className="w-5 h-5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Arete, corral o raza"
            aria-label="Buscar por arete, corral o raza"
            className={`${inputClass} pl-10`}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por grupo">
          {(['todos', 'engorde', 'maternidad', 'verracos', 'bajas'] as const).map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={`min-h-10 px-3 rounded-xl text-xs font-bold transition-colors ${FOCUS} ${
                filter === cat ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {FILTER_LABEL[cat]} ({filterCounts[cat]})
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-slate-700 text-center py-4 bg-white rounded-2xl border border-slate-200">
            {animals.length === 0
              ? 'Todavía no hay animales registrados.'
              : search.trim()
                ? `Ningún animal coincide con «${search.trim()}».`
                : 'No hay animales en este grupo.'}
          </p>
        ) : (
          <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
            {visible.map((a) => {
              const activeAnimal = isActiveAnimal(a);
              const heads = headCount(a);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAnimal(a)}
                    className={`w-full min-h-16 px-3 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 active:bg-slate-100 ${FOCUS} ${
                      activeAnimal ? '' : 'bg-slate-50'
                    }`}
                  >
                    <CategoryIcon category={iconCategoryOf(a)} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-base text-slate-900">{a.code}</strong>
                        {!activeAnimal && (
                          <span className="text-xs font-bold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded">
                            {a.isSoldToSlaughter || a.healthStatus === 'Matadero' ? 'Vendido' : 'Baja'}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-600 truncate">
                        {CATEGORY_LABEL[a.category] || a.category}
                        {heads > 1 ? ` · ${heads} cerdos` : ''}
                        {a.stage || a.healthStatus ? ` · ${a.stage || a.healthStatus}` : ''}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-bold text-slate-900">{metric(a.currentWeightKg, ' kg')}</span>
                      <span className="block text-xs text-slate-600">${money(a.accumulatedCostUsd)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
