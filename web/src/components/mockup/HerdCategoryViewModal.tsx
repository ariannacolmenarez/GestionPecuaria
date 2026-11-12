import React, { useMemo, useState } from 'react';
import {
  X,
  Search,
  Scale,
  DollarSign,
  ChevronRight,
  Plus,
  Heart,
  Truck,
  Baby,
  Skull,
  Activity,
  Layers,
  ShieldCheck,
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
          title: 'Rebaño Maternidad (Cerdas Reproductoras)',
          subtitle: 'Gestación, parto, lactancia materna y nuevas reproductoras',
          headerBg: 'bg-rose-900',
          accentColor: 'rose',
          icon: Heart,
        };
      case 'verracos':
        return {
          title: 'Rebaño Verracos (Sementales Reproductores)',
          subtitle: 'Mantenimiento genético, montas, servicios y ciclo de vida',
          headerBg: 'bg-slate-900',
          accentColor: 'blue',
          icon: Activity,
        };
      case 'lechones':
        return {
          title: 'Lechones en Lactancia',
          subtitle: 'Censo neonatal, control de camadas por cerda y destete',
          headerBg: 'bg-amber-900',
          accentColor: 'amber',
          icon: Baby,
        };
      case 'engorde':
      default:
        return {
          title: 'Rebaño Engorde y Acabado',
          subtitle: 'Lotes comerciales, nuevos ingresos y finalización cárnica',
          headerBg: 'bg-emerald-900',
          accentColor: 'emerald',
          icon: Layers,
        };
    }
  };

  const config = getCategoryConfig();
  const IconHeader = config.icon;

  return (
    <div
      id="herd-category-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="herd-category-card"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className={`${config.headerBg} text-white p-4 shrink-0 flex items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <IconHeader className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">{config.title}</h3>
              <p className="text-[11px] text-white/70">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions Row depending on category */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {category === 'maternidad' && (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between">
              <span className="text-xs text-slate-700 font-bold">
                {totalMaternidadHeadCount} Madres activas ({categoryAnimals.length} registros y salas)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMotherModal(true)}
                  disabled={!onRegisterNewMother}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Registrar Nueva Madre
                </button>
                <button
                  type="button"
                  onClick={() => onOpenFarrowingModal && onOpenFarrowingModal()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5" /> Parto de Cerda
                </button>
              </div>
            </div>
          )}

          {category === 'verracos' && (
            <div className="flex flex-wrap items-center gap-2 w-full justify-between">
              <span className="text-xs text-slate-700 font-bold">
                {totalVerracosHeadCount} Verracos reproductores activos
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenMating('monta')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Heart className="w-3 h-3" /> Registrar Monta
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenMating('nuevo')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3 h-3" /> Nuevo Verraco
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSlaughter(undefined)}
                  disabled={categoryAnimals.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 disabled:opacity-50 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Truck className="w-3 h-3" /> A Matadero / Venta
                </button>
              </div>
            </div>
          )}

          {category === 'lechones' && (
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex rounded-xl bg-slate-200/80 p-0.5 text-xs font-bold">
                <button
                  onClick={() => setPigletViewTab('lotes')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    pigletViewTab === 'lotes'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lotes por Cerda ({activeLitters.length})
                </button>
                <button
                  onClick={() => setPigletViewTab('individuales')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    pigletViewTab === 'individuales'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Muestras de Lechones ({categoryAnimals.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleOpenMortality()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                <Skull className="w-3.5 h-3.5" /> Registrar Mortalidad
              </button>
            </div>
          )}

          {category === 'engorde' && (
            <div className="flex flex-wrap items-center justify-between w-full gap-2">
              <span className="text-xs text-slate-700 font-bold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                {categoryAnimals.length} lotes registrados • {totalEngordeHeadCount} cerdos en ceba total
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPigsModal(true)}
                  disabled={!onRegisterNewPigs}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Nuevos Cerdos
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenSlaughter(undefined)}
                  disabled={categoryAnimals.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Truck className="w-3.5 h-3.5" /> Salida a Matadero / Venta
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Requisito 1: Sumatoria Total de Cerdos en Engorde Banner */}
        {category === 'engorde' && (
          <div className="mx-4 mt-3 p-3.5 bg-emerald-950 text-white rounded-2xl shadow-sm flex items-center justify-between border border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-800/80 flex items-center justify-center font-black text-emerald-200 text-xl">
                🐖
              </div>
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                  Población Total en Etapa de Engorde y Ceba
                </span>
                <div className="flex items-baseline gap-2">
                  <strong className="text-2xl text-white font-black">
                    {totalEngordeHeadCount} cerdos
                  </strong>
                  <span className="text-xs text-emerald-200">
                    en {categoryAnimals.length} lotes registrados
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <span className="text-slate-300 block text-[10px]">Peso Promedio</span>
              <span className="font-bold text-emerald-300">
                {weightedAvgWeight > 0 ? `${weightedAvgWeight.toFixed(1)} kg / cerdo` : '—'}
              </span>
              <span className="text-[10px] text-slate-300 block">
                Acabado y ceba comercial
              </span>
            </div>
          </div>
        )}

        {/* Sumatoria Total de Lechones Banner */}
        {category === 'lechones' && (
          <div className="mx-4 mt-3 p-3.5 bg-amber-950 text-white rounded-2xl shadow-sm flex items-center justify-between border border-amber-900">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-800/80 flex items-center justify-center font-black text-amber-200 text-xl">
                🐷
              </div>
              <div>
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                  Sumatoria Total de Lechones en Lactancia
                </span>
                <div className="flex items-baseline gap-2">
                  <strong className="text-2xl text-white font-black">
                    {totalLactatingPiglets} lechones
                  </strong>
                  <span className="text-xs text-amber-200">
                    en {activeLitters.length} camadas activas
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <span className="text-slate-300 block text-[10px]">Supervivencia / Bajas</span>
              <span className="font-bold text-emerald-300">
                {viabilityPercent === null ? '—' : `${viabilityPercent.toFixed(1)}% viabilidad`}
              </span>
              <span className="text-[10px] text-rose-300 block">
                ({totalAccumulatedMortality} bajas registradas)
              </span>
            </div>
          </div>
        )}

        {/* Search & Filter Controls (Includes Origen Tag Filter) */}
        <div className="p-3 border-b border-slate-100 bg-white flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={`Buscar en ${config.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Origin filter (Requisito 6) */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | 'destetado' | 'comprado')}
            className="py-1.5 px-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-semibold"
          >
            <option value="all">Origen: Todos</option>
            <option value="destetado">🐣 Destetados en granja</option>
            <option value="comprado">🏷️ Comprados externamente</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-semibold"
          >
            <option value="all">Activos: todos los estados</option>
            <option value="Optimo">Óptimo</option>
            <option value="Gestante">Gestante</option>
            <option value="Lactante">Lactante</option>
            <option value="Tratamiento">Tratamiento</option>
            <option value="En Observación">En Observación</option>
            <option value={INACTIVE_FILTER}>Vendidos / Bajas ({inactiveCount})</option>
          </select>
        </div>

        {/* Modal Body / Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {category === 'lechones' && pigletViewTab === 'lotes' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Listado de Camadas / Lotes de Lechones por Cerda</span>
                <span className="text-amber-700 font-bold">Total: {totalLactatingPiglets} crías</span>
              </div>

              {activeLitters.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay camadas en lactancia en este momento.
                </div>
              ) : (
                activeLitters.map((litter) => (
                  <div
                    key={litter.id}
                    className="p-3.5 bg-white rounded-2xl border border-amber-200/80 shadow-xs hover:border-amber-400 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                            {litter.batchCode}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900">
                            Cerda Madre: <strong>{litter.sowCode}</strong>
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                            En Lactancia
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Fecha Nacimiento: <strong>{litter.birthDate}</strong> ({ageInDays(litter.birthDate)} días) •
                          Nacidos iniciales: {litter.initialCount}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-black text-amber-950 block">
                          {litter.currentCount} lechones vivos
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {litter.malesCount} machos • {litter.femalesCount} hembras
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`font-semibold ${
                            litter.mortalityCount > 0 ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {litter.mortalityCount > 0
                            ? `Bajas acumuladas: ${litter.mortalityCount} lechón(es)`
                            : 'Sin mortalidad registrada'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenMortality(litter.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Skull className="w-3 h-3 text-rose-600" /> Registrar Baja
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Animal List View */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>
                  {category === 'engorde'
                    ? `Lotes Registrados (${filteredAnimals.length} lotes • ${totalEngordeHeadCount} cerdos totales en ceba)`
                    : `Animales Registrados (${filteredAnimals.length} de ${categoryAnimals.length})`}
                </span>
                <span className="text-[11px] text-slate-400">
                  Haz clic en un animal o lote para ver su trazabilidad completa
                </span>
              </div>

              {filteredAnimals.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No se encontraron animales que coincidan con la búsqueda.
                </div>
              ) : (
                filteredAnimals.map((animal) => (
                  <div
                    key={animal.id}
                    onClick={() => handleSelectAnimal(animal)}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon category={iconCategoryOf(animal)} size="md" label={animal.code} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="font-black font-mono text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {animal.code}
                          </h4>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              animal.healthStatus === 'Optimo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : animal.healthStatus === 'Gestante'
                                ? 'bg-blue-100 text-blue-800'
                                : animal.healthStatus === 'Lactante'
                                ? 'bg-purple-100 text-purple-800'
                                : animal.healthStatus === 'Matadero'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {animal.healthStatus}
                          </span>

                          {/* Requirement 1: En el detalle del listado de cerdos de engorde mostrar cuántos animales hay en el lote registrado */}
                          {animal.category === 'engorde' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-300 flex items-center gap-1 shadow-2xs">
                              <Users className="w-3 h-3 text-emerald-700" />
                              {headCount(animal)} animales en el lote
                            </span>
                          )}

                          {/* Requirement 6: Origin Tag */}
                          {animal.origin && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                animal.origin === 'comprado'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {animal.origin === 'comprado' ? '🏷️ Comprado' : '🐣 Destetado'}
                            </span>
                          )}

                          {/* Teats count if mother */}
                          {animal.category === 'maternidad' && animal.teatsCount && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                              🍼 {animal.teatsCount} pezones
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 truncate mt-0.5 font-medium">
                          {animal.breed || 'Genética Porcina'} • {animal.stage || 'Etapa Productiva'}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
                          {animal.category === 'engorde' && (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                              <Users className="w-3 h-3 text-emerald-600" /> Lote: {headCount(animal)} cerdos
                            </span>
                          )}

                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <Scale className="w-3 h-3 text-slate-400" /> {animal.currentWeightKg} kg
                          </span>

                          {animal.penLocation && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3 h-3 text-slate-400" /> {animal.penLocation}
                            </span>
                          )}

                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-slate-400" /> ${round2(animal.accumulatedCostUsd).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden sm:flex flex-col items-end text-right">
                        <span className="text-[10px] text-slate-400">Ver Ficha</span>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                          Detalles & Dieta
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 flex items-center justify-center text-slate-400 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Sistema Pecuario: Registros y trazabilidad en tiempo real</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

{/* Sub-formularios de alta (componentes propios) */}
      {showAddPigsModal && onRegisterNewPigs && (
        <AddPigsForm onClose={() => setShowAddPigsModal(false)} onSubmit={onRegisterNewPigs} />
      )}
      {showAddMotherModal && onRegisterNewMother && (
        <AddMotherForm
          existingCodes={existingCodes}
          onClose={() => setShowAddMotherModal(false)}
          onSubmit={onRegisterNewMother}
        />
      )}
    </div>
  );
};
