import React, { useMemo, useRef, useState } from 'react';
import { Calculator, CheckCircle2, AlertTriangle, Layers, Heart, Activity, ShoppingBag, Plus, PiggyBank } from 'lucide-react';
import { LactatingLitter, PorcinoAnimal } from '../../types';
import { calculateWeaningProrating } from '../../models/PorcinoCalculations';
import { isActiveLitter, num, round2 } from '../../models/porcinoRules';
import { todayISO, ageInDays } from '../../utils/dates';
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
  /** Animales porcinos: se usa para leer el costo del ciclo de la cerda madre y los corrales existentes. */
  animals?: PorcinoAnimal[];
  /** Camada preseleccionada. */
  preselectedLitterId?: string;
  /** Notifica la camada elegida (opcional). */
  onSelectLitter?: (litterId: string) => void;
  /** Opcional: enlace "Ver cerdos" en la pantalla de éxito (lo cablea el menú porcino). */
  onViewHerd?: () => void;
}

const intOrZero = (v: number | string) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

type FieldKey = 'litter' | 'count' | 'date' | 'dist' | 'price' | 'teats';

export const WeaningProratingModal: React.FC<WeaningProratingModalProps> = ({
  onClose,
  onConfirmWeaning,
  litters = [],
  animals = [],
  preselectedLitterId,
  onSelectLitter,
  onViewHerd,
}) => {
  const activeLitters = useMemo(
    () => (litters || []).filter((l) => isActiveLitter(l) && (l.currentCount || 0) > 0),
    [litters]
  );

  // Corrales ya usados en la granja (para elegir en vez de escribir)
  const pens = useMemo(
    () =>
      Array.from(new Set((animals || []).map((a) => (a.penLocation || '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [animals]
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
  const [additionalCost, setAdditionalCost] = useState('');
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
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

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
    setErrors({});
    setFormError(null);
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

  const dirty =
    !isSubmitted &&
    (additionalCost !== '' ||
      averageWeight !== '' ||
      penEngorde.trim() !== '' ||
      penMadre.trim() !== '' ||
      penVerraco.trim() !== '' ||
      salePricePerPiglet !== '' ||
      buyerVenta.trim() !== '' ||
      destinedMadre > 0 ||
      destinedVerraco > 0 ||
      destinedVenta > 0 ||
      weanedCount !== String(available || ''));
  const { requestClose, confirmDialog } = useBackClose(true, onClose, dirty);
  const firstError = (Object.values(errors) as (string | undefined)[]).find(Boolean) || null;
  useFocusFirstInvalid(formRef, firstError, attempt);

  const resetForm = () => {
    const next = activeLitters.find((l) => l.id !== litterId) || activeLitters[0];
    const count = next?.currentCount || 0;
    setLitterId(next?.id || '');
    setWeanedCount(String(count || ''));
    resetDistribution(count);
    setDate(todayISO());
    setAdditionalCost('');
    setAverageWeight('');
    setTeatsCountMadre(14);
    setPenEngorde('');
    setPenMadre('');
    setPenVerraco('');
    setSalePricePerPiglet('');
    setBuyerVenta('');
    setErrors({});
    setFormError(null);
    setIsSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Partial<Record<FieldKey, string>> = {};
    if (!litter) errs.litter = 'Elige una camada que esté criando.';
    if (numPiglets <= 0) errs.count = 'Escribe cuántos lechones vas a destetar.';
    else if (exceedsAvailable) errs.count = `La camada solo tiene ${available} lechones.`;
    if (!date || date > todayISO() || (litter && date < litter.birthDate))
      errs.date = 'La fecha debe estar entre el nacimiento de la camada y hoy.';
    if (numPiglets > 0 && !exceedsAvailable && totalAssigned !== numPiglets)
      errs.dist = `Repartiste ${totalAssigned} de ${numPiglets} lechones. ${
        totalAssigned < numPiglets ? `Faltan ${numPiglets - totalAssigned}.` : `Sobran ${totalAssigned - numPiglets}.`
      }`;
    if (destinedMadre > 0 && (teatsCountMadre < 10 || teatsCountMadre > 22)) errs.teats = 'Los pezones deben estar entre 10 y 22.';
    if (destinedVenta > 0 && salePrice <= 0) errs.price = 'Escribe el precio de venta por lechón.';
    setErrors(errs);
    setAttempt((n) => n + 1);
    if (Object.keys(errs).length > 0 || !litter || !isDistributionValid) return;

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
      setFormError(res.error || 'No se pudo registrar el destete.');
      return;
    }
    setIsSubmitted(true);
  };

  const countInput = (id: string, label: string, value: number, setter: (n: number) => void) => (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min="0"
      max={numPiglets || undefined}
      value={value || ''}
      placeholder="0"
      aria-label={label}
      onChange={(e) => setter(intOrZero(e.target.value))}
      className={`${inputClass} !w-20 text-center font-bold`}
    />
  );

  const penInput = (id: string, value: string, setter: (v: string) => void, placeholder: string) => (
    <div>
      <FieldLabel htmlFor={id} hint={pens.length > 0 ? 'Toca para elegir un corral existente o escribe uno nuevo.' : undefined}>
        Corral de destino
      </FieldLabel>
      <input
        id={id}
        type="text"
        list="weaning-pens"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setter(e.target.value)}
        className={inputClass}
      />
    </div>
  );

  const destRow = (
    icon: React.ReactNode,
    title: string,
    unit: string,
    tone: string,
    inputId: string,
    value: number,
    setter: (n: number) => void,
    extra?: React.ReactNode
  ) => (
    <div className={`p-3 bg-white rounded-xl border space-y-2.5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-bold text-slate-900">
          {icon}
          <span>{title}</span>
        </label>
        <div className="flex items-center gap-1.5 shrink-0">
          {countInput(inputId, title, value, setter)}
          <span className="text-xs text-slate-600 w-14">{unit}</span>
        </div>
      </div>
      {value > 0 && extra}
    </div>
  );

  return (
    <Overlay className="bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onBackdrop={requestClose}>
      <div
        id="weaning-prorating-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="weaning-title"
        className="relative bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        <ModalHeader
          rubro="porcino"
          icon={<Calculator />}
          titleId="weaning-title"
          title="Destete"
          subtitle="Separa los lechones de la madre y decide a dónde van"
          onClose={requestClose}
        />

        {pens.length > 0 && (
          <datalist id="weaning-pens">
            {pens.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}

        {isSubmitted ? (
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Destete registrado</h3>
            <div className="text-sm text-slate-700 space-y-2 max-w-sm mx-auto">
              <p>
                <strong>{numPiglets} lechones</strong> de la camada <strong>{litter?.batchCode}</strong>, con un costo de{' '}
                <strong className="text-rose-700">${costPerPiglet.toFixed(2)} cada uno</strong>
                {isPartial ? ' (destete parcial):' : ':'}
              </p>
              <ul className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-left space-y-1">
                {destinedEngorde > 0 && <li><strong>{destinedEngorde}</strong> a engorde</li>}
                {destinedMadre > 0 && (
                  <li>
                    <strong>{destinedMadre}</strong> a futuras madres ({teatsCountMadre} pezones)
                  </li>
                )}
                {destinedVerraco > 0 && <li><strong>{destinedVerraco}</strong> a futuros verracos</li>}
                {destinedVenta > 0 && (
                  <li className="text-emerald-800">
                    <strong>{destinedVenta}</strong> vendidos: cobro ${totalSaleRevenue.toFixed(2)}, ganancia{' '}
                    {netSaleProfit >= 0 ? '+' : ''}${netSaleProfit.toFixed(2)}
                  </li>
                )}
              </ul>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              {activeLitters.some((l) => l.id !== litterId) && (
                <Btn rubro="porcino" size="lg" block icon={<Plus />} onClick={resetForm}>
                  Destetar otra camada
                </Btn>
              )}
              {onViewHerd && (
                <Btn variant="secondary" size="lg" block icon={<PiggyBank />} onClick={onViewHerd}>
                  Ver cerdos
                </Btn>
              )}
              <Btn variant="ghost" size="lg" block onClick={onClose}>
                Cerrar
              </Btn>
            </div>
          </div>
        ) : activeLitters.length === 0 ? (
          <div className="p-6 text-center space-y-3">
            <p className="font-bold text-slate-900 text-base">No hay camadas para destetar</p>
            <p className="text-sm text-slate-600">Registra un parto para tener una camada criando.</p>
            <Btn variant="secondary" size="lg" block onClick={onClose}>
              Cerrar
            </Btn>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Camada */}
              <div>
                <FieldLabel htmlFor="wp-litter">Camada *</FieldLabel>
                <select
                  id="wp-litter"
                  value={litterId}
                  onChange={(e) => handleLitterChange(e.target.value)}
                  aria-invalid={!!errors.litter}
                  aria-describedby={errors.litter ? 'wp-litter-err' : undefined}
                  className={fieldClass(!!errors.litter, 'font-semibold')}
                >
                  {activeLitters.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.batchCode} · cerda {l.sowCode} · {l.currentCount} vivos ({ageInDays(l.birthDate)} días)
                    </option>
                  ))}
                </select>
                <FieldError id="wp-litter-err" error={errors.litter} />
                {litter && (
                  <p className="text-xs text-slate-600 mt-1">
                    Nació el {litter.birthDate} · {lactationDays} días con la madre a la fecha del destete
                  </p>
                )}
              </div>

              {/* Cantidad, fecha y peso */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel htmlFor="wp-count" hint={`Máximo ${available}`}>
                    Lechones a destetar *
                  </FieldLabel>
                  <input
                    id="wp-count"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={available || undefined}
                    value={weanedCount}
                    onChange={(e) => handleWeanedCountChange(e.target.value)}
                    aria-invalid={!!errors.count}
                    aria-describedby={errors.count ? 'wp-count-err' : undefined}
                    className={fieldClass(!!errors.count, 'font-bold text-center')}
                  />
                  <FieldError id="wp-count-err" error={errors.count} />
                </div>
                <div>
                  <FieldLabel htmlFor="wp-date" hint="Hoy o antes">
                    Fecha *
                  </FieldLabel>
                  <input
                    id="wp-date"
                    type="date"
                    min={litter?.birthDate}
                    max={todayISO()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-invalid={!!errors.date}
                    aria-describedby={errors.date ? 'wp-date-err' : undefined}
                    className={fieldClass(!!errors.date)}
                  />
                  <FieldError id="wp-date-err" error={errors.date} />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="wp-weight">Peso promedio por lechón (kg, opcional)</FieldLabel>
                <input
                  id="wp-weight"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  value={averageWeight}
                  placeholder={litter?.currentWeightKg ? String(litter.currentWeightKg) : 'Ej. 6.5'}
                  onChange={(e) => setAverageWeight(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Reparto de lechones */}
              <fieldset
                data-invalid={errors.dist ? 'true' : undefined}
                tabIndex={errors.dist ? -1 : undefined}
                aria-describedby={errors.dist ? 'wp-dist-err' : undefined}
                className={`p-3 bg-slate-50 rounded-2xl space-y-2.5 border-2 ${errors.dist ? 'border-rose-500' : 'border-slate-200'}`}
              >
                <legend className="px-1 text-sm font-bold text-slate-900">¿A dónde va cada lechón?</legend>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-600">Reparte los lechones entre la granja y la venta.</p>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                      isDistributionValid
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}
                  >
                    {totalAssigned} de {numPiglets}
                  </span>
                </div>

                {destRow(
                  <Layers className="w-4 h-4 text-emerald-700" aria-hidden="true" />,
                  'Engorde',
                  'cerdos',
                  'border-emerald-200',
                  'wp-engorde',
                  destinedEngorde,
                  setDestinedEngorde,
                  penInput('wp-pen-engorde', penEngorde, setPenEngorde, 'Ej. Galpón engorde 1')
                )}

                {destRow(
                  <Heart className="w-4 h-4 text-rose-700" aria-hidden="true" />,
                  'Futuras madres',
                  'hembras',
                  'border-rose-200',
                  'wp-madre',
                  destinedMadre,
                  setDestinedMadre,
                  <div className="space-y-2.5 pt-2 border-t border-rose-100">
                    <div>
                      <FieldLabel htmlFor="wp-teats" hint="Lo ideal: 14 o más, parejos">
                        Pezones que funcionan *
                      </FieldLabel>
                      <input
                        id="wp-teats"
                        type="number"
                        inputMode="numeric"
                        min="10"
                        max="22"
                        value={teatsCountMadre || ''}
                        onChange={(e) => setTeatsCountMadre(intOrZero(e.target.value))}
                        aria-invalid={!!errors.teats}
                        aria-describedby={errors.teats ? 'wp-teats-err' : undefined}
                        className={fieldClass(!!errors.teats, 'font-bold')}
                        placeholder="Ej. 14"
                      />
                      <FieldError id="wp-teats-err" error={errors.teats} />
                    </div>
                    {penInput('wp-pen-madre', penMadre, setPenMadre, 'Ej. Sala madres 1')}
                  </div>
                )}

                {destRow(
                  <Activity className="w-4 h-4 text-sky-700" aria-hidden="true" />,
                  'Futuros verracos',
                  'machos',
                  'border-sky-200',
                  'wp-verraco',
                  destinedVerraco,
                  setDestinedVerraco,
                  penInput('wp-pen-verraco', penVerraco, setPenVerraco, 'Ej. Corral verracos jóvenes')
                )}

                {destRow(
                  <ShoppingBag className="w-4 h-4 text-amber-700" aria-hidden="true" />,
                  'Vender ahora',
                  'lechones',
                  'border-amber-300',
                  'wp-venta',
                  destinedVenta,
                  setDestinedVenta,
                  <div className="space-y-2.5 pt-2 border-t border-amber-100">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <FieldLabel htmlFor="wp-price">Precio por lechón ($) *</FieldLabel>
                        <input
                          id="wp-price"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={salePricePerPiglet}
                          placeholder="0.00"
                          onChange={(e) => setSalePricePerPiglet(e.target.value)}
                          aria-invalid={!!errors.price}
                          aria-describedby={errors.price ? 'wp-price-err' : undefined}
                          className={fieldClass(!!errors.price, 'font-bold')}
                        />
                        <FieldError id="wp-price-err" error={errors.price} />
                      </div>
                      <div>
                        <FieldLabel htmlFor="wp-buyer">Comprador</FieldLabel>
                        <input
                          id="wp-buyer"
                          type="text"
                          value={buyerVenta}
                          onChange={(e) => setBuyerVenta(e.target.value)}
                          className={inputClass}
                          placeholder="Nombre"
                        />
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <dt className="text-xs text-slate-700">Cobro</dt>
                        <dd className="text-sm font-bold text-emerald-800">${totalSaleRevenue.toFixed(2)}</dd>
                      </div>
                      <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <dt className="text-xs text-slate-700">Lo que costaron</dt>
                        <dd className="text-sm font-bold text-slate-800">${baseCostSoldPiglets.toFixed(2)}</dd>
                      </div>
                      <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                        <dt className="text-xs text-slate-700">Ganancia</dt>
                        <dd className={`text-sm font-bold ${netSaleProfit >= 0 ? 'text-emerald-800' : 'text-rose-700'}`}>
                          {netSaleProfit >= 0 ? '+' : ''}${netSaleProfit.toFixed(2)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                <FieldError id="wp-dist-err" error={errors.dist} />
                {!errors.dist && !exceedsAvailable && numPiglets > 0 && totalAssigned !== numPiglets && (
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Repartiste {totalAssigned} de {numPiglets}.{' '}
                    {totalAssigned < numPiglets ? `Faltan ${numPiglets - totalAssigned}.` : `Sobran ${totalAssigned - numPiglets}.`}
                  </p>
                )}
                {isPartial && (
                  <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    Destete parcial: {available - numPiglets} lechón(es) se quedan con la madre.
                  </p>
                )}
              </fieldset>

              {/* Costo por lechón */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900">
                  Costo de cada lechón {isPartial && `(se toma el ${(share * 100).toFixed(0)}%)`}
                </h3>
                <dl className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <dt className="text-xs text-slate-600">Gastos de la cerda {litter?.sowCode}</dt>
                    <dd className="text-sm font-bold text-slate-900">${sowCycleShare.toFixed(2)}</dd>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <dt className="text-xs text-slate-600">Gastos de la camada</dt>
                    <dd className="text-sm font-bold text-slate-900">${litterCostShare.toFixed(2)}</dd>
                  </div>
                </dl>
                <div>
                  <FieldLabel htmlFor="wp-extra" hint="Ya pagado: se reparte entre los lechones, no se anota como gasto nuevo.">
                    Otros gastos de la cría ($, opcional)
                  </FieldLabel>
                  <input
                    id="wp-extra"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={additionalCost}
                    onChange={(e) => setAdditionalCost(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {!sow && animals.length > 0 && (
                  <p className="text-xs text-amber-800">
                    No se encontró la cerda {litter?.sowCode}: solo se reparten los gastos de la camada.
                  </p>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="text-sm text-slate-700">
                    Total ${totalMotherCost.toFixed(2)} ÷ {numPiglets || 0} lechones
                  </span>
                  <span className="text-lg font-bold text-rose-800">
                    {numPiglets > 0 ? `$${costPerPiglet.toFixed(2)} c/u` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 space-y-2">
              <ErrorBox error={formError} />
              <div className="flex gap-2.5">
                <Btn variant="secondary" size="lg" onClick={requestClose} className="flex-1">
                  Cancelar
                </Btn>
                <Btn type="submit" rubro="porcino" size="lg" disabled={isSaving} className="flex-[2]">
                  {isSaving ? 'Guardando…' : 'Guardar destete'}
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
