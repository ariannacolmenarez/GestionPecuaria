import React, { useMemo, useState } from 'react';
import { X, Calendar, Layers, Plus, Clock, ShieldCheck, Pill, Info, Trash2, Heart, Baby, Activity, Save } from 'lucide-react';
import { BatchProductionConfig, ProductionBatch, ProductionType, ProtocolActivityTemplate } from '../../types';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import { todayISO } from '../../utils/dates';

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

export const BatchProductionConfigModal: React.FC<BatchProductionConfigModalProps> = ({
  configs = [],
  onClose,
  onUpdateConfigs,
  existingBatches = [],
  onStartBatch,
}) => {
  // Formulario "Iniciar lote" (usa el protocolo YA guardado de este tipo de producción)
  const [showStartForm, setShowStartForm] = useState(false);
  const [batchCode, setBatchCode] = useState('');
  const [batchCount, setBatchCount] = useState('');
  const [batchLocation, setBatchLocation] = useState('');
  const [batchStart, setBatchStart] = useState(todayISO());
  const [startError, setStartError] = useState<string | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
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

  // New activity template form inside config
  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [newActivityDay, setNewActivityDay] = useState('');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityMed, setNewActivityMed] = useState('');
  const [newActivityDosage, setNewActivityDosage] = useState('');
  const [newActivityProc, setNewActivityProc] = useState('');
  const [newActivityRole, setNewActivityRole] = useState(ROLES[0]);

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
    if (!title) {
      setFormError('Indica el nombre de la actividad.');
      return;
    }
    const day = Math.round(toNumber(newActivityDay, NaN));
    if (!Number.isFinite(day) || day < 0 || day > Math.max(1, toNumber(currentConfig.cycleDurationDays, 365))) {
      setFormError(`El día debe estar entre 0 y ${currentConfig.cycleDurationDays} (duración del ciclo).`);
      return;
    }

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
      setFormError(`El plan "${outOfRange.typeName}" tiene actividades después del fin del ciclo (${outOfRange.cycleDurationDays} días).`);
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateConfigs(localConfigs.map((c) => ({ ...c, activities: sortActivities(c.activities || []) })));
      setIsDirty(false);
      setSavedNotice(true);
    } catch (err: any) {
      setFormError(err?.message || 'No se pudo guardar la configuración.');
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
      setStartError('Guarda primero los cambios del protocolo: el lote se programa con el protocolo guardado.');
      return;
    }
    const code = batchCode.trim();
    const count = Math.round(toNumber(batchCount, NaN));
    if (!code) return setStartError('Indica el código del lote.');
    if (!Number.isFinite(count) || count <= 0) return setStartError('La cantidad de animales debe ser un entero mayor a 0.');
    if (!batchStart) return setStartError('Indica la fecha de inicio.');
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
    setStartNotice(res.message || `Lote ${code} iniciado.`);
    setBatchCode('');
    setBatchCount('');
    setBatchLocation('');
    setShowStartForm(false);
  };

  const handleClose = () => {
    if (isDirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartarlos?')) return;
    onClose();
  };

  const getProductionBadge = (type: ProductionType) => {
    switch (type) {
      case 'engorde':
        return { label: 'Engorde Comercial', icon: Layers, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'maternidad':
        return { label: 'Maternidad y Cerdas', icon: Heart, color: 'text-rose-700 bg-rose-50 border-rose-200' };
      case 'lechones':
        return { label: 'Lechones Lactantes', icon: Baby, color: 'text-amber-700 bg-amber-50 border-amber-200' };
      default:
        return { label: 'Verracos Sementales', icon: Activity, color: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
  };

  return (
    <div
      id="batch-production-config-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="batch-production-config-card"
        className="bg-white text-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Configuración de Planes Sanitarios por Producción
              </h3>
              <p className="text-[11px] text-slate-400">
                Protocolos automáticos aplicables al registrar nuevos animales o lotes
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

        {/* Informative banner requirement 1 */}
        <div className="p-3 bg-emerald-50 border-b border-emerald-200 flex items-start gap-2.5 text-emerald-950 shrink-0">
          <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>Automatización Activa:</strong> Los planes sanitarios configurados aquí se programarán
            <strong> automáticamente en el calendario</strong> cada vez que ingreses nuevos cerdos a
            Engorde, agregues nuevas reproductoras a Maternidad o efectúes el destete de lechones en la granja.
            Los cambios aplican a los lotes registrados después de pulsar <strong>Guardar cambios</strong>.
          </p>
        </div>

        {/* Production Type Selector Tabs */}
        <div className="bg-slate-100 p-2 flex items-center gap-1.5 border-b border-slate-200 shrink-0 overflow-x-auto">
          {localConfigs.map((c) => {
            const badge = getProductionBadge(c.productionType);
            const IconComponent = badge.icon;
            const isSelected = selectedConfigType === c.productionType;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedConfigType(c.productionType);
                  setShowAddActivityForm(false);
                }}
                className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {!currentConfig && (
            <div className="p-8 text-center text-slate-500">No hay planes sanitarios configurados.</div>
          )}
          {formError && (
            <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
              {formError}
            </div>
          )}
          {currentConfig && (
            <div className="space-y-4">
              {/* Plan Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{currentConfig.typeName}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">{currentConfig.description}</p>
                    {existingBatches.length > 0 && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {activeBatchesForCurrent} lote(s) activo(s) con este tipo de producción.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Duración del ciclo:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={currentConfig.cycleDurationDays}
                      onChange={(e) => handleUpdateDuration(e.target.value)}
                      className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-center text-slate-900"
                    />
                    <span className="text-[11px] text-slate-500 font-bold">días</span>
                  </div>
                </div>
              </div>

              {/* Iniciar lote con este protocolo */}
              {onStartBatch && (
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600" /> Iniciar lote con este protocolo
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowStartForm((v) => !v);
                        setStartError(null);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      {showStartForm ? 'Cancelar' : 'Nuevo lote'}
                    </button>
                  </div>
                  {startNotice && (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800">
                      {startNotice}
                    </div>
                  )}
                  {showStartForm && (
                    <form onSubmit={handleStartBatch} className="grid grid-cols-2 gap-2">
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-600">Código del lote</span>
                        <input
                          value={batchCode}
                          onChange={(e) => setBatchCode(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                          placeholder="Ej. ENG-01"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-600">N.º de animales</span>
                        <input
                          type="number"
                          min="1"
                          value={batchCount}
                          onChange={(e) => setBatchCount(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-600">Ubicación / corral</span>
                        <input
                          value={batchLocation}
                          onChange={(e) => setBatchLocation(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[10px] font-semibold text-slate-600">Fecha de inicio</span>
                        <input
                          type="date"
                          value={batchStart}
                          onChange={(e) => setBatchStart(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                        />
                      </label>
                      {startError && (
                        <div className="col-span-2 p-2 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                          {startError}
                        </div>
                      )}
                      <button
                        type="submit"
                        disabled={isStarting}
                        className="col-span-2 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer disabled:opacity-60"
                      >
                        {isStarting ? 'Iniciando...' : 'Iniciar lote y programar tareas'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Protocol Activities List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Actividades del Protocolo ({currentActivities.length})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddActivityForm(!showAddActivityForm)}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddActivityForm ? 'Cerrar formulario' : 'Añadir Actividad al Plan'}</span>
                  </button>
                </div>

                {/* Form to add activity */}
                {showAddActivityForm && (
                  <form
                    onSubmit={handleAddActivityTemplate}
                    className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2.5 animate-in fade-in duration-150"
                  >
                    <span className="text-[11px] font-bold text-blue-950 block">
                      Nueva Actividad Preventiva para {currentConfig.typeName}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Día del Ciclo (Día X) *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          max={currentConfig.cycleDurationDays}
                          placeholder="Ej. 21"
                          value={newActivityDay}
                          onChange={(e) => setNewActivityDay(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Nombre / Título de la Actividad *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Desparasitación interna y externa"
                          value={newActivityTitle}
                          onChange={(e) => setNewActivityTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Medicamento / Insumo
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Ivermectina 1% / Complejo B"
                          value={newActivityMed}
                          onChange={(e) => setNewActivityMed(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">
                          Dosis y Vía de Aplicación
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 1 ml / 33 kg subcutánea"
                          value={newActivityDosage}
                          onChange={(e) => setNewActivityDosage(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Procedimiento / Indicaciones
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Inyección subcutánea detrás de la oreja con aguja calibre 18"
                        value={newActivityProc}
                        onChange={(e) => setNewActivityProc(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Responsable (rol)</label>
                      <select
                        value={newActivityRole}
                        onChange={(e) => setNewActivityRole(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddActivityForm(false)}
                        className="px-3 py-1.5 text-slate-600 hover:text-slate-800 font-semibold"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Añadir Actividad
                      </button>
                    </div>
                  </form>
                )}

                {/* Activities list items */}
                <div className="space-y-2">
                  {currentActivities.length === 0 && (
                    <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      Este plan aún no tiene actividades.
                    </div>
                  )}
                  {currentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-2.5 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="font-mono text-[10px] font-black text-blue-700 bg-blue-100 px-2 py-1 rounded-lg shrink-0 mt-0.5">
                          Día {act.dayOffset}
                        </span>
                        <div className="space-y-1">
                          <h5 className="font-bold text-slate-900 text-xs">{act.title}</h5>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                            {act.medicament && (
                              <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                <Pill className="w-3 h-3 text-slate-500" />
                                {act.medicament}
                              </span>
                            )}
                            {act.dosage && (
                              <span>
                                Dosis: <strong>{act.dosage}</strong>
                              </span>
                            )}
                            <span className="text-slate-500">Resp: {act.responsibleRole}</span>
                          </div>
                          {act.procedure && (
                            <p className="text-[10px] text-slate-500 italic mt-0.5">
                              {act.procedure}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveActivity(act.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Eliminar actividad"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

{/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <ShieldCheck className={`w-4 h-4 ${isDirty ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>{isDirty ? 'Cambios sin guardar' : savedNotice ? 'Configuración guardada' : 'Sin cambios pendientes'}</span>
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
