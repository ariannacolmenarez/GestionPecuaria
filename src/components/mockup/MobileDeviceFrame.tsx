import React from 'react';
import { Wifi, BatteryMedium, Signal, Smartphone, Maximize2, Minimize2 } from 'lucide-react';

interface MobileDeviceFrameProps {
  children: React.ReactNode;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const MobileDeviceFrame: React.FC<MobileDeviceFrameProps> = ({
  children,
  isExpanded,
  onToggleExpand,
}) => {
  if (isExpanded) {
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-700/50">
        <div className="bg-slate-950 px-4 py-2 flex items-center justify-between text-xs text-slate-300 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-emerald-400 font-bold text-[11px]">
              VISTA EXPANDIDA EN PANTALLA COMPLETA
            </span>
          </div>
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" /> Volver a Marco Móvil
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-4 w-full">
      {/* Frame Controls Bar */}
      <div className="mb-3 flex items-center justify-between w-full max-w-[420px] px-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-medium">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Simulador Móvil (Gestión Pecuaria)</span>
        </div>
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" /> Expandir
        </button>
      </div>

      {/* Realistic Smartphone Chassis */}
      <div className="relative w-full max-w-[390px] h-[780px] bg-slate-950 rounded-[48px] p-3 ring-12 ring-slate-900 shadow-2xl flex flex-col border border-slate-700">
        {/* Top Speaker & Camera Notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-40 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
          <div className="w-8 h-1 bg-slate-800 rounded-full ml-3" />
        </div>

        {/* Screen Container */}
        <div className="w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col relative z-20 shadow-inner">
          {/* Status Bar */}
          <div className="bg-white px-6 pt-3 pb-1 flex items-center justify-between text-[11px] font-bold text-slate-800 shrink-0 select-none">
            <span>12:04</span>
            <div className="flex items-center gap-1.5 text-slate-700">
              <Signal className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <BatteryMedium className="w-4 h-4" />
            </div>
          </div>

          {/* Child app view */}
          <div className="flex-1 flex flex-col overflow-hidden">{children}</div>

          {/* Home indicator bar */}
          <div className="bg-white pb-2 pt-1 flex justify-center shrink-0">
            <div className="w-32 h-1 bg-slate-300 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};
