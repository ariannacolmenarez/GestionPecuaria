import React, { useState } from 'react';
import {
  X,
  Search,
  Scale,
  Calendar,
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
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Tag,
  Info,
  Users,
} from 'lucide-react';
import { PorcinoAnimal, LactatingLitter, PorcinoCategory } from '../../types';

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
  onRegisterNewPigs?: (pigsData: {
    penLocation: string;
    quantity: number;
    ageWeeks: number;
    admissionWeightKg: number;
    admissionDate: string;
    provenance: string;
    admissionPriceUsd: number;
  }) => void;
  onRegisterNewMother?: (motherData: {
    code?: string;
    breed: string;
    ageWeeks: number;
    currentWeightKg: number;
    teatsCount: number;
    admissionPriceUsd: number;
    penLocation: string;
    provenance: string;
  }) => void;
}

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

  // Modal State for Registering New Pigs in Engorde (Requisito 2)
  const [showAddPigsModal, setShowAddPigsModal] = useState(false);
  const [pigsPenLocation, setPigsPenLocation] = useState('Galpón Engorde 2 - Corral 5');
  const [pigsQuantity, setPigsQuantity] = useState(20);
  const [pigsAgeWeeks, setPigsAgeWeeks] = useState(10);
  const [pigsAdmissionWeightKg, setPigsAdmissionWeightKg] = useState(28);
  const [pigsAdmissionDate, setPigsAdmissionDate] = useState('2026-08-19');
  const [pigsProvenance, setPigsProvenance] = useState('Granja Porcina AgroSur');
  const [pigsAdmissionPriceUsd, setPigsAdmissionPriceUsd] = useState(75);

  // Modal State for Registering New Mother in Maternidad (Requisito 5)
  const [showAddMotherModal, setShowAddMotherModal] = useState(false);
  const [motherBreed, setMotherBreed] = useState('F1 Landrace x Yorkshire');
  const [motherAgeWeeks, setMotherAgeWeeks] = useState(28);
  const [motherWeight, setMotherWeight] = useState(165);
  const [motherTeats, setMotherTeats] = useState(14);
  const [motherPrice, setMotherPrice] = useState(450);
  const [motherPen, setMotherPen] = useState('Galpón Gestación Sala 2');
  const [motherProvenance, setMotherProvenance] = useState('Cabaña Genética El Rosal');

  // Filter category animals
  const categoryAnimals = animals.filter((a) => a.category === category);

  const filteredAnimals = categoryAnimals.filter((a) => {
    const matchesStatus = statusFilter === 'all' || a.healthStatus === statusFilter;
    const matchesOrigin = originFilter === 'all' || a.origin === originFilter;
    const matchesSearch =
      a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.breed && a.breed.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.stage && a.stage.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.penLocation && a.penLocation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.provenance && a.provenance.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesOrigin && matchesSearch;
  });

  // Calculate sum of all lactating piglets
  const totalLactatingPiglets = litters.reduce((acc, curr) => acc + curr.currentCount, 0);
  const totalInitialPiglets = litters.reduce((acc, curr) => acc + curr.initialCount, 0);
  const totalAccumulatedMortality = litters.reduce((acc, curr) => acc + curr.mortalityCount, 0);

  // Requirement 1: Calculate total head count for engorde
  const totalEngordeHeadCount = categoryAnimals.reduce(
    (acc, curr) => acc + (curr.batchAnimalCount || 1),
    0
  );

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

  // Submit handler for new pigs in engorde (Requisito 2)
  const handleSaveNewPigs = (e: React.FormEvent) => {
    e.preventDefault();
    if (onRegisterNewPigs) {
      onRegisterNewPigs({
        penLocation: pigsPenLocation.trim() || 'Galpón Engorde',
        quantity: Number(pigsQuantity) || 1,
        ageWeeks: Number(pigsAgeWeeks) || 8,
        admissionWeightKg: Number(pigsAdmissionWeightKg) || 25,
        admissionDate: pigsAdmissionDate,
        provenance: pigsProvenance.trim() || 'Compra Externa',
        admissionPriceUsd: Number(pigsAdmissionPriceUsd) || 0,
      });
    }
    setShowAddPigsModal(false);
  };

  // Submit handler for new mother in maternidad (Requisito 5)
  const handleSaveNewMother = (e: React.FormEvent) => {
    e.preventDefault();
    if (onRegisterNewMother) {
      onRegisterNewMother({
        breed: motherBreed.trim(),
        ageWeeks: Number(motherAgeWeeks) || 26,
        currentWeightKg: Number(motherWeight) || 160,
        teatsCount: Number(motherTeats) || 14,
        admissionPriceUsd: Number(motherPrice) || 0,
        penLocation: motherPen.trim() || 'Galpón Gestación',
        provenance: motherProvenance.trim() || 'Compra Externa',
      });
    }
    setShowAddMotherModal(false);
  };

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
              <span className="text-xs text-slate-600 font-semibold">
                {categoryAnimals.length} Cerdas en seguimiento reproductivo
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddMotherModal(true)}
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
              <span className="text-xs text-slate-600 font-semibold">
                {categoryAnimals.length} Verracos reproductores activos
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
                  onClick={() => {
                    const firstBoar = categoryAnimals[0];
                    handleOpenSlaughter(firstBoar?.code);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
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
                  Lotes por Cerda ({litters.length})
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Nuevos Cerdos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstAnimal = categoryAnimals[0];
                    handleOpenSlaughter(firstAnimal?.code);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
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
                {(categoryAnimals.reduce((acc, a) => acc + a.currentWeightKg, 0) / (categoryAnimals.length || 1)).toFixed(1)} kg / cerdo
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
                    en {litters.length} camadas activas
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-xs space-y-0.5">
              <span className="text-slate-300 block text-[10px]">Supervivencia / Bajas</span>
              <span className="font-bold text-emerald-300">
                {(((totalLactatingPiglets) / (totalInitialPiglets || 1)) * 100).toFixed(1)}% viabilidad
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
            onChange={(e) => setOriginFilter(e.target.value as any)}
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
            <option value="all">Todos los estados</option>
            <option value="Optimo">Óptimo</option>
            <option value="Gestante">Gestante</option>
            <option value="Lactante">Lactante</option>
            <option value="En Observación">En Observación</option>
            <option value="Matadero">Matadero</option>
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

              {litters.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No hay camadas registradas en este momento.
                </div>
              ) : (
                litters.map((litter) => (
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
                          Fecha Nacimiento: <strong>{litter.birthDate}</strong> • Nacidos iniciales:{' '}
                          {litter.initialCount}
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
                      <img
                        src={animal.photoUrl}
                        alt={animal.code}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0 group-hover:border-emerald-500 transition-colors"
                      />
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
                              {animal.batchAnimalCount || 25} animales en el lote
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
                              <Users className="w-3 h-3 text-emerald-600" /> Lote: {animal.batchAnimalCount || 25} cerdos
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
                            <DollarSign className="w-3 h-3 text-slate-400" /> ${animal.accumulatedCostUsd}
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

      {/* =========================================================================
          MODAL REQUISITO 2: AGREGAR NUEVOS CERDOS EN ENGORDE
      ========================================================================= */}
      {showAddPigsModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Ingreso de Cerdos de Engorde</h4>
                  <p className="text-[11px] text-slate-500">Registrar nuevo lote o grupo de ceba</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPigsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPigs} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Corral / Galpón *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Galpón 2 - Corral 5"
                    value={pigsPenLocation}
                    onChange={(e) => setPigsPenLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Número de Cerdos *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pigsQuantity}
                    onChange={(e) => setPigsQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Edad al Ingresar (Semanas) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={pigsAgeWeeks}
                    onChange={(e) => setPigsAgeWeeks(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Peso Promedio (kg) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={pigsAdmissionWeightKg}
                    onChange={(e) => setPigsAdmissionWeightKg(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Fecha de Ingreso *
                  </label>
                  <input
                    type="date"
                    required
                    value={pigsAdmissionDate}
                    onChange={(e) => setPigsAdmissionDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Precio Compra ($ c/u) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={pigsAdmissionPriceUsd}
                    onChange={(e) => setPigsAdmissionPriceUsd(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Procedencia / Origen *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Granja Porcina AgroSur / Cabaña San Pedro"
                  value={pigsProvenance}
                  onChange={(e) => setPigsProvenance(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              {/* Cost summary note */}
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-[11px]">
                <span className="text-blue-900 font-medium">Inversión total compra:</span>
                <strong className="text-blue-950 font-black text-xs">
                  ${(pigsQuantity * pigsAdmissionPriceUsd).toFixed(2)} USD
                </strong>
              </div>

              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-900 leading-tight">
                🛡️ <strong>Plan Sanitario Automático:</strong> Al guardar, se programarán automáticamente
                las actividades del plan sanitario configurado para Engorde en el calendario.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPigsModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Registrar Cerdos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL REQUISITO 5: REGISTRAR NUEVA MADRE EN MATERNIDAD
      ========================================================================= */}
      {showAddMotherModal && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Registrar Nueva Madre</h4>
                  <p className="text-[11px] text-slate-500">Alta de cerda reproductora en maternidad</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddMotherModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMother} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Raza Genética *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: F1 Landrace x Yorkshire / Topigs 20"
                  value={motherBreed}
                  onChange={(e) => setMotherBreed(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Edad (Semanas) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={motherAgeWeeks}
                    onChange={(e) => setMotherAgeWeeks(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Peso Actual (kg) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={motherWeight}
                    onChange={(e) => setMotherWeight(parseFloat(e.target.value) || 1)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Pezones Funcionales *
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="20"
                    required
                    placeholder="Ej: 14 o 16"
                    value={motherTeats}
                    onChange={(e) => setMotherTeats(parseInt(e.target.value, 10) || 14)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Precio de Compra ($ USD) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={motherPrice}
                    onChange={(e) => setMotherPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Corral / Galpón Asignado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Galpón Gestación Sala 2"
                    value={motherPen}
                    onChange={(e) => setMotherPen(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Procedencia / Cabaña *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Cabaña El Rosal"
                    value={motherProvenance}
                    onChange={(e) => setMotherProvenance(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-[10px] text-rose-900 leading-tight">
                🛡️ <strong>Plan Sanitario Reproductivo:</strong> Se programará automáticamente en el calendario
                el protocolo de vacunación y sanidad configurado para cerdas reproductoras.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddMotherModal(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Guardar Madre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
