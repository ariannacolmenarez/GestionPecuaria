/** A6 · Potreros: ocupación, descanso y "Mover aquí"; detalle con historial de ocupaciones. */
import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Map as MapIcon, Search, Trash2 } from 'lucide-react';
import { useBovino } from '../context';
import type { BovinoPaddockView } from '../../../../models/bovinoCalc';
import { paddockStatusInfo } from '../pickers';
import { B, ChipFilter, ConfirmDialog, EmptyBlock, ErrorBox, Fab, FOCUS_B, KV, PrimaryBtn, Screen, SecondaryBtn, WarnNotice, fd, num, plural, useDomainRunner } from '../ui';

type F = 'todos' | 'disponible' | 'ocupado' | 'descanso';

export const Potreros: React.FC = () => {
  const { home, perms, openSheet, navigate, index } = useBovino();
  const [f, setF] = useState<F>('todos');
  const count = (s: F) => (s === 'todos' ? home.paddocks.length : home.paddocks.filter((p) => p.status === s).length);
  const list = useMemo(() => home.paddocks.filter((p) => f === 'todos' || p.status === f).sort((a, b) => a.paddock.name.localeCompare(b.paddock.name)), [home.paddocks, f]);
  const lotName = (id: string) => index.lotsById.get(id)?.name;
  return (
    <div className="relative min-h-full">
      <div className="p-4 space-y-3 pb-28">
        {home.paddocks.length > 0 && (
          <ChipFilter
            options={[
              { key: 'todos', label: 'Todos', count: count('todos') },
              { key: 'disponible', label: 'Disponibles', count: count('disponible') },
              { key: 'ocupado', label: 'Ocupados', count: count('ocupado') },
              { key: 'descanso', label: 'En descanso', count: count('descanso') },
            ]}
            value={f}
            onChange={setF}
            ariaLabel="Estado del potrero"
          />
        )}
        {home.paddocks.length === 0 ? (
          <EmptyBlock
            icon={<MapIcon className="w-8 h-8" />}
            title="Sin potreros creados"
            text="Crea tu primer potrero para organizar el pastoreo, la ocupación y el descanso."
            cta={perms.moverLotes ? 'Registrar potrero' : undefined}
            onCta={() => openSheet({ kind: 'potrero' })}
          />
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Ningún potrero en este estado.</p>
        ) : (
          list.map((pv) => <PaddockCard key={pv.paddock.id} pv={pv} lotName={lotName} onOpen={() => navigate({ s: 'potrero', id: pv.paddock.id })} />)
        )}
      </div>
      {perms.moverLotes && home.paddocks.length > 0 && <Fab label="Nuevo potrero" onClick={() => openSheet({ kind: 'potrero' })} />}
    </div>
  );
};

/** Barra de progreso del descanso (verde al completarse). */
const RestBar: React.FC<{ pv: BovinoPaddockView }> = ({ pv }) => {
  const rest = pv.paddock.restDays || 0;
  if (pv.status !== 'descanso' || rest <= 0) return null;
  const pct = Math.min(100, Math.round((pv.restingDays / rest) * 100));
  return (
    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" role="img" aria-label={`Descanso ${pv.restingDays} de ${rest} días`}>
      <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
    </div>
  );
};

const PaddockCard: React.FC<{ pv: BovinoPaddockView; lotName: (id: string) => string | undefined; onOpen: () => void }> = ({ pv, lotName, onOpen }) => {
  const { perms, openSheet } = useBovino();
  const info = paddockStatusInfo(pv, lotName);
  return (
    <div className={`${B.card} p-4 space-y-2`}>
      <button type="button" onClick={onOpen} className={`w-full text-left space-y-1.5 rounded-xl ${FOCUS_B}`}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-slate-900 truncate">{pv.paddock.name}</p>
            <p className="text-xs text-slate-700">
              {[pv.paddock.areaHa ? `${num(pv.paddock.areaHa, 1)} ha` : '', pv.paddock.grass || '', pv.paddock.capacityHeads ? `capacidad ${pv.paddock.capacityHeads} cab.` : ''].filter(Boolean).join(' · ') || 'Sin datos de área'}
            </p>
          </div>
          {info.chip}
        </div>
        <p className="text-sm text-slate-900">{info.detail}</p>
        <RestBar pv={pv} />
        {pv.overCapacity && <WarnNotice>Sobre su capacidad: {pv.heads} cabezas.</WarnNotice>}
      </button>
      {perms.moverLotes && pv.status !== 'mantenimiento' && (
        <SecondaryBtn className="w-full" onClick={() => openSheet({ kind: 'mover', toPaddockId: pv.paddock.id })}>
          <ArrowRightLeft className="w-5 h-5" /> Mover aquí
        </SecondaryBtn>
      )}
    </div>
  );
};

export const PotreroDetail: React.FC<{ id: string }> = ({ id }) => {
  const { home, selectors, index, perms, openSheet, navigate, actions, back } = useBovino();
  const pv = home.paddocks.find((p) => p.paddock.id === id);
  const history = useMemo(() => [...selectors.paddockHistory(id)].reverse(), [selectors, id]);
  const [ask, setAsk] = useState(false);
  const { error, run, confirmEl } = useDomainRunner();
  if (!pv) return <EmptyBlock icon={<Search className="w-8 h-8" />} title="Potrero no encontrado" cta="Volver" onCta={back} />;
  const lotName = (lid: string) => index.lotsById.get(lid)?.name;
  const info = paddockStatusInfo(pv, lotName);
  // Descanso promedio: días entre la salida de una estancia y la entrada siguiente
  const chrono = [...history].reverse();
  const rests: number[] = [];
  for (let i = 1; i < chrono.length; i++) {
    const prevOut = chrono[i - 1].to;
    if (prevOut && chrono[i].from >= prevOut) rests.push(Math.round((Date.parse(chrono[i].from) - Date.parse(prevOut)) / 86400000));
  }
  const avgRest = rests.length ? Math.round(rests.reduce((s, x) => s + x, 0) / rests.length) : null;
  return (
    <Screen>
      <section className={`${B.card} p-4 space-y-3`}>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-xl font-black text-slate-900">{pv.paddock.name}</p>
          {info.chip}
        </div>
        <p className="text-sm text-slate-900">{info.detail}</p>
        <RestBar pv={pv} />
        <div className="grid grid-cols-2 gap-3">
          <KV k="Área" v={pv.paddock.areaHa ? `${num(pv.paddock.areaHa, 1)} ha` : '—'} />
          <KV k="Pasto" v={pv.paddock.grass || '—'} />
          <KV k="Animales" v={num(pv.heads)} />
          <KV k="Carga" v={pv.headsPerHa !== null ? `${num(pv.headsPerHa, 1)} cab/ha` : '—'} />
          <KV k="Descanso objetivo" v={pv.paddock.restDays ? `${pv.paddock.restDays} d` : '—'} />
          <KV k="Descanso promedio" v={avgRest !== null ? `${avgRest} d` : '—'} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {pv.heads > 0 && <SecondaryBtn onClick={() => navigate({ s: 'animales', filtro: { paddockId: id } }, 'hato')}>Ver animales</SecondaryBtn>}
          {perms.moverLotes && pv.status !== 'mantenimiento' && (
            <PrimaryBtn className="h-12 text-sm" onClick={() => openSheet({ kind: 'mover', toPaddockId: id })}>
              Mover aquí
            </PrimaryBtn>
          )}
          {perms.moverLotes && <SecondaryBtn onClick={() => openSheet({ kind: 'potrero', paddockId: id })}>Editar</SecondaryBtn>}
          {perms.administrar && (
            <SecondaryBtn onClick={() => setAsk(true)}>
              <Trash2 className="w-5 h-5 text-rose-700" /> Eliminar
            </SecondaryBtn>
          )}
        </div>
        <ErrorBox error={error} />
      </section>

      <section className="space-y-2">
        <p className="text-base font-black text-slate-900">Historial de ocupación</p>
        {history.length === 0 ? (
          <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">Sin ocupaciones registradas.</p>
        ) : (
          <div className={`${B.card} overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-700 text-left">
                  <th className="px-3 py-2 font-bold">Quién</th>
                  <th className="px-3 py-2 font-bold">Entrada</th>
                  <th className="px-3 py-2 font-bold">Salida</th>
                  <th className="px-3 py-2 font-bold text-right">Días</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t border-slate-100 text-slate-900">
                    <td className="px-3 py-2 font-bold">{h.lotId ? lotName(h.lotId) || 'Lote' : h.animalId ? `#${index.views.get(h.animalId)?.tag || '?'}` : '—'}</td>
                    <td className="px-3 py-2">{fd(h.from)}</td>
                    <td className="px-3 py-2">{h.to ? fd(h.to) : 'Actual'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pv.lotIds.length > 0 && <p className="text-xs text-slate-700">Ahora: {pv.lotIds.map(lotName).filter(Boolean).join(', ')} · {plural(pv.heads, 'animal', 'animales')}</p>}
      </section>
      {ask && (
        <ConfirmDialog
          title={`¿Eliminar ${pv.paddock.name}?`}
          message="Solo se puede si nunca tuvo ocupación. Queda en la bitácora."
          confirmLabel="Eliminar"
          danger
          requireText={pv.paddock.name}
          onCancel={() => setAsk(false)}
          onConfirm={() => {
            setAsk(false);
            run(() => actions.deletePaddock({ paddockId: id }), () => back());
          }}
        />
      )}
      {confirmEl}
    </Screen>
  );
};
