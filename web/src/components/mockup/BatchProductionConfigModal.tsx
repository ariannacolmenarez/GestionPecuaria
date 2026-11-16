import React, { useId, useMemo, useRef, useState } from 'react';
import { Calendar, Layers, Plus, Clock, ShieldCheck, Pill, Info, Trash2, Heart, Baby, Activity, Save, CheckCircle2 } from 'lucide-react';
import { BatchProductionConfig, ProductionBatch, ProductionType, ProtocolActivityTemplate } from '../../types';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import { todayISO } from '../../utils/dates';
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

export interface StartBatchPayload {
  productionType: ProductionType;
  code: string;
  animalCount: number;
  location: string;
  startDate?: string;
  protocolId?: string;
}

interface BatchProductionConfigModalProps {
  configs: BatchProductionConfig[];
  onClose: () => void;
  /** Se llama SOLO al pulsar "Guardar cambios" (no en cada tecla). */
  onUpdateConfigs: (updated: BatchProductionConfig[]) => void | Promise<void>;
  /** Lotes de producción existentes (opcional): informa cuántos lotes activos usan cada plan. */
  existingBatches?: ProductionBatch[];
  /** Inicia un lote con el protocolo guardado (porcinoActions.startProductionBatch). */
  onStartBatch?: (payload: StartBatchPayload) => ModalActionReturn;
}

const ROLES = ['Veterinario / Técnico Pecuario', 'Encargado de granja', 'Operador', 'Trabajador'];

const sortActivities = (acts: ProtocolActivityTemplate[]) =>
  [...acts].sort((a, b) => toNumber(a.dayOffset) - toNumber(b.dayOffset));

type ActErrors = Partial<Record<'day' | 'title', string>>;
type StartErrors = Partial<Record<'code' | 'count' | 'start', string>>;

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

export const BatchProductionConfigModal: React.FC<BatchProductionConfigModalProps> = ({
  configs = [],
  onClose,
  onUpdateConfigs,
  existingBatches = [],
  onStartBatch,
}) => {
  const uid = useId();
  const titleId = `${uid}-title`;
  const actFormRef = useRef<HTMLFormElement>(null);
  const startFormRef = useRef<HTMLFormElement>(null);

  // Formulario "Iniciar lote" (usa el protocolo YA guardado de este tipo de producción)
  const [showStartForm, setShowStartForm] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [batchCount, setBatchCount] = useState('');
  const [batchLocation, setBatchLocation] = useState('');
  const [batchStart, setBatchStart] = useState(todayISO());
  const [startErrors, setStartErrors] = useState<StartErrors>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const [startSubmits, setStartSubmits] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  // Edición en estado local: solo se persiste al pulsar "Guardar cambios"
  const [localConfigs, setLocalConfigs] = useState<BatchProductionConfig[]>(() =>
    (configs || []).map((c) => ({ ...c, activities: sortActivities(c.activities || []) }))
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedConfigType, setSelectedConfigType] = useState<ProductionType>(
    localConfigs.some((c) => c.productionType === 'engorde') ? 'engorde' : localConfigs[0]?.productionType || 'engorde'
  );

  // Nueva actividad del plan
  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [newActivityDay, setNewActivityDay] = useState('');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityMed, setNewActivityMed] = useState('');
  const [newActivityDosage, setNewActivityDosage] = useState('');
  const [newActivityProc, setNewActivityProc] = useState('');
  const [newActivityRole, setNewActivityRole] = useState(ROLES[0]);
  const [actErrors, setActErrors] = useState<ActErrors>({});
  const [actSubmits, setActSubmits] = useState(0);
  const [toDelete, setToDelete] = useState<ProtocolActivityTemplate | null>(null);

  const typedSomething =
    (showAddActivityForm && !!(newActivityDay || newActivityTitle.trim() || newActivityMed.trim() || newActivityDosage.trim() || newActivityProc.trim())) ||
    (showStartForm && !!(batchCode.trim() || batchCount || batchLocation.trim()));
  const { requestClose, confirmDialog } = useBackClose(true, onClose, isDirty || typedSomething);
  useFocusFirstInvalid(actFormRef, actErrors.day || actErrors.title || null, actSubmits);
  useFocusFirstInvalid(startFormRef, startErrors.code || startErrors.count || startErrors.start || null, startSubmits);

  const currentConfig = useMemo(
    () => localConfigs.find((c) => c.productionType === selectedConfigType) || localConfigs[0],
    [localConfigs, selectedConfigType]
  );
  const currentActivities = currentConfig?.activities || [];

  const activeBatchesForCurrent = useMemo(
    () =>
      (existingBatches || []).filter(
        (b) => b.status === 'activo' && currentConfig && (b.protocolId === currentConfig.id || b.productionType === currentConfig.productionType)
      ).length,
    [existingBatches, currentConfig]
  );

  // Corrales ya usados (para elegir en vez de escribir)
  const knownLocations = useMemo(
    () => Array.from(new Set((existingBatches || []).map((b) => (b.location || '').trim()).filter((l) => l && l !== 'Sin ubicación'))).sort(),
    [existingBatches]
  );

  const updateCurrent = (fn: (c: BatchProductionConfig) => BatchProductionConfig) => {
    if (!currentConfig) return;
    setLocalConfigs((prev) => prev.map((c) => (c.id === currentConfig.id ? fn(c) : c)));
    setIsDirty(true);
    setSavedNotice(false);
  };

  const handleRemoveActivity = (actId: string) => {
    updateCurrent((c) => ({ ...c, activities: (c.activities || []).filter((a) => a.id !== actId) }));
  };

  const handleAddActivityTemplate = (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    if (!currentConfig) return;
    const title = newActivityTitle.trim();
    const day = Math.round(toNumber(newActivityDay, NaN));
    const next: ActErrors = {};
    if (!Number.isFinite(day) || day < 0 || day > Math.max(1, toNumber(currentConfig.cycleDurationDays, 365))) {
      next.day = `Escribe un día entre 0 y ${currentConfig.cycleDurationDays}.`;
    }
    if (!title) next.title = 'Escribe el nombre de la actividad.';
    setActErrors(next);
    setActSubmits((n) => n + 1);
    if (next.day || next.title) return;

    const newAct: ProtocolActivityTemplate = {
      id: newId('act-tpl'),
      dayOffset: day,
      title,
      medicament: newActivityMed.trim(),
      dosage: newActivityDosage.trim(),
      procedure: newActivityProc.trim(),
      responsibleRole: newActivityRole,
    };

    updateCurrent((c) => ({ ...c, activities: sortActivities([...(c.activities || []), newAct]) }));
    setNewActivityDay('');
    setNewActivityTitle('');
    setNewActivityMed('');
    setNewActivityDosage('');
    setNewActivityProc('');
    setShowAddActivityForm(false);
  };

  const handleUpdateDuration = (value: string) => {
    const days = Math.min(365, Math.max(1, Math.round(toNumber(value, 1))));
    updateCurrent((c) => ({ ...c, cycleDurationDays: days }));
  };

  const handleSave = async () => {
    setFormError(null);
    const outOfRange = localConfigs.find((c) =>
      (c.activities || []).some((a) => toNumber(a.dayOffset) > toNumber(c.cycleDurationDays))
    );
    if (outOfRange) {
      setFormError(`El plan "${outOfRange.typeName}" tiene actividades después del último día del ciclo (${outOfRange.cycleDurationDays} días).`);
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateConfigs(localConfigs.map((c) => ({ ...c, activities: sortActivities(c.activities || []) })));
      setIsDirty(false);
      setSavedNotice(true);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar el plan.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartBatch = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setStartError(null);
    setStartNotice(null);
    if (!onStartBatch || !currentConfig) return;
    if (isDirty) {
      setStartError('Primero toca "Guardar cambios": el lote usa el plan guardado.');
      return;
    }
    const code = batchCode.trim();
    const count = Math.round(toNumber(batchCount, NaN));
    const next: StartErrors = {};
    if (!code) next.code = 'Escribe el código del lote.';
    if (!Number.isFinite(count) || count <= 0) next.count = 'Escribe cuántos animales (1 o más).';
    if (!batchStart) next.start = 'Elige la fecha de inicio.';
    setStartErrors(next);
    setStartSubmits((n) => n + 1);
    if (Object.keys(next).length > 0) return;
    setIsStarting(true);
    const res = await runModalAction(() =>
      onStartBatch({
        productionType: currentConfig.productionType,
        code,
        animalCount: count,
        location: batchLocation.trim() || 'Sin ubicación',
        startDate: batchStart,
        protocolId: currentConfig.id,
      })
    );
    setIsStarting(false);
    if (!res.ok) {
      setStartError(res.error || 'No se pudo iniciar el lote.');
      return;
    }
    setStartNotice(res.message || `Lote ${code} iniciado. Sus tareas ya están en el calendario.`);
    setBatchCode('');
    setBatchCount('');
    setBatchLocation('');
    setShowStartForm(false);
  };

  const sErr = (k: keyof StartErrors) => (startErrors[k] ? `${uid}-s-${k}` : undefined);
  const aErr = (k: keyof ActErrors) => (actErrors[k] ? `${uid}-a-${k}` : undefined);

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="batch-production-config-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white text-slate-900 w-full max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94%] sm:max-h-[90vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<ShieldCheck />}
          title="Planes sanitarios"
          subtitle="Tareas que se programan solas por tipo de animal"
          titleId={titleId}
          onClose={requestClose}
        />

        {/* Tipo de producción: todas visibles, sin desplazamiento lateral */}
        <div role="tablist" aria-label="Tipo de producción" className="bg-slate-100 p-2 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-200 shrink-0">
          {localConfigs.map((c) => {
            const badge = getProductionBadge(c.productionType);
            const IconComponent = badge.icon;
            const isSelected = selectedConfigType === c.productionType;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedConfigType(c.productionType);
                  setShowAddActivityForm(false);
                  setActErrors({});
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

        {/* Contenido desplazable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
          <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-950 text-xs leading-snug">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-px" aria-hidden="true" />
            <span>
              Estas tareas se ponen <strong>solas en el calendario</strong> al ingresar cerdos de engorde, nuevas madres o al
              destetar. Los cambios valen para lo que registres después de <strong>Guardar cambios</strong>.
            </span>
          </p>

          {!currentConfig && <div className="p-8 text-center text-slate-700">No hay planes sanitarios configurados.</div>}

          {currentConfig && (
            <div className="space-y-4">
              {/* Resumen del plan */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                <div>
                  <h3 className="font-black text-base text-slate-900">{currentConfig.typeName}</h3>
                  {currentConfig.description && <p className="text-xs text-slate-700 mt-0.5">{currentConfig.description}</p>}
                  {existingBatches.length > 0 && (
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeBatchesForCurrent} lote(s) activo(s) de este tipo.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-600 shrink-0" aria-hidden="true" />
                  <label htmlFor={`${uid}-dur`} className="text-sm font-semibold text-slate-800">
                    Duración del ciclo
                  </label>
                  <input
                    id={`${uid}-dur`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="365"
                    enterKeyHint="done"
                    value={currentConfig.cycleDurationDays}
                    onChange={(e) => handleUpdateDuration(e.target.value)}
                    className={`${inputClass} !w-24 text-center font-bold`}
                  />
                  <span className="text-sm text-slate-700 font-semibold">días</span>
                </div>
              </div>

              {/* Iniciar lote con este plan */}
              {onStartBatch && (
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-300 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Iniciar un lote con este plan
                    </span>
                    <Btn
                      variant={showStartForm ? 'secondary' : 'primary'}
                      rubro="general"
                      onClick={() => {
                        setShowStartForm((v) => !v);
                        setStartError(null);
                        setStartErrors({});
                      }}
                    >
                      {showStartForm ? 'Cancelar' : 'Nuevo lote'}
                    </Btn>
                  </div>
                  {startNotice && (
                    <div role="status" className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-bold text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                      {startNotice}
                    </div>
                  )}
                  {showStartForm && (
                    <form ref={startFormRef} onSubmit={handleStartBatch} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <FieldLabel htmlFor={`${uid}-bcode`}>Código del lote *</FieldLabel>
                        <input
                          id={`${uid}-bcode`}
                          value={batchCode}
                          onChange={(e) => setBatchCode(e.target.value)}
                          aria-invalid={!!startErrors.code}
                          aria-describedby={sErr('code')}
                          className={fieldClass(!!startErrors.code)}
                          placeholder="Ej. ENG-01"
                        />
                        <FieldError id={sErr('code')} error={startErrors.code} />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`${uid}-bcount`}>Cantidad de animales *</FieldLabel>
                        <input
                          id={`${uid}-bcount`}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          placeholder="Ej. 20"
                          value={batchCount}
                          onChange={(e) => setBatchCount(e.target.value)}
                          aria-invalid={!!startErrors.count}
                          aria-describedby={sErr('count')}
                          className={fieldClass(!!startErrors.count)}
                        />
                        <FieldError id={sErr('count')} error={startErrors.count} />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`${uid}-bloc`} hint={knownLocations.length ? 'Elige uno de la lista o escribe uno nuevo.' : undefined}>
                          Corral
                        </FieldLabel>
                        <input
                          id={`${uid}-bloc`}
                          list={`${uid}-pens`}
                          value={batchLocation}
                          onChange={(e) => setBatchLocation(e.target.value)}
                          placeholder="Ej. Corral 3"
                          className={inputClass}
                        />
                        <datalist id={`${uid}-pens`}>
                          {knownLocations.map((l) => (
                            <option key={l} value={l} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <FieldLabel htmlFor={`${uid}-bstart`}>Fecha de inicio *</FieldLabel>
                        <input
                          id={`${uid}-bstart`}
                          type="date"
                          value={batchStart}
                          onChange={(e) => setBatchStart(e.target.value)}
                          aria-invalid={!!startErrors.start}
                          aria-describedby={sErr('start')}
                          className={fieldClass(!!startErrors.start)}
                        />
                        <FieldError id={sErr('start')} error={startErrors.start} />
                      </div>
                      <div className="sm:col-span-2 space-y-2">
                        <ErrorBox error={startError} />
                        <Btn type="submit" rubro="general" block disabled={isStarting}>
                          {isStarting ? 'Iniciando…' : 'Iniciar lote y programar tareas'}
                        </Btn>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Actividades del plan */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <Calendar className="w-5 h-5 text-rose-700" aria-hidden="true" />
                    Actividades del plan ({currentActivities.length})
                  </h3>
                  <Btn
                    variant="secondary"
                    icon={<Plus />}
                    aria-expanded={showAddActivityForm}
                    onClick={() => {
                      setShowAddActivityForm(!showAddActivityForm);
                      setActErrors({});
                    }}
                  >
                    {showAddActivityForm ? 'Cerrar' : 'Añadir actividad'}
                  </Btn>
                </div>

                {showAddActivityForm && (
                  <form
                    ref={actFormRef}
                    onSubmit={handleAddActivityTemplate}
                    noValidate
                    className="p-3 bg-slate-50 border-2 border-slate-300 rounded-2xl space-y-3"
                  >
                    <p className="text-sm font-bold text-slate-900">Nueva actividad para {currentConfig.typeName}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <FieldLabel htmlFor={`${uid}-aday`} hint="Días desde que empieza el ciclo">
                          Día *
                        </FieldLabel>
                        <input
                          id={`${uid}-aday`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max={currentConfig.cycleDurationDays}
                          placeholder="Ej. 21"
                          value={newActivityDay}
                          onChange={(e) => setNewActivityDay(e.target.value)}
                          aria-invalid={!!actErrors.day}
                          aria-describedby={aErr('day')}
                          className={fieldClass(!!actErrors.day, 'font-bold')}
                        />
                        <FieldError id={aErr('day')} error={actErrors.day} />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor={`${uid}-atitle`}>Nombre de la actividad *</FieldLabel>
                        <input
                          id={`${uid}-atitle`}
                          type="text"
                          placeholder="Ej: Desparasitación"
                          value={newActivityTitle}
                          onChange={(e) => setNewActivityTitle(e.target.value)}
                          aria-invalid={!!actErrors.title}
                          aria-describedby={aErr('title')}
                          className={fieldClass(!!actErrors.title)}
                        />
                        <FieldError id={aErr('title')} error={actErrors.title} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <FieldLabel htmlFor={`${uid}-amed`}>Medicamento</FieldLabel>
                        <input
                          id={`${uid}-amed`}
                          type="text"
                          placeholder="Ej: Ivermectina 1%"
                          value={newActivityMed}
                          onChange={(e) => setNewActivityMed(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor={`${uid}-adose`}>Dosis y cómo se aplica</FieldLabel>
                        <input
                          id={`${uid}-adose`}
                          type="text"
                          placeholder="Ej: 1 ml por cada 33 kg, bajo la piel"
                          value={newActivityDosage}
                          onChange={(e) => setNewActivityDosage(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div>
                      <FieldLabel htmlFor={`${uid}-aproc`}>Indicaciones</FieldLabel>
                      <input
                        id={`${uid}-aproc`}
                        type="text"
                        placeholder="Ej: Inyectar detrás de la oreja"
                        value={newActivityProc}
                        onChange={(e) => setNewActivityProc(e.target.value)}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <FieldLabel htmlFor={`${uid}-arole`}>Quién la hace</FieldLabel>
                      <select id={`${uid}-arole`} value={newActivityRole} onChange={(e) => setNewActivityRole(e.target.value)} className={inputClass}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
                      <Btn variant="secondary" onClick={() => setShowAddActivityForm(false)}>
                        Cancelar
                      </Btn>
                      <Btn type="submit" rubro="porcino" block icon={<Plus />}>
                        Añadir al plan
                      </Btn>
                    </div>
                  </form>
                )}

                {/* Lista de actividades */}
                <ul className="space-y-2">
                  {currentActivities.length === 0 && (
                    <li className="p-4 text-center text-slate-700 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                      Este plan aún no tiene actividades.
                    </li>
                  )}
                  {currentActivities.map((act) => (
                    <li key={act.id} className="p-3 bg-white rounded-2xl border border-slate-200 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="text-xs font-black text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg shrink-0 mt-0.5 whitespace-nowrap">
                          Día {act.dayOffset}
                        </span>
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm">{act.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
                            {act.medicament && (
                              <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                <Pill className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                                {act.medicament}
                              </span>
                            )}
                            {act.dosage && (
                              <span>
                                Dosis: <strong>{act.dosage}</strong>
                              </span>
                            )}
                            <span className="text-slate-600">Hace: {act.responsibleRole}</span>
                          </div>
                          {act.procedure && <p className="text-xs text-slate-600 italic">{act.procedure}</p>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setToDelete(act)}
                        aria-label={`Quitar ${act.title} del plan`}
                        className="min-w-11 min-h-11 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

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
            title="¿Quitar esta actividad?"
            message={
              <p>
                Se quitará <strong>{toDelete.title}</strong> (día {toDelete.dayOffset}) del plan. Las tareas ya programadas en el calendario no cambian.
              </p>
            }
            confirmLabel="Quitar"
            danger
            onConfirm={() => {
              handleRemoveActivity(toDelete.id);
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
