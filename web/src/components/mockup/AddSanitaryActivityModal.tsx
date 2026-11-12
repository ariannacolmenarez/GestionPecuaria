import React, { useMemo, useState } from 'react';
import { X, Calendar, Layers, Plus, CheckCircle2, Package } from 'lucide-react';
import { SanitaryTask, PorcinoAnimal, WarehouseItem, PorcinoCategory } from '../../types';
import { isActiveAnimal, headCount } from '../../models/porcinoRules';
import { todayISO, formatShortDate } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

interface AddSanitaryActivityModalProps {
  animals?: PorcinoAnimal[];
  warehouseItems?: WarehouseItem[];
  defaultDate?: string;
  initialDate?: string;
  onClose: () => void;
  /**
   * newTask puede incluir animalId, warehouseItemId y warehouseQuantity (insumo a descontar al completar).
   * Conectar a porcinoActions.addSanitaryTask({task}). Puede devolver un DomainResult.
   */
  onAddTask: (newTask: SanitaryTask) => ModalActionReturn;
}

const CATEGORY_GROUPS: { value: string; label: string; category?: PorcinoCategory }[] = [
  { value: 'cat:maternidad', label: 'Cerdas de maternidad (todas)', category: 'maternidad' },
  { value: 'cat:engorde', label: 'Engorde (todos los lotes)', category: 'engorde' },
  { value: 'cat:lechones', label: 'Lechones (todos)', category: 'lechones' },
  { value: 'cat:verracos', label: 'Verracos reproductores', category: 'verracos' },
  { value: 'general', label: 'General de la granja' },
];

const RESPONSIBLE_ROLES = ['Veterinario', 'Encargado de granja', 'Operador', 'Trabajador'];

// Pre-configured activity presets
const ACTIVITY_PRESETS = [
  { label: 'Vacunación', icon: '💉', defaultTitle: 'Vacunación preventiva' },
  { label: 'Desparasitación', icon: '💊', defaultTitle: 'Desparasitación' },
  { label: 'Aplicación de Hierro', icon: '⚡', defaultTitle: 'Hierro dextrano a camada' },
  { label: 'Vitaminización ADE', icon: '🧪', defaultTitle: 'Vitaminización de soporte' },
  { label: 'Tratamiento Antibiótico', icon: '🏥', defaultTitle: 'Tratamiento antibiótico' },
  { label: 'Pesaje y Control Biométrico', icon: '⚖️', defaultTitle: 'Pesaje de control y ajuste de ración' },
];

export const AddSanitaryActivityModal: React.FC<AddSanitaryActivityModalProps> = ({
  animals = [],
  warehouseItems = [],
  defaultDate,
  initialDate,
  onClose,
  onAddTask,
}) => {
  const today = todayISO();
  const effectiveDate = initialDate || defaultDate || today;

  const activeAnimals = useMemo(() => (animals || []).filter(isActiveAnimal), [animals]);
  // Lotes reales (registros con más de una cabeza)
  const batches = useMemo(() => activeAnimals.filter((a) => headCount(a) > 1), [activeAnimals]);
  const individuals = useMemo(() => activeAnimals.filter((a) => headCount(a) === 1), [activeAnimals]);
  const medicineItems = useMemo(
    () => (warehouseItems || []).filter((i) => i.category !== 'alimentos'),
    [warehouseItems]
  );

  // Form state
  const [title, setTitle] = useState('');
  const [activityCategory, setActivityCategory] = useState('Vacunación');
  const [targetGroup, setTargetGroup] = useState<string>(CATEGORY_GROUPS[0].value);
  const [targetType, setTargetType] = useState<'lote' | 'animal'>('lote');
  const [selectedAnimalId, setSelectedAnimalId] = useState(individuals[0]?.id || 'otro');
  const [customAnimalCode, setCustomAnimalCode] = useState('');
  const [date, setDate] = useState(effectiveDate);
  const [medicamentUsed, setMedicamentUsed] = useState('');
  const [dosage, setDosage] = useState('');
  const [warehouseItemId, setWarehouseItemId] = useState('');
  const [warehouseQuantity, setWarehouseQuantity] = useState('');
  const [responsible, setResponsible] = useState('');
  const [procedure, setProcedure] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const selectedItem = medicineItems.find((i) => i.id === warehouseItemId);

  const handleSelectPreset = (preset: (typeof ACTIVITY_PRESETS)[0]) => {
    setActivityCategory(preset.label);
    if (!title.trim()) setTitle(preset.defaultTitle);
  };

  const handleSelectItem = (id: string) => {
    setWarehouseItemId(id);
    const item = medicineItems.find((i) => i.id === id);
    if (item && !medicamentUsed.trim()) setMedicamentUsed(item.name);
  };

  /** Resuelve el grupo/lote destino a etiqueta legible + animalId si es un lote concreto. */
  const resolveGroup = (): { label: string; animal?: PorcinoAnimal } => {
    const cat = CATEGORY_GROUPS.find((g) => g.value === targetGroup);
    if (cat) return { label: cat.label };
    const batch = batches.find((b) => b.id === targetGroup);
    if (batch) return { label: `Lote ${batch.code}${batch.penLocation ? ` - ${batch.penLocation}` : ''}`, animal: batch };
    return { label: 'General de la granja' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!title.trim()) {
      setErrorMsg('Por favor especifica el nombre de la actividad.');
      return;
    }
    if (!procedure.trim()) {
      setErrorMsg('Por favor describe el procedimiento o protocolo a realizar.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setErrorMsg('Selecciona una fecha válida.');
      return;
    }
    const qty = toNumber(warehouseQuantity);
    if (selectedItem && qty <= 0) {
      setErrorMsg('Indica la cantidad del insumo a descontar al completar la actividad.');
      return;
    }

    const group = resolveGroup();
    let targetAnimal: string;
    let animalId: string | undefined;
    let batchCode: string | undefined;
    if (targetType === 'lote') {
      targetAnimal = group.animal ? `Lote completo (${headCount(group.animal)} animales)` : 'Todo el grupo';
      animalId = group.animal?.id;
      batchCode = group.animal?.code;
    } else if (selectedAnimalId === 'otro') {
      const code = customAnimalCode.trim();
      if (!code) {
        setErrorMsg('Escribe el código del animal.');
        return;
      }
      targetAnimal = code;
      animalId = activeAnimals.find((a) => a.code === code)?.id;
    } else {
      const a = individuals.find((x) => x.id === selectedAnimalId);
      if (!a) {
        setErrorMsg('Selecciona un animal.');
        return;
      }
      targetAnimal = a.code;
      animalId = a.id;
    }

    const newTask: SanitaryTask = {
      id: newId('st'),
      title: title.trim(),
      date,
      targetRubro: 'porcino',
      targetGroup: group.label,
      targetAnimal,
      batchCode,
      procedure: procedure.trim(),
      medicamentUsed: medicamentUsed.trim() || selectedItem?.name || undefined,
      dosage: dosage.trim() || undefined,
      responsible: responsible.trim() || 'Encargado de granja',
      status: 'pendiente',
      animalId,
      warehouseItemId: selectedItem?.id,
      warehouseQuantity: selectedItem ? qty : undefined,
      sourceEvent: 'manual',
    };

    setIsSaving(true);
    const res = await runModalAction(() => onAddTask(newTask));
    setIsSaving(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'No se pudo programar la actividad.');
      return;
    }
    setIsDone(true);
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
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">Programar Actividad en Calendario</h3>
              <p className="text-[11px] text-slate-400">Plan Sanitario • Registro de Granja</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isDone ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-800 text-base">¡Actividad Programada!</h4>
            <p className="text-xs text-slate-600">
              "{title.trim()}" quedó en el calendario para el {date}.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
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
                {ACTIVITY_PRESETS.map((preset) => (
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
                Destinatario: Grupo, Lote o Animal
              </span>

              <div className="flex bg-slate-200 p-0.5 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTargetType('lote')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    targetType === 'lote' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Grupo / Lote
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType('animal')}
                  className={`flex-1 py-1 rounded-lg transition-all ${
                    targetType === 'animal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Animal Individual
                </button>
              </div>

              {targetType === 'lote' ? (
                <select
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-emerald-500 outline-none"
                >
                  <optgroup label="Grupos">
                    {CATEGORY_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                  {batches.length > 0 && (
                    <optgroup label="Lotes registrados">
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} ({b.category} · {headCount(b)} cab.){b.penLocation ? ` - ${b.penLocation}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              ) : (
                <div className="space-y-1">
                  <select
                    value={selectedAnimalId}
                    onChange={(e) => setSelectedAnimalId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  >
                    {individuals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} ({a.category} - {a.healthStatus} - {a.currentWeightKg}kg)
                      </option>
                    ))}
                    <option value="otro">Otro arete / código libre...</option>
                  </select>
                  {individuals.length === 0 && (
                    <p className="text-[10px] text-slate-500">No hay animales individuales activos registrados.</p>
                  )}
                  {selectedAnimalId === 'otro' && (
                    <input
                      type="text"
                      placeholder="Escribe el código de arete"
                      value={customAnimalCode}
                      onChange={(e) => setCustomAnimalCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold"
                    />
                  )}
                </div>
              )}
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
                  onClick={() => setDate(today)}
                  className={`px-2.5 py-2 rounded-xl font-bold text-[11px] border transition-all ${
                    date === today
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoy ({formatShortDate(today)})
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                La actividad se reflejará con un marcador en el día correspondiente del calendario mensual.
              </p>
            </div>

            {/* Insumo del almacén */}
            {medicineItems.length > 0 && (
              <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 space-y-2">
                <label className="text-[10px] font-bold uppercase text-blue-800 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Insumo del almacén (se descuenta al completar)
                </label>
                <select
                  value={warehouseItemId}
                  onChange={(e) => handleSelectItem(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800"
                >
                  <option value="">Ninguno</option>
                  {medicineItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — stock {i.quantity} {i.unit}
                    </option>
                  ))}
                </select>
                {selectedItem && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Cantidad"
                      value={warehouseQuantity}
                      onChange={(e) => setWarehouseQuantity(e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-900"
                    />
                    <span className="text-[11px] text-slate-600">{selectedItem.unit} a descontar</span>
                  </div>
                )}
              </div>
            )}

            {/* Medicament and Dosage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Medicamento / Insumo</label>
                <input
                  type="text"
                  placeholder="Ej: Hierro Dextrano 200mg"
                  value={medicamentUsed}
                  onChange={(e) => setMedicamentUsed(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Dosis y Vía de Aplicación</label>
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
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Responsable Asignado</label>
              <input
                type="text"
                list="sanitary-responsible-roles"
                placeholder="Ej: Veterinario"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 outline-none"
              />
              <datalist id="sanitary-responsible-roles">
                {RESPONSIBLE_ROLES.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
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
                disabled={isSaving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isSaving ? 'Guardando...' : 'Guardar y Mostrar en Calendario'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
