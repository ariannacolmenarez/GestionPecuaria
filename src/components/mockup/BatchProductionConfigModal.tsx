import React, { useState } from 'react';
import {
  X,
  Settings,
  Calendar,
  Layers,
  Plus,
  Clock,
  ShieldCheck,
  Pill,
  Info,
  Trash2,
  Heart,
  Baby,
  Activity,
} from 'lucide-react';
import {
  BatchProductionConfig,
  ProductionType,
  ProtocolActivityTemplate,
} from '../../types';

interface BatchProductionConfigModalProps {
  configs: BatchProductionConfig[];
  onClose: () => void;
  onUpdateConfigs: (updated: BatchProductionConfig[]) => void;
}

export const BatchProductionConfigModal: React.FC<BatchProductionConfigModalProps> = ({
  configs = [],
  onClose,
  onUpdateConfigs,
}) => {
  const [selectedConfigType, setSelectedConfigType] = useState<ProductionType>('engorde');

  // New activity template form inside config
  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [newActivityDay, setNewActivityDay] = useState(21);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityMed, setNewActivityMed] = useState('');
  const [newActivityDosage, setNewActivityDosage] = useState('');
  const [newActivityProc, setNewActivityProc] = useState('');
  const [newActivityRole, setNewActivityRole] = useState('Veterinario / Técnico Pecuario');

  // Selected config
  const currentConfig =
    configs.find((c) => c.productionType === selectedConfigType) || configs[0];

  // Helper to remove an activity template
  const handleRemoveActivity = (actId: string) => {
    const updated = configs.map((c) => {
      if (c.productionType === selectedConfigType) {
        return {
          ...c,
          activities: c.activities.filter((a) => a.id !== actId),
        };
      }
      return c;
    });
    onUpdateConfigs(updated);
  };

  // Helper to add an activity template
  const handleAddActivityTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivityTitle.trim()) return;

    const newAct: ProtocolActivityTemplate = {
      id: `act-tpl-${Date.now()}`,
      dayOffset: Number(newActivityDay),
      title: newActivityTitle.trim(),
      medicament: newActivityMed.trim() || 'Insumo preventivo estándar',
      dosage: newActivityDosage.trim() || 'Según prospecto veterinario',
      procedure: newActivityProc.trim() || 'Aplicación intramuscular profiláctica',
      responsibleRole: newActivityRole,
    };

    const updated = configs.map((c) => {
      if (c.productionType === selectedConfigType) {
        const sortedActs = [...c.activities, newAct].sort((a, b) => a.dayOffset - b.dayOffset);
        return {
          ...c,
          activities: sortedActs,
        };
      }
      return c;
    });

    onUpdateConfigs(updated);
    setNewActivityTitle('');
    setNewActivityMed('');
    setNewActivityDosage('');
    setNewActivityProc('');
    setShowAddActivityForm(false);
  };

  // Update cycle duration
  const handleUpdateDuration = (days: number) => {
    const updated = configs.map((c) => {
      if (c.productionType === selectedConfigType) {
        return {
          ...c,
          cycleDurationDays: Math.max(1, days),
        };
      }
      return c;
    });
    onUpdateConfigs(updated);
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
            onClick={onClose}
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
          </p>
        </div>

        {/* Production Type Selector Tabs */}
        <div className="bg-slate-100 p-2 flex items-center gap-1.5 border-b border-slate-200 shrink-0 overflow-x-auto">
          {configs.map((c) => {
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
          {currentConfig && (
            <div className="space-y-4">
              {/* Plan Summary Card */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{currentConfig.typeName}</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">{currentConfig.description}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-600">Duración del ciclo:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={currentConfig.cycleDurationDays}
                      onChange={(e) => handleUpdateDuration(parseInt(e.target.value, 10) || 1)}
                      className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-center text-slate-900"
                    />
                    <span className="text-[11px] text-slate-500 font-bold">días</span>
                  </div>
                </div>
              </div>

              {/* Protocol Activities List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Actividades del Protocolo ({currentConfig.activities.length})
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
                          min="1"
                          max={currentConfig.cycleDurationDays}
                          value={newActivityDay}
                          onChange={(e) => setNewActivityDay(parseInt(e.target.value, 10) || 1)}
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
                        Guardar Actividad
                      </button>
                    </div>
                  </form>
                )}

                {/* Activities list items */}
                <div className="space-y-2">
                  {currentConfig.activities.map((act) => (
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
                            <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                              <Pill className="w-3 h-3 text-slate-500" />
                              {act.medicament}
                            </span>
                            <span className="text-slate-500">•</span>
                            <span>Dosis: <strong>{act.dosage}</strong></span>
                            <span className="text-slate-500">•</span>
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
        <div className="bg-slate-50 p-3.5 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
            <Settings className="w-4 h-4 text-emerald-600" />
            <span>Los cambios se guardan y aplican automáticamente al registrar lotes</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Listo / Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
