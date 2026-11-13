/** A5 · Lista de lotes con filtro por propósito y situación; menú de acciones por lote. */
import React, { useMemo, useState } from 'react';
import { EllipsisVertical, Users } from 'lucide-react';
import { useBovino } from '../context';
import { BOVINO_LOT_TYPE_LABEL, BOVINO_UNIT_LABEL, type BovinoLot, type BovinoLotType } from '../../../../models/bovinoModel';
import { lotUnit, type BovinoLotView } from '../../../../models/bovinoCalc';
import { daysBetween } from '../../../../utils/dates';
import { B, BottomSheet, ChipFilter, ConfirmDialog, EmptyBlock, ErrorBox, Fab, FOCUS_B, GmdChip, MenuRow, StatusChip, fd, num, plural, useDomainRunner } from '../ui';

type TypeFilter = 'todos' | BovinoLotType;

export const Lotes: React.FC = () => {
  const { home, data, perms, openSheet, navigate } = useBovino();
  const [type, setType] = useState<TypeFilter>('todos');
  const [sit, setSit] = useState<'activos' | 'cerrados'>('activos');
  const [menu, setMenu] = useState<BovinoLot | null>(null);
  const active = useMemo(() => home.lots.filter((l) => type === 'todos' || l.lot.type === type), [home.lots, type]);
  const closed = useMemo(() => data.lots.filter((l) => l.status === 'cerrado' && (type === 'todos' || l.type === type)).sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || '')), [data.lots, type]);
  const types: { key: TypeFilter; label: string; count?: number }[] = [
    { key: 'todos', label: 'Todos', count: home.lots.length },
    ...(['ceba', 'leche', 'cria', 'levante', 'otro'] as BovinoLotType[]).map((t) => ({ key: t as TypeFilter, label: BOVINO_LOT_TYPE_LABEL[t], count: home.lots.filter((l) => l.lot.type === t).length })),
  ];
  return (
    <div className="relative min-h-full">
      <div className="p-4 space-y-3 pb-28">
        <ChipFilter options={types} value={type} onChange={setType} ariaLabel="Propósito" />
        <ChipFilter options={[{ key: 'activos', label: 'Activos' }, { key: 'cerrados', label: 'Cerrados', count: closed.length }]} value={sit} onChange={setSit} ariaLabel="Situación" />
        {sit === 'activos' ? (
          active.length === 0 ? (
            <EmptyBlock
              icon={<Users className="w-8 h-8" />}
              title="Sin lotes creados"
              text="Agrupa tus animales para moverlos, pesarlos y llevar sus costos juntos."
              cta={perms.moverLotes ? 'Crear lote' : undefined}
              onCta={() => openSheet({ kind: 'lote' })}
            />
          ) : (
            active.map((lv) => <LotCard key={lv.lot.id} lv={lv} onMenu={() => setMenu(lv.lot)} onOpen={() => navigate({ s: 'lote', id: lv.lot.id })} />)
          )
        ) : closed.length === 0 ? (
          <p className="text-sm text-slate-800 bg-white rounded-2xl border-2 border-slate-200 p-4">No hay lotes cerrados.</p>
        ) : (
          closed.map((l) => (
            <button key={l.id} type="button" onClick={() => navigate({ s: 'lote', id: l.id })} className={`${B.card} w-full p-4 text-left ${FOCUS_B}`}>
              <p className="text-lg font-black text-slate-900">{l.name}</p>
              <p className="text-xs text-slate-700">
                {BOVINO_LOT_TYPE_LABEL[l.type]} · {fd(l.openedAt)} → {l.closedAt ? fd(l.closedAt) : '—'}
                {l.liquidationId ? ' · Liquidado' : ''}
              </p>
            </button>
          ))
        )}
      </div>
      {perms.moverLotes && sit === 'activos' && <Fab label="Nuevo lote" onClick={() => openSheet({ kind: 'lote' })} />}
      {menu && <LotMenu lot={menu} onClose={() => setMenu(null)} />}
    </div>
  );
};

export const LotCard: React.FC<{ lv: BovinoLotView; onOpen: () => void; onMenu?: () => void }> = ({ lv, onOpen, onMenu }) => {
  const { index, today, perms } = useBovino();
  const pad = lv.paddockId ? index.paddocksById.get(lv.paddockId)?.name : undefined;
  const days = lv.paddockSince ? daysBetween(lv.paddockSince, today) : null;
  const milking = index.active.filter((v) => v.lotId === lv.lot.id && v.repro?.lactating).length;
  return (
    <div className={`${B.card} p-4 min-h-28 flex gap-2`}>
      <button type="button" onClick={onOpen} className={`flex-1 min-w-0 text-left space-y-1.5 rounded-xl ${FOCUS_B}`}>
        <p className="text-lg font-black text-slate-900 truncate">{lv.lot.name}</p>
        <div className="flex flex-wrap gap-1.5">
          <StatusChip tone="info">{BOVINO_LOT_TYPE_LABEL[lv.lot.type]}</StatusChip>
          <StatusChip tone="neutral">{lv.unit === 'ceba' ? 'Ceba' : lv.unit === 'leche' ? 'Leche y cría' : 'General'}</StatusChip>
          {lv.withdrawalActive > 0 && <StatusChip tone="retiro">{`${lv.withdrawalActive} en retiro`}</StatusChip>}
        </div>
        <p className="text-sm text-slate-900">
          {plural(lv.heads, 'animal', 'animales')}
          {pad ? ` · Potrero ${pad}${days !== null ? ` (${days} d)` : ''}` : ' · Sin potrero'}
        </p>
        {lv.lot.type === 'ceba' && lv.heads > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-900">
            {lv.avgWeightKg !== null && <span className="font-bold">{num(lv.avgWeightKg)} kg prom.</span>}
            <GmdChip gmd={lv.avgGmdKg} color={lv.gmdColor} />
            {lv.projectedSaleDate && <span className="text-xs text-slate-700">Faena est.: {fd(lv.projectedSaleDate)}</span>}
          </div>
        )}
        {lv.lot.type === 'leche' && milking > 0 && <p className="text-sm text-slate-900">{milking} en ordeño</p>}
        {perms.verCostos && lv.directCostUsd > 0 && <p className="text-xs text-slate-700">Costo directo: US$ {lv.directCostUsd.toFixed(2)}</p>}
      </button>
      {onMenu && (perms.moverLotes || perms.administrar) && (
        <button type="button" onClick={onMenu} aria-label={`Acciones de ${lv.lot.name}`} className={`w-12 h-12 rounded-xl flex items-center justify-center text-slate-900 hover:bg-slate-100 shrink-0 ${FOCUS_B}`}>
          <EllipsisVertical className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

/** Menú ⋮ del lote: Editar · Mover · Liquidar/Cerrar (Admin) · Eliminar (Admin). */
export const LotMenu: React.FC<{ lot: BovinoLot; onClose: () => void }> = ({ lot, onClose }) => {
  const { perms, openSheet, navigate, actions, index } = useBovino();
  const [ask, setAsk] = useState<'cerrar' | 'eliminar' | null>(null);
  const { error, run, confirmEl } = useDomainRunner();
  const heads = index.active.filter((v) => v.lotId === lot.id).length;
  const open = lot.status === 'abierto';
  return (
    <BottomSheet title={lot.name} subtitle={`${BOVINO_LOT_TYPE_LABEL[lot.type]} · ${BOVINO_UNIT_LABEL[lotUnit(lot)]}`} icon={<Users className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
      <div className="divide-y divide-slate-100 -mx-4">
        {perms.moverLotes && open && <MenuRow icon={<Users className="w-5 h-5" />} title="Editar" onClick={() => { onClose(); openSheet({ kind: 'lote', lotId: lot.id }); }} />}
        {perms.moverLotes && open && <MenuRow icon={<Users className="w-5 h-5" />} title="Mover a otro potrero" onClick={() => { onClose(); openSheet({ kind: 'mover', lotId: lot.id }); }} />}
        {perms.cerrarLote && open && lot.type === 'ceba' && (
          <MenuRow icon={<Users className="w-5 h-5" />} title="Liquidar lote" subtitle="Costo total, venta y utilidad del ciclo" onClick={() => { onClose(); navigate({ s: 'liquidacion', loteId: lot.id }, 'mas'); }} />
        )}
        {perms.cerrarLote && open && lot.type !== 'ceba' && <MenuRow icon={<Users className="w-5 h-5" />} title="Cerrar lote" subtitle={heads ? `Tiene ${heads} animales activos` : undefined} onClick={() => setAsk('cerrar')} />}
        {perms.administrar && <MenuRow icon={<Users className="w-5 h-5" />} title="Eliminar" subtitle="Solo si nunca tuvo animales ni registros" onClick={() => setAsk('eliminar')} />}
      </div>
      <ErrorBox error={error} />
      {ask && (
        <ConfirmDialog
          title={ask === 'cerrar' ? `¿Cerrar ${lot.name}?` : `¿Eliminar ${lot.name}?`}
          message={ask === 'cerrar' ? 'El lote quedará en solo lectura. Queda en la bitácora.' : 'Se elimina definitivamente. Queda en la bitácora.'}
          confirmLabel={ask === 'cerrar' ? 'Cerrar lote' : 'Eliminar'}
          danger
          requireText={lot.name}
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            const which = ask;
            setAsk(null);
            if (which === 'cerrar') run((confirm) => actions.closeLot({ lotId: lot.id, confirm }), () => onClose());
            else run(() => actions.deleteLot({ lotId: lot.id }), () => onClose());
          }}
        />
      )}
      {confirmEl}
    </BottomSheet>
  );
};
