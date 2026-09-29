import React, { useState } from 'react';
import {
  Layers,
  Database,
  Monitor,
  Cpu,
  ArrowRight,
  CheckCircle2,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { FarmSummary } from '../../models/FarmModel';

interface MvcArchitectureViewProps {
  summary: FarmSummary;
  totalAnimals: number;
  totalTasks: number;
  totalWarehouseItems: number;
  onNavigateToMockup: () => void;
}

export const MvcArchitectureView: React.FC<MvcArchitectureViewProps> = ({
  summary,
  totalAnimals,
  totalTasks,
  totalWarehouseItems,
  onNavigateToMockup,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'model' | 'view' | 'controller'>('overview');

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Layers className="w-48 h-48 text-blue-400" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" /> Arquitectura de Software
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Estructura Modelo - Vista - Controlador (MVC)
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Todo el código de la aplicación de Gestión Pecuaria está desacoplado y organizado
            en capas de responsabilidad única: <span className="text-emerald-400 font-bold">Model</span> (datos y reglas matemáticas),{' '}
            <span className="text-amber-400 font-bold">View</span> (componentes visuales e interactivos) y{' '}
            <span className="text-blue-400 font-bold">Controller</span> (orquestador de lógica, estados y persistencia en Firebase).
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={onNavigateToMockup}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <Monitor className="w-4 h-4" /> Volver a la App Interactiva
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" /> Diagrama Global MVC
        </button>
        <button
          onClick={() => setActiveTab('model')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'model'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Database className="w-4 h-4" /> 1. Modelo (Model)
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'view'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Monitor className="w-4 h-4" /> 2. Vista (View)
        </button>
        <button
          onClick={() => setActiveTab('controller')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'controller'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" /> 3. Controlador (Controller)
        </button>
      </div>

      {/* Tab 1: Overview Flow Diagram */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Model Card */}
            <div className="bg-slate-800/80 border border-emerald-500/40 rounded-2xl p-5 space-y-3 relative group hover:border-emerald-400 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg">
                  src/models/
                </span>
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="font-bold text-lg text-white">MODELO (Model)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Define qué son los datos y sus reglas matemáticas intrínsecas sin conocer la interfaz.
              </p>
              <ul className="text-xs space-y-1.5 text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Entidades y Tipos Pecuarios
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Reglas de Prorrateo Destete
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Conciliación de Censos y Hato
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Semilla y Estado Inicial
                </li>
              </ul>
            </div>

            {/* Controller Card */}
            <div className="bg-slate-800/80 border border-indigo-500/40 rounded-2xl p-5 space-y-3 relative group hover:border-indigo-400 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg">
                  src/controllers/
                </span>
                <Cpu className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="font-bold text-lg text-white">CONTROLADOR (Controller)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cerebro intermediario: recibe eventos de la Vista, consulta/actualiza el Modelo y sincroniza con Firebase.
              </p>
              <ul className="text-xs space-y-1.5 text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> <code>useFarmController</code> Hook
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Persistencia reactiva Firestore
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Controladores Específicos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Notificaciones y Estados UI
                </li>
              </ul>
            </div>

            {/* View Card */}
            <div className="bg-slate-800/80 border border-amber-500/40 rounded-2xl p-5 space-y-3 relative group hover:border-amber-400 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg">
                  src/views/
                </span>
                <Monitor className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="font-bold text-lg text-white">VISTA (View)</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Interfaz de usuario pura y reactiva construida con Tailwind CSS y componentes modulares.
              </p>
              <ul className="text-xs space-y-1.5 text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Dashboard y Gráficos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Menú Porcino y 5 Pestañas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Modales de Operación
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Centro de Alertas y Layouts
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Flow Diagram */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-400" /> Flujo de Datos Unidireccional en la Granja
            </h4>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-slate-900/80 rounded-xl border border-slate-700/80 text-xs">
              <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 w-full md:w-1/4">
                <span className="font-bold text-amber-400 block mb-1">1. Usuario Interactúa</span>
                <span className="text-slate-300 text-[11px]">
                  (Ej: Da de alta un lechón, desteta camada o completa tarea sanitaria)
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 rotate-90 md:rotate-0" />
              <div className="text-center p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 w-full md:w-1/4">
                <span className="font-bold text-indigo-400 block mb-1">2. Controlador Recibe Evento</span>
                <span className="text-slate-300 text-[11px]">
                  <code>FarmController</code> valida, recalcula contadores y envía mutación a Firestore
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 rotate-90 md:rotate-0" />
              <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 w-full md:w-1/4">
                <span className="font-bold text-emerald-400 block mb-1">3. Modelo se Actualiza</span>
                <span className="text-slate-300 text-[11px]">
                  Los datos del rebaño y resumen financiero quedan persistidos y consolidados
                </span>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 rotate-90 md:rotate-0" />
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 w-full md:w-1/4">
                <span className="font-bold text-blue-400 block mb-1">4. Vista Re-renderiza</span>
                <span className="text-slate-300 text-[11px]">
                  La pantalla muestra los números actualizados en tiempo real
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Model Detail */}
      {activeTab === 'model' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-emerald-400 flex items-center gap-2">
              <Database className="w-5 h-5" /> Directorio <code>src/models/</code>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              El Modelo no tiene dependencias visuales de React. Contiene las definiciones de tipos puras,
              las estructuras de datos y las funciones matemáticas del negocio pecuario.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <FileCode className="w-4 h-4" /> FarmModel.ts
                </div>
                <p className="text-[11px] text-slate-400">
                  Tipos principales: <code>PorcinoAnimal</code>, <code>FarmSummary</code>, <code>LactatingLitter</code>,{' '}
                  <code>WarehouseItem</code>, <code>SanitaryTask</code>, <code>FinancialMovement</code>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <FileCode className="w-4 h-4" /> PorcinoCalculations.ts
                </div>
                <p className="text-[11px] text-slate-400">
                  Fórmulas: <code>calculatePorcinoCounters</code>, <code>reconcileFarmSummaryCounts</code>,{' '}
                  <code>calculateWeaningProrating</code>, <code>evaluateWarehouseReplenishment</code>.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <FileCode className="w-4 h-4" /> InitialData.ts
                </div>
                <p className="text-[11px] text-slate-400">
                  Semilla inicial predeterminada para pruebas offline, protocolos de alimentación y batches.
                </p>
              </div>
            </div>

            {/* Live Model Stats */}
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-2">
              <span className="text-xs font-bold text-emerald-400 block">ESTADO ACTUAL DEL MODELO EN MEMORIA:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Animales en Hato</span>
                  <span className="font-extrabold text-white text-base">{totalAnimals}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Tareas Sanitarias</span>
                  <span className="font-extrabold text-white text-base">{totalTasks}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Insumos Almacén</span>
                  <span className="font-extrabold text-white text-base">{totalWarehouseItems}</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">Utilidad Período</span>
                  <span className="font-extrabold text-emerald-400 text-base">
                    ${summary.finances.netUtility.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: View Detail */}
      {activeTab === 'view' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-amber-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-amber-400 flex items-center gap-2">
              <Monitor className="w-5 h-5" /> Directorio <code>src/views/</code>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Las Vistas son componentes visuales desacoplados que no ejecutan peticiones directas ni manipulan
              el backend; reciben datos por props y emiten eventos a través de callbacks proporcionados por el Controlador.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1">
                <span className="font-bold text-amber-300 block">🏠 views/home/</span>
                <p className="text-slate-400 text-[11px]">
                  <code>HomeDashboardView</code>: Presentación de resumen de los 3 rubros (Porcino, Bovino, Avícola), finanzas y accesos rápidos.
                </p>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1">
                <span className="font-bold text-amber-300 block">🐷 views/porcino/</span>
                <p className="text-slate-400 text-[11px]">
                  <code>MenuPorcinoView</code>: Módulo principal porcino con 5 pestañas (Gestión, Sanidad, Finanzas, Almacén, Config).
                </p>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1">
                <span className="font-bold text-amber-300 block">📦 views/warehouse/ & views/alerts/</span>
                <p className="text-slate-400 text-[11px]">
                  <code>WarehouseModalView</code> y <code>AlertsCenterModalView</code>: Alertas automáticas de consumo &lt; 2 meses y push banner.
                </p>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1">
                <span className="font-bold text-amber-300 block">📱 views/common/</span>
                <p className="text-slate-400 text-[11px]">
                  Componentes de layout reutilizables: <code>GranjaHeaderView</code>, <code>BottomNavView</code>, <code>PhoneNotificationBannerView</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Controller Detail */}
      {activeTab === 'controller' && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-indigo-500/30 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-indigo-400 flex items-center gap-2">
              <Cpu className="w-5 h-5" /> Directorio <code>src/controllers/</code>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Los Controladores manejan la interacción entre la interfaz y el almacenamiento.
              El hook unificado <code>useFarmController</code> expone el estado y los métodos de mutación (actions)
              para que cualquier vista consuma datos reactivamente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <span className="font-bold text-indigo-300 block">useFarmController.ts</span>
                <p className="text-slate-400 text-[11px]">
                  Hook principal que orquesta el ciclo de vida, suscripciones Firebase Firestore y sincronización bidireccional.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <span className="font-bold text-indigo-300 block">PorcinoController.ts</span>
                <p className="text-slate-400 text-[11px]">
                  Manejo de partos, destete con prorrateo de costos al lote de ceba, despacho a matadero y mortalidades.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <span className="font-bold text-indigo-300 block">WarehouseController.ts</span>
                <p className="text-slate-400 text-[11px]">
                  Control de stock, alertas preventivas ante agotamiento (&lt;2 meses) y registros de reposición.
                </p>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-700/80 space-y-1.5">
                <span className="font-bold text-indigo-300 block">SanitaryController.ts</span>
                <p className="text-slate-400 text-[11px]">
                  Control de calendario de vacunación, tareas veterinarias y marcación de actividades completadas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
