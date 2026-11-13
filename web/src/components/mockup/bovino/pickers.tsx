/** Selectores en hoja inferior: potreros (con su ocupación), lotes, insumos y animales por arete. */
import React, { useMemo, useState } from 'react';
import { Map as MapIcon, Package, Plus, Users } from 'lucide-react';
import type { WarehouseItem } from '../../../models/FarmModel';
import type { BovinoAnimalView, BovinoPaddockView } from '../../../models/bovinoCalc';
import { daysToExpiry, isItemExpired, itemBovinoCategory, normalizeTag } from '../../../models/bovinoCalc';
import { BOVINO_LOT_TYPE_LABEL } from '../../../models/bovinoModel';
import { useBovino } from './context';
import { AnimalRow, AreteInput, BottomSheet, ErrorBox, FOCUS_B, StatusChip, TextField, num, BigNumberInput, toNum, useDomainRunner, plural } from './ui';

// ---------------------------------------------------------------------------
// Potreros
// ---------------------------------------------------------------------------
const PADDOCK_ORDER: Record<string, number> = { disponible: 0, descanso: 1, ocupado: 2, mantenimiento: 3 };

/** Estado legible del potrero (chip + detalle). */
export function paddockStatusInfo(pv: BovinoPaddockView, lotName: (id: string) => string | undefined) {
  const rest = pv.paddock.restDays || 0;
  switch (pv.status) {
    case 'ocupado': {
      const lots = pv.lotIds.map(lotName).filter(Boolean).join(', ');
      return { chip: <StatusChip tone="solid">Ocupado</StatusChip>, detail: `${lots ? `${lots} · ` : ''}${plural(pv.heads, 'animal', 'animales')} · ${pv.occupancyDays} d` };
    }
    case 'descanso':
      return { chip: <StatusChip tone="warn">{`Descanso ${pv.restingDays} / ${rest} d`}</StatusChip>, detail: `Descanso incompleto: faltan ${Math.max(0, rest - pv.restingDays)} días` };
    case 'mantenimiento':
      return { chip: <StatusChip tone="neutral">Mantenimiento</StatusChip>, detail: 'No disponible para pastoreo' };
    default:
      return { chip: <StatusChip tone="ok">Disponible</StatusChip>, detail: pv.restingSince ? `Descansó ${pv.restingDays} días` : 'Sin ocupación registrada' };
  }
}

export const PaddockPickerSheet: React.FC<{
  title?: string;
  selectedId?: string;
  onPick: (paddockId: string) => void;
  onClose: () => void;
  allowCreate?: boolean;
  excludeId?: string;
}> = ({ title = '¿A qué potrero?', selectedId, onPick, onClose, allowCreate, excludeId }) => {
  const { home, index, perms, actions } = useBovino();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const { error, run, confirmEl } = useDomainRunner();
  const list = useMemo(
    () => [...home.paddocks].filter((p) => p.paddock.id !== excludeId).sort((a, b) => PADDOCK_ORDER[a.status] - PADDOCK_ORDER[b.status] || a.paddock.name.localeCompare(b.paddock.name)),
    [home.paddocks, excludeId]
  );
  const lotName = (id: string) => index.lotsById.get(id)?.name;
  const create = () =>
    run(
      () => actions.createPaddock({ name, areaHa: isFinite(toNum(area)) ? toNum(area) : undefined }),
      (res) => res.meta?.paddockId && onPick(res.meta.paddockId)
    );
  return (
    <BottomSheet title={title} icon={<MapIcon className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
      {list.length === 0 && !creating && <p className="text-sm text-slate-800">Aún no hay potreros.</p>}
      <ul className="space-y-2">
        {list.map((pv) => {
          const info = paddockStatusInfo(pv, lotName);
          const on = pv.paddock.id === selectedId;
          return (
            <li key={pv.paddock.id}>
              <button
                type="button"
                onClick={() => onPick(pv.paddock.id)}
                className={`w-full min-h-[72px] p-3 rounded-2xl border-2 text-left flex items-center gap-3 ${on ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'} ${FOCUS_B}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-black text-slate-900 truncate">{pv.paddock.name}</span>
                  <span className="block text-xs text-slate-700">
                    {pv.paddock.areaHa ? `${num(pv.paddock.areaHa, 1)} ha · ` : ''}
                    {info.detail}
                  </span>
                </span>
                {info.chip}
              </button>
            </li>
          );
        })}
      </ul>
      {allowCreate && perms.moverLotes && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          {creating ? (
            <>
              <TextField value={name} onChange={setName} placeholder="Nombre del potrero" ariaLabel="Nombre del potrero" />
              <BigNumberInput decimal size="md" value={area} onChange={setArea} unit="ha" ariaLabel="Área en hectáreas" placeholder="Área (opcional)" />
              <ErrorBox error={error} />
              <button type="button" onClick={create} disabled={!name.trim()} className={`w-full h-12 rounded-2xl bg-sky-600 text-white font-bold disabled:opacity-50 ${FOCUS_B}`}>
                Crear y elegir
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={`w-full h-12 rounded-2xl border-2 border-dashed border-slate-400 text-slate-900 font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
              <Plus className="w-5 h-5" /> Crear potrero
            </button>
          )}
        </div>
      )}
      {confirmEl}
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Lotes
// ---------------------------------------------------------------------------
export const LotPickerSheet: React.FC<{
  title?: string;
  selectedId?: string | null;
  onPick: (lotId: string | null) => void;
  onClose: () => void;
  allowNone?: string;
  excludeId?: string;
  allowCreate?: boolean;
}> = ({ title = 'Elige el lote', selectedId, onPick, onClose, allowNone, excludeId, allowCreate }) => {
  const { home, index, perms, actions } = useBovino();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'ceba' | 'leche' | 'cria' | 'levante' | 'otro'>('ceba');
  const { error, run, confirmEl } = useDomainRunner();
  const lots = home.lots.filter((l) => l.lot.id !== excludeId);
  return (
    <BottomSheet title={title} icon={<Users className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
      <ul className="space-y-2">
        {allowNone && (
          <li>
            <button type="button" onClick={() => onPick(null)} className={`w-full h-14 px-4 rounded-2xl border-2 text-left font-bold ${selectedId === null ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'} text-slate-900 ${FOCUS_B}`}>
              {allowNone}
            </button>
          </li>
        )}
        {lots.map((lv) => (
          <li key={lv.lot.id}>
            <button
              type="button"
              onClick={() => onPick(lv.lot.id)}
              className={`w-full min-h-16 p-3 rounded-2xl border-2 text-left flex items-center gap-3 ${lv.lot.id === selectedId ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'} ${FOCUS_B}`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-base font-black text-slate-900 truncate">{lv.lot.name}</span>
                <span className="block text-xs text-slate-700">
                  {plural(lv.heads, 'animal', 'animales')}
                  {lv.paddockId ? ` · Potrero ${index.paddocksById.get(lv.paddockId)?.name || ''}` : ''}
                </span>
              </span>
              <StatusChip tone="info">{BOVINO_LOT_TYPE_LABEL[lv.lot.type]}</StatusChip>
            </button>
          </li>
        ))}
      </ul>
      {lots.length === 0 && !creating && <p className="text-sm text-slate-800">No hay lotes abiertos.</p>}
      {allowCreate && perms.moverLotes && (
        <div className="border-t border-slate-200 pt-3 space-y-2">
          {creating ? (
            <>
              <TextField value={name} onChange={setName} placeholder="Nombre del lote (ej. Ceba 3)" ariaLabel="Nombre del lote" />
              <div className="flex flex-wrap gap-2">
                {(['ceba', 'leche', 'cria', 'levante', 'otro'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setType(t)} className={`h-11 px-4 rounded-2xl border-2 text-sm font-bold ${type === t ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}>
                    {BOVINO_LOT_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              <ErrorBox error={error} />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => run(() => actions.createLot({ name, type }), (res) => res.meta?.lotId && onPick(res.meta.lotId))}
                className={`w-full h-12 rounded-2xl bg-sky-600 text-white font-bold disabled:opacity-50 ${FOCUS_B}`}
              >
                Crear y elegir
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className={`w-full h-12 rounded-2xl border-2 border-dashed border-slate-400 text-slate-900 font-bold flex items-center justify-center gap-2 ${FOCUS_B}`}>
              <Plus className="w-5 h-5" /> Nuevo lote
            </button>
          )}
        </div>
      )}
      {confirmEl}
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Insumos
// ---------------------------------------------------------------------------
/** ¿Se puede usar el insumo? (vencido o sin stock = no). */
export function itemBlockReason(i: WarehouseItem, today: string): string | null {
  if (isItemExpired(i, today)) return `Vencido el ${i.expirationDate} · no se puede usar`;
  if (!(i.quantity > 0)) return 'Sin stock';
  return null;
}

export const ItemPickerSheet: React.FC<{
  title?: string;
  items: WarehouseItem[];
  onPick: (itemId: string) => void;
  onClose: () => void;
  /** true: los vencidos o sin stock aparecen deshabilitados con el motivo. */
  forUse?: boolean;
}> = ({ title = 'Elige el insumo', items, onPick, onClose, forUse }) => {
  const { today } = useBovino();
  const sorted = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name) || (a.expirationDate || '').localeCompare(b.expirationDate || '')),
    [items]
  );
  return (
    <BottomSheet title={title} icon={<Package className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={onClose}>
      {sorted.length === 0 && <p className="text-sm text-slate-800">No hay insumos en esta categoría.</p>}
      <ul className="space-y-2">
        {sorted.map((i) => {
          const reason = forUse ? itemBlockReason(i, today) : null;
          const dte = daysToExpiry(i, today);
          return (
            <li key={i.id}>
              <button
                type="button"
                disabled={!!reason}
                onClick={() => onPick(i.id)}
                className={`w-full min-h-16 p-3 rounded-2xl border-2 border-slate-200 bg-white text-left flex items-center gap-3 disabled:opacity-60 ${FOCUS_B}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-black text-slate-900 truncate">{i.name}</span>
                  <span className="block text-xs text-slate-700">
                    Hay {num(i.quantity, 2)} {i.unit}
                    {itemBovinoCategory(i) === 'farmacia' && i.mfgLot ? ` · Lote ${i.mfgLot}` : ''}
                    {i.expirationDate ? ` · vence ${i.expirationDate}` : ''}
                  </span>
                  {reason && <span className="block text-xs font-bold text-rose-800">{reason}</span>}
                </span>
                {dte !== null && dte < 0 ? <StatusChip tone="bad">Vencido</StatusChip> : dte !== null && dte <= 30 ? <StatusChip tone="warn">{`Vence en ${dte} d`}</StatusChip> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
};

// ---------------------------------------------------------------------------
// Animales por arete (búsqueda en vivo)
// ---------------------------------------------------------------------------
/** Coincidencias por arete o nombre: exacta primero y luego "empieza por" / contiene. */
export function searchAnimals(list: BovinoAnimalView[], q: string, limit = 30): BovinoAnimalView[] {
  const t = normalizeTag(q);
  if (!t) return [];
  const lower = q.trim().toLowerCase();
  const exact = list.filter((v) => normalizeTag(v.tag) === t);
  const starts = list.filter((v) => normalizeTag(v.tag) !== t && normalizeTag(v.tag).startsWith(t));
  const rest = list.filter((v) => !normalizeTag(v.tag).startsWith(t) && (normalizeTag(v.tag).includes(t) || (v.animal.name || '').toLowerCase().includes(lower)));
  return [...exact, ...starts, ...rest].slice(0, limit);
}

export const AnimalSearch: React.FC<{
  onPick: (v: BovinoAnimalView) => void;
  filter?: (v: BovinoAnimalView) => boolean;
  /** Motivo por el que un animal no se puede elegir (se muestra atenuado). */
  blockReason?: (v: BovinoAnimalView) => string | null;
  placeholder?: string;
  excludeIds?: string[];
}> = ({ onPick, filter, blockReason, placeholder = 'Arete del animal', excludeIds = [] }) => {
  const { index } = useBovino();
  const [q, setQ] = useState('');
  const results = useMemo(() => searchAnimals(index.active.filter((v) => (!filter || filter(v)) && !excludeIds.includes(v.id)), q, 12), [index, q, filter, excludeIds]);
  return (
    <div className="space-y-2">
      <AreteInput value={q} onChange={setQ} placeholder={placeholder} />
      {q && results.length === 0 && <p className="text-sm text-slate-800">Ningún animal activo con ese arete.</p>}
      {results.map((v) => {
        const reason = blockReason?.(v) || null;
        return (
          <AnimalRow
            key={v.id}
            v={v}
            disabled={!!reason}
            disabledReason={reason || undefined}
            onClick={() => {
              onPick(v);
              setQ('');
            }}
          />
        );
      })}
    </div>
  );
};
