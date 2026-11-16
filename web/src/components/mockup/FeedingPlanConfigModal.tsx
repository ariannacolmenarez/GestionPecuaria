import React, { useId, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Utensils, Layers, Heart, Baby, Activity, ShieldCheck, Info, Save, Pencil } from 'lucide-react';
import { ProductionFeedingPlan, ProductionFeedingPhase, ProductionType } from '../../types';
import { newId } from '../../utils/ids';
import { round2 } from '../../models/porcinoRules';
import { toNumber } from './modalResult';
import {
  Btn,
  ConfirmDialog,
  ErrorBox,
  FieldError,
  FieldLabel,
  ModalHeader,
  Overlay,
  fieldClass,
  inputClass,
  useBackClose,
  useFocusFirstInvalid,
} from '../common/ui';

interface FeedingPlanConfigModalProps {
  plans: ProductionFeedingPlan[];
  initialType?: ProductionType;
  onClose: () => void;
  /** Se llama SOLO al pulsar "Guardar cambios" (no en cada tecla). */
  onUpdatePlans: (updated: ProductionFeedingPlan[]) => void | Promise<void>;
}

/** Renumera las fases (1..n) y recalcula totales/etiquetas derivadas. */
const normalizePhases = (phases: ProductionFeedingPhase[]): ProductionFeedingPhase[] =>
  phases.map((ph, idx) => ({
    ...ph,
    phaseNumber: idx + 1,
    totalFeedKg: round2(toNumber(ph.dailyConsumptionKg) * toNumber(ph.durationDays)),
    weightRangeKg: `${toNumber(ph.minWeightKg)} kg - ${toNumber(ph.maxWeightKg)} kg`,
  }));

const getProductionBadge = (type: ProductionType) => {
  switch (type) {
    case 'engorde':
      return { label: 'Engorde', icon: Layers };
    case 'maternidad':
      return { label: 'Maternidad', icon: Heart };
    case 'lechones':
      return { label: 'Lechones', icon: Baby };
    default:
      return { label: 'Verracos', icon: Activity };
  }
};

type PhaseErrors = Partial<Record<'stage' | 'feed' | 'min' | 'max' | 'days' | 'daily', string>>;

export const FeedingPlanConfigModal: React.FC<FeedingPlanConfigModalProps> = ({
  plans,
  initialType = 'engorde',
  onClose,
  onUpdatePlans,
}) => {
  const uid = useId();
  const titleId = `${uid}-title`;
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedType, setSelectedType] = useState<ProductionType>(initialType);
  // Edición en estado local: solo se persiste al pulsar "Guardar cambios"
  const [localPlans, setLocalPlans] = useState<ProductionFeedingPlan[]>(() =>
    (plans || []).map((p) => ({ ...p, phases: [...(p.phases || [])] }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [showNewPhaseForm, setShowNewPhaseForm] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [phaseErrors, setPhaseErrors] = useState<PhaseErrors>({});
  const [submits, setSubmits] = useState(0);
  const [toDelete, setToDelete] = useState<ProductionFeedingPhase | null>(null);

  // Nueva etapa
  const [newStageName, setNewStageName] = useState('');
  const [newFeedName, setNewFeedName] = useState('');
  const [newMinWeight, setNewMinWeight] = useState('');
  const [newMaxWeight, setNewMaxWeight] = useState('');
  const [newDaysRange, setNewDaysRange] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('');
  const [newDailyKg, setNewDailyKg] = useState('');
  const [newAnimalState, setNewAnimalState] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const typedNewPhase =
    showNewPhaseForm &&
    !!(newStageName.trim() || newFeedName.trim() || newMinWeight || newMaxWeight || newDurationDays || newDailyKg || newAnimalState.trim() || newDescription.trim() || newDaysRange.trim());
  const { requestClose, confirmDialog } = useBackClose(true, onClose, isDirty || typedNewPhase);
  useFocusFirstInvalid(formRef, (Object.values(phaseErrors).find(Boolean) as string | undefined) || null, submits);

  const currentPlan = useMemo(
    () => localPlans.find((p) => p.productionType === selectedType) || localPlans[0],
    [localPlans, selectedType]
  );
  const currentPhases = currentPlan?.phases || [];

  const updateCurrentPlanPhases = (fn: (phases: ProductionFeedingPhase[]) => ProductionFeedingPhase[]) => {
    if (!currentPlan) return;
    setLocalPlans((prev) =>
      prev.map((plan) =>
        plan.productionType === currentPlan.productionType ? { ...plan, phases: normalizePhases(fn(plan.phases || [])) } : plan
      )
    );
    setIsDirty(true);
    setSavedNotice(false);
  };

  const handleUpdatePhase = (phaseId: string, updates: Partial<ProductionFeedingPhase>) => {
    updateCurrentPlanPhases((phases) => phases.map((ph) => (ph.id === phaseId ? { ...ph, ...updates } : ph)));
  };

  const handleDeletePhase = (phaseId: string) => {
    if (editingPhaseId === phaseId) setEditingPhaseId(null);
    updateCurrentPlanPhases((phases) => phases.filter((ph) => ph.id !== phaseId));
  };

  const handleAddPhase = (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (!currentPlan) return;
    const min = toNumber(newMinWeight);
    const max = toNumber(newMaxWeight);
    const duration = Math.max(1, Math.round(toNumber(newDurationDays, 1)));
    const daily = toNumber(newDailyKg);
    const next: PhaseErrors = {};
    if (!newStageName.trim()) next.stage = 'Escribe el nombre de la etapa.';
    if (!newFeedName.trim()) next.feed = 'Escribe qué alimento se da.';
    if (newMinWeight === '' || min < 0) next.min = 'Escribe el peso de inicio.';
    if (max <= 0) next.max = 'Escribe el peso final.';
    else if (min > max) next.max = 'Debe ser mayor o igual al peso de inicio.';
    if (!newDurationDays || toNumber(newDurationDays) < 1) next.days = 'Escribe cuántos días dura (1 o más).';
    if (daily <= 0) next.daily = 'Escribe cuántos kg come al día.';
    setPhaseErrors(next);
    setSubmits((n) => n + 1);
    if (Object.keys(next).length > 0) return;

    const newPhase: ProductionFeedingPhase = {
      id: newId('phase'),
      phaseNumber: currentPhases.length + 1,
      stageName: newStageName.trim(),
      feedName: newFeedName.trim(),
      weightRangeKg: `${min} kg - ${max} kg`,
      minWeightKg: min,
      maxWeightKg: max,
      daysRange: newDaysRange.trim() || `${duration} días`,
      durationDays: duration,
      dailyConsumptionKg: daily,
      totalFeedKg: round2(daily * duration),
      animalState: newAnimalState.trim() || 'Desarrollo Productivo',
      description: newDescription.trim() || undefined,
    };

    updateCurrentPlanPhases((phases) => [...phases, newPhase]);
    setShowNewPhaseForm(false);
    setNewStageName('');
    setNewFeedName('');
    setNewMinWeight('');
    setNewMaxWeight('');
    setNewDaysRange('');
    setNewDurationDays('');
    setNewDailyKg('');
    setNewAnimalState('');
    setNewDescription('');
  };

  const invalidPhase = useMemo(
    () =>
      localPlans
        .flatMap((p) => (p.phases || []).map((ph) => ({ plan: p, ph })))
        .find(({ ph }) => toNumber(ph.minWeightKg) > toNumber(ph.maxWeightKg) || toNumber(ph.durationDays) < 1),
    [localPlans]
  );

  const handleSave = async () => {
    setFormError(null);
    if (invalidPhase) {
      setFormError(
        `Revisa la etapa "${invalidPhase.ph.stageName}" de ${invalidPhase.plan.typeName}: el peso de inicio es mayor que el final o los días no son válidos.`
      );
      return;
    }
    setIsSaving(true);
    try {
      await onUpdatePlans(localPlans.map((p) => ({ ...p, phases: normalizePhases(p.phases || []) })));
      setIsDirty(false);
      setSavedNotice(true);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const numInput = (v: string) => toNumber(v);
  const pErr = (k: keyof PhaseErrors) => (phaseErrors[k] ? `${uid}-p-${k}` : undefined);
  /** Muestra vacío en lugar de 0 (el usuario no tiene que borrar el cero). */
  const shown = (v: number | undefined) => (v ? v : '');

  const numberField = (
    key: keyof PhaseErrors,
    label: string,
    value: string,
    set: (v: string) => void,
    opts: { placeholder: string; mode: 'decimal' | 'numeric'; step?: string }
  ) => (
    <div>
      <FieldLabel htmlFor={`${uid}-n-${key}`}>{label}</FieldLabel>
      <input
        id={`${uid}-n-${key}`}
        type="number"
        inputMode={opts.mode}
        step={opts.step}
        min="0"
        placeholder={opts.placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        aria-invalid={!!phaseErrors[key]}
        aria-describedby={pErr(key)}
        className={fieldClass(!!phaseErrors[key], 'font-bold')}
      />
      <FieldError id={pErr(key)} error={phaseErrors[key]} />
    </div>
  );

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="feeding-plan-config-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white text-slate-900 w-full max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94%] sm:max-h-[92vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Utensils />}
          title="Plan de alimentación"
          subtitle="Alimento, kg por día y pesos de cada etapa"
          titleId={titleId}
          onClose={requestClose}
        />

        {/* Tipo de producción: todas visibles */}
        <div role="tablist" aria-label="Tipo de producción" className="bg-slate-100 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 shrink-0">
          {localPlans.map((p) => {
            const badge = getProductionBadge(p.productionType);
            const IconComponent = badge.icon;
            const isSelected = selectedType === p.productionType;
            return (
              <button
                key={p.productionType}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedType(p.productionType);
                  setShowNewPhaseForm(false);
                  setEditingPhaseId(null);
                  setPhaseErrors({});
                }}
                className={`min-h-11 px-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                  isSelected ? 'bg-rose-600 text-white' : 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                <IconComponent className="w-4 h-4" aria-hidden="true" />
                <span>{badge.label}</span>
              </button>
            );
          })}
        </div>

        {!currentPlan ? (
          <div className="flex-1 p-8 text-center text-sm text-slate-700">No hay planes de alimentación configurados.</div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
            <p className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2 text-amber-950 text-xs leading-snug">
              <Info className="w-4 h-4 text-amber-800 shrink-0 mt-px" aria-hidden="true" />
              <span>
                Estas etapas definen cuánto come cada animal al día, qué alimento y el peso esperado que verás en su ficha.
                Los cambios valen al tocar <strong>Guardar cambios</strong>.
              </span>
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-black text-base text-slate-900">{currentPlan.typeName}</h3>
                {currentPlan.description && <p className="text-xs text-slate-700">{currentPlan.description}</p>}
              </div>
              <Btn
                variant="secondary"
                icon={<Plus />}
                aria-expanded={showNewPhaseForm}
                onClick={() => {
                  setShowNewPhaseForm(!showNewPhaseForm);
                  setPhaseErrors({});
                }}
              >
                {showNewPhaseForm ? 'Cerrar' : 'Añadir etapa'}
              </Btn>
            </div>

            {/* Nueva etapa */}
            {showNewPhaseForm && (
              <form ref={formRef} onSubmit={handleAddPhase} noValidate className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-3">
                <p className="font-bold text-sm text-amber-950">Nueva etapa para {currentPlan.typeName}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor={`${uid}-stage`}>Nombre de la etapa *</FieldLabel>
                    <input
                      id={`${uid}-stage`}
                      type="text"
                      placeholder="Ej: Crecimiento"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      aria-invalid={!!phaseErrors.stage}
                      aria-describedby={pErr('stage')}
                      className={fieldClass(!!phaseErrors.stage, 'font-semibold')}
                    />
                    <FieldError id={pErr('stage')} error={phaseErrors.stage} />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-feed`}>Alimento *</FieldLabel>
                    <input
                      id={`${uid}-feed`}
                      type="text"
                      placeholder="Ej: Crecimiento 16% proteína"
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      aria-invalid={!!phaseErrors.feed}
                      aria-describedby={pErr('feed')}
                      className={fieldClass(!!phaseErrors.feed, 'font-semibold')}
                    />
                    <FieldError id={pErr('feed')} error={phaseErrors.feed} />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {numberField('min', 'Peso inicio (kg) *', newMinWeight, setNewMinWeight, { placeholder: 'Ej. 20', mode: 'decimal', step: '0.5' })}
                  {numberField('max', 'Peso final (kg) *', newMaxWeight, setNewMaxWeight, { placeholder: 'Ej. 40', mode: 'decimal', step: '0.5' })}
                  {numberField('days', 'Días que dura *', newDurationDays, setNewDurationDays, { placeholder: 'Ej. 30', mode: 'numeric' })}
                  {numberField('daily', 'Kg por día *', newDailyKg, setNewDailyKg, { placeholder: 'Ej. 1.5', mode: 'decimal', step: '0.05' })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor={`${uid}-range`}>Días (texto de referencia)</FieldLabel>
                    <input
                      id={`${uid}-range`}
                      type="text"
                      placeholder="Ej: Días 51 a 95"
                      value={newDaysRange}
                      onChange={(e) => setNewDaysRange(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-state`}>Estado del animal</FieldLabel>
                    <input
                      id={`${uid}-state`}
                      type="text"
                      placeholder="Ej: Ganando carne"
                      value={newAnimalState}
                      onChange={(e) => setNewAnimalState(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel htmlFor={`${uid}-desc`}>Recomendaciones</FieldLabel>
                  <input
                    id={`${uid}-desc`}
                    type="text"
                    placeholder="Ej: dar en dos comidas, agua siempre limpia"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
                  <Btn variant="secondary" onClick={() => setShowNewPhaseForm(false)}>
                    Cancelar
                  </Btn>
                  <Btn type="submit" rubro="porcino" block icon={<Plus />}>
                    Añadir etapa
                  </Btn>
                </div>
              </form>
            )}

            {/* Etapas */}
            <ul className="space-y-3">
              {currentPhases.length === 0 && (
                <li className="p-6 text-center text-slate-700 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  Este plan no tiene etapas. Añade la primera.
                </li>
              )}
              {currentPhases.map((phase) => {
                const editing = editingPhaseId === phase.id;
                return (
                  <li key={phase.id} className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">Etapa {phase.phaseNumber}</span>
                          <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">{phase.daysRange}</span>
                        </div>
                        <h4 className="font-black text-slate-900 text-base mt-1">{phase.stageName}</h4>
                        <span className="text-xs text-slate-700 block">
                          Estado: <strong className="text-slate-900">{phase.animalState}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingPhaseId(editing ? null : phase.id)}
                          aria-expanded={editing}
                          className="min-h-11 px-3 inline-flex items-center gap-1.5 text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          {editing ? 'Listo' : 'Editar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(phase)}
                          aria-label={`Eliminar etapa ${phase.stageName}`}
                          className="min-w-11 min-h-11 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                        >
                          <Trash2 className="w-5 h-5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {editing ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-feed`}>Alimento</FieldLabel>
                            <input
                              id={`${phase.id}-feed`}
                              type="text"
                              value={phase.feedName}
                              onChange={(e) => handleUpdatePhase(phase.id, { feedName: e.target.value })}
                              className={`${inputClass} font-semibold`}
                            />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-state`}>Estado del animal</FieldLabel>
                            <input
                              id={`${phase.id}-state`}
                              type="text"
                              value={phase.animalState}
                              onChange={(e) => handleUpdatePhase(phase.id, { animalState: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-min`}>Peso inicio (kg)</FieldLabel>
                            <input
                              id={`${phase.id}-min`}
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              placeholder="0"
                              value={shown(phase.minWeightKg)}
                              onChange={(e) => handleUpdatePhase(phase.id, { minWeightKg: numInput(e.target.value) })}
                              className={`${inputClass} font-bold`}
                            />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-max`}>Peso final (kg)</FieldLabel>
                            <input
                              id={`${phase.id}-max`}
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              placeholder="0"
                              value={shown(phase.maxWeightKg)}
                              aria-invalid={toNumber(phase.minWeightKg) > toNumber(phase.maxWeightKg)}
                              onChange={(e) => handleUpdatePhase(phase.id, { maxWeightKg: numInput(e.target.value) })}
                              className={fieldClass(toNumber(phase.minWeightKg) > toNumber(phase.maxWeightKg), 'font-bold')}
                            />
                            {toNumber(phase.minWeightKg) > toNumber(phase.maxWeightKg) && (
                              <FieldError error="Debe ser mayor o igual al peso de inicio." />
                            )}
                          </div>
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-days`}>Días que dura</FieldLabel>
                            <input
                              id={`${phase.id}-days`}
                              type="number"
                              inputMode="numeric"
                              min="1"
                              value={phase.durationDays}
                              onChange={(e) => handleUpdatePhase(phase.id, { durationDays: Math.max(1, Math.round(numInput(e.target.value))) })}
                              className={`${inputClass} font-bold`}
                            />
                          </div>
                          <div>
                            <FieldLabel htmlFor={`${phase.id}-daily`}>Kg por día</FieldLabel>
                            <input
                              id={`${phase.id}-daily`}
                              type="number"
                              inputMode="decimal"
                              step="0.05"
                              min="0"
                              placeholder="0"
                              value={shown(phase.dailyConsumptionKg)}
                              onChange={(e) => handleUpdatePhase(phase.id, { dailyConsumptionKg: Math.max(0, numInput(e.target.value)) })}
                              className={`${inputClass} font-bold`}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 min-w-0">
                          <dt className="text-xs text-slate-600">Alimento</dt>
                          <dd className="text-slate-900 font-bold text-sm break-words">{phase.feedName}</dd>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <dt className="text-xs text-slate-600">Peso</dt>
                          <dd className="text-slate-900 font-bold text-sm">{phase.weightRangeKg}</dd>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                          <dt className="text-xs text-amber-900">Come al día</dt>
                          <dd className="text-amber-950 font-black text-sm">{phase.dailyConsumptionKg} kg</dd>
                        </div>
                        <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                          <dt className="text-xs text-emerald-900">Total en la etapa</dt>
                          <dd className="text-emerald-950 font-black text-sm">{phase.totalFeedKg} kg por animal</dd>
                        </div>
                      </dl>
                    )}

                    {phase.description && <p className="text-xs text-slate-700 italic bg-slate-50 p-2 rounded-lg">{phase.description}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Pie fijo */}
        <div className="bg-white p-3 border-t border-slate-200 shrink-0 space-y-2">
          <ErrorBox error={formError} />
          <p className={`text-xs font-semibold flex items-center gap-1.5 ${isDirty ? 'text-amber-800' : 'text-emerald-800'}`} aria-live="polite">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            {isDirty ? 'Tienes cambios sin guardar' : savedNotice ? 'Plan guardado' : 'No hay cambios para guardar'}
          </p>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Btn variant="secondary" size="lg" onClick={requestClose}>
              {isDirty ? 'Cancelar' : 'Cerrar'}
            </Btn>
            <Btn rubro="porcino" size="lg" block onClick={handleSave} disabled={!isDirty || isSaving} icon={<Save />}>
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </Btn>
          </div>
        </div>

        {toDelete && (
          <ConfirmDialog
            title="¿Eliminar esta etapa?"
            message={
              <p>
                Se quitará la etapa <strong>{toDelete.stageName}</strong> del plan. Podrás deshacerlo cerrando sin guardar.
              </p>
            }
            confirmLabel="Eliminar"
            danger
            onConfirm={() => {
              handleDeletePhase(toDelete.id);
              setToDelete(null);
            }}
            onCancel={() => setToDelete(null)}
          />
        )}
        {confirmDialog}
      </div>
    </Overlay>
  );
};
