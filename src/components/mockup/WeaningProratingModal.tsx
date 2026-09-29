import React, { useState } from 'react';
import {
  X,
  Calculator,
  ArrowRight,
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Heart,
  Activity,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';

interface WeaningProratingModalProps {
  onClose: () => void;
  onConfirmWeaning: (data: {
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
  }) => void;
}

export const WeaningProratingModal: React.FC<WeaningProratingModalProps> = ({
  onClose,
  onConfirmWeaning,
}) => {
  const [loteLechones, setLoteLechones] = useState('LOTE-LEC-2026-01');
  const [sowCode, setSowCode] = useState('CER-088');
  const [gestationCost, setGestationCost] = useState('210');
  const [lactationCost, setLactationCost] = useState('185');
  const [vetMedicinesCost, setVetMedicinesCost] = useState('45');
  const [weanedCount, setWeanedCount] = useState('14');

  // Unified Distribution State (Requisitos 2 y 3)
  const [destinedEngorde, setDestinedEngorde] = useState<number>(8);
  const [destinedMadre, setDestinedMadre] = useState<number>(2);
  const [destinedVerraco, setDestinedVerraco] = useState<number>(1);
  const [destinedVenta, setDestinedVenta] = useState<number>(3);

  // Teats count for mother destination (Requisito 3)
  const [teatsCountMadre, setTeatsCountMadre] = useState<number>(14);

  // Corrales de destino
  const [penEngorde, setPenEngorde] = useState('Galpón Engorde 1 - Corral 4');
  const [penMadre, setPenMadre] = useState('Galpón Levante Madres Sala 1');
  const [penVerraco, setPenVerraco] = useState('Corral Verracos Jóvenes B');

  // Venta parameters
  const [salePricePerPiglet, setSalePricePerPiglet] = useState('65');
  const [buyerVenta, setBuyerVenta] = useState('Comercializadora AgroPorc C.A.');

  const [isSubmitted, setIsSubmitted] = useState(false);

  // Mother Accumulated Cost Calculation
  const totalMotherCost =
    (parseFloat(gestationCost) || 0) +
    (parseFloat(lactationCost) || 0) +
    (parseFloat(vetMedicinesCost) || 0);

  const numPiglets = parseInt(weanedCount, 10) || 1;
  const costPerPiglet = numPiglets > 0 ? totalMotherCost / numPiglets : 0;

  // Sale calculations for the sold portion
  const salePrice = parseFloat(salePricePerPiglet) || 0;
  const totalSaleRevenue = salePrice * (destinedVenta || 0);
  const baseCostSoldPiglets = costPerPiglet * (destinedVenta || 0);
  const netSaleProfit = totalSaleRevenue - baseCostSoldPiglets;
  const profitMarginPercent = totalSaleRevenue > 0 ? (netSaleProfit / totalSaleRevenue) * 100 : 0;

  // Total allocated piglets
  const totalAssigned =
    (destinedEngorde || 0) +
    (destinedMadre || 0) +
    (destinedVerraco || 0) +
    (destinedVenta || 0);

  const isDistributionValid = totalAssigned === numPiglets;
  const totalGranja = (destinedEngorde || 0) + (destinedMadre || 0) + (destinedVerraco || 0);

  // Automatically adjust default distribution when weanedCount changes
  const handleWeanedCountChange = (val: string) => {
    setWeanedCount(val);
    const parsed = parseInt(val, 10) || 0;
    // Default: prioritize engorde, then leave some for madres and venta
    if (parsed <= 4) {
      setDestinedEngorde(parsed);
      setDestinedMadre(0);
      setDestinedVerraco(0);
      setDestinedVenta(0);
    } else {
      const venta = Math.max(0, Math.floor(parsed * 0.25));
      const madres = Math.max(0, Math.floor(parsed * 0.15));
      const verracos = 0;
      const engorde = parsed - venta - madres - verracos;
      setDestinedEngorde(engorde);
      setDestinedMadre(madres);
      setDestinedVerraco(verracos);
      setDestinedVenta(venta);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDistributionValid) return;

    onConfirmWeaning({
      loteLechones: loteLechones.trim() || 'LOTE-LEC-DESTETE',
      sowCode,
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
      salePricePerPiglet: salePrice,
      buyerVenta,
      penEngorde,
      penMadre,
      penVerraco,
    });

    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };

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
                Se distribuyeron <strong>{numPiglets} lechones</strong> con costo prorrateado de{' '}
                <strong className="text-rose-700">${costPerPiglet.toFixed(2)} USD c/u</strong>:
              </p>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left text-[11px] space-y-1">
                {destinedEngorde > 0 && <div>🐖 <strong>{destinedEngorde} cerdos</strong> incorporados a Engorde</div>}
                {destinedMadre > 0 && <div>🤱 <strong>{destinedMadre} cerdas</strong> a Maternidad ({teatsCountMadre} pezones funcionales)</div>}
                {destinedVerraco > 0 && <div>🐗 <strong>{destinedVerraco} verraco/s</strong> a Reproducción</div>}
                {destinedVenta > 0 && (
                  <div className="text-emerald-700 font-bold">
                    💵 <strong>{destinedVenta} lechones vendidos</strong> (Ingreso: ${totalSaleRevenue.toFixed(2)}, Utilidad: +${netSaleProfit.toFixed(2)})
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto text-xs flex-1">
            {/* Lote de Lechones a Destetar */}
            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-1">
              <label className="block text-slate-800 font-bold text-xs">
                Lote de Lechones a Destetar: <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: LOTE-LEC-2026-01 o CAM-CER088-L1"
                value={loteLechones}
                onChange={(e) => setLoteLechones(e.target.value)}
                className="w-full px-3 py-1.5 border border-rose-300 rounded-xl font-mono font-bold text-slate-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Madre y Camada */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Código Cerda Madre:
                </label>
                <input
                  type="text"
                  value={sowCode}
                  onChange={(e) => setSowCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Total Lechones Vivos a Destetar: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="35"
                  required
                  value={weanedCount}
                  onChange={(e) => handleWeanedCountChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-rose-400 bg-rose-50/40 rounded-xl font-bold text-rose-950 font-mono text-center"
                />
              </div>
            </div>

            {/* Inversión y Gastos de la Madre durante el Ciclo */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                Costos Acumulados Madre (Gestación + Lactancia + Sanidad)
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block">
                    Alim. Gestación ($):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={gestationCost}
                    onChange={(e) => setGestationCost(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block">
                    Alim. Lactancia ($):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lactationCost}
                    onChange={(e) => setLactationCost(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium block">
                    Sanidad / Vacunas ($):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={vetMedicinesCost}
                    onChange={(e) => setVetMedicinesCost(e.target.value)}
                    className="w-full px-2 py-1 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-xs font-bold text-slate-800">
                <span>Costo Total Invertido en la Camada:</span>
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
                  (${totalMotherCost.toFixed(2)} ÷ {numPiglets} lechones)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xl font-black text-rose-800">
                  ${costPerPiglet.toFixed(2)}
                </span>
                <span className="text-[10px] text-rose-600 block font-medium">costo base transferido</span>
              </div>
            </div>

            {/* =========================================================================
                DISTRIBUCIÓN MIXTA: GRANJA (ENGORDE, MADRES, VERRACOS) Y/O VENTA COMERCIAL
            ========================================================================= */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Distribución de Lechones al Destete
                  </h4>
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

              {/* 1. Destino Engorde */}
              <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <Layers className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Engorde (Cerdos de Ceba comercial):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={numPiglets}
                      value={destinedEngorde}
                      onChange={(e) => setDestinedEngorde(parseInt(e.target.value, 10) || 0)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-mono"
                    />
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

              {/* 2. Destino Futuras Madres CON CANTIDAD DE PEZONES */}
              <div className="p-2.5 bg-white rounded-xl border border-rose-200 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <Heart className="w-3.5 h-3.5 text-rose-600" />
                    <span>2. Madres (Reproductoras de reemplazo):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={numPiglets}
                      value={destinedMadre}
                      onChange={(e) => setDestinedMadre(parseInt(e.target.value, 10) || 0)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">hembras</span>
                  </div>
                </div>

                {destinedMadre > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-rose-100">
                    {/* Requisito 3: Cantidad de pezones */}
                    <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-200">
                      <label className="block text-[10px] font-bold text-rose-900 mb-0.5">
                        🍼 Cantidad de Pezones Funcionales: <span className="text-rose-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="22"
                        required
                        value={teatsCountMadre}
                        onChange={(e) => setTeatsCountMadre(parseInt(e.target.value, 10) || 14)}
                        className="w-full px-2 py-1 border border-rose-300 rounded-md font-mono font-bold text-rose-950 bg-white"
                        placeholder="Ej: 14 o 16"
                      />
                      <span className="text-[9px] text-rose-700 block mt-0.5">
                        Mínimo óptimo: 14 pezones simétricos
                      </span>
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

              {/* 3. Destino Futuros Verracos */}
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span>3. Verracos (Futuros sementales):</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={numPiglets}
                      value={destinedVerraco}
                      onChange={(e) => setDestinedVerraco(parseInt(e.target.value, 10) || 0)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-mono"
                    />
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

              {/* 4. Venta Comercial de Lechones (Requisito 2) */}
              <div className="p-2.5 bg-white rounded-xl border border-amber-300 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                    <span>4. Venta Comercial de Lechones al Destete:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max={numPiglets}
                      value={destinedVenta}
                      onChange={(e) => setDestinedVenta(parseInt(e.target.value, 10) || 0)}
                      className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-center font-bold text-slate-900 font-mono"
                    />
                    <span className="text-[10px] text-slate-400">lechones</span>
                  </div>
                </div>

                {destinedVenta > 0 && (
                  <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-700 block mb-0.5">
                          Precio Venta / Lechón ($):
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={salePricePerPiglet}
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

              {!isDistributionValid && (
                <div className="p-2.5 bg-rose-100 text-rose-800 rounded-xl flex items-center gap-2 text-[11px] font-bold animate-pulse">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>
                    La suma distribuida ({totalAssigned}) no coincide con los {numPiglets} lechones destetados. Faltan o sobran {Math.abs(numPiglets - totalAssigned)}.
                  </span>
                </div>
              )}
            </div>

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
                disabled={!isDistributionValid}
                className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                  isDistributionValid
                    ? 'bg-rose-700 hover:bg-rose-800 text-white cursor-pointer'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                Confirmar Destete <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
