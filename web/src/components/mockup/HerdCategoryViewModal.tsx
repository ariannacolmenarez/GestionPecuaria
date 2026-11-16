import React, { useMemo, useState } from 'react';
import {
  Search,
  Scale,
  ChevronRight,
  Plus,
  Heart,
  Truck,
  Baby,
  Skull,
  Activity,
  Layers,
  MapPin,
  Users,
} from 'lucide-react';
import { PorcinoAnimal, LactatingLitter, PorcinoCategory } from '../../types';
import { isActiveAnimal, isActiveLitter, headCount, num, round2 } from '../../models/porcinoRules';
import { ageInDays } from '../../utils/dates';
import { ModalActionReturn } from './modalResult';
import { AddPigsForm, NewPigsData } from './herd/AddPigsForm';
import { AddMotherForm, NewMotherData } from './herd/AddMotherForm';
import { CategoryIcon, iconCategoryOf } from './porcino/CategoryIcon';
import { ModalHeader, inputClass, useBackClose } from '../common/ui';

interface HerdCategoryViewModalProps {
  category: PorcinoCategory | 'lechones';
  animals: PorcinoAnimal[];
  litters: LactatingLitter[];
  onClose: () => void;
  onSelectAnimal?: (animal: PorcinoAnimal) => void;
  onSelectAnimalForTraceability?: (animal: PorcinoAnimal) => void;
  onOpenFarrowingModal?: (sowCode?: string) => void;
  onOpenSlaughterModal?: (boarCode?: string) => void;
  onOpenBoarSlaughterModal?: (boarCode?: string) => void;
  onOpenMatingModal?: (tab?: 'monta' | 'nuevo') => void;
  onOpenBoarMatingModal?: (tab?: 'monta' | 'nuevo') => void;
  onOpenMortalityModal?: (litterId?: string) => void;
  onOpenPigletMortalityModal?: (litterId?: string) => void;
  /** Conectar a porcinoActions.registerNewPigs(d). admissionPriceUsd es UNITARIO. */
  onRegisterNewPigs?: (pigsData: NewPigsData) => ModalActionReturn;
  /** Conectar a porcinoActions.registerNewMother(d). */
  onRegisterNewMother?: (motherData: NewMotherData) => ModalActionReturn;
}

const INACTIVE_FILTER = '__inactivos__';

export const HerdCategoryViewModal: React.FC<HerdCategoryViewModalProps> = ({
  category,
  animals,
  litters,
  onClose,
  onSelectAnimal,
  onSelectAnimalForTraceability,
  onOpenFarrowingModal,
  onOpenSlaughterModal,
  onOpenBoarSlaughterModal,
  onOpenMatingModal,
  onOpenBoarMatingModal,
  onOpenMortalityModal,
  onOpenPigletMortalityModal,
  onRegisterNewPigs,
  onRegisterNewMother,
}) => {
  const handleSelectAnimal = (animal: PorcinoAnimal) => {
    if (onSelectAnimal) onSelectAnimal(animal);
    else if (onSelectAnimalForTraceability) onSelectAnimalForTraceability(animal);
  };

  const handleOpenSlaughter = (code?: string) => {
    if (onOpenSlaughterModal) onOpenSlaughterModal(code);
    else if (onOpenBoarSlaughterModal) onOpenBoarSlaughterModal(code);
  };

  const handleOpenMating = (tab?: 'monta' | 'nuevo') => {
    if (onOpenMatingModal) onOpenMatingModal(tab);
    else if (onOpenBoarMatingModal) onOpenBoarMatingModal(tab);
  };

  const handleOpenMortality = (litterId?: string) => {
    if (onOpenMortalityModal) onOpenMortalityModal(litterId);
    else if (onOpenPigletMortalityModal) onOpenPigletMortalityModal(litterId);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'destetado' | 'comprado'>('all');
  const [pigletViewTab, setPigletViewTab] = useState<'lotes' | 'individuales'>('lotes');
  const [showAddPigsModal, setShowAddPigsModal] = useState(false);
  const [showAddMotherModal, setShowAddMotherModal] = useState(false);

  // Todos los registros de la categoría (incluye vendidos solo para el filtro "Vendidos / Bajas")
  const allCategoryAnimals = useMemo(
    () => (animals || []).filter((a) => a.category === category),
    [animals, category]
  );
  // Criterio único de animal activo: los totales nunca incluyen vendidos ni bajas
  const categoryAnimals = useMemo(() => allCategoryAnimals.filter(isActiveAnimal), [allCategoryAnimals]);
  const inactiveCount = allCategoryAnimals.length - categoryAnimals.length;

  const filteredAnimals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      statusFilter === INACTIVE_FILTER
        ? allCategoryAnimals.filter((a) => !isActiveAnimal(a))
        : categoryAnimals.filter((a) => statusFilter === 'all' || a.healthStatus === statusFilter);
    return base.filter((a) => {
      if (originFilter !== 'all' && a.origin !== originFilter) return false;
      if (!q) return true;
      return [a.code, a.breed, a.stage, a.penLocation, a.provenance].some((f) => (f || '').toLowerCase().includes(q));
    });
  }, [allCategoryAnimals, categoryAnimals, statusFilter, originFilter, searchQuery]);

  // Solo camadas en lactancia (no destetadas) cuentan en los totales
  const activeLitters = useMemo(() => (litters || []).filter(isActiveLitter), [litters]);
  const { totalLactatingPiglets, totalInitialPiglets, totalAccumulatedMortality } = useMemo(
    () =>
      activeLitters.reduce(
        (acc, l) => ({
          totalLactatingPiglets: acc.totalLactatingPiglets + num(l.currentCount),
          totalInitialPiglets: acc.totalInitialPiglets + num(l.initialCount),
          totalAccumulatedMortality: acc.totalAccumulatedMortality + num(l.mortalityCount),
        }),
        { totalLactatingPiglets: 0, totalInitialPiglets: 0, totalAccumulatedMortality: 0 }
      ),
    [activeLitters]
  );
  const viabilityPercent = totalInitialPiglets > 0 ? (totalLactatingPiglets / totalInitialPiglets) * 100 : null;

  // Cabezas reales (batchAnimalCount) y peso promedio ponderado por número de animales
  const { totalHeadCount, weightedAvgWeight } = useMemo(() => {
    let heads = 0;
    let weightSum = 0;
    let weightedHeads = 0;
    categoryAnimals.forEach((a) => {
      const h = headCount(a);
      heads += h;
      if (num(a.currentWeightKg) > 0) {
        weightSum += num(a.currentWeightKg) * h;
        weightedHeads += h;
      }
    });
    return { totalHeadCount: heads, weightedAvgWeight: weightedHeads > 0 ? round2(weightSum / weightedHeads) : 0 };
  }, [categoryAnimals]);
  const totalEngordeHeadCount = totalHeadCount;
  const totalMaternidadHeadCount = totalHeadCount;
  const totalVerracosHeadCount = totalHeadCount;
  const existingCodes = useMemo(() => (animals || []).map((a) => a.code), [animals]);

  // Category Configuration
  const getCategoryConfig = () => {
    switch (category) {
      case 'maternidad':
        return {
          title: 'Madres (cerdas de cría)',
          subtitle: 'Gestación, parto, lactancia materna y nuevas reproductoras',
          headerBg: 'bg-rose-900',
          accentColor: 'rose',
          icon: Heart,
        };
      case 'verracos':
        return {
          title: 'Verracos (machos de monta)',
          subtitle: 'Mantenimiento genético, montas, servicios y ciclo de vida',
          headerBg: 'bg-slate-900',
          accentColor: 'blue',
          icon: Activity,
        };
      case 'lechones':
        return {
          title: 'Lechones en lactancia',
          subtitle: 'Censo neonatal, control de camadas por cerda y destete',
          headerBg: 'bg-amber-900',
          accentColor: 'amber',
          icon: Baby,
        };
      case 'engorde':
      default:
        return {
          title: 'Cerdos de engorde',
          subtitle: 'Lotes comerciales, nuevos ingresos y finalización cárnica',
          headerBg: 'bg-emerald-900',
          accentColor: 'emerald',
          icon: Layers,
        };
    }
  };

  const config = getCategoryConfig();
  const IconHeader = config.icon;
  const existingPens = useMemo(
    () =>
      Array.from(new Set<string>((animals || []).map((a) => (a.penLocation || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [animals]
  );

  // Atrás de Android / Escape / fondo: cierra la vista (los sub-formularios tienen su propio control)
  const { requestClose, confirmDialog } = useBackClose(true, onClose, false);

  const actionBtn =
    'min-h-11 px-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-900';
  const noAnimalsHint = categoryAnimals.length === 0 ? 'No hay animales activos para vender.' : null;

  const statusChip = (s: string) =>
    s === 'Optimo'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'Gestante'
      ? 'bg-blue-100 text-blue-800'
      : s === 'Lactante'
      ? 'bg-purple-100 text-purple-800'
      : s === 'Matadero'
      ? 'bg-rose-100 text-rose-800'
      : 'bg-amber-100 text-amber-900';

  const headerSubtitle =
    category === 'lechones'
      ? `${totalLactatingPiglets} lechones en ${activeLitters.length} camadas`
      : category === 'engorde'
      ? `${totalHeadCount} cerdos en ${categoryAnimals.length} lotes`
      : `${totalHeadCount} activos`;

  return (
    <div
      id="herd-category-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        id="herd-category-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="herd-category-title"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[94vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<IconHeader />}
          titleId="herd-category-title"
          title={config.title}
          subtitle={headerSubtitle}
          onClose={requestClose}
        />

        {/* Acciones del grupo */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
          {category === 'maternidad' && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onOpenFarrowingModal && onOpenFarrowingModal()} className={`${actionBtn} bg-rose-700 hover:bg-rose-800`}>
                <Baby className="w-5 h-5" aria-hidden="true" /> Registrar parto
              </button>
              <button
                type="button"
                onClick={() => setShowAddMotherModal(true)}
                disabled={!onRegisterNewMother}
                className={`${actionBtn} bg-emerald-700 hover:bg-emerald-800`}
              >
                <Plus className="w-5 h-5" aria-hidden="true" /> Nueva madre
              </button>
            </div>
          )}

          {category === 'verracos' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => handleOpenMating('monta')} className={`${actionBtn} bg-blue-700 hover:bg-blue-800`}>
                  <Heart className="w-5 h-5" aria-hidden="true" /> Monta
                </button>
                <button type="button" onClick={() => handleOpenMating('nuevo')} className={`${actionBtn} bg-emerald-700 hover:bg-emerald-800`}>
                  <Plus className="w-5 h-5" aria-hidden="true" /> Nuevo
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSlaughter(undefined)}
                  disabled={categoryAnimals.length === 0}
                  className={`${actionBtn} bg-rose-700 hover:bg-rose-800`}
                >
                  <Truck className="w-5 h-5" aria-hidden="true" /> Vender
                </button>
              </div>
              {noAnimalsHint && <p className="text-xs text-slate-600">Vender: {noAnimalsHint}</p>}
            </>
          )}

          {category === 'lechones' && (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1" role="tablist" aria-label="Ver lechones">
                <button
                  type="button"
                  role="tab"
                  aria-selected={pigletViewTab === 'lotes'}
                  onClick={() => setPigletViewTab('lotes')}
                  className={`min-h-11 px-2 rounded-lg text-sm font-bold transition-all ${
                    pigletViewTab === 'lotes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700'
                  }`}
                >
                  Camadas ({activeLitters.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={pigletViewTab === 'individuales'}
                  onClick={() => setPigletViewTab('individuales')}
                  className={`min-h-11 px-2 rounded-lg text-sm font-bold transition-all ${
                    pigletViewTab === 'individuales' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700'
                  }`}
                >
                  Lechones sueltos ({categoryAnimals.length})
                </button>
              </div>
              <button type="button" onClick={() => handleOpenMortality()} className={`${actionBtn} w-full bg-rose-700 hover:bg-rose-800`}>
                <Skull className="w-5 h-5" aria-hidden="true" /> Registrar lechones muertos
              </button>
            </>
          )}

          {category === 'engorde' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPigsModal(true)}
                  disabled={!onRegisterNewPigs}
                  className={`${actionBtn} bg-blue-700 hover:bg-blue-800`}
                >
                  <Plus className="w-5 h-5" aria-hidden="true" /> Agregar cerdos
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSlaughter(undefined)}
                  disabled={categoryAnimals.length === 0}
                  className={`${actionBtn} bg-emerald-700 hover:bg-emerald-800`}
                >
                  <Truck className="w-5 h-5" aria-hidden="true" /> Vender
                </button>
              </div>
              {noAnimalsHint && <p className="text-xs text-slate-600">Vender: {noAnimalsHint}</p>}
            </>
          )}

          {/* Resumen compacto del grupo */}
          {category === 'engorde' && (
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <span className="text-xs text-slate-600 block">Cerdos en engorde</span>
                <strong className="text-base text-slate-900">{totalEngordeHeadCount}</strong>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <span className="text-xs text-slate-600 block">Peso promedio</span>
                <strong className="text-base text-slate-900">{weightedAvgWeight > 0 ? `${weightedAvgWeight.toFixed(1)} kg` : '—'}</strong>
              </div>
            </div>
          )}
          {category === 'lechones' && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <span className="text-xs text-slate-600 block">Vivos</span>
                <strong className="text-base text-slate-900">{totalLactatingPiglets}</strong>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <span className="text-xs text-slate-600 block">Sobreviven</span>
                <strong className="text-base text-emerald-700">{viabilityPercent === null ? '—' : `${viabilityPercent.toFixed(0)}%`}</strong>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-2">
                <span className="text-xs text-slate-600 block">Muertos</span>
                <strong className="text-base text-rose-700">{totalAccumulatedMortality}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Buscador y filtros (no aplican a la vista de camadas) */}
        {!(category === 'lechones' && pigletViewTab === 'lotes') && (
          <div className="p-3 border-b border-slate-200 bg-white grid grid-cols-2 gap-2 shrink-0">
            <div className="relative col-span-2">
              <Search className="w-5 h-5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar por arete, corral o raza"
                placeholder="Buscar por arete, corral o raza"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${inputClass} pl-10`}
              />
            </div>
            <select
              aria-label="Origen"
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as 'all' | 'destetado' | 'comprado')}
              className={`${inputClass} text-sm`}
            >
              <option value="all">Origen: todos</option>
              <option value="destetado">Nacidos en la granja</option>
              <option value="comprado">Comprados</option>
            </select>
            <select aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} text-sm`}>
              <option value="all">Estado: todos</option>
              <option value="Optimo">Óptimo</option>
              <option value="Gestante">Gestante</option>
              <option value="Lactante">Lactante</option>
              <option value="Tratamiento">Tratamiento</option>
              <option value="En Observación">En observación</option>
              <option value={INACTIVE_FILTER}>Vendidos o muertos ({inactiveCount})</option>
            </select>
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {category === 'lechones' && pigletViewTab === 'lotes' ? (
            activeLitters.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-sm">No hay camadas en lactancia ahora.</div>
            ) : (
              activeLitters.map((litter) => (
                <div key={litter.id} className="p-3 bg-white rounded-2xl border border-amber-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900">
                        Madre <span className="font-mono">{litter.sowCode}</span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Camada <span className="font-mono font-semibold text-slate-800">{litter.batchCode}</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Nació {litter.birthDate} · {ageInDays(litter.birthDate)} días · Nacieron {litter.initialCount}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-black text-slate-900 block leading-tight">{litter.currentCount}</span>
                      <span className="text-xs text-slate-600">vivos</span>
                      <span className="text-xs text-slate-600 block">
                        {litter.malesCount} M · {litter.femalesCount} H
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className={`text-xs font-semibold ${litter.mortalityCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {litter.mortalityCount > 0 ? `${litter.mortalityCount} muerto(s)` : 'Sin muertes'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenMortality(litter.id)}
                      className="min-h-11 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-sm font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Skull className="w-4 h-4" aria-hidden="true" /> Registrar muerte
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            <>
              <p className="text-xs text-slate-600 px-1">
                {filteredAnimals.length} de {categoryAnimals.length} · toca uno para ver su ficha
              </p>
              {filteredAnimals.length === 0 ? (
                <div className="text-center py-10 text-slate-600 text-sm">No hay animales que coincidan con la búsqueda.</div>
              ) : (
                filteredAnimals.map((animal) => (
                  <button
                    type="button"
                    key={animal.id}
                    onClick={() => handleSelectAnimal(animal)}
                    className="w-full text-left p-3 bg-white rounded-2xl border border-slate-200 hover:border-rose-400 transition-all cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={iconCategoryOf(animal)} size="md" label={animal.code} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-black font-mono text-base text-slate-900">{animal.code}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusChip(animal.healthStatus)}`}>{animal.healthStatus}</span>
                          {animal.origin && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {animal.origin === 'comprado' ? 'Comprado' : 'Nacido aquí'}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-700">
                          {animal.category === 'engorde' && (
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                              <Users className="w-4 h-4" aria-hidden="true" /> {headCount(animal)} cerdos
                            </span>
                          )}
                          <span className="font-semibold flex items-center gap-1">
                            <Scale className="w-4 h-4 text-slate-600" aria-hidden="true" /> {animal.currentWeightKg} kg
                          </span>
                          {animal.penLocation && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-slate-600" aria-hidden="true" /> {animal.penLocation}
                            </span>
                          )}
                          {animal.category === 'maternidad' && animal.teatsCount ? <span>{animal.teatsCount} pezones</span> : null}
                        </div>
                        <p className="text-xs text-slate-600 truncate mt-0.5">
                          {animal.breed || 'Sin raza'}
                          {animal.stage ? ` · ${animal.stage}` : ''} · Costo ${round2(animal.accumulatedCostUsd).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 shrink-0" aria-hidden="true" />
                  </button>
                ))
              )}
            </>
          )}
        </div>
        {confirmDialog}
      </div>

      {/* Sub-formularios de alta (componentes propios) */}
      {showAddPigsModal && onRegisterNewPigs && (
        <AddPigsForm existingPens={existingPens} onClose={() => setShowAddPigsModal(false)} onSubmit={onRegisterNewPigs} />
      )}
      {showAddMotherModal && onRegisterNewMother && (
        <AddMotherForm
          existingCodes={existingCodes}
          existingPens={existingPens}
          onClose={() => setShowAddMotherModal(false)}
          onSubmit={onRegisterNewMother}
        />
      )}
    </div>
  );
};
