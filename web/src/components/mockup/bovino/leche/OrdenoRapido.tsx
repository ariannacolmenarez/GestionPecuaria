/**
 * B2 · Ordeño rápido: por vaca (lista) o total del tanque con desglose opcional.
 * - Las vacas secas no aparecen. Las vacas con retiro de leche se marcan en rose: sus
 *   litros se registran como DESCARTE (el dominio los marca discarded) y no van al tanque.
 * - Cada ordeño por vaca es un documento; el tanque es otro documento y su desglose
 *   son documentos por vaca que lo referencian (no suman doble).
 * - Administrador: "Registrar venta de la leche de hoy" (litros × precio, moneda dual).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { BovinoMilkShift } from '../../../../models/bovinoModel';
import { normalizeTag, type BovinoAnimalView } from '../../../../models/bovinoCalc';
import { useBovino } from '../context';
import { AnimalSearch } from '../pickers';
import {
  BigNumberInput,
  Chips,
  ChipFilter,
  DateField,
  ErrorBox,
  FOCUS_B,
  Field,
  FormSheet,
  MoneyField,
  PrimaryBtn,
  RetiroChip,
  SecondaryBtn,
  StatusChip,
  TagJump,
  TextField,
  Toggle,
  WarnNotice,
  fd,
  fdw,
  num,
  toMoneyInput,
  toNum,
  usd,
  type MoneyValue,
} from '../ui';
import { useStepRunner, type DomainStep } from '../kit';
import { cowAvgBefore, lastMilkPriceUsd } from './milkUtils';

type Modo = 'vaca' | 'tanque';

const byTag = (a: BovinoAnimalView, b: BovinoAnimalView) => normalizeTag(a.tag).localeCompare(normalizeTag(b.tag), 'es', { numeric: true });

export const OrdenoRapido: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { index, actions, today, config, data, perms } = useBovino();
  const [date, setDate] = useState(today);
  const [shift, setShift] = useState<BovinoMilkShift>(() => (new Date().getHours() < 12 ? 'manana' : 'tarde'));
  const [modo, setModo] = useState<Modo>('vaca');
  const [tank, setTank] = useState('');
  const [desglose, setDesglose] = useState(false);
  const [lotFilter, setLotFilter] = useState('todos');
  const [liters, setLiters] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [sell, setSell] = useState(false);
  const lastPrice = useMemo(() => lastMilkPriceUsd(data.finance), [data.finance]);
  const [price, setPrice] = useState<MoneyValue>({ amount: lastPrice ? String(lastPrice) : '', in: 'USD' });
  const [sellLiters, setSellLiters] = useState('');
  const [buyer, setBuyer] = useState('');
  /** Destino de la leche de vacas en retiro (no va al tanque): descarte o terneros. */
  const [dest, setDest] = useState<Record<string, 'descarte' | 'terneros'>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  /** Vaca a la que se llegó con el buscador: tras Enter el foco vuelve al buscador. */
  const jumpedRef = useRef<string | null>(null);
  const { error, setError, runSteps, confirmEl } = useStepRunner();

  const cows = useMemo(() => {
    const base = index.active.filter((v) => v.sex === 'hembra' && v.repro?.lactating && !v.repro?.dried);
    const extras = extra.map((id) => index.views.get(id)).filter((v): v is BovinoAnimalView => !!v && !base.some((b) => b.id === v.id));
    return [...base, ...extras].sort(byTag);
  }, [index, extra]);
  const lots = useMemo(() => [...new Set(cows.map((c) => c.lotId).filter(Boolean) as string[])].map((id) => ({ id, name: index.lotsById.get(id)?.name || 'Lote' })), [cows, index]);
  const rows = lotFilter === 'todos' ? cows : cows.filter((c) => c.lotId === lotFilter);
  const avgs = useMemo(() => {
    const m = new Map<string, number | null>();
    cows.forEach((c) => m.set(c.id, cowAvgBefore(index.eventsByAnimal.get(c.id) || [], date)));
    return m;
  }, [cows, index, date]);

  const filled = cows.filter((c) => toNum(liters[c.id] || '') >= 0 && (liters[c.id] || '').trim() !== '');
  const sum = (list: BovinoAnimalView[]) => list.reduce((s, c) => s + (toNum(liters[c.id] || '') || 0), 0);
  const retFilled = filled.filter((c) => c.withdrawal.milkActive);
  const calves = sum(retFilled.filter((c) => dest[c.id] === 'terneros'));
  const discard = sum(retFilled);
  const discardOnly = discard - calves;
  const assigned = sum(filled);
  const toTank = modo === 'vaca' ? assigned - discard : Math.max(0, (toNum(tank) || 0) - discard);
  const tankNum = toNum(tank) || 0;
  const showList = modo === 'vaca' || desglose;

  const focusRow = (i: number) => {
    const next = rows[i];
    if (!next) return;
    const el = refs.current[next.id];
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.querySelector('input')?.focus();
  };
  const jumpTo = (id: string) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    jumpedRef.current = id;
    focusRow(i);
  };
  const afterEnter = (id: string, i: number) => {
    if (jumpedRef.current === id) {
      jumpedRef.current = null;
      searchRef.current?.focus();
      return;
    }
    focusRow(i + 1);
  };

  const save = () => {
    const items = filled.map((c) => ({ animalId: c.id, liters: toNum(liters[c.id]), discardTo: c.withdrawal.milkActive ? dest[c.id] || ('descarte' as const) : undefined }));
    if (modo === 'vaca' && !items.length) return setError('Escribe los litros de al menos una vaca.');
    if (modo === 'tanque' && !(tankNum > 0)) return setError('Escribe los litros del tanque.');
    const steps: DomainStep[] = [];
    if (modo === 'vaca') steps.push({ call: (confirm) => actions.registerMilkings({ shift, items, date, confirm }) });
    else steps.push({ call: (confirm) => actions.registerTankMilking({ shift, liters: tankNum, breakdown: desglose && items.length ? items : undefined, date, confirm }) });
    if (sell && perms.ventas) {
      const l = toNum(sellLiters) > 0 ? toNum(sellLiters) : toTank;
      const m = toMoneyInput(price, config);
      if (!(l > 0)) return setError('Escribe los litros vendidos.');
      if (!m || !(m.amount > 0)) return setError('Escribe el precio por litro.');
      steps.push({ call: (confirm) => actions.registerMilkSale({ liters: l, pricePerLiter: m, buyer: buyer.trim() || undefined, date, confirm }) });
    }
    runSteps(steps, (o) => {
      if (!o.stopped) onClose();
    });
  };

  const dirty = filled.length > 0 || !!tank;
  const saleTotal = (toNum(sellLiters) > 0 ? toNum(sellLiters) : toTank) * (toNum(price.amount) || 0);

  return (
    <FormSheet
      tone="sky"
      title={`Ordeño · ${fdw(date)}`}
      subtitle={modo === 'vaca' ? `${filled.length} de ${cows.length} vacas` : 'Total del tanque'}
      dirty={dirty}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <p className="text-sm font-bold text-slate-900 text-center">
            Al tanque {num(toTank, 1)} L{discardOnly > 0 ? ` · descarte ${num(discardOnly, 1)} L` : ''}{calves > 0 ? ` · terneros ${num(calves, 1)} L` : ''}
            {modo === 'vaca' ? ` · ${filled.length} de ${cows.length} vacas` : ''}
          </p>
          <PrimaryBtn className="w-full" onClick={save}>
            Guardar ordeño
          </PrimaryBtn>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        <Field label="Fecha">
          <DateField value={date} onChange={setDate} />
        </Field>
        <Field label="Turno">
          <Chips<BovinoMilkShift>
            options={[
              { key: 'manana', label: 'Mañana' },
              { key: 'tarde', label: 'Tarde' },
              { key: 'unico', label: 'Único' },
            ]}
            value={shift}
            onChange={setShift}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de registro">
          {(['vaca', 'tanque'] as Modo[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              onClick={() => setModo(m)}
              className={`min-h-16 rounded-2xl border-2 p-3 text-left ${modo === m ? 'border-sky-600 bg-sky-50' : 'border-slate-300 bg-white'} ${FOCUS_B}`}
            >
              <span className="block text-base font-black text-slate-900">{m === 'vaca' ? 'Por vaca' : 'Total del tanque'}</span>
              <span className="block text-xs text-slate-700">{m === 'vaca' ? 'Litros de cada vaca' : 'Un total, desglose opcional'}</span>
            </button>
          ))}
        </div>
      </div>

      {modo === 'tanque' && (
        <>
          <Field label="Litros del tanque">
            <BigNumberInput decimal unit="L" value={tank} onChange={setTank} ariaLabel="Litros del tanque" />
          </Field>
          <Toggle checked={desglose} onChange={setDesglose} label="Desglosar por vaca" hint="Opcional: asigna los litros de cada vaca." />
          {desglose && (
            <p className={`text-sm font-bold ${assigned > tankNum + 0.01 ? 'text-rose-700' : 'text-slate-900'}`}>
              Asignado {num(assigned, 1)} / {num(tankNum, 1)} L · sin asignar {num(Math.max(0, tankNum - assigned), 1)} L
              {assigned > tankNum + 0.01 ? ' · lo asignado supera el total' : ''}
            </p>
          )}
        </>
      )}

      {showList && (
        <>
          {lots.length > 1 && (
            <ChipFilter ariaLabel="Lote" value={lotFilter} onChange={setLotFilter} options={[{ key: 'todos', label: 'Todas' }, ...lots.map((l) => ({ key: l.id, label: l.name }))]} />
          )}
          {rows.length > 0 && <TagJump rows={rows} onJump={jumpTo} inputRef={searchRef} placeholder="Ir a la vaca (arete)…" />}
          {cows.length === 0 && <WarnNotice>No hay vacas en ordeño (con parto registrado y sin secar). Puedes agregar una por arete.</WarnNotice>}
          <ul className="space-y-2">
            {rows.map((c, i) => {
              const l = toNum(liters[c.id] || '');
              const avg = avgs.get(c.id) ?? null;
              const dropPct = avg && l >= 0 && (liters[c.id] || '') !== '' ? Math.round(((avg - l) / avg) * 100) : null;
              const ret = c.withdrawal.milkActive;
              return (
                <li key={c.id}>
                  <div
                    ref={(el) => {
                      refs.current[c.id] = el;
                    }}
                    className={`min-h-[72px] rounded-2xl border-2 p-3 flex items-center gap-3 ${ret ? 'bg-rose-50 border-rose-300' : l > 0 ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`}
                  >
                    <div className="w-24 shrink-0">
                      <p className="text-2xl font-black tabular-nums text-slate-900 leading-none">#{c.tag}</p>
                      <p className="text-xs text-slate-700 mt-1">{avg !== null ? `Prom. 7 d: ${num(avg, 1)} L` : 'Sin promedio'}</p>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <BigNumberInput size="md" decimal unit="L" ariaLabel={`Litros de ${c.tag}`} value={liters[c.id] || ''} onChange={(x) => setLiters((p) => ({ ...p, [c.id]: x }))} onEnter={() => afterEnter(c.id, i)} />
                      <div className="flex flex-wrap gap-1 justify-end">
                        {ret && <RetiroChip w={c.withdrawal} only="leche" />}
                        {dropPct !== null && dropPct > config.milkDropPct && <StatusChip tone="warn">−{dropPct} %</StatusChip>}
                        {l > config.maxLitersPerMilking && <StatusChip tone="warn">¿Seguro? Más de {config.maxLitersPerMilking} L</StatusChip>}
                      </div>
                      {ret && <p className="text-sm font-bold text-rose-900 text-right">No va al tanque hasta {fd(c.withdrawal.milkUntil)}</p>}
                      {ret && (
                        <Chips<'descarte' | 'terneros'>
                          ariaLabel={`Destino de la leche de ${c.tag}`}
                          options={[
                            { key: 'descarte', label: 'Descarte' },
                            { key: 'terneros', label: 'Terneros' },
                          ]}
                          value={dest[c.id] || 'descarte'}
                          onChange={(x) => setDest((p) => ({ ...p, [c.id]: x }))}
                        />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {adding ? (
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-900">Agregar vaca por arete</p>
                <button type="button" aria-label="Cerrar" onClick={() => setAdding(false)} className={`w-11 h-11 rounded-xl flex items-center justify-center ${FOCUS_B}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <AnimalSearch
                excludeIds={cows.map((c) => c.id)}
                filter={(v) => v.sex === 'hembra'}
                blockReason={(v) => (v.repro?.dried ? `#${v.tag} está seca${v.repro.fpp ? ` (parto ${fd(v.repro.fpp)})` : ''}: no se ordeña` : null)}
                onPick={(v) => {
                  setExtra((x) => [...x, v.id]);
                  setAdding(false);
                }}
              />
            </div>
          ) : (
            <SecondaryBtn className="w-full" onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4" /> Agregar vaca que no está en la lista
            </SecondaryBtn>
          )}
        </>
      )}

      {perms.ventas && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-white p-3 space-y-3">
          <Toggle checked={sell} onChange={setSell} label="Registrar venta de la leche de hoy" hint="Crea el ingreso de la unidad Leche y cría." />
          {sell && (
            <>
              <Field label="Litros vendidos" hint={`Por defecto, lo que va al tanque (${num(toTank, 1)} L, sin el descarte).`}>
                <BigNumberInput decimal unit="L" value={sellLiters} onChange={setSellLiters} placeholder={num(toTank, 1)} ariaLabel="Litros vendidos" />
              </Field>
              <Field label="Precio por litro" hint={lastPrice ? `Último precio: ${usd(lastPrice)}/L` : undefined}>
                <MoneyField value={price} onChange={setPrice} suffix="/L" />
              </Field>
              <Field label="Comprador (opcional)">
                <TextField value={buyer} onChange={setBuyer} placeholder="Quesera, acopio…" />
              </Field>
              {saleTotal > 0 && (
                <p className="text-base font-black text-emerald-800">
                  Total: {num(saleTotal, 2)} {price.in === 'USD' ? 'US$' : config.localCurrency}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {confirmEl}
    </FormSheet>
  );
};
