/** A1 · Inicio del hato: contadores por categoría, manga, agenda de hoy, alertas y accesos rápidos. */
import React, { useMemo } from 'react';
import { ArrowRightLeft, Beef, Map as MapIcon, Milk, Package, Plus, Scale, Syringe, Timer, TrendingUp, Wheat, Zap, Baby, AlertTriangle } from 'lucide-react';
import { useBovino } from '../context';
import type { BovinoCategoryKey } from '../../../../models/bovinoModel';
import { dailyMilkProduction, isItemExpired } from '../../../../models/bovinoCalc';
import { AgendaItemRow } from '../agenda/AgendaItemRow';
import { B, CounterTile, EmptyBlock, FOCUS_B, Money, Screen, SectionTitle, StatStrip, Tile, num, fd } from '../ui';

export const HatoHome: React.FC = () => {
  const { home, perms, navigate, openSheet, data, index, today, bovinoItems, agenda, goSection, selectors } = useBovino();
  const c = home.counts;
  const hasPaddocks = data.paddocks.length > 0;
  const empty = c.total === 0;

  const counters: { label: string; value: number; cat: BovinoCategoryKey }[] = [
    { label: 'Crías', value: c.crias, cat: 'cria' },
    { label: 'Levante', value: c.levante, cat: 'levante' },
    { label: 'Novillas', value: c.novillas, cat: 'novilla' },
    { label: 'Vacas', value: c.vacasParidas, cat: 'vaca' },
    { label: 'Toros', value: c.toros, cat: 'toro' },
    { label: 'Ceba', value: c.novillos, cat: 'novillo' },
  ];

  const repro = home.dairy;
  // Primero lo vencido (lo más urgente, chip rose) y luego lo de hoy; nada con fecha futura.
  const todayList = useMemo(() => [...agenda.filter((a) => a.overdue), ...agenda.filter((a) => !a.overdue && a.date <= today)], [agenda, today]);
  const overdueCount = useMemo(() => agenda.filter((a) => a.overdue).length, [agenda]);
  const monthBal = useMemo(() => (perms.verBalance ? selectors.balance(`${today.slice(0, 7)}-01`, today) : null), [perms.verBalance, selectors, today]);
  const retiros = useMemo(() => index.active.filter((v) => v.withdrawal.meatActive || v.withdrawal.milkActive).length, [index]);
  const expired = useMemo(() => bovinoItems.filter((i) => isItemExpired(i, today) && (i.quantity || 0) > 0).length, [bovinoItems, today]);
  const drops = useMemo(() => agenda.filter((a) => a.kind === 'caida_leche').length, [agenda]);
  const nextLot = useMemo(
    () => home.lots.filter((l) => l.lot.type === 'ceba' && l.daysToTarget !== null && l.heads > 0).sort((a, b) => (a.daysToTarget as number) - (b.daysToTarget as number))[0],
    [home.lots]
  );
  const milk = useMemo(() => dailyMilkProduction(data.events, today), [data.events, today]);
  const calvingsMonth = useMemo(() => data.events.filter((e) => e.kind === 'parto' && e.date.slice(0, 7) === today.slice(0, 7)).length, [data.events, today]);

  return (
    <Screen>
      {/* 1. Tarjeta del hato */}
      <section className={`${B.card} p-4`}>
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Beef className="w-7 h-7" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-4xl font-black tabular-nums text-slate-900 leading-none">{num(c.total)}</p>
            <p className="text-sm font-bold text-slate-800">animales en la finca</p>
          </div>
          {perms.altaAnimales && (hasPaddocks || !empty) && (
            <button type="button" onClick={() => openSheet({ kind: 'alta' })} className={`h-12 px-3 rounded-2xl bg-sky-600 text-white font-bold text-sm flex items-center gap-1 shrink-0 ${FOCUS_B}`}>
              <Plus className="w-5 h-5" /> Ingresar
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 min-[340px]:grid-cols-3 gap-2 mt-3">
          {counters.map((x) => (
            <CounterTile key={x.cat} label={x.label} value={x.value} onClick={() => navigate({ s: 'animales', filtro: { category: x.cat } })} />
          ))}
        </div>
        {c.vacasParidas + c.novillas > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { label: 'En ordeño', n: repro.cowsLactating, estado: 'ordeno' as const },
              { label: 'Secas', n: repro.cowsDry, estado: 'seca' as const },
              { label: 'Preñadas', n: repro.cowsPregnant, estado: 'preñada' as const },
              { label: 'Vacías', n: repro.cowsOpen, estado: 'vacia' as const },
            ].map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => navigate({ s: 'animales', filtro: { estado: s.estado, sexo: 'hembra' } })}
                className={`h-10 px-3 rounded-full bg-sky-50 border-2 border-sky-200 text-sm font-bold text-sky-900 ${FOCUS_B}`}
              >
                {s.label} <span className="tabular-nums">{s.n}</span>
              </button>
            ))}
          </div>
        )}
        {!empty && (
          <button type="button" onClick={() => navigate({ s: 'animales' })} className={`mt-3 w-full h-12 rounded-2xl text-sky-700 font-bold ${FOCUS_B}`}>
            Ver todos los animales
          </button>
        )}
      </section>

      {empty && (
        <section className={`${B.card}`}>
          <EmptyBlock icon={<Beef className="w-8 h-8" />} title="Aún no hay ganado registrado" text="Empieza creando tus potreros y luego ingresa tus animales por lote o uno a uno.">
            {perms.altaAnimales ? (
              <div className="space-y-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={() => openSheet({ kind: 'potrero' })}
                  className={`w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2 ${hasPaddocks ? 'bg-emerald-100 text-emerald-900' : 'bg-sky-600 text-white'} ${FOCUS_B}`}
                >
                  <MapIcon className="w-5 h-5" /> 1. Crear potrero {hasPaddocks ? '✓' : ''}
                </button>
                <button
                  type="button"
                  disabled={!hasPaddocks}
                  onClick={() => openSheet({ kind: 'alta' })}
                  className={`w-full h-12 rounded-2xl font-bold flex items-center justify-center gap-2 bg-sky-600 text-white disabled:bg-slate-200 disabled:text-slate-700 ${FOCUS_B}`}
                >
                  <Plus className="w-5 h-5" /> 2. Ingresar ganado
                </button>
                {!hasPaddocks && <p className="text-xs text-slate-700">Primero crea un potrero</p>}
              </div>
            ) : (
              <p className="text-sm font-semibold text-slate-800">El encargado registra los potreros y el ingreso del ganado.</p>
            )}
          </EmptyBlock>
        </section>
      )}

      {/* 2. Modo manga */}
      {!empty && (
        <div>
          <button
            type="button"
            onClick={() => navigate({ s: 'manga' })}
            className={`w-full h-16 rounded-2xl bg-slate-900 text-white text-lg font-black flex items-center justify-center gap-3 ${FOCUS_B}`}
          >
            <Zap className="w-6 h-6 text-sky-300" /> MODO MANGA
          </button>
          <p className="text-xs text-slate-700 text-center mt-1">Pesajes y tratamientos animal por animal</p>
        </div>
      )}

      {/* 3. Hoy */}
      {(todayList.length > 0 || !empty) && (
        <section className="space-y-2">
          <SectionTitle>{overdueCount > 0 ? `Vencidas y hoy` : 'Hoy'}</SectionTitle>
          {todayList.length === 0 ? (
            <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Nada pendiente para hoy.</p>
          ) : (
            todayList.slice(0, 5).map((a) => <AgendaItemRow key={a.id} item={a} />)
          )}
          {agenda.length > 0 && (
            <button type="button" onClick={() => goSection('agenda')} className={`w-full h-12 text-sky-700 font-bold rounded-2xl ${FOCUS_B}`}>
              Ver toda la agenda ({agenda.length})
            </button>
          )}
        </section>
      )}

      {/* 4. Alertas */}
      {(retiros > 0 || home.criticalItems > 0 || expired > 0 || drops > 0 || nextLot) && (
        <section className="space-y-2">
          <SectionTitle>Alertas</SectionTitle>
          {retiros > 0 && (
            <AlertCard tone="rose" icon={<Timer className="w-5 h-5" />} text={`${retiros} ${retiros === 1 ? 'animal con retiro activo' : 'animales con retiro activo'}`} onClick={() => navigate({ s: 'sanidad' }, 'campo')} />
          )}
          {(home.criticalItems > 0 || expired > 0) && (
            <AlertCard
              tone="amber"
              icon={<Package className="w-5 h-5" />}
              text={[home.criticalItems ? `${home.criticalItems} en stock crítico` : '', expired ? `${expired} vencido(s)` : ''].filter(Boolean).join(' · ')}
              onClick={() => navigate({ s: 'almacen' }, 'mas')}
            />
          )}
          {drops > 0 && <AlertCard tone="amber" icon={<AlertTriangle className="w-5 h-5" />} text={`Caída de leche en ${drops} vaca(s)`} onClick={() => navigate({ s: 'leche' }, 'campo')} />}
          {nextLot && (
            <AlertCard
              tone="sky"
              icon={<TrendingUp className="w-5 h-5" />}
              text={nextLot.daysToTarget === 0 ? `${nextLot.lot.name} listo para faena` : `${nextLot.lot.name} listo para faena en ${nextLot.daysToTarget} días (${fd(nextLot.projectedSaleDate)})`}
              onClick={() => navigate({ s: 'lote', id: nextLot.lot.id }, 'campo')}
            />
          )}
        </section>
      )}

      {/* 5. Accesos rápidos */}
      {!empty && (
        <section className="space-y-2">
          <SectionTitle>Accesos rápidos</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Tile compact icon={<Milk className="w-5 h-5" />} title="Registrar ordeño" onClick={() => navigate({ s: 'leche', ordenar: true }, 'campo')} />
            <Tile compact icon={<Scale className="w-5 h-5" />} title="Pesaje rápido" onClick={() => navigate({ s: 'ceba', pesar: true }, 'campo')} />
            {perms.sanidad ? (
              <Tile compact icon={<Syringe className="w-5 h-5" />} title="Aplicar tratamiento" onClick={() => openSheet({ kind: 'tratamiento' })} />
            ) : (
              <Tile compact icon={<Wheat className="w-5 h-5" />} title="Registrar ración" onClick={() => navigate({ s: 'ceba', racion: true }, 'campo')} />
            )}
            {perms.moverLotes ? (
              <Tile compact icon={<ArrowRightLeft className="w-5 h-5" />} title="Mover lote" onClick={() => openSheet({ kind: 'mover' })} />
            ) : (
              <Tile compact icon={<Baby className="w-5 h-5" />} title="Reportar nacimiento" onClick={() => navigate({ s: 'partos', nuevo: true }, 'repro')} />
            )}
          </div>
        </section>
      )}

      {/* 6. Producción de hoy */}
      {(milk.liters > 0 || home.ceba.avgGmdKg !== null || calvingsMonth > 0) && (
        <StatStrip
          items={[
            { label: 'Leche hoy', value: `${num(milk.liters, 1)} L` },
            { label: 'L/vaca', value: home.dairy.litersPerCowDay !== null ? num(home.dairy.litersPerCowDay, 1) : '—' },
            { label: 'GMD ceba', value: home.ceba.avgGmdKg !== null ? num(home.ceba.avgGmdKg, 2) : '—' },
            { label: 'Partos mes', value: num(calvingsMonth) },
          ]}
        />
      )}

      {/* 7. Solo Admin: mini balance del mes */}
      {perms.verBalance && !empty && (
        <button type="button" onClick={() => navigate({ s: 'balance' }, 'mas')} className={`${B.card} w-full p-4 text-left ${FOCUS_B}`}>
          <p className="text-sm font-bold text-slate-900">Utilidad del mes (a la fecha)</p>
          <p className={`text-2xl font-black ${home.cashFlow.netToDateUsd < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            <Money value={home.cashFlow.netToDateUsd} showLocal={false} />
          </p>
          <p className="text-sm text-slate-800">
            Ingresos <Money value={home.cashFlow.incomeToDateUsd} showLocal={false} /> · Egresos <Money value={home.cashFlow.expenseToDateUsd} showLocal={false} />
          </p>
          {monthBal && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {(
                [
                  ['Ceba', monthBal.units.ceba.netProfitUsd],
                  ['Leche y cría', monthBal.units.leche.netProfitUsd],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className={`rounded-xl border-2 p-2 ${v < 0 ? 'border-rose-300 bg-rose-50' : 'border-emerald-300 bg-emerald-50'}`}>
                  <p className="text-sm font-bold text-slate-900">{label}</p>
                  <p className={`text-lg font-black tabular-nums ${v < 0 ? 'text-rose-800' : 'text-emerald-800'}`}>
                    <Money value={v} showLocal={false} />
                  </p>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${v < 0 ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}`}>{v < 0 ? 'Pérdida' : 'Ganancia'}</span>
                </div>
              ))}
            </div>
          )}
        </button>
      )}
    </Screen>
  );
};

const AlertCard: React.FC<{ tone: 'rose' | 'amber' | 'sky'; icon: React.ReactNode; text: string; onClick: () => void }> = ({ tone, icon, text, onClick }) => {
  const cls = tone === 'rose' ? 'bg-rose-50 border-rose-300 text-rose-900' : tone === 'amber' ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-sky-50 border-sky-300 text-sky-900';
  return (
    <button type="button" onClick={onClick} className={`w-full min-h-14 px-4 py-2 rounded-2xl border-2 flex items-center gap-3 text-left text-sm font-bold ${cls} ${FOCUS_B}`}>
      {icon}
      <span className="flex-1">{text}</span>
    </button>
  );
};
