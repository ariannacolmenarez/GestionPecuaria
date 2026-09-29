import React from 'react';
import { Smartphone, BookOpen, Copy, CheckCircle, Sparkles, ExternalLink } from 'lucide-react';

interface NavbarProps {
  currentView: 'mockup' | 'documentation';
  onChangeView: (view: 'mockup' | 'documentation') => void;
  onCopySpec: () => void;
  copiedSpec: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  onCopySpec,
  copiedSpec,
}) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0 z-30">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center font-black text-white text-xs shadow-md shadow-emerald-900/30">
          GP
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black text-white tracking-tight">
              Gestión Pecuaria • Suite de Especificación y Mockups
            </h1>
            <span className="hidden sm:inline-block text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold px-2 py-0.5 rounded-full">
              Granja Arianna
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">
            Prototipo funcional e instructivo para codificación por el Agente IA
          </p>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-2">
        <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs">
          <button
            id="btn-switch-mockup"
            onClick={() => onChangeView('mockup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              currentView === 'mockup'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mockup Interactivo</span>
            <span className="sm:hidden">App</span>
          </button>

          <button
            id="btn-switch-doc"
            onClick={() => onChangeView('documentation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              currentView === 'documentation'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Documentación Técnica</span>
            <span className="sm:hidden">Doc</span>
          </button>
        </div>

        <button
          onClick={onCopySpec}
          title="Copiar Especificación Completa en Markdown"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
        >
          {copiedSpec ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span className="hidden md:inline">
            {copiedSpec ? 'Copiado' : 'Copiar Markdown'}
          </span>
        </button>
      </div>
    </header>
  );
};
