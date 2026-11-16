/**
 * Barra inferior global (Home de la granja, porcino y Home avícola).
 * Mismo aspecto que BovinoNav: 5 botones de 56 px, icono 24 px, texto 12 px en negrita,
 * pastilla de color en el activo y contador con texto para lectores de pantalla.
 *
 * Regla única: Actividades, Balance y Almacén abren siempre el panel por rubro
 * (RubroPanels) preseleccionado en el rubro de la pantalla actual.
 */
import React from 'react';
import { Home, CalendarDays, Calculator, Bell, Package } from 'lucide-react';

export type BottomNavScreen = 'home' | 'porcino' | 'sanitario' | 'balance' | 'almacen' | 'alertas';

interface BottomNavProps {
  /** Pestaña activa (null = ninguna, p. ej. dentro de un módulo sin panel abierto). */
  activeScreen: BottomNavScreen | null;
  onNavigate: (screen: BottomNavScreen) => void;
  /** Tareas de hoy + vencidas + insumos críticos. */
  notificationCount?: number;
  /** Insumos críticos (badge del botón Almacén). */
  warehouseAlertCount?: number;
}

const ITEMS: { id: BottomNavScreen; domId: string; label: string; Icon: React.ElementType; badgeLabel?: string }[] = [
  { id: 'home', domId: 'nav-btn-granja', label: 'Granja', Icon: Home },
  { id: 'sanitario', domId: 'nav-btn-actividades', label: 'Actividades', Icon: CalendarDays },
  { id: 'balance', domId: 'nav-btn-balance', label: 'Balance', Icon: Calculator },
  { id: 'almacen', domId: 'nav-btn-almacen', label: 'Almacén', Icon: Package, badgeLabel: 'insumos por agotarse' },
  { id: 'alertas', domId: 'nav-btn-notificaciones', label: 'Alertas', Icon: Bell, badgeLabel: 'avisos pendientes' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeScreen, onNavigate, notificationCount = 0, warehouseAlertCount = 0 }) => (
  <nav
    id="bottom-navigation-bar"
    aria-label="Navegación principal"
    className="bg-white border-t border-slate-200 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] grid grid-cols-5 gap-1 shrink-0 select-none"
  >
    {ITEMS.map(({ id, domId, label, Icon, badgeLabel }) => {
      const on = activeScreen === id;
      const badge = id === 'almacen' ? warehouseAlertCount : id === 'alertas' ? notificationCount : 0;
      return (
        <button
          key={id}
          id={domId}
          type="button"
          onClick={() => onNavigate(id)}
          aria-current={on ? 'page' : undefined}
          className={`relative h-14 min-w-0 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
            on ? 'bg-emerald-700 text-white' : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
          }`}
        >
          <Icon className="w-6 h-6" aria-hidden="true" />
          <span className="truncate max-w-full px-0.5">{label}</span>
          {badge > 0 && (
            <span className="absolute top-1 right-[14%] min-w-5 h-5 px-1 rounded-full text-[12px] font-black flex items-center justify-center bg-amber-400 text-slate-900 ring-2 ring-white">
              {badge > 99 ? '99+' : badge}
              <span className="sr-only"> {badgeLabel}</span>
            </span>
          )}
        </button>
      );
    })}
  </nav>
);
