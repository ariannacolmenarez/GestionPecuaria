/**
 * A3 · Ingresar ganado (Por lote / Por animal) con potrero obligatorio.
 * Crea los animales con bovinoActions.registerAnimals (un documento por animal +
 * evento de movimiento inicial); vacas compradas preñadas o secas se completan con
 * registerDiagnosis / registerDryOff para que su estado no quede "Vacía" por defecto.
 */
import React, { useMemo, useState } from 'react';
import { Beef, Map as MapIcon, Users } from 'lucide-react';
import { useBovino } from '../context';
import { BOVINO_BREEDS, BOVINO_CATEGORY_LABEL, type BovinoCategoryKey, type BovinoPurpose, type BovinoSex } from '../../../../models/bovinoModel';
import { bovinoCategory, isTagAvailable, normalizeTag } from '../../../../models/bovinoCalc';
import type { BovinoAnimalEntry, RegisterBovinoAnimalsInput } from '../../../../models/bovinoDomain';
import { addDays, daysBetween } from '../../../../utils/dates';
import { LotPickerSheet, PaddockPickerSheet, AnimalSearch } from '../pickers';
import {
  BigNumberInput,
  Chips,
  DateField,
  ErrorBox,
  Field,
  FOCUS_B,
  FormSheet,
  MoneyField,
  PickerButton,
  PrimaryBtn,
  SecondaryBtn,
  TextField,
  WarnNotice,
  emptyMoney,
  num,
  toMoneyInput,
  toNum,
  useDomainRunner,
  usd,
  type MoneyValue,
} from '../ui';
import { LimitConfirm } from '../ui';

type Mode = 'lote' | 'animal';
type Origen = 'nacido' | 'compra' | 'traslado';
type TagMode = 'rango' | 'lista' | 'despues';
type WeightMode = 'promedio' | 'individual';
type PriceMode = 'total' | 'por_kg' | 'por_cabeza';

const PURPOSES: { key: BovinoPurpose; label: string }[] = [
  { key: 'leche', label: 'Lechería' },
  { key: 'cria', label: 'Cría' },
  { key: 'ceba', label: 'Ceba' },
  { key: 'reproductor', label: 'Reproductor' },
];
const ORIGENES: { key: Origen; label: string }[] = [
  { key: 'nacido', label: 'Nacido en finca' },
  { key: 'compra', label: 'Compra' },
  { key: 'traslado', label: 'Traslado desde otra finca' },
];

export const AltaGanado: React.FC<{ lotId?: string; paddockId?: string; onClose: () => void }> = ({ lotId: lot0, paddockId: pad0, onClose }) => {
  const { actions, index, data, today, perms, config, home } = useBovino();
  const { error, setError, run, confirmEl } = useDomainRunner();

  // Comunes
  const [entryDate, setEntryDate] = useState(today);
  const [paddockId, setPaddockId] = useState<string | undefined>(pad0 || (lot0 ? home.lots.find((l) => l.lot.id === lot0)?.paddockId : undefined));
  const [lotId, setLotId] = useState<string | null>(lot0 || null);
  const [mode, setMode] = useState<Mode>('animal');
  const [origen, setOrigen] = useState<Origen>('compra');
  const [breed, setBreed] = useState('Mestizo');
  const [breedOther, setBreedOther] = useState('');
  const [purpose, setPurpose] = useState<BovinoPurpose | undefined>(undefined);
  const [sex, setSex] = useState<BovinoSex | undefined>(undefined);
  const [supplier, setSupplier] = useState('');
  const [money, setMoney] = useState<MoneyValue>(emptyMoney());
  const [priceMode, setPriceMode] = useState<PriceMode>('total');
  const [picker, setPicker] = useState<'potrero' | 'lote' | null>(null);
  const [triedSave, setTriedSave] = useState(false);

  // Por animal
  const [tag, setTag] = useState('');
  const [name, setName] = useState('');
  const [ageMode, setAgeMode] = useState<'fecha' | 'aprox' | 'nose'>('aprox');
  const [birthDate, setBirthDate] = useState('');
  const [ageMonths, setAgeMonths] = useState('');
  const [catOverride, setCatOverride] = useState<BovinoCategoryKey | undefined>(undefined);
  const [weight, setWeight] = useState('');
  const [parida, setParida] = useState<'si' | 'no'>('no');
  const [partos, setPartos] = useState('1');
  const [lastCalving, setLastCalving] = useState('');
  const [productivo, setProductivo] = useState<'ordeno' | 'seca'>('seca');
  const [reproEstado, setReproEstado] = useState<'vacia' | 'preñada'>('vacia');
  const [gestMonths, setGestMonths] = useState('');
  const [motherId, setMotherId] = useState<string | undefined>(undefined);

  // Por lote
  const [count, setCount] = useState('');
  const [tagMode, setTagMode] = useState<TagMode>('rango');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tagList, setTagList] = useState<string[]>([]);
  const [weightMode, setWeightMode] = useState<WeightMode>('promedio');
  const [avgWeight, setAvgWeight] = useState('');
  const [weights, setWeights] = useState<string[]>([]);
  const [bigConfirm, setBigConfirm] = useState<(() => void) | null>(null);

  const breedValue = breed === 'Otra' ? breedOther.trim() : breed;
  const lot = lotId ? data.lots.find((l) => l.id === lotId) : undefined;
  const paddock = paddockId ? index.paddocksById.get(paddockId) : undefined;
  const isCompra = origen === 'compra';
  const showPrice = isCompra && perms.verCostos;
  /** Teclado de aretes según Configuración › Aretes con letras. */
  const tagInputMode: 'text' | 'numeric' = config.tagsWithLetters ? 'text' : 'numeric';

  // ---- Por animal: edad, categoría y validaciones en vivo ----
  const ageDays = useMemo(() => {
    if (ageMode === 'fecha' && birthDate) return daysBetween(birthDate, today);
    const m = toNum(ageMonths);
    if (ageMode === 'aprox' && isFinite(m)) return Math.round(m * 30.44) + daysBetween(entryDate, today);
    if (origen === 'nacido') return daysBetween(entryDate, today);
    return null;
  }, [ageMode, birthDate, ageMonths, entryDate, today, origen]);
  const priorCalvings = parida === 'si' ? Math.max(1, Math.round(toNum(partos) || 1)) : 0;
  const category: BovinoCategoryKey | null = useMemo(() => {
    if (!sex) return null;
    return bovinoCategory(
      { sex, purpose: purpose || (sex === 'hembra' ? 'cria' : 'ceba'), castrated: false, initialCategory: catOverride, birthDate: undefined, estimatedAgeMonthsAtEntry: undefined, entryDate, priorCalvings },
      { ageDays: ageMode === 'nose' ? null : ageDays, parity: priorCalvings, weaned: false, inCebaLot: lot?.type === 'ceba' },
      config
    );
  }, [sex, purpose, catOverride, entryDate, priorCalvings, ageDays, ageMode, lot, config]);
  const adultFemale = sex === 'hembra' && (category === 'vaca' || category === 'novilla' || (ageDays !== null && ageDays >= config.levanteMaxDays) || ageMode === 'nose');
  const tagTaken = (t: string) => !!normalizeTag(t) && !isTagAvailable(data.animals, t, undefined, index);
  const tagOwner = (t: string) => {
    const v = index.byTag.get(normalizeTag(t));
    return v ? `El arete ${t} ya es de ${v.animal.name || v.categoryLabel}${v.lotId ? ` (${index.lotsById.get(v.lotId)?.name || 'lote'})` : ''}` : `El arete ${t} ya existe`;
  };

  // ---- Por lote: aretes ----
  const n = Math.max(0, Math.round(toNum(count) || 0));
  const lotTags: string[] = useMemo(() => {
    if (tagMode === 'rango') {
      const a = parseInt(from, 10);
      const b = parseInt(to, 10);
      if (isNaN(a) || isNaN(b) || b < a || b - a > 999) return [];
      return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
    }
    if (tagMode === 'lista') return Array.from({ length: n }, (_, i) => (tagList[i] || '').trim());
    // Provisionales P-001... después del mayor existente
    const used = data.animals.map((x) => /^P-(\d+)$/i.exec(x.tag)?.[1]).filter(Boolean).map((x) => parseInt(x as string, 10));
    const start = (used.length ? Math.max(...used) : 0) + 1;
    return Array.from({ length: n }, (_, i) => `P-${String(start + i).padStart(3, '0')}`);
  }, [tagMode, from, to, n, tagList, data.animals]);
  const effectiveCount = tagMode === 'rango' ? lotTags.length : n;
  const rangeMismatch = tagMode === 'rango' && n > 0 && lotTags.length > 0 && lotTags.length !== n;
  const dupInList = useMemo(() => {
    const seen = new Set<string>();
    return lotTags.find((t) => {
      const k = normalizeTag(t);
      if (!k) return false;
      if (seen.has(k)) return true;
      seen.add(k);
      return false;
    });
  }, [lotTags]);
  const takenInLot = lotTags.find((t) => tagTaken(t));
  const lotWeightsKg = lotTags.map((_, i) => (weightMode === 'promedio' ? toNum(avgWeight) : toNum(weights[i] || '')));
  const totalKg = lotWeightsKg.reduce((s, w) => s + (isFinite(w) ? w : 0), 0);
  const avgKg = effectiveCount ? totalKg / effectiveCount : 0;

  const priceAmount = toNum(money.amount);
  const totalPriceUsd = !isFinite(priceAmount)
    ? 0
    : priceMode === 'total'
      ? priceAmount
      : priceMode === 'por_kg'
        ? priceAmount * (mode === 'animal' ? toNum(weight) || 0 : totalKg)
        : priceAmount * (mode === 'animal' ? 1 : effectiveCount);
  const currencyLabel = money.in === 'USD' ? 'US$' : config.localCurrency;

  const dirty = !!(tag || name || count || from || weight || avgWeight || money.amount);

  // ---- Guardar ----
  const buildEntry = (t: string, w?: number): BovinoAnimalEntry => ({
    tag: t,
    name: mode === 'animal' ? name || undefined : undefined,
    sex: sex as BovinoSex,
    birthDate: ageMode === 'fecha' && birthDate ? birthDate : undefined,
    estimatedAgeMonths: ageMode === 'aprox' && isFinite(toNum(ageMonths)) ? toNum(ageMonths) : undefined,
    weightKg: w && isFinite(w) && w > 0 ? w : undefined,
    breed: breedValue || undefined,
    purpose,
    initialCategory: ageMode === 'nose' || catOverride ? catOverride || (category ?? undefined) : undefined,
    priorCalvings: mode === 'animal' && priorCalvings > 0 ? priorCalvings : undefined,
    priorLastCalvingDate: mode === 'animal' && priorCalvings > 0 && lastCalving ? lastCalving : undefined,
    motherId: mode === 'animal' && origen === 'nacido' ? motherId : undefined,
    notes: origen === 'traslado' ? 'Ingreso por traslado desde otra finca' : undefined,
  });

  const validate = (): string | null => {
    if (!paddockId) return 'Elige el potrero al que entra el ganado.';
    if (!sex) return 'Elige el sexo.';
    if (mode === 'animal') {
      if (!normalizeTag(tag)) return 'Escribe el número de arete.';
      if (tagTaken(tag)) return tagOwner(tag);
      if (ageMode === 'fecha' && !birthDate) return 'Indica la fecha de nacimiento.';
      if (ageMode === 'fecha' && birthDate > entryDate) return 'La fecha de nacimiento no puede ser posterior al ingreso.';
      if (parida === 'si' && productivo === 'ordeno' && !lastCalving) return 'Para una vaca en ordeño indica la fecha de su último parto.';
      if (adultFemale && reproEstado === 'preñada' && !(toNum(gestMonths) > 0 && toNum(gestMonths) <= 9.5)) return 'Indica los meses de gestación (1 a 9).';
    } else {
      if (tagMode === 'rango' && !lotTags.length) return 'Revisa el rango de aretes: Desde debe ser menor o igual que Hasta.';
      if (tagMode !== 'rango' && n < 1) return 'Indica la cantidad de animales.';
      if (tagMode === 'lista' && lotTags.some((t) => !normalizeTag(t))) return 'Escribe el arete de cada animal o usa "Asignar después".';
      if (dupInList) return `El arete ${dupInList} está repetido en la lista.`;
      if (takenInLot) return tagOwner(takenInLot);
    }
    if (showPrice && money.amount && !toMoneyInput(money, config)) return 'El costo no es válido.';
    if (showPrice && priceMode === 'por_kg' && money.amount && (mode === 'animal' ? !(toNum(weight) > 0) : lotWeightsKg.some((w) => !(w > 0))))
      return 'Para el costo por kg indica el peso de cada animal.';
    return null;
  };

  const doSave = (keepOpen: boolean) => {
    setTriedSave(true);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    const entries =
      mode === 'animal' ? [buildEntry(tag.trim(), toNum(weight))] : lotTags.map((t, i) => buildEntry(t, lotWeightsKg[i]));
    const priceInput = showPrice && money.amount ? toMoneyInput(money, config) : null;
    const input: RegisterBovinoAnimalsInput = {
      animals: entries,
      origin: origen === 'nacido' ? 'nacido' : 'compra',
      entryDate,
      lotId: lotId || undefined,
      paddockId,
      purpose,
      breed: breedValue || undefined,
      supplier: isCompra ? supplier.trim() || undefined : origen === 'traslado' ? 'Traslado desde otra finca' : undefined,
      pricing: priceInput ? { mode: priceMode, price: priceInput } : undefined,
      transfer: origen === 'traslado' || undefined,
    };
    run(
      (confirm) => actions.registerAnimals({ ...input, confirm }),
      (res) => {
        const id: string | undefined = res.meta?.animalIds?.[0];
        // Vaca comprada: completar su estado productivo / reproductivo con eventos propios
        if (mode === 'animal' && id && adultFemale && sex === 'hembra') {
          if (priorCalvings > 0 && productivo === 'seca' && lastCalving && daysBetween(lastCalving, today) < 305) {
            actions.registerDryOff({ animalId: id, date: entryDate, treatment: 'Ingresó seca', confirm: true });
          }
          if (reproEstado === 'preñada' && toNum(gestMonths) > 0) {
            actions.registerDiagnosis({ animalId: id, method: 'palpacion', result: 'preñada', gestationDays: Math.round(toNum(gestMonths) * 30.4), date: entryDate });
          }
        }
        if (keepOpen) {
          setTag('');
          setName('');
          setWeight('');
          setBirthDate('');
          setAgeMonths('');
          setMoney(emptyMoney());
          setMotherId(undefined);
          setTriedSave(false);
        } else onClose();
      }
    );
  };

  const save = (keepOpen: boolean) => {
    if (mode === 'lote' && effectiveCount > 1000) setBigConfirm(() => () => doSave(keepOpen));
    else doSave(keepOpen);
  };

  const summary =
    mode === 'lote' && effectiveCount > 0
      ? `Se ingresarán ${num(effectiveCount)} ${sex === 'hembra' ? 'hembras' : sex === 'macho' ? 'machos' : 'animales'}${purpose ? ` de ${PURPOSES.find((p) => p.key === purpose)?.label.toLowerCase()}` : ''}${
          paddock ? ` · Potrero ${paddock.name}` : ''
        }${lot ? ` · ${lot.name}` : ''}${avgKg > 0 ? ` · peso prom. ${num(avgKg)} kg` : ''}${showPrice && totalPriceUsd > 0 ? ` · costo ${num(totalPriceUsd, 2)} ${currencyLabel}` : ''}`
      : null;

  return (
    <FormSheet
      tone="sky"
      title="Ingresar ganado"
      subtitle={mode === 'lote' ? 'Por lote' : 'Por animal'}
      dirty={dirty}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <div className={`grid ${mode === 'animal' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
            {mode === 'animal' && (
              <SecondaryBtn className="h-14" onClick={() => save(true)}>
                Guardar y otro
              </SecondaryBtn>
            )}
            <PrimaryBtn onClick={() => save(false)}>{mode === 'lote' && effectiveCount > 0 ? `Guardar ${num(effectiveCount)}` : 'Guardar'}</PrimaryBtn>
          </div>
        </div>
      }
    >
      <Field label="Fecha de ingreso">
        <DateField value={entryDate} onChange={setEntryDate} />
      </Field>

      <Field label="Potrero" error={triedSave && !paddockId ? 'Elige el potrero al que entra el ganado' : null}>
        <PickerButton label="Potrero" dashed icon={<MapIcon className="w-6 h-6" />} value={paddock?.name} placeholder="Toca para elegir potrero" onClick={() => setPicker('potrero')} invalid={triedSave && !paddockId} />
      </Field>

      <Field label="Lote destino (opcional)">
        <PickerButton label="Lote" icon={<Users className="w-5 h-5" />} value={lot?.name} placeholder="Sin lote" onClick={() => setPicker('lote')} />
      </Field>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de ingreso">
        {([
          ['lote', 'Por lote', <Users key="u" className="w-8 h-8" />],
          ['animal', 'Por animal', <Beef key="b" className="w-8 h-8" />],
        ] as const).map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={`h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 font-black text-base ${mode === k ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-200 text-sky-900' : 'border-slate-300 bg-white text-slate-900'} ${FOCUS_B}`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <Field label="Procedencia">
        <Chips options={ORIGENES} value={origen} onChange={setOrigen} />
      </Field>

      {mode === 'animal' ? (
        <>
          <Field label="Arete" htmlFor="alta-arete" error={tag && tagTaken(tag) ? tagOwner(tag) : null}>
            <input
              id="alta-arete"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              inputMode={tagInputMode}
              autoCapitalize={config.tagsWithLetters ? 'characters' : undefined}
              autoComplete="off"
              placeholder="Número de arete"
              className={`w-full h-14 rounded-2xl border-2 ${tag && tagTaken(tag) ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'} px-4 text-2xl font-black tabular-nums text-slate-900 placeholder:text-base placeholder:font-semibold placeholder:text-slate-500 ${FOCUS_B}`}
            />
          </Field>
          <Field label="Nombre (opcional)">
            <TextField value={name} onChange={setName} placeholder="Ej. Lucero" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Cantidad de animales" hint={tagMode === 'rango' && lotTags.length ? `El rango tiene ${lotTags.length} aretes` : undefined}>
            <BigNumberInput value={count} onChange={setCount} unit="cab." ariaLabel="Cantidad de animales" />
          </Field>
          <Field label="Aretes">
            <Chips
              options={[
                { key: 'rango', label: 'Rango' },
                { key: 'lista', label: 'Lista' },
                { key: 'despues', label: 'Asignar después' },
              ]}
              value={tagMode}
              onChange={setTagMode}
            />
          </Field>
          {tagMode === 'rango' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Desde">
                <BigNumberInput value={from} onChange={setFrom} size="md" ariaLabel="Arete desde" invalid={!!from && !!to && parseInt(to, 10) < parseInt(from, 10)} />
              </Field>
              <Field label="Hasta">
                <BigNumberInput value={to} onChange={setTo} size="md" ariaLabel="Arete hasta" invalid={!!from && !!to && parseInt(to, 10) < parseInt(from, 10)} />
              </Field>
            </div>
          )}
          {rangeMismatch && <WarnNotice>El rango tiene {lotTags.length} aretes y la cantidad es {n}. Se ingresarán {lotTags.length}.</WarnNotice>}
          {tagMode === 'despues' && n > 0 && (
            <WarnNotice>
              Se asignarán aretes provisionales {lotTags[0]} a {lotTags[lotTags.length - 1]} marcados como “Arete pendiente”.
            </WarnNotice>
          )}
          {tagMode === 'lista' && n > 0 && n <= 300 && (
            <div className="space-y-2">
              {Array.from({ length: n }, (_, i) => (
                <input
                  key={i}
                  id={`alta-tag-${i}`}
                  aria-label={`Arete del animal ${i + 1}`}
                  value={tagList[i] || ''}
                  inputMode={tagInputMode}
                  autoCapitalize={config.tagsWithLetters ? 'characters' : undefined}
                  autoComplete="off"
                  enterKeyHint={i < n - 1 ? 'next' : 'done'}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const next = document.getElementById(`alta-tag-${i + 1}`) as HTMLInputElement | null;
                    if (next) {
                      next.focus();
                      next.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    } else (e.currentTarget as HTMLInputElement).blur();
                  }}
                  placeholder={`Arete ${i + 1}`}
                  onChange={(e) => setTagList((l) => {
                    const c = [...l];
                    c[i] = e.target.value;
                    return c;
                  })}
                  className={`w-full h-12 rounded-2xl border-2 ${tagList[i] && tagTaken(tagList[i]) ? 'border-rose-500 bg-rose-50' : 'border-slate-300 bg-white'} px-4 text-lg font-black tabular-nums text-slate-900 ${FOCUS_B}`}
                />
              ))}
            </div>
          )}
          {(dupInList || takenInLot) && <ErrorBox error={dupInList ? `El arete ${dupInList} está repetido en la lista.` : tagOwner(takenInLot as string)} />}
        </>
      )}

      <Field label="Sexo" error={triedSave && !sex ? 'Elige el sexo' : null}>
        <Chips size="lg" options={[{ key: 'hembra', label: 'Hembra' }, { key: 'macho', label: 'Macho' }]} value={sex} onChange={setSex} />
      </Field>

      <Field label="Edad">
        <Chips
          options={[
            { key: 'fecha', label: 'Fecha exacta' },
            { key: 'aprox', label: 'Edad aproximada' },
            { key: 'nose', label: 'No se sabe' },
          ]}
          value={ageMode}
          onChange={setAgeMode}
        />
      </Field>
      {ageMode === 'fecha' && <DateField value={birthDate} onChange={setBirthDate} max={entryDate} ariaLabel="Fecha de nacimiento" />}
      {ageMode === 'aprox' && (
        <Field label="Meses de edad al ingreso" hint={isFinite(toNum(ageMonths)) ? `Nacimiento estimado: ${addDays(entryDate, -Math.round(toNum(ageMonths) * 30.44))} (aprox.)` : undefined}>
          <BigNumberInput decimal value={ageMonths} onChange={setAgeMonths} unit="meses" ariaLabel="Edad en meses" />
        </Field>
      )}

      <Field label="Raza">
        <select
          aria-label="Raza"
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          className={`w-full h-12 rounded-2xl border-2 border-slate-300 bg-white px-4 text-base font-bold text-slate-900 ${FOCUS_B}`}
        >
          {BOVINO_BREEDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        {breed === 'Otra' && <TextField value={breedOther} onChange={setBreedOther} placeholder="Escribe la raza" />}
      </Field>

      <Field label="Propósito">
        <Chips options={PURPOSES} value={purpose} onChange={setPurpose} />
      </Field>

      {mode === 'animal' && sex && category && (
        <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 space-y-2">
          <p className="text-base text-sky-950">
            Se registrará como: <strong className="font-black">{BOVINO_CATEGORY_LABEL[category]}</strong>
          </p>
          {(ageMode === 'nose' || catOverride) && (
            <Chips
              options={(sex === 'hembra' ? (['cria', 'levante', 'novilla', 'vaca'] as BovinoCategoryKey[]) : (['cria', 'levante', 'novillo', 'toro'] as BovinoCategoryKey[])).map((k) => ({ key: k, label: BOVINO_CATEGORY_LABEL[k] }))}
              value={catOverride || category}
              onChange={setCatOverride}
            />
          )}
          {ageMode !== 'nose' && !catOverride && <p className="text-xs text-slate-800">Se calcula con el sexo, la edad y el propósito.</p>}
        </div>
      )}

      {mode === 'animal' && adultFemale && (
        <div className="space-y-4 rounded-2xl border-2 border-slate-200 p-3">
          <Field label="¿Ya parió?">
            <Chips options={[{ key: 'no', label: 'No' }, { key: 'si', label: 'Sí' }]} value={parida} onChange={setParida} />
          </Field>
          {parida === 'si' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Partos">
                  <BigNumberInput size="md" value={partos} onChange={setPartos} ariaLabel="Número de partos" />
                </Field>
                <Field label="Último parto">
                  <DateField compact value={lastCalving} onChange={setLastCalving} max={entryDate} ariaLabel="Fecha del último parto" />
                </Field>
              </div>
              <Field label="¿Está en ordeño?">
                <Chips options={[{ key: 'ordeno', label: 'En ordeño' }, { key: 'seca', label: 'Seca (no ordeña)' }]} value={productivo} onChange={setProductivo} />
              </Field>
            </>
          )}
          <Field label="Estado reproductivo">
            <Chips options={[{ key: 'vacia', label: 'Vacía' }, { key: 'preñada', label: 'Preñada' }]} value={reproEstado} onChange={setReproEstado} />
          </Field>
          {reproEstado === 'preñada' && (
            <Field
              label="Meses de gestación"
              hint={toNum(gestMonths) > 0 ? `Parto probable ≈ ${addDays(entryDate, config.gestationDays - Math.round(toNum(gestMonths) * 30.4))}` : 'Se registra como diagnóstico de preñez con la FPP calculada.'}
            >
              <BigNumberInput decimal size="md" value={gestMonths} onChange={setGestMonths} unit="meses" ariaLabel="Meses de gestación" />
            </Field>
          )}
        </div>
      )}

      {mode === 'animal' && origen === 'nacido' && (
        <Field label="Madre (opcional)" hint={motherId ? `Madre: #${index.views.get(motherId)?.tag}` : 'Busca la vaca por su arete'}>
          {motherId ? (
            <SecondaryBtn className="w-full" onClick={() => setMotherId(undefined)}>
              Quitar madre #{index.views.get(motherId)?.tag}
            </SecondaryBtn>
          ) : (
            <AnimalSearch placeholder="Arete de la madre" filter={(v) => v.sex === 'hembra'} onPick={(v) => setMotherId(v.id)} />
          )}
        </Field>
      )}

      {mode === 'animal' ? (
        <Field label="Peso de ingreso (opcional)" hint="Si lo llenas, queda como primer pesaje.">
          <BigNumberInput decimal value={weight} onChange={setWeight} unit="kg" ariaLabel="Peso de ingreso" />
        </Field>
      ) : (
        <>
          <Field label="Peso">
            <Chips options={[{ key: 'promedio', label: 'Promedio del grupo' }, { key: 'individual', label: 'Individual' }]} value={weightMode} onChange={setWeightMode} />
          </Field>
          {weightMode === 'promedio' ? (
            <BigNumberInput decimal value={avgWeight} onChange={setAvgWeight} unit="kg" ariaLabel="Peso promedio" />
          ) : (
            <div className="space-y-2">
              {lotTags.slice(0, 300).map((t, i) => (
                <div key={`${t}-${i}`} className="flex items-center gap-3">
                  <span className="w-20 text-lg font-black tabular-nums text-slate-900">#{t || i + 1}</span>
                  <div className="flex-1">
                    <BigNumberInput
                      decimal
                      size="md"
                      value={weights[i] || ''}
                      ariaLabel={`Peso de ${t}`}
                      unit="kg"
                      onChange={(v) => setWeights((l) => {
                        const c = [...l];
                        c[i] = v;
                        return c;
                      })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isCompra && (
        <Field label="Proveedor (opcional)">
          <TextField value={supplier} onChange={setSupplier} placeholder="Nombre del vendedor" />
        </Field>
      )}

      {isCompra && !perms.verCostos && (
        <WarnNotice>
          <b>El costo de compra lo registra el administrador.</b> La compra quedará pendiente de costo y le llegará una alerta para cargarlo.
        </WarnNotice>
      )}

      {showPrice && (
        <Field label="Costo de compra" hint={mode === 'lote' && effectiveCount > 0 && totalPriceUsd > 0 ? `≈ ${num(totalPriceUsd / effectiveCount, 2)} ${currencyLabel} por animal · total ${num(totalPriceUsd, 2)} ${currencyLabel}` : undefined}>
          <Chips
            options={[
              { key: 'total', label: 'Total' },
              { key: 'por_kg', label: 'Por kg' },
              { key: 'por_cabeza', label: 'Por cabeza' },
            ]}
            value={priceMode}
            onChange={setPriceMode}
          />
          <MoneyField value={money} onChange={setMoney} suffix={priceMode === 'por_kg' ? '/kg' : priceMode === 'por_cabeza' ? '/cab' : ''} />
        </Field>
      )}

      {summary && <div className="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3 text-sm font-bold text-sky-950">{summary}</div>}
      {mode === 'animal' && showPrice && totalPriceUsd > 0 && money.in === 'USD' && <p className="text-xs text-slate-700">Costo: {usd(totalPriceUsd)}</p>}

      {picker === 'potrero' && (
        <PaddockPickerSheet
          title="¿A qué potrero entra?"
          selectedId={paddockId}
          allowCreate
          onClose={() => setPicker(null)}
          onPick={(id) => {
            setPaddockId(id);
            setPicker(null);
          }}
        />
      )}
      {picker === 'lote' && (
        <LotPickerSheet
          title="Lote destino"
          selectedId={lotId}
          allowNone="Sin lote"
          allowCreate
          onClose={() => setPicker(null)}
          onPick={(id) => {
            setLotId(id);
            setPicker(null);
          }}
        />
      )}
      {bigConfirm && (
        <LimitConfirm
          warnings={[`¿Ingresar ${num(effectiveCount)} animales de una vez? Es más de lo normal (máx. 1.000).`]}
          onCancel={() => setBigConfirm(null)}
          onConfirm={() => {
            const f = bigConfirm;
            setBigConfirm(null);
            f();
          }}
        />
      )}
      {confirmEl}
    </FormSheet>
  );
};
