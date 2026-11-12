import React from 'react';
import { Home, Calendar, Calculator, Bell, Package } from 'lucide-react';

export type BottomNavScreen = 'home' | 'porcino' | 'sanitario' | 'balance' | 'almacen' | 'alertas';

interface BottomNavProps {
  activeScreen: BottomNavScreen;
  onNavigate: (screen: BottomNavScreen) => void;
  /** Tareas de hoy + vencidas + insumos críticos. */
  notificationCount?: number;
  /** Insumos críticos (badge del botón Almacén). */
  warehouseAlertCount?: number;
}

const NavButton: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onClick: () => void;
}> = ({ id, label, icon, active, badge = 0, onClick }) => (
  <button
    id={id}
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    className={`flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg relative ${
      active ? 'text-emerald-700 font-semibold' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    <div className="relative">
      {icon}
      {badge > 0 && (
        <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-0.5 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </div>
    <span className="text-[11px] leading-none">{label}</span>
  </button>
);

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onNavigate,
  notificationCount = 0,
  warehouseAlertCount = 0,
}) => (
  <nav
    id="bottom-navigation-bar"
    className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around select-none shrink-0"
  >
    <NavButton
      id="nav-btn-granja"
      label="Granja"
      icon={<Home className="w-5 h-5" />}
      active={activeScreen === 'home'}
      onClick={() => onNavigate('home')}
    />
    <NavButton
      id="nav-btn-actividades"
      label="Actividades"
      icon={<Calendar className="w-5 h-5" />}
      active={activeScreen === 'sanitario'}
      onClick={() => onNavigate('sanitario')}
    />
    <NavButton
      id="nav-btn-balance"
      label="Balance"
      icon={<Calculator className="w-5 h-5" />}
      active={activeScreen === 'balance'}
      onClick={() => onNavigate('balance')}
    />
    <NavButton
      id="nav-btn-almacen"
      label="Almacén"
      icon={<Package className="w-5 h-5" />}
      active={activeScreen === 'almacen'}
      badge={warehouseAlertCount}
      onClick={() => onNavigate('almacen')}
    />
    <NavButton
      id="nav-btn-notificaciones"
      label="Alertas"
      icon={<Bell className="w-5 h-5" />}
      active={activeScreen === 'alertas'}
      badge={notificationCount}
      onClick={() => onNavigate('alertas')}
    />
  </nav>
);
