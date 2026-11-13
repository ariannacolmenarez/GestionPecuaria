/** A5 · Detalle de lote: cabecera, acciones y pestañas Animales | Indicadores | Movimientos. */
import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, EllipsisVertical, Package, Plus, Search, Syringe, UserMinus, Users } from 'lucide-react';
import { useBovino } from '../context';
import { BOVINO_LOT_TYPE_LABEL } from '../../../../models/bovinoModel';
import { daysBetween } from '../../../../utils/dates';
import { AnimalSearch } from '../pickers';
import { SegmentedTabs } from '../../avicola/shared';
import { AnimalRow, B, BottomSheet, EmptyBlock, ErrorBox, FOCUS_B, GmdChip, KV, Money, PrimaryBtn, Screen, SecondaryBtn, StatStrip, StatusChip, fd, num, plural, useDomainRunner } from '../ui';
import { EventList } from '../animales/AnimalTimeline';
import { LotMenu } from './Lotes';

type Tab = 'animales' | 'indicadores' | 'movimientos';

export const LoteDetail: React.FC<{ id: string }> = ({ id }) => {
  const { data, selectors, index, today, perms, openSheet, navigate, actions, back } = useBovino();
  const lot = data.lots.find((l) => l.id === id);
  const lv = useMemo(() => (lot ? selectors.lotView(lot.id) : null), [selectors, lot]);
  const [tab, setTab] = useState<Tab>('animales');
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const { error, run, confirmEl } = useDomainRunner();

  const members = useMemo(() => index.active.filter((v) => v.lotId === id).sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true })), [index, id]);
  const lotEvents = useMemo(() => [...(index.eventsByLot.get(id) || [])].filter((e) => e.kind === 'movimiento' || e.kind === 'salida' || e.kind === 'racion' || (e.kind === 'pesaje' && (e as any).lotAverage)).reverse(), [index, id]);

  if (!lot || !lv) return <EmptyBlock icon={<Search className="w-8 h-8" />} title="Lote no encontrado" text="Pudo ser eliminado." cta="Volver" onCta={back} />;
  const closed = lot.status !== 'abierto';
  const pad = lv.paddockId ? index.paddocksById.get(lv.paddockId)?.name : undefined;
  const padDays = lv.paddockSince ? daysBetween(lv.paddockSince, today) : null;

  return (
    <div>
      {closed && <div className="bg-slate-800 text-white px-4 py-3 text-sm font-bold">Lote cerrado{lot.closedAt ? ` el ${fd(lot.closedAt)}` : ''}{lot.liquidationId ? ' · liquidado' : ''} · solo lectura</div>}
      <Screen>
        <section className={`${B.card} p-4 space-y-3`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black text-slate-900">{lot.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <StatusChip tone="info">{BOVINO_LOT_TYPE_LABEL[lot.type]}</StatusChip>
                <StatusChip tone="neutral">{lv.unit === 'ceba' ? 'Ceba' : lv.unit === 'leche' ? 'Leche y cría' : 'General'}</StatusChip>
                {lv.withdrawalActive > 0 && <StatusChip tone="retiro">{`${lv.withdrawalActive} en retiro`}</StatusChip>}
              </div>
              <p className="text-sm text-slate-900 mt-1">{pad ? `Potrero ${pad}` : 'Sin potrero'}</p>
            </div>
            {(perms.moverLotes || perms.administrar) && (
              <button type="button" onClick={() => setMenu(true)} aria-label="Acciones del lote" className={`w-12 h-12 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-900 ${FOCUS_B}`}>
                <EllipsisVertical className="w-6 h-6" />
              </button>
            )}
          </div>
          <StatStrip
            items={[
              { label: 'Animales', value: num(lv.heads) },
              { label: 'Peso prom.', value: lv.avgWeightKg !== null ? `${num(lv.avgWeightKg)}` : '—' },
              { label: 'GMD', value: lv.avgGmdKg !== null ? num(lv.avgGmdKg, 2) : '—' },
              { label: 'Días potrero', value: padDays !== null ? num(padDays) : '—' },
            ]}
          />
          {!closed && (
            <div className="grid grid-cols-3 gap-2">
              {perms.moverLotes && <ActionBtn icon={<ArrowRightLeft className="w-6 h-6" />} label="Mover" onClick={() => openSheet({ kind: 'mover', lotId: id })} />}
              {perms.sanidad && <ActionBtn icon={<Syringe className="w-6 h-6" />} label="Tratar lote" onClick={() => openSheet({ kind: 'tratamiento', lotId: id })} />}
              <ActionBtn icon={<Package className="w-6 h-6" />} label="Salida al lote" onClick={() => openSheet({ kind: 'salida', lotId: id })} />
            </div>
          )}
        </section>

        <SegmentedTabs
          tabs={[
            { id: 'animales', label: 'Animales' },
            { id: 'indicadores', label: 'Indicadores' },
            { id: 'movimientos', label: 'Movimientos' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'animales' && (
          <section className="space-y-2">
            {!closed && perms.moverLotes && (
              <div className="grid grid-cols-2 gap-2">
                <SecondaryBtn onClick={() => setAdding(true)}>
                  <Plus className="w-5 h-5" /> Agregar animales
                </SecondaryBtn>
                {members.length > 0 && (
                  <SecondaryBtn
                    onClick={() => {
                      setRemoving((r) => !r);
                      setSel([]);
                    }}
                  >
                    <UserMinus className="w-5 h-5" /> {removing ? 'Cancelar' : 'Sacar del lote'}
                  </SecondaryBtn>
                )}
              </div>
            )}
            {!closed && perms.altaAnimales && (
              <button type="button" onClick={() => openSheet({ kind: 'alta', lotId: id, paddockId: lv.paddockId })} className={`w-full h-12 rounded-2xl text-sky-700 font-bold ${FOCUS_B}`}>
                + Ingresar ganado nuevo a este lote
              </button>
            )}
            {members.length === 0 ? (
              <EmptyBlock icon={<Users className="w-8 h-8" />} title="El lote no tiene animales" text="Agrega animales del hato o ingresa ganado nuevo." />
            ) : (
              members.map((v) => (
                <AnimalRow
                  key={v.id}
                  v={v}
                  selectable={removing}
                  selected={sel.includes(v.id)}
                  right={v.weightKg !== null ? <span className="text-sm font-black tabular-nums text-slate-900">{num(v.weightKg)} kg</span> : undefined}
                  onClick={() => (removing ? setSel((s) => (s.includes(v.id) ? s.filter((x) => x !== v.id) : [...s, v.id])) : navigate({ s: 'animal', id: v.id }, 'hato'))}
                />
              ))
            )}
            {removing && (
              <>
                <ErrorBox error={error} />
                <PrimaryBtn
                  className="w-full"
                  disabled={!sel.length}
                  onClick={() =>
                    run(
                      (confirm) => actions.moveAnimals({ animalIds: sel, toLotId: null, confirm }),
                      () => {
                        setRemoving(false);
                        setSel([]);
                      }
                    )
                  }
                >
                  Sacar {sel.length || ''} del lote
                </PrimaryBtn>
              </>
            )}
          </section>
        )}

        {tab === 'indicadores' && (
          <section className={`${B.card} p-4 space-y-3`}>
            <div className="grid grid-cols-2 gap-3">
              <KV k="Peso promedio" v={lv.avgWeightKg !== null ? `${num(lv.avgWeightKg, 1)} kg` : '—'} />
              <div>
                <p className="text-xs text-slate-700">GMD del lote</p>
                <GmdChip gmd={lv.avgGmdKg} color={lv.gmdColor} />
              </div>
              {lot.type === 'ceba' && <KV k="Peso objetivo" v={`${num(lv.targetWeightKg)} kg`} />}
              {lot.type === 'ceba' && <KV k="Faena estimada" v={lv.projectedSaleDate ? `${fd(lv.projectedSaleDate)} (${lv.daysToTarget} d)` : 'Sin GMD suficiente'} />}
              <KV k="Alimento entregado" v={`${num(lv.feedKg)} kg`} />
              <KV k="Kg producidos" v={`${num(lv.kgProduced, 1)} kg`} />
              <KV k="Conversión" v={lv.feedConversion !== null ? `${num(lv.feedConversion, 1)} kg alim./kg` : '—'} />
              <KV k="Pesajes atrasados" v={num(lv.weighOverdue)} />
              {perms.verCostos && (
                <div className="min-w-0">
                  <p className="text-xs text-slate-700">Costo directo</p>
                  <p className="text-sm font-bold text-slate-900">
                    <Money value={lv.directCostUsd} showLocal={false} />
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {lot.type === 'ceba' && <SecondaryBtn onClick={() => navigate({ s: 'ceba', loteId: id })}>Ceba y pesajes</SecondaryBtn>}
              {lot.type === 'leche' && <SecondaryBtn onClick={() => navigate({ s: 'leche' })}>Producción de leche</SecondaryBtn>}
            </div>
          </section>
        )}

        {tab === 'movimientos' && <EventList events={lotEvents} empty="Sin movimientos ni salidas imputadas al lote." />}
      </Screen>

      {menu && <LotMenu lot={lot} onClose={() => setMenu(false)} />}
      {adding && (
        <AddAnimalsSheet
          lotId={id}
          onClose={() => setAdding(false)}
          onAdd={(ids) =>
            run(
              (confirm) => actions.moveAnimals({ animalIds: ids, toLotId: id, confirm }),
              () => setAdding(false)
            )
          }
          error={error}
        />
      )}
      {confirmEl}
    </div>
  );
};

const ActionBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button type="button" onClick={onClick} className={`min-h-16 rounded-2xl bg-white border-2 border-slate-200 flex flex-col items-center justify-center gap-1 text-xs font-bold text-slate-900 ${FOCUS_B}`}>
    <span className="text-sky-700">{icon}</span>
    {label}
  </button>
);

/** Selector con búsqueda y multiselección de animales de otros lotes. */
const AddAnimalsSheet: React.FC<{ lotId: string; onClose: () => void; onAdd: (ids: string[]) => void; error?: string | null }> = ({ lotId, onClose, onAdd, error }) => {
  const { index } = useBovino();
  const [ids, setIds] = useState<string[]>([]);
  return (
    <BottomSheet
      title="Agregar animales al lote"
      subtitle={ids.length ? plural(ids.length, 'seleccionado', 'seleccionados') : 'Busca por arete'}
      icon={<Plus className="w-5 h-5" />}
      iconClass="bg-sky-100 text-sky-700"
      onClose={onClose}
      footer={
        <div className="space-y-2">
          <ErrorBox error={error} />
          <PrimaryBtn className="w-full" disabled={!ids.length} onClick={() => onAdd(ids)}>
            Agregar {ids.length || ''}
          </PrimaryBtn>
        </div>
      }
    >
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ids.map((x) => (
            <button key={x} type="button" onClick={() => setIds((l) => l.filter((y) => y !== x))} className={`h-10 px-3 rounded-full bg-sky-600 text-white text-sm font-bold ${FOCUS_B}`} aria-label={`Quitar #${index.views.get(x)?.tag}`}>
              #{index.views.get(x)?.tag} ✕
            </button>
          ))}
        </div>
      )}
      <AnimalSearch excludeIds={ids} filter={(v) => v.lotId !== lotId} onPick={(v) => setIds((l) => [...l, v.id])} />
    </BottomSheet>
  );
};
