import React, { useMemo, useState } from 'react';
import {
  X,
  Plus,
  Package,
  Pill,
  Wrench,
  AlertTriangle,
  MinusCircle,
  Search,
  Trash2,
  Check,
  ShoppingCart,
  Receipt,
  MapPin,
} from 'lucide-react';
import { FinancialMovement, PorcinoAnimal, WarehouseItem } from '../../types';
import { evaluateWarehouseReplenishment } from '../../models/PorcinoCalculations';
import { isActiveAnimal, headCount, round2 } from '../../models/porcinoRules';
import { newId } from '../../utils/ids';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';
import { itemMatchesRubro, WAREHOUSE_RUBRO_LABEL, type WarehouseRubro } from '../../models/warehouseRubro';

export interface AddWarehouseItemOptions {
  /** true = registrar la compra como egreso (el dominio marca el insumo con expensedOnPurchase). */
  registerPurchase?: boolean;
}

interface WarehouseModalProps {
  items: WarehouseItem[];
  /** Animales/lotes porcinos para elegir el destino del consumo (opcional). */
  animals?: PorcinoAnimal[];
  onClose: () => void;
  /**
   * target = código del animal/lote o texto libre; targetAnimalId = id del animal elegido.
   * Conectar a porcinoActions.consumeWarehouseItem({itemId, amount, targetAnimalId, targetAnimalCode/targetLabel}).
   */
  onConsumeItem: (itemId: string, amount: number, target: string, targetAnimalId?: string) => ModalActionReturn;
  /** options.registerPurchase -> porcinoActions.addWarehouseItem({item, registerPurchase}). */
  onAddItem: (newItem: WarehouseItem, options?: AddWarehouseItemOptions) => ModalActionReturn;
  /** Si no se provee, el botón de eliminar no se muestra. */
  onDeleteItem?: (itemId: string) => ModalActionReturn;
  /** Compra/reposición de un insumo existente -> porcinoActions.purchaseWarehouseItem. Sin él no se muestra "Registrar compra". */
  onPurchaseItem?: (input: PurchaseItemPayload) => ModalActionReturn;
  /** Egresos de compras de insumos (para el historial de compras). */
  purchases?: FinancialMovement[];
  /** Asignar/mover stock a una ubicación (lote/cerdo o almacén general) -> porcinoActions.assignWarehouseItemLocation. */
  onAssignLocation?: (input: AssignLocationPayload) => ModalActionReturn;
  /** Rubro del almacén: solo se muestran y crean insumos de ese rubro (por defecto porcino). */
  rubro?: WarehouseRubro;
  /**
   * Lotes avícolas (modo avícola): ubicación opcional al dar de alta y destino OBLIGATORIO del consumo
   * (onConsumeItem recibe el id del lote como targetAnimalId).
   */
  lotLocations?: { id: string; label: string }[];
  /** Contenido extra bajo la cabecera (p. ej. selector de rubro desde el Home de la granja). */
  headerExtra?: React.ReactNode;
}

export type { WarehouseRubro };

export interface PurchaseItemPayload {
  itemId: string;
  quantity: number;
  unitCostUsd: number;
  date: string;
  supplier?: string;
  invoice?: string;
  notes?: string;
  /** Ubicación donde entra la compra: id de lote/cerdo o null = almacén general. */
  animalId?: string | null;
}

export interface AssignLocationPayload {
  itemId: string;
  animalId: string | null;
  quantity?: number;
}

const NO_TARGET = '__general__';
const FREE_TARGET = '__libre__';
/** Valor del selector de ubicación para el almacén general. */
export const GENERAL_LOCATION = '';
const ALL_LOCATIONS = '__todas__';

/** Opciones de ubicación (almacén general + lotes y cerdos activos), reutilizable desde otros formularios. */
export const LocationOptions: React.FC<{ animals: PorcinoAnimal[]; generalLabel?: string }> = ({
  animals,
  generalLabel = 'Almacén general (sin asignar)',
}) => {
  const lots = animals.filter((a) => headCount(a) > 1);
  const pigs = animals.filter((a) => headCount(a) <= 1);
  return (
    <>
      <option value={GENERAL_LOCATION}>{generalLabel}</option>
      {lots.length > 0 && (
        <optgroup label="Lotes">
          {lots.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} · {a.category} · {headCount(a)} cab.
            </option>
          ))}
        </optgroup>
      )}
      {pigs.length > 0 && (
        <optgroup label="Cerdos">
          {pigs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code}
              {a.name ? ` (${a.name})` : ''} · {a.category}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
};

export const WarehouseModal: React.FC<WarehouseModalProps> = ({
  items,
  animals = [],
  onClose,
  onConsumeItem,
  onAddItem,
  onDeleteItem,
  onPurchaseItem,
  purchases = [],
  onAssignLocation,
  rubro: rubroProp,
  lotLocations,
  headerExtra,
}) => {
  const rubro: WarehouseRubro = rubroProp || 'porcino';
  const safeItems = useMemo(() => (items || []).filter((i) => itemMatchesRubro(i, rubro)), [items, rubro]);
  const isAvicola = rubro === 'avicola';
  const lotMode = isAvicola && !!lotLocations;
  const lotLabel = (loteId?: string) =>
    !loteId ? 'Bodega general' : lotLocations?.find((l) => l.id === loteId)?.label || 'Lote finalizado';
  const [locationFilter, setLocationFilter] = useState<string>(ALL_LOCATIONS);
  const [activeTab, setActiveTab] = useState<'alimentos' | 'medicinas' | 'otros'>('alimentos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConsumeDialog, setShowConsumeDialog] = useState<WarehouseItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WarehouseItem | null>(null);
  const [consumeAmount, setConsumeAmount] = useState('');
  const [consumeTargetId, setConsumeTargetId] = useState<string>(NO_TARGET);
  const [consumeTargetText, setConsumeTargetText] = useState('');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const flash = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Cobertura y criticidad con la regla única del modelo (stock < 2 meses)
  const evaluated = useMemo(() => evaluateWarehouseReplenishment(safeItems), [safeItems]);
  const countByCategory = useMemo(() => {
    const acc = { alimentos: 0, medicinas: 0, otros: 0 } as Record<WarehouseItem['category'], number>;
    safeItems.forEach((i) => {
      if (acc[i.category] !== undefined) acc[i.category] += 1;
    });
    return acc;
  }, [safeItems]);

  const activeAnimals = useMemo(() => (animals || []).filter(isActiveAnimal), [animals]);
  const animalById = useMemo(() => new Map((animals || []).map((a) => [a.id, a])), [animals]);
  // Las ubicaciones solo aplican a insumos porcinos y cuando se reciben los animales/lotes para elegir
  // (desde el módulo avícola no se pasan: así una compra nunca mueve un insumo porcino por accidente)
  const locationsEnabled = activeAnimals.length > 0;
  /** Texto de la ubicación de un insumo. */
  const locLabel = (animalId?: string) => {
    if (!animalId) return 'Almacén general';
    const a = animalById.get(animalId);
    if (!a) return 'Ubicación eliminada';
    const kind = headCount(a) > 1 ? 'Lote' : 'Cerdo';
    return `${kind} ${a.code}${isActiveAnimal(a) ? '' : ' (inactivo)'}`;
  };
  // Ubicaciones con stock (para el filtro): general + las que tienen algún insumo
  const usedLocations = useMemo(() => {
    const ids = new Set<string>();
    safeItems.forEach((i) => i.animalId && ids.add(i.animalId));
    return [...ids];
  }, [safeItems]);

  // Totales de Alimentos (Requisito 3)
  const { totalKgFoods, totalValueFoods } = useMemo(() => {
    const foodItems = safeItems.filter((i) => i.category === 'alimentos');
    const kg = foodItems.reduce((acc, curr) => {
      const q = toNumber(curr.quantity);
      if (curr.unit === 'kg') return acc + q;
      if (curr.unit === 'bultos (40kg)') return acc + q * 40;
      if (curr.unit === 'g') return acc + q / 1000;
      return acc;
    }, 0);
    const value = foodItems.reduce((acc, curr) => acc + toNumber(curr.quantity) * toNumber(curr.unitCostUsd), 0);
    return { totalKgFoods: round2(kg), totalValueFoods: value };
  }, [safeItems]);
  const totalSacks40kg = Math.round(totalKgFoods / 40);

  // Form states for new item
  const [newItemName, setNewItemName] = useState('');
  const [newItemSubCategory, setNewItemSubCategory] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemUnit, setNewItemUnit] = useState<WarehouseItem['unit']>('kg');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemMonthly, setNewItemMonthly] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemExpiration, setNewItemExpiration] = useState('');
  const [registerPurchase, setRegisterPurchase] = useState(true);
  const [newItemLocation, setNewItemLocation] = useState<string>(GENERAL_LOCATION);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evaluated.filter(
      (item) =>
        item.category === activeTab &&
        (locationFilter === ALL_LOCATIONS || (item.animalId || GENERAL_LOCATION) === locationFilter) &&
        (!q || (item.name || '').toLowerCase().includes(q) || (item.subCategory || '').toLowerCase().includes(q))
    );
  }, [evaluated, activeTab, searchQuery, locationFilter]);

  // ---- Ubicar / mover stock entre almacén general y lotes/cerdos ----
  const [assignItem, setAssignItem] = useState<WarehouseItem | null>(null);
  const [assignTo, setAssignTo] = useState<string>(GENERAL_LOCATION);
  const [assignQty, setAssignQty] = useState('');
  const openAssign = (item: WarehouseItem) => {
    setDialogError(null);
    setAssignItem(item);
    // Por defecto: si está en el general, el primer lote; si está en un lote, volver al general
    setAssignTo(item.animalId ? GENERAL_LOCATION : activeAnimals[0]?.id || GENERAL_LOCATION);
    setAssignQty(String(item.quantity));
  };
  const handleAssign = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!assignItem || !onAssignLocation) return;
    setDialogError(null);
    const qty = toNumber(assignQty, NaN);
    if (!Number.isFinite(qty) || qty <= 0) return setDialogError('La cantidad debe ser mayor a 0.');
    if (qty > toNumber(assignItem.quantity)) return setDialogError(`Solo hay ${assignItem.quantity} ${assignItem.unit}.`);
    if ((assignItem.animalId || GENERAL_LOCATION) === assignTo) return setDialogError('Elige una ubicación distinta a la actual.');
    setIsSaving(true);
    const res = await runModalAction(() =>
      onAssignLocation({ itemId: assignItem.id, animalId: assignTo || null, quantity: qty })
    );
    setIsSaving(false);
    if (!res.ok) return setDialogError(res.error || 'No se pudo asignar la ubicación.');
    flash(`${qty} ${assignItem.unit} de ${assignItem.name} → ${locLabel(assignTo || undefined)}.`);
    setAssignItem(null);
  };

  // ---- Compras (reposición de insumos existentes) ----
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [purchaseItemId, setPurchaseItemId] = useState('');
  const [purchaseQty, setPurchaseQty] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseInvoice, setPurchaseInvoice] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseLocation, setPurchaseLocation] = useState<string>(GENERAL_LOCATION);
  const purchaseItem = safeItems.find((i) => i.id === purchaseItemId);
  const purchaseTotal = round2(toNumber(purchaseQty) * toNumber(purchasePrice));
  const sortedPurchases = useMemo(
    () => [...(purchases || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [purchases]
  );
  const purchasesTotal = useMemo(() => round2(sortedPurchases.reduce((s, m) => s + toNumber(m.amount), 0)), [sortedPurchases]);

  const openPurchase = (item?: WarehouseItem) => {
    setDialogError(null);
    setPurchaseItemId(item?.id || '');
    setPurchaseQty('');
    setPurchasePrice(item && toNumber(item.unitCostUsd) > 0 ? String(item.unitCostUsd) : '');
    setPurchaseDate(todayISO());
    setPurchaseSupplier(item?.supplier || '');
    setPurchaseInvoice('');
    setPurchaseNotes('');
    setPurchaseLocation(item?.animalId || (locationFilter !== ALL_LOCATIONS ? locationFilter : GENERAL_LOCATION));
    setShowPurchaseDialog(true);
  };

  const handleRegisterPurchase = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!onPurchaseItem) return;
    setDialogError(null);
    if (!purchaseItem) {
      setDialogError('Elige el insumo que compraste (o créalo con "Nuevo ítem").');
      return;
    }
    const qty = toNumber(purchaseQty, NaN);
    const price = toNumber(purchasePrice, NaN);
    if (!Number.isFinite(qty) || qty <= 0) {
      setDialogError('La cantidad comprada debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setDialogError('El precio por unidad debe ser mayor a 0.');
      return;
    }
    if (!purchaseDate || purchaseDate > todayISO()) {
      setDialogError('La fecha de compra no puede ser futura.');
      return;
    }
    setIsSaving(true);
    const res = await runModalAction(() =>
      onPurchaseItem({
        itemId: purchaseItem.id,
        quantity: qty,
        unitCostUsd: price,
        date: purchaseDate,
        supplier: purchaseSupplier.trim() || undefined,
        invoice: purchaseInvoice.trim() || undefined,
        notes: purchaseNotes.trim() || undefined,
        animalId: locationsEnabled && purchaseItem.rubro !== 'avicola' ? purchaseLocation || null : undefined,
      })
    );
    setIsSaving(false);
    if (!res.ok) {
      setDialogError(res.error || 'No se pudo registrar la compra.');
      return;
    }
    setShowPurchaseDialog(false);
    flash(
      `Compra registrada: +${qty} ${purchaseItem.unit} de ${purchaseItem.name}` +
        (locationsEnabled ? ` en ${locLabel(purchaseLocation || undefined)}` : '') +
        ` ($${round2(qty * price).toFixed(2)} al balance).`
    );
  };

  const openConsume = (item: WarehouseItem) => {
    setShowConsumeDialog(item);
    setConsumeAmount('');
    // Insumo ubicado en un lote/cerdo activo: el destino sugerido es esa ubicación
    if (lotMode) {
      // Avícola: el consumo siempre se carga a un lote (su bodega o el primero activo)
      setConsumeTargetId(item.loteId && lotLocations!.some((l) => l.id === item.loteId) ? item.loteId : lotLocations![0]?.id || NO_TARGET);
    } else {
      setConsumeTargetId(item.animalId && activeAnimals.some((a) => a.id === item.animalId) ? item.animalId : NO_TARGET);
    }
    setConsumeTargetText('');
    setDialogError(null);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !onDeleteItem) return;
    setIsSaving(true);
    const res = await runModalAction(() => onDeleteItem(itemToDelete.id));
    setIsSaving(false);
    if (!res.ok) {
      setDialogError(res.error || 'No se pudo eliminar el insumo.');
      return;
    }
    flash(`Ítem "${itemToDelete.name}" eliminado del inventario.`);
    setItemToDelete(null);
  };

  const handleApplyConsumption = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!showConsumeDialog) return;
    setDialogError(null);
    const amountNum = toNumber(consumeAmount, NaN);
    const stock = toNumber(showConsumeDialog.quantity);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setDialogError('La cantidad debe ser mayor a 0.');
      return;
    }
    if (amountNum > stock) {
      setDialogError(`Stock insuficiente: solo hay ${stock} ${showConsumeDialog.unit}.`);
      return;
    }
    const targetLot = lotMode ? lotLocations!.find((l) => l.id === consumeTargetId) : undefined;
    if (lotMode && !targetLot) {
      setDialogError('Elige el lote al que se carga el consumo.');
      return;
    }
    const targetAnimal = lotMode ? undefined : activeAnimals.find((a) => a.id === consumeTargetId);
    const targetLabel = targetLot
      ? targetLot.label
      : targetAnimal
      ? targetAnimal.code
      : consumeTargetId === FREE_TARGET
      ? consumeTargetText.trim()
      : '';
    if (consumeTargetId === FREE_TARGET && !targetLabel) {
      setDialogError('Indica el destino del consumo.');
      return;
    }

    setIsSaving(true);
    const res = await runModalAction(() =>
      onConsumeItem(showConsumeDialog.id, amountNum, targetLabel, targetLot?.id || targetAnimal?.id)
    );
    setIsSaving(false);
    if (!res.ok) {
      setDialogError(res.error || 'No se pudo registrar el consumo.');
      return;
    }
    flash(
      `Se descontaron ${amountNum} ${showConsumeDialog.unit} de ${showConsumeDialog.name}${
        targetLabel ? ` e imputaron a ${targetLabel}` : ' (consumo general)'
      }.`
    );
    setShowConsumeDialog(null);
  };

  const handleCreateNewItem = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setDialogError(null);
    const name = newItemName.trim();
    if (!name) {
      setDialogError('Indica el nombre del ítem.');
      return;
    }
    const qty = toNumber(newItemQty, NaN);
    const cost = toNumber(newItemCost);
    const monthly = toNumber(newItemMonthly);
    if (!Number.isFinite(qty) || qty < 0) {
      setDialogError('La cantidad inicial debe ser 0 o mayor.');
      return;
    }
    if (cost < 0 || monthly < 0) {
      setDialogError('El costo y el consumo mensual no pueden ser negativos.');
      return;
    }
    const location = locationsEnabled || lotMode ? newItemLocation : GENERAL_LOCATION;
    const where = (i: WarehouseItem) => (lotMode ? i.loteId : i.animalId) || GENERAL_LOCATION;
    if (
      safeItems.some(
        (i) =>
          i.name.trim().toLowerCase() === name.toLowerCase() &&
          i.category === activeTab &&
          i.unit === newItemUnit &&
          where(i) === location
      )
    ) {
      setDialogError(
        `Ya existe "${name}" en ${lotMode ? lotLabel(location || undefined) : locLabel(location || undefined)}: usa "Comprar" para sumarle stock.`
      );
      return;
    }

    const created: WarehouseItem = {
      id: newId('wh'),
      name,
      category: activeTab,
      subCategory: newItemSubCategory.trim() || 'Insumo Pecuario',
      quantity: qty,
      unit: newItemUnit,
      unitCostUsd: cost,
      // Umbral = 2 meses de consumo (misma regla que la alerta de cobertura)
      minAlertThreshold: round2(monthly * 2),
      monthlyConsumptionRate: monthly,
      supplier: newItemSupplier.trim() || undefined,
      expirationDate: newItemExpiration || undefined,
      rubro,
      ...(lotMode ? { loteId: location || undefined } : { animalId: location || undefined }),
    };
    const purchase = registerPurchase && qty > 0 && cost > 0;

    setIsSaving(true);
    const res = await runModalAction(() => onAddItem(created, { registerPurchase: purchase }));
    setIsSaving(false);
    if (!res.ok) {
      setDialogError(res.error || 'No se pudo registrar el ítem.');
      return;
    }
    setShowNewItemModal(false);
    setNewItemName('');
    setNewItemSubCategory('');
    setNewItemQty('');
    setNewItemCost('');
    setNewItemMonthly('');
    setNewItemSupplier('');
    setNewItemExpiration('');
    const whereTxt = location ? ` en ${lotMode ? lotLabel(location) : locLabel(location)}` : '';
    flash(
      purchase
        ? `Nuevo ítem "${created.name}" registrado${whereTxt} y compra de $${round2(qty * cost).toFixed(2)} asentada como egreso.`
        : `Nuevo ítem "${created.name}" registrado${whereTxt || ' en Almacén'}.`
    );
  };

  const errorBox = dialogError && (
    <div className="p-2 bg-rose-100 border border-rose-300 rounded-lg text-[11px] font-bold text-rose-800">{dialogError}</div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div
        id="warehouse-modal-container"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[750px]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white leading-tight">
                Almacén {WAREHOUSE_RUBRO_LABEL[rubro]}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAvicola ? 'Alimento e insumos de los pollos · consumo cargado al lote' : rubro === 'bovino' ? 'Alimento e insumos del ganado bovino' : 'Alimentos, medicinas y proyección de stock a 2 meses'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {headerExtra}

        {/* Feedback alert */}
        {successMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        {/* Category Tabs: Alimentos, Medicinas, Otros */}
        <div className="border-b border-slate-200 bg-slate-50 px-2 sm:px-4 pt-2 shrink-0">
          {/* Pestañas desplazables: nunca empujan los botones de acción fuera de la pantalla */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('alimentos')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'alimentos'
                  ? 'border-emerald-600 text-emerald-800 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Alimentos
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {countByCategory.alimentos}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('medicinas')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'medicinas'
                  ? 'border-blue-600 text-blue-800 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              Medicinas
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {countByCategory.medicinas}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('otros')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'otros'
                  ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Otros / Insumos
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                {countByCategory.otros}
              </span>
            </button>
          </div>
        </div>

        {/* Acciones principales: fila propia y a todo el ancho (táctil en móvil) */}
        <div className="grid grid-cols-2 gap-2 px-3 pt-3 bg-white shrink-0">
          <button
            onClick={() => {
              setDialogError(null);
              setNewItemLocation(locationFilter !== ALL_LOCATIONS ? locationFilter : GENERAL_LOCATION);
              setShowNewItemModal(true);
            }}
            className="flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nuevo ítem
          </button>
          {onPurchaseItem ? (
            <button
              onClick={() => openPurchase()}
              disabled={safeItems.length === 0}
              title={safeItems.length === 0 ? 'Primero crea el insumo con "Nuevo ítem"' : 'Registrar compra de un insumo existente'}
              className="flex items-center justify-center gap-1.5 min-h-10 px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <ShoppingCart className="w-4 h-4" /> Registrar compra
            </button>
          ) : (
            <span />
          )}
          {onPurchaseItem && (
            <button
              onClick={() => setShowPurchaseHistory((v) => !v)}
              className="col-span-2 flex items-center justify-between gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-rose-600" /> Historial de compras ({sortedPurchases.length})
              </span>
              <span className="font-bold text-rose-700">
                ${purchasesTotal.toLocaleString()} {showPurchaseHistory ? '▲' : '▼'}
              </span>
            </button>
          )}
        </div>

        {showPurchaseHistory && (
          <div className="mx-3 mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shrink-0">
            {sortedPurchases.length === 0 ? (
              <p className="p-3 text-center text-[11px] text-slate-400">Aún no hay compras registradas.</p>
            ) : (
              sortedPurchases.map((m) => (
                <div key={m.id} className="p-2.5 flex items-start justify-between gap-2 text-[11px]">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{m.concept}</p>
                    <p className="text-slate-500 truncate">
                      {m.date}
                      {m.details ? ` · ${m.details}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-rose-700 shrink-0">-${toNumber(m.amount).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={`Buscar en ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
          </div>
          {locationsEnabled && (
            <div className="relative shrink-0 max-w-[45%]">
              <MapPin className="w-3.5 h-3.5 text-indigo-500 absolute left-2.5 top-2.5 pointer-events-none" />
              <select
                aria-label="Filtrar por ubicación"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-semibold"
              >
                <option value={ALL_LOCATIONS}>Todas las ubicaciones</option>
                <option value={GENERAL_LOCATION}>Almacén general</option>
                {usedLocations.map((id) => (
                  <option key={id} value={id}>
                    {locLabel(id)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Alimentos Summary Banner (Requisito 3: Total Kilos y Total Sacos de 40kg) */}
        {activeTab === 'alimentos' && (
          <div className="mx-4 mt-3 p-3 bg-emerald-900 text-white rounded-2xl shadow-sm flex items-center justify-between border border-emerald-800">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-800/80 flex items-center justify-center font-black text-emerald-300 text-sm">
                🌽
              </div>
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                  Inventario Total de Alimentos
                </span>
                <div className="flex items-baseline gap-2">
                  <strong className="text-base text-white font-black">
                    {totalKgFoods.toLocaleString()} kg
                  </strong>
                  <span className="text-xs text-emerald-200 font-semibold">
                    (~{totalSacks40kg.toLocaleString()} bultos / sacos de 40kg)
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-emerald-300 block">Valorización Stock</span>
              <strong className="text-xs font-bold text-emerald-100">
                ${Math.round(totalValueFoods).toLocaleString()} USD
              </strong>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No se encontraron insumos en esta categoría.
            </div>
          ) : (
            filteredItems.map((item) => {
              // Cobertura y alerta calculadas por evaluateWarehouseReplenishment
              const monthsOfStock = item.monthsOfSupply;
              const isUnderTwoMonths = item.isCritical;

              // Cálculo de sacos de 40kg (Requisito 3)
              const kgEquivalent =
                item.unit === 'bultos (40kg)'
                  ? item.quantity * 40
                  : item.unit === 'kg'
                  ? item.quantity
                  : null;
              const sacks40kg =
                kgEquivalent !== null ? Math.round(kgEquivalent / 40) : null;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isUnderTwoMonths
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                        {isUnderTwoMonths && (
                          <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                            <AlertTriangle className="w-2.5 h-2.5" /> Alerta: &lt; 2 meses de stock
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.subCategory}</p>
                      {lotMode && (
                        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${item.loteId ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                          <MapPin className="w-3 h-3" /> {lotLabel(item.loteId)}
                        </span>
                      )}
                      {locationsEnabled && item.rubro !== 'avicola' && (
                        <span
                          className={`inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.animalId ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <MapPin className="w-3 h-3" /> {locLabel(item.animalId)}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-slate-900">
                        {item.quantity.toLocaleString()} {item.unit}
                      </span>
                      {sacks40kg !== null && (
                        <span className="text-[11px] text-emerald-700 font-bold block">
                          {item.unit === 'kg'
                            ? `(${sacks40kg} sacos de 40kg)`
                            : `(${kgEquivalent?.toLocaleString()} kg totales)`}
                        </span>
                      )}
                      <p className="text-[10px] text-slate-400">
                        ${item.unitCostUsd} / {item.unit}
                      </p>
                    </div>
                  </div>

                  {/* Stock projection bar */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-[11px] text-slate-600">
                      Consumo estimado: <strong>{item.monthlyConsumptionRate} {item.unit}/mes</strong>
                      <span className="text-slate-400 ml-2">
                        {item.monthlyConsumptionRate > 0
                          ? `(Cobertura: ~${monthsOfStock.toFixed(1)} meses)`
                          : '(sin consumo mensual definido)'}
                      </span>
                      {isUnderTwoMonths && item.requiredPurchaseForTwoMonths > 0 && (
                        <span className="block text-[10px] text-amber-700 font-semibold">
                          Comprar ~{round2(item.requiredPurchaseForTwoMonths)} {item.unit} para cubrir 2 meses
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {onAssignLocation && item.rubro !== 'avicola' && locationsEnabled && (
                        <button
                          onClick={() => openAssign(item)}
                          disabled={toNumber(item.quantity) <= 0}
                          className="flex items-center gap-1 text-xs font-bold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Asignar o mover stock a un lote/cerdo o al almacén general"
                        >
                          <MapPin className="w-3.5 h-3.5" /> Ubicar
                        </button>
                      )}
                      {item.rubro === 'avicola' && !lotMode ? (
                        <span
                          className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg"
                          title="El consumo de insumos avícolas se registra desde el lote para cargarlo a sus gastos"
                        >
                          Avícola · consumir desde el lote
                        </span>
                      ) : (
                      <button
                        onClick={() => openConsume(item)}
                        disabled={toNumber(item.quantity) <= 0}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Descontar consumo y cargarlo al animal/lote"
                      >
                        <MinusCircle className="w-3.5 h-3.5" /> Consumir
                      </button>
                      )}
                      {onPurchaseItem && (
                        <button
                          onClick={() => openPurchase(item)}
                          className="flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          title="Registrar compra / reposición de este insumo"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Comprar
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          onClick={() => {
                            setDialogError(null);
                            setItemToDelete(item);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar insumo del inventario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal interno: Registrar Consumo animal/lote */}
        {showConsumeDialog && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm">
                  Descontar Consumo de Insumo
                </h4>
                <button
                  onClick={() => setShowConsumeDialog(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Ítem: <strong className="text-slate-800">{showConsumeDialog.name}</strong> — stock disponible:{' '}
                <strong className="text-slate-800">
                  {showConsumeDialog.quantity} {showConsumeDialog.unit}
                </strong>
              </p>

              <form onSubmit={handleApplyConsumption} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Cantidad a Descontar ({showConsumeDialog.unit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={showConsumeDialog.quantity}
                    placeholder="0"
                    value={consumeAmount}
                    onChange={(e) => setConsumeAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {lotMode ? (
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Lote de pollos que lo consume:</label>
                    <select
                      value={consumeTargetId}
                      onChange={(e) => setConsumeTargetId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                    >
                      {lotLocations!.length === 0 && <option value={NO_TARGET}>No hay lotes activos</option>}
                      {lotLocations!.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">El costo se registra como gasto del lote y aparece en sus finanzas.</p>
                  </div>
                ) : (
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    {rubro === 'bovino' ? 'Destino del consumo:' : 'Destino del Consumo (animal / lote):'}
                  </label>
                  <select
                    value={consumeTargetId}
                    onChange={(e) => setConsumeTargetId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 bg-white"
                  >
                    <option value={NO_TARGET}>Consumo general de la granja (sin imputar)</option>
                    {activeAnimals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} ({a.category}{headCount(a) > 1 ? ` · ${headCount(a)} cab.` : ''})
                      </option>
                    ))}
                    <option value={FREE_TARGET}>Otro destino (texto libre)</option>
                  </select>
                  {consumeTargetId === FREE_TARGET && (
                    <input
                      type="text"
                      value={consumeTargetText}
                      onChange={(e) => setConsumeTargetText(e.target.value)}
                      placeholder="Ej: Lote Engorde 12"
                      className="w-full mt-1.5 px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    />
                  )}
                </div>
                )}

                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                  Se descontará del stock
                  {lotMode
                    ? ' y su costo se cargará al lote elegido.'
                    : consumeTargetId !== NO_TARGET && consumeTargetId !== FREE_TARGET
                    ? ' y su costo se imputará al costo acumulado del animal/lote seleccionado.'
                    : '. Si eliges un animal o lote, el costo se imputa a su costo acumulado.'}
                  {showConsumeDialog.expensedOnPurchase
                    ? ' La compra ya se registró como egreso, no se crea otro.'
                    : ' Se registrará el egreso correspondiente en el balance.'}
                </div>

                {errorBox}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConsumeDialog(null)}
                    className="flex-1 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    {isSaving ? 'Guardando...' : 'Confirmar Deducción'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal interno: Registrar Compra de insumo existente */}
        {showPurchaseDialog && onPurchaseItem && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-rose-600" /> Registrar compra de insumo
                </h4>
                <button onClick={() => setShowPurchaseDialog(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRegisterPurchase} className="space-y-2.5">
                <div>
                  <label className="block font-semibold text-slate-700">Insumo comprado:</label>
                  <select
                    value={purchaseItemId}
                    onChange={(e) => {
                      const it = safeItems.find((i) => i.id === e.target.value);
                      setPurchaseItemId(e.target.value);
                      if (it && !purchasePrice && toNumber(it.unitCostUsd) > 0) setPurchasePrice(String(it.unitCostUsd));
                      if (it && !purchaseSupplier && it.supplier) setPurchaseSupplier(it.supplier);
                      if (it) setPurchaseLocation(it.animalId || GENERAL_LOCATION);
                    }}
                    required
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <option value="">Selecciona un insumo…</option>
                    {(['alimentos', 'medicinas', 'otros'] as const).map((cat) => {
                      const list = safeItems.filter((i) => i.category === cat);
                      if (list.length === 0) return null;
                      return (
                        <optgroup key={cat} label={cat === 'alimentos' ? 'Alimentos' : cat === 'medicinas' ? 'Medicinas' : 'Otros / Insumos'}>
                          {list.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} — stock {i.quantity} {i.unit}
                              {locationsEnabled && i.animalId ? ` · ${locLabel(i.animalId)}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    ¿Es un producto nuevo? Ciérralo y usa <strong>Nuevo ítem</strong> (puedes registrar la compra ahí mismo).
                  </p>
                </div>

                {locationsEnabled && purchaseItem?.rubro !== 'avicola' && (
                  <div>
                    <label className="block font-semibold text-slate-700">¿A dónde entra la compra? (opcional)</label>
                    <select
                      value={purchaseLocation}
                      onChange={(e) => setPurchaseLocation(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <LocationOptions animals={activeAnimals} />
                    </select>
                    {purchaseItem && (purchaseItem.animalId || GENERAL_LOCATION) !== purchaseLocation && (
                      <p className="text-[10px] text-indigo-700 mt-1">
                        Entrará como stock de {locLabel(purchaseLocation || undefined)} (fila propia de {purchaseItem.name} en esa ubicación).
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Cantidad{purchaseItem ? ` (${purchaseItem.unit})` : ''}:
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder="0"
                      value={purchaseQty}
                      onChange={(e) => setPurchaseQty(e.target.value)}
                      required
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">
                      Precio / {purchaseItem ? purchaseItem.unit : 'unidad'} ($):
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      required
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Fecha de compra:</label>
                    <input
                      type="date"
                      max={todayISO()}
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">N.º factura:</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={purchaseInvoice}
                      onChange={(e) => setPurchaseInvoice(e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Proveedor:</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={purchaseSupplier}
                    onChange={(e) => setPurchaseSupplier(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Notas:</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={purchaseNotes}
                    onChange={(e) => setPurchaseNotes(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>Total de la compra</span>
                    <span>${purchaseTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-rose-800/90">
                    Se suma al stock, se recalcula el costo promedio y se registra como egreso “Compra de insumos” en el
                    balance.
                    {purchaseItem && !purchaseItem.expensedOnPurchase && toNumber(purchaseItem.quantity) > 0 && (
                      <>
                        {' '}El stock actual aún no estaba en el balance: se asentará también (
                        ${round2(toNumber(purchaseItem.quantity) * toNumber(purchaseItem.unitCostUsd)).toFixed(2)}).
                      </>
                    )}
                  </p>
                </div>

                {errorBox}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseDialog(false)}
                    className="flex-1 min-h-10 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 min-h-10 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl font-bold"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal interno: Crear Nuevo Ítem */}
        {showNewItemModal && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm">
                  Registrar Nuevo Ítem en {activeTab.toUpperCase()}
                </h4>
                <button
                  onClick={() => setShowNewItemModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewItem} className="space-y-2.5">
                <div>
                  <label className="block font-semibold text-slate-700">Nombre del Ítem:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Balanceado Pre-iniciador"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Subcategoría / Uso:</label>
                  <input
                    type="text"
                    placeholder="Ej: Lechones Destete"
                    value={newItemSubCategory}
                    onChange={(e) => setNewItemSubCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                {lotMode && (
                  <div>
                    <label className="block font-semibold text-slate-700">Lote (opcional):</label>
                    <select
                      value={newItemLocation}
                      onChange={(e) => setNewItemLocation(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value={GENERAL_LOCATION}>Bodega general (todos los lotes)</option>
                      {lotLocations!.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-0.5">Asígnalo a un lote si es solo para ese galpón.</p>
                  </div>
                )}

                {locationsEnabled && (
                  <div>
                    <label className="block font-semibold text-slate-700">Ubicación (opcional):</label>
                    <select
                      value={newItemLocation}
                      onChange={(e) => setNewItemLocation(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <LocationOptions animals={activeAnimals} />
                    </select>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Asígnalo a un lote o cerdo si es solo para él; al consumirlo, el costo se le carga automáticamente.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Cantidad Inicial:</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="0"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Unidad de Medida:</label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value as WarehouseItem['unit'])}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    >
                      <option value="kg">Kilogramos (kg)</option>
                      <option value="g">Gramos (g)</option>
                      <option value="litros">Litros (L)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="unidades">Unidades / Dosis</option>
                      <option value="bultos (40kg)">Bultos (40kg)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Costo Unitario ($):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Consumo Mensual:</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0"
                      value={newItemMonthly}
                      onChange={(e) => setNewItemMonthly(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Proveedor:</label>
                    <input
                      type="text"
                      placeholder="Opcional"
                      value={newItemSupplier}
                      onChange={(e) => setNewItemSupplier(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Vencimiento:</label>
                    <input
                      type="date"
                      min={todayISO()}
                      value={newItemExpiration}
                      onChange={(e) => setNewItemExpiration(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={registerPurchase}
                    onChange={(e) => setRegisterPurchase(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className="text-[11px] text-slate-700">
                    Registrar la compra como egreso en el balance
                    {toNumber(newItemQty) > 0 && toNumber(newItemCost) > 0 && (
                      <strong> (${round2(toNumber(newItemQty) * toNumber(newItemCost)).toFixed(2)})</strong>
                    )}
                    . Si no, el egreso se registra al consumir.
                  </span>
                </label>

                {errorBox}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewItemModal(false)}
                    className="flex-1 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar Ítem'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal interno: Ubicar / mover stock */}
        {assignItem && onAssignLocation && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" /> Ubicar insumo
                </h4>
                <button onClick={() => setAssignItem(null)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-slate-500">
                <strong className="text-slate-800">{assignItem.name}</strong> — {assignItem.quantity} {assignItem.unit} en{' '}
                <strong className="text-slate-800">{locLabel(assignItem.animalId)}</strong>
              </p>
              <form onSubmit={handleAssign} className="space-y-2.5">
                <div>
                  <label className="block font-semibold text-slate-700">Mover a:</label>
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                  >
                    <LocationOptions animals={activeAnimals} generalLabel="Almacén general" />
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Cantidad ({assignItem.unit}):</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    max={assignItem.quantity}
                    inputMode="decimal"
                    value={assignQty}
                    onChange={(e) => setAssignQty(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold"
                  />
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px]">
                  Es un traslado interno: no crea gastos en el balance. El costo se carga al lote o cerdo cuando se consume.
                </div>
                {errorBox}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAssignItem(null)}
                    className="flex-1 min-h-10 py-2 border border-slate-300 rounded-xl text-slate-600 font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 min-h-10 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold"
                  >
                    {isSaving ? 'Guardando...' : 'Asignar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmación de Eliminación de Ítem (Requisito 3) */}
        {itemToDelete && (
          <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 border border-slate-200">
              <div className="flex items-center gap-2.5 text-rose-600 font-black text-sm">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-rose-600" />
                </div>
                <span>Eliminar Ítem del Inventario</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Estás seguro de que deseas eliminar permanentemente{' '}
                <strong className="text-slate-900">{itemToDelete.name}</strong> del
                almacén? Esta acción no se puede deshacer.
              </p>
              {errorBox}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="flex-1 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSaving}
                  className="flex-1 py-2 disabled:opacity-60 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Eliminar Ítem
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
