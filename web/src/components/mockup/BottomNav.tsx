import React from 'react';
import { Home, Calendar, Calculator, Bell, User } from 'lucide-react';

interface BottomNavProps {
  activeScreen: 'home' | 'porcino' | 'sanitario' | 'balance' | 'almacen';
  onNavigate: (screen: 'home' | 'porcino' | 'sanitario' | 'balance' | 'almacen') => void;
  notificationCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onNavigate,
  notificationCount = 2,
}) => {
  return (
    <nav
      id="bottom-navigation-bar"
      className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around select-none shrink-0"
    >
      <button
        id="nav-btn-granja"
        onClick={() => onNavigate('home')}
        className={`flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
          activeScreen === 'home'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[11px] leading-none">Granja</span>
      </button>

      <button
        id="nav-btn-actividades"
        onClick={() => onNavigate('sanitario')}
        className={`flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
          activeScreen === 'sanitario'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[11px] leading-none">Actividades</span>
      </button>

      <button
        id="nav-btn-balance"
        onClick={() => onNavigate('balance')}
        className={`flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg ${
          activeScreen === 'balance'
            ? 'text-emerald-700 font-semibold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Calculator className="w-5 h-5" />
        <span className="text-[11px] leading-none">Balance</span>
      </button>

      <button
        id="nav-btn-notificaciones"
        onClick={() => onNavigate('almacen')}
        className="flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 relative"
      >
        <div className="relative">
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-amber-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </div>
        <span className="text-[11px] leading-none">Alertas</span>
      </button>

      <button
        id="nav-btn-perfil"
        onClick={() => onNavigate('home')}
        className="flex flex-col items-center gap-1 transition-colors px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800"
      >
        <User className="w-5 h-5" />
        <span className="text-[11px] leading-none">Perfil</span>
      </button>
    </nav>
  );
};
