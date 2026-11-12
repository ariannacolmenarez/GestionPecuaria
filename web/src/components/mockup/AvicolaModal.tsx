import { newId } from '../../utils/ids';
import React, { useState } from 'react';
import {
  X,
  Bird,
  Plus,
  Scale,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { FinancialMovement, AvicolaLot } from '../../types';

interface AvicolaModalProps {
  onClose: () => void;
  lots?: AvicolaLot[];
  onAddNewLot?: (lot: any) => void;
  onRecordDaily?: (lotCode: string, feedKg: number, mortality: number, weightGrams: number) => void;
  onLiquidate?: (lotCode: string, pricePerKg: number, buyerName: string) => void;
  onAddFinancialMovement?: (movement: FinancialMovement) => void;
  onShowToast?: (msg: string) => void;
}

export const AvicolaModal: React.FC<AvicolaModalProps> = ({
  onClose,
  lots: externalLots,
  onAddNewLot,
  onRecordDaily,
  onLiquidate,
  onAddFinancialMovement,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'lotes' | 'diario' | 'liquidacion' | 'nuevo'>('lotes');
  const [localLots, setLocalLots] = useState([
    {
      code: 'LOTE-ENG-04',
      shed: 'Galpón 2 (Sección Norte)',
      breed: 'Cobb 500',
      initial: 650,
      current: 632,
      age: 40,
      avgWeightGrams: 2350,
      feedTotalKg: 2850,
      fcr: 1.92,
      status: 'Listo para Faena' as const,
    },
    {
      code: 'LOTE-ENG-05',
      shed: 'Galpón 2 (Sección Sur)',
      breed: 'Ross 308 Plus',
      initial: 650,
      current: 618,
      age: 25,
      avgWeightGrams: 1280,
      feedTotalKg: 1350,
      fcr: 1.71,
      status: 'Crecimiento' as const,
    },
  ]);

  const lots = (externalLots && externalLots.length > 0) ? externalLots : localLots;

  // Daily record form
  const [selectedLotForDaily, setSelectedLotForDaily] = useState('LOTE-ENG-04');
  const [dailyFeedKg, setDailyFeedKg] = useState('85');
  const [dailyMortality, setDailyMortality] = useState('1');
  const [sampledWeightGrams, setSampledWeightGrams] = useState('2410');

  // Liquidation form
  const [selectedLotForSale, setSelectedLotForSale] = useState('LOTE-ENG-04');
  const [salePricePerKg, setSalePricePerKg] = useState('1.75');
  const [buyerName, setBuyerName] = useState('Distribuidora Pollo Criollo');

  // New lot form
  const [newBatchCode, setNewBatchCode] = useState('LOTE-ENG-06');
  const [newShed, setNewShed] = useState('Galpón 1');
  const [newLineBreed, setNewLineBreed] = useState('Cobb 500');
  const [newInitialCount, setNewInitialCount] = useState('700');

  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Handle daily record
  const handleDailyRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const feed = parseFloat(dailyFeedKg) || 0;
    const mort = parseInt(dailyMortality, 10) || 0;
    const sampledWeight = parseFloat(sampledWeightGrams) || 2400;

    if (onRecordDaily) {
      onRecordDaily(selectedLotForDaily, feed, mort, sampledWeight);
    } else {
      await apiClient.avicola.recordDailyFeedAndMortality(
        selectedLotForDaily,
        feed,
        mort,
        sampledWeight
      );
    }

    setLocalLots((prev) =>
      prev.map((l) => {
        if (l.code === selectedLotForDaily) {
          const newCurrent = Math.max(0, l.current - mort);
          const newFeed = l.feedTotalKg + feed;
          const biomassKg = (newCurrent * sampledWeight) / 1000;
          const newFcr = biomassKg > 0 ? Math.round((newFeed / biomassKg) * 100) / 100 : l.fcr;
          return {
            ...l,
            current: newCurrent,
            feedTotalKg: newFeed,
            avgWeightGrams: sampledWeight,
            fcr: newFcr,
            age: l.age + 1,
          };
        }
        return l;
      })
    );

    setSuccessMsg(`Registro diario guardado para ${selectedLotForDaily}. Consumo: ${feed} kg. Bajas: ${mort}.`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('lotes');
      if (onShowToast) onShowToast(`Avícola: Registro diario guardado`);
    }, 1800);
  };

  // Handle sale liquidation
  const handleLiquidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const lot = lots.find((l) => l.code === selectedLotForSale);
    if (!lot) return;

    const price = parseFloat(salePricePerKg) || 1.75;
    const totalWeightKg = (lot.current * lot.avgWeightGrams) / 1000;
    const grossIncome = Math.round(totalWeightKg * price * 100) / 100;

    if (onLiquidate) {
      onLiquidate(selectedLotForSale, price, buyerName);
    } else {
      await apiClient.avicola.liquidateLotSale(selectedLotForSale, price, buyerName);

      const movement: FinancialMovement = {
        id: newId('fm-avi-sale'),
        type: 'ingreso',
        concept: `Liquidación Lote Avícola ${lot.code} (${lot.current} aves a ${buyerName})`,
        rubro: 'avicola',
        amount: grossIncome,
        date: new Date().toISOString().split('T')[0],
        category: 'Venta de aves de engorde',
        details: `Peso total: ${totalWeightKg.toFixed(1)} kg. Precio: $${price}/kg. FCR final: ${lot.fcr}.`,
      };

      if (onAddFinancialMovement) {
        onAddFinancialMovement(movement);
      }
    }

    setLocalLots((prev) =>
      prev.map((l) => (l.code === selectedLotForSale ? { ...l, status: 'Liquidado' as const, current: 0 } : l))
    );

    setSuccessMsg(`Lote ${selectedLotForSale} liquidado con éxito. Ingreso generado: +$${grossIncome} USD.`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('lotes');
      if (onShowToast) onShowToast(`Venta avícola: +$${grossIncome} USD`);
    }, 1800);
  };

  // Handle new lot
  const handleCreateNewLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const chicks = parseInt(newInitialCount, 10) || 700;

    const newLotObj = {
      id: newId('av_lot'),
      code: newBatchCode,
      shed: newShed,
      breed: newLineBreed,
      initial: chicks,
      current: chicks,
      age: 1,
      avgWeightGrams: 42,
      feedTotalKg: 0,
      fcr: 1.0,
      status: 'Iniciación' as const,
      startDate: new Date().toISOString().split('T')[0],
    };

    if (onAddNewLot) {
      onAddNewLot(newLotObj);
    } else {
      await apiClient.avicola.createLot({
        batchCode: newBatchCode,
        shedNumber: newShed,
        lineBreed: newLineBreed,
        initialChicks: chicks,
        entryDate: new Date().toISOString().split('T')[0],
      });
    }

    setLocalLots((prev) => [
      ...prev,
      newLotObj,
    ]);

    setSuccessMsg(`Nuevo lote ${newBatchCode} (${chicks} pollitos) iniciado en ${newShed}.`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('lotes');
      if (onShowToast) onShowToast(`Lote ${newBatchCode} creado`);
    }, 1800);
  };

  const totalBirds = lots.reduce((acc, l) => acc + (l.status !== 'Liquidado' ? l.current : 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg">
              🐔
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">Módulo de Gestión Avícola</h3>
              <p className="text-[11px] text-amber-100">Pollos de Engorde, FCR y Monitoreo de Galpones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold px-2 pt-2 gap-1">
          <button
            onClick={() => setActiveTab('lotes')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'lotes'
                ? 'bg-white text-amber-700 shadow-xs border-t-2 border-amber-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lotes Activos ({totalBirds.toLocaleString()})
          </button>
          <button
            onClick={() => setActiveTab('diario')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'diario'
                ? 'bg-white text-amber-700 shadow-xs border-t-2 border-amber-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Registro Diario
          </button>
          <button
            onClick={() => setActiveTab('liquidacion')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'liquidacion'
                ? 'bg-white text-amber-700 shadow-xs border-t-2 border-amber-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Faena / Venta
          </button>
          <button
            onClick={() => setActiveTab('nuevo')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'nuevo'
                ? 'bg-white text-amber-700 shadow-xs border-t-2 border-amber-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Nuevo Lote
          </button>
        </div>

        {/* Success Alert */}
        {isSuccess && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {activeTab === 'lotes' && (
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 text-center">
                  <span className="text-[10px] text-amber-900 font-bold block">TOTAL POLLOS</span>
                  <span className="text-xl font-black text-slate-900">{totalBirds.toLocaleString()}</span>
                  <span className="text-[9px] text-amber-700 block font-medium">Galpón 2 Activo</span>
                </div>
                <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-200/60 text-center">
                  <span className="text-[10px] text-orange-900 font-bold block">FCR PROMEDIO</span>
                  <span className="text-xl font-black text-slate-900">1.81</span>
                  <span className="text-[9px] text-emerald-700 block font-bold">Conversión Óptima</span>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200/60 text-center">
                  <span className="text-[10px] text-rose-900 font-bold block">MORTALIDAD</span>
                  <span className="text-xl font-black text-slate-900">3.8%</span>
                  <span className="text-[9px] text-slate-600 block font-medium">Límite normal &lt; 5%</span>
                </div>
              </div>

              {/* Lotes list */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold text-slate-700 block">Detalle de Lotes de Engorde:</span>
                {lots.map((lot) => (
                  <div
                    key={lot.code}
                    className="p-3 bg-slate-50 hover:bg-amber-50/40 rounded-xl border border-slate-200/80 transition-colors space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{lot.code}</span>
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          {lot.breed}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          lot.status === 'Listo para Faena'
                            ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {lot.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center bg-white p-2 rounded-lg border border-slate-100 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">Aves Vivas</span>
                        <span className="font-black text-slate-900">{lot.current}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Edad</span>
                        <span className="font-bold text-slate-800">{lot.age} días</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">Peso Promedio</span>
                        <span className="font-bold text-amber-800">{lot.avgWeightGrams} g</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">FCR</span>
                        <span className="font-black text-emerald-700">{lot.fcr}</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500">
                      Ubicación: <strong>{lot.shed}</strong> • Alimento acumulado: {lot.feedTotalKg} kg
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'diario' && (
            <form onSubmit={handleDailyRecord} className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <Bird className="w-4 h-4 text-amber-600" /> Registro Diario de Crianza
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Ingresa el alimento consumido y las bajas para recalcular automáticamente el índice de conversión alimenticia (FCR) y la curva de crecimiento.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Seleccionar Lote:</label>
                <select
                  value={selectedLotForDaily}
                  onChange={(e) => setSelectedLotForDaily(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                >
                  {lots.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.code} - {l.breed} ({l.current} aves - {l.shed})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Alimento Consumido (kg):</label>
                  <input
                    type="number"
                    step="1"
                    value={dailyFeedKg}
                    onChange={(e) => setDailyFeedKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mortalidad / Bajas (aves):</label>
                  <input
                    type="number"
                    value={dailyMortality}
                    onChange={(e) => setDailyMortality(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Muestreo Peso Promedio (gramos):</label>
                <input
                  type="number"
                  value={sampledWeightGrams}
                  onChange={(e) => setSampledWeightGrams(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Guardar Registro y Actualizar FCR
              </button>
            </form>
          )}

          {activeTab === 'liquidacion' && (
            <form onSubmit={handleLiquidate} className="space-y-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" /> Liquidación de Lote Listo para Faena
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Despacha el lote a beneficio. Los ingresos se registrarán en la contabilidad general de la explotación pecuaria.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Lote a Liquidar:</label>
                <select
                  value={selectedLotForSale}
                  onChange={(e) => setSelectedLotForSale(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                >
                  {lots.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.code} - {l.current} pollos ({l.avgWeightGrams}g prom)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Precio por kg en pie (USD):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={salePricePerKg}
                    onChange={(e) => setSalePricePerKg(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Comprador / Distribuidor:</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-medium">Biomasa Total Estimada:</span>
                  <span className="font-bold text-slate-900">
                    {((lots.find((l) => l.code === selectedLotForSale)?.current || 632) *
                      ((lots.find((l) => l.code === selectedLotForSale)?.avgWeightGrams || 2350) / 1000)).toFixed(1)}{' '}
                    kg
                  </span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-bold">Ingreso Bruto Calculado:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    $
                    {(
                      ((lots.find((l) => l.code === selectedLotForSale)?.current || 632) *
                        ((lots.find((l) => l.code === selectedLotForSale)?.avgWeightGrams || 2350) / 1000) *
                        (parseFloat(salePricePerKg) || 1.75))
                    ).toFixed(2)}{' '}
                    USD
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar Liquidación y Venta
              </button>
            </form>
          )}

          {activeTab === 'nuevo' && (
            <form onSubmit={handleCreateNewLot} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Código de Lote:</label>
                  <input
                    type="text"
                    value={newBatchCode}
                    onChange={(e) => setNewBatchCode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Galpón Asignado:</label>
                  <input
                    type="text"
                    value={newShed}
                    onChange={(e) => setNewShed(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Línea Genética:</label>
                  <input
                    type="text"
                    value={newLineBreed}
                    onChange={(e) => setNewLineBreed(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Cantidad de Pollitos:</label>
                  <input
                    type="number"
                    value={newInitialCount}
                    onChange={(e) => setNewInitialCount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus className="w-4 h-4" /> Iniciar Nuevo Lote en Galpón
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
