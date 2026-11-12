import React, { useMemo, useState } from 'react';
import { X, Binary, CheckCircle2, RefreshCw, Layers, Search, ShieldCheck } from 'lucide-react';
import { PorcinoAnimal, LactatingLitter } from '../../types';
import { calculatePorcinoCounters, PorcinoDetailedCounters } from '../../models/PorcinoCalculations';
import { isActiveAnimal, headCount } from '../../models/porcinoRules';

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

  return (
    <div
      id="porcino-census-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white p-4 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-rose-300">
              <Binary className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">Censo y Conteo Porcino</h3>
              <p className="text-[11px] text-rose-200/80">
                Auditoría física vs registros en base de datos Firebase
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sync & Database Status Banner */}
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Base de Datos:</span>
            <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
              Contadores en tiempo real
            </span>
          </div>

          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Actualizando...' : 'Actualizar'}
            </button>
          )}
        </div>

        {syncSuccess && (
          <div className="bg-emerald-50 text-emerald-800 px-4 py-1.5 text-[11px] font-bold border-b border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Datos actualizados. Los contadores se calculan en tiempo real desde los registros.
          </div>
        )}

        {/* Content Body Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Main Counters Summary Card */}
          <div className="bg-gradient-to-br from-rose-50 to-amber-50 rounded-2xl p-4 border border-rose-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                Concordancia de Censo Activo
              </span>
              <span className="text-xs font-black text-rose-900 bg-white/80 px-2.5 py-0.5 rounded-lg border border-rose-200">
                Total: {counters.totalPorcino} cabezas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Madres</span>
                <span className="text-xl font-black text-rose-700">{counters.productoras}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {counters.maternidadGestantes} gest. / {counters.maternidadLactantes} lact.
                </span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Lechones</span>
                <span className="text-xl font-black text-amber-700">{counters.lechones}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {counters.camadasActivasCount} camadas activas
                </span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Verracos</span>
                <span className="text-xl font-black text-slate-800">{counters.verracos}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Sementales activos</span>
              </div>

              <div className="bg-white/90 p-2.5 rounded-xl border border-slate-200 text-center shadow-xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Engorde</span>
                <span className="text-xl font-black text-emerald-700">{counters.engorde}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {counters.lotesEngordeCount} lotes de ceba
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown by Pen Location */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Distribución por Galpones y Corrales Físicos
            </h4>

            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden shadow-xs">
              {penEntries.length === 0 && (
                <div className="p-3 text-center text-[11px] text-slate-500">Sin animales registrados.</div>
              )}
              {penEntries.map(([pen, count]) => (
                <div key={pen} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">{pen}</span>
                  <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                    {count} {count === 1 ? 'animal' : 'animales'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Search & Audit Filter */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800">Inspección de Registros ({filteredAnimals.length})</h4>
              <div className="flex gap-1">
                {(['all', 'maternidad', 'engorde', 'verracos', 'lechones'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSelectedFilter(tab)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md capitalize cursor-pointer transition-colors ${
                      selectedFilter === tab
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab === 'all' ? 'Todos' : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por código, corral, raza o lote..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-rose-500"
              />
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredAnimals.length === 0 && (
                <div className="p-3 text-center text-[11px] text-slate-500">No hay registros que coincidan.</div>
              )}
              {filteredAnimals.map((a) => (
                <div
                  key={a.id}
                  className="p-2 bg-slate-50 hover:bg-rose-50/40 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-slate-900 font-bold">{a.code}</strong>
                      <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-200 px-1 rounded">
                        {a.category}
                      </span>
                      {headCount(a) > 1 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                          {headCount(a)} cerdos
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {a.penLocation || 'Sin corral'}{a.stage ? ` • ${a.stage}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-700">{a.currentWeightKg} kg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Concordancia matemática auditada en tiempo real
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar Censo
          </button>
        </div>
      </div>
    </div>
  );
};
