import React, { useMemo, useRef, useState } from 'react';
import { Heart, Plus, Calendar, CheckCircle2, ShieldCheck, Activity, PiggyBank } from 'lucide-react';
import { PorcinoAnimal, FinancialMovement } from '../../types';
import { isActiveAnimal, sowReproductiveState } from '../../models/porcinoRules';
import { todayISO, addDays } from '../../utils/dates';
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

const GESTATION_DAYS = 114;

interface BoarMatingAndNewModalProps {
  initialTab?: 'monta' | 'nuevo';
  boars?: PorcinoAnimal[];
  sows?: PorcinoAnimal[];
  animals?: PorcinoAnimal[];
  onClose: () => void;
  /**
   * El argumento movement ya no se envía (undefined): el dominio (registerMating) crea el egreso
   * a partir de externalCostUsd. Puede devolver un DomainResult para mostrar éxito/error real.
   */
  onRegisterMating: (
    boarCode: string,
    sowCode: string,
    date: string,
    isExternal: boolean,
    externalCostUsd: number,
    notes: string,
    movement?: FinancialMovement
  ) => ModalActionReturn;
  /**
   * newBoar.admissionPriceUsd = costo de compra (el dominio addNewBoar genera el egreso con él;
   * el movement se mantiene solo por compatibilidad y debe ignorarse).
   */
  onAddNewBoar: (newBoar: PorcinoAnimal, movement: FinancialMovement) => ModalActionReturn;
  /** Opcional: enlace "Ver cerdas" en la pantalla de éxito (lo cablea el menú porcino). */
  onViewSows?: () => void;
}

type FieldKey = 'sow' | 'boar' | 'date' | 'cost' | 'code' | 'weight' | 'birth';

const segClass = (active: boolean) =>
  `min-h-11 flex-1 rounded-xl border-2 px-2 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
    active ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
  }`;

export const BoarMatingAndNewModal: React.FC<BoarMatingAndNewModalProps> = ({
  initialTab = 'monta',
  boars,
  sows,
  animals,
  onClose,
  onRegisterMating,
  onAddNewBoar,
  onViewSows,
}) => {
  const allAnimals = animals || [];

  // Verracos activos de la granja
  const availableBoars = useMemo(() => {
    const source = boars && boars.length > 0 ? boars : allAnimals;
    return source.filter((a) => a.category === 'verracos' && isActiveAnimal(a));
  }, [boars, allAnimals]);

  // Cerdas activas que pueden recibir servicio (no gestantes)
  const availableSows = useMemo(() => {
    const source = sows && sows.length > 0 ? sows : allAnimals;
    return source.filter(
      (a) => a.category === 'maternidad' && isActiveAnimal(a) && sowReproductiveState(a) !== 'gestante'
    );
  }, [sows, allAnimals]);

  const [activeTab, setActiveTab] = useState<'monta' | 'nuevo'>(initialTab);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Mating form state
  const [selectedBoar, setSelectedBoar] = useState(availableBoars[0]?.code || '');
  const [selectedSow, setSelectedSow] = useState(availableSows[0]?.code || '');
  const [matingDate, setMatingDate] = useState(todayISO());
  const [isExternalBoar, setIsExternalBoar] = useState(availableBoars.length === 0);
  const [externalBoarName, setExternalBoarName] = useState('');
  const [externalCost, setExternalCost] = useState('');
  const [matingType, setMatingType] = useState<'natural' | 'inseminacion'>('natural');
  const [matingNotes, setMatingNotes] = useState('');

  // New Boar form state
  const [newBoarCode, setNewBoarCode] = useState('');
  const [newBoarBreed, setNewBoarBreed] = useState('');
  const [newBoarBirthDate, setNewBoarBirthDate] = useState('');
  const [newBoarWeight, setNewBoarWeight] = useState('');
  const [newBoarCost, setNewBoarCost] = useState('');
  const [newBoarSupplier, setNewBoarSupplier] = useState('');
  const [newBoarDiet, setNewBoarDiet] = useState('');

  const estimatedFarrowDate = matingDate ? addDays(matingDate, GESTATION_DAYS) : '—';
  const selectedSowAnimal = availableSows.find((s) => s.code === selectedSow);

  const dirty =
    !isSuccess &&
    (externalBoarName.trim() !== '' ||
      externalCost !== '' ||
      matingNotes.trim() !== '' ||
      newBoarCode.trim() !== '' ||
      newBoarBreed.trim() !== '' ||
      newBoarBirthDate !== '' ||
      newBoarWeight !== '' ||
      newBoarCost !== '' ||
      newBoarSupplier.trim() !== '' ||
      newBoarDiet.trim() !== '');
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);
  const firstError = (Object.values(errors) as (string | undefined)[]).find(Boolean) || null;
  useFocusFirstInvalid(formRef, firstError, attempt);

  const clearErrors = () => {
    setErrors({});
    setFormError(null);
  };

  const switchTab = (tab: 'monta' | 'nuevo') => {
    setActiveTab(tab);
    setIsSuccess(false);
    clearErrors();
  };

  const resetForm = () => {
    // Monta: la cerda servida pasa a preñada y deja de figurar; se elige la siguiente
    setSelectedSow(availableSows[0]?.code || '');
    setMatingDate(todayISO());
    setExternalBoarName('');
    setExternalCost('');
    setMatingNotes('');
    setNewBoarCode('');
    setNewBoarBreed('');
    setNewBoarBirthDate('');
    setNewBoarWeight('');
    setNewBoarCost('');
    setNewBoarSupplier('');
    setNewBoarDiet('');
    clearErrors();
    setIsSuccess(false);
  };

  const fail = (errs: Partial<Record<FieldKey, string>>) => {
    setErrors(errs);
    setAttempt((n) => n + 1);
    return Object.keys(errs).length > 0;
  };

  const handleMatingSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const finalBoarCode = (isExternalBoar ? externalBoarName : selectedBoar).trim();
    const costNum = isExternalBoar ? toNumber(externalCost) : 0;
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!selectedSowAnimal) errs.sow = 'Elige la cerda que se montó.';
    if (!finalBoarCode) errs.boar = isExternalBoar ? 'Escribe el nombre o código del verraco de afuera.' : 'Elige un verraco de la granja.';
    if (!matingDate || matingDate > todayISO()) errs.date = 'La fecha no puede ser futura.';
    if (costNum < 0) errs.cost = 'El costo no puede ser negativo.';
    if (fail(errs) || !selectedSowAnimal) return;

    const typeLabel = matingType === 'inseminacion' ? 'Inseminación artificial' : 'Monta natural';
    const notes = [typeLabel, matingNotes.trim()].filter(Boolean).join('. ');

    setIsSaving(true);
    const res = await runModalAction(() =>
      onRegisterMating(finalBoarCode, selectedSowAnimal.code, matingDate, isExternalBoar, costNum, notes, undefined)
    );
    setIsSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar la monta.');
      return;
    }
    setSuccessMessage(
      `Monta de ${finalBoarCode} con la cerda ${selectedSowAnimal.code}. Parto probable: ${
        res.meta?.expectedFarrowingDate || estimatedFarrowDate
      }. Ya quedaron programadas las tareas de revisión de preñez, vacuna antes del parto y parto.`
    );
    setIsSuccess(true);
  };

  const handleNewBoarSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFormError(null);
    const code = newBoarCode.trim().toUpperCase();
    const costNum = toNumber(newBoarCost);
    const weightNum = toNumber(newBoarWeight);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!code) errs.code = 'Escribe el código o arete del verraco.';
    else if (
      allAnimals.some((a) => (a.code || '').toUpperCase() === code) ||
      availableBoars.some((b) => b.code.toUpperCase() === code)
    )
      errs.code = `El código ${code} ya está en uso.`;
    if (newBoarBirthDate && newBoarBirthDate > todayISO()) errs.birth = 'La fecha de nacimiento no puede ser futura.';
    if (weightNum <= 0 || weightNum > 600) errs.weight = 'Escribe un peso entre 1 y 600 kg.';
    if (costNum < 0) errs.cost = 'El costo no puede ser negativo.';
    if (fail(errs)) return;

    const today = todayISO();
    const supplier = newBoarSupplier.trim();
    const breed = newBoarBreed.trim();

    const newAnimal: PorcinoAnimal = {
      id: newId('pig'),
      code,
      category: 'verracos',
      birthDate: newBoarBirthDate || today,
      currentWeightKg: weightNum,
      healthStatus: 'Optimo',
      stage: 'Semental Reproductor en Adaptación',
      breed: breed || undefined,
      accumulatedCostUsd: 0,
      dietPlan: newBoarDiet.trim() || undefined,
      photoUrl: 'https://images.unsplash.com/photo-1545468800-856f6620f779?w=300&auto=format&fit=crop&q=80',
      origin: 'comprado',
      provenance: supplier || undefined,
      admissionDate: today,
      admissionWeightKg: weightNum,
      admissionPriceUsd: costNum,
      batchAnimalCount: 1,
      traceability: [],
    };

    // Solo por compatibilidad de firma: el dominio genera el egreso real desde admissionPriceUsd.
    const movement: FinancialMovement = {
      id: newId('mov'),
      type: 'egreso',
      concept: `Compra de verraco ${code}${breed ? ` (${breed})` : ''}`,
      rubro: 'porcino',
      amount: costNum,
      date: today,
      category: 'Compra de animales',
      details: supplier ? `Proveedor ${supplier}` : undefined,
    };

    setIsSaving(true);
    const res = await runModalAction(() => onAddNewBoar(newAnimal, movement));
    setIsSaving(false);
    if (!res.ok) {
      setFormError(res.error || 'No se pudo registrar el verraco.');
      return;
    }
    setSuccessMessage(
      costNum > 0
        ? `El verraco ${code} ya está en la granja. Se anotó el gasto de $${costNum.toFixed(2)} en el balance.`
        : `El verraco ${code} ya está en la granja.`
    );
    setIsSuccess(true);
  };

  const errProps = (k: FieldKey) => ({
    'aria-invalid': !!errors[k],
    'aria-describedby': errors[k] ? `bm-${k}-err` : undefined,
  });

  const footer = (label: string) => (
    <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
      <ErrorBox error={formError} />
      <div className="flex gap-2.5">
        <Btn variant="secondary" size="lg" onClick={requestClose} className="flex-1">
          Cancelar
        </Btn>
        <Btn type="submit" rubro="porcino" size="lg" disabled={isSaving} className="flex-[2]">
          {isSaving ? 'Guardando…' : label}
        </Btn>
      </div>
    </div>
  );

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="boar-mating-new-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="boar-mating-title"
        className="relative bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Activity />}
          titleId="boar-mating-title"
          title={activeTab === 'monta' ? 'Registrar monta' : 'Comprar verraco'}
          subtitle="Montas de cerdas y compra de verracos"
          onClose={requestClose}
        />

        {/* Selector de formulario */}
        <div className="flex gap-2 p-3 border-b border-slate-200 bg-slate-50 shrink-0" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'monta'}
            onClick={() => switchTab('monta')}
            className={segClass(activeTab === 'monta')}
          >
            <Heart className="w-4 h-4" aria-hidden="true" /> Monta
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'nuevo'}
            onClick={() => switchTab('nuevo')}
            className={segClass(activeTab === 'nuevo')}
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Comprar verraco
          </button>
        </div>

        {isSuccess ? (
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">
              {activeTab === 'monta' ? 'Monta registrada' : 'Verraco registrado'}
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed">{successMessage}</p>
            <div className="flex flex-col gap-2.5 pt-2">
              {(activeTab === 'nuevo' || availableSows.length > 0) && (
                <Btn rubro="porcino" size="lg" block icon={<Plus />} onClick={resetForm}>
                  {activeTab === 'monta' ? 'Registrar otra monta' : 'Registrar otro verraco'}
                </Btn>
              )}
              {onViewSows && activeTab === 'monta' && (
                <Btn variant="secondary" size="lg" block icon={<PiggyBank />} onClick={onViewSows}>
                  Ver cerdas
                </Btn>
              )}
              <Btn variant="ghost" size="lg" block onClick={onClose}>
                Cerrar
              </Btn>
            </div>
          </div>
        ) : activeTab === 'monta' && availableSows.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-bold text-slate-900 text-base">No hay cerdas para montar</p>
            <p className="text-sm text-slate-600">
              Solo aparecen cerdas activas que no estén preñadas. Registra una nueva madre o espera el destete.
            </p>
            <Btn variant="secondary" size="lg" block onClick={onClose}>
              Cerrar
            </Btn>
          </div>
        ) : activeTab === 'monta' ? (
          /* FORM: REGISTRAR MONTA */
          <form ref={formRef} onSubmit={handleMatingSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Cerda */}
              <div>
                <FieldLabel htmlFor="bm-sow">Cerda *</FieldLabel>
                <select
                  id="bm-sow"
                  value={selectedSow}
                  onChange={(e) => setSelectedSow(e.target.value)}
                  {...errProps('sow')}
                  className={fieldClass(!!errors.sow, 'font-semibold')}
                >
                  {availableSows.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} · {sowReproductiveState(s) === 'lactante' ? 'Criando (falta destetar)' : s.stage || 'Vacía'}
                    </option>
                  ))}
                </select>
                <FieldError id="bm-sow-err" error={errors.sow} />
              </div>

              {/* Verraco de afuera: fila entera tocable */}
              <button
                type="button"
                role="switch"
                aria-checked={isExternalBoar}
                disabled={availableBoars.length === 0}
                onClick={() => setIsExternalBoar((v) => !v)}
                className="w-full min-h-14 p-3 rounded-2xl border-2 border-slate-300 bg-white flex items-center justify-between gap-3 text-left disabled:bg-slate-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-900">¿Fue con un verraco de afuera?</span>
                  <span className="block text-xs text-slate-600">
                    {availableBoars.length === 0
                      ? 'No hay verracos en la granja: solo se puede con uno de afuera.'
                      : isExternalBoar
                        ? 'Sí: servicio comprado (puedes anotar el costo).'
                        : 'No: con un verraco de la granja.'}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${isExternalBoar ? 'bg-rose-600' : 'bg-slate-400'}`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isExternalBoar ? 'translate-x-5' : ''
                    }`}
                  />
                </span>
              </button>

              {/* Verraco */}
              <div>
                <FieldLabel htmlFor="bm-boar">Verraco *</FieldLabel>
                {isExternalBoar ? (
                  <input
                    id="bm-boar"
                    type="text"
                    value={externalBoarName}
                    onChange={(e) => setExternalBoarName(e.target.value)}
                    placeholder="Nombre o código del verraco"
                    {...errProps('boar')}
                    className={fieldClass(!!errors.boar)}
                  />
                ) : (
                  <select
                    id="bm-boar"
                    value={selectedBoar}
                    onChange={(e) => setSelectedBoar(e.target.value)}
                    {...errProps('boar')}
                    className={fieldClass(!!errors.boar, 'font-semibold')}
                  >
                    {availableBoars.map((b) => (
                      <option key={b.id} value={b.code}>
                        {b.code} ({b.breed || 'Verraco'}) · {b.currentWeightKg} kg
                      </option>
                    ))}
                  </select>
                )}
                <FieldError id="bm-boar-err" error={errors.boar} />
              </div>

              {/* Costo si fue externo */}
              {isExternalBoar && (
                <div>
                  <FieldLabel htmlFor="bm-cost" hint="Se anota como gasto en el balance.">
                    Costo del servicio ($)
                  </FieldLabel>
                  <input
                    id="bm-cost"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={externalCost}
                    onChange={(e) => setExternalCost(e.target.value)}
                    {...errProps('cost')}
                    className={fieldClass(!!errors.cost, 'font-bold')}
                  />
                  <FieldError id="bm-cost-err" error={errors.cost} />
                </div>
              )}

              {/* Tipo de servicio */}
              <div>
                <span className="block text-sm font-semibold text-slate-900 mb-1" id="bm-type-label">
                  Tipo de monta
                </span>
                <div className="flex gap-2" role="radiogroup" aria-labelledby="bm-type-label">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={matingType === 'natural'}
                    onClick={() => setMatingType('natural')}
                    className={segClass(matingType === 'natural')}
                  >
                    Natural
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={matingType === 'inseminacion'}
                    onClick={() => setMatingType('inseminacion')}
                    className={segClass(matingType === 'inseminacion')}
                  >
                    Inseminación
                  </button>
                </div>
              </div>

              {/* Fecha */}
              <div>
                <FieldLabel htmlFor="bm-date">Fecha de la monta *</FieldLabel>
                <input
                  id="bm-date"
                  type="date"
                  max={todayISO()}
                  value={matingDate}
                  onChange={(e) => setMatingDate(e.target.value)}
                  {...errProps('date')}
                  className={fieldClass(!!errors.date)}
                />
                <FieldError id="bm-date-err" error={errors.date} />
              </div>

              {/* Parto probable */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-xs text-emerald-900 font-bold block">Parto probable (114 días después)</span>
                  <strong className="text-base text-emerald-950">{estimatedFarrowDate}</strong>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <FieldLabel htmlFor="bm-notes">Observaciones (opcional)</FieldLabel>
                <textarea
                  id="bm-notes"
                  rows={2}
                  value={matingNotes}
                  placeholder="Ej. Monta en la mañana, la cerda la aceptó bien"
                  onChange={(e) => setMatingNotes(e.target.value)}
                  className={`${inputClass} py-2`}
                />
              </div>
            </div>
            {footer('Guardar monta')}
          </form>
        ) : (
          /* FORM: COMPRAR NUEVO VERRACO */
          <form ref={formRef} onSubmit={handleNewBoarSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="bm-code">Código o arete *</FieldLabel>
                  <input
                    id="bm-code"
                    type="text"
                    value={newBoarCode}
                    placeholder="Ej. VER-001"
                    onChange={(e) => setNewBoarCode(e.target.value)}
                    {...errProps('code')}
                    className={fieldClass(!!errors.code, 'font-mono font-bold')}
                  />
                  <FieldError id="bm-code-err" error={errors.code} />
                </div>
                <div>
                  <FieldLabel htmlFor="bm-breed">Raza</FieldLabel>
                  <input
                    id="bm-breed"
                    type="text"
                    value={newBoarBreed}
                    onChange={(e) => setNewBoarBreed(e.target.value)}
                    placeholder="Ej. Duroc"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="bm-weight">Peso (kg) *</FieldLabel>
                  <input
                    id="bm-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="1"
                    max="600"
                    placeholder="Ej. 175"
                    value={newBoarWeight}
                    onChange={(e) => setNewBoarWeight(e.target.value)}
                    {...errProps('weight')}
                    className={fieldClass(!!errors.weight, 'font-bold')}
                  />
                  <FieldError id="bm-weight-err" error={errors.weight} />
                </div>
                <div>
                  <FieldLabel htmlFor="bm-bcost">Precio de compra ($)</FieldLabel>
                  <input
                    id="bm-bcost"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={newBoarCost}
                    onChange={(e) => setNewBoarCost(e.target.value)}
                    {...errProps('cost')}
                    className={fieldClass(!!errors.cost, 'font-bold')}
                  />
                  <FieldError id="bm-cost-err" error={errors.cost} />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="bm-birth">Fecha de nacimiento (opcional)</FieldLabel>
                <input
                  id="bm-birth"
                  type="date"
                  max={todayISO()}
                  value={newBoarBirthDate}
                  onChange={(e) => setNewBoarBirthDate(e.target.value)}
                  {...errProps('birth')}
                  className={fieldClass(!!errors.birth)}
                />
                <FieldError id="bm-birth-err" error={errors.birth} />
              </div>

              <div>
                <FieldLabel htmlFor="bm-supplier">¿A quién se le compró? (opcional)</FieldLabel>
                <input
                  id="bm-supplier"
                  type="text"
                  placeholder="Ej. Granja proveedora"
                  value={newBoarSupplier}
                  onChange={(e) => setNewBoarSupplier(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel htmlFor="bm-diet">Alimentación inicial (opcional)</FieldLabel>
                <input
                  id="bm-diet"
                  type="text"
                  value={newBoarDiet}
                  placeholder="Ej. 2.8 kg de alimento al día"
                  onChange={(e) => setNewBoarDiet(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" aria-hidden="true" /> Qué pasará
                </p>
                <p className="mt-1">
                  El verraco entra a la lista de animales y se anota un gasto de{' '}
                  <strong>${toNumber(newBoarCost).toFixed(2)}</strong> en el balance.
                </p>
              </div>
            </div>
            {footer('Guardar verraco')}
          </form>
        )}
        {confirmDialog}
      </div>
    </Overlay>
  );
};
