/**
 * B6 · Balance bovino (solo Administrador): Ceba vs Leche y cría por mes o rango.
 * Ingresos − costos directos automáticos (salidas de almacén con destino + gastos directos)
 * = utilidad bruta; − gastos fijos prorrateados = utilidad neta. Costo por litro y por kg,
 * flujo de caja del mes, liquidaciones de lotes de ceba y lista de movimientos (con borrado auditado).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Minus, Plus, Trash2 } from 'lucide-react';
import type { BovinoExpense, BovinoFinanceDoc, BovinoIncome, BovinoLiquidation, BovinoMoney, BovinoStockOutEvent } from '../../../../models/bovinoModel';
import { BOVINO_EXPENSE_CATEGORY_LABEL, BOVINO_INCOME_TYPE_LABEL, BOVINO_UNIT_LABEL } from '../../../../models/bovinoModel';
import { inRange, type BovinoUnitResult } from '../../../../models/bovinoCalc';
import type { StageBProps } from '../stageB';
import { useBovino } from '../context';
import { BlockedNotice, BottomSheet, ChipFilter, EmptyBlock, ErrorBox, FOCUS_B, Field, PrimaryBtn, Screen, SecondaryBtn, StatusChip, TextField, fd, num, usd, useDomainRunner } from '../ui';
import { Card, LineRow, MonthNav, PeriodFilter, monthBounds, periodRange, type Period } from '../kit';
import { GastoSheet, IngresoSheet } from './IngresoGastoSheets';
import { VentaGanadoSheet } from './VentaGanadoSheet';

type Tab = 'todo' | 'ceba' | 'leche';
type Modo = 'mes' | 'rango';

const money = (usdV: number, localV: number | null, cur: string, showLocal: boolean) => (showLocal && localV !== null && cur ? `${num(localV, 2)} ${cur}` : usd(usdV));

/** Suma la parte local de los montos (a la tasa de cada registro); null si algún registro no la tiene. */
function sumLocal(list: (BovinoMoney | undefined)[]): number | null {
  let s = 0;
  for (const m of list) {
    if (!m) continue;
    if (m.local !== undefined) s += m.local;
    else if (m.rate && m.rate > 0) s += m.usd * m.rate;
    else if (m.usd) return null;
  }
  return s;
}

export default function BalanceBovino({ screen }: StageBProps) {
  const venta0 = screen.s === 'balance' ? screen.venta : undefined;
  const { data, selectors, perms, today, config, home, navigate, actions, members } = useBovino();
  const [tab, setTab] = useState<Tab>('todo');
  const [modo, setModo] = useState<Modo>('mes');
  const [offset, setOffset] = useState(0);
  const [range, setRange] = useState<Period>(() => periodRange('rango', today));
  const [showLocal, setShowLocal] = useState(false);
  const [sheet, setSheet] = useState<'ingreso' | 'gasto' | { venta: string[] } | null>(null);
  const [del, setDel] = useState<BovinoFinanceDoc | null>(null);
  const [reason, setReason] = useState('');
  const { error, setError, run } = useDomainRunner();
  useEffect(() => {
    if (venta0?.length && perms.ventas) setSheet({ venta: venta0 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mb = monthBounds(today, offset);
  const from = modo === 'mes' ? mb.from : range.from;
  const to = modo === 'mes' ? (mb.to > today ? today : mb.to) : range.to;
  const bal = useMemo(() => selectors.balance(from, to), [selectors, from, to]);
  const cur = config.localCurrency;
  const hasLocal = !!cur && config.exchangeRate > 0;

  const docs = useMemo(
    () =>
      data.finance
        .filter((f) => inRange(f.date, from, to))
        .filter((f) => {
          if (tab === 'todo' || f.kind === 'liquidacion') return tab === 'todo' || (tab === 'ceba' && f.kind === 'liquidacion');
          const u = (f as BovinoIncome | BovinoExpense).unit;
          return u === tab || u === 'general';
        })
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || '').localeCompare(a.createdAt || ''))),
    [data.finance, from, to, tab]
  );

  // Montos locales a la tasa de cada registro (ingresos y costos directos + gastos)
  const local = useMemo(() => {
    const outs = data.events.filter((e) => e.kind === 'salida' && inRange(e.date, from, to)) as BovinoStockOutEvent[];
    const unitOk = (u?: string) => tab === 'todo' || u === tab;
    const inc = data.finance.filter((f) => f.kind === 'ingreso' && inRange(f.date, from, to) && unitOk((f as BovinoIncome).unit));
    const exp = data.finance.filter((f) => f.kind === 'gasto' && inRange(f.date, from, to) && (tab === 'todo' || (f as BovinoExpense).unit === tab));
    return {
      income: sumLocal(inc.map((f) => f.money)),
      cost: sumLocal([...outs.filter((o) => unitOk(o.destination?.unit)).map((o) => o.cost), ...exp.map((f) => f.money)]),
    };
  }, [data, from, to, tab]);

  if (!perms.verBalance) return <Screen><BlockedNotice title="El balance lo ve solo el administrador" /></Screen>;

  const u: BovinoUnitResult | null = tab === 'todo' ? null : bal.units[tab];
  const income = u ? u.incomeUsd : bal.totals.incomeUsd;
  const cost = u ? u.totalCostUsd : bal.totals.costUsd;
  const gross = u ? u.grossProfitUsd : bal.totals.grossProfitUsd;
  const net = u ? u.netProfitUsd : bal.totals.netProfitUsd;
  const sum = (k: keyof BovinoUnitResult) => (u ? (u[k] as number) : (bal.units.ceba[k] as number) + (bal.units.leche[k] as number));
  const lecheIncome = bal.units.leche.incomeUsd;
  const cebaIncome = bal.units.ceba.incomeUsd;
  const marginLiter = bal.litersProduced > 0 && bal.costPerLiterUsd !== null ? lecheIncome / bal.litersProduced - bal.costPerLiterUsd : null;
  const marginKg = bal.kgProducedCeba > 0 && bal.costPerKgUsd !== null ? cebaIncome / bal.kgProducedCeba - bal.costPerKgUsd : null;
  const cf = home.cashFlow;
  const cfMax = Math.max(1, cf.projectedIncomeUsd, cf.projectedExpenseUsd);
  const openCeba = data.lots.filter((l) => l.status === 'abierto' && l.type === 'ceba');
  const liqs = data.finance.filter((f) => f.kind === 'liquidacion') as BovinoLiquidation[];
  const empty = docs.length === 0 && income === 0 && cost === 0;
  const nameOf = (uid?: string, fallback?: string) => fallback || members.find((m) => m.uid === uid)?.name || '';

  const label = (f: BovinoFinanceDoc) =>
    f.kind === 'ingreso' ? BOVINO_INCOME_TYPE_LABEL[(f as BovinoIncome).type] : f.kind === 'gasto' ? (f as BovinoExpense).concept || BOVINO_EXPENSE_CATEGORY_LABEL[(f as BovinoExpense).category] : `Liquidación ${(f as BovinoLiquidation).lotName}`;

  return (
    <Screen padBottom>
      <ChipFilter<Tab>
        ariaLabel="Unidad"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'todo', label: 'Todo' },
          { key: 'ceba', label: 'Ceba' },
          { key: 'leche', label: 'Leche y cría' },
        ]}
      />
      <ChipFilter<Modo>
        ariaLabel="Periodo"
        value={modo}
        onChange={setModo}
        options={[
          { key: 'mes', label: 'Por mes' },
          { key: 'rango', label: 'Rango de fechas' },
        ]}
      />
      {modo === 'mes' ? <MonthNav offset={offset} onChange={setOffset} today={today} /> : <PeriodFilter value={range} onChange={setRange} today={today} options={['rango']} />}
      {hasLocal && (
        <ChipFilter
          ariaLabel="Moneda"
          value={showLocal ? 'local' : 'usd'}
          onChange={(k) => setShowLocal(k === 'local')}
          options={[
            { key: 'usd', label: 'USD' },
            { key: 'local', label: `${cur} (tasa de cada día)` },
          ]}
        />
      )}

      <section className="rounded-3xl bg-sky-700 text-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sky-100">
            {tab === 'todo' ? 'Hato bovino' : BOVINO_UNIT_LABEL[tab]} · {fd(from)} – {fd(to)}
          </p>
          <span className={`h-7 px-2.5 rounded-full text-xs font-black flex items-center ${net >= 0 ? 'bg-emerald-300 text-emerald-950' : 'bg-rose-300 text-rose-950'}`}>{net >= 0 ? 'Ganancia' : 'Pérdida'}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-bold text-sky-100">Ingresos</p>
            <p className="text-2xl font-black tabular-nums text-emerald-200">{money(income, local.income, cur, showLocal)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-sky-100">Gastos</p>
            <p className="text-2xl font-black tabular-nums text-rose-200">{showLocal && local.cost !== null ? `${num(local.cost, 2)} ${cur}` : usd(cost)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-sky-100">Utilidad bruta</p>
            <p className="text-xl font-black tabular-nums">{usd(gross)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-sky-100">Utilidad neta</p>
            <p className="text-3xl font-black tabular-nums">{usd(net)}</p>
          </div>
        </div>
        {showLocal && (local.income === null || local.cost === null) && <p className="text-xs text-sky-100">Algunos registros no tienen monto en {cur}: la utilidad se muestra en USD.</p>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <PrimaryBtn tone="emerald" onClick={() => setSheet('ingreso')}>
          <Plus className="w-5 h-5" /> Ingreso
        </PrimaryBtn>
        <PrimaryBtn tone="rose" onClick={() => setSheet('gasto')}>
          <Minus className="w-5 h-5" /> Gasto fijo
        </PrimaryBtn>
      </div>

      {empty ? (
        <EmptyBlock icon={<Calculator className="w-8 h-8" />} title="Sin movimientos en este periodo" text="Registra la venta de leche o de ganado para ver la utilidad." />
      ) : (
        <>
          <Card title="Costos directos automáticos">
            <LineRow label="Alimento y minerales" value={usd(sum('feedCostUsd'))} />
            <LineRow label="Sanidad (farmacia)" value={usd(sum('healthCostUsd'))} />
            <LineRow label="Otros insumos" value={usd(sum('otherStockCostUsd'))} />
            <LineRow label="Gastos directos (incl. compra de animales)" value={usd(sum('directExpensesUsd'))} />
            <LineRow label="Total directos" value={usd(sum('directCostUsd'))} strong tone="text-rose-700" />
            <SecondaryBtn className="w-full" onClick={() => navigate({ s: 'almacen' })}>
              Ver salidas en el almacén
            </SecondaryBtn>
          </Card>
          <Card title="Gastos fijos prorrateados">
            <LineRow label="Gastos generales del periodo" value={usd(bal.generalCostUsd)} />
            <LineRow label={tab === 'todo' ? 'Asignado a Ceba' : `Asignado a ${BOVINO_UNIT_LABEL[tab]}`} value={usd(tab === 'todo' ? bal.units.ceba.indirectCostUsd : sum('indirectCostUsd'))} />
            {tab === 'todo' && <LineRow label="Asignado a Leche y cría" value={usd(bal.units.leche.indirectCostUsd)} />}
            <p className="text-xs text-slate-700">Prorrateo por defecto: {num(bal.defaultCebaPct, 0)} % Ceba / {num(100 - bal.defaultCebaPct, 0)} % Leche y cría ({config.prorateMethod === 'cabezas' ? 'por animales' : 'configuración'}).</p>
          </Card>
          <Card title="Indicadores">
            {tab !== 'ceba' && <LineRow label={`Costo por litro (${num(bal.litersProduced, 0)} L)`} value={bal.costPerLiterUsd !== null ? usd(bal.costPerLiterUsd) : '—'} />}
            {tab !== 'ceba' && <LineRow label="Margen por litro" value={marginLiter !== null ? usd(marginLiter) : '—'} tone={marginLiter !== null && marginLiter < 0 ? 'text-rose-700' : undefined} />}
            {tab !== 'leche' && <LineRow label={`Costo por kg ganado (${num(bal.kgProducedCeba, 0)} kg)`} value={bal.costPerKgUsd !== null ? usd(bal.costPerKgUsd) : '—'} />}
            {tab !== 'leche' && <LineRow label="Margen por kg" value={marginKg !== null ? usd(marginKg) : '—'} tone={marginKg !== null && marginKg < 0 ? 'text-rose-700' : undefined} />}
            {u?.marginPct !== null && u?.marginPct !== undefined && <LineRow label="Margen neto" value={`${num(u.marginPct, 1)} %`} />}
          </Card>
        </>
      )}

      <Card title="Flujo de caja del mes">
        <div className="space-y-2">
          {[
            ['Ingresos real', cf.incomeToDateUsd, 'bg-emerald-600'],
            ['Ingresos proyectado', cf.projectedIncomeUsd, 'bg-emerald-300'],
            ['Egresos real', cf.expenseToDateUsd, 'bg-rose-600'],
            ['Egresos proyectado', cf.projectedExpenseUsd, 'bg-rose-300'],
          ].map(([l, v, c]) => (
            <div key={l as string} className="flex items-center gap-2">
              <span className="w-32 text-xs font-bold text-slate-800">{l as string}</span>
              <span className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                <span className={`block h-full ${c as string}`} style={{ width: `${((v as number) / cfMax) * 100}%` }} />
              </span>
              <span className="w-24 text-right text-sm font-black tabular-nums">{usd(v as number)}</span>
            </div>
          ))}
        </div>
        <p className={`text-base font-black ${cf.projectedNetUsd >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
          Si sigue igual, cierras el mes con {cf.projectedNetUsd >= 0 ? '+' : ''}
          {usd(cf.projectedNetUsd)}
        </p>
        <p className="text-xs text-slate-700">
          Día {cf.daysElapsed} de {cf.daysInMonth}. Proyección lineal de los movimientos bovinos (incluye compras de almacén como egreso de caja).
        </p>
      </Card>

      {(openCeba.length > 0 || liqs.length > 0) && (
        <Card title="Liquidación de lotes de ceba">
          {openCeba.map((l) => (
            <button key={l.id} type="button" onClick={() => navigate({ s: 'liquidacion', loteId: l.id })} className={`w-full min-h-12 flex items-center justify-between gap-2 text-left ${FOCUS_B}`}>
              <span className="text-sm font-bold text-slate-900">{l.name}</span>
              <StatusChip tone="info">Liquidar</StatusChip>
            </button>
          ))}
          {liqs.map((l) => (
            <button key={l.id} type="button" onClick={() => navigate({ s: 'liquidacion', loteId: l.lotId })} className={`w-full min-h-12 flex items-center justify-between gap-2 text-left ${FOCUS_B}`}>
              <span className="text-sm font-bold text-slate-900">
                {l.lotName} · {fd(l.date)}
              </span>
              <span className={`text-sm font-black tabular-nums ${l.snapshot.profitUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{usd(l.snapshot.profitUsd)}</span>
            </button>
          ))}
        </Card>
      )}

      <Card title={`Movimientos (${docs.length})`}>
        {docs.length === 0 && <p className="text-sm text-slate-800">Sin ingresos ni gastos registrados en el periodo.</p>}
        <ul className="divide-y divide-slate-100">
          {docs.map((f) => {
            const isIn = f.kind === 'ingreso';
            const unit = f.kind === 'liquidacion' ? 'ceba' : (f as BovinoIncome | BovinoExpense).unit;
            return (
              <li key={f.id} className="py-2 flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 truncate">{label(f)}</span>
                  <span className="block text-xs text-slate-700 truncate">
                    {fd(f.date)} · {BOVINO_UNIT_LABEL[unit]}
                    {f.kind === 'gasto' && (f as BovinoExpense).unit === 'general' ? ` (${num((f as BovinoExpense).cebaPct ?? 0, 0)} % ceba)` : ''} · {nameOf(f.createdBy, f.createdByName)}
                  </span>
                </span>
                <span className={`text-sm font-black tabular-nums text-right ${f.kind === 'liquidacion' ? 'text-slate-900' : isIn ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {f.kind === 'liquidacion' ? '' : isIn ? '+' : '−'}
                  {showLocal && f.money.local !== undefined && f.money.currency ? `${num(f.money.local, 2)} ${f.money.currency}` : usd(f.money.usd)}
                </span>
                <button type="button" aria-label="Eliminar registro" onClick={() => setDel(f)} className={`w-11 h-11 rounded-xl flex items-center justify-center text-rose-700 ${FOCUS_B}`}>
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {sheet === 'ingreso' && <IngresoSheet onClose={() => setSheet(null)} />}
      {sheet === 'gasto' && <GastoSheet onClose={() => setSheet(null)} />}
      {sheet && typeof sheet === 'object' && <VentaGanadoSheet animalIds={sheet.venta} onClose={() => setSheet(null)} />}
      {del && (
        <BottomSheet title="Eliminar registro" subtitle={`${label(del)} · ${usd(del.money.usd)}`} icon={<Trash2 className="w-5 h-5" />} iconClass="bg-rose-100 text-rose-700" onClose={() => setDel(null)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-900">
              {del.kind === 'liquidacion' ? 'El lote vuelve a quedar abierto.' : del.kind === 'ingreso' && (del as BovinoIncome).animalIds?.length ? 'Los animales vendidos vuelven a quedar activos.' : 'También se elimina su movimiento del balance general.'} Queda en la bitácora.
            </p>
            <Field label="Motivo (obligatorio)">
              <TextField value={reason} onChange={setReason} placeholder="Ej. registro duplicado" />
            </Field>
            <ErrorBox error={error} />
            <PrimaryBtn
              className="w-full"
              tone="rose"
              disabled={reason.trim().length < 3}
              onClick={() => {
                if (reason.trim().length < 3) return setError('Escribe el motivo.');
                run(() => actions.deleteFinance({ financeId: del.id, reason: reason.trim() }), () => {
                  setDel(null);
                  setReason('');
                });
              }}
            >
              Eliminar
            </PrimaryBtn>
          </div>
        </BottomSheet>
      )}
    </Screen>
  );
}
