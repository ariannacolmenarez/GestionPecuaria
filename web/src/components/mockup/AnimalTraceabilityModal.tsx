import React, { useMemo, useState } from 'react';
import {
  X,
  History,
  Tag,
  Scale,
  DollarSign,
  Calendar,
  Pill,
  Syringe,
  Plus,
  ShieldCheck,
  Search,
  Activity,
  Heart,
  Truck,
  CheckCircle2,
  FileText,
  Utensils,
  MapPin,
  Clock,
  Sparkles,
  Info,
  Layers,
  Users,
} from 'lucide-react';
import { PorcinoAnimal, AnimalTraceEvent, ProductionFeedingPlan, WarehouseItem } from '../../types';
import { AnimalSuppliesPanel, SupplyActions } from './porcino/AnimalSuppliesPanel';
import { CategoryIcon, iconCategoryOf } from './porcino/CategoryIcon';
import { isActiveAnimal } from '../../models/porcinoRules';
import { getAnimalFeedingAndGrowthInfo, productionFeedingPlansDefault } from '../../data/pecuarioData';
import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, NormalizedModalResult, runModalAction, toNumber } from './modalResult';

/** Datos del pesaje que acompañan al nuevo peso (para registrar UN solo evento). */
export interface WeighingMeta {
  date: string;
  notes?: string;
  responsible?: string;
}

interface AnimalTraceabilityModalProps {
  animal: PorcinoAnimal;
  feedingPlans?: ProductionFeedingPlan[];
  onClose: () => void;
  onAddEvent?: (event: AnimalTraceEvent) => ModalActionReturn;
  onAddTraceEvent?: (animalId: string, event: AnimalTraceEvent) => ModalActionReturn;
  /**
   * Un pesaje con peso nuevo llama SOLO a esta función (no a onAddEvent/onAddTraceEvent):
   * conectar a porcinoActions.updateAnimalWeight({animalId, newWeightKg, date: meta.date, notes: meta.notes}),
   * que actualiza el peso y agrega el evento en una sola operación.
   */
  onUpdateWeight?:
    | ((newWeight: number) => ModalActionReturn)
    | ((animalId: string, newWeight: number, meta?: WeighingMeta) => ModalActionReturn);
  onRecordSlaughter?: () => void;
  onRecordFarrowing?: () => void;
  /** Almacén: insumos ubicados en este lote/cerdo, compras directas y consumo. */
  warehouseItems?: WarehouseItem[];
  supplyActions?: SupplyActions;
}

export const AnimalTraceabilityModal: React.FC<AnimalTraceabilityModalProps> = ({
  animal,
  feedingPlans = productionFeedingPlansDefault,
  onClose,
  onAddEvent,
  onAddTraceEvent,
  onUpdateWeight,
  onRecordSlaughter,
  onRecordFarrowing,
  warehouseItems,
  supplyActions,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showNutrition, setShowNutrition] = useState(false);

  // Requirement 8: Feeding and Growth information calculated from configuration and age (fecha real)
  const feedingInfo = useMemo(() => {
    const plans = feedingPlans && feedingPlans.some((p) => p.phases && p.phases.length > 0)
      ? feedingPlans.filter((p) => p.phases && p.phases.length > 0)
      : productionFeedingPlansDefault;
    return getAnimalFeedingAndGrowthInfo(animal, plans);
  }, [animal, feedingPlans]);

  // Weight evaluation
  const isBelowWeight = animal.currentWeightKg < feedingInfo.minExpectedWeight;
  const isAboveWeight = animal.currentWeightKg > feedingInfo.maxExpectedWeight;

  // New Event Form State
  const [eventDate, setEventDate] = useState(todayISO());
  const [eventType, setEventType] = useState<AnimalTraceEvent['type']>('pesaje');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventResponsible, setEventResponsible] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newWeightValue, setNewWeightValue] = useState<string>('');
  const [eventCost, setEventCost] = useState<string>('');

  // Más recientes primero
  const events = useMemo(
    () => [...(animal.traceability || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [animal.traceability]
  );

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((ev) => {
      const matchesType = filterType === 'all' || ev.type === filterType;
      if (!matchesType) return false;
      if (!q) return true;
      return (
        (ev.title || '').toLowerCase().includes(q) ||
        (ev.description || '').toLowerCase().includes(q) ||
        (ev.responsible || '').toLowerCase().includes(q)
      );
    });
  }, [events, filterType, searchQuery]);

  const getEventBadge = (type: AnimalTraceEvent['type']) => {
    switch (type) {
      case 'vacunacion':
        return { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: Syringe, label: 'Vacuna' };
      case 'tratamiento':
        return { bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: Pill, label: 'Tratamiento' };
      case 'pesaje':
        return { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: Scale, label: 'Pesaje' };
      case 'parto':
        return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Heart, label: 'Parto' };
      case 'monta':
        return { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: Activity, label: 'Monta / Servicio' };
      case 'traslado':
        return { bg: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck, label: 'Traslado' };
      case 'matadero':
        return { bg: 'bg-red-100 text-red-800 border-red-200', icon: Tag, label: 'Matadero / Salida' };
      default:
        return { bg: 'bg-slate-100 text-slate-800 border-slate-200', icon: FileText, label: 'Registro' };
    }
  };

  const resetForm = () => {
    setShowAddEventForm(false);
    setEventTitle('');
    setEventDescription('');
    setNewWeightValue('');
    setEventCost('');
    setFormError(null);
  };

  const handleCreateEvent = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const title = eventTitle.trim();
    if (!title) {
      setFormError('Indica el título del evento.');
      return;
    }
    if (!eventDate || eventDate > todayISO()) {
      setFormError('La fecha del evento no puede ser futura.');
      return;
    }
    const isWeighing = eventType === 'pesaje' && newWeightValue.trim() !== '';
    const weightNum = toNumber(newWeightValue, NaN);
    if (isWeighing && (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 600)) {
      setFormError('El peso debe estar entre 0 y 600 kg.');
      return;
    }
    const costNum = toNumber(eventCost);
    if (costNum < 0) {
      setFormError('El costo no puede ser negativo.');
      return;
    }

    setIsSaving(true);
    let res: NormalizedModalResult;
    if (isWeighing && onUpdateWeight) {
      // UNA sola acción: el peso y el evento de pesaje se guardan juntos
      const notes = [title, eventDescription.trim()].filter(Boolean).join('. ');
      res = await runModalAction(() =>
        onUpdateWeight.length === 1
          ? (onUpdateWeight as (w: number) => ModalActionReturn)(weightNum)
          : (onUpdateWeight as (id: string, w: number, m?: WeighingMeta) => ModalActionReturn)(animal.id, weightNum, {
              date: eventDate,
              notes,
              responsible: eventResponsible.trim() || undefined,
            })
      );
    } else {
      const newEv: AnimalTraceEvent = {
        id: newId('tr'),
        date: eventDate,
        type: eventType,
        title,
        description: eventDescription.trim() || 'Evento registrado en el historial de trazabilidad.',
        responsible: eventResponsible.trim() || undefined,
        costUsd: costNum > 0 ? costNum : undefined,
      };
      if (onAddEvent) {
        res = await runModalAction(() => onAddEvent(newEv));
      } else if (onAddTraceEvent) {
        res = await runModalAction(() => onAddTraceEvent(animal.id, newEv));
      } else {
        res = { ok: false, error: 'No hay una acción configurada para guardar eventos.' };
      }
    }
    setIsSaving(false);

    if (!res.ok) {
      setFormError(res.error || 'No se pudo guardar el evento.');
      return;
    }
    setSuccessNotice(`Evento "${title}" agregado a la trazabilidad.`);
    resetForm();
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  return (
    <div
      id="animal-traceability-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="animal-traceability-card"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header Profile Card */}
        <div className="bg-slate-900 text-white p-4 shrink-0 relative overflow-hidden">
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <CategoryIcon category={iconCategoryOf(animal)} size="md" label={animal.code} className="border-2 border-emerald-500 shadow-md" />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xl font-black font-mono tracking-tight text-white">
                    {animal.code}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    {animal.category.toUpperCase()}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      animal.healthStatus === 'Optimo'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : animal.healthStatus === 'Gestante'
                        ? 'bg-blue-500/20 text-blue-300'
                        : animal.healthStatus === 'Lactante'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {animal.healthStatus}
                  </span>

                  {/* Origin tag */}
                  {animal.origin && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        animal.origin === 'comprado'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                      }`}
                    >
                      {animal.origin === 'comprado' ? '🏷️ Comprado' : '🐣 Destetado en granja'}
                    </span>
                  )}

                  {/* Requisito 1: Lote registrado de engorde */}
                  {animal.category === 'engorde' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/30 text-emerald-200 border border-emerald-400/50 flex items-center gap-1">
                      <Users className="w-3 h-3 text-emerald-300" />
                      {(animal.batchAnimalCount || 1) > 1 ? `Lote de ${animal.batchAnimalCount} animales` : 'Animal individual'}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-0.5">
                  {animal.breed || 'Genética Porcina Certificada'} • {animal.stage || 'Etapa Productiva'}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-300">
                  {animal.category === 'engorde' && (
                    <span className="flex items-center gap-1 font-bold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-md border border-emerald-500/40">
                      <Users className="w-3.5 h-3.5 text-emerald-300" /> {animal.batchAnimalCount || 1} {(animal.batchAnimalCount || 1) === 1 ? 'cerdo' : 'cerdos en el lote'}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-semibold text-emerald-400">
                    <Scale className="w-3.5 h-3.5" /> {animal.currentWeightKg} kg
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Edad: <strong>{feedingInfo.ageText}</strong>
                  </span>
                  {animal.penLocation && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {animal.penLocation}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" /> Costo: ${animal.accumulatedCostUsd}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            REQUISITO 8: DETALLE DE EDAD, PESO ESPERADO, CONSUMO DIARIO Y ALIMENTO
        ========================================================================= */}
        {/* Plegado por defecto: una sola línea con lo esencial para dejar espacio a la trazabilidad */}
        <div className="px-3 py-2 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-emerald-50/80 border-b border-amber-200/90 shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => setShowNutrition((v) => !v)}
            aria-expanded={showNutrition}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Utensils className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-black text-xs text-slate-900 truncate">Plan nutricional</h4>
                <span className="text-[10px] text-slate-600 block truncate">
                  {feedingInfo.stageName} • <strong>{feedingInfo.dailyConsumptionKg} kg/día</strong> • {feedingInfo.ageWeeks} sem.
                </span>
              </div>
            </div>

            <span className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                isBelowWeight
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : isAboveWeight
                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}
            >
              {isBelowWeight ? '⚠️ Peso bajo' : isAboveWeight ? '📈 Sobrepeso' : '✅ Peso ideal'}
            </span>
            <span className="text-slate-500 text-xs font-bold">{showNutrition ? '▲' : '▼'}</span>
            </span>
          </button>

          {/* 4 Key Metrics Grid */}
          {showNutrition && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* 1. Alimento Administrado */}
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold">Alimento Asignado</span>
              <strong className="text-slate-900 font-bold text-[11px] block truncate" title={feedingInfo.feedName}>
                {feedingInfo.feedName}
              </strong>
              <span className="text-[9px] text-amber-700 block mt-0.5">{feedingInfo.daysRange}</span>
            </div>

            {/* 2. Kilos diarios a consumir */}
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold">Consumo Diario</span>
              <strong className="text-amber-900 font-black text-sm block">
                {feedingInfo.dailyConsumptionKg} kg / día
              </strong>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Total etapa: ~{feedingInfo.totalStageConsumptionKg} kg
              </span>
            </div>

            {/* 3. Peso que debe tener según la etapa */}
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold">Peso Esperado (Etapa)</span>
              <strong className="text-slate-900 font-black text-xs block">
                {feedingInfo.expectedWeightRangeKg}
              </strong>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                Actual: <strong className="text-emerald-700">{animal.currentWeightKg} kg</strong>
              </span>
            </div>

            {/* 4. Edad del Animal */}
            <div className="bg-white p-2 rounded-xl border border-amber-200/80 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-semibold">Edad Cronológica</span>
              <strong className="text-slate-900 font-black text-xs block">
                {feedingInfo.ageWeeks} semanas
              </strong>
              <span className="text-[9px] text-slate-500 block mt-0.5">
                {feedingInfo.ageDays} días ({feedingInfo.ageMonths} meses)
              </span>
            </div>
          </div>
          )}
        </div>

        {/* Action & Filter Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar en trazabilidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-white rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              <option value="all">Todos los eventos</option>
              <option value="pesaje">Pesajes</option>
              <option value="vacunacion">Vacunas</option>
              <option value="tratamiento">Tratamientos</option>
              <option value="parto">Partos</option>
              <option value="monta">Montas</option>
              <option value="observacion">Observaciones</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {onRecordSlaughter && animal.healthStatus !== 'Matadero' && !animal.isSoldToSlaughter && (
              <button
                type="button"
                onClick={onRecordSlaughter}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
                title="Abrir formulario unificado de venta o salida a matadero"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Vender / Matadero</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddEventForm(!showAddEventForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddEventForm ? 'Cancelar' : 'Agregar Evento'}</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successNotice && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Modal Body / Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Almacén del lote/cerdo: insumos asignados, compra directa y consumo */}
          {supplyActions && isActiveAnimal(animal) && (
            <AnimalSuppliesPanel animal={animal} items={warehouseItems || []} actions={supplyActions} />
          )}

          {/* Add Trace Event Form Drawer */}
          {showAddEventForm && (
            <form
              onSubmit={handleCreateEvent}
              className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-2.5 text-xs animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-700" /> Registrar Nuevo Evento de Trazabilidad
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">Animal: {animal.code}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Tipo de Evento:</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as AnimalTraceEvent['type'])}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  >
                    <option value="pesaje">Pesaje de Control</option>
                    <option value="vacunacion">Vacunación Sanitaria</option>
                    <option value="tratamiento">Tratamiento Médico / Fármaco</option>
                    <option value="monta">Monta / Inseminación</option>
                    <option value="parto">Parto / Camada</option>
                    <option value="traslado">Traslado de Galpón / Corral</option>
                    <option value="observacion">Observación General</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Fecha del Evento:</label>
                  <input
                    type="date"
                    required
                    max={todayISO()}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Título / Acción Realizada:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pesaje de lote, Inyección de Complejo B, Vacuna Parvo..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {eventType === 'pesaje' ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Nuevo Peso Registrado (kg):</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="600"
                      placeholder={`Actual: ${animal.currentWeightKg} kg`}
                      value={newWeightValue}
                      onChange={(e) => setNewWeightValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-0.5">Costo Asociado ($ USD):</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={eventCost}
                      onChange={(e) => setEventCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                )}
                <div className="text-[10px] text-slate-500 self-end pb-1">
                  {eventType === 'pesaje'
                    ? 'Con peso: se actualiza el animal y se registra el pesaje en una sola operación.'
                    : 'El costo se imputa al animal (no genera egreso en el balance).'}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Detalles / Procedimiento / Observaciones:</label>
                <textarea
                  rows={2}
                  placeholder="Descripción detallada de la acción realizada al animal..."
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {formError && (
                <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg text-[11px] font-bold text-rose-800">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="w-1/2">
                  <label className="block text-[10px] text-slate-500 font-semibold">Responsable:</label>
                  <input
                    type="text"
                    value={eventResponsible}
                    placeholder="Nombre o rol"
                    onChange={(e) => setEventResponsible(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-xl font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar en Historial'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Timeline Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>Línea de Tiempo de Trazabilidad ({filteredEvents.length} eventos)</span>
              <span className="text-[11px] text-slate-400">Más recientes primero</span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                No hay eventos registrados en este criterio de búsqueda.
              </div>
            ) : (
              filteredEvents.map((ev, index) => {
                const badge = getEventBadge(ev.type);
                const IconComponent = badge.icon;

                return (
                  <div
                    key={ev.id || index}
                    className="relative pl-6 pb-2 before:absolute before:left-2.5 before:top-3 before:bottom-0 before:w-0.5 before:bg-slate-200 last:before:hidden"
                  >
                    {/* Timeline Node Dot */}
                    <div className="absolute left-0 top-1 w-5 h-5 rounded-full bg-white border-2 border-emerald-600 flex items-center justify-center shadow-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    </div>

                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}
                          >
                            <IconComponent className="w-3 h-3" /> {badge.label}
                          </span>
                          <h4 className="font-bold text-xs text-slate-900">{ev.title}</h4>
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">
                          {ev.date}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {ev.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span>Resp: <strong>{ev.responsible || 'Personal de Granja'}</strong></span>
                        {ev.costUsd && (
                          <span className="font-semibold text-emerald-700">
                            Costo: ${ev.costUsd.toFixed(2)} USD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Trazabilidad auditada y registrada en el sistema pecuario</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
