import React, { useId, useMemo, useState } from 'react';
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
  ChevronDown,
  Wheat,
} from 'lucide-react';
import { ConfirmDialog, ErrorBox, IconBtn, ModalHeader, btnClass, inputClass, useBackClose } from '../common/ui';
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
        targetLabel ? ` y se cargaron a ${targetLabel}` : ' (uso general)'
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

  // ---- Atrás de Android / Escape: cierra primero el diálogo interno abierto (preguntando si tiene datos) ----
  const layer: 'assign' | 'consume' | 'purchase' | 'new' | 'main' = assignItem
    ? 'assign'
    : showConsumeDialog
      ? 'consume'
      : showPurchaseDialog
        ? 'purchase'
        : showNewItemModal
          ? 'new'
          : 'main';
  const layerDirty =
    layer === 'consume'
      ? !!consumeAmount.trim() || !!consumeTargetText.trim()
      : layer === 'purchase'
        ? !!purchaseQty.trim() || !!purchaseInvoice.trim() || !!purchaseNotes.trim()
        : layer === 'new'
          ? [newItemName, newItemSubCategory, newItemQty, newItemCost, newItemMonthly, newItemSupplier, newItemExpiration].some((v) => !!v.trim())
          : false;
  const resetNewItem = () => {
    setNewItemName('');
    setNewItemSubCategory('');
    setNewItemQty('');
    setNewItemCost('');
    setNewItemMonthly('');
    setNewItemSupplier('');
    setNewItemExpiration('');
  };
  const closeTop = () => {
    setDialogError(null);
    if (layer === 'assign') setAssignItem(null);
    else if (layer === 'consume') setShowConsumeDialog(null);
    else if (layer === 'purchase') setShowPurchaseDialog(false);
    else if (layer === 'new') {
      setShowNewItemModal(false);
      resetNewItem();
    } else onClose();
  };
  const { requestClose, confirmDialog } = useBackClose(true, closeTop, layerDirty);
  const titleId = useId();

  const errorBox = <ErrorBox error={dialogError} />;
  const labelCls = 'block text-sm font-semibold text-slate-900 mb-1';
  const hintCls = 'text-xs text-slate-600 mt-1';

  const tabs: { id: WarehouseItem['category']; label: string; Icon: React.ElementType }[] = [
    { id: 'alimentos', label: 'Alimentos', Icon: Package },
    { id: 'medicinas', label: 'Medicinas', Icon: Pill },
    { id: 'otros', label: 'Otros', Icon: Wrench },
  ];
  const tabLabel = tabs.find((t) => t.id === activeTab)?.label || '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && layer === 'main' && requestClose()}
    >
      <div
        id="warehouse-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white text-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[750px]"
      >
        <ModalHeader
          title={`Almacén ${WAREHOUSE_RUBRO_LABEL[rubro]}`}
          subtitle={isAvicola ? 'Alimento e insumos de los pollos · lo usado se carga al lote' : 'Alimentos, medicinas y cuánto alcanzan'}
          titleId={titleId}
          rubro={rubro}
          icon={<Package />}
          onClose={requestClose}
        />

        {headerExtra}

        {successMessage && (
          <div role="status" className="bg-emerald-700 text-white px-4 py-2 text-sm flex items-center gap-2 font-semibold shrink-0">
            <Check className="w-5 h-5 shrink-0" aria-hidden="true" /> {successMessage}
          </div>
        )}

        {/* Pestañas: Alimentos, Medicinas, Otros (todas visibles, 44 px) */}
        <div role="tablist" aria-label="Tipo de insumo" className="grid grid-cols-3 gap-1 p-1.5 bg-slate-100 border-b border-slate-200 shrink-0">
          {tabs.map(({ id, label, Icon }) => {
            const on = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveTab(id)}
                className={`min-h-11 rounded-lg flex items-center justify-center gap-1.5 text-sm font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  on ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
                <span className="text-xs bg-slate-200 text-slate-800 px-1.5 rounded-full">{countByCategory[id]}</span>
              </button>
            );
          })}
        </div>

        {/* Acciones principales */}
        <div className="grid grid-cols-2 gap-2 px-3 pt-3 bg-white shrink-0">
          <button
            type="button"
            onClick={() => {
              setDialogError(null);
              setNewItemLocation(locationFilter !== ALL_LOCATIONS ? locationFilter : GENERAL_LOCATION);
              setShowNewItemModal(true);
            }}
            className={btnClass({ rubro: 'general' })}
          >
            <Plus className="w-5 h-5" aria-hidden="true" /> Nuevo insumo
          </button>
          {onPurchaseItem ? (
            <button
              type="button"
              onClick={() => openPurchase()}
              disabled={safeItems.length === 0}
              className={btnClass({ variant: 'secondary' })}
            >
              <ShoppingCart className="w-5 h-5" aria-hidden="true" /> Registrar compra
            </button>
          ) : (
            <span />
          )}
          {onPurchaseItem && safeItems.length === 0 && <p className="col-span-2 text-xs text-slate-600">Para registrar una compra, primero crea el insumo con “Nuevo insumo”.</p>}
          {onPurchaseItem && (
            <button
              type="button"
              aria-expanded={showPurchaseHistory}
              onClick={() => setShowPurchaseHistory((v) => !v)}
              className="col-span-2 min-h-11 flex items-center justify-between gap-2 px-3 text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-rose-700" aria-hidden="true" /> Compras anteriores ({sortedPurchases.length})
              </span>
              <span className="font-bold text-rose-800 flex items-center gap-1">
                ${purchasesTotal.toLocaleString()}
                <ChevronDown className={`w-4 h-4 transition-transform ${showPurchaseHistory ? 'rotate-180' : ''}`} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>

        {showPurchaseHistory && (
          <div className="mx-3 mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shrink-0">
            {sortedPurchases.length === 0 ? (
              <p className="p-3 text-center text-sm text-slate-600">Aún no hay compras registradas.</p>
            ) : (
              sortedPurchases.map((m) => (
                <div key={m.id} className="p-2.5 flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{m.concept}</p>
                    <p className="text-slate-600 truncate">
                      {m.date}
                      {m.details ? ` · ${m.details}` : ''}
                    </p>
                  </div>
                  <span className="font-bold text-rose-800 shrink-0">-${toNumber(m.amount).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Buscar y filtrar por ubicación */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label={`Buscar en ${tabLabel.toLowerCase()}`}
              placeholder={`Buscar en ${tabLabel.toLowerCase()}…`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              enterKeyHint="search"
              className={`${inputClass} pl-10`}
            />
          </div>
          {locationsEnabled && (
            <select aria-label="Filtrar por ubicación" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className={`${inputClass} max-w-[45%] font-semibold`}>
              <option value={ALL_LOCATIONS}>Todas las ubicaciones</option>
              <option value={GENERAL_LOCATION}>Almacén general</option>
              {usedLocations.map((id) => (
                <option key={id} value={id}>
                  {locLabel(id)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Total de alimentos (kilos y sacos de 40 kg) */}
          {activeTab === 'alimentos' && (
            <div className="p-3 bg-emerald-900 text-white rounded-2xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center shrink-0" aria-hidden="true">
                  <Wheat className="w-5 h-5 text-emerald-100" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-emerald-100 font-bold block">Total de alimento</span>
                  <strong className="text-base text-white font-black">{totalKgFoods.toLocaleString()} kg</strong>
                  <span className="text-xs text-emerald-100 font-semibold block">≈ {totalSacks40kg.toLocaleString()} sacos de 40 kg</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-emerald-100 block">Vale</span>
                <strong className="text-sm font-bold text-white">${Math.round(totalValueFoods).toLocaleString()}</strong>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-slate-600 text-sm">No hay insumos en esta pestaña.</div>
          ) : (
            filteredItems.map((item) => {
              // Cobertura y alerta calculadas por evaluateWarehouseReplenishment
              const monthsOfStock = item.monthsOfSupply;
              const isUnderTwoMonths = item.isCritical;
              // Sacos de 40 kg
              const kgEquivalent = item.unit === 'bultos (40kg)' ? item.quantity * 40 : item.unit === 'kg' ? item.quantity : null;
              const sacks40kg = kgEquivalent !== null ? Math.round(kgEquivalent / 40) : null;

              return (
                <div key={item.id} className={`p-3 rounded-xl border ${isUnderTwoMonths ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-base leading-tight">{item.name}</h4>
                      {item.subCategory && <p className="text-xs text-slate-600 mt-0.5">{item.subCategory}</p>}
                      {isUnderTwoMonths && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs font-bold bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Alcanza menos de 2 meses
                        </span>
                      )}
                      {lotMode && (
                        <span className={`inline-flex items-center gap-1 mt-1 ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${item.loteId ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {lotLabel(item.loteId)}
                        </span>
                      )}
                      {locationsEnabled && item.rubro !== 'avicola' && (
                        <span className={`inline-flex items-center gap-1 mt-1 ml-1 text-xs font-bold px-2 py-0.5 rounded-full ${item.animalId ? 'bg-indigo-100 text-indigo-900' : 'bg-slate-100 text-slate-700'}`}>
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {locLabel(item.animalId)}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-slate-900">
                        {item.quantity.toLocaleString()} {item.unit}
                      </span>
                      {sacks40kg !== null && (
                        <span className="text-xs text-emerald-800 font-bold block">
                          {item.unit === 'kg' ? `(${sacks40kg} sacos de 40 kg)` : `(${kgEquivalent?.toLocaleString()} kg)`}
                        </span>
                      )}
                      <p className="text-xs text-slate-600">
                        ${item.unitCostUsd} / {item.unit}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    {item.monthlyConsumptionRate > 0 ? (
                      <>
                        Se usan <strong>{item.monthlyConsumptionRate} {item.unit}/mes</strong> · alcanza ~{monthsOfStock.toFixed(1)} meses
                      </>
                    ) : (
                      'Sin consumo mensual anotado'
                    )}
                    {isUnderTwoMonths && item.requiredPurchaseForTwoMonths > 0 && (
                      <span className="block text-amber-900 font-semibold">
                        Comprar ~{round2(item.requiredPurchaseForTwoMonths)} {item.unit} para cubrir 2 meses
                      </span>
                    )}
                  </div>

                  {/* Acciones: 44 px y separadas; Eliminar aparte, a la derecha */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.rubro === 'avicola' && !lotMode ? (
                      <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg">Se usa desde el lote de pollos</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openConsume(item)}
                        disabled={toNumber(item.quantity) <= 0}
                        className="min-h-11 px-3 flex items-center gap-1.5 text-sm font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <MinusCircle className="w-4 h-4" aria-hidden="true" /> Usar
                      </button>
                    )}
                    {onPurchaseItem && (
                      <button
                        type="button"
                        onClick={() => openPurchase(item)}
                        className="min-h-11 px-3 flex items-center gap-1.5 text-sm font-bold text-rose-900 bg-rose-100 hover:bg-rose-200 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <ShoppingCart className="w-4 h-4" aria-hidden="true" /> Comprar
                      </button>
                    )}
                    {onAssignLocation && item.rubro !== 'avicola' && locationsEnabled && (
                      <button
                        type="button"
                        onClick={() => openAssign(item)}
                        disabled={toNumber(item.quantity) <= 0}
                        className="min-h-11 px-3 flex items-center gap-1.5 text-sm font-bold text-indigo-900 bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <MapPin className="w-4 h-4" aria-hidden="true" /> Mover
                      </button>
                    )}
                    {onDeleteItem && (
                      <button
                        type="button"
                        onClick={() => {
                          setDialogError(null);
                          setItemToDelete(item);
                        }}
                        aria-label={`Eliminar ${item.name}`}
                        className="ml-auto w-11 h-11 flex items-center justify-center text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Diálogo interno: Usar (descontar consumo) */}
        {showConsumeDialog && (
          <InnerDialog title="Usar insumo" icon={<MinusCircle className="w-5 h-5 text-emerald-700" />} onClose={requestClose}>
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">{showConsumeDialog.name}</strong> · hay{' '}
              <strong className="text-slate-900">
                {showConsumeDialog.quantity} {showConsumeDialog.unit}
              </strong>
            </p>

            <form onSubmit={handleApplyConsumption} className="space-y-3" noValidate>
              <div>
                <label htmlFor="wh-consume-amount" className={labelCls}>
                  Cantidad usada ({showConsumeDialog.unit})
                </label>
                <input
                  id="wh-consume-amount"
                  type="number"
                  step="any"
                  min="0"
                  max={showConsumeDialog.quantity}
                  inputMode="decimal"
                  enterKeyHint="done"
                  placeholder="0"
                  value={consumeAmount}
                  onChange={(e) => setConsumeAmount(e.target.value)}
                  className={`${inputClass} font-bold`}
                />
              </div>

              {lotMode ? (
                <div>
                  <label htmlFor="wh-consume-lot" className={labelCls}>
                    Lote de pollos que lo usa
                  </label>
                  <select id="wh-consume-lot" value={consumeTargetId} onChange={(e) => setConsumeTargetId(e.target.value)} className={inputClass}>
                    {lotLocations!.length === 0 && <option value={NO_TARGET}>No hay lotes activos</option>}
                    {lotLocations!.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <p className={hintCls}>El costo se anota como gasto del lote.</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="wh-consume-target" className={labelCls}>
                    ¿Para quién?
                  </label>
                  <select id="wh-consume-target" value={consumeTargetId} onChange={(e) => setConsumeTargetId(e.target.value)} className={inputClass}>
                    <option value={NO_TARGET}>Uso general de la granja</option>
                    {activeAnimals.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} ({a.category}
                        {headCount(a) > 1 ? ` · ${headCount(a)} cab.` : ''})
                      </option>
                    ))}
                    <option value={FREE_TARGET}>Otro (escribirlo)</option>
                  </select>
                  {consumeTargetId === FREE_TARGET && (
                    <input
                      type="text"
                      aria-label="Destino del consumo"
                      value={consumeTargetText}
                      onChange={(e) => setConsumeTargetText(e.target.value)}
                      placeholder="Ej: Lote Engorde 12"
                      className={`${inputClass} mt-2`}
                    />
                  )}
                </div>
              )}

              <p className="p-2.5 bg-emerald-50 rounded-xl text-emerald-900 text-xs leading-relaxed">
                Se descuenta del almacén
                {lotMode
                  ? ' y el costo se carga al lote elegido.'
                  : consumeTargetId !== NO_TARGET && consumeTargetId !== FREE_TARGET
                    ? ' y el costo se suma al animal o lote elegido.'
                    : '. Si eliges un animal o lote, el costo se le suma.'}
                {showConsumeDialog.expensedOnPurchase ? ' La compra ya estaba en el balance: no se anota otro gasto.' : ' Se anota el gasto en el balance.'}
              </p>

              {errorBox}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={requestClose} className={btnClass({ variant: 'secondary' })}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className={btnClass({ rubro: 'general' })}>
                  {isSaving ? 'Guardando…' : 'Descontar'}
                </button>
              </div>
            </form>
          </InnerDialog>
        )}

        {/* Diálogo interno: Registrar compra de un insumo existente */}
        {showPurchaseDialog && onPurchaseItem && (
          <InnerDialog title="Registrar compra" icon={<ShoppingCart className="w-5 h-5 text-rose-700" />} onClose={requestClose}>
            <form onSubmit={handleRegisterPurchase} className="space-y-3" noValidate>
              <div>
                <label htmlFor="wh-purchase-item" className={labelCls}>
                  Insumo comprado
                </label>
                <select
                  id="wh-purchase-item"
                  value={purchaseItemId}
                  onChange={(e) => {
                    const it = safeItems.find((i) => i.id === e.target.value);
                    setPurchaseItemId(e.target.value);
                    if (it && !purchasePrice && toNumber(it.unitCostUsd) > 0) setPurchasePrice(String(it.unitCostUsd));
                    if (it && !purchaseSupplier && it.supplier) setPurchaseSupplier(it.supplier);
                    if (it) setPurchaseLocation(it.animalId || GENERAL_LOCATION);
                  }}
                  className={inputClass}
                >
                  <option value="">Elige un insumo…</option>
                  {(['alimentos', 'medicinas', 'otros'] as const).map((cat) => {
                    const list = safeItems.filter((i) => i.category === cat);
                    if (list.length === 0) return null;
                    return (
                      <optgroup key={cat} label={cat === 'alimentos' ? 'Alimentos' : cat === 'medicinas' ? 'Medicinas' : 'Otros'}>
                        {list.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} — hay {i.quantity} {i.unit}
                            {locationsEnabled && i.animalId ? ` · ${locLabel(i.animalId)}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                <p className={hintCls}>¿Es un producto nuevo? Ciérralo y usa “Nuevo insumo” (ahí también puedes anotar la compra).</p>
              </div>

              {locationsEnabled && purchaseItem?.rubro !== 'avicola' && (
                <div>
                  <label htmlFor="wh-purchase-loc" className={labelCls}>
                    ¿A dónde entra? (opcional)
                  </label>
                  <select id="wh-purchase-loc" value={purchaseLocation} onChange={(e) => setPurchaseLocation(e.target.value)} className={inputClass}>
                    <LocationOptions animals={activeAnimals} />
                  </select>
                  {purchaseItem && (purchaseItem.animalId || GENERAL_LOCATION) !== purchaseLocation && (
                    <p className="text-xs text-indigo-800 mt-1">Entrará como existencia de {locLabel(purchaseLocation || undefined)}.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="wh-purchase-qty" className={labelCls}>
                    Cantidad{purchaseItem ? ` (${purchaseItem.unit})` : ''}
                  </label>
                  <input
                    id="wh-purchase-qty"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="0"
                    value={purchaseQty}
                    onChange={(e) => setPurchaseQty(e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                </div>
                <div>
                  <label htmlFor="wh-purchase-price" className={labelCls}>
                    Precio por {purchaseItem ? purchaseItem.unit : 'unidad'} ($)
                  </label>
                  <input
                    id="wh-purchase-price"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="wh-purchase-date" className={labelCls}>
                    Fecha
                  </label>
                  <input id="wh-purchase-date" type="date" max={todayISO()} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="wh-purchase-invoice" className={labelCls}>
                    N.º de factura
                  </label>
                  <input id="wh-purchase-invoice" type="text" placeholder="Opcional" value={purchaseInvoice} onChange={(e) => setPurchaseInvoice(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label htmlFor="wh-purchase-supplier" className={labelCls}>
                  Proveedor
                </label>
                <input id="wh-purchase-supplier" type="text" placeholder="Opcional" value={purchaseSupplier} onChange={(e) => setPurchaseSupplier(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label htmlFor="wh-purchase-notes" className={labelCls}>
                  Notas
                </label>
                <input id="wh-purchase-notes" type="text" placeholder="Opcional" value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} className={inputClass} />
              </div>

              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>${purchaseTotal.toFixed(2)}</span>
                </div>
                <p className="text-xs text-rose-900">
                  Se suma al almacén y se anota como gasto “Compra de insumos” en el balance.
                  {purchaseItem && !purchaseItem.expensedOnPurchase && toNumber(purchaseItem.quantity) > 0 && (
                    <>
                      {' '}Lo que ya había aún no estaba en el balance: también se anota (${round2(toNumber(purchaseItem.quantity) * toNumber(purchaseItem.unitCostUsd)).toFixed(2)}).
                    </>
                  )}
                </p>
              </div>

              {errorBox}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={requestClose} className={btnClass({ variant: 'secondary' })}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className={btnClass({ rubro: 'porcino' })}>
                  {isSaving ? 'Guardando…' : 'Guardar compra'}
                </button>
              </div>
            </form>
          </InnerDialog>
        )}

        {/* Diálogo interno: Nuevo insumo */}
        {showNewItemModal && (
          <InnerDialog title={`Nuevo insumo · ${tabLabel}`} icon={<Plus className="w-5 h-5 text-emerald-700" />} onClose={requestClose}>
            <form onSubmit={handleCreateNewItem} className="space-y-3" noValidate>
              <div>
                <label htmlFor="wh-new-name" className={labelCls}>
                  Nombre
                </label>
                <input id="wh-new-name" type="text" placeholder="Ej: Alimento iniciador" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label htmlFor="wh-new-sub" className={labelCls}>
                  ¿Para qué se usa? (opcional)
                </label>
                <input id="wh-new-sub" type="text" placeholder="Ej: Lechones destetados" value={newItemSubCategory} onChange={(e) => setNewItemSubCategory(e.target.value)} className={inputClass} />
              </div>

              {lotMode && (
                <div>
                  <label htmlFor="wh-new-lot" className={labelCls}>
                    Lote (opcional)
                  </label>
                  <select id="wh-new-lot" value={newItemLocation} onChange={(e) => setNewItemLocation(e.target.value)} className={inputClass}>
                    <option value={GENERAL_LOCATION}>Bodega general (todos los lotes)</option>
                    {lotLocations!.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <p className={hintCls}>Asígnalo a un lote si es solo para ese galpón.</p>
                </div>
              )}

              {locationsEnabled && (
                <div>
                  <label htmlFor="wh-new-loc" className={labelCls}>
                    Ubicación (opcional)
                  </label>
                  <select id="wh-new-loc" value={newItemLocation} onChange={(e) => setNewItemLocation(e.target.value)} className={inputClass}>
                    <LocationOptions animals={activeAnimals} />
                  </select>
                  <p className={hintCls}>Si es solo para un lote o cerdo, al usarlo el costo se le carga solo.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="wh-new-qty" className={labelCls}>
                    Cantidad que hay
                  </label>
                  <input id="wh-new-qty" type="number" step="any" min="0" inputMode="decimal" placeholder="0" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="wh-new-unit" className={labelCls}>
                    Unidad
                  </label>
                  <select id="wh-new-unit" value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value as WarehouseItem['unit'])} className={inputClass}>
                    <option value="kg">Kilos (kg)</option>
                    <option value="g">Gramos (g)</option>
                    <option value="litros">Litros (L)</option>
                    <option value="ml">Mililitros (ml)</option>
                    <option value="unidades">Unidades / dosis</option>
                    <option value="bultos (40kg)">Sacos de 40 kg</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="wh-new-cost" className={labelCls}>
                    Precio por unidad ($)
                  </label>
                  <input id="wh-new-cost" type="number" step="any" min="0" inputMode="decimal" placeholder="0.00" value={newItemCost} onChange={(e) => setNewItemCost(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="wh-new-monthly" className={labelCls}>
                    Se usa al mes
                  </label>
                  <input id="wh-new-monthly" type="number" step="any" min="0" inputMode="decimal" placeholder="0" value={newItemMonthly} onChange={(e) => setNewItemMonthly(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="wh-new-supplier" className={labelCls}>
                    Proveedor
                  </label>
                  <input id="wh-new-supplier" type="text" placeholder="Opcional" value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="wh-new-exp" className={labelCls}>
                    Vence
                  </label>
                  <input id="wh-new-exp" type="date" min={todayISO()} value={newItemExpiration} onChange={(e) => setNewItemExpiration(e.target.value)} className={inputClass} />
                </div>
              </div>

              <label className="flex items-start gap-3 min-h-11 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input type="checkbox" checked={registerPurchase} onChange={(e) => setRegisterPurchase(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-emerald-700" />
                <span className="text-sm text-slate-800">
                  Anotar la compra como gasto en el balance
                  {toNumber(newItemQty) > 0 && toNumber(newItemCost) > 0 && <strong> (${round2(toNumber(newItemQty) * toNumber(newItemCost)).toFixed(2)})</strong>}. Si no, el gasto se
                  anota al usarlo.
                </span>
              </label>

              {errorBox}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={requestClose} className={btnClass({ variant: 'secondary' })}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className={btnClass({ rubro: 'general' })}>
                  {isSaving ? 'Guardando…' : 'Guardar insumo'}
                </button>
              </div>
            </form>
          </InnerDialog>
        )}

        {/* Diálogo interno: Mover existencias entre ubicaciones */}
        {assignItem && onAssignLocation && (
          <InnerDialog title="Mover insumo" icon={<MapPin className="w-5 h-5 text-indigo-700" />} onClose={requestClose}>
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">{assignItem.name}</strong> — {assignItem.quantity} {assignItem.unit} en{' '}
              <strong className="text-slate-900">{locLabel(assignItem.animalId)}</strong>
            </p>
            <form onSubmit={handleAssign} className="space-y-3" noValidate>
              <div>
                <label htmlFor="wh-assign-to" className={labelCls}>
                  Mover a
                </label>
                <select id="wh-assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className={inputClass}>
                  <LocationOptions animals={activeAnimals} generalLabel="Almacén general" />
                </select>
              </div>
              <div>
                <label htmlFor="wh-assign-qty" className={labelCls}>
                  Cantidad ({assignItem.unit})
                </label>
                <input
                  id="wh-assign-qty"
                  type="number"
                  step="any"
                  min="0"
                  max={assignItem.quantity}
                  inputMode="decimal"
                  value={assignQty}
                  onChange={(e) => setAssignQty(e.target.value)}
                  className={`${inputClass} font-bold`}
                />
              </div>
              <p className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
                Es solo un cambio de lugar: no se anota ningún gasto. El costo se carga al lote o cerdo cuando se usa.
              </p>
              {errorBox}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={requestClose} className={btnClass({ variant: 'secondary' })}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving} className={btnClass({ rubro: 'general' })}>
                  {isSaving ? 'Guardando…' : 'Mover'}
                </button>
              </div>
            </form>
          </InnerDialog>
        )}
      </div>

      {/* Confirmación para eliminar un insumo */}
      {itemToDelete && (
        <ConfirmDialog
          title={`¿Eliminar ${itemToDelete.name}?`}
          message={<p>Se borra del almacén para siempre. Esta acción no se puede deshacer.</p>}
          confirmLabel={isSaving ? 'Eliminando…' : 'Eliminar'}
          danger
          icon={<Trash2 className="w-6 h-6" />}
          error={dialogError}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            setDialogError(null);
            setItemToDelete(null);
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
};

/** Diálogo interno del almacén: tarjeta centrada con título y botón Cerrar de 44 px. */
const InnerDialog: React.FC<{ title: string; icon?: React.ReactNode; onClose: () => void; children: React.ReactNode }> = ({ title, icon, onClose, children }) => {
  const id = useId();
  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="bg-white text-slate-900 rounded-2xl p-4 max-w-sm w-full shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h4 id={id} className="font-bold text-slate-900 text-base flex items-center gap-2">
            {icon && <span aria-hidden="true">{icon}</span>}
            {title}
          </h4>
          <IconBtn aria-label="Cerrar" onClick={onClose}>
            <X className="w-6 h-6" />
          </IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
};
