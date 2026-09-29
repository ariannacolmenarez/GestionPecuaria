import React, { useState } from 'react';
import {
  X,
  Calendar,
  Layers,
  Tag,
  Stethoscope,
  Pill,
  User,
  Plus,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { SanitaryTask, PorcinoAnimal, WarehouseItem } from '../../types';

interface AddSanitaryActivityModalProps {
  animals?: PorcinoAnimal[];
  warehouseItems?: WarehouseItem[];
  defaultDate?: string;
  initialDate?: string;
  onClose: () => void;
  onAddTask: (newTask: SanitaryTask) => void;
}

export const AddSanitaryActivityModal: React.FC<AddSanitaryActivityModalProps> = ({
  animals = [],
  warehouseItems = [],
  defaultDate,
  initialDate,
  onClose,
  onAddTask,
}) => {
  const effectiveDate = initialDate || defaultDate || '2026-08-19';

  // Form state
  const [title, setTitle] = useState('');
  const [activityCategory, setActivityCategory] = useState('Vacunación');
  const [targetGroup, setTargetGroup] = useState('Lote Engorde Galpón 1');
  const [targetType, setTargetType] = useState<'lote' | 'animal'>('lote');
  const [selectedAnimalCode, setSelectedAnimalCode] = useState(
    animals.length > 0 ? animals[0].code : 'CER-088'
  );
  const [customAnimalCode, setCustomAnimalCode] = useState('');
  const [date, setDate] = useState(effectiveDate);
  const [medicamentUsed, setMedicamentUsed] = useState('Vacuna Parvovirus + Leptospira');
  const [dosage, setDosage] = useState('2.0 ml intramuscular profunda');
  const [responsible, setResponsible] = useState('Dr. Carlos Mendoza (Veterinario)');
  const [procedure, setProcedure] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Pre-configured activity presets
  const activityPresets = [
    { label: 'Vacunación', icon: '💉', defaultTitle: 'Vacunación preventiva del lote' },
    { label: 'Desparasitación', icon: '💊', defaultTitle: 'Desparasitación con Ivermectina 1%' },
    { label: 'Aplicación de Hierro', icon: '⚡', defaultTitle: 'Hierro Dextrano a camada neonatal' },
    { label: 'Vitaminización ADE', icon: '🧪', defaultTitle: 'Vitaminización de soporte metabólico' },
    { label: 'Tratamiento Antibiótico', icon: '🏥', defaultTitle: 'Terapia con Oxitetraciclina L.A.' },
    { label: 'Pesaje y Control Biométrico', icon: '⚖️', defaultTitle: 'Pesaje de control y ajuste de ración' },
  ];

  const handleSelectPreset = (preset: typeof activityPresets[0]) => {
    setActivityCategory(preset.label);
    if (!title || title.trim().length === 0) {
      setTitle(preset.defaultTitle);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Por favor especifica el nombre de la actividad.');
      return;
    }
    if (!procedure.trim()) {
      setErrorMsg('Por favor describe el procedimiento o protocolo a realizar.');
      return;
    }

    const animalDesignation =
      targetType === 'lote'
        ? 'Todo el Lote'
        : selectedAnimalCode === 'otro'
        ? customAnimalCode.trim() || 'Animal Específico'
        : selectedAnimalCode;

    const newTask: SanitaryTask = {
      id: 'st-' + Date.now(),
      title: title.trim(),
      date,
      targetRubro: 'porcino',
      targetGroup: targetGroup.trim(),
      targetAnimal: animalDesignation,
      procedure: procedure.trim(),
      medicamentUsed: medicamentUsed.trim() || undefined,
      dosage: dosage.trim() || undefined,
      responsible,
      status: 'pendiente',
    };

    onAddTask(newTask);
  };

  return (
    <div
      id="add-sanitary-activity-modal-overlay"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        id="add-sanitary-activity-card"
        className="bg-white text-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto"
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                Programar Actividad en Calendario
              </h3>
              <p className="text-[11px] text-slate-400">
                Plan Sanitario • Registro Oficial de Granja
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-medium text-xs">
              {errorMsg}
            </div>
          )}

          {/* Preset Chips */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
              Tipo de Actividad a Realizar
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {activityPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset)}
                  className={`p-2 rounded-xl border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                    activityCategory === preset.label
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-sm">{preset.icon}</span>
                  <span className="text-[10px] leading-tight truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Nombre / Título de la Actividad *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Vacuna Neumonía y Refuerzo PCV2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Lote and Animal Specification */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Destinatario: Lote y Animal Específico
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Target Lot */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  ¿A qué Lote se aplica? *
                </label>
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-emerald-500 outline-none"
                >
                  <option value="Lote Engorde Galpón 1">Lote Engorde Galpón 1</option>
                  <option value="Lote Engorde Galpón 2">Lote Engorde Galpón 2</option>
                  <option value="Lote Maternidad - Sala 1">Lote Maternidad - Sala 1</option>
                  <option value="Lote Maternidad - Sala 2">Lote Maternidad - Sala 2</option>
                  <option value="Lote Cerdas Gestación B">Lote Cerdas Gestación B</option>
                  <option value="Lote Lechones Destetados">Lote Lechones Destetados</option>
                  <option value="Lote Verracos Reproductores">Lote Verracos Reproductores</option>
                  <option value="Lote General de la Granja">Lote General de la Granja</option>
                </select>
              </div>

              {/* Target Animal Type (All batch vs individual animal) */}
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  ¿A qué Animal? *
                </label>
                <div className="flex bg-slate-200 p-0.5 rounded-xl text-xs font-semibold mb-1.5">
                  <button
                    type="button"
                    onClick={() => setTargetType('lote')}
                    className={`flex-1 py-1 rounded-lg transition-all ${
                      targetType === 'lote'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Todo el Lote
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('animal')}
                    className={`flex-1 py-1 rounded-lg transition-all ${
                      targetType === 'animal'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Animal Individual
                  </button>
                </div>

                {targetType === 'animal' && (
                  <div className="space-y-1 mt-1">
                    <select
                      value={selectedAnimalCode}
                      onChange={(e) => setSelectedAnimalCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                    >
                      {animals.map((a) => (
                        <option key={a.id} value={a.code}>
                          {a.code} ({a.category} - {a.healthStatus} - {a.currentWeightKg}kg)
                        </option>
                      ))}
                      <option value="otro">Otro Arete / Código Libre...</option>
                    </select>

                    {selectedAnimalCode === 'otro' && (
                      <input
                        type="text"
                        placeholder="Escribe código de arete (ej: CER-112)"
                        value={customAnimalCode}
                        onChange={(e) => setCustomAnimalCode(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Fecha Específica en el Calendario *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setDate('2026-08-19')}
                className={`px-2.5 py-2 rounded-xl font-bold text-[11px] border transition-all ${
                  date === '2026-08-19'
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Hoy (19 Ago)
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              La actividad se reflejará con un marcador destacado en el día correspondiente del
              calendario mensual.
            </p>
          </div>

          {/* Medicament and Dosage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Medicamento / Insumo
              </label>
              <input
                type="text"
                placeholder="Ej: Hierro Dextrano 200mg"
                value={medicamentUsed}
                onChange={(e) => setMedicamentUsed(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Dosis y Vía de Aplicación
              </label>
              <input
                type="text"
                placeholder="Ej: 2.0 ml vía intramuscular"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Responsible & Procedure */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Responsable Asignado
            </label>
            <select
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none"
            >
              <option value="Dr. Carlos Mendoza (Veterinario)">Dr. Carlos Mendoza (Veterinario)</option>
              <option value="José Gregorio Silva (Operador)">José Gregorio Silva (Operador)</option>
              <option value="María Valentina Soto (Trabajador)">María Valentina Soto (Trabajador)</option>
              <option value="Arianna Pérez (Administrador)">Arianna Pérez (Administrador)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Procedimiento Veterinario Detallado *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Describa el protocolo paso a paso: aguja a utilizar, medidas de asepsia, precauciones y observaciones post-tratamiento..."
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar y Mostrar en Calendario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
