import React, { useMemo, useState } from 'react';
import { ClipboardList, CheckCircle2, RefreshCw, Layers, Search } from 'lucide-react';
import { PorcinoAnimal, LactatingLitter } from '../../types';
import { calculatePorcinoCounters, PorcinoDetailedCounters } from '../../models/PorcinoCalculations';
import { isActiveAnimal, headCount } from '../../models/porcinoRules';
import { Btn, ModalHeader, inputClass, useBackClose } from '../common/ui';

interface PorcinoCensusModalProps {
  animals: PorcinoAnimal[];
  litters: LactatingLitter[];
  onClose: () => void;
  /** Opcional: recarga los datos desde el controlador (los contadores ya se derivan en tiempo real). */
  onRefresh?: () => void | Promise<void>;
}

export const PorcinoCensusModal: React.FC<PorcinoCensusModalProps> = ({
  animals,
  litters,
  onClose,
  onRefresh,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'engorde' | 'maternidad' | 'verracos' | 'lechones'>('all');

  // Contadores derivados directamente de los registros (sin escrituras a la base de datos)
  const counters: PorcinoDetailedCounters = useMemo(
    () => calculatePorcinoCounters(animals || [], litters || []),
    [animals, litters]
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsSyncing(true);
    try {
      await onRefresh();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err) {
      console.warn('Error al actualizar el censo:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Criterio único de animal activo (excluye vendidos, matadero y descarte)
  const activeAnimals = useMemo(() => (animals || []).filter(isActiveAnimal), [animals]);

  const filteredAnimals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeAnimals.filter((a) => {
      const matchesFilter = selectedFilter === 'all' || a.category === selectedFilter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        (a.code || '').toLowerCase().includes(q) ||
        (a.penLocation || '').toLowerCase().includes(q) ||
        (a.breed || '').toLowerCase().includes(q) ||
        (a.stage || '').toLowerCase().includes(q)
      );
    });
  }, [activeAnimals, selectedFilter, searchQuery]);

  const penEntries = Object.entries(counters.censoPorUbicacion || {});
  const { requestClose, confirmDialog } = useBackClose(true, onClose, false);

  const FILTERS: { id: typeof selectedFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'maternidad', label: 'Madres' },
    { id: 'engorde', label: 'Engorde' },
    { id: 'verracos', label: 'Verracos' },
    { id: 'lechones', label: 'Lechones' },
  ];

  return (
    <div
      id="porcino-census-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="porcino-census-title"
        className="bg-white rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
      >
        <ModalHeader
          rubro="porcino"
          icon={<ClipboardList />}
          titleId="porcino-census-title"
          title="Conteo de animales"
          subtitle={`${counters.totalPorcino} cerdos en total`}
          onClose={requestClose}
          right={
            onRefresh ? (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isSyncing}
                aria-label="Actualizar conteo"
                className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            ) : undefined
          }
        />

        {syncSuccess && (
          <div role="status" className="bg-emerald-50 text-emerald-900 px-4 py-2 text-sm font-semibold border-b border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            Conteo actualizado.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Totales por grupo */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold block">Madres</span>
              <span className="text-2xl font-black text-rose-700">{counters.productoras}</span>
              <span className="text-xs text-slate-600 block">
                {counters.maternidadGestantes} preñadas · {counters.maternidadLactantes} criando
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold block">Lechones</span>
              <span className="text-2xl font-black text-amber-800">{counters.lechones}</span>
              <span className="text-xs text-slate-600 block">{counters.camadasActivasCount} camadas</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold block">Verracos</span>
              <span className="text-2xl font-black text-slate-900">{counters.verracos}</span>
              <span className="text-xs text-slate-600 block">Machos de monta</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-semibold block">Engorde</span>
              <span className="text-2xl font-black text-emerald-700">{counters.engorde}</span>
              <span className="text-xs text-slate-600 block">{counters.lotesEngordeCount} lotes</span>
            </div>
          </div>

          {/* Por corral */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-5 h-5 text-slate-700" aria-hidden="true" /> Por corral
            </h3>
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
              {penEntries.length === 0 && <div className="p-3 text-center text-sm text-slate-600">Sin animales registrados.</div>}
              {penEntries.map(([pen, count]) => (
                <div key={pen} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800">{pen}</span>
                  <span className="font-black text-slate-900">
                    {count} {count === 1 ? 'animal' : 'animales'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Lista para revisar */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-slate-900">Revisar animales ({filteredAnimals.length})</h3>
            <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Filtrar por grupo">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={selectedFilter === f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`min-h-10 px-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    selectedFilter === f.id ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                aria-label="Buscar por arete o corral"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por arete o corral"
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="space-y-1.5">
              {filteredAnimals.length === 0 && <div className="p-3 text-center text-sm text-slate-600">No hay animales que coincidan.</div>}
              {filteredAnimals.map((a) => (
                <div key={a.id} className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-sm text-slate-900 font-bold font-mono">{a.code}</strong>
                      <span className="text-xs font-semibold text-slate-700 bg-slate-200 px-1.5 rounded">{a.category}</span>
                      {headCount(a) > 1 && <span className="text-xs font-bold text-rose-800 bg-rose-100 px-1.5 rounded">{headCount(a)} cerdos</span>}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">
                      {a.penLocation || 'Sin corral'}
                      {a.stage ? ` · ${a.stage}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-800 shrink-0">{a.currentWeightKg} kg</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
          <Btn variant="secondary" size="lg" block onClick={onClose}>
            Cerrar
          </Btn>
        </div>
        {confirmDialog}
      </div>
    </div>
  );
};
