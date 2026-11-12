import React, { useMemo, useState } from 'react';
import { X, Scale, TrendingUp, CheckCircle2, Truck } from 'lucide-react';
import { PorcinoAnimal, UnifiedSaleResult } from '../../types';
import { isActiveAnimal, headCount, num, round2 } from '../../models/porcinoRules';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

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
  const [shrinkagePercent, setShrinkagePercent] = useState<string>('0'); // % merma de desbaste

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

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!currentAnimal) {
      setError('Selecciona un animal o lote del rebaño.');
      return;
    }
    if (countNum <= 0) {
      setError('La cantidad de animales debe ser mayor a 0.');
      return;
    }
    if (exceedsHeads) {
      setError(`El lote ${currentAnimal.code} solo tiene ${availableHeads} animal(es).`);
      return;
    }
    if (liveWeightNum <= 0) {
      setError('Indica el peso vivo total.');
      return;
    }
    if (priceNum <= 0) {
      setError('Indica el precio por kg.');
      return;
    }
    if (!buyer.trim()) {
      setError('Indica el comprador o frigorífico.');
      return;
    }
    if (!date || date > todayISO()) {
      setError('La fecha de venta no puede ser futura.');
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
      setError(res.error || 'No se pudo registrar la venta.');
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

  return (
    <div
      id="unified-sale-slaughter-modal-overlay"
      className="fixed inset-0 z-70 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="unified-sale-slaughter-card"
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-auto flex flex-col max-h-[94vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white leading-tight">
                  Liquidación de Venta & Salida a Matadero
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Unificado
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Venta en pie (vivo) o en canal con cálculo de rendimiento, flete, costos y fin de ciclo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-8 text-center space-y-4 my-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-black text-slate-900 text-lg">
              ¡Liquidación y Venta Registrada con Éxito!
            </h4>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Se asentó la venta de <strong>{saved?.count} animal/es</strong> ({saved?.code}) por un ingreso neto liquidado de{' '}
              <strong className="text-emerald-700">${(saved?.netRevenue ?? 0).toFixed(2)} USD</strong> con utilidad neta de{' '}
              <strong className={(saved?.netProfit ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {(saved?.netProfit ?? 0) >= 0 ? '+' : ''}${(saved?.netProfit ?? 0).toFixed(2)} USD
              </strong>{' '}
              ({(saved?.margin ?? 0).toFixed(1)}% margen) en el Balance de la Granja.
              {saved && saved.remaining > 0
                ? ` Quedan ${saved.remaining} animal(es) activos en el lote.`
                : ' El lote quedó cerrado y sus tareas pendientes canceladas.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 text-sm">No hay animales activos para vender</p>
            <p className="text-slate-500">Registra animales o lotes en el rebaño porcino para poder liquidar una venta.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto text-xs flex-1">
            {/* 1. Modalidad de Venta: En Pie vs En Canal */}
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1.5">
                Modalidad Comercial de Liquidación: <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleModeChange('pie')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    saleMode === 'pie'
                      ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-300 font-bold text-emerald-950 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">Venta en Pie (Animal Vivo)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Liquidación directa por peso en báscula de granja o camión
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-700">🐖</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('canal')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    saleMode === 'canal'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-300 font-bold text-blue-950 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">Venta en Canal (Matadero)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Frigorífico con % rendimiento cárnico y tasa de faenado
                    </span>
                  </div>
                  <span className="text-base font-black text-blue-700">🥩</span>
                </button>
              </div>
            </div>

            {/* 2. Selección de Lote / Animal */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Origen del Ganado & Lote de Salida
              </span>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Seleccionar Animal o Lote del Rebaño: <span className="text-rose-600">*</span>
                </label>
                <select
                  value={selectedAnimalId}
                  onChange={(e) => handleAnimalSelect(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                >
                  {!currentAnimal && <option value="">Selecciona...</option>}
                  {candidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.category.toUpperCase()}) - {headCount(a)} {headCount(a) === 1 ? 'cerdo' : 'cerdos'} - {a.currentWeightKg}kg {a.penLocation ? `[${a.penLocation}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {currentAnimal && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Categoría: <strong className="text-slate-800">{currentAnimal.category}</strong></span>
                  <span>Raza: <strong className="text-slate-800">{currentAnimal.breed || 'Comercial'}</strong></span>
                  <span>Ubicación: <strong className="text-slate-800">{currentAnimal.penLocation || 'Engorde'}</strong></span>
                  <span>Origen: <strong className="text-slate-800">{currentAnimal.origin === 'comprado' ? 'Comprado' : 'Destetado'}</strong></span>
                  <span>Cabezas disponibles: <strong className="text-slate-800">{availableHeads}</strong></span>
                  <span>Costo acumulado del lote: <strong className="text-slate-800">${lotCost.toFixed(2)}</strong></span>
                </div>
              )}
            </div>

            {/* 3. Cantidad, Pesaje y Parámetros */}
            <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Pesaje y Parámetros de Rendimiento
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Cantidad de Animales: <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={availableHeads || undefined}
                    required
                    value={animalsCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnimalsCount(val);
                      const c = parseInt(val, 10);
                      if (Number.isFinite(c) && c > 0 && currentAnimal?.currentWeightKg) {
                        setTotalLiveWeightKg(String(round2(c * currentAnimal.currentWeightKg)));
                      }
                    }}
                    className={`w-full px-2.5 py-1.5 border rounded-xl font-mono font-bold text-slate-900 ${exceedsHeads ? 'border-rose-500 bg-rose-50' : 'border-slate-300'}`}
                  />
                  <span className={`text-[10px] block mt-0.5 ${exceedsHeads ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                    {exceedsHeads ? `Máx. ${availableHeads}` : isTotalSale ? 'venta total del lote' : 'venta parcial'}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Peso Vivo Total (kg): <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={totalLiveWeightKg}
                    onChange={(e) => setTotalLiveWeightKg(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Prom: <strong>{avgWeight.toFixed(1)} kg / cerdo</strong>
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    {saleMode === 'pie' ? 'Precio por kg Vivo ($):' : 'Precio por kg Canal ($):'} <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder={saleMode === 'pie' ? 'Ej. 2.20' : 'Ej. 3.05'}
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-xl font-mono font-bold text-emerald-950 bg-emerald-50/40"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {saleMode === 'pie' ? 'base kg en pie' : 'base kg frío en canal'}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Costo de lo Vendido ($):
                  </label>
                  <div className="w-full px-2.5 py-1.5 border border-slate-200 bg-slate-50 rounded-xl font-mono font-semibold text-slate-800">
                    {costNum.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {countNum > 0 ? `$${(costNum / countNum).toFixed(2)} / cabeza` : '—'} (proporcional)
                  </span>
                </div>
              </div>

              {/* Parámetros Específicos según modalidad */}
              {saleMode === 'pie' ? (
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-600 font-medium">Merma por ayuno / flete (%):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="15"
                      value={shrinkagePercent}
                      onChange={(e) => setShrinkagePercent(e.target.value)}
                      className="w-16 px-2 py-0.5 border border-slate-300 rounded-lg text-center font-bold text-slate-900 bg-white"
                    />
                  </div>
                  <span className="text-slate-500">
                    Peso Neto Liquidable: <strong className="text-slate-900">{netLiveWeightKg.toFixed(1)} kg</strong>
                  </span>
                </div>
              ) : (
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-600 font-semibold block mb-0.5">
                        Rendimiento en Canal (%):
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="50"
                        max="90"
                        value={carcassYieldPercent}
                        onChange={(e) => setCarcassYieldPercent(e.target.value)}
                        className="w-full px-2 py-1 border border-blue-300 rounded-lg font-bold text-slate-900 bg-white"
                      />
                      <span className="text-[9px] text-blue-700 block">Estándar porcino: 76% - 82%</span>
                    </div>

                    <div>
                      <label className="text-slate-600 font-semibold block mb-0.5">
                        Tasa Faenado ($/cabeza):
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                      value={slaughterFeePerAnimal}
                        onChange={(e) => setSlaughterFeePerAnimal(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded-lg font-semibold text-slate-900 bg-white"
                      />
                      <span className="text-[9px] text-slate-500 block">Total: ${totalSlaughterFee.toFixed(2)}</span>
                    </div>

                    <div className="flex flex-col justify-center bg-white p-2 rounded-lg border border-blue-200 text-center">
                      <span className="text-[10px] text-slate-500 block">Peso Total en Canal</span>
                      <strong className="text-sm font-black text-blue-900">
                        {carcassWeightKg.toFixed(1)} kg
                      </strong>
                      <span className="text-[9px] text-slate-400">
                        ({countNum > 0 ? (carcassWeightKg / countNum).toFixed(1) : '0.0'} kg / canal)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Deducción de Flete */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-slate-600 font-medium">Gasto de Flete / Transporte ($):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={transportFeeTotal}
                    onChange={(e) => setTransportFeeTotal(e.target.value)}
                    className="w-20 px-2 py-0.5 border border-slate-300 rounded-lg text-center font-bold text-slate-900 bg-white"
                  />
                </div>
                <span className="text-slate-500 text-[11px]">
                  Total deducciones operativas: <strong>${totalDeductions.toFixed(2)}</strong>
                </span>
              </div>
            </div>

            {/* 4. Resumen de Liquidación Económica (Card Destacado) */}
            <div className="p-4 bg-emerald-950 text-white rounded-2xl shadow-sm border border-emerald-900 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
                <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Liquidación Financiera en Tiempo Real
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {countNum} {countNum === 1 ? 'animal' : 'animales'} • {effectiveCommercialWeightKg.toFixed(1)} kg liquidables
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="bg-emerald-900/60 p-2 rounded-xl border border-emerald-800">
                  <span className="text-[10px] text-emerald-300 block">Ingreso Bruto</span>
                  <strong className="text-sm font-bold text-white">${grossRevenue.toFixed(2)}</strong>
                </div>

                <div className="bg-emerald-900/60 p-2 rounded-xl border border-emerald-800">
                  <span className="text-[10px] text-emerald-300 block">Deducciones</span>
                  <strong className="text-sm font-bold text-rose-300">-${totalDeductions.toFixed(2)}</strong>
                </div>

                <div className="bg-emerald-900/60 p-2 rounded-xl border border-emerald-800">
                  <span className="text-[10px] text-emerald-300 block">Ingreso Neto Granja</span>
                  <strong className="text-base font-black text-emerald-200">${netRevenue.toFixed(2)}</strong>
                </div>

                <div className="bg-emerald-900/60 p-2 rounded-xl border border-emerald-800">
                  <span className="text-[10px] text-emerald-300 block">Ganancia Neta</span>
                  <strong className={`text-base font-black ${netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                    {netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-emerald-200/90 pt-1 border-t border-emerald-800/80">
                <span>Margen de Rentabilidad: <strong className="text-white">{profitMarginPercent.toFixed(1)}%</strong></span>
                <span>Utilidad por Cabeza: <strong className="text-white">${profitPerAnimal.toFixed(2)} / cerdo</strong></span>
                <span>Precio Real Neto: <strong className="text-white">${netPerKgLive.toFixed(2)} / kg vivo</strong></span>
              </div>
            </div>

            {/* 5. Comprador, Documentación y Fin de Ciclo */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Datos del Comprador & Cierre Administrativo
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Comprador / Frigorífico: <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={buyer}
                    onChange={(e) => setBuyer(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                    placeholder="Ej: Frigorífico Central"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    N° Guía Sanitaria / Factura:
                  </label>
                  <input
                    type="text"
                    value={sanitaryDocNumber}
                    onChange={(e) => setSanitaryDocNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono text-slate-900"
                    placeholder="Ej: N° de guía o factura"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Fecha de Despacho / Venta:
                  </label>
                  <input
                    type="date"
                    required
                    max={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Modalidad de Pago:
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    <option value="Transferencia">Transferencia Bancaria Inmediata</option>
                    <option value="Contado">Pago de Contado / Efectivo</option>
                    <option value="Crédito 15 días">Crédito Comercial a 15 días</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Observaciones / Notas de Entrega:
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detalles sobre condición corporal, ayuno o transporte..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              {/* Efecto en el rebaño (lo decide la cantidad vendida) */}
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-700 p-2 rounded-xl bg-slate-50">
                {isTotalSale ? (
                  <>
                    <span className="font-bold block text-slate-900">Venta total: se cierra el ciclo del lote</span>
                    <span className="text-slate-500">
                      El registro pasa a "Matadero", se asienta el evento de trazabilidad, se descuenta del conteo activo y
                      se cancelan sus tareas sanitarias pendientes.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-bold block text-slate-900">Venta parcial</span>
                    <span className="text-slate-500">
                      Se descuentan {countNum} cabeza(s) y su costo proporcional; el lote sigue activo con{' '}
                      {Math.max(0, availableHeads - countNum)} animal(es).
                    </span>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                {error}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || !currentAnimal}
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> {isSaving ? 'Guardando...' : 'Asentar Venta & Liquidación'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
