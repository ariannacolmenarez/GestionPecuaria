/** A4 · Ficha del animal: datos, acciones según rol y estado, y pestañas Resumen | Historial | Producción | Sanidad. */
import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Baby, Ban, DollarSign, Heart, LogOut, Milk, Scale, Search, Stethoscope, Syringe } from 'lucide-react';
import type { BovinoStockOutEvent, BovinoTreatmentEvent } from '../../../../models/bovinoModel';
import { BOVINO_PURPOSE_LABEL } from '../../../../models/bovinoModel';
import { gmdColorOf, BOVINO_REPRO_LABEL, pendingDeathReport } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import { useBovino } from '../context';
import { B, EmptyBlock, FOCUS_B, GmdChip, KV, Money, ReproChip, RetiroChip, Screen, StatusChip, ageText, fd, fdy, num } from '../ui';
import { SegmentedTabs } from '../../avicola/shared';
import { AnimalTimeline } from './AnimalTimeline';
import { describeEvent } from './eventText';

type Tab = 'resumen' | 'historial' | 'produccion' | 'sanidad';

export const AnimalFicha: React.FC<{ id: string }> = ({ id }) => {
  const { index, perms, navigate, openSheet, today, data } = useBovino();
  const v = index.views.get(id);
  const [tab, setTab] = useState<Tab>('resumen');
  const events = useMemo(() => index.eventsByAnimal.get(id) || [], [index, id]);
  const deathReport = useMemo(() => (v ? pendingDeathReport(v, events) : null), [v, events]);

  const costUsd = useMemo(() => {
    if (!v) return 0;
    const animalOuts = data.events.filter((e) => e.kind === 'salida' && (e as BovinoStockOutEvent).destination?.animalId === id) as BovinoStockOutEvent[];
    const outIds = new Set(animalOuts.map((e) => e.id));
    let c = (v.animal.purchase?.money.usd || 0) + animalOuts.reduce((s, e) => s + (e.cost?.usd || 0), 0);
    events.forEach((e) => {
      if (e.kind === 'tratamiento') {
        const t = e as BovinoTreatmentEvent;
        if (t.stockOutId && !outIds.has(t.stockOutId)) c += t.cost?.usd || 0;
      }
    });
    return c;
  }, [v, data.events, events, id]);

  if (!v) return <EmptyBlock icon={<Search className="w-8 h-8" />} title="Animal no encontrado" text="Pudo ser eliminado en otro teléfono." />;

  const a = v.animal;
  const r = v.repro;
  const female = v.sex === 'hembra';
  const lotName = v.lotId ? index.lotsById.get(v.lotId)?.name : undefined;
  const padName = v.paddockId ? index.paddocksById.get(v.paddockId)?.name : undefined;
  const padDays = v.paddockSince ? daysBetween(v.paddockSince, today) : null;
  const ro = !v.active;
  const isFemaleRepro = female && (v.category === 'vaca' || v.category === 'novilla');
  const blockedService = r && (r.pregnant || r.state === 'seca') ? (r.pregnant ? `Preñada${r.fpp ? ` (FPP ${fd(r.fpp)})` : ''}` : 'Seca') : null;
  const mother = a.motherId ? index.views.get(a.motherId) : undefined;
  const calves = index.list.filter((x) => x.animal.motherId === id);

  type Act = { key: string; label: string; icon: React.ReactNode; onClick: () => void; allowed: boolean; reason?: string | null; show: boolean };
  const acts: Act[] = [
    { key: 'pesar', label: 'Pesar', icon: <Scale className="w-6 h-6" />, onClick: () => openSheet({ kind: 'pesaje', animalId: id }), allowed: perms.cargaDiaria, show: true },
    { key: 'tratar', label: 'Tratar', icon: <Syringe className="w-6 h-6" />, onClick: () => openSheet({ kind: 'tratamiento', animalIds: [id] }), allowed: perms.sanidad, show: true },
    { key: 'mover', label: 'Mover', icon: <ArrowRightLeft className="w-6 h-6" />, onClick: () => openSheet({ kind: 'mover', animalIds: [id] }), allowed: perms.moverLotes, show: true },
    { key: 'ordeno', label: 'Ordeño', icon: <Milk className="w-6 h-6" />, onClick: () => navigate({ s: 'leche', ordenar: true }, 'campo'), allowed: perms.cargaDiaria, show: !!r?.lactating },
    { key: 'servicio', label: 'Servicio', icon: <Heart className="w-6 h-6" />, onClick: () => navigate({ s: 'servicios', animalId: id }, 'repro'), allowed: perms.reproduccion, reason: blockedService, show: isFemaleRepro },
    { key: 'diag', label: 'Diagnóstico', icon: <Stethoscope className="w-6 h-6" />, onClick: () => navigate({ s: 'diagnosticos', animalId: id }, 'repro'), allowed: perms.reproduccion, show: isFemaleRepro },
    { key: 'parto', label: 'Parto', icon: <Baby className="w-6 h-6" />, onClick: () => navigate({ s: 'partos', animalId: id }, 'repro'), allowed: perms.cargaDiaria, show: isFemaleRepro },
    { key: 'baja', label: perms.bajas ? 'Baja' : 'Reportar muerte', icon: <LogOut className="w-6 h-6" />, onClick: () => openSheet({ kind: 'baja', animalId: id }), allowed: true, show: true },
    { key: 'venta', label: 'Venta', icon: <DollarSign className="w-6 h-6" />, onClick: () => navigate({ s: 'balance', venta: [id] }, 'mas'), allowed: perms.ventas, reason: v.withdrawal.meatActive ? `Retiro carne hasta ${fd(v.withdrawal.meatUntil)}` : null, show: perms.ventas },
  ];

  return (
    <div>
      {ro && (
        <div className="bg-slate-800 text-white px-4 py-3 text-sm font-bold">
          {v.status === 'vendido' ? 'Vendido' : v.status === 'muerto' ? 'Muerto' : 'Descartado'}
          {v.exitDate ? ` el ${fd(v.exitDate)}` : ''} · solo lectura
        </div>
      )}
      <Screen>
        <section className={`${B.card} p-4 space-y-3`}>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-black tabular-nums text-slate-900 leading-none">#{v.tag}</p>
            {a.name && <p className="text-lg font-bold text-slate-900 truncate">{a.name}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip tone="info">{v.categoryLabel}</StatusChip>
            <StatusChip tone="neutral">{female ? 'Hembra' : 'Macho'}</StatusChip>
            <StatusChip tone="neutral">{BOVINO_PURPOSE_LABEL[v.purpose]}</StatusChip>
            {isFemaleRepro && r && <ReproChip state={r.state} />}
            <RetiroChip w={v.withdrawal} />
            {deathReport && <StatusChip tone="warn">Muerte reportada · por confirmar</StatusChip>}
            {/^P-\d+/i.test(v.tag) && <StatusChip tone="warn">Arete pendiente</StatusChip>}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <KV k="Edad" v={`${ageText(v.ageDays)}${!a.birthDate && v.ageDays !== null ? ' (aprox.)' : ''}`} />
            <KV k="Raza" v={a.breed || '—'} />
            <KV k="Lote" v={lotName || 'Sin lote'} />
            <KV k="Potrero" v={padName ? `${padName}${padDays !== null ? ` (${padDays} d)` : ''}` : '—'} />
            <KV k="Último peso" v={v.weightKg !== null ? `${num(v.weightKg, 1)} kg · hace ${v.daysSinceWeigh ?? 0} d` : 'Sin pesar'} />
            <div className="min-w-0">
              <p className="text-xs text-slate-700">GMD</p>
              <GmdChip gmd={v.gmdKg} color={v.gmdColor} />
            </div>
            {female && r && r.parity > 0 && <KV k="Partos" v={num(r.parity)} />}
            {female && r?.lactating && r.daysSinceCalving !== null && <KV k="Días en leche" v={num(r.daysSinceCalving)} />}
            {female && r?.fpp && <KV k="Parto probable" v={fdy(r.fpp)} />}
            {v.lastMilkLiters !== null && <KV k="Último ordeño" v={`${num(v.lastMilkLiters, 1)} L`} />}
          </div>
          {perms.verCostos && (
            <p className="text-sm font-bold text-slate-900">
              Costo acumulado: <Money value={costUsd} showLocal={false} />
            </p>
          )}
        </section>

        {!ro && (
          <section className="grid grid-cols-3 gap-2">
            {acts
              .filter((x) => x.show)
              .map((x) => {
                const disabled = !x.allowed || !!x.reason;
                return (
                  <button
                    key={x.key}
                    type="button"
                    disabled={disabled}
                    onClick={x.onClick}
                    className={`min-h-16 py-2 px-1 rounded-2xl bg-white border-2 border-slate-200 flex flex-col items-center justify-center gap-1 text-xs font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 ${FOCUS_B}`}
                  >
                    {x.reason ? <Ban className="w-6 h-6 text-rose-700" /> : <span className="text-sky-700">{x.icon}</span>}
                    {x.label}
                    {!x.allowed ? <span className="text-[12px] font-semibold leading-tight text-center">Lo registra el encargado</span> : x.reason ? <span className="text-[12px] font-semibold leading-tight text-center text-rose-800">{x.reason}</span> : null}
                  </button>
                );
              })}
          </section>
        )}

        <SegmentedTabs
          tabs={[
            { id: 'resumen', label: 'Resumen' },
            { id: 'historial', label: 'Historial' },
            { id: 'produccion', label: 'Producción' },
            { id: 'sanidad', label: 'Sanidad' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'resumen' && (
          <section className="space-y-3">
            {isFemaleRepro && r && (
              <div className={`${B.card} p-4 space-y-1`}>
                <p className="text-base font-black text-slate-900">{BOVINO_REPRO_LABEL[r.state]}</p>
                <p className="text-sm text-slate-900">
                  {[
                    r.pregnant && r.conceptionDate ? `Preñada de ${daysBetween(r.conceptionDate, today)} días` : '',
                    r.dryOffDate && !r.dried ? `Secar el ${fd(r.dryOffDate)}` : '',
                    r.fpp ? `Parto el ${fd(r.fpp)}` : '',
                    r.state === 'servida' && r.lastServiceDate ? `Servida el ${fd(r.lastServiceDate)}${r.diagnosisDueDate ? ` · palpar el ${fd(r.diagnosisDueDate)}` : ''}` : '',
                    r.lastCalvingDate && !r.pregnant ? `Último parto ${fd(r.lastCalvingDate)}${r.pevReached ? ' · PEV cumplido' : r.pevDate ? ` · PEV el ${fd(r.pevDate)}` : ''}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin eventos reproductivos.'}
                </p>
              </div>
            )}
            {(v.withdrawal.meatActive || v.withdrawal.milkActive) && (
              <div className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-3 text-sm text-rose-900 font-semibold">
                {v.withdrawal.meatActive && <p>Retiro carne hasta {fdy(v.withdrawal.meatUntil)}: no se puede vender.</p>}
                {v.withdrawal.milkActive && <p>Retiro leche hasta {fdy(v.withdrawal.milkUntil)}: su leche va a descarte.</p>}
                {v.withdrawal.products.length > 0 && <p className="text-xs">Producto: {v.withdrawal.products.join(', ')}</p>}
              </div>
            )}
            {(mother || calves.length > 0) && (
              <div className={`${B.card} p-4 space-y-2`}>
                {mother && (
                  <button type="button" onClick={() => navigate({ s: 'animal', id: mother.id })} className={`text-sm font-bold text-sky-700 underline ${FOCUS_B}`}>
                    Madre: #{mother.tag}
                  </button>
                )}
                {calves.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-bold text-slate-900">Crías:</span>
                    {calves.map((c) => (
                      <button key={c.id} type="button" onClick={() => navigate({ s: 'animal', id: c.id })} className={`h-10 px-3 rounded-full bg-sky-50 border-2 border-sky-200 text-sm font-bold text-sky-900 ${FOCUS_B}`}>
                        #{c.tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-black text-slate-900">Últimos registros</p>
              {events.length === 0 && <p className="text-sm text-slate-800">Sin registros después del ingreso.</p>}
              {[...events]
                .reverse()
                .slice(0, 3)
                .map((e) => {
                  const d = describeEvent(e, index);
                  return (
                    <p key={e.id} className="text-sm text-slate-900 bg-white rounded-xl border border-slate-200 px-3 py-2">
                      <strong>{fd(e.date)}</strong> · {d.title}
                    </p>
                  );
                })}
            </div>
            {a.notes && <p className="text-sm text-slate-900 bg-white rounded-xl border border-slate-200 p-3">{a.notes}</p>}
          </section>
        )}

        {tab === 'historial' && <AnimalTimeline view={v} />}

        {tab === 'produccion' && (
          <section className="space-y-3">
            {r?.lactating || (female && r && r.parity > 0) ? (
              <button type="button" onClick={() => navigate({ s: 'lactancia', vacaId: id }, 'campo')} className={`w-full h-12 rounded-2xl bg-sky-600 text-white font-bold ${FOCUS_B}`}>
                Ver curva de lactancia
              </button>
            ) : null}
            <div className={`${B.card} overflow-hidden`}>
              <table className="w-full text-sm">
                <caption className="text-left px-3 pt-3 text-sm font-black text-slate-900">Pesajes</caption>
                <thead>
                  <tr className="text-xs text-slate-700 text-left">
                    <th className="px-3 py-2 font-bold">Fecha</th>
                    <th className="px-3 py-2 font-bold text-right">Peso</th>
                    <th className="px-3 py-2 font-bold text-right">GMD</th>
                  </tr>
                </thead>
                <tbody>
                  {v.weights.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-slate-800">
                        Sin pesajes.
                      </td>
                    </tr>
                  )}
                  {[...v.weights].reverse().map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const days = prev ? daysBetween(prev.date, p.date) : 0;
                    const g = prev && days > 0 ? (p.kg - prev.kg) / days : null;
                    return (
                      <tr key={`${p.date}-${i}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-900">
                          {fd(p.date)} <span className="text-xs text-slate-700">{p.source !== 'pesaje' ? `(${p.source})` : ''}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-black tabular-nums text-slate-900">{num(p.kg, 1)} kg</td>
                        <td className="px-3 py-2 text-right">{g !== null ? <GmdChip gmd={Math.round(g * 1000) / 1000} color={gmdColorOf(g, index.config)} /> : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'sanidad' && <TreatmentsList animalId={id} />}
      </Screen>
    </div>
  );
};

/** Tratamientos del animal con fin de retiro y efectividad (Evaluar). */
export const TreatmentsList: React.FC<{ animalId?: string; events?: BovinoTreatmentEvent[] }> = ({ animalId, events }) => {
  const { index, perms, openSheet, today, navigate } = useBovino();
  const list = useMemo(
    () => (events || ((index.eventsByAnimal.get(animalId || '') || []).filter((e) => e.kind === 'tratamiento') as BovinoTreatmentEvent[])).slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
    [events, index, animalId]
  );
  if (!list.length) return <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Sin tratamientos registrados.</p>;
  return (
    <ul className="space-y-2">
      {list.map((t) => {
        const view = t.animalId ? index.views.get(t.animalId) : undefined;
        const meatOn = t.meatWithdrawalUntil && t.meatWithdrawalUntil >= today;
        const milkOn = t.milkWithdrawalUntil && t.milkWithdrawalUntil >= today;
        return (
          <li key={t.id} className="bg-white rounded-2xl border-2 border-slate-200 p-3 space-y-1">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900">
                  {!animalId && view && (
                    <button type="button" onClick={() => navigate({ s: 'animal', id: view.id }, 'hato')} className={`underline text-sky-800 mr-1 ${FOCUS_B}`}>
                      #{view.tag}
                    </button>
                  )}
                  {t.productName} · {num(t.dose, 2)} {t.doseUnit}
                </p>
                <p className="text-xs text-slate-700">
                  {fdy(t.date)} · {t.purpose === 'curativo' ? 'Curativo' : 'Preventivo'}
                  {t.diagnosis ? ` · ${t.diagnosis}` : ''}
                  {t.mfgLot ? ` · Lote ${t.mfgLot}` : ''} · {t.createdByName}
                </p>
              </div>
              {t.effectiveness && t.effectiveness !== 'pendiente' && (
                <StatusChip tone={t.effectiveness === 'efectivo' ? 'ok' : t.effectiveness === 'parcial' ? 'warn' : 'bad'}>
                  {t.effectiveness === 'efectivo' ? 'Curado' : t.effectiveness === 'parcial' ? 'Mejoró' : 'Sin respuesta'}
                </StatusChip>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.meatWithdrawalUntil && <StatusChip tone={meatOn ? 'retiro' : 'neutral'}>{`Carne hasta ${fd(t.meatWithdrawalUntil)}`}</StatusChip>}
              {t.milkWithdrawalUntil && <StatusChip tone={milkOn ? 'retiro' : 'neutral'}>{`Leche hasta ${fd(t.milkWithdrawalUntil)}`}</StatusChip>}
              {perms.verCostos && t.cost && <StatusChip tone="neutral">{`US$ ${t.cost.usd.toFixed(2)}`}</StatusChip>}
            </div>
            {t.effectiveness === 'pendiente' && perms.sanidad && (
              <button type="button" onClick={() => openSheet({ kind: 'evaluar', eventId: t.id })} className={`h-11 px-4 rounded-2xl bg-amber-100 border-2 border-amber-300 text-amber-950 text-sm font-bold ${FOCUS_B}`}>
                Evaluar tratamiento
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
