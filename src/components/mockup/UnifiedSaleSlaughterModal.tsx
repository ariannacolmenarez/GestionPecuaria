import React, { useState } from 'react';
import {
  X,
  Scale,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Truck,
  ShieldCheck,
  FileText,
  Layers,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { PorcinoAnimal, UnifiedSaleResult } from '../../types';

interface UnifiedSaleSlaughterModalProps {
  animals?: PorcinoAnimal[];
  preselectedAnimalCode?: string;
  initialCategory?: string;
  onClose: () => void;
  onConfirmSaleSlaughter: (result: UnifiedSaleResult) => void;
}

export const UnifiedSaleSlaughterModal: React.FC<UnifiedSaleSlaughterModalProps> = ({
  animals = [],
  preselectedAnimalCode,
  initialCategory,
  onClose,
  onConfirmSaleSlaughter,
}) => {
  // Preselected animal check or safe filter
  const preselected = animals.find((a) => a.code === preselectedAnimalCode);
  const filterCandidates = animals.filter(
    (a) => a.healthStatus !== 'Matadero' && !a.isSoldToSlaughter
  );
  const safeList =
    preselected && !filterCandidates.some((a) => a.id === preselected.id)
      ? [preselected, ...filterCandidates]
      : filterCandidates.length > 0
      ? filterCandidates
      : animals;

  // Selected animal ID
  const initialSelected =
    (preselectedAnimalCode ? safeList.find((a) => a.code === preselectedAnimalCode) : null) ||
    (initialCategory ? safeList.find((a) => a.category === initialCategory) : null) ||
    safeList[0];
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>(initialSelected?.id || '');

  const currentAnimal = safeList.find((a) => a.id === selectedAnimalId) || initialSelected;

  // Mode: En Pie vs En Canal
  const [saleMode, setSaleMode] = useState<'pie' | 'canal'>('pie');

  // Basic Details
  const [date, setDate] = useState('2026-08-19');
  const [customLotCode, setCustomLotCode] = useState(currentAnimal?.code || 'ENG-302');
  const [buyer, setBuyer] = useState('Frigorífico Industrial Porcino C.A.');
  const [sanitaryDocNumber, setSanitaryDocNumber] = useState('GUIA-SANI-2026-8921');
  const [paymentMethod, setPaymentMethod] = useState<'Contado' | 'Transferencia' | 'Crédito 15 días'>('Transferencia');

  // Quantity of animals
  const defaultQuantity = currentAnimal?.batchAnimalCount || (currentAnimal?.category === 'verracos' ? 1 : 20);
  const [animalsCount, setAnimalsCount] = useState<string>(defaultQuantity.toString());

  // Weights
  // If batch, total weight = count * avg weight, or individual weight
  const initialWeight = currentAnimal?.currentWeightKg || 105;
  const initialTotalWeight = (defaultQuantity > 1 ? defaultQuantity * initialWeight : initialWeight);
  const [totalLiveWeightKg, setTotalLiveWeightKg] = useState<string>(initialTotalWeight.toString());
  const [shrinkagePercent, setShrinkagePercent] = useState<string>('0'); // % merma de desbaste por transporte/ayuno (0 a 5%)

  // Canal specific
  const [carcassYieldPercent, setCarcassYieldPercent] = useState<string>('78'); // % rendimiento en canal frigorífico
  const [slaughterFeePerAnimal, setSlaughterFeePerAnimal] = useState<string>('4.50'); // Tasa de faenado/matadero por cabeza ($)

  // Prices
  const [pricePerKg, setPricePerKg] = useState<string>('2.20'); // $/kg vivo (o $/kg canal)

  // Additional expenses
  const [transportFeeTotal, setTransportFeeTotal] = useState<string>('25'); // Flete / transporte ($)

  // Production Cost
  const defaultCost = currentAnimal?.accumulatedCostUsd || 115;
  const initialTotalCost = (defaultQuantity > 1 && defaultCost < 300 ? defaultCost * defaultQuantity : defaultCost);
  const [accumulatedCost, setAccumulatedCost] = useState<string>(initialTotalCost.toString());

  // Life-cycle
  const [markAsSlaughtered, setMarkAsSlaughtered] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // When animal selection changes
  const handleAnimalSelect = (animalId: string) => {
    setSelectedAnimalId(animalId);
    const chosen = safeList.find((a) => a.id === animalId);
    if (!chosen) return;

    setCustomLotCode(chosen.code);
    const count = chosen.batchAnimalCount || (chosen.category === 'verracos' ? 1 : 20);
    setAnimalsCount(count.toString());

    const totalWeight = count > 1 ? count * chosen.currentWeightKg : chosen.currentWeightKg;
    setTotalLiveWeightKg(totalWeight.toString());

    const costUnit = chosen.accumulatedCostUsd || 110;
    const totalCost = count > 1 && costUnit < 300 ? costUnit * count : costUnit;
    setAccumulatedCost(totalCost.toString());
  };

  // Numerical Calculations
  const countNum = Math.max(1, parseInt(animalsCount, 10) || 1);
  const liveWeightNum = Math.max(0, parseFloat(totalLiveWeightKg) || 0);
  const avgWeight = countNum > 0 ? liveWeightNum / countNum : 0;
  const shrinkageNum = Math.max(0, parseFloat(shrinkagePercent) || 0);
  const priceNum = Math.max(0, parseFloat(pricePerKg) || 0);
  const yieldNum = Math.max(1, parseFloat(carcassYieldPercent) || 78);
  const slaughterFeeUnit = Math.max(0, parseFloat(slaughterFeePerAnimal) || 0);
  const transportNum = Math.max(0, parseFloat(transportFeeTotal) || 0);
  const costNum = Math.max(0, parseFloat(accumulatedCost) || 0);

  // Effective live weight after shrinkage
  const netLiveWeightKg = liveWeightNum * (1 - shrinkageNum / 100);

  // Carcass weight if applicable
  const carcassWeightKg = netLiveWeightKg * (yieldNum / 100);

  // Effective commercial weight depending on mode
  const effectiveCommercialWeightKg = saleMode === 'pie' ? netLiveWeightKg : carcassWeightKg;

  // Gross Revenue
  const grossRevenue = effectiveCommercialWeightKg * priceNum;

  // Deductions: slaughter fee (if canal) + transport
  const totalSlaughterFee = saleMode === 'canal' ? slaughterFeeUnit * countNum : 0;
  const totalDeductions = totalSlaughterFee + transportNum;

  // Net Revenue received by farm
  const netRevenue = Math.max(0, grossRevenue - totalDeductions);

  // Net Profit & Margin
  const netProfit = netRevenue - costNum;
  const profitMarginPercent = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const profitPerAnimal = countNum > 0 ? netProfit / countNum : 0;
  const netPerKgLive = liveWeightNum > 0 ? netRevenue / liveWeightNum : 0;

  // Mode change handler
  const handleModeChange = (newMode: 'pie' | 'canal') => {
    setSaleMode(newMode);
    if (newMode === 'pie') {
      setPricePerKg('2.20');
    } else {
      setPricePerKg('3.05');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result: UnifiedSaleResult = {
      animalId: currentAnimal?.id,
      animalCode: customLotCode.trim() || currentAnimal?.code || 'LOTE-PORCINO',
      category: currentAnimal?.category || 'engorde',
      saleMode,
      date,
      animalsCount: countNum,
      totalLiveWeightKg: liveWeightNum,
      averageLiveWeightKg: avgWeight,
      carcassYieldPercent: saleMode === 'canal' ? yieldNum : undefined,
      carcassWeightKg: saleMode === 'canal' ? carcassWeightKg : undefined,
      pricePerKg: priceNum,
      slaughterFeeUsd: totalSlaughterFee,
      transportFeeUsd: transportNum,
      grossRevenueUsd: grossRevenue,
      totalDeductionsUsd: totalDeductions,
      netRevenueUsd: netRevenue,
      accumulatedCostUsd: costNum,
      netProfitUsd: netProfit,
      profitMarginPercent,
      buyer,
      sanitaryDocNumber,
      paymentMethod,
      markAsSlaughtered,
      notes,
    };

    onConfirmSaleSlaughter(result);
    setIsSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
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
              Se asentó la venta de <strong>{countNum} animal/es</strong> ({customLotCode}) por un ingreso neto liquidado de{' '}
              <strong className="text-emerald-700">${netRevenue.toFixed(2)} USD</strong> con utilidad neta de{' '}
              <strong className="text-emerald-700">+${netProfit.toFixed(2)} USD</strong> ({profitMarginPercent.toFixed(1)}% margen) en el Balance de la Granja.
            </p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Seleccionar Animal o Lote del Rebaño:
                  </label>
                  <select
                    value={selectedAnimalId}
                    onChange={(e) => handleAnimalSelect(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-900 bg-white"
                  >
                    {safeList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} ({a.category.toUpperCase()}) - {a.batchAnimalCount || 1} cerdos - {a.currentWeightKg}kg {a.penLocation ? `[${a.penLocation}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Código Identificador / Lote:
                  </label>
                  <input
                    type="text"
                    required
                    value={customLotCode}
                    onChange={(e) => setCustomLotCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
                    placeholder="Ej: ENG-302 o LOTE-ENG-14"
                  />
                </div>
              </div>

              {currentAnimal && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                  <span>Categoría: <strong className="text-slate-800">{currentAnimal.category}</strong></span>
                  <span>Raza: <strong className="text-slate-800">{currentAnimal.breed || 'Comercial'}</strong></span>
                  <span>Ubicación: <strong className="text-slate-800">{currentAnimal.penLocation || 'Engorde'}</strong></span>
                  <span>Origen: <strong className="text-slate-800">{currentAnimal.origin === 'comprado' ? 'Comprado' : 'Destetado'}</strong></span>
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
                    required
                    value={animalsCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnimalsCount(val);
                      const c = parseInt(val, 10) || 1;
                      if (currentAnimal?.currentWeightKg) {
                        setTotalLiveWeightKg((c * currentAnimal.currentWeightKg).toString());
                      }
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">cerdos a despachar</span>
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
                    Costo Total Prod. ($):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={accumulatedCost}
                    onChange={(e) => setAccumulatedCost(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-mono font-semibold text-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ${(costNum / countNum).toFixed(1)} / cabeza
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
                        ({(carcassWeightKg / countNum).toFixed(1)} kg / canal)
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
                    placeholder="Ej: GUIA-2026-8921"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Fecha de Despacho / Venta:
                  </label>
                  <input
                    type="date"
                    required
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

              {/* Checkbox para dar de baja / salida por matadero en rebaño */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={markAsSlaughtered}
                    onChange={(e) => setMarkAsSlaughtered(e.target.checked)}
                    className="mt-0.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-700">
                    <span className="font-bold block text-slate-900">
                      Dar salida por matadero / venta y cerrar ciclo del lote en el rebaño
                    </span>
                    <span className="text-slate-500">
                      Actualiza el estado zoosanitario a "Matadero", asienta el evento de trazabilidad y descuenta los animales del conteo activo.
                    </span>
                  </div>
                </label>
              </div>
            </div>

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
                className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Asentar Venta & Liquidación
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
