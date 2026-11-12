import React, { useMemo, useState } from 'react';
import {
  X,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Heart,
  Activity,
  ShoppingBag,
} from 'lucide-react';
import { LactatingLitter, PorcinoAnimal } from '../../types';
import { calculateWeaningProrating } from '../../models/PorcinoCalculations';
import { isActiveLitter, num, round2 } from '../../models/porcinoRules';
import { todayISO, ageInDays } from '../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

export interface WeaningConfirmPayload {
  /** Id de la camada a destetar (obligatorio para registrar el destete en el dominio). */
  litterId?: string;
  /** Fecha del destete (YYYY-MM-DD). */
  date?: string;
  /** Costo adicional de lactancia a prorratear (no genera egreso). */
  additionalLactationCostUsd?: number;
  /** Peso promedio al destete por lechón (kg). */
  averageWeightKg?: number;
  loteLechones: string;
  sowCode: string;
  totalMotherCost: number;
  numPiglets: number;
  costPerPiglet: number;
  actionChoice?: 'granja' | 'venta';
  totalSaleRevenue: number;
  netSaleProfit: number;
  destinedEngorde?: number;
  destinedMadre?: number;
  destinedVerraco?: number;
  destinedVenta?: number;
  teatsCountMadre?: number;
  salePricePerPiglet?: number;
  buyerVenta?: string;
  penEngorde?: string;
  penMadre?: string;
  penVerraco?: string;
}

interface WeaningProratingModalProps {
  onClose: () => void;
  /** Puede devolver un DomainResult para mostrar éxito/error real. */
  onConfirmWeaning: (data: WeaningConfirmPayload) => ModalActionReturn;
  /** Camadas de la granja: solo se ofrecen las que están en lactancia. */
  litters?: LactatingLitter[];
  /** Animales porcinos: se usa para leer el costo del ciclo de la cerda madre. */
  animals?: PorcinoAnimal[];
  /** Camada preseleccionada. */
  preselectedLitterId?: string;
  /** Notifica la camada elegida (opcional). */
  onSelectLitter?: (litterId: string) => void;
}

const intOrZero = (v: number | string) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export const WeaningProratingModal: React.FC<WeaningProratingModalProps> = ({
  onClose,
  onConfirmWeaning,
  litters = [],
  animals = [],
  preselectedLitterId,
  onSelectLitter,
}) => {
  const activeLitters = useMemo(
    () => (litters || []).filter((l) => isActiveLitter(l) && (l.currentCount || 0) > 0),
    [litters]
  );

  const [litterId, setLitterId] = useState<string>(
    () => activeLitters.find((l) => l.id === preselectedLitterId)?.id || activeLitters[0]?.id || ''
  );
  const litter = activeLitters.find((l) => l.id === litterId);
  const available = litter?.currentCount || 0;

  const sow = useMemo(() => {
    if (!litter) return undefined;
    return (animals || []).find(
      (a) => (litter.sowId && a.id === litter.sowId) || (!litter.sowId && a.code === litter.sowCode)
    );
  }, [animals, litter]);

  const [date, setDate] = useState(todayISO());
  const [weanedCount, setWeanedCount] = useState<string>(String(available || ''));
  const [additionalCost, setAdditionalCost] = useState('0');
  const [averageWeight, setAverageWeight] = useState('');

  // Distribución (por defecto todo a engorde)
  const [destinedEngorde, setDestinedEngorde] = useState<number>(available);
  const [destinedMadre, setDestinedMadre] = useState<number>(0);
  const [destinedVerraco, setDestinedVerraco] = useState<number>(0);
  const [destinedVenta, setDestinedVenta] = useState<number>(0);
  const [teatsCountMadre, setTeatsCountMadre] = useState<number>(14);
  const [penEngorde, setPenEngorde] = useState('');
  const [penMadre, setPenMadre] = useState('');
  const [penVerraco, setPenVerraco] = useState('');
  const [salePricePerPiglet, setSalePricePerPiglet] = useState('');
  const [buyerVenta, setBuyerVenta] = useState('');

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDistribution = (count: number) => {
    setDestinedEngorde(count);
    setDestinedMadre(0);
    setDestinedVerraco(0);
    setDestinedVenta(0);
  };

  const handleLitterChange = (id: string) => {
    setLitterId(id);
    const l = activeLitters.find((x) => x.id === id);
    const count = l?.currentCount || 0;
    setWeanedCount(String(count));
    resetDistribution(count);
    setError(null);
    onSelectLitter?.(id);
  };

  const handleWeanedCountChange = (val: string) => {
    setWeanedCount(val);
    resetDistribution(Math.min(intOrZero(val), available));
  };

  const numPiglets = intOrZero(weanedCount);
  const share = available > 0 ? Math.min(1, numPiglets / available) : 0;

  // Mismo criterio que el dominio (weanLitter): costo de la camada + ciclo de la cerda, en proporción
  const litterCostShare = round2(num(litter?.accumulatedCostUsd) * share);
  const sowCycleShare = round2(num(sow?.cycleCostUsd) * share);
  const additional = Math.max(0, toNumber(additionalCost));
  const prorate = calculateWeaningProrating({
    sowAccumulatedCostUsd: litterCostShare + sowCycleShare,
    additionalLactationCostUsd: additional,
    weanedPigletsCount: numPiglets,
  });
  const totalMotherCost = prorate.totalCostToProrate;
  const costPerPiglet = prorate.costPerPiglet;

  const salePrice = Math.max(0, toNumber(salePricePerPiglet));
  const totalSaleRevenue = round2(salePrice * destinedVenta);
  const baseCostSoldPiglets = round2(costPerPiglet * destinedVenta);
  const netSaleProfit = round2(totalSaleRevenue - baseCostSoldPiglets);

  const totalAssigned = destinedEngorde + destinedMadre + destinedVerraco + destinedVenta;
  const totalGranja = destinedEngorde + destinedMadre + destinedVerraco;
  const exceedsAvailable = numPiglets > available;
  const isDistributionValid = numPiglets > 0 && !exceedsAvailable && totalAssigned === numPiglets;
  const isPartial = numPiglets > 0 && numPiglets < available;
  const lactationDays = litter ? ageInDays(litter.birthDate, date) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!litter) {
      setError('Selecciona una camada en lactancia.');
      return;
    }
    if (!isDistributionValid) {
      setError(
        exceedsAvailable
          ? `La camada solo tiene ${available} lechones.`
          : 'La distribución debe sumar el total de lechones a destetar.'
      );
      return;
    }
    if (!date || date > todayISO() || date < litter.birthDate) {
      setError('La fecha de destete debe estar entre el nacimiento de la camada y hoy.');
      return;
    }
    if (destinedVenta > 0 && salePrice <= 0) {
      setError('Indica el precio de venta por lechón.');
      return;
    }
    if (destinedMadre > 0 && (teatsCountMadre < 10 || teatsCountMadre > 22)) {
      setError('La cantidad de pezones debe estar entre 10 y 22.');
      return;
    }
    const weightNum = toNumber(averageWeight);

    setIsSaving(true);
    const res = await runModalAction(() =>
      onConfirmWeaning({
        litterId: litter.id,
        date,
        additionalLactationCostUsd: additional,
        averageWeightKg: weightNum > 0 ? weightNum : undefined,
        loteLechones: litter.batchCode,
        sowCode: litter.sowCode,
        totalMotherCost,
        numPiglets,
        costPerPiglet,
        actionChoice: destinedVenta > 0 && totalGranja === 0 ? 'venta' : 'granja',
        totalSaleRevenue,
        netSaleProfit,
        destinedEngorde,
        destinedMadre,
        destinedVerraco,
        destinedVenta,
        teatsCountMadre: destinedMadre > 0 ? teatsCountMadre : undefined,
        salePricePerPiglet: destinedVenta > 0 ? salePrice : undefined,
        buyerVenta: destinedVenta > 0 ? buyerVenta.trim() || undefined : undefined,
        penEngorde: penEngorde.trim() || undefined,
        penMadre: penMadre.trim() || undefined,
        penVerraco: penVerraco.trim() || undefined,
      })
    );
    setIsSaving(false);
    if (!res.ok) {
      setError(res.error || 'No se pudo registrar el destete.');
      return;
    }
    setIsSubmitted(true);
  };

  const numberInput = (value: number, setter: (n: number) => void, border = 'border-slate-300') => (
    <input
      type="number"
      min="0"
      max={numPiglets || undefined}
      value={value}
      onChange={(e) => setter(intOrZero(e.target.value))}
      className={`w-16 px-2 py-1 border ${border} rounded-lg text-center font-bold text-slate-900 font-mono`}
    />
  );

  return (
    <div
      id="weaning-prorating-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        id="weaning-prorating-card"
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto border border-slate-200"
      >
        {/* Header */}
        <div className="bg-rose-700 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <Calculator className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Prorrateo de Costos & Destete Mixto
              </h3>
              <p className="text-[11px] text-rose-200">
                Distribución entre granja (engorde, madres, verracos) y venta comercial
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rose-200 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-3.5 my-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-black text-slate-900 text-base">¡Destete y Distribución Asentados!</h4>
            <div className="text-xs text-slate-600 space-y-1.5 max-w-sm mx-auto">
              <p>
                Se distribuyeron <strong>{numPiglets} lechones</strong> de la camada{' '}
                <strong>{litter?.batchCode}</strong> con costo prorrateado de{' '}
                <strong className="text-rose-700">${costPerPiglet.toFixed(2)} USD c/u</strong>
                {isPartial ? ' (destete parcial):' : ':'}
              </p>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left text-[11px] space-y-1">
                {destinedEngorde > 0 && <div><strong>{destinedEngorde} cerdos</strong> incorporados a Engorde</div>}
                {destinedMadre > 0 && (
                  <div>
                    <strong>{destinedMadre} cerdas</strong> a Maternidad ({teatsCountMadre} pezones funcionales)
                  </div>
                )}
                {destinedVerraco > 0 && <div><strong>{destinedVerraco} verraco/s</strong> a Reproducción</div>}
                {destinedVenta > 0 && (
                  <div className="text-emerald-700 font-bold">
                    <strong>{destinedVenta} lechones vendidos</strong> (Ingreso: ${totalSaleRevenue.toFixed(2)}, Utilidad:{' '}
                    {netSaleProfit >= 0 ? '+' : ''}${netSaleProfit.toFixed(2)})
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : activeLitters.length === 0 ? (
          <div className="p-8 text-center space-y-3 text-xs">
            <p className="font-bold text-slate-800 text-sm">No hay camadas en lactancia para destetar</p>
            <p className="text-slate-500">Registra un parto para generar una camada.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto text-xs flex-1">
            {/* Camada a Destetar */}
            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-1">
              <label className="block text-slate-800 font-bold text-xs">
                Camada a Destetar: <span className="text-rose-600">*</span>
              </label>
              <select
                value={litterId}
                onChange={(e) => handleLitterChange(e.target.value)}
                className="w-full px-3 py-1.5 border border-rose-300 rounded-xl font-mono font-bold text-slate-900 bg-white"
              >
                {activeLitters.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.batchCode} — Cerda {l.sowCode} — {l.currentCount} vivos ({ageInDays(l.birthDate)} días)
                  </option>
                ))}
              </select>
              {litter && (
                <p className="text-[10px] text-slate-600">
                  Nacida el {litter.birthDate} · {lactationDays} días de lactancia a la fecha del destete
                </p>
              )}
            </div>

            {/* Cantidad y fecha */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Lechones a Destetar: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={available || undefined}
                  required
                  value={weanedCount}
                  onChange={(e) => handleWeanedCountChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-rose-400 bg-rose-50/40 rounded-xl font-bold text-rose-950 font-mono text-center"
                />
                <span className="text-[10px] text-slate-500">Máx. {available}</span>
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Fecha Destete:</label>
                <input
                  type="date"
                  required
                  min={litter?.birthDate}
                  max={todayISO()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Peso Prom. (kg):</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={averageWeight}
                  placeholder={litter?.currentWeightKg ? String(litter.currentWeightKg) : 'Ej. 6.5'}
                  onChange={(e) => setAverageWeight(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>
            </div>

            {/* Costos acumulados reales */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                Costos Acumulados del Ciclo {isPartial && `(proporción ${(share * 100).toFixed(0)}%)`}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Ciclo cerda {litter?.sowCode}</span>
                  <strong className="text-slate-800">${sowCycleShare.toFixed(2)}</strong>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Costos de la camada</span>
                  <strong className="text-slate-800">${litterCostShare.toFixed(2)}</strong>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block">Adicional lactancia ($):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={additionalCost}
                    onChange={(e) => setAdditionalCost(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
              </div>
              {!sow && animals.length > 0 && (
                <p className="text-[10px] text-amber-700">
                  No se encontró la cerda {litter?.sowCode} en el inventario: solo se prorratean los costos de la camada.
                </p>
              )}
              <p className="text-[10px] text-slate-500">
                El costo adicional se prorratea pero no genera un egreso nuevo (ya fue pagado).
              </p>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-xs font-bold text-slate-800">
                <span>Costo Total a Transferir:</span>
                <span className="text-rose-700 font-black text-sm">${totalMotherCost.toFixed(2)} USD</span>
              </div>
            </div>

            {/* Resultado del Prorrateo */}
            <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-700 block">
                  Costo Base Prorrateado por Lechón
                </span>
                <p className="text-[11px] text-slate-600">
                  (${totalMotherCost.toFixed(2)} ÷ {numPiglets || 0} lechones)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-rose-800">
                  {numPiglets > 0 ? `$${costPerPiglet.toFixed(2)}` : '—'}
                </span>
                <span className="text-[10px] text-rose-600 block font-medium">costo base transferido</span>
              </div>
            </div>

            {/* Distribución */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Distribución de Lechones al Destete</h4>
                  <p className="text-[10px] text-slate-500">
                    Reparte los lechones entre los destinos de la granja y/o venta comercial
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isDistributionValid
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border-rose-300'
                  }`}
                >
                  Asignados: {totalAssigned} / {numPiglets}
                </span>
              </div>

              {/* 1. Engorde */}
              <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Engorde (Cerdos de Ceba comercial):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {numberInput(destinedEngorde, setDestinedEngorde)}
                    <span className="text-[10px] text-slate-400">cerdos</span>
                  </div>
                </div>
                {destinedEngorde > 0 && (
                  <input
                    type="text"
                    placeholder="Corral de destino (ej: Galpón Engorde 1 - Corral 4)"
                    value={penEngorde}
                    onChange={(e) => setPenEngorde(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                )}
              </div>

              {/* 2. Madres */}
              <div className="p-2.5 bg-white rounded-xl border border-rose-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    <span>2. Madres (Reproductoras de reemplazo):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {numberInput(destinedMadre, setDestinedMadre)}
                    <span className="text-[10px] text-slate-400">hembras</span>
                  </div>
                </div>
                {destinedMadre > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-rose-100">
                    <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-200">
                      <label className="block text-[10px] font-bold text-rose-900 mb-0.5">
                        Cantidad de Pezones Funcionales: <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="22"
                        required
                        value={teatsCountMadre}
                        onChange={(e) => setTeatsCountMadre(intOrZero(e.target.value))}
                        className="w-full px-2 py-1 border border-rose-300 rounded-md font-mono font-bold text-rose-950 bg-white"
                        placeholder="Ej: 14 o 16"
                      />
                      <span className="text-[9px] text-rose-700 block mt-0.5">Mínimo óptimo: 14 pezones simétricos</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                        Corral de Destino Reemplazo:
                      </label>
                      <input
                        type="text"
                        placeholder="Corral (ej: Galpón Levante Madres Sala 1)"
                        value={penMadre}
                        onChange={(e) => setPenMadre(e.target.value)}
                        className="w-full px-2 py-1 text-[11px] bg-white border border-slate-200 rounded-md text-slate-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Verracos */}
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>3. Verracos (Futuros sementales):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {numberInput(destinedVerraco, setDestinedVerraco)}
                    <span className="text-[10px] text-slate-400">machos</span>
                  </div>
                </div>
                {destinedVerraco > 0 && (
                  <input
                    type="text"
                    placeholder="Corral de destino (ej: Corral Verracos Jóvenes B)"
                    value={penVerraco}
                    onChange={(e) => setPenVerraco(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                  />
                )}
              </div>

              {/* 4. Venta */}
              <div className="p-2.5 bg-white rounded-xl border border-amber-300 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                    <span>4. Venta Comercial de Lechones al Destete:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {numberInput(destinedVenta, setDestinedVenta, 'border-amber-300')}
                    <span className="text-[10px] text-slate-400">lechones</span>
                  </div>
                </div>
                {destinedVenta > 0 && (
                  <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                          Precio Venta / Lechón ($): <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={salePricePerPiglet}
                          placeholder="0.00"
                          onChange={(e) => setSalePricePerPiglet(e.target.value)}
                          className="w-full px-2 py-1 border border-amber-300 rounded-md font-bold text-slate-900 bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                          Cliente / Comprador:
                        </label>
                        <input
                          type="text"
                          value={buyerVenta}
                          onChange={(e) => setBuyerVenta(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded-md text-slate-900 bg-white"
                          placeholder="Nombre del comprador"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center pt-1 text-[11px]">
                      <div className="bg-white p-1.5 rounded-lg border border-amber-200">
                        <span className="text-[9px] text-slate-500 block">Ingreso Venta</span>
                        <strong className="text-emerald-700 font-black">${totalSaleRevenue.toFixed(2)}</strong>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-amber-200">
                        <span className="text-[9px] text-slate-500 block">Costo Asignado</span>
                        <strong className="text-slate-700 font-bold">${baseCostSoldPiglets.toFixed(2)}</strong>
                      </div>
                      <div className="bg-white p-1.5 rounded-lg border border-amber-200">
                        <span className="text-[9px] text-slate-500 block">Utilidad Neta</span>
                        <strong className={`font-black ${netSaleProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {netSaleProfit >= 0 ? '+' : ''}${netSaleProfit.toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {exceedsAvailable && (
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl flex items-center gap-2 text-[11px] font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>La camada solo tiene {available} lechones vivos.</span>
                </div>
              )}
              {!exceedsAvailable && numPiglets > 0 && totalAssigned !== numPiglets && (
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl flex items-center gap-2 text-[11px] font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    La suma distribuida ({totalAssigned}) no coincide con los {numPiglets} lechones a destetar. Faltan o
                    sobran {Math.abs(numPiglets - totalAssigned)}.
                  </span>
                </div>
              )}
              {isPartial && (
                <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  Destete parcial: {available - numPiglets} lechón(es) seguirán en lactancia con la cerda.
                </p>
              )}
            </div>

            {error && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-800">
                {error}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!isDistributionValid || isSaving}
                className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                  isDistributionValid && !isSaving
                    ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Guardando...' : 'Confirmar Destete'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
