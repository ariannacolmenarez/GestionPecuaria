/** A2 · Lista de animales: búsqueda por arete, filtros, orden y selección múltiple. */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Beef, Scale, SlidersHorizontal, Syringe, Users, X } from 'lucide-react';
import type { BovinoAnimalView } from '../../../../models/bovinoCalc';
import type { BovinoCategoryKey } from '../../../../models/bovinoModel';
import { useBovino } from '../context';
import { pushBackHandler } from '../../../../utils/backButton';
import type { AnimalEstadoFiltro, AnimalFiltro } from '../routes';
import { searchAnimals, LotPickerSheet } from '../pickers';
import { AnimalRow, AreteInput, BottomBarPortal, ChipFilter, EmptyBlock, Fab, FOCUS_B, PickerButton, BottomSheet, num, usePaged } from '../ui';

type Cat = 'todas' | BovinoCategoryKey;
type Sort = 'arete' | 'recientes' | 'peso' | 'gmd';

const CATS: { key: Cat; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'cria', label: 'Crías' },
  { key: 'levante', label: 'Levante' },
  { key: 'novilla', label: 'Novillas' },
  { key: 'vaca', label: 'Vacas' },
  { key: 'toro', label: 'Toros' },
  { key: 'novillo', label: 'Ceba' },
];
const ESTADOS: { key: AnimalEstadoFiltro; label: string }[] = [
  { key: 'ordeno', label: 'En ordeño' },
  { key: 'seca', label: 'Seca' },
  { key: 'preñada', label: 'Preñada' },
  { key: 'vacia', label: 'Vacía' },
  { key: 'servida', label: 'Servida' },
  { key: 'retiro', label: 'Con retiro' },
  { key: 'tratamiento', label: 'En tratamiento' },
];

const tagNum = (t: string) => {
  const n = parseInt(t.replace(/\D/g, ''), 10);
  return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
};

export const AnimalList: React.FC<{ filtro?: AnimalFiltro }> = ({ filtro }) => {
  const { index, perms, navigate, openSheet, home } = useBovino();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Cat>(filtro?.category || 'todas');
  const [lotId, setLotId] = useState<string | undefined>(filtro?.lotId);
  const [paddockId, setPaddockId] = useState<string | undefined>(filtro?.paddockId);
  const [estado, setEstado] = useState<AnimalEstadoFiltro | undefined>(filtro?.estado);
  const [sexo, setSexo] = useState<'hembra' | 'macho' | undefined>(filtro?.sexo);
  const [situacion, setSituacion] = useState<NonNullable<AnimalFiltro['situacion']>>(filtro?.situacion || 'activos');
  const [sort, setSort] = useState<Sort>('arete');
  const [showFilters, setShowFilters] = useState(false);
  const [lotPicker, setLotPicker] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const base = useMemo(() => {
    const src = situacion === 'activos' ? index.active : index.list;
    return src.filter((v) => {
      if (situacion === 'vendidos' && v.status !== 'vendido') return false;
      if (situacion === 'muertos' && v.status !== 'muerto') return false;
      if (cat !== 'todas' && v.category !== cat) return false;
      if (lotId && v.lotId !== lotId) return false;
      if (paddockId && v.paddockId !== paddockId) return false;
      if (sexo && v.sex !== sexo) return false;
      if (estado) {
        const r = v.repro;
        switch (estado) {
          case 'ordeno':
            if (!r?.lactating) return false;
            break;
          case 'seca':
            if (r?.state !== 'seca') return false;
            break;
          case 'preñada':
            if (!r?.pregnant) return false;
            break;
          case 'vacia':
            if (r?.state !== 'vacia' || (v.category !== 'vaca' && v.category !== 'novilla')) return false;
            break;
          case 'servida':
            if (r?.state !== 'servida') return false;
            break;
          case 'retiro':
            if (!v.withdrawal.meatActive && !v.withdrawal.milkActive) return false;
            break;
          case 'tratamiento':
            if (!(index.eventsByAnimal.get(v.id) || []).some((e) => e.kind === 'tratamiento' && (e as any).effectiveness === 'pendiente')) return false;
            break;
        }
      }
      return true;
    });
  }, [index, situacion, cat, lotId, paddockId, sexo, estado]);

  const list = useMemo(() => {
    if (q.trim()) return searchAnimals(base, q, 500);
    const arr = [...base];
    if (sort === 'arete') arr.sort((a, b) => tagNum(a.tag) - tagNum(b.tag) || a.tag.localeCompare(b.tag));
    else if (sort === 'recientes') arr.sort((a, b) => (b.animal.entryDate || '').localeCompare(a.animal.entryDate || '') || (b.animal.createdAt || '').localeCompare(a.animal.createdAt || ''));
    else if (sort === 'peso') arr.sort((a, b) => (b.weightKg ?? -1) - (a.weightKg ?? -1));
    else arr.sort((a, b) => (b.gmdKg ?? -99) - (a.gmdKg ?? -99));
    return arr;
  }, [base, q, sort]);

  const { shown, more, reset } = usePaged<BovinoAnimalView>(list);
  // "Todos" marca TODOS los activos que pasan el filtro (no solo los visibles en la página)
  const activeInList = useMemo(() => list.filter((v) => v.active), [list]);
  const allSelected = activeInList.length > 0 && activeInList.every((v) => selected.includes(v.id));
  useEffect(() => reset(), [q, cat, lotId, paddockId, estado, sexo, situacion, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const weights = list.map((v) => v.weightKg).filter((w): w is number => w !== null);
  const avgW = weights.length ? weights.reduce((s, x) => s + x, 0) / weights.length : null;
  const catCount = (k: Cat) => (k === 'todas' ? index.active.length : index.active.filter((v) => v.category === k).length);
  const extraFilters = [lotId, paddockId, estado, sexo, situacion !== 'activos' ? situacion : undefined].filter(Boolean).length;
  const clearFilters = () => {
    setCat('todas');
    setLotId(undefined);
    setPaddockId(undefined);
    setEstado(undefined);
    setSexo(undefined);
    setSituacion('activos');
    setQ('');
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const endSelection = () => {
    setSelecting(false);
    setSelected([]);
  };
  // Atrás con la selección activa: cancela la selección
  useEffect(() => {
    if (!selecting) return;
    const off = pushBackHandler(() => {
      setSelecting(false);
      setSelected([]);
    });
    return off;
  }, [selecting]); // eslint-disable-line react-hooks/exhaustive-deps
  const lotName = lotId ? index.lotsById.get(lotId)?.name : undefined;
  const padName = paddockId ? index.paddocksById.get(paddockId)?.name : undefined;

  return (
    <div className="relative min-h-full">
      <div className="sticky top-0 bg-slate-50 z-10 px-4 pt-3 pb-2 space-y-2 border-b border-slate-200">
        <AreteInput value={q} onChange={setQ} placeholder="Buscar arete o nombre" />
        <ChipFilter options={CATS.map((c) => ({ ...c, count: catCount(c.key) }))} value={cat} onChange={setCat} ariaLabel="Categoría" />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className={`h-11 px-4 rounded-full border-2 text-sm font-bold flex items-center gap-1.5 ${extraFilters ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Filtros{extraFilters ? ` (${extraFilters})` : ''}
          </button>
          <span className="flex-1" />
          {selecting && activeInList.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : activeInList.map((v) => v.id))}
              className={`h-11 px-4 rounded-full border-2 border-sky-600 bg-sky-50 text-sm font-bold text-sky-900 ${FOCUS_B}`}
            >
              {allSelected ? 'Ninguno' : `Todos (${activeInList.length})`}
            </button>
          )}
          {(perms.moverLotes || perms.sanidad || perms.cargaDiaria) && list.length > 0 && (
            <button
              type="button"
              onClick={() => (selecting ? endSelection() : setSelecting(true))}
              className={`h-11 px-4 rounded-full border-2 text-sm font-bold ${selecting ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}
            >
              {selecting ? `Cancelar${selected.length ? ` (${selected.length})` : ''}` : 'Seleccionar'}
            </button>
          )}
        </div>
        {(lotName || padName) && (
          <div className="flex flex-wrap gap-2">
            {lotName && <ActiveFilter label={`Lote ${lotName}`} onClear={() => setLotId(undefined)} />}
            {padName && <ActiveFilter label={`Potrero ${padName}`} onClear={() => setPaddockId(undefined)} />}
          </div>
        )}
      </div>

      <div className="p-4 space-y-2 pb-28">
        <p className="text-sm font-bold text-slate-900">
          {num(list.length)} {list.length === 1 ? 'animal' : 'animales'}
          {avgW !== null ? ` · peso prom. ${num(avgW)} kg` : ''}
        </p>
        {list.length === 0 ? (
          index.list.length === 0 ? (
            <EmptyBlock icon={<Beef className="w-8 h-8" />} title="Aún no hay ganado registrado" text="Ingresa tus animales por lote o uno a uno." cta={perms.altaAnimales ? 'Ingresar ganado' : undefined} onCta={() => openSheet({ kind: 'alta' })} />
          ) : (
            <EmptyBlock icon={<SlidersHorizontal className="w-8 h-8" />} title="Ningún animal coincide con los filtros" cta="Quitar filtros" onCta={clearFilters} />
          )
        ) : (
          shown.map((v) => (
            <AnimalRow
              key={v.id}
              v={v}
              selectable={selecting}
              selected={selected.includes(v.id)}
              right={sort === 'peso' && v.weightKg !== null ? <span className="text-sm font-black tabular-nums text-slate-900">{num(v.weightKg)} kg</span> : undefined}
              onClick={() => (selecting ? v.active && toggle(v.id) : navigate({ s: 'animal', id: v.id }))}
            />
          ))
        )}
        {more}
      </div>

      {!selecting && perms.altaAnimales && <Fab label="Ingresar ganado" onClick={() => openSheet({ kind: 'alta', lotId, paddockId })} />}

      {selecting && (
        <BottomBarPortal>
          {perms.moverLotes && (
            <SelBtn icon={<ArrowRightLeft className="w-5 h-5" />} label="Mover" disabled={!selected.length} onClick={() => openSheet({ kind: 'mover', animalIds: selected })} />
          )}
          {perms.sanidad && <SelBtn icon={<Syringe className="w-5 h-5" />} label="Tratar" disabled={!selected.length} onClick={() => openSheet({ kind: 'tratamiento', animalIds: selected })} />}
          <SelBtn
            icon={<Scale className="w-5 h-5" />}
            label="Pesar"
            disabled={!selected.length}
            onClick={() => (selected.length === 1 ? openSheet({ kind: 'pesaje', animalId: selected[0] }) : navigate({ s: 'ceba', pesar: true, animalIds: selected }, 'campo'))}
          />
          {perms.moverLotes && <SelBtn icon={<Users className="w-5 h-5" />} label="Cambiar lote" disabled={!selected.length} onClick={() => openSheet({ kind: 'cambiarLote', animalIds: selected })} />}
        </BottomBarPortal>
      )}
      {selecting && <p className="sr-only" aria-live="polite">{`${selected.length} seleccionados`}</p>}

      {showFilters && (
        <BottomSheet title="Filtros" subtitle={`${num(list.length)} animales`} icon={<SlidersHorizontal className="w-5 h-5" />} iconClass="bg-sky-100 text-sky-700" onClose={() => setShowFilters(false)}
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={clearFilters} className={`h-12 rounded-2xl border-2 border-slate-300 bg-white font-bold text-slate-900 ${FOCUS_B}`}>Quitar filtros</button>
              <button type="button" onClick={() => setShowFilters(false)} className={`h-12 rounded-2xl bg-sky-600 text-white font-bold ${FOCUS_B}`}>Ver {num(list.length)}</button>
            </div>
          }
        >
          <FilterGroup label="Lote">
            <PickerButton label="Lote" value={lotName} placeholder="Todos los lotes" onClick={() => setLotPicker(true)} />
          </FilterGroup>
          <FilterGroup label="Potrero">
            <div className="flex flex-wrap gap-2">
              <Pill on={!paddockId} onClick={() => setPaddockId(undefined)}>Todos</Pill>
              {home.paddocks.map((p) => (
                <Pill key={p.paddock.id} on={paddockId === p.paddock.id} onClick={() => setPaddockId(p.paddock.id)}>{p.paddock.name}</Pill>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup label="Estado">
            <div className="flex flex-wrap gap-2">
              <Pill on={!estado} onClick={() => setEstado(undefined)}>Todos</Pill>
              {ESTADOS.map((e) => (
                <Pill key={e.key} on={estado === e.key} onClick={() => setEstado(e.key)}>{e.label}</Pill>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup label="Sexo">
            <div className="flex flex-wrap gap-2">
              <Pill on={!sexo} onClick={() => setSexo(undefined)}>Todos</Pill>
              <Pill on={sexo === 'hembra'} onClick={() => setSexo('hembra')}>Hembras</Pill>
              <Pill on={sexo === 'macho'} onClick={() => setSexo('macho')}>Machos</Pill>
            </div>
          </FilterGroup>
          <FilterGroup label="Situación">
            <div className="flex flex-wrap gap-2">
              {(['activos', 'vendidos', 'muertos', 'todos'] as const).map((s) => (
                <Pill key={s} on={situacion === s} onClick={() => setSituacion(s)}>{s[0].toUpperCase() + s.slice(1)}</Pill>
              ))}
            </div>
          </FilterGroup>
          <FilterGroup label="Ordenar por">
            <div className="flex flex-wrap gap-2">
              {([['arete', 'Arete'], ['recientes', 'Últimos registrados'], ['peso', 'Peso'], ['gmd', 'GMD']] as const).map(([k, l]) => (
                <Pill key={k} on={sort === k} onClick={() => setSort(k)}>{l}</Pill>
              ))}
            </div>
          </FilterGroup>
        </BottomSheet>
      )}
      {lotPicker && (
        <LotPickerSheet
          selectedId={lotId ?? null}
          allowNone="Todos los lotes"
          onClose={() => setLotPicker(false)}
          onPick={(id) => {
            setLotId(id || undefined);
            setLotPicker(false);
          }}
        />
      )}
    </div>
  );
};

const ActiveFilter: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <button type="button" onClick={onClear} aria-label={`Quitar filtro ${label}`} className={`h-9 pl-3 pr-2 rounded-full bg-sky-100 text-sky-900 text-sm font-bold flex items-center gap-1 ${FOCUS_B}`}>
    {label} <X className="w-4 h-4" />
  </button>
);

const FilterGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <p className="text-sm font-black text-slate-900">{label}</p>
    {children}
  </div>
);

const Pill: React.FC<{ on: boolean; onClick: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} aria-pressed={on} className={`h-11 px-4 rounded-full border-2 text-sm font-bold ${on ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-slate-900'} ${FOCUS_B}`}>
    {children}
  </button>
);

const SelBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }> = ({ icon, label, onClick, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold disabled:opacity-40 hover:bg-white/10 ${FOCUS_B}`}>
    {icon}
    {label}
  </button>
);

export type { BovinoAnimalView };
