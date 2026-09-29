import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle,
  Copy,
  Layers,
  Code2,
  GitBranch,
  ShieldCheck,
  Cpu,
  Calculator,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
} from 'lucide-react';
import { userStoriesDoc, techStackRecommendations, userFlowSteps } from '../../data/documentationData';

export const DocumentationView: React.FC = () => {
  const [activeDocTab, setActiveDocTab] = useState<'historias' | 'flujos' | 'stack' | 'schemas' | 'formulas'>('historias');
  const [expandedHU, setExpandedHU] = useState<string | null>('HU-01');
  const [copied, setCopied] = useState(false);

  // Generate full markdown text for export
  const getFullMarkdown = () => {
    return `# DOCUMENTO DE ESPECIFICACIÓN TÉCNICA & REQUERIMIENTOS (SRS)
## APLICACIÓN MÓVIL DE GESTIÓN PECUARIA INTEGRAL
**Finca / Granja Piloto:** Granja Arianna
**Alcance:** Gestión Multirubro (Bovina, Porcina, Avícola) con Arquitectura Especializada Porcina.
**Audiencia:** Agentes de Inteligencia Artificial (AI Coding Agents) y Equipo de Ingeniería Full-Stack.

---

### 1. RESUMEN EJECUTIVO Y OBJETIVOS DEL SISTEMA
El objetivo de este desarrollo es construir una aplicación móvil y web progresiva (PWA) de alto rendimiento orientada a la administración agropecuaria. El sistema resuelve la falta de trazabilidad, el descontrol en inventario de insumos (alimentos y medicamentos) y la desconexión entre los eventos biológicos del campo (partos, destetes, muertes, medicación) y el balance contable financiero.

#### Características Centrales Requeridas:
1. **Multi-rubro con Home Unificado:** Tablero con contadores de pollos de engorde (avícola), productoras y lechones (porcino), padrotes, becerros y vacas (bovino), y desglose financiero de gastos, ganancias y utilidad neta.
2. **Menú Porcino Especializado de 5 Pestañas:**
   - **Pestaña 1 (Porcinos):** GridView de 3 columnas (Engorde, Maternidad, Verracos) con contadores e imágenes ilustrativas.
   - **Pestaña 2 (Atajos):** Acceso rápido a Almacén, Compras, Clientes/Ventas, Reporte General, Tareas y Conteo.
   - **Pestaña 3 (Plan Sanitario):** Calendario mensual interactivo con marcas en fechas clave, leyenda descriptiva de procedimientos veterinarios y deducción de almacén.
   - **Pestaña 4 (Balance Financiero):** Egresos (-) en naranja/rojo, Ingresos (+) en verde, gráfico mensual Ene-Dic y toggle Balance Total vs Mes Actual.
   - **Pestaña 5 (Calendario de Alimentación):** Línea de tiempo de las 4 fases del ciclo reproductivo (150 días), tablas de transición alimenticia y cálculo de requerimientos en kilogramos/bultos.
3. **Módulo de Almacén con Alerta a 2 Meses:** Clasificación en Alimentos, Medicinas y Otros; alerta automática cuando las existencias proyectadas cubran menos de 60 días de consumo del hato; deducción automática por peso (g, kg) o volumen (ml, L).
4. **Prorrateo Matemático al Destete:** División del costo acumulado de la cerda (gestación + lactancia + sanidad) entre los lechones destetados, con asignación a engorde o venta con cálculo de ganancia real.
5. **Venta en Pie vs Canal:** Liquidación considerando peso vivo final o rendimiento de canal con cálculo de utilidad neta.

---

### 2. STACK TECNOLÓGICO SUGERIDO & JUSTIFICACIÓN ARQUITECTÓNICA

| Capa | Tecnología Seleccionada | Justificación Técnica |
|---|---|---|
| **Frontend Móvil** | React Native con Expo SDK (o Flutter) | Soporte nativo para iOS y Android desde un único repositorio. Acceso a cámara (para escanear aretes RFID/QR), geolocalización de potreros y rendimiento táctil fluido de 60fps. |
| **Estilos & UI** | Tailwind CSS / NativeWind | Consistencia de diseño, clases utilitarias rápidas y adaptación responsiva a teléfonos y tablets de campo. |
| **Base de Datos** | Cloud Firestore | Base de datos NoSQL con soporte nativo de **persistencia offline**. Crucial para operaciones en granjas rurales donde la conectividad 3G/4G es intermitente. Los datos se escriben localmente y se sincronizan al recuperar señal. |
| **Autenticación** | Firebase Authentication | Manejo de sesiones seguras por correo/clave con asignación de roles (RBAC): Administrador, Veterinario, Operador, Trabajador. |
| **Lógica Backend** | Cloud Functions (Node.js / TypeScript) | Tareas en segundo plano (evaluación de stock a medianoche, recálculo de balances y exportación de reportes contables). |
| **Almacenamiento** | Firebase Storage | Fotos de trazabilidad de animales, facturas de compras y recetas sanitarias. |

---

### 3. HISTORIAS DE USUARIO Y CRITERIOS DE ACEPTACIÓN
${userStoriesDoc
  .map(
    (hu) => `
#### [${hu.id}] ${hu.title}
- **Como:** ${hu.role}
- **Quiero:** ${hu.want}
- **Para:** ${hu.soThat}
- **Criterios de Aceptación:**
${hu.acceptanceCriteria
  .map(
    (ac) => `  * **${ac.section}:**\n${ac.points.map((p) => `    - ${p}`).join('\n')}`
  )
  .join('\n')}
${hu.businessRule ? `- **Regla de Negocio Crítica:** ${hu.businessRule}\n` : ''}`
  )
  .join('\n')}

---

### 4. MODELO DE DATOS Y ESQUEMA FIRESTORE

\`\`\`typescript
// Colección: /farms/{farmId}
interface FarmDoc {
  id: string;
  name: string; // "Granja Arianna"
  ownerId: string;
  createdAt: string;
  counts: {
    avicola: { pollosEngorde: number };
    porcino: { productoras: number; lechones: number; verracos: number; engorde: number };
    bovino: { padrotes: number; becerros: number; vacas: number };
  };
}

// Colección: /farms/{farmId}/animals/{animalId}
interface AnimalDoc {
  id: string;
  code: string; // "CER-088", "ENG-302"
  rubro: 'porcino' | 'bovino' | 'avicola';
  category: 'engorde' | 'maternidad' | 'verracos' | 'lechones' | 'padrotes' | 'vacas';
  currentWeightKg: number;
  healthStatus: 'Optimo' | 'Tratamiento' | 'Gestante' | 'Lactante';
  accumulatedCostUsd: number; // Costo acumulado histórico
  birthDate: string;
}

// Colección: /farms/{farmId}/warehouse/{itemId}
interface WarehouseItemDoc {
  id: string;
  name: string;
  category: 'alimentos' | 'medicinas' | 'otros';
  quantity: number;
  unit: 'kg' | 'g' | 'litros' | 'ml' | 'unidades';
  unitCostUsd: number;
  monthlyConsumptionRate: number; // Tasa mensual del hato
  isCriticalTwoMonths: boolean; // True si quantity / monthlyConsumptionRate < 2.0
}

// Colección: /farms/{farmId}/sanitary_tasks/{taskId}
interface SanitaryTaskDoc {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  targetGroup: string;
  procedure: string;
  medicamentUsed?: string;
  dosage?: string;
  status: 'pendiente' | 'completada';
}

// Colección: /farms/{farmId}/financial_movements/{movementId}
interface FinancialMovementDoc {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  rubro: 'porcino' | 'bovino' | 'avicola' | 'general';
  amount: number;
  date: string;
  category: string;
}
\`\`\`

---

### 5. FÓRMULAS MATEMÁTICAS PECUARIAS
1. **Prorrateo de Costo al Destete:**
   \`Costo_Por_Lechón = (Costo_Alimento_Gestación + Costo_Alimento_Lactancia + Medicinas_Madre) / Lechones_Vivos_Destetados\`
2. **Alerta de Stock a 2 Meses (60 Días):**
   \`Meses_Cobertura = Stock_Actual / Consumo_Mensual_Hato\`
   *Si \`Meses_Cobertura < 2.0\`, emitir notificación de urgencia de compra.*
3. **Liquidación de Venta en Canal:**
   \`Peso_Canal = Peso_Vivo_Final * (Rendimiento_Canal_% / 100)\`
   \`Ingreso_Bruto = Peso_Canal * Precio_Canal_Kg\`
   \`Utilidad_Neta = Ingreso_Bruto - Costo_Acumulado_Trazabilidad\`
`;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(getFullMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div id="documentation-view-container" className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Bar for Documentation */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">
              Especificación Técnica & Requerimientos de Desarrollo (SRS)
            </h2>
            <p className="text-[11px] text-slate-400">
              Guía de arquitectura, historias de usuario y reglas de negocio para el Agente Programador
            </p>
          </div>
        </div>

        <button
          id="btn-copy-full-spec"
          onClick={handleCopyMarkdown}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? '¡Copiado al Portapapeles!' : 'Copiar Especificación (.md)'}
        </button>
      </div>

      {/* Doc Navigation Tabs */}
      <div className="bg-slate-950/70 border-b border-slate-800/80 px-4 flex items-center gap-1 overflow-x-auto text-xs shrink-0 no-scrollbar">
        <button
          onClick={() => setActiveDocTab('historias')}
          className={`px-3 py-2.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeDocTab === 'historias'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Historias de Usuario (HU-01 a HU-10)
        </button>

        <button
          onClick={() => setActiveDocTab('flujos')}
          className={`px-3 py-2.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeDocTab === 'flujos'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" /> Flujo de Usuario Detallado
        </button>

        <button
          onClick={() => setActiveDocTab('stack')}
          className={`px-3 py-2.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeDocTab === 'stack'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> Stack Tecnológico Sugerido
        </button>

        <button
          onClick={() => setActiveDocTab('schemas')}
          className={`px-3 py-2.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeDocTab === 'schemas'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> Modelos Firestore / TS
        </button>

        <button
          onClick={() => setActiveDocTab('formulas')}
          className={`px-3 py-2.5 font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeDocTab === 'formulas'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" /> Fórmulas & Reglas Pecuarias
        </button>
      </div>

      {/* Doc Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* =========================================================================
            TAB: HISTORIAS DE USUARIO
        ========================================================================= */}
        {activeDocTab === 'historias' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-base font-bold text-white mb-1">
                Catálogo de Historias de Usuario (Alcance de Codificación)
              </h3>
              <p className="text-xs text-slate-300">
                Cada historia define los criterios de aceptación indispensables que el agente desarrollador debe implementar en código.
              </p>
            </div>

            <div className="space-y-3">
              {userStoriesDoc.map((hu) => {
                const isOpen = expandedHU === hu.id;

                return (
                  <div
                    key={hu.id}
                    className="bg-slate-800/90 rounded-2xl border border-slate-700/70 overflow-hidden transition-all shadow-sm"
                  >
                    <button
                      onClick={() => setExpandedHU(isOpen ? null : hu.id)}
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-700/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {hu.id}
                        </span>
                        <div>
                          <h4 className="font-bold text-white text-sm">{hu.title}</h4>
                          <span className="text-xs text-slate-400">Rol: {hu.role}</span>
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-0 border-t border-slate-700/50 space-y-3 text-xs">
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 space-y-1">
                          <p className="text-slate-300">
                            <strong className="text-emerald-400">Quiero:</strong> {hu.want}
                          </p>
                          <p className="text-slate-300">
                            <strong className="text-emerald-400">Para:</strong> {hu.soThat}
                          </p>
                        </div>

                        <div>
                          <h5 className="font-bold text-slate-200 mb-2">Criterios de Aceptación:</h5>
                          <div className="space-y-2">
                            {hu.acceptanceCriteria.map((ac, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/40"
                              >
                                <span className="font-bold text-slate-300 block mb-1">
                                  {ac.section}:
                                </span>
                                <ul className="list-disc list-inside space-y-1 text-slate-300">
                                  {ac.points.map((pt, pIdx) => (
                                    <li key={pIdx} className="leading-relaxed">
                                      {pt}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>

                        {hu.businessRule && (
                          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200">
                            <strong className="text-amber-400">Regla de Negocio Crítica:</strong> {hu.businessRule}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: FLUJOS DE USUARIO
        ========================================================================= */}
        {activeDocTab === 'flujos' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-base font-bold text-white mb-1">
                Flujo de Usuario Paso a Paso (User Journey)
              </h3>
              <p className="text-xs text-slate-300">
                Secuencia cronológica de interacción entre el operador pecuario y los componentes de software.
              </p>
            </div>

            <div className="relative border-l-2 border-emerald-500/40 ml-4 pl-6 space-y-6">
              {userFlowSteps.map((step) => (
                <div key={step.step} className="relative group">
                  {/* Step marker */}
                  <div className="absolute -left-[35px] top-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center ring-4 ring-slate-900">
                    {step.step}
                  </div>

                  <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{step.title}</h4>
                      <span className="text-[10px] bg-slate-700 text-emerald-300 font-semibold px-2 py-0.5 rounded-full">
                        Actor: {step.actor}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 pt-1">
                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">
                          ACCIÓN DEL USUARIO:
                        </span>
                        <p className="text-slate-200">{step.action}</p>
                      </div>

                      <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
                        <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">
                          RESPUESTA DEL SISTEMA:
                        </span>
                        <p className="text-slate-200">{step.systemResponse}</p>
                      </div>
                    </div>

                    {step.edgeCases && (
                      <p className="text-[11px] text-amber-300/90 pt-1">
                        <strong>Manejo de Casos Borde:</strong> {step.edgeCases}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: STACK TECNOLÓGICO SUGERIDO
        ========================================================================= */}
        {activeDocTab === 'stack' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-base font-bold text-white mb-1">
                Stack Tecnológico Recomendado & Justificación
              </h3>
              <p className="text-xs text-slate-300">
                Selección de tecnologías pensada para resistir trabajo en campo rural, sin internet permanente y con sincronización robusta.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {techStackRecommendations.map((tech, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      {tech.layer}
                    </span>
                  </div>
                  <h4 className="font-bold text-white text-sm">{tech.technology}</h4>
                  <p className="text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded-xl border border-slate-700/50">
                    {tech.rationale}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl text-xs text-emerald-200 space-y-2">
              <h4 className="font-bold text-emerald-300 text-sm">
                Estrategia Offline-First para Granjas Rurales
              </h4>
              <p className="leading-relaxed">
                Cloud Firestore implementa una base de datos local embebida (SQLite en iOS/Android e IndexedDB en web). Todas las operaciones de pesaje, vacunación o deducción de almacén se ejecutan instantáneamente sin esperar respuesta del servidor. Al conectarse a una red WiFi en la oficina de la granja, el motor de sincronización de Firebase resuelve los conflictos y actualiza el balance general.
              </p>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: MODELOS DE DATOS Y SCHEMAS
        ========================================================================= */}
        {activeDocTab === 'schemas' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-base font-bold text-white mb-1">
                Modelos de Datos TypeScript & Colecciones Cloud Firestore
              </h3>
              <p className="text-xs text-slate-300">
                Interfaces formales listas para copiar en el archivo `src/types.ts` o en los esquemas de backend.
              </p>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 overflow-x-auto">
              <pre className="font-mono text-xs text-emerald-300 leading-relaxed">
{`// 1. Entidad Granja (/farms/{farmId})
export interface FarmDoc {
  id: string;
  name: string; // ej: "Granja Arianna"
  ownerId: string;
  members: Array<{ userId: string; role: 'admin' | 'vet' | 'operator' | 'worker' }>;
  counts: {
    avicola: { pollosEngorde: number };
    porcino: { productoras: number; lechones: number; verracos: number; engorde: number };
    bovino: { padrotes: number; becerros: number; vacas: number };
  };
  totalUtilityUsd: number;
}

// 2. Animal Individual o Lote (/farms/{farmId}/animals/{animalId})
export interface AnimalDoc {
  id: string;
  code: string; // "CER-088", "VER-001"
  rubro: 'porcino' | 'bovino' | 'avicola';
  category: 'engorde' | 'maternidad' | 'verracos' | 'lechones';
  currentWeightKg: number;
  birthDate: string;
  accumulatedCostUsd: number; // Costo acumulado en alimento y medicina
  healthStatus: 'Optimo' | 'Tratamiento' | 'Gestante' | 'Lactante';
  motherId?: string;
  dietPhase?: string;
}

// 3. Almacén e Inventario (/farms/{farmId}/warehouse/{itemId})
export interface WarehouseDoc {
  id: string;
  name: string;
  category: 'alimentos' | 'medicinas' | 'otros';
  subCategory: string;
  quantity: number;
  unit: 'kg' | 'g' | 'litros' | 'ml' | 'unidades';
  unitCostUsd: number;
  monthlyConsumptionRate: number; // Consumo mensual del hato
  minAlertThreshold: number; // Umbral de alerta para 2 meses
}

// 4. Actividad Sanitaria (/farms/{farmId}/sanitary/{taskId})
export interface SanitaryDoc {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  targetGroup: string;
  procedure: string; // Protocolo veterinario descriptivo
  medicamentUsed?: string;
  dosage?: string;
  status: 'pendiente' | 'completada';
}

// 5. Asiento Contable / Balance (/farms/{farmId}/finances/{movementId})
export interface FinancialMovementDoc {
  id: string;
  type: 'ingreso' | 'egreso';
  concept: string;
  rubro: 'porcino' | 'bovino' | 'avicola' | 'general';
  amount: number;
  date: string;
  category: string;
}`}
              </pre>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: FÓRMULAS Y REGLAS PECUARIAS
        ========================================================================= */}
        {activeDocTab === 'formulas' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/80">
              <h3 className="text-base font-bold text-white mb-1">
                Fórmulas Matemáticas & Reglas de Negocio Codificables
              </h3>
              <p className="text-xs text-slate-300">
                Ecuaciones pecuarias que el agente debe implementar en los cálculos de los formularios.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* Fórmula 1: Prorrateo Destete */}
              <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700 space-y-2">
                <span className="text-[10px] uppercase font-bold text-rose-400 block">
                  Regla 1: Prorrateo de Costo de Lechones al Destete
                </span>
                <h4 className="font-bold text-white text-sm">
                  Costo Madre ÷ Lechones Vivos
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl font-mono text-emerald-300 text-xs border border-slate-800">
                  Costo_Unitario_Lechón = (Gasto_Gestación_Madre + Gasto_Lactancia_Madre + Sanidad_Madre) / Lechones_Vivos_Destetados
                </div>
                <p className="text-slate-300">
                  Al destetar, si los lechones se quedan en la granja, se incorporan al inventario de "Engorde" con este costo base. Si se venden, la ganancia neta es: <code>(Precio_Venta - Costo_Unitario) * Cantidad_Vendida</code>.
                </p>
              </div>

              {/* Fórmula 2: Alerta de Stock a 2 Meses */}
              <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700 space-y-2">
                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                  Regla 2: Alerta Predictiva de Desabastecimiento a 2 Meses (60 días)
                </span>
                <h4 className="font-bold text-white text-sm">
                  Cálculo de Autonomía de Almacén
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl font-mono text-emerald-300 text-xs border border-slate-800">
                  Dias_Cobertura = (Stock_Actual_Kg / Consumo_Diario_Hato_Kg);
                  Alerta_Critica = Dias_Cobertura &lt; 60;
                </div>
                <p className="text-slate-300">
                  Si las existencias en almacén representan menos de 60 días de consumo continuo para el número de cerdas y cerdos activos, el sistema debe disparar la insignia de advertencia en color ámbar/rojo.
                </p>
              </div>

              {/* Fórmula 3: Venta en Pie vs Canal */}
              <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700 space-y-2">
                <span className="text-[10px] uppercase font-bold text-blue-400 block">
                  Regla 3: Liquidación de Venta en Pie vs Canal
                </span>
                <h4 className="font-bold text-white text-sm">
                  Rendimiento en Frigorífico y Margen Operativo
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl font-mono text-emerald-300 text-xs border border-slate-800">
                  Peso_Canal_Kg = Peso_Vivo_Kg * (Rendimiento_Canal_% / 100);
                  Ingreso_Bruto = (Modalidad == 'pie') ? (Peso_Vivo_Kg * Precio_Pie) : (Peso_Canal_Kg * Precio_Canal);
                  Utilidad_Neta = Ingreso_Bruto - Costo_Acumulado_Trazabilidad;
                </div>
                <p className="text-slate-300">
                  Permite al productor evaluar de antemano si le es más rentable comercializar los cerdos vivos o llevarlos a canal de matadero.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
