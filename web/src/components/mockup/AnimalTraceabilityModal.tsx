import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  History,
  Tag,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  Scale,
  DollarSign,
  Calendar,
  Pill,
  Syringe,
  Plus,
  Search,
  Activity,
  Heart,
  Truck,
  CheckCircle2,
  FileText,
  Utensils,
  MapPin,
  Clock,
  Users,
} from 'lucide-react';
import { PorcinoAnimal, AnimalTraceEvent, ProductionFeedingPlan, WarehouseItem } from '../../types';
import { AnimalSuppliesPanel, SupplyActions } from './porcino/AnimalSuppliesPanel';
import { CategoryIcon, iconCategoryOf } from './porcino/CategoryIcon';
import { isActiveAnimal, num } from '../../models/porcinoRules';
import { getAnimalFeedingAndGrowthInfo, productionFeedingPlansDefault } from '../../data/pecuarioData';
import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, NormalizedModalResult, runModalAction, toNumber } from './modalResult';
import { Btn, ErrorBox, FieldError, FieldLabel, ModalHeader, fieldClass, inputClass, useBackClose, useFocusFirstInvalid } from '../common/ui';

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'title' | 'date' | 'weight' | 'cost', string>>>({});
  const [submitTry, setSubmitTry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, Object.keys(fieldErrors).length ? 'invalid' : null, submitTry);

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
    setFieldErrors({});
  };

  const handleCreateEvent = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const title = eventTitle.trim();
    const isWeighing = eventType === 'pesaje' && newWeightValue.trim() !== '';
    const weightNum = toNumber(newWeightValue, NaN);
    const costNum = toNumber(eventCost);
    const errs: Partial<Record<'title' | 'date' | 'weight' | 'cost', string>> = {};
    if (!title) errs.title = 'Escribe un título corto (ej: Pesaje del lote).';
    if (!eventDate || eventDate > todayISO()) errs.date = 'La fecha no puede ser futura.';
    if (isWeighing && (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 600)) errs.weight = 'El peso debe estar entre 0 y 600 kg.';
    if (costNum < 0) errs.cost = 'El costo no puede ser negativo.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setSubmitTry((n) => n + 1);
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

  const eventDirty = showAddEventForm && !!(eventTitle.trim() || eventDescription.trim() || newWeightValue || eventCost);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, eventDirty);

  const canSell = !!onRecordSlaughter && animal.healthStatus !== 'Matadero' && !animal.isSoldToSlaughter;
  const canFarrow = !!onRecordFarrowing && animal.category === 'maternidad' && animal.healthStatus === 'Gestante';
  const heads = animal.batchAnimalCount || 1;

  const errAttrs = (k: 'title' | 'date' | 'weight' | 'cost', extra = '') => ({
    'aria-invalid': !!fieldErrors[k],
    'aria-describedby': fieldErrors[k] ? `trace-${k}-err` : undefined,
    className: fieldClass(!!fieldErrors[k], extra),
  });

  return (
    <div
      id="animal-traceability-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        id="animal-traceability-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="animal-trace-title"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[94vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<CategoryIcon category={iconCategoryOf(animal)} size="sm" label={animal.code} />}
          titleId="animal-trace-title"
          title={<span className="font-mono">{animal.code}</span>}
          subtitle={`${animal.category} · ${animal.healthStatus}${animal.origin ? ` · ${animal.origin === 'comprado' ? 'Comprado' : 'Nacido en la granja'}` : ''}`}
          onClose={requestClose}
        />

        <div className="flex-1 overflow-y-auto">
          {/* Datos clave del animal */}
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {animal.category === 'engorde' && (
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5">
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Users className="w-4 h-4" aria-hidden="true" /> Cerdos
                </span>
                <strong className="text-base text-slate-900">{heads}</strong>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5">
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Scale className="w-4 h-4" aria-hidden="true" /> Peso
              </span>
              <strong className="text-base text-slate-900">{animal.currentWeightKg} kg</strong>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5">
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Clock className="w-4 h-4" aria-hidden="true" /> Edad
              </span>
              <strong className="text-base text-slate-900">{feedingInfo.ageText}</strong>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5">
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin className="w-4 h-4" aria-hidden="true" /> Corral
              </span>
              <strong className="text-sm text-slate-900 block truncate">{animal.penLocation || '—'}</strong>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5">
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <DollarSign className="w-4 h-4" aria-hidden="true" /> Costo
              </span>
              <strong className="text-base text-slate-900">${num(animal.accumulatedCostUsd).toFixed(2)}</strong>
            </div>
            <p className="col-span-2 sm:col-span-4 text-xs text-slate-600">
              {animal.breed || 'Sin raza'}
              {animal.stage ? ` · ${animal.stage}` : ''}
            </p>
          </div>

          {/* Acciones principales */}
          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
            <Btn rubro="porcino" icon={showAddEventForm ? <X /> : <Plus />} onClick={() => (showAddEventForm ? resetForm() : setShowAddEventForm(true))}>
              {showAddEventForm ? 'Cancelar evento' : 'Agregar evento'}
            </Btn>
            {canFarrow ? (
              <Btn variant="secondary" icon={<Heart />} onClick={onRecordFarrowing}>
                Registrar parto
              </Btn>
            ) : canSell ? (
              <Btn variant="secondary" icon={<Truck />} onClick={onRecordSlaughter}>
                Vender
              </Btn>
            ) : null}
            {canFarrow && canSell && (
              <Btn variant="secondary" icon={<Truck />} onClick={onRecordSlaughter} className="col-span-2">
                Vender
              </Btn>
            )}
          </div>

          {/* Alimentación (plegado: una línea con lo esencial) */}
          <div className="mx-3 mb-3 rounded-2xl border border-amber-200 bg-amber-50">
            <button
              type="button"
              onClick={() => setShowNutrition((v) => !v)}
              aria-expanded={showNutrition}
              className="w-full min-h-12 px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Utensils className="w-5 h-5 text-amber-800 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="font-bold text-sm text-slate-900 block">Alimentación</span>
                  <span className="text-xs text-slate-700 block truncate">
                    {feedingInfo.stageName} · <strong>{feedingInfo.dailyConsumptionKg} kg/día</strong>
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                    isBelowWeight
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : isAboveWeight
                      ? 'bg-blue-100 text-blue-900 border-blue-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {isBelowWeight ? (
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : isAboveWeight ? (
                    <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  {isBelowWeight ? 'Peso bajo' : isAboveWeight ? 'Sobrepeso' : 'Peso bien'}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-700 transition-transform ${showNutrition ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
            {showNutrition && (
              <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="text-xs text-slate-600 block">Alimento</span>
                  <strong className="text-sm text-slate-900 block truncate">{feedingInfo.feedName}</strong>
                  <span className="text-xs text-slate-600 block">{feedingInfo.daysRange}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="text-xs text-slate-600 block">Come por día</span>
                  <strong className="text-sm text-slate-900 block">{feedingInfo.dailyConsumptionKg} kg</strong>
                  <span className="text-xs text-slate-600 block">En la etapa: ~{feedingInfo.totalStageConsumptionKg} kg</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="text-xs text-slate-600 block">Peso que debería tener</span>
                  <strong className="text-sm text-slate-900 block">{feedingInfo.expectedWeightRangeKg}</strong>
                  <span className="text-xs text-slate-600 block">Ahora: {animal.currentWeightKg} kg</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                  <span className="text-xs text-slate-600 block">Edad</span>
                  <strong className="text-sm text-slate-900 block">{feedingInfo.ageWeeks} semanas</strong>
                  <span className="text-xs text-slate-600 block">
                    {feedingInfo.ageDays} días ({feedingInfo.ageMonths} meses)
                  </span>
                </div>
              </div>
            )}
          </div>

          {successNotice && (
            <div role="status" className="mx-3 mb-3 p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{successNotice}</span>
            </div>
          )}

          <div className="px-3 pb-4 space-y-3">
            {/* Almacén del lote/cerdo: insumos asignados, compra directa y consumo */}
            {supplyActions && isActiveAnimal(animal) && (
              <AnimalSuppliesPanel animal={animal} items={warehouseItems || []} actions={supplyActions} />
            )}

            {/* Formulario de nuevo evento */}
            {showAddEventForm && (
              <form ref={formRef} onSubmit={handleCreateEvent} noValidate className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-3">
                <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-1.5">
                  <Activity className="w-5 h-5 text-emerald-700" aria-hidden="true" /> Nuevo evento
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="trace-type">Qué pasó</FieldLabel>
                    <select
                      id="trace-type"
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as AnimalTraceEvent['type'])}
                      className={inputClass}
                    >
                      <option value="pesaje">Pesaje</option>
                      <option value="vacunacion">Vacuna</option>
                      <option value="tratamiento">Tratamiento o medicina</option>
                      <option value="monta">Monta</option>
                      <option value="parto">Parto</option>
                      <option value="traslado">Cambio de corral</option>
                      <option value="observacion">Observación</option>
                    </select>
                  </div>
                  <div>
                    <FieldLabel htmlFor="trace-date">Fecha</FieldLabel>
                    <input id="trace-date" type="date" max={todayISO()} value={eventDate} onChange={(e) => setEventDate(e.target.value)} {...errAttrs('date')} />
                    <FieldError id="trace-date-err" error={fieldErrors.date} />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor="trace-title">Título *</FieldLabel>
                  <input
                    id="trace-title"
                    type="text"
                    placeholder="Ej: Pesaje del lote, Vacuna Parvo…"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    {...errAttrs('title')}
                  />
                  <FieldError id="trace-title-err" error={fieldErrors.title} />
                </div>

                {eventType === 'pesaje' ? (
                  <div>
                    <FieldLabel htmlFor="trace-weight" hint="Si escribes el peso, se actualiza el animal.">
                      Nuevo peso (kg)
                    </FieldLabel>
                    <input
                      id="trace-weight"
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      max="600"
                      placeholder={`Ahora: ${animal.currentWeightKg} kg`}
                      value={newWeightValue}
                      onChange={(e) => setNewWeightValue(e.target.value)}
                      {...errAttrs('weight', 'font-bold')}
                    />
                    <FieldError id="trace-weight-err" error={fieldErrors.weight} />
                  </div>
                ) : (
                  <div>
                    <FieldLabel htmlFor="trace-cost" hint="Se suma al costo del animal (no es un gasto en el Balance).">
                      Costo ($)
                    </FieldLabel>
                    <input
                      id="trace-cost"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={eventCost}
                      onChange={(e) => setEventCost(e.target.value)}
                      {...errAttrs('cost')}
                    />
                    <FieldError id="trace-cost-err" error={fieldErrors.cost} />
                  </div>
                )}

                <div>
                  <FieldLabel htmlFor="trace-desc">Detalles (opcional)</FieldLabel>
                  <textarea
                    id="trace-desc"
                    rows={2}
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className={`${inputClass} py-2`}
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="trace-resp">Quién lo hizo (opcional)</FieldLabel>
                  <input id="trace-resp" type="text" value={eventResponsible} placeholder="Nombre" onChange={(e) => setEventResponsible(e.target.value)} className={inputClass} />
                </div>

                <ErrorBox error={formError} />

                <Btn type="submit" rubro="porcino" size="lg" block disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar evento'}
                </Btn>
              </form>
            )}

            {/* Historial */}
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pt-1">
              <History className="w-5 h-5 text-slate-700" aria-hidden="true" /> Historial ({filteredEvents.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative col-span-2 sm:col-span-1">
                <Search className="w-5 h-5 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Buscar en el historial"
                  placeholder="Buscar en el historial"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
              <select aria-label="Tipo de evento" value={filterType} onChange={(e) => setFilterType(e.target.value)} className={`${inputClass} col-span-2 sm:col-span-1`}>
                <option value="all">Todos los eventos</option>
                <option value="pesaje">Pesajes</option>
                <option value="vacunacion">Vacunas</option>
                <option value="tratamiento">Tratamientos</option>
                <option value="parto">Partos</option>
                <option value="monta">Montas</option>
                <option value="observacion">Observaciones</option>
              </select>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-600 text-sm">
                No hay eventos con este filtro.
              </div>
            ) : (
              <ol className="space-y-2">
                {filteredEvents.map((ev, index) => {
                  const badge = getEventBadge(ev.type);
                  const IconComponent = badge.icon;
                  return (
                    <li key={ev.id || index} className="bg-white p-3 rounded-2xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${badge.bg}`}>
                          <IconComponent className="w-3.5 h-3.5" aria-hidden="true" /> {badge.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> {ev.date}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{ev.title}</h4>
                      {ev.description && <p className="text-sm text-slate-700 leading-snug">{ev.description}</p>}
                      {(ev.responsible || ev.costUsd) && (
                        <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                          <span>{ev.responsible ? `Por: ${ev.responsible}` : ''}</span>
                          {ev.costUsd ? <span className="font-semibold text-emerald-800">Costo: ${ev.costUsd.toFixed(2)}</span> : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
        {confirmDialog}
      </div>
    </div>
  );
};
