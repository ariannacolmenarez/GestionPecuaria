import React, { useMemo, useRef, useState } from 'react';
import { Scale, TrendingUp, CheckCircle2, Truck, PiggyBank, Beef, ClipboardCheck, ArrowLeft, RotateCcw } from 'lucide-react';
import { PorcinoAnimal, UnifiedSaleResult } from '../../types';
import { isActiveAnimal, headCount, num, round2 } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import { Btn, ErrorBox, FieldError, FieldLabel, ModalHeader, fieldClass, inputClass, useBackClose, useFocusFirstInvalid } from '../common/ui';

interface UnifiedSaleSlaughterModalProps {
  animals?: PorcinoAnimal[];
  preselectedAnimalCode?: string;
  initialCategory?: string;
  onClose: () => void;
  /**
   * result.animalId/animalCode = registro seleccionado (obligatorio), result.animalsCount puede ser
   * menor que las cabezas del lote (venta parcial). result.accumulatedCostUsd es el costo PROPORCIONAL
   * informativo (el dominio lo recalcula). Puede devolver un DomainResult.
   */
  onConfirmSaleSlaughter: (result: UnifiedSaleResult) => ModalActionReturn;
}

export const UnifiedSaleSlaughterModal: React.FC<UnifiedSaleSlaughterModalProps> = ({
  animals = [],
  preselectedAnimalCode,
  initialCategory,
  onClose,
  onConfirmSaleSlaughter,
}) => {
  // Solo animales/lotes activos (no se puede revender lo ya vendido o en matadero)
  const candidates = useMemo(() => (animals || []).filter(isActiveAnimal), [animals]);

  const initialSelected =
    (preselectedAnimalCode ? candidates.find((a) => a.code === preselectedAnimalCode) : undefined) ||
    (initialCategory ? candidates.find((a) => a.category === initialCategory) : undefined) ||
    candidates[0];
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>(initialSelected?.id || '');
  const currentAnimal = candidates.find((a) => a.id === selectedAnimalId);
  const availableHeads = currentAnimal ? headCount(currentAnimal) : 0;

  // Mode: En Pie vs En Canal
  const [saleMode, setSaleMode] = useState<'pie' | 'canal'>('pie');

  // Basic Details
  const [date, setDate] = useState(todayISO());
  const [buyer, setBuyer] = useState('');
  const [sanitaryDocNumber, setSanitaryDocNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Contado' | 'Transferencia' | 'Crédito 15 días'>('Transferencia');

  // Cantidad y pesos (por defecto: todo el lote)
  const initialHeads = initialSelected ? headCount(initialSelected) : 0;
  const [animalsCount, setAnimalsCount] = useState<string>(initialHeads ? String(initialHeads) : '');
  const [totalLiveWeightKg, setTotalLiveWeightKg] = useState<string>(
    initialSelected?.currentWeightKg ? String(round2(initialHeads * initialSelected.currentWeightKg)) : ''
  );
  const [shrinkagePercent, setShrinkagePercent] = useState<string>(''); // % merma de desbaste

  // Canal specific
  const [carcassYieldPercent, setCarcassYieldPercent] = useState<string>('78');
  const [slaughterFeePerAnimal, setSlaughterFeePerAnimal] = useState<string>('');

  // Prices & expenses
  const [pricePerKg, setPricePerKg] = useState<string>('');
  const [transportFeeTotal, setTransportFeeTotal] = useState<string>('');

  const [notes, setNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ count: number; code: string; netRevenue: number; netProfit: number; margin: number; remaining: number } | null>(null);

  const handleAnimalSelect = (animalId: string) => {
    setSelectedAnimalId(animalId);
    setError(null);
    const chosen = candidates.find((a) => a.id === animalId);
    if (!chosen) return;
    const count = headCount(chosen);
    setAnimalsCount(String(count));
    setTotalLiveWeightKg(chosen.currentWeightKg ? String(round2(count * chosen.currentWeightKg)) : '');
  };

  // Cálculos numéricos (sin NaN ni divisiones por cero)
  const parsedCount = parseInt(animalsCount, 10);
  const countNum = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
  const exceedsHeads = countNum > availableHeads;
  const liveWeightNum = Math.max(0, toNumber(totalLiveWeightKg));
  const avgWeight = countNum > 0 ? liveWeightNum / countNum : 0;
  const shrinkageNum = Math.min(15, Math.max(0, toNumber(shrinkagePercent)));
  const priceNum = Math.max(0, toNumber(pricePerKg));
  const yieldNum = Math.min(100, Math.max(1, toNumber(carcassYieldPercent, 78)));
  const slaughterFeeUnit = Math.max(0, toNumber(slaughterFeePerAnimal));
  const transportNum = Math.max(0, toNumber(transportFeeTotal));

  // accumulatedCostUsd es el costo TOTAL del registro: costo vendido = proporción de cabezas
  const lotCost = num(currentAnimal?.accumulatedCostUsd);
  const costNum = availableHeads > 0 ? round2(lotCost * (Math.min(countNum, availableHeads) / availableHeads)) : 0;

  const netLiveWeightKg = liveWeightNum * (1 - shrinkageNum / 100);
  const carcassWeightKg = netLiveWeightKg * (yieldNum / 100);
  const effectiveCommercialWeightKg = saleMode === 'pie' ? netLiveWeightKg : carcassWeightKg;
  const grossRevenue = round2(effectiveCommercialWeightKg * priceNum);
  const totalSlaughterFee = saleMode === 'canal' ? round2(slaughterFeeUnit * countNum) : 0;
  const totalDeductions = round2(totalSlaughterFee + transportNum);
  const netRevenue = Math.max(0, round2(grossRevenue - totalDeductions));
  const netProfit = round2(netRevenue - costNum);
  const profitMarginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const profitPerAnimal = countNum > 0 ? netProfit / countNum : 0;
  const netPerKgLive = liveWeightNum > 0 ? netRevenue / liveWeightNum : 0;
  const isTotalSale = countNum > 0 && countNum === availableHeads;

  const handleModeChange = (newMode: 'pie' | 'canal') => {
    setSaleMode(newMode);
  };

  // Paso actual: llenar → revisar → (guardado) éxito
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'animal' | 'count' | 'weight' | 'price' | 'buyer' | 'date', string>>>({});
  const [submitTry, setSubmitTry] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, Object.keys(fieldErrors).length ? 'invalid' : null, submitTry);

  const dirty =
    !isSuccess && !!(buyer.trim() || pricePerKg || notes.trim() || sanitaryDocNumber.trim() || transportFeeTotal || slaughterFeePerAnimal);
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!currentAnimal) errs.animal = 'Elige el animal o lote que vas a vender.';
    if (countNum <= 0) errs.count = 'Escribe cuántos animales vendes (1 o más).';
    else if (exceedsHeads && currentAnimal) errs.count = `El lote ${currentAnimal.code} solo tiene ${availableHeads} animal(es).`;
    if (liveWeightNum <= 0) errs.weight = 'Escribe el peso vivo total en kg.';
    if (priceNum <= 0) errs.price = 'Escribe el precio por kg.';
    if (!buyer.trim()) errs.buyer = 'Escribe quién compra (persona o matadero).';
    if (!date || date > todayISO()) errs.date = 'La fecha no puede ser futura.';
    return errs;
  };

  const handleReview = (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setSubmitTry((n) => n + 1);
      return;
    }
    setStep('review');
  };

  const handleConfirm = async () => {
    setError(null);
    const errs = validate();
    if (!currentAnimal || Object.keys(errs).length) {
      setFieldErrors(errs);
      setStep('form');
      setSubmitTry((n) => n + 1);
      return;
    }

    const result: UnifiedSaleResult = {
      animalId: currentAnimal.id,
      animalCode: currentAnimal.code,
      category: currentAnimal.category,
      saleMode,
      date,
      animalsCount: countNum,
      totalLiveWeightKg: round2(liveWeightNum),
      averageLiveWeightKg: round2(avgWeight),
      carcassYieldPercent: saleMode === 'canal' ? yieldNum : undefined,
      carcassWeightKg: saleMode === 'canal' ? round2(carcassWeightKg) : undefined,
      pricePerKg: priceNum,
      slaughterFeeUsd: totalSlaughterFee,
      transportFeeUsd: transportNum,
      grossRevenueUsd: grossRevenue,
      totalDeductionsUsd: totalDeductions,
      netRevenueUsd: netRevenue,
      accumulatedCostUsd: costNum,
      netProfitUsd: netProfit,
      profitMarginPercent: round2(profitMarginPercent),
      buyer: buyer.trim(),
      sanitaryDocNumber: sanitaryDocNumber.trim() || undefined,
      paymentMethod,
      markAsSlaughtered: isTotalSale,
      notes: notes.trim() || undefined,
    };

    setIsSaving(true);
    const res = await runModalAction(() => onConfirmSaleSlaughter(result));
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo guardar la venta.');
      return;
    }
    const finalProfit = typeof res.meta?.netProfitUsd === 'number' ? res.meta.netProfitUsd : netProfit;
    setSaved({
      count: countNum,
      code: currentAnimal.code,
      netRevenue,
      netProfit: finalProfit,
      margin: netRevenue > 0 ? (finalProfit / netRevenue) * 100 : 0,
      remaining: typeof res.meta?.remainingHeads === 'number' ? res.meta.remainingHeads : availableHeads - countNum,
    });
    setIsSuccess(true);
  };

  /** Deja el formulario listo para otra venta (mismo comprador y fecha, nuevo lote). */
  const handleRegisterAnother = () => {
    setIsSuccess(false);
    setSaved(null);
    setStep('form');
    setFieldErrors({});
    setError(null);
    setPricePerKg('');
    setTransportFeeTotal('');
    setSlaughterFeePerAnimal('');
    setShrinkagePercent('');
    setSanitaryDocNumber('');
    setNotes('');
    const stillActive = candidates.find((a) => a.id === selectedAnimalId && headCount(a) > 0) || candidates[0];
    if (stillActive) handleAnimalSelect(stillActive.id);
    else {
      setSelectedAnimalId('');
      setAnimalsCount('');
      setTotalLiveWeightKg('');
    }
  };

  const money = (v: number) => `$${v.toFixed(2)}`;
  const modeLabel = saleMode === 'pie' ? 'En pie (animal vivo)' : 'A matadero (en canal)';
  const sectionTitle = 'text-xs font-bold text-slate-700 uppercase tracking-wider block';

  return (
    <div
      id="unified-sale-slaughter-modal-overlay"
      className="fixed inset-0 z-70 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        id="unified-sale-slaughter-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unified-sale-title"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[94vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Scale />}
          titleId="unified-sale-title"
          title={isSuccess ? 'Venta guardada' : step === 'review' ? 'Revisa la venta' : 'Vender cerdos'}
          subtitle={isSuccess ? undefined : step === 'review' ? 'Paso 2 de 2 · confirma que todo está bien' : 'Paso 1 de 2 · datos de la venta'}
          onClose={requestClose}
        />

        {isSuccess ? (
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">¡Venta guardada!</h3>
            <p className="text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
              Vendiste <strong>{saved?.count} animal(es)</strong> de {saved?.code}. Te quedan{' '}
              <strong className="text-emerald-700">{money(saved?.netRevenue ?? 0)}</strong> después de gastos, con una ganancia de{' '}
              <strong className={(saved?.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {(saved?.netProfit ?? 0) >= 0 ? '+' : ''}
                {money(saved?.netProfit ?? 0)}
              </strong>
              . Ya aparece en el Balance.
            </p>
            <p className="text-sm text-slate-700">
              {saved && saved.remaining > 0
                ? `Quedan ${saved.remaining} animal(es) activos en el lote.`
                : 'El lote quedó cerrado y sus tareas pendientes se cancelaron.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {candidates.length > 0 && (
                <Btn variant="secondary" size="lg" block icon={<RotateCcw />} onClick={handleRegisterAnother}>
                  Registrar otra venta
                </Btn>
              )}
              <Btn rubro="porcino" size="lg" block onClick={onClose}>
                Listo
              </Btn>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-bold text-slate-900 text-base">No hay animales activos para vender</p>
            <p className="text-sm text-slate-600">Registra animales o lotes en Porcinos para poder vender.</p>
            <Btn variant="secondary" size="lg" block onClick={onClose}>
              Cerrar
            </Btn>
          </div>
        ) : step === 'review' ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <dl className="rounded-2xl border border-slate-200 divide-y divide-slate-200 text-sm">
                {[
                  ['Lote o animal', `${currentAnimal?.code ?? ''} (${currentAnimal?.category ?? ''})`],
                  ['Tipo de venta', modeLabel],
                  ['Animales', `${countNum} ${countNum === 1 ? 'animal' : 'animales'}${isTotalSale ? ' · todo el lote' : ' · venta parcial'}`],
                  ['Peso vivo total', `${liveWeightNum.toFixed(1)} kg (${avgWeight.toFixed(1)} kg por cerdo)`],
                  [saleMode === 'pie' ? 'Kg que se cobran' : 'Kg de carne limpia', `${effectiveCommercialWeightKg.toFixed(1)} kg`],
                  ['Precio por kg', money(priceNum)],
                  ['Comprador', buyer.trim()],
                  ['Fecha', date],
                  ['Forma de pago', paymentMethod],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <dt className="text-slate-600">{k}</dt>
                    <dd className="font-bold text-slate-900 text-right">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-2xl bg-emerald-950 text-white p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100">Valor de la venta</span>
                  <strong>{money(grossRevenue)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100">Gastos (flete y matadero)</span>
                  <strong className="text-rose-200">-{money(totalDeductions)}</strong>
                </div>
                <div className="flex justify-between gap-2 border-t border-emerald-800 pt-2 text-base">
                  <span className="font-bold">Total que recibes</span>
                  <strong className="font-black text-emerald-200">{money(netRevenue)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-emerald-100">Ganancia (después de lo que costó criarlos)</span>
                  <strong className={netProfit >= 0 ? 'text-emerald-200' : 'text-rose-300'}>
                    {netProfit >= 0 ? '+' : ''}
                    {money(netProfit)}
                  </strong>
                </div>
              </div>

              <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">
                {isTotalSale
                  ? 'Se vende todo el lote: sale del conteo activo y se cancelan sus tareas sanitarias pendientes.'
                  : `Venta parcial: el lote sigue activo con ${Math.max(0, availableHeads - countNum)} animal(es).`}
              </p>
              <ErrorBox error={error} />
            </div>
            <div className="shrink-0 border-t border-slate-200 p-3 flex gap-2 bg-white">
              <Btn variant="secondary" size="lg" icon={<ArrowLeft />} onClick={() => setStep('form')} disabled={isSaving} className="flex-1">
                Volver a editar
              </Btn>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="flex-1 min-h-12 px-4 rounded-xl font-bold text-base inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
              >
                <CheckCircle2 className="w-5 h-5" aria-hidden="true" /> {isSaving ? 'Guardando…' : 'Confirmar venta'}
              </button>
            </div>
          </>
        ) : (
          <form ref={formRef} onSubmit={handleReview} noValidate className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
              {/* 1. Tipo de venta */}
              <fieldset>
                <legend className="block text-sm font-semibold text-slate-900 mb-1.5">¿Cómo vendes?</legend>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={saleMode === 'pie'}
                    onClick={() => handleModeChange('pie')}
                    className={`min-h-16 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      saleMode === 'pie' ? 'border-emerald-700 bg-emerald-50 text-emerald-950' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <PiggyBank className="w-6 h-6 shrink-0 text-emerald-700" aria-hidden="true" />
                    <span>
                      <span className="text-sm font-bold block">En pie (vivo)</span>
                      <span className="text-xs text-slate-600">Se pesa vivo en la granja o el camión</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={saleMode === 'canal'}
                    onClick={() => handleModeChange('canal')}
                    className={`min-h-16 p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      saleMode === 'canal' ? 'border-blue-700 bg-blue-50 text-blue-950' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Beef className="w-6 h-6 shrink-0 text-blue-700" aria-hidden="true" />
                    <span>
                      <span className="text-sm font-bold block">A matadero</span>
                      <span className="text-xs text-slate-600">Se cobra la carne limpia (en canal, sin vísceras)</span>
                    </span>
                  </button>
                </div>
              </fieldset>

              {/* 2. Lote o animal */}
              <div className="space-y-2">
                <FieldLabel htmlFor="sale-animal">
                  Animal o lote <span className="text-rose-700">*</span>
                </FieldLabel>
                <select
                  id="sale-animal"
                  value={selectedAnimalId}
                  onChange={(e) => handleAnimalSelect(e.target.value)}
                  aria-invalid={!!fieldErrors.animal}
                  aria-describedby={fieldErrors.animal ? 'sale-animal-err' : undefined}
                  className={fieldClass(!!fieldErrors.animal, 'font-bold')}
                >
                  {!currentAnimal && <option value="">Elige…</option>}
                  {candidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.category}) · {headCount(a)} {headCount(a) === 1 ? 'cerdo' : 'cerdos'} · {a.currentWeightKg} kg
                      {a.penLocation ? ` · ${a.penLocation}` : ''}
                    </option>
                  ))}
                </select>
                <FieldError id="sale-animal-err" error={fieldErrors.animal} />
                {currentAnimal && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5">
                    <span>
                      Disponibles: <strong className="text-sm text-slate-900">{availableHeads}</strong>
                    </span>
                    <span>
                      Corral: <strong className="text-slate-900">{currentAnimal.penLocation || '—'}</strong>
                    </span>
                    <span>
                      Origen: <strong className="text-slate-900">{currentAnimal.origin === 'comprado' ? 'Comprado' : 'Destetado'}</strong>
                    </span>
                    <span>
                      Costó criarlos: <strong className="text-slate-900">{money(lotCost)}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 3. Cantidad, peso y precio */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="sale-count">
                    Cuántos animales <span className="text-rose-700">*</span>
                  </FieldLabel>
                  <input
                    id="sale-count"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={availableHeads || undefined}
                    value={animalsCount}
                    aria-invalid={!!fieldErrors.count || exceedsHeads}
                    aria-describedby="sale-count-hint"
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnimalsCount(val);
                      const c = parseInt(val, 10);
                      if (Number.isFinite(c) && c > 0 && currentAnimal?.currentWeightKg) {
                        setTotalLiveWeightKg(String(round2(c * currentAnimal.currentWeightKg)));
                      }
                    }}
                    className={fieldClass(!!fieldErrors.count || exceedsHeads, 'font-bold')}
                  />
                  {fieldErrors.count ? (
                    <FieldError id="sale-count-hint" error={fieldErrors.count} />
                  ) : (
                    <p id="sale-count-hint" className={`text-xs mt-1 ${exceedsHeads ? 'text-rose-700 font-semibold' : 'text-slate-600'}`}>
                      {exceedsHeads ? `Máximo ${availableHeads}` : isTotalSale ? 'Todo el lote' : 'Venta parcial'}
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel htmlFor="sale-weight">
                    Peso vivo total (kg) <span className="text-rose-700">*</span>
                  </FieldLabel>
                  <input
                    id="sale-weight"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="1"
                    value={totalLiveWeightKg}
                    aria-invalid={!!fieldErrors.weight}
                    aria-describedby="sale-weight-hint"
                    onChange={(e) => setTotalLiveWeightKg(e.target.value)}
                    className={fieldClass(!!fieldErrors.weight, 'font-bold')}
                  />
                  {fieldErrors.weight ? (
                    <FieldError id="sale-weight-hint" error={fieldErrors.weight} />
                  ) : (
                    <p id="sale-weight-hint" className="text-xs text-slate-600 mt-1">
                      Promedio: <strong>{avgWeight.toFixed(1)} kg</strong> por cerdo
                    </p>
                  )}
                </div>

                <div>
                  <FieldLabel htmlFor="sale-price">
                    {saleMode === 'pie' ? 'Precio por kg vivo ($)' : 'Precio por kg de carne ($)'} <span className="text-rose-700">*</span>
                  </FieldLabel>
                  <input
                    id="sale-price"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder={saleMode === 'pie' ? 'Ej. 2.20' : 'Ej. 3.05'}
                    value={pricePerKg}
                    aria-invalid={!!fieldErrors.price}
                    aria-describedby={fieldErrors.price ? 'sale-price-err' : undefined}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    className={fieldClass(!!fieldErrors.price, 'font-bold')}
                  />
                  <FieldError id="sale-price-err" error={fieldErrors.price} />
                </div>

                <div>
                  <span className="block text-sm font-semibold text-slate-900 mb-1">Valor de la venta</span>
                  <div className="min-h-11 px-3 flex items-center border border-emerald-300 bg-emerald-50 rounded-xl font-black text-base text-emerald-900" aria-live="polite">
                    {money(grossRevenue)}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    {effectiveCommercialWeightKg.toFixed(1)} kg × {money(priceNum)}
                  </p>
                </div>
              </div>

              {/* Datos según el tipo de venta */}
              {saleMode === 'pie' ? (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <FieldLabel htmlFor="sale-shrink" hint="Por ayuno o viaje. Déjalo vacío si no aplica (máx. 15).">
                    Peso que se pierde en el viaje (%)
                  </FieldLabel>
                  <input
                    id="sale-shrink"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    max="15"
                    placeholder="0"
                    value={shrinkagePercent}
                    onChange={(e) => setShrinkagePercent(e.target.value)}
                    className={inputClass}
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Kg que se cobran: <strong className="text-sm text-slate-900">{netLiveWeightKg.toFixed(1)} kg</strong>
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="sale-yield" hint="Normal en cerdos: 76 a 82">
                      Carne limpia por cada 100 kg vivos (%)
                    </FieldLabel>
                    <input
                      id="sale-yield"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="50"
                      max="90"
                      value={carcassYieldPercent}
                      onChange={(e) => setCarcassYieldPercent(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="sale-fee" hint={`Total: ${money(totalSlaughterFee)}`}>
                      Cobro del matadero por animal ($)
                    </FieldLabel>
                    <input
                      id="sale-fee"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={slaughterFeePerAnimal}
                      onChange={(e) => setSlaughterFeePerAnimal(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-slate-700">
                    Carne limpia total: <strong className="text-sm text-blue-900">{carcassWeightKg.toFixed(1)} kg</strong> (
                    {countNum > 0 ? (carcassWeightKg / countNum).toFixed(1) : '0.0'} kg por cerdo)
                  </p>
                </div>
              )}

              <div>
                <FieldLabel htmlFor="sale-transport" hint={`Gastos totales: ${money(totalDeductions)}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-slate-600" aria-hidden="true" /> Flete o transporte ($)
                  </span>
                </FieldLabel>
                <input
                  id="sale-transport"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={transportFeeTotal}
                  onChange={(e) => setTransportFeeTotal(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Resumen en vivo */}
              <div className="p-4 bg-emerald-950 text-white rounded-2xl space-y-2">
                <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" /> Cuentas de esta venta
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-900/60 p-2.5 rounded-xl">
                    <span className="text-xs text-emerald-100 block">Total que recibes</span>
                    <strong className="text-base font-black text-emerald-200">{money(netRevenue)}</strong>
                  </div>
                  <div className="bg-emerald-900/60 p-2.5 rounded-xl">
                    <span className="text-xs text-emerald-100 block">Ganancia</span>
                    <strong className={`text-base font-black ${netProfit >= 0 ? 'text-emerald-200' : 'text-rose-300'}`}>
                      {netProfit >= 0 ? '+' : ''}
                      {money(netProfit)}
                    </strong>
                  </div>
                </div>
                <p className="text-xs text-emerald-100">
                  Ganancia = lo que recibes − lo que costó criarlos ({money(costNum)}). Por cerdo: {money(profitPerAnimal)} · Precio real:{' '}
                  {money(netPerKgLive)} por kg vivo.
                </p>
              </div>

              {/* 4. Comprador y datos */}
              <div className="space-y-3">
                <span className={sectionTitle}>Comprador</span>
                <div>
                  <FieldLabel htmlFor="sale-buyer">
                    Quién compra <span className="text-rose-700">*</span>
                  </FieldLabel>
                  <input
                    id="sale-buyer"
                    type="text"
                    value={buyer}
                    aria-invalid={!!fieldErrors.buyer}
                    aria-describedby={fieldErrors.buyer ? 'sale-buyer-err' : undefined}
                    onChange={(e) => setBuyer(e.target.value)}
                    className={fieldClass(!!fieldErrors.buyer)}
                    placeholder="Ej: Matadero Central"
                  />
                  <FieldError id="sale-buyer-err" error={fieldErrors.buyer} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="sale-date">Fecha</FieldLabel>
                    <input
                      id="sale-date"
                      type="date"
                      max={todayISO()}
                      value={date}
                      aria-invalid={!!fieldErrors.date}
                      aria-describedby={fieldErrors.date ? 'sale-date-err' : undefined}
                      onChange={(e) => setDate(e.target.value)}
                      className={fieldClass(!!fieldErrors.date)}
                    />
                    <FieldError id="sale-date-err" error={fieldErrors.date} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="sale-pay">Forma de pago</FieldLabel>
                    <select
                      id="sale-pay"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                      className={inputClass}
                    >
                      <option value="Transferencia">Transferencia</option>
                      <option value="Contado">Efectivo</option>
                      <option value="Crédito 15 días">Crédito a 15 días</option>
                    </select>
                  </div>
                </div>
                <div>
                  <FieldLabel htmlFor="sale-doc">N° de guía o factura (opcional)</FieldLabel>
                  <input
                    id="sale-doc"
                    type="text"
                    value={sanitaryDocNumber}
                    onChange={(e) => setSanitaryDocNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="sale-notes">Notas (opcional)</FieldLabel>
                  <input
                    id="sale-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Estado de los animales, viaje…"
                    className={inputClass}
                  />
                </div>
              </div>
              <ErrorBox error={error} />
            </div>

            <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
              <Btn type="submit" rubro="porcino" size="lg" block icon={<ClipboardCheck />} disabled={!currentAnimal}>
                Revisar venta
              </Btn>
              {!currentAnimal && <p className="text-xs text-slate-600 text-center mt-1">Elige primero el animal o lote.</p>}
            </div>
          </form>
        )}
        {confirmDialog}
      </div>
    </div>
  );
};
