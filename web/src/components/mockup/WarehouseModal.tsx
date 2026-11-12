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
} from 'lucide-react';
import { PorcinoAnimal, WarehouseItem } from '../../types';
import { evaluateWarehouseReplenishment } from '../../models/PorcinoCalculations';
import { isActiveAnimal, headCount, round2 } from '../../models/porcinoRules';
import { newId } from '../../utils/ids';
import { todayISO } from '../../utils/dates';
import { ModalActionReturn, runModalAction, toNumber } from './modalResult';

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
}

const NO_TARGET = '__general__';
const FREE_TARGET = '__libre__';

export const WarehouseModal: React.FC<WarehouseModalProps> = ({
  items,
  animals = [],
  onClose,
  onConsumeItem,
  onAddItem,
  onDeleteItem,
}) => {
  const safeItems = items || [];
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

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evaluated.filter(
      (item) =>
        item.category === activeTab &&
        (!q || (item.name || '').toLowerCase().includes(q) || (item.subCategory || '').toLowerCase().includes(q))
    );
  }, [evaluated, activeTab, searchQuery]);

  const openConsume = (item: WarehouseItem) => {
    setShowConsumeDialog(item);
    setConsumeAmount('');
    setConsumeTargetId(NO_TARGET);
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
    const targetAnimal = activeAnimals.find((a) => a.id === consumeTargetId);
    const targetLabel = targetAnimal
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
      onConsumeItem(showConsumeDialog.id, amountNum, targetLabel, targetAnimal?.id)
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
    if (safeItems.some((i) => i.name.trim().toLowerCase() === name.toLowerCase() && i.category === activeTab)) {
      setDialogError(`Ya existe un ítem llamado "${name}" en ${activeTab}.`);
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
    flash(
      purchase
        ? `Nuevo ítem "${created.name}" registrado y compra de $${round2(qty * cost).toFixed(2)} asentada como egreso.`
        : `Nuevo ítem "${created.name}" registrado en Almacén.`
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
                Almacén & Inventario Pecuario
              </h3>
              <p className="text-[11px] text-slate-400">
                Control de Alimentos, Medicinas y Proyección de Stock a 2 Meses
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

        {/* Feedback alert */}
        {successMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center gap-2 font-medium">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        {/* Category Tabs: Alimentos, Medicinas, Otros */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0">
          <div className="flex items-center gap-1">
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

          <button
            onClick={() => {
              setDialogError(null);
              setShowNewItemModal(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Ítem
          </button>
        </div>

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
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
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

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openConsume(item)}
                        disabled={toNumber(item.quantity) <= 0}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Descontar consumo y cargarlo al animal/lote"
                      >
                        <MinusCircle className="w-3.5 h-3.5" /> Consumir
                      </button>
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
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
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

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Destino del Consumo (animal / lote):
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

                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                  Se descontará del stock
                  {consumeTargetId !== NO_TARGET && consumeTargetId !== FREE_TARGET
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

        {/* Modal interno: Crear Nuevo Ítem */}
        {showNewItemModal && (
          <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-xs">
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
