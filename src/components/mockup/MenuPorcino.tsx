import React, { useState } from 'react';
import {
  Package,
  Receipt,
  Users,
  FileBarChart,
  CheckSquare,
  Binary,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Layers,
  Baby,
  Scale,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Heart,
  Activity,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  FarmSummary,
  PorcinoAnimal,
  SanitaryTask,
  FinancialMovement,
  FeedingPhaseData,
  WarehouseItem,
  BatchProductionConfig,
  ProductionBatch,
  AnimalTraceEvent,
  FarrowingRecord,
  LactatingLitter,
  SlaughterDispatchData,
  PorcinoCategory,
  ProductionFeedingPlan,
  ProductionType,
  UnifiedSaleResult,
} from '../../types';
import {
  monthlyFinancialHistory,
  feedingPhasesData,
  batchProductionConfigsDefault,
  productionBatchesSample,
  initialLactatingLitters,
  productionFeedingPlansDefault,
  generateSanitaryTasksForBatch,
} from '../../data/pecuarioData';
import { SanitaryProcedureModal } from './SanitaryProcedureModal';
import { WarehouseModal } from './WarehouseModal';
import { WeaningProratingModal } from './WeaningProratingModal';
import { UnifiedSaleSlaughterModal } from './UnifiedSaleSlaughterModal';
import { AddSanitaryActivityModal } from './AddSanitaryActivityModal';
import { BatchProductionConfigModal } from './BatchProductionConfigModal';
import { dbService } from '../../services/dbService';
import { HerdCategoryViewModal } from './HerdCategoryViewModal';
import { AnimalTraceabilityModal } from './AnimalTraceabilityModal';
import { FarrowingModal } from './FarrowingModal';
import { BoarMatingAndNewModal } from './BoarMatingAndNewModal';
import { PigletMortalityModal } from './PigletMortalityModal';
import { FeedingPlanConfigModal } from './FeedingPlanConfigModal';

interface MenuPorcinoProps {
  summary: FarmSummary;
  animals: PorcinoAnimal[];
  tasks: SanitaryTask[];
  movements: FinancialMovement[];
  warehouseItems: WarehouseItem[];
  onBackToHome: () => void;
  onUpdateTasks: (tasks: SanitaryTask[]) => void;
  onUpdateMovements: (movements: FinancialMovement[]) => void;
  onUpdateWarehouse: (items: WarehouseItem[]) => void;
  onUpdateAnimals?: (animals: PorcinoAnimal[]) => void;
  onUpdateSummary?: React.Dispatch<React.SetStateAction<FarmSummary>>;
}

export const MenuPorcino: React.FC<MenuPorcinoProps> = ({
  summary,
  animals,
  tasks,
  movements,
  warehouseItems,
  onBackToHome,
  onUpdateTasks,
  onUpdateMovements,
  onUpdateWarehouse,
  onUpdateAnimals,
  onUpdateSummary,
}) => {
  // Tabs: 1. Porcinos, 2. Atajos, 3. Plan Sanitario, 4. Balance, 5. Alimentación
  const [activeTab, setActiveTab] = useState<'porcinos' | 'atajos' | 'sanitario' | 'balance' | 'alimentacion'>('porcinos');

  // Modals state
  const [selectedTask, setSelectedTask] = useState<SanitaryTask | null>(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showWeaningModal, setShowWeaningModal] = useState(false);
  const [showUnifiedSaleModal, setShowUnifiedSaleModal] = useState(false);
  const [preselectedSaleAnimalCode, setPreselectedSaleAnimalCode] = useState<string | undefined>(undefined);
  const [preselectedSaleCategory, setPreselectedSaleCategory] = useState<string | undefined>(undefined);
  const [showAnimalListCategory, setShowAnimalListCategory] = useState<string | null>(null);
  const [showAddSanitaryModal, setShowAddSanitaryModal] = useState(false);
  const [showBatchConfigModal, setShowBatchConfigModal] = useState(false);

  // Traceability & Reproductive Lifecycle States
  const [litters, setLitters] = useState<LactatingLitter[]>(initialLactatingLitters);
  const [selectedAnimalForTrace, setSelectedAnimalForTrace] = useState<PorcinoAnimal | null>(null);
  const [showFarrowingModal, setShowFarrowingModal] = useState(false);
  const [preselectedSowForFarrowing, setPreselectedSowForFarrowing] = useState<string | undefined>(undefined);
  const [showBoarMatingModal, setShowBoarMatingModal] = useState(false);
  const [boarMatingInitialTab, setBoarMatingInitialTab] = useState<'monta' | 'nuevo'>('monta');
  const [showPigletMortalityModal, setShowPigletMortalityModal] = useState(false);
  const [preselectedLitterForMortality, setPreselectedLitterForMortality] = useState<string | undefined>(undefined);

  // Sub-filter for Balance: "Total" vs "Mes Actual"
  const [balanceFilter, setBalanceFilter] = useState<'total' | 'mes'>('mes');

  // Calendario Sanitario state (Agosto 2026)
  const [selectedDay, setSelectedDay] = useState<number>(19); // 19 de Agosto por defecto

  // Batch production configuration state
  const [batchConfigs, setBatchConfigs] = useState<BatchProductionConfig[]>(batchProductionConfigsDefault);
  const [productionBatches, setProductionBatches] = useState<ProductionBatch[]>(productionBatchesSample);

  // Feeding plan state (Requisitos 7 y 8)
  const [feedingPlans, setFeedingPlans] = useState<ProductionFeedingPlan[]>(productionFeedingPlansDefault);
  const [selectedFeedingPlanType, setSelectedFeedingPlanType] = useState<ProductionType>('engorde');
  const [showFeedingPlanConfigModal, setShowFeedingPlanConfigModal] = useState(false);

  // Feeding calculator state (Gestación, Lactancia y Lechones de Engorde)
  const [calcSowsInGestation, setCalcSowsInGestation] = useState(30);
  const [calcSowsInLactation, setCalcSowsInLactation] = useState(12);
  const [calcPigsEngorde, setCalcPigsEngorde] = useState(140);
  const [calcEngordeKgPerDay, setCalcEngordeKgPerDay] = useState(2.2);

  // Complete task handler
  const handleCompleteTask = (taskId: string) => {
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, status: 'completada' as const } : t));
    onUpdateTasks(updated);
  };

  // Add new sanitary task handler
  const handleAddNewSanitaryTask = (newTask: SanitaryTask) => {
    onUpdateTasks([newTask, ...tasks]);
    setShowAddSanitaryModal(false);
    // If the task is in August 2026, jump selectedDay to it
    if (newTask.date.startsWith('2026-08')) {
      const dayNum = parseInt(newTask.date.split('-')[2], 10);
      if (!isNaN(dayNum)) {
        setSelectedDay(dayNum);
      }
    }
  };

  // Start new batch with automated tasks
  const handleStartNewBatch = (newBatch: ProductionBatch, generatedTasks: SanitaryTask[]) => {
    setProductionBatches([newBatch, ...productionBatches]);
    onUpdateTasks([...generatedTasks, ...tasks]);
  };

  // Consume warehouse item handler
  const handleConsumeItem = (itemId: string, amount: number, target: string) => {
    const item = warehouseItems.find((w) => w.id === itemId);
    if (!item) return;

    const updatedWarehouse = warehouseItems.map((w) =>
      w.id === itemId ? { ...w, quantity: Math.max(0, w.quantity - amount) } : w
    );
    onUpdateWarehouse(updatedWarehouse);

    // Add cost to financial movements
    const cost = amount * item.unitCostUsd;
    const newMovement: FinancialMovement = {
      id: 'fm-' + Date.now(),
      type: 'egreso',
      concept: `Consumo: ${amount} ${item.unit} de ${item.name} (${target})`,
      rubro: 'porcino',
      amount: Math.round(cost * 100) / 100,
      date: '2026-08-19',
      category: item.category === 'alimentos' ? 'Alimento Balanceado' : 'Vacunación',
    };
    onUpdateMovements([newMovement, ...movements]);
  };

  // Add new warehouse item
  const handleAddWarehouseItem = (newItem: WarehouseItem) => {
    onUpdateWarehouse([newItem, ...warehouseItems]);
  };

  // Confirm weaning handler (Requisitos 2 y 3)
  const handleConfirmWeaning = (data: any) => {
    // 1. Si parte o todos los lechones se venden:
    if (data.destinedVenta && data.destinedVenta > 0) {
      const saleMovement: FinancialMovement = {
        id: 'fm-wean-sale-' + Date.now(),
        type: 'ingreso',
        concept: `Venta de ${data.destinedVenta} lechones destetados (Madre ${data.sowCode}) a ${data.buyerVenta || 'Comprador'}`,
        rubro: 'porcino',
        amount: Math.round(data.totalSaleRevenue || (data.destinedVenta * (data.salePricePerPiglet || 65))),
        date: '2026-08-19',
        category: 'Venta de cerdos',
        details: `Venta de ${data.destinedVenta} lechones a $${data.salePricePerPiglet || 65}/lechón. Costo prorrateado de crianza: $${(data.destinedVenta * data.costPerPiglet).toFixed(2)}. Utilidad neta: +$${(data.netSaleProfit || 0).toFixed(2)}.`,
      };
      onUpdateMovements([saleMovement, ...movements]);
    }

    // 2. Lechones que se quedan para la granja (Engorde, Madres, Verracos)
    const newAnimalsToAdd: PorcinoAnimal[] = [];
    const newTasksToSchedule: SanitaryTask[] = [];

    // 2.1 Destinados a Engorde (Requisito 1 & 2)
    if (data.destinedEngorde && data.destinedEngorde > 0) {
      const engordeAnimal: PorcinoAnimal = {
        id: `p-eng-dest-${Date.now()}`,
        code: `ENG-D-${data.sowCode.replace(/[^a-zA-Z0-9]/g, '') || 'CAM'}-${Math.floor(Math.random() * 900 + 100)}`,
        name: `Lote Engorde Destete (${data.destinedEngorde} cerdos)`,
        category: 'engorde',
        breed: 'Híbrido Comercial Ceba',
        birthDate: '2026-07-22',
        currentWeightKg: 8.5,
        healthStatus: 'Optimo',
        stage: 'Fase 1: Pre-iniciador Transición',
        batchAnimalCount: data.destinedEngorde, // Requisito 1: conteo de animales del lote
        accumulatedCostUsd: Math.round(data.costPerPiglet * data.destinedEngorde * 100) / 100,
        photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
        origin: 'destetado',
        penLocation: data.penEngorde || 'Galpón Engorde 1',
        provenance: `Granja Propia (Camada Cerda ${data.sowCode})`,
        admissionDate: '2026-08-19',
        admissionWeightKg: 8.5,
        admissionPriceUsd: data.costPerPiglet,
        traceability: [
          {
            id: `tr-dest-eng-${Date.now()}`,
            date: '2026-08-19',
            type: 'traslado',
            title: `Destete e Ingreso a Engorde (${data.destinedEngorde} lechones)`,
            description: `Destetados de la cerda ${data.sowCode}. Asignados a ceba en ${data.penEngorde || 'Galpón Engorde 1'}. Costo prorrateado: $${data.costPerPiglet.toFixed(2)} c/u.`,
            responsible: 'Dr. Roberto Salas (Vet)',
            costUsd: data.destinedEngorde * data.costPerPiglet,
          },
        ],
      };
      newAnimalsToAdd.push(engordeAnimal);

      // Auto-plan sanitario para engorde
      const engTasks = generateSanitaryTasksForBatch(
        'engorde',
        engordeAnimal.code,
        '2026-08-19',
        engordeAnimal.penLocation || 'Galpón Engorde',
        data.destinedEngorde,
        batchConfigs
      );
      newTasksToSchedule.push(...engTasks);
    }

    // 2.2 Destinadas a Madres / Reemplazo (Requisito 2 & 3: cantidad de pezones)
    if (data.destinedMadre && data.destinedMadre > 0) {
      const teatsNumber = data.teatsCountMadre || 14;
      const madreAnimal: PorcinoAnimal = {
        id: `p-mat-dest-${Date.now()}`,
        code: `MAD-D-${data.sowCode.replace(/[^a-zA-Z0-9]/g, '') || 'CAM'}-${Math.floor(Math.random() * 900 + 100)}`,
        name: `Futuras Reproductoras Destete (${data.destinedMadre} cerdas)`,
        category: 'maternidad',
        breed: 'Landrace / Yorkshire',
        birthDate: '2026-07-22',
        currentWeightKg: 8.5,
        healthStatus: 'Optimo',
        stage: 'Futura Reproductora de Reemplazo',
        teatsCount: teatsNumber, // Requisito 3: cantidad de pezones
        accumulatedCostUsd: Math.round(data.costPerPiglet * data.destinedMadre * 100) / 100,
        photoUrl: 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=400&auto=format&fit=crop&q=80',
        origin: 'destetado',
        penLocation: data.penMadre || 'Galpón Cría / Maternidad',
        provenance: `Granja Propia (Hijas de Cerda ${data.sowCode})`,
        admissionDate: '2026-08-19',
        admissionWeightKg: 8.5,
        admissionPriceUsd: data.costPerPiglet,
        traceability: [
          {
            id: `tr-dest-mat-${Date.now()}`,
            date: '2026-08-19',
            type: 'traslado',
            title: `Destete y Selección para Maternidad (${data.destinedMadre} hembras)`,
            description: `Seleccionadas como reemplazo de cría de la camada de ${data.sowCode}. Calificación de ${teatsNumber} pezones funcionales. Ubicadas en ${data.penMadre || 'Galpón Maternidad'}.`,
            responsible: 'Dr. Roberto Salas (Vet)',
            costUsd: data.destinedMadre * data.costPerPiglet,
          },
        ],
      };
      newAnimalsToAdd.push(madreAnimal);

      // Auto-plan sanitario para maternidad
      const matTasks = generateSanitaryTasksForBatch(
        'maternidad',
        madreAnimal.code,
        '2026-08-19',
        madreAnimal.penLocation || 'Galpón Maternidad',
        data.destinedMadre,
        batchConfigs
      );
      newTasksToSchedule.push(...matTasks);
    }

    // 2.3 Destinados a Verraco / Futuros Sementales (Requisito 2)
    if (data.destinedVerraco && data.destinedVerraco > 0) {
      const verracoAnimal: PorcinoAnimal = {
        id: `p-ver-dest-${Date.now()}`,
        code: `VER-D-${data.sowCode.replace(/[^a-zA-Z0-9]/g, '') || 'CAM'}-${Math.floor(Math.random() * 900 + 100)}`,
        name: `Futuro Semental Destete (${data.destinedVerraco} machos)`,
        category: 'verracos',
        breed: 'Pietrain / Duroc',
        birthDate: '2026-07-22',
        currentWeightKg: 9.0,
        healthStatus: 'Optimo',
        stage: 'Futuro Semental Joven',
        accumulatedCostUsd: Math.round(data.costPerPiglet * data.destinedVerraco * 100) / 100,
        photoUrl: 'https://images.unsplash.com/photo-1563281577-a7be47e20db9?w=400&auto=format&fit=crop&q=80',
        origin: 'destetado',
        penLocation: data.penVerraco || 'Corral Verracos',
        provenance: `Granja Propia (Hijo de Cerda ${data.sowCode})`,
        admissionDate: '2026-08-19',
        admissionWeightKg: 9.0,
        admissionPriceUsd: data.costPerPiglet,
        traceability: [
          {
            id: `tr-dest-ver-${Date.now()}`,
            date: '2026-08-19',
            type: 'traslado',
            title: `Destete y Selección de Futuro Verraco (${data.destinedVerraco} machos)`,
            description: `Seleccionado para futuro plantel reproductor de la camada ${data.sowCode}. Ubicado en ${data.penVerraco || 'Corral Verracos'}.`,
            responsible: 'Dr. Roberto Salas (Vet)',
            costUsd: data.destinedVerraco * data.costPerPiglet,
          },
        ],
      };
      newAnimalsToAdd.push(verracoAnimal);

      // Auto-plan sanitario para verracos
      const verTasks = generateSanitaryTasksForBatch(
        'verracos',
        verracoAnimal.code,
        '2026-08-19',
        verracoAnimal.penLocation || 'Corral Verracos',
        data.destinedVerraco,
        batchConfigs
      );
      newTasksToSchedule.push(...verTasks);
    }

    if (newAnimalsToAdd.length > 0 && onUpdateAnimals) {
      onUpdateAnimals([...newAnimalsToAdd, ...animals]);
    }

    if (newTasksToSchedule.length > 0) {
      onUpdateTasks([...newTasksToSchedule, ...tasks]);
    }

    // 3. Update FarmSummary counts
    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            lechones: Math.max(0, prev.counts.porcino.lechones - data.numPiglets),
            engorde: prev.counts.porcino.engorde + (data.destinedEngorde || 0),
            maternidad: prev.counts.porcino.maternidad + (data.destinedMadre || 0),
            verracos: prev.counts.porcino.verracos + (data.destinedVerraco || 0),
          },
        },
      }));
    }

    // Mark litter as weaned in litters state if present
    setLitters((prev) =>
      prev.map((l) =>
        l.sowCode === data.sowCode || l.batchCode === data.loteLechones
          ? { ...l, currentAliveCount: 0, status: 'destetada' }
          : l
      )
    );
  };

  // Register New Pigs in Engorde (Requisito 2 & 1)
  const handleRegisterNewPigs = (pigsData: {
    penLocation: string;
    quantity: number;
    ageWeeks: number;
    admissionWeightKg: number;
    admissionDate: string;
    provenance: string;
    admissionPriceUsd: number;
  }) => {
    const newAnimal: PorcinoAnimal = {
      id: `p-eng-new-${Date.now()}`,
      code: `ENG-L${animals.filter((a) => a.category === 'engorde').length + 1}`,
      name: `Lote Engorde (${pigsData.quantity} cerdos)`,
      category: 'engorde',
      breed: 'Híbrido Comercial Ceba',
      birthDate: '2026-06-10',
      currentWeightKg: pigsData.admissionWeightKg,
      healthStatus: 'Optimo',
      stage: 'Inicio / Ceba Comercial',
      accumulatedCostUsd: Math.round(pigsData.admissionPriceUsd * 100) / 100,
      photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
      origin: 'comprado',
      penLocation: pigsData.penLocation,
      provenance: pigsData.provenance,
      admissionDate: pigsData.admissionDate,
      admissionWeightKg: pigsData.admissionWeightKg,
      admissionPriceUsd: pigsData.admissionPriceUsd,
      batchAnimalCount: pigsData.quantity,
      traceability: [
        {
          id: `tr-ing-${Date.now()}`,
          date: pigsData.admissionDate,
          type: 'traslado',
          title: `Ingreso de Cerdos de Engorde (${pigsData.quantity} animales)`,
          description: `Ingreso de ${pigsData.quantity} cerdos de ${pigsData.ageWeeks} semanas con peso promedio de ${pigsData.admissionWeightKg} kg procedentes de ${pigsData.provenance}. Ubicados en ${pigsData.penLocation}. Costo: $${pigsData.admissionPriceUsd} c/u.`,
          responsible: 'Ing. Carlos Mendoza',
          costUsd: pigsData.quantity * pigsData.admissionPriceUsd,
        },
      ],
    };

    if (onUpdateAnimals) {
      onUpdateAnimals([newAnimal, ...animals]);
    }

    // Financial Egreso
    const totalCost = pigsData.quantity * pigsData.admissionPriceUsd;
    if (totalCost > 0) {
      const buyMovement: FinancialMovement = {
        id: 'fm-buy-eng-' + Date.now(),
        type: 'egreso',
        concept: `Compra de ${pigsData.quantity} Cerdos de Engorde (${pigsData.provenance})`,
        rubro: 'porcino',
        amount: Math.round(totalCost * 100) / 100,
        date: pigsData.admissionDate,
        category: 'Compra de animales',
        details: `${pigsData.quantity} cerdos a $${pigsData.admissionPriceUsd} c/u, peso prom. ${pigsData.admissionWeightKg}kg en corral ${pigsData.penLocation}.`,
      };
      onUpdateMovements([buyMovement, ...movements]);
    }

    // Automatically schedule sanitary plan for engorde (Requisito 1)
    const newTasks = generateSanitaryTasksForBatch(
      'engorde',
      newAnimal.code,
      pigsData.admissionDate,
      pigsData.penLocation,
      pigsData.quantity,
      batchConfigs
    );
    if (newTasks.length > 0) {
      onUpdateTasks([...newTasks, ...tasks]);
    }

    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            engorde: prev.counts.porcino.engorde + pigsData.quantity,
          },
        },
      }));
    }
  };

  // Register New Mother in Maternidad (Requisito 5 & 1)
  const handleRegisterNewMother = (motherData: {
    code?: string;
    breed: string;
    ageWeeks: number;
    currentWeightKg: number;
    teatsCount: number;
    admissionPriceUsd: number;
    penLocation: string;
    provenance: string;
  }) => {
    const motherCode =
      motherData.code ||
      `CERDA-${String(animals.filter((a) => a.category === 'maternidad').length + 1).padStart(2, '0')}`;

    const newMother: PorcinoAnimal = {
      id: `p-mat-new-${Date.now()}`,
      code: motherCode,
      name: `Cerda Reproductora ${motherCode}`,
      category: 'maternidad',
      breed: motherData.breed,
      birthDate: '2025-11-20',
      currentWeightKg: motherData.currentWeightKg,
      healthStatus: 'Optimo',
      stage: 'Etapa Reproductiva / Reemplazo',
      accumulatedCostUsd: Math.round(motherData.admissionPriceUsd * 100) / 100,
      photoUrl: 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=400&auto=format&fit=crop&q=80',
      origin: 'comprado',
      penLocation: motherData.penLocation,
      provenance: motherData.provenance,
      teatsCount: motherData.teatsCount,
      admissionDate: '2026-08-19',
      admissionWeightKg: motherData.currentWeightKg,
      admissionPriceUsd: motherData.admissionPriceUsd,
      traceability: [
        {
          id: `tr-mat-${Date.now()}`,
          date: '2026-08-19',
          type: 'observacion',
          title: `Alta de Cerda Reproductora ${motherCode}`,
          description: `Ingreso de cerda reproductora raza ${motherData.breed}, ${motherData.ageWeeks} semanas, ${motherData.teatsCount} pezones funcionales, peso ${motherData.currentWeightKg} kg, procedencia ${motherData.provenance}. Ubicada en ${motherData.penLocation}.`,
          responsible: 'Dr. Roberto Salas (Vet)',
          costUsd: motherData.admissionPriceUsd,
        },
      ],
    };

    if (onUpdateAnimals) {
      onUpdateAnimals([newMother, ...animals]);
    }

    if (motherData.admissionPriceUsd > 0) {
      const buyMovement: FinancialMovement = {
        id: 'fm-buy-mat-' + Date.now(),
        type: 'egreso',
        concept: `Compra de Cerda Reproductora ${motherCode} (${motherData.breed})`,
        rubro: 'porcino',
        amount: Math.round(motherData.admissionPriceUsd * 100) / 100,
        date: '2026-08-19',
        category: 'Compra de animales',
        details: `Cerda ${motherData.breed} con ${motherData.teatsCount} pezones, procedencia ${motherData.provenance}.`,
      };
      onUpdateMovements([buyMovement, ...movements]);
    }

    // Automatically schedule sanitary plan for maternidad (Requisito 1)
    const newTasks = generateSanitaryTasksForBatch(
      'maternidad',
      motherCode,
      '2026-08-19',
      motherData.penLocation,
      1,
      batchConfigs
    );
    if (newTasks.length > 0) {
      onUpdateTasks([...newTasks, ...tasks]);
    }

    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            maternidad: prev.counts.porcino.maternidad + 1,
          },
        },
      }));
    }
  };

  // Unified Sale / Slaughter Handler (Requisito 4)
  const handleConfirmUnifiedSale = (result: UnifiedSaleResult) => {
    // 1. Register Financial Movement in Balance
    const movement: FinancialMovement = {
      id: 'fm-sale-' + Date.now(),
      type: 'ingreso',
      concept: `Venta ${result.saleMode === 'pie' ? 'en Pie' : 'en Canal'} (${result.animalsCount} animal/es, ${result.animalCode}) a ${result.buyer}`,
      rubro: 'porcino',
      amount: Math.round(result.netRevenueUsd * 100) / 100,
      date: result.date,
      category: 'Venta de cerdos',
      details: `Modalidad: ${result.saleMode === 'pie' ? 'En Pie' : 'En Canal'}. Peso vivo: ${result.totalLiveWeightKg}kg${result.saleMode === 'canal' && result.carcassWeightKg ? ` (${result.carcassWeightKg.toFixed(1)}kg canal)` : ''}. Precio: $${result.pricePerKg}/kg. Ingreso neto: $${result.netRevenueUsd.toFixed(2)}. Utilidad: +$${result.netProfitUsd.toFixed(2)} (${result.profitMarginPercent.toFixed(1)}% margen). Guía Sanitaria: ${result.sanitaryDocNumber || 'S/N'}.`,
    };
    onUpdateMovements([movement, ...movements]);

    // Persist to Cloud Firestore & Local Cache
    dbService.recordSaleSlaughter('granja_arianna_principal', result).catch((err) => {
      console.warn('Could not persist sale to Firestore:', err);
    });

    // 2. Mark animal / lot as Slaughtered / Salida and record traceability
    if (result.markAsSlaughtered) {
      const updatedAnimals = animals.map((a) => {
        if ((result.animalId && a.id === result.animalId) || a.code === result.animalCode) {
          const traceEvent: AnimalTraceEvent = {
            id: `tr-sale-${Date.now()}`,
            date: result.date,
            type: 'matadero',
            title: `Salida a Matadero / Liquidación (${result.saleMode === 'pie' ? 'En Pie' : 'En Canal'})`,
            description: `Venta liquidada de ${result.animalsCount} animal/es (${result.totalLiveWeightKg} kg en pie). Vendido a ${result.buyer}. Ingreso neto: $${result.netRevenueUsd.toFixed(2)}. Utilidad: +$${result.netProfitUsd.toFixed(2)}. Guía sanitaria: ${result.sanitaryDocNumber || 'S/N'}. ${result.notes || ''}`,
            responsible: 'Ing. Carlos Mendoza',
            costUsd: result.netRevenueUsd,
          };
          const tr = a.traceability ? [traceEvent, ...a.traceability] : [traceEvent];
          return {
            ...a,
            healthStatus: 'Matadero' as const,
            isSoldToSlaughter: true,
            stage: `Fin de Ciclo - Salida a Matadero (${result.buyer})`,
            traceability: tr,
          };
        }
        return a;
      });

      if (onUpdateAnimals) {
        onUpdateAnimals(updatedAnimals);
      }

      // Update farm summary counts
      if (onUpdateSummary) {
        onUpdateSummary((prev) => {
          const targetAnimal = animals.find(
            (item) => (result.animalId && item.id === result.animalId) || item.code === result.animalCode
          );
          const cat = targetAnimal?.category || (result.category as PorcinoCategory) || 'engorde';
          const currentCatCount = prev.counts.porcino[cat] || 1;
          return {
            ...prev,
            counts: {
              ...prev.counts,
              porcino: {
                ...prev.counts.porcino,
                [cat]: Math.max(0, currentCatCount - result.animalsCount),
              },
            },
          };
        });
      }
    }
  };

  // Animal Traceability: Add event handler
  const handleAddTraceEvent = (animalId: string, event: AnimalTraceEvent) => {
    const updated = animals.map((a) => {
      if (a.id === animalId) {
        const tr = a.traceability ? [event, ...a.traceability] : [event];
        return { ...a, traceability: tr };
      }
      return a;
    });
    if (onUpdateAnimals) {
      onUpdateAnimals(updated);
    }
    if (selectedAnimalForTrace && selectedAnimalForTrace.id === animalId) {
      setSelectedAnimalForTrace({
        ...selectedAnimalForTrace,
        traceability: selectedAnimalForTrace.traceability
          ? [event, ...selectedAnimalForTrace.traceability]
          : [event],
      });
    }
  };

  // Animal Traceability: Update weight handler
  const handleUpdateAnimalWeight = (animalId: string, newWeight: number) => {
    const updated = animals.map((a) => (a.id === animalId ? { ...a, currentWeightKg: newWeight } : a));
    if (onUpdateAnimals) {
      onUpdateAnimals(updated);
    }
    if (selectedAnimalForTrace && selectedAnimalForTrace.id === animalId) {
      setSelectedAnimalForTrace({
        ...selectedAnimalForTrace,
        currentWeightKg: newWeight,
      });
    }
  };

  // Farrowing Registration Handler (Requisito 4)
  const handleRegisterFarrowing = (record: FarrowingRecord, newLitter: LactatingLitter) => {
    setLitters([newLitter, ...litters]);

    // Update sow state & traceability
    const updatedAnimals = animals.map((a) => {
      if (a.code === record.sowCode) {
        const traceEvent: AnimalTraceEvent = {
          id: `tr-${Date.now()}`,
          date: record.date,
          type: 'parto',
          title: `Parto Registrado - Lote Camada ${record.litterBatchCode}`,
          description: `Nacieron ${record.bornAlive} vivos (${record.malesCount}M / ${record.femalesCount}H), ${record.stillborn} mortinatos, ${record.mummies} momias. Salud reproductiva: ${record.diseaseNotes}`,
          responsible: 'Dr. Roberto Salas (Vet)',
        };
        const tr = a.traceability ? [traceEvent, ...a.traceability] : [traceEvent];
        return {
          ...a,
          healthStatus: 'Lactante' as const,
          stage: `Fase 3: Lactancia (Camada ${record.bornAlive} lechones)`,
          traceability: tr,
        };
      }
      return a;
    });

    if (onUpdateAnimals) {
      onUpdateAnimals(updatedAnimals);
    }

    // Update Farm summary lechones count
    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            lechones: prev.counts.porcino.lechones + record.bornAlive,
          },
        },
      }));
    }

    // Create automatic sanitary task for the new litter in calendar (Iron injection)
    const taskIron: SanitaryTask = {
      id: `task-iron-${Date.now()}`,
      title: `Aplicación de Hierro Dextrano (200mg) - ${record.litterBatchCode}`,
      date: '2026-08-22',
      targetRubro: 'porcino',
      targetGroup: `Lechones Camada ${record.litterBatchCode}`,
      targetAnimal: `Camada de ${record.bornAlive} lechones (Madre ${record.sowCode})`,
      batchCode: record.litterBatchCode,
      procedure: 'Inyección intramuscular profunda en cuello de 2ml de hierro dextrano para prevención de anemia en lechones lactantes.',
      medicamentUsed: 'Hierro Dextrano 200mg/ml',
      dosage: '2 ml / lechón',
      responsible: 'Dr. Roberto Salas (Vet)',
      status: 'pendiente',
    };
    onUpdateTasks([taskIron, ...tasks]);
  };

  // Mating / Service Registration Handler (Requisito 6)
  const handleRegisterMating = (
    boarCode: string,
    sowCode: string,
    date: string,
    isExternal: boolean,
    externalCostUsd: number,
    notes: string,
    movement?: FinancialMovement
  ) => {
    if (movement) {
      onUpdateMovements([movement, ...movements]);
    }

    const updatedAnimals = animals.map((a) => {
      // Trace event for sow
      if (a.code === sowCode) {
        const sowEvent: AnimalTraceEvent = {
          id: `tr-m-${Date.now()}`,
          date,
          type: 'monta',
          title: `Servicio de Monta con ${boarCode}`,
          description: `${notes}. ${isExternal ? `Verraco externo (Costo: $${externalCostUsd} USD).` : 'Semental de la granja.'}`,
          responsible: 'Operador Ramón Gómez',
          costUsd: isExternal ? externalCostUsd : undefined,
        };
        const tr = a.traceability ? [sowEvent, ...a.traceability] : [sowEvent];
        return {
          ...a,
          healthStatus: 'Gestante' as const,
          stage: 'Gestación Temprana (Servicio Confirmado)',
          traceability: tr,
        };
      }
      // Trace event for boar if internal
      if (a.code === boarCode) {
        const boarEvent: AnimalTraceEvent = {
          id: `tr-b-${Date.now()}`,
          date,
          type: 'monta',
          title: `Monta Realizada - Cerda ${sowCode}`,
          description: `${notes}. Servicio reproductivo efectivo registrado.`,
          responsible: 'Operador Ramón Gómez',
        };
        const tr = a.traceability ? [boarEvent, ...a.traceability] : [boarEvent];
        return {
          ...a,
          traceability: tr,
        };
      }
      return a;
    });

    if (onUpdateAnimals) {
      onUpdateAnimals(updatedAnimals);
    }
  };

  // New Boar Purchase Handler (Requisito 6)
  const handleAddNewBoar = (newBoar: PorcinoAnimal, movement: FinancialMovement) => {
    if (onUpdateAnimals) {
      onUpdateAnimals([newBoar, ...animals]);
    }
    onUpdateMovements([movement, ...movements]);
    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            verracos: prev.counts.porcino.verracos + 1,
          },
        },
      }));
    }
  };

  // Piglet Mortality Registration Handler (Requisito 7)
  const handleRegisterMortality = (
    litterId: string,
    deadCount: number,
    cause: string,
    date: string,
    notes?: string
  ) => {
    const updatedLitters = litters.map((litter) => {
      if (litter.id === litterId) {
        const newHistory = [
          {
            id: `mh-${Date.now()}`,
            date,
            count: deadCount,
            cause,
            notes,
          },
          ...(litter.mortalityHistory || []),
        ];
        return {
          ...litter,
          currentCount: Math.max(0, litter.currentCount - deadCount),
          mortalityCount: litter.mortalityCount + deadCount,
          mortalityHistory: newHistory,
        };
      }
      return litter;
    });

    setLitters(updatedLitters);

    // Subtract from total piglets in summary
    if (onUpdateSummary) {
      onUpdateSummary((prev) => ({
        ...prev,
        counts: {
          ...prev.counts,
          porcino: {
            ...prev.counts.porcino,
            lechones: Math.max(0, prev.counts.porcino.lechones - deadCount),
          },
        },
      }));
    }

    // Add traceability observation to mother sow
    const targetLitter = litters.find((l) => l.id === litterId);
    if (targetLitter) {
      const updatedAnimals = animals.map((a) => {
        if (a.code === targetLitter.sowCode) {
          const traceEvent: AnimalTraceEvent = {
            id: `tr-mort-${Date.now()}`,
            date,
            type: 'observacion',
            title: `Baja en Camada ${targetLitter.batchCode}: -${deadCount} lechón(es)`,
            description: `Causa: ${cause}. Observaciones: ${notes || 'Revisión veterinaria matutina.'}`,
            responsible: 'Dr. Roberto Salas (Vet)',
          };
          const tr = a.traceability ? [traceEvent, ...a.traceability] : [traceEvent];
          return { ...a, traceability: tr };
        }
        return a;
      });
      if (onUpdateAnimals) {
        onUpdateAnimals(updatedAnimals);
      }
    }
  };

  // Filter movements
  const egresos = movements.filter((m) => m.type === 'egreso');
  const ingresos = movements.filter((m) => m.type === 'ingreso');
  const totalEgresos = egresos.reduce((acc, curr) => acc + curr.amount, 0);
  const totalIngresos = ingresos.reduce((acc, curr) => acc + curr.amount, 0);
  const utilidadPorcina = totalIngresos - totalEgresos;

  // Days with tasks in August 2026 (computed dynamically so any new or batch task immediately reflects)
  const daysWithTasks = Array.from(
    new Set(
      tasks
        .filter((t) => t.date.startsWith('2026-08'))
        .map((t) => parseInt(t.date.split('-')[2], 10))
    )
  );
  const selectedDayTasks = tasks.filter((t) => {
    const day = parseInt(t.date.split('-')[2], 10);
    return day === selectedDay && t.date.startsWith('2026-08');
  });

  return (
    <div id="menu-porcino-root" className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Tab Navigation (5 Pestañas exactas del documento) */}
      <div
        id="porcino-tabs-navigation"
        className="bg-white border-b border-slate-200 px-2 pt-2 flex items-center justify-between shrink-0 overflow-x-auto text-xs no-scrollbar"
      >
        <div className="flex gap-1 min-w-max pb-1.5">
          <button
            id="tab-porcinos"
            onClick={() => setActiveTab('porcinos')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'porcinos'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Porcinos
          </button>

          <button
            id="tab-atajos"
            onClick={() => setActiveTab('atajos')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'atajos'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Atajos
          </button>

          <button
            id="tab-sanitario"
            onClick={() => setActiveTab('sanitario')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'sanitario'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Plan sanitario
          </button>

          <button
            id="tab-balance"
            onClick={() => setActiveTab('balance')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'balance'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Balance
          </button>

          <button
            id="tab-alimentacion"
            onClick={() => setActiveTab('alimentacion')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'alimentacion'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Alimentación
          </button>
        </div>
      </div>

      {/* Main Container Scrollable */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 pb-8">
        {/* =========================================================================
            PESTAÑA 1: PORCINOS (Engorde, Maternidad, Verracos en GridView 3 columnas)
        ========================================================================= */}
        {activeTab === 'porcinos' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">
                  Rebaño Porcino Activo
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total en granja: <strong>{summary.counts.porcino.productoras + summary.counts.porcino.lechones + summary.counts.porcino.verracos + summary.counts.porcino.engorde}</strong> animales
                </p>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    setPreselectedSaleCategory('engorde');
                    setPreselectedSaleAnimalCode(undefined);
                    setShowUnifiedSaleModal(true);
                  }}
                  className="flex items-center gap-1 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer shadow-xs"
                  title="Salida a Matadero / Liquidación de Venta"
                >
                  <Truck className="w-3.5 h-3.5 text-emerald-600" /> Salida a Matadero
                </button>
                <button
                  onClick={() => setShowWeaningModal(true)}
                  className="flex items-center gap-1 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors"
                  title="Registrar Parto o Destete"
                >
                  <Baby className="w-3.5 h-3.5" /> Destete
                </button>
              </div>
            </div>

            {/* GridView de 3 columnas con bordes redondeados y fondo gris claro (según especificación) */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Tarjeta 1: Engorde */}
              <div
                onClick={() => setShowAnimalListCategory('engorde')}
                className="bg-slate-200/70 hover:bg-slate-200 border border-slate-300/80 rounded-xl p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
              >
                <span className="text-xs font-bold text-slate-800 text-center mb-1">Engorde</span>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-xs p-1 mb-2 flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=200&auto=format&fit=crop&q=80"
                    alt="Cerdos de Engorde"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xl font-black text-slate-900 block leading-tight">
                    {summary.counts.porcino.engorde}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Animales</span>
                </div>
              </div>

              {/* Tarjeta 2: Maternidad */}
              <div
                onClick={() => setShowAnimalListCategory('maternidad')}
                className="bg-slate-200/70 hover:bg-slate-200 border border-slate-300/80 rounded-xl p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
              >
                <span className="text-xs font-bold text-slate-800 text-center mb-1">Maternidad</span>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-xs p-1 mb-2 flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=200&auto=format&fit=crop&q=80"
                    alt="Cerdas en Maternidad"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xl font-black text-slate-900 block leading-tight">
                    {summary.counts.porcino.productoras}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Madres</span>
                </div>
              </div>

              {/* Tarjeta 3: Verracos */}
              <div
                onClick={() => setShowAnimalListCategory('verracos')}
                className="bg-slate-200/70 hover:bg-slate-200 border border-slate-300/80 rounded-xl p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-xs"
              >
                <span className="text-xs font-bold text-slate-800 text-center mb-1">Verracos</span>
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white shadow-xs p-1 mb-2 flex items-center justify-center">
                  <img
                    src="https://images.unsplash.com/photo-1545468800-856f6620f779?w=200&auto=format&fit=crop&q=80"
                    alt="Verracos Reproductores"
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
                <div className="text-center">
                  <span className="text-xl font-black text-slate-900 block leading-tight">
                    {summary.counts.porcino.verracos}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Padrillos</span>
                </div>
              </div>
            </div>

            {/* Sub-tarjeta destacada de Lechones en Lactancia (Requisito 7) */}
            <div
              onClick={() => setShowAnimalListCategory('lechones')}
              className="bg-white hover:bg-amber-50/40 rounded-2xl p-3.5 border border-amber-200/90 shadow-xs flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shadow-xs">
                  🐷
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <span>Lechones en Lactancia</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                      Ver Camadas
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {litters.length} camadas activas por cerda • Sumatoria y control de bajas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-amber-950">
                  {litters.reduce((acc, curr) => acc + curr.currentCount, 0)}
                </span>
                <span className="text-[10px] text-amber-700 font-semibold block">lechones vivos</span>
              </div>
            </div>

            {/* Listado de animales de muestra para trazabilidad (Requisito 2) */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Trazabilidad de Animales Registrados
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Haz clic en un animal para inspeccionar su historial clínico y productivo
                  </span>
                </div>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                  Trazabilidad Activa
                </span>
              </div>

              <div className="space-y-2">
                {animals.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAnimalForTrace(a)}
                    className="p-2.5 bg-slate-50 hover:bg-emerald-50/40 rounded-xl border border-slate-100 hover:border-emerald-300 flex items-center justify-between text-xs cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={a.photoUrl}
                        alt={a.code}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-xs group-hover:border-emerald-400 transition-colors"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-900 font-bold group-hover:text-emerald-700 transition-colors">
                            {a.code}
                          </strong>
                          <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-1.5 py-0.2 rounded">
                            {a.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {a.traceability ? `${a.traceability.length} eventos` : '1 evento'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{a.stage}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-slate-800 group-hover:text-emerald-700 transition-colors">
                        {a.currentWeightKg} kg
                      </span>
                      <p className="text-[10px] text-slate-400">Costo: ${a.accumulatedCostUsd}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 2: ATAJOS (Almacén, Compras, Clientes/Ventas, Reporte, Tareas, Conteo)
        ========================================================================= */}
        {activeTab === 'atajos' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div>
              <h3 className="text-sm font-black text-slate-800">Atajos de Gestión Operativa</h3>
              <p className="text-[11px] text-slate-500">
                Módulos de acceso rápido requeridos en cuadrícula (GridView)
              </p>
            </div>

            {/* GridView con los 6 módulos obligatorios de la especificación */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Almacén */}
              <button
                onClick={() => setShowWarehouseModal(true)}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Almacén</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Alimentos, Medicinas y Alerta 2 meses</p>
              </button>

              {/* 2. Compras (Icono de recibo/dinero) */}
              <button
                onClick={() => setShowWarehouseModal(true)}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Receipt className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Compras</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Facturas de insumos y compra lechones</p>
              </button>

              {/* 3. Clientes / Ventas (Formulario Unificado de Venta y Liquidación) */}
              <button
                onClick={() => {
                  setPreselectedSaleAnimalCode(undefined);
                  setPreselectedSaleCategory(undefined);
                  setShowUnifiedSaleModal(true);
                }}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Clientes / Ventas</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Venta en pie, en canal & liquidación</p>
              </button>

              {/* 4. Reporte General */}
              <button
                onClick={() => setActiveTab('balance')}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileBarChart className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Reporte General</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Métricas de conversión y rentabilidad</p>
              </button>

              {/* 5. Tareas */}
              <button
                onClick={() => setActiveTab('sanitario')}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Tareas</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Asignaciones operativas diarias</p>
              </button>

              {/* 6. Conteo */}
              <button
                onClick={() => setActiveTab('porcinos')}
                className="bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 p-3.5 rounded-2xl flex flex-col items-center text-center shadow-xs transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Binary className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-900 text-xs">Conteo</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Auditoría física vs inventario digital</p>
              </button>
            </div>

            {/* Acceso directo a Prorrateo Destete */}
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  Herramienta Clave de Producción
                </span>
                <h4 className="font-bold text-slate-900 text-xs mt-0.5">
                  Parto & Prorrateo de Costo de Lechones
                </h4>
                <p className="text-[11px] text-slate-600">
                  Divide el costo de la madre entre los lechones destetados
                </p>
              </div>
              <button
                onClick={() => setShowWeaningModal(true)}
                className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Abrir Prorrateo
              </button>
            </div>

            {/* Accesos directos a Configuración de Lotes y Programación Sanitaria */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowBatchConfigModal(true)}
                className="bg-indigo-50/80 hover:bg-indigo-100/70 border border-indigo-200/80 p-3 rounded-2xl text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-indigo-600 text-white text-xs">⚙️</span>
                  <strong className="text-xs font-bold text-indigo-950">Lotes & Protocolos</strong>
                </div>
                <p className="text-[10px] text-indigo-700 leading-tight">
                  Configura tipos de producción y genera tareas automáticas al abrir lote.
                </p>
              </button>

              <button
                onClick={() => setShowAddSanitaryModal(true)}
                className="bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200/80 p-3 rounded-2xl text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-blue-600 text-white text-xs">📅</span>
                  <strong className="text-xs font-bold text-blue-950">+ Nueva Actividad</strong>
                </div>
                <p className="text-[10px] text-blue-700 leading-tight">
                  Programa vacunas o tratamientos indicando lote, animal y fecha.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 3: PLAN SANITARIO (Calendario mensual interactivo con marcas)
        ========================================================================= */}
        {activeTab === 'sanitario' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* Action Bar: Programar Actividad y Configuración por Lotes */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowAddSanitaryModal(true)}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">Programar Actividad</span>
              </button>

              <button
                onClick={() => setShowBatchConfigModal(true)}
                className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Configurar Lotes</span>
              </button>
            </div>

            {/* Header del Calendario */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  Agosto de 2026
                </h3>
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    Mes Actual
                  </span>
                  <button className="p-1 rounded-lg hover:bg-slate-100 text-slate-500">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                <span>lun</span>
                <span>mar</span>
                <span>mié</span>
                <span>jue</span>
                <span>vie</span>
                <span>sáb</span>
                <span>dom</span>
              </div>

              {/* Días del mes (Agosto 2026 inicia en sábado) */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {/* Días vacíos de julio */}
                <span className="text-slate-300 py-1.5">27</span>
                <span className="text-slate-300 py-1.5">28</span>
                <span className="text-slate-300 py-1.5">29</span>
                <span className="text-slate-300 py-1.5">30</span>
                <span className="text-slate-300 py-1.5">31</span>

                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const isSelected = day === selectedDay;
                  const hasTask = daysWithTasks.includes(day);

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={`relative py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 text-white font-black shadow-xs'
                          : hasTask
                          ? 'bg-blue-50 text-blue-900 font-bold hover:bg-blue-100'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{day}</span>
                      {hasTask && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isSelected ? 'bg-white' : 'bg-blue-600'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Día con actividades veterinarias</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Tratamiento completado</span>
                </div>
              </div>
            </div>

            {/* Detalle de actividades para la fecha seleccionada */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  Tareas para el {selectedDay} de Agosto de 2026:
                </h4>
                <span className="text-[10px] text-slate-500 font-medium">
                  {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'actividad' : 'actividades'}
                </span>
              </div>

              {selectedDayTasks.length === 0 ? (
                /* Estado vacío exacto pedido por el documento: "No hay tareas para este día, agrega una" */
                <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-2">
                  <p className="text-xs text-slate-500 font-medium">
                    No hay tareas para este día, agrega una.
                  </p>
                  <button
                    onClick={() => setShowAddSanitaryModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Programar Actividad Aquí
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-white hover:bg-blue-50/30 p-3.5 rounded-2xl border border-slate-200 transition-all shadow-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h5 className="font-bold text-slate-900 text-xs">{task.title}</h5>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                task.status === 'completada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {task.status}
                            </span>
                            {task.batchCode && (
                              <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                                Lote: {task.batchCode}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
                            <span>Lote/Grupo: <strong className="text-slate-800">{task.targetGroup}</strong></span>
                            {task.targetAnimal && (
                              <span>Animal/Arete: <strong className="text-blue-700">{task.targetAnimal}</strong></span>
                            )}
                          </div>

                          {task.dosage && (
                            <p className="text-[10px] text-blue-700 font-semibold">
                              Dosis: {task.dosage} ({task.medicamentUsed})
                            </p>
                          )}
                          {task.responsible && (
                            <p className="text-[10px] text-slate-400">
                              Responsable: {task.responsible}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <button
                            onClick={() => setSelectedTask(task)}
                            className="text-[10px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer"
                          >
                            Ver Leyenda
                          </button>
                          <button
                            onClick={() => {
                              const updated = tasks.map((t) =>
                                t.id === task.id
                                  ? { ...t, status: (t.status === 'completada' ? 'pendiente' : 'completada') as any }
                                  : t
                              );
                              onUpdateTasks(updated);
                            }}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                              task.status === 'completada'
                                ? 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          >
                            {task.status === 'completada' ? 'Desmarcar' : '✓ Completar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 4: BALANCE FINANCIERO (Egresos rojo/naranja, Ingresos verde, Ene-Dic)
        ========================================================================= */}
        {activeTab === 'balance' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Switch / Filtro: Balance Total vs Balance del Mes Actual */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center justify-between text-xs font-bold">
              <button
                onClick={() => setBalanceFilter('mes')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  balanceFilter === 'mes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Balance del Mes Actual (Agosto)
              </button>
              <button
                onClick={() => setBalanceFilter('total')}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                  balanceFilter === 'total'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Balance Total (Histórico Anual)
              </button>
            </div>

            {/* Resumen de Utilidad Porcina */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Resultado Financiero Porcino
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-2xl font-black text-emerald-800">
                  +${balanceFilter === 'mes' ? utilidadPorcina.toLocaleString() : '41,500'}
                </h3>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  Rentabilidad: ~43.7%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-100 text-xs">
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-800">
                    Ingresos (+)
                  </span>
                  <p className="text-base font-black text-emerald-900">
                    +${balanceFilter === 'mes' ? totalIngresos.toLocaleString() : '94,800'}
                  </p>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] font-semibold text-rose-800">
                    Egresos (-)
                  </span>
                  <p className="text-base font-black text-rose-900">
                    -${balanceFilter === 'mes' ? totalEgresos.toLocaleString() : '53,300'}
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfica de Tendencia (Ene a Dic) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-800">
                  Tendencia Ingresos vs Egresos (Ene - Dic)
                </h4>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-700 font-bold">
                    <span className="w-2 h-2 rounded-xs bg-emerald-500" /> Ingresos
                  </span>
                  <span className="flex items-center gap-1 text-rose-700 font-bold">
                    <span className="w-2 h-2 rounded-xs bg-rose-500" /> Egresos
                  </span>
                </div>
              </div>

              {/* Bar visualizer */}
              <div className="h-36 flex items-end justify-between gap-1 pt-4 pb-2 border-b border-slate-100">
                {monthlyFinancialHistory.map((m) => {
                  const maxVal = 12000;
                  const incomeH = Math.round((m.income / maxVal) * 100);
                  const expenseH = Math.round((m.expenses / maxVal) * 100);

                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center gap-0.5 h-28">
                        <div
                          style={{ height: `${incomeH}%` }}
                          title={`Ingresos ${m.month}: $${m.income}`}
                          className="w-1.5 sm:w-2 bg-emerald-500 rounded-t-xs hover:bg-emerald-600 transition-all"
                        />
                        <div
                          style={{ height: `${expenseH}%` }}
                          title={`Egresos ${m.month}: $${m.expenses}`}
                          className="w-1.5 sm:w-2 bg-rose-500 rounded-t-xs hover:bg-rose-600 transition-all"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Desglose de Saldos Detallado (Egresos rojo/naranja, Ingresos verde) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800">Desglose de Movimientos</h4>

              {/* Egresos */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-rose-700 flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Egresos (-) Porcino
                </span>
                <div className="space-y-1.5">
                  {egresos.map((eg) => (
                    <div
                      key={eg.id}
                      className="flex items-center justify-between text-xs p-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{eg.concept}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {eg.category} • {eg.date}
                        </span>
                      </div>
                      <span className="font-bold text-rose-700">-${eg.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ingresos */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
                <span className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Ingresos (+) Porcino
                </span>
                <div className="space-y-1.5">
                  {ingresos.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between text-xs p-1.5 hover:bg-slate-50 rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{ing.concept}</p>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {ing.category} • {ing.date}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700">+${ing.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PESTAÑA 5: CALENDARIO DE ALIMENTACIÓN & PLANES POR PRODUCCIÓN (Requisito 7)
        ========================================================================= */}
        {activeTab === 'alimentacion' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Encabezado y Selector de Producción */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Planes Nutricionales por Tipo de Producción
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Alimentos administrados, rango de peso meta, días del ciclo, consumo diario y total por etapa
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFeedingPlanConfigModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurar Plan de Alimentación</span>
                </button>
              </div>

              {/* Selector de Tipo de Producción */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedFeedingPlanType('engorde')}
                  className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFeedingPlanType === 'engorde'
                      ? 'bg-white text-emerald-800 shadow-xs ring-1 ring-emerald-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Engorde Comercial</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeedingPlanType('maternidad')}
                  className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFeedingPlanType === 'maternidad'
                      ? 'bg-white text-rose-800 shadow-xs ring-1 ring-rose-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  <span>Maternidad & Cerdas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeedingPlanType('verracos')}
                  className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFeedingPlanType === 'verracos'
                      ? 'bg-white text-blue-800 shadow-xs ring-1 ring-blue-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Verracos Sementales</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeedingPlanType('lechones')}
                  className={`flex-1 py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedFeedingPlanType === 'lechones'
                      ? 'bg-white text-amber-800 shadow-xs ring-1 ring-amber-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Baby className="w-3.5 h-3.5" />
                  <span>Lechones Lactantes</span>
                </button>
              </div>
            </div>

            {/* Listado de Etapas del Plan Nutricional Seleccionado */}
            {(() => {
              const activePlan =
                feedingPlans.find((p) => p.productionType === selectedFeedingPlanType) || feedingPlans[0];

              const totalDuration = activePlan.phases.reduce((sum, ph) => sum + ph.durationDays, 0);
              const totalKgAllPhases = activePlan.phases.reduce((sum, ph) => sum + ph.totalFeedKg, 0);

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-700">
                      {activePlan.typeName} ({activePlan.phases.length} etapas activas)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                        Duración: {totalDuration} días
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        Consumo Acum: {totalKgAllPhases.toFixed(1)} kg / animal
                      </span>
                    </div>
                  </div>

                  {activePlan.phases.map((phase) => (
                    <div
                      key={phase.id}
                      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                              {phase.daysRange}
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              Estado: {phase.animalState}
                            </span>
                          </div>
                          <h4 className="font-black text-slate-900 text-sm mt-1.5">
                            {phase.stageName}
                          </h4>
                          <p className="text-xs text-amber-900 font-semibold flex items-center gap-1 mt-0.5">
                            <span className="text-slate-500 font-medium">Alimento:</span>
                            <strong className="text-slate-900">{phase.feedName}</strong>
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-800 block">
                            {phase.dailyConsumptionKg} kg / día
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            Rango de peso: <strong>{phase.weightRangeKg}</strong>
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Total consumido: <strong>{phase.totalFeedKg} kg / etapa</strong>
                          </span>
                        </div>
                      </div>

                      {phase.description && (
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {phase.description}
                        </p>
                      )}

                      {/* Transición alimentaria si está disponible */}
                      {phase.transitionProtocol && (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
                          <span className="text-[11px] font-bold text-amber-900 block">
                            {phase.transitionProtocol.title}
                          </span>

                          <div className="space-y-1.5 text-xs">
                            {phase.transitionProtocol.days.map((d, idx) => (
                              <div
                                key={idx}
                                className="bg-white/80 p-2 rounded-lg border border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px]"
                              >
                                <span className="font-bold text-slate-800">{d.dayLabel}:</span>
                                <span className="text-slate-600">{d.formula}</span>
                                <strong className="text-amber-900 text-right">{d.totalPerDay}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Calculadora Interactiva de Bultos Requeridos por Lote (Gestación, Lactancia y Lechones de Engorde) */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 shadow-md space-y-3.5 border border-slate-700/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-xs text-white">
                    Calculadora de Bultos Requeridos por Lote
                  </h4>
                </div>
                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                  Base Bulto 40 kg
                </span>
              </div>

              {/* Inputs de grupos: Gestación, Lactancia y Lechones de Engorde */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-slate-300 font-medium">
                        Cerdas Gestación:
                      </label>
                      <span className="text-[9px] text-slate-400">2.8 kg/d</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={calcSowsInGestation}
                      onChange={(e) => setCalcSowsInGestation(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                    />
                  </div>

                  <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] text-slate-300 font-medium">
                        Cerdas Lactancia:
                      </label>
                      <span className="text-[9px] text-slate-400">6.5 kg/d</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={calcSowsInLactation}
                      onChange={(e) => setCalcSowsInLactation(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                    />
                  </div>
                </div>

                {/* Sección Lechones de Engorde (Requisito 1) */}
                <div className="bg-slate-800/90 p-3 rounded-xl border border-emerald-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <label className="text-xs font-bold text-emerald-300">
                        Lechones de Engorde / Cebo
                      </label>
                    </div>
                    <span className="text-[10px] text-slate-300">
                      Consumo: <strong>{calcEngordeKgPerDay} kg/día/animal</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">N° de Lechones:</span>
                      <input
                        type="number"
                        min="0"
                        value={calcPigsEngorde}
                        onChange={(e) => setCalcPigsEngorde(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-0.5">Kg/día por animal:</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="4.0"
                        value={calcEngordeKgPerDay}
                        onChange={(e) => setCalcEngordeKgPerDay(parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-slate-900/90 border border-slate-600 rounded-lg font-bold text-white text-sm"
                      />
                    </div>
                  </div>

                  {/* Presets de etapa de engorde */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[9px] text-slate-400">Etapa:</span>
                    <button
                      type="button"
                      onClick={() => setCalcEngordeKgPerDay(1.2)}
                      className={`text-[9px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        calcEngordeKgPerDay === 1.2 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Pre-cebo (1.2k)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcEngordeKgPerDay(2.0)}
                      className={`text-[9px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        calcEngordeKgPerDay === 2.0 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Crecimiento (2.0k)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcEngordeKgPerDay(2.6)}
                      className={`text-[9px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        calcEngordeKgPerDay === 2.6 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      Engorde Final (2.6k)
                    </button>
                  </div>
                </div>
              </div>

              {/* Resultado del cálculo de bultos consolidado con desglose */}
              {(() => {
                const kgGestation = Math.round(calcSowsInGestation * 2.8 * 30);
                const kgLactation = Math.round(calcSowsInLactation * 6.5 * 30);
                const kgEngorde = Math.round(calcPigsEngorde * calcEngordeKgPerDay * 30);

                const bagsGestation = Math.ceil(kgGestation / 40);
                const bagsLactation = Math.ceil(kgLactation / 40);
                const bagsEngorde = Math.ceil(kgEngorde / 40);

                const totalKgMonthly = kgGestation + kgLactation + kgEngorde;
                const bagsMonthly = Math.ceil(totalKgMonthly / 40); // Bultos de 40kg
                const estimatedCost = Math.round(totalKgMonthly * 0.44); // Promedio ponderado $/kg

                const pctEngorde = totalKgMonthly > 0 ? Math.round((kgEngorde / totalKgMonthly) * 100) : 0;
                const pctGestation = totalKgMonthly > 0 ? Math.round((kgGestation / totalKgMonthly) * 100) : 0;
                const pctLactation = totalKgMonthly > 0 ? Math.round((kgLactation / totalKgMonthly) * 100) : 0;

                return (
                  <div className="space-y-2.5">
                    {/* Tarjetas de desglose por lote */}
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                      <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block truncate">Gestación</span>
                        <strong className="text-white text-xs block">{bagsGestation} bultos</strong>
                        <span className="text-[9px] text-slate-400">({kgGestation.toLocaleString()} kg)</span>
                      </div>
                      <div className="bg-slate-800/70 p-2 rounded-xl border border-slate-700">
                        <span className="text-slate-400 block truncate">Lactancia</span>
                        <strong className="text-white text-xs block">{bagsLactation} bultos</strong>
                        <span className="text-[9px] text-slate-400">({kgLactation.toLocaleString()} kg)</span>
                      </div>
                      <div className="bg-emerald-950/50 p-2 rounded-xl border border-emerald-800/60">
                        <span className="text-emerald-300 font-bold block truncate">Engorde</span>
                        <strong className="text-emerald-400 text-xs block">{bagsEngorde} bultos</strong>
                        <span className="text-[9px] text-emerald-200/80">({kgEngorde.toLocaleString()} kg)</span>
                      </div>
                    </div>

                    {/* Barra de distribución porcentual */}
                    {totalKgMonthly > 0 && (
                      <div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-slate-700">
                          <div style={{ width: `${pctGestation}%` }} className="bg-blue-500" title={`Gestación ${pctGestation}%`} />
                          <div style={{ width: `${pctLactation}%` }} className="bg-purple-500" title={`Lactancia ${pctLactation}%`} />
                          <div style={{ width: `${pctEngorde}%` }} className="bg-emerald-500" title={`Engorde ${pctEngorde}%`} />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                          <span>Gestación: {pctGestation}%</span>
                          <span>Lactancia: {pctLactation}%</span>
                          <span className="text-emerald-400 font-bold">Engorde: {pctEngorde}%</span>
                        </div>
                      </div>
                    )}

                    {/* Total Consolidado */}
                    <div className="bg-black/40 rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">
                          Consumo Mensual Hato Total
                        </span>
                        <strong className="text-base text-emerald-400">
                          {totalKgMonthly.toLocaleString()} kg
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">
                          Bultos (40kg) Requeridos
                        </span>
                        <strong className="text-base text-white">
                          {bagsMonthly} sacos (~${estimatedCost.toLocaleString()})
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Modals & Subviews */}
      {showAddSanitaryModal && (
        <AddSanitaryActivityModal
          animals={animals}
          warehouseItems={warehouseItems}
          onClose={() => setShowAddSanitaryModal(false)}
          onAddTask={handleAddNewSanitaryTask}
          defaultDate={`2026-08-${selectedDay < 10 ? '0' + selectedDay : selectedDay}`}
          initialDate={`2026-08-${selectedDay < 10 ? '0' + selectedDay : selectedDay}`}
        />
      )}

      {showBatchConfigModal && (
        <BatchProductionConfigModal
          onClose={() => setShowBatchConfigModal(false)}
          configs={batchConfigs}
          existingBatches={productionBatches}
          onUpdateConfigs={setBatchConfigs}
        />
      )}

      {selectedTask && (
        <SanitaryProcedureModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
        />
      )}

      {showWarehouseModal && (
        <WarehouseModal
          items={warehouseItems}
          onClose={() => setShowWarehouseModal(false)}
          onConsumeItem={handleConsumeItem}
          onAddItem={handleAddWarehouseItem}
        />
      )}

      {showWeaningModal && (
        <WeaningProratingModal
          onClose={() => setShowWeaningModal(false)}
          onConfirmWeaning={handleConfirmWeaning}
        />
      )}

      {/* Modal listado por categoría del rebaño (Requisito 2, 4, 5, 6, 7) */}
      {showAnimalListCategory && (
        <HerdCategoryViewModal
          category={showAnimalListCategory as PorcinoCategory | 'lechones'}
          animals={animals}
          litters={litters}
          onSelectAnimal={(animal) => setSelectedAnimalForTrace(animal)}
          onOpenFarrowingModal={(sowCode) => {
            setPreselectedSowForFarrowing(sowCode);
            setShowFarrowingModal(true);
          }}
          onOpenSlaughterModal={(code) => {
            setPreselectedSaleAnimalCode(code);
            setPreselectedSaleCategory('engorde');
            setShowUnifiedSaleModal(true);
          }}
          onOpenBoarSlaughterModal={(code) => {
            setPreselectedSaleAnimalCode(code);
            setPreselectedSaleCategory('verracos');
            setShowUnifiedSaleModal(true);
          }}
          onOpenMatingModal={(initialTab) => {
            setBoarMatingInitialTab(initialTab);
            setShowBoarMatingModal(true);
          }}
          onOpenMortalityModal={(litterId) => {
            setPreselectedLitterForMortality(litterId);
            setShowPigletMortalityModal(true);
          }}
          onRegisterNewPigs={handleRegisterNewPigs}
          onRegisterNewMother={handleRegisterNewMother}
          onClose={() => setShowAnimalListCategory(null)}
        />
      )}

      {/* Modal de Trazabilidad e Historial del Animal Seleccionado (Requisito 2 & 8) */}
      {selectedAnimalForTrace && (
        <AnimalTraceabilityModal
          animal={selectedAnimalForTrace}
          feedingPlans={feedingPlans}
          onClose={() => setSelectedAnimalForTrace(null)}
          onAddEvent={(event) => handleAddTraceEvent(selectedAnimalForTrace.id, event)}
          onUpdateWeight={(newWeight) => handleUpdateAnimalWeight(selectedAnimalForTrace.id, newWeight)}
          onRecordSlaughter={() => {
            setPreselectedSaleAnimalCode(selectedAnimalForTrace.code);
            setPreselectedSaleCategory(selectedAnimalForTrace.category);
            setShowUnifiedSaleModal(true);
          }}
          onRecordFarrowing={() => {
            setPreselectedSowForFarrowing(selectedAnimalForTrace.code);
            setShowFarrowingModal(true);
          }}
        />
      )}

      {/* Modal de Configuración del Plan de Alimentación por Producción (Requisito 7) */}
      {showFeedingPlanConfigModal && (
        <FeedingPlanConfigModal
          plans={feedingPlans}
          initialType={selectedFeedingPlanType}
          onClose={() => setShowFeedingPlanConfigModal(false)}
          onUpdatePlans={(updated) => setFeedingPlans(updated)}
        />
      )}

      {/* Modal de Registro de Parto en Maternidad (Requisito 4) */}
      {showFarrowingModal && (
        <FarrowingModal
          animals={animals}
          preselectedSowCode={preselectedSowForFarrowing}
          onClose={() => {
            setShowFarrowingModal(false);
            setPreselectedSowForFarrowing(undefined);
          }}
          onRegisterFarrowing={(record, newLitter) => {
            handleRegisterFarrowing(record, newLitter);
            setShowFarrowingModal(false);
            setPreselectedSowForFarrowing(undefined);
          }}
        />
      )}

      {/* Modal de Gestión de Verracos: Montas & Compra Nuevo (Requisito 6) */}
      {showBoarMatingModal && (
        <BoarMatingAndNewModal
          initialTab={boarMatingInitialTab}
          animals={animals}
          onClose={() => setShowBoarMatingModal(false)}
          onRegisterMating={(boarCode, sowCode, date, isExternal, extCost, notes, movement) => {
            handleRegisterMating(boarCode, sowCode, date, isExternal, extCost, notes, movement);
            setShowBoarMatingModal(false);
          }}
          onAddNewBoar={(newBoar, movement) => {
            handleAddNewBoar(newBoar, movement);
            setShowBoarMatingModal(false);
          }}
        />
      )}

      {/* Modal de Registro de Mortalidad y Bajas de Lechones (Requisito 7) */}
      {showPigletMortalityModal && (
        <PigletMortalityModal
          litters={litters}
          preselectedLitterId={preselectedLitterForMortality}
          onClose={() => {
            setShowPigletMortalityModal(false);
            setPreselectedLitterForMortality(undefined);
          }}
          onRegisterMortality={(litterId, count, cause, date, notes) => {
            handleRegisterMortality(litterId, count, cause, date, notes);
            setShowPigletMortalityModal(false);
            setPreselectedLitterForMortality(undefined);
          }}
        />
      )}

      {/* Modal Unificado de Venta y Liquidación / Matadero (Requisito 4) */}
      {showUnifiedSaleModal && (
        <UnifiedSaleSlaughterModal
          animals={animals}
          preselectedAnimalCode={preselectedSaleAnimalCode}
          initialCategory={preselectedSaleCategory}
          onClose={() => {
            setShowUnifiedSaleModal(false);
            setPreselectedSaleAnimalCode(undefined);
            setPreselectedSaleCategory(undefined);
          }}
          onConfirmSaleSlaughter={(result) => {
            handleConfirmUnifiedSale(result);
            setShowUnifiedSaleModal(false);
            setPreselectedSaleAnimalCode(undefined);
            setPreselectedSaleCategory(undefined);
          }}
        />
      )}
    </div>
  );
};
