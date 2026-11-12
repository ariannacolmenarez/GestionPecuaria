import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Utensils, Layers, Heart, Baby, Activity, ShieldCheck, Info, Save } from 'lucide-react';
import { ProductionFeedingPlan, ProductionFeedingPhase, ProductionType } from '../../types';
import { newId } from '../../utils/ids';
import { round2 } from '../../models/porcinoRules';
import { toNumber } from './modalResult';

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

export const FeedingPlanConfigModal: React.FC<FeedingPlanConfigModalProps> = ({
  plans,
  initialType = 'engorde',
  onClose,
  onUpdatePlans,
}) => {
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

  // New Phase Form State
  const [newStageName, setNewStageName] = useState('');
  const [newFeedName, setNewFeedName] = useState('');
  const [newMinWeight, setNewMinWeight] = useState('');
  const [newMaxWeight, setNewMaxWeight] = useState('');
  const [newDaysRange, setNewDaysRange] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('');
  const [newDailyKg, setNewDailyKg] = useState('');
  const [newAnimalState, setNewAnimalState] = useState('');
  const [newDescription, setNewDescription] = useState('');

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
    if (!newStageName.trim() || !newFeedName.trim()) {
      setFormError('Indica el nombre de la etapa y el alimento.');
      return;
    }
    const min = toNumber(newMinWeight);
    const max = toNumber(newMaxWeight);
    const duration = Math.max(1, Math.round(toNumber(newDurationDays, 1)));
    const daily = toNumber(newDailyKg);
    if (min < 0 || max <= 0 || min > max) {
      setFormError('El peso mínimo debe ser menor o igual al máximo (y ambos positivos).');
      return;
    }
    if (daily <= 0) {
      setFormError('El consumo diario debe ser mayor a 0.');
      return;
    }

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
        `Revisa la etapa "${invalidPhase.ph.stageName}" de ${invalidPhase.plan.typeName}: peso mínimo mayor al máximo o duración inválida.`
      );
      return;
    }
    setIsSaving(true);
    try {
      await onUpdatePlans(localPlans.map((p) => ({ ...p, phases: normalizePhases(p.phases || []) })));
      setIsDirty(false);
      setSavedNotice(true);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?')) return;
    onClose();
  };

  const numInput = (v: string) => toNumber(v);

  const getProductionBadge = (type: ProductionType) => {
    switch (type) {
      case 'engorde':
        return { label: 'Engorde Comercial', icon: Layers, color: 'text-emerald-700' };
      case 'maternidad':
        return { label: 'Maternidad y Cerdas', icon: Heart, color: 'text-rose-700' };
      case 'lechones':
        return { label: 'Lechones Lactantes', icon: Baby, color: 'text-amber-700' };
      default:
        return { label: 'Verracos Sementales', icon: Activity, color: 'text-blue-700' };
    }
  };

  return (
    <div
      id="feeding-plan-config-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="feeding-plan-config-card"
        className="bg-white text-slate-900 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Configuración del Plan de Alimentación por Producción
              </h3>
              <p className="text-[11px] text-slate-400">
                Ajuste de raciones, alimentos, rangos de peso y días por etapa productiva
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Banner */}
        <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-amber-950 shrink-0">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Parámetros Nutricionales:</strong> Las etapas aquí configuradas determinan
            automáticamente la ración diaria (kg/día), el alimento correspondiente y el peso esperado
            que se mostrará en la trazabilidad individual de cada animal. Los cambios se aplican al pulsar
            <strong> Guardar cambios</strong>.
          </p>
        </div>

        {/* Production Type Selector Tabs */}
        <div className="bg-slate-100 p-2 flex items-center gap-1.5 border-b border-slate-200 shrink-0 overflow-x-auto">
          {localPlans.map((p) => {
            const badge = getProductionBadge(p.productionType);
            const IconComponent = badge.icon;
            const isSelected = selectedType === p.productionType;
            return (
              <button
                key={p.productionType}
                onClick={() => {
                  setSelectedType(p.productionType);
                  setShowNewPhaseForm(false);
                  setEditingPhaseId(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <IconComponent className="w-3.5 h-3.5" />
                <span>{badge.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Phase List */}
        {!currentPlan ? (
          <div className="flex-1 p-8 text-center text-xs text-slate-500">
            No hay planes de alimentación configurados.
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {formError && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
              {formError}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-black text-sm text-slate-900">{currentPlan.typeName}</h4>
              <p className="text-[11px] text-slate-500">{currentPlan.description}</p>
            </div>

            <button
              type="button"
              onClick={() => setShowNewPhaseForm(!showNewPhaseForm)}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-100 px-3 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewPhaseForm ? 'Cancelar' : 'Añadir Etapa Nutricional'}</span>
            </button>
          </div>

          {/* Form to Add New Phase */}
          {showNewPhaseForm && (
            <form
              onSubmit={handleAddPhase}
              className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-3 animate-in fade-in"
            >
              <span className="font-bold text-xs text-amber-950 block">
                Nueva Etapa Nutricional para {currentPlan.typeName}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Nombre de la Etapa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Crecimiento y Desarrollo Ceba"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Alimento Administrado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Alimento Crecimiento Ceba 16% PB"
                    value={newFeedName}
                    onChange={(e) => setNewFeedName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Peso Mínimo (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="Ej. 20"
                    value={newMinWeight}
                    onChange={(e) => setNewMinWeight(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Peso Máximo (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="Ej. 40"
                    value={newMaxWeight}
                    onChange={(e) => setNewMaxWeight(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Días de Duración *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Ej. 30"
                    value={newDurationDays}
                    onChange={(e) => setNewDurationDays(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Consumo Diario (kg/d) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    required
                    placeholder="Ej. 1.5"
                    value={newDailyKg}
                    onChange={(e) => setNewDailyKg(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Rango de Días (Texto referencial)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Días 51 - 95 (45 días)"
                    value={newDaysRange}
                    onChange={(e) => setNewDaysRange(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Estado Fisiológico del Animal *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Máxima Deposición de Tejido Magro"
                    value={newAnimalState}
                    onChange={(e) => setNewAnimalState(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Descripción Nutricional / Recomendaciones
                </label>
                <input
                  type="text"
                  placeholder="Objetivo metabólico, suplementación o indicaciones especiales..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewPhaseForm(false)}
                  className="px-3 py-1.5 text-slate-600 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Añadir Etapa
                </button>
              </div>
            </form>
          )}

          {/* Phases list */}
          <div className="space-y-3">
            {currentPhases.length === 0 && (
              <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Este plan no tiene etapas. Añade la primera etapa nutricional.
              </div>
            )}
            {currentPhases.map((phase) => (
              <div
                key={phase.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        Fase {phase.phaseNumber}
                      </span>
                      <span className="font-mono text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        {phase.daysRange}
                      </span>
                      <h5 className="font-black text-slate-900 text-sm">{phase.stageName}</h5>
                    </div>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      Estado: <strong className="text-slate-800">{phase.animalState}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPhaseId(editingPhaseId === phase.id ? null : phase.id)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      {editingPhaseId === phase.id ? 'Cerrar Edición' : 'Editar Valores'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePhase(phase.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar etapa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline Quick Editor if toggled */}
                {editingPhaseId === phase.id ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Alimento Asignado:
                        </label>
                        <input
                          type="text"
                          value={phase.feedName}
                          onChange={(e) => handleUpdatePhase(phase.id, { feedName: e.target.value })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Estado Fisiológico:
                        </label>
                        <input
                          type="text"
                          value={phase.animalState}
                          onChange={(e) => handleUpdatePhase(phase.id, { animalState: e.target.value })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Peso Mín (kg):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={phase.minWeightKg}
                          min="0"
                          onChange={(e) => handleUpdatePhase(phase.id, { minWeightKg: numInput(e.target.value) })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Peso Máx (kg):
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={phase.maxWeightKg}
                          min="0"
                          onChange={(e) => handleUpdatePhase(phase.id, { maxWeightKg: numInput(e.target.value) })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Días etapa:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={phase.durationDays}
                          onChange={(e) => handleUpdatePhase(phase.id, { durationDays: Math.max(1, Math.round(numInput(e.target.value))) })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                          Kg / día:
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={phase.dailyConsumptionKg}
                          min="0"
                          onChange={(e) => handleUpdatePhase(phase.id, { dailyConsumptionKg: Math.max(0, numInput(e.target.value)) })}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard Phase Display (Matching Requisito 7 & current visual design) */
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Alimento</span>
                      <strong className="text-slate-900 font-bold block text-[11px] truncate" title={phase.feedName}>
                        {phase.feedName}
                      </strong>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-500 block">Rango de Peso</span>
                      <strong className="text-slate-900 font-bold block text-[11px]">
                        {phase.weightRangeKg}
                      </strong>
                    </div>

                    <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-amber-800 block">Consumo Diario</span>
                      <strong className="text-amber-950 font-black block text-[11px]">
                        {phase.dailyConsumptionKg} kg / día
                      </strong>
                    </div>

                    <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 block">Total en la Etapa</span>
                      <strong className="text-emerald-950 font-black block text-[11px]">
                        {phase.totalFeedKg} kg / animal
                      </strong>
                    </div>
                  </div>
                )}

                {phase.description && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50/60 p-2 rounded-lg">
                    {phase.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        )}

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <ShieldCheck className={`w-4 h-4 ${isDirty ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>
              {isDirty
                ? 'Cambios sin guardar'
                : savedNotice
                ? 'Configuración guardada'
                : 'Configuración sincronizada con alimentación y trazabilidad'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
            >
              {isDirty ? 'Cancelar' : 'Cerrar'}
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
