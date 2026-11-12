/**
 * ============================================================================
 * MÓDULO AVÍCOLA · Pollos de Engorde (pantalla completa)
 * ============================================================================
 * Orquestador Home avícola ↔ Detalle de lote. Sin estado de dominio propio:
 * los datos llegan del controlador y cada operación llama a avicolaActions.*.
 * Solo guarda estado de UI (pestaña, sub-pestaña, hoja de nuevo lote).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { FinancialMovement, SanitaryTask, WarehouseItem, AvicolaLot } from '../../../models/FarmModel';
import type { AvicolaData, AvicolaHomeSummary } from '../../../models/avicolaDomain';
import type { AvicolaActions } from '../../../controllers/FarmController';
import { AvicolaContext, type AvicolaCtx } from './context';
import type { AvicolaFocusRequest, ControlSub, GestionSub, LotTab } from './shared';
import { AvicolaHome } from './AvicolaHome';
import { LoteDetail } from './LoteDetail';
import { NuevoLoteSheet } from './LoteForms';

export type { AvicolaFocusRequest, LotTab, ControlSub } from './shared';

export interface AvicolaModuleProps {
  data: AvicolaData;
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  today: string;
  home: AvicolaHomeSummary;
  actions: AvicolaActions;
  selectedLotId: string | null;
  selectedLot: AvicolaLot | null;
  /** Abre el detalle de un lote o vuelve al Home avícola (null). */
  onOpenLot: (loteId: string | null) => void;
  /** Petición de navegación externa (Home de la granja / alertas globales). */
  focus?: AvicolaFocusRequest | null;
  /** Se llama tras aplicar `focus` para que el padre la limpie. */
  onFocusHandled?: () => void;
  onOpenWarehouse?: () => void;
}

export const AvicolaModule: React.FC<AvicolaModuleProps> = ({
  data,
  tasks,
  movements,
  warehouseItems,
  today,
  home,
  actions,
  selectedLotId,
  selectedLot,
  onOpenLot,
  focus,
  onFocusHandled,
  onOpenWarehouse,
}) => {
  const [tab, setTab] = useState<LotTab>('ventas');
  const [controlSub, setControlSub] = useState<ControlSub>('alimentacion');
  const [gestionSub, setGestionSub] = useState<GestionSub>('resumen');
  const [newLot, setNewLot] = useState(false);
  // Petición de abrir el calendario del Home avícola (contador: cada petición cambia el valor)
  const [calendarReq, setCalendarReq] = useState(0);

  const openLot = useCallback(
    (loteId: string | null, t?: LotTab, sub?: ControlSub) => {
      if (loteId) {
        setTab(t || 'ventas');
        if (sub) setControlSub(sub);
      }
      onOpenLot(loteId);
    },
    [onOpenLot]
  );

  // Petición externa: "Crear lote" desde el Home de la granja o "Ir al lote" desde alertas.
  // Se consume una sola vez: se limpia para que un remontaje del módulo no la repita.
  useEffect(() => {
    if (!focus) return;
    if (focus.newLot) setNewLot(true);
    if (focus.openCalendar) setCalendarReq((n) => n + 1);
    if (focus.tab) setTab(focus.tab);
    if (focus.sub) setControlSub(focus.sub);
    if (focus.gestionSub) setGestionSub(focus.gestionSub);
    onFocusHandled?.();
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si el lote seleccionado deja de existir (eliminado en otro dispositivo), volver al Home avícola.
  useEffect(() => {
    if (selectedLotId && !selectedLot && !data.lots.some((l) => l.id === selectedLotId)) onOpenLot(null);
  }, [selectedLotId, selectedLot, data.lots, onOpenLot]);

  const ctx: AvicolaCtx = useMemo(
    () => ({ data, tasks, movements, warehouseItems, today, home, actions, openLot, openWarehouse: onOpenWarehouse }),
    [data, tasks, movements, warehouseItems, today, home, actions, openLot, onOpenWarehouse]
  );

  return (
    <AvicolaContext.Provider value={ctx}>
      <div id="avicola-module" className="flex-1 flex flex-col min-h-0 bg-slate-100">
        {selectedLot ? (
          <LoteDetail
            key={selectedLot.id}
            lot={selectedLot}
            tab={tab}
            onTab={setTab}
            controlSub={controlSub}
            onControlSub={setControlSub}
            gestionSub={gestionSub}
            onGestionSub={setGestionSub}
          />
        ) : (
          <AvicolaHome onNewLot={() => setNewLot(true)} openCalendarRequest={calendarReq} onCalendarRequestHandled={() => setCalendarReq(0)} />
        )}
        {newLot && (
          <NuevoLoteSheet
            onClose={() => setNewLot(false)}
            onCreated={(id) => {
              setNewLot(false);
              if (id) openLot(id, 'control', 'alimentacion');
            }}
          />
        )}
      </div>
    </AvicolaContext.Provider>
  );
};

export default AvicolaModule;
