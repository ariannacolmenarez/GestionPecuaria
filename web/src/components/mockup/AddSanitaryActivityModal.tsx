import React, { useId, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Layers,
  Plus,
  CheckCircle2,
  Package,
  Syringe,
  Pill,
  Zap,
  FlaskConical,
  Stethoscope,
  Scale,
} from 'lucide-react';
import { SanitaryTask, PorcinoAnimal, WarehouseItem, PorcinoCategory } from '../../types';
import { isActiveAnimal, headCount } from '../../models/porcinoRules';
import { todayISO, formatShortDate } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import {
  Btn,
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

// Tipos de actividad frecuentes (icono lucide, no emoji)
const ACTIVITY_PRESETS = [
  { label: 'Vacunación', Icon: Syringe, defaultTitle: 'Vacunación preventiva' },
  { label: 'Desparasitación', Icon: Pill, defaultTitle: 'Desparasitación' },
  { label: 'Hierro', Icon: Zap, defaultTitle: 'Hierro dextrano a camada' },
  { label: 'Vitaminas', Icon: FlaskConical, defaultTitle: 'Vitaminización de soporte' },
  { label: 'Antibiótico', Icon: Stethoscope, defaultTitle: 'Tratamiento antibiótico' },
  { label: 'Pesaje', Icon: Scale, defaultTitle: 'Pesaje de control y ajuste de ración' },
];

type FieldErrors = Partial<Record<'title' | 'procedure' | 'date' | 'qty' | 'animal', string>>;

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
  const uid = useId();
  const titleId = `${uid}-title`;
  const formRef = useRef<HTMLFormElement>(null);

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
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [submitCount, setSubmitCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const dirty =
    !isDone &&
    !!(title.trim() || procedure.trim() || medicamentUsed.trim() || dosage.trim() || responsible.trim() || customAnimalCode.trim() || warehouseQuantity);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);
  const firstError = (Object.values(errors).find(Boolean) as string | undefined) || null;
  useFocusFirstInvalid(formRef, firstError, submitCount);

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

  const resetForm = () => {
    setTitle('');
    setActivityCategory('Vacunación');
    setCustomAnimalCode('');
    setMedicamentUsed('');
    setDosage('');
    setWarehouseItemId('');
    setWarehouseQuantity('');
    setProcedure('');
    setErrors({});
    setErrorMsg('');
    setIsDone(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const next: FieldErrors = {};
    if (!title.trim()) next.title = 'Escribe el nombre de la actividad.';
    if (!procedure.trim()) next.procedure = 'Describe qué hay que hacer.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) next.date = 'Elige una fecha válida.';
    const qty = toNumber(warehouseQuantity);
    if (selectedItem && qty <= 0) next.qty = 'Indica cuánto insumo se descontará al completar.';
    if (targetType === 'animal') {
      if (selectedAnimalId === 'otro' && !customAnimalCode.trim()) next.animal = 'Escribe el arete del animal.';
      else if (selectedAnimalId !== 'otro' && !individuals.find((x) => x.id === selectedAnimalId)) next.animal = 'Elige un animal.';
    }
    setErrors(next);
    setSubmitCount((c) => c + 1);
    if (Object.keys(next).length > 0) return;

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
      targetAnimal = code;
      animalId = activeAnimals.find((a) => a.code === code)?.id;
    } else {
      const a = individuals.find((x) => x.id === selectedAnimalId)!;
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

  const errId = (k: keyof FieldErrors) => (errors[k] ? `${uid}-${k}-err` : undefined);

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="add-sanitary-activity-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white text-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[94%] sm:max-h-[92vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Calendar />}
          title="Programar actividad"
          subtitle="Plan sanitario · aparece en el calendario"
          titleId={titleId}
          onClose={requestClose}
        />

        {isDone ? (
          <div className="p-6 text-center space-y-3 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Actividad programada</h3>
            <p className="text-sm text-slate-700">
              "{title.trim()}" quedó en el calendario para el {formatShortDate(date)}.
            </p>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <Btn rubro="porcino" size="lg" block icon={<Plus />} onClick={resetForm}>
                Programar otra
              </Btn>
              <Btn variant="secondary" size="lg" block onClick={onClose}>
                Volver al calendario
              </Btn>
            </div>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-sm">
              {/* Tipo de actividad */}
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900 mb-1.5">¿Qué se va a hacer?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIVITY_PRESETS.map((preset) => {
                    const active = activityCategory === preset.label;
                    return (
                      <button
                        type="button"
                        key={preset.label}
                        aria-pressed={active}
                        onClick={() => handleSelectPreset(preset)}
                        className={`min-h-14 p-2 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                          active
                            ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold'
                            : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <preset.Icon className="w-5 h-5" aria-hidden="true" />
                        <span className="text-xs leading-tight text-center">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Título */}
              <div>
                <FieldLabel htmlFor={`${uid}-title-in`}>Nombre de la actividad *</FieldLabel>
                <input
                  id={`${uid}-title-in`}
                  type="text"
                  placeholder="Ej: Vacuna neumonía y refuerzo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={!!errors.title}
                  aria-describedby={errId('title')}
                  className={fieldClass(!!errors.title, 'font-semibold')}
                />
                <FieldError id={errId('title')} error={errors.title} />
              </div>

              {/* Destinatario */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-rose-700" aria-hidden="true" />
                  ¿A quién?
                </span>

                <div role="radiogroup" aria-label="Destinatario" className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['lote', 'Grupo o lote'],
                      ['animal', 'Un animal'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      role="radio"
                      aria-checked={targetType === val}
                      onClick={() => setTargetType(val)}
                      className={`min-h-11 rounded-xl border-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ${
                        targetType === val ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-300 text-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {targetType === 'lote' ? (
                  <select
                    aria-label="Grupo o lote"
                    value={targetGroup}
                    onChange={(e) => setTargetGroup(e.target.value)}
                    className={inputClass}
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
                            {b.code} ({b.category} · {headCount(b)} animales){b.penLocation ? ` - ${b.penLocation}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <select
                      aria-label="Animal"
                      value={selectedAnimalId}
                      onChange={(e) => setSelectedAnimalId(e.target.value)}
                      aria-invalid={!!errors.animal && selectedAnimalId !== 'otro'}
                      className={fieldClass(!!errors.animal && selectedAnimalId !== 'otro', 'font-mono font-bold')}
                    >
                      {individuals.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} ({a.category} - {a.healthStatus} - {a.currentWeightKg} kg)
                        </option>
                      ))}
                      <option value="otro">Otro arete (escribirlo)…</option>
                    </select>
                    {individuals.length === 0 && (
                      <p className="text-xs text-slate-600">No hay animales individuales activos registrados.</p>
                    )}
                    {selectedAnimalId === 'otro' && (
                      <input
                        type="text"
                        aria-label="Arete del animal"
                        placeholder="Escribe el arete"
                        value={customAnimalCode}
                        onChange={(e) => setCustomAnimalCode(e.target.value)}
                        aria-invalid={!!errors.animal}
                        aria-describedby={errId('animal')}
                        className={fieldClass(!!errors.animal, 'font-mono font-bold')}
                      />
                    )}
                    <FieldError id={errId('animal')} error={errors.animal} />
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div>
                <FieldLabel htmlFor={`${uid}-date`} hint="Se marcará ese día en el calendario.">
                  Fecha *
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <input
                    id={`${uid}-date`}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={!!errors.date}
                    aria-describedby={errId('date')}
                    className={fieldClass(!!errors.date, 'flex-1 font-bold')}
                  />
                  <button
                    type="button"
                    onClick={() => setDate(today)}
                    aria-pressed={date === today}
                    className={`min-h-11 px-3 rounded-xl font-bold text-sm border-2 shrink-0 ${
                      date === today ? 'bg-amber-100 border-amber-400 text-amber-900' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Hoy
                  </button>
                </div>
                <FieldError id={errId('date')} error={errors.date} />
              </div>

              {/* Insumo del almacén */}
              {medicineItems.length > 0 && (
                <div className="bg-sky-50 p-3 rounded-2xl border border-sky-200 space-y-2">
                  <FieldLabel htmlFor={`${uid}-item`} hint="Se descuenta del almacén al completar la actividad.">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-sky-800" aria-hidden="true" /> Insumo del almacén
                    </span>
                  </FieldLabel>
                  <select id={`${uid}-item`} value={warehouseItemId} onChange={(e) => handleSelectItem(e.target.value)} className={inputClass}>
                    <option value="">Ninguno</option>
                    {medicineItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} — hay {i.quantity} {i.unit}
                      </option>
                    ))}
                  </select>
                  {selectedItem && (
                    <div>
                      <label htmlFor={`${uid}-qty`} className="block text-sm font-semibold text-slate-900 mb-1">
                        Cantidad a descontar ({selectedItem.unit}) *
                      </label>
                      <input
                        id={`${uid}-qty`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        enterKeyHint="done"
                        placeholder="Ej: 2"
                        value={warehouseQuantity}
                        onChange={(e) => setWarehouseQuantity(e.target.value)}
                        aria-invalid={!!errors.qty}
                        aria-describedby={errId('qty')}
                        className={fieldClass(!!errors.qty, 'font-bold')}
                      />
                      <FieldError id={errId('qty')} error={errors.qty} />
                    </div>
                  )}
                </div>
              )}

              {/* Medicamento y dosis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor={`${uid}-med`}>Medicamento</FieldLabel>
                  <input
                    id={`${uid}-med`}
                    type="text"
                    placeholder="Ej: Hierro dextrano 200 mg"
                    value={medicamentUsed}
                    onChange={(e) => setMedicamentUsed(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`${uid}-dose`}>Dosis y cómo se aplica</FieldLabel>
                  <input
                    id={`${uid}-dose`}
                    type="text"
                    placeholder="Ej: 2 ml en el músculo"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Responsable */}
              <div>
                <FieldLabel htmlFor={`${uid}-resp`}>Responsable</FieldLabel>
                <input
                  id={`${uid}-resp`}
                  type="text"
                  list="sanitary-responsible-roles"
                  placeholder="Ej: Veterinario"
                  value={responsible}
                  onChange={(e) => setResponsible(e.target.value)}
                  className={inputClass}
                />
                <datalist id="sanitary-responsible-roles">
                  {RESPONSIBLE_ROLES.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>

              {/* Procedimiento */}
              <div>
                <FieldLabel htmlFor={`${uid}-proc`}>Cómo hacerlo (pasos) *</FieldLabel>
                <textarea
                  id={`${uid}-proc`}
                  rows={3}
                  placeholder="Aguja a usar, limpieza, precauciones y qué vigilar después…"
                  value={procedure}
                  onChange={(e) => setProcedure(e.target.value)}
                  aria-invalid={!!errors.procedure}
                  aria-describedby={errId('procedure')}
                  className={fieldClass(!!errors.procedure, 'py-2')}
                />
                <FieldError id={errId('procedure')} error={errors.procedure} />
              </div>
            </div>

            {/* Pie fijo */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
              <ErrorBox error={errorMsg || null} />
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Btn variant="secondary" size="lg" onClick={requestClose}>
                  Cancelar
                </Btn>
                <Btn type="submit" rubro="porcino" size="lg" block disabled={isSaving} icon={<Plus />}>
                  {isSaving ? 'Guardando…' : 'Guardar actividad'}
                </Btn>
              </div>
            </div>
          </form>
        )}
        {confirmDialog}
      </div>
    </Overlay>
  );
};
