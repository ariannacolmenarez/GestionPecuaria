import React, { useState } from 'react';
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
  Edit2,
  Check,
} from 'lucide-react';
import { WarehouseItem } from '../../types';

interface WarehouseModalProps {
  items: WarehouseItem[];
  onClose: () => void;
  onConsumeItem: (itemId: string, amount: number, animalCode: string) => void;
  onAddItem: (newItem: WarehouseItem) => void;
  onDeleteItem?: (itemId: string) => void;
}

export const WarehouseModal: React.FC<WarehouseModalProps> = ({
  items,
  onClose,
  onConsumeItem,
  onAddItem,
  onDeleteItem,
}) => {
  const [activeTab, setActiveTab] = useState<'alimentos' | 'medicinas' | 'otros'>('alimentos');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConsumeDialog, setShowConsumeDialog] = useState<WarehouseItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<WarehouseItem | null>(null);
  const [consumeAmount, setConsumeAmount] = useState('50');
  const [consumeTarget, setConsumeTarget] = useState('Lote Gestación L-2');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Totales de Alimentos (Requisito 3)
  const foodItems = items.filter((i) => i.category === 'alimentos');
  const totalKgFoods = foodItems.reduce((acc, curr) => {
    if (curr.unit === 'kg') return acc + curr.quantity;
    if (curr.unit === 'bultos (40kg)') return acc + curr.quantity * 40;
    if (curr.unit === 'g') return acc + curr.quantity / 1000;
    return acc + curr.quantity;
  }, 0);
  const totalSacks40kg = Math.round(totalKgFoods / 40);
  const totalValueFoods = foodItems.reduce((acc, curr) => acc + curr.quantity * curr.unitCostUsd, 0);

  // Form states for new item
  const [newItemName, setNewItemName] = useState('');
  const [newItemSubCategory, setNewItemSubCategory] = useState('');
  const [newItemQty, setNewItemQty] = useState('100');
  const [newItemUnit, setNewItemUnit] = useState<'kg' | 'g' | 'litros' | 'ml' | 'unidades' | 'bultos (40kg)'>('kg');
  const [newItemCost, setNewItemCost] = useState('0.45');
  const [newItemMonthly, setNewItemMonthly] = useState('80');

  const filteredItems = items.filter(
    (item) =>
      item.category === activeTab &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subCategory.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handler to delete item from warehouse (Requisito 3)
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    if (onDeleteItem) {
      onDeleteItem(itemToDelete.id);
    }
    setSuccessMessage(`Ítem "${itemToDelete.name}" eliminado del inventario.`);
    setItemToDelete(null);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleApplyConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showConsumeDialog) return;
    const amountNum = parseFloat(consumeAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    onConsumeItem(showConsumeDialog.id, amountNum, consumeTarget);
    setSuccessMessage(`Se descontaron ${amountNum} ${showConsumeDialog.unit} de ${showConsumeDialog.name} e imputaron a ${consumeTarget}.`);
    setShowConsumeDialog(null);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;

    const created: WarehouseItem = {
      id: 'wh-' + Date.now(),
      name: newItemName,
      category: activeTab,
      subCategory: newItemSubCategory || 'Insumo Pecuario',
      quantity: parseFloat(newItemQty) || 0,
      unit: newItemUnit,
      unitCostUsd: parseFloat(newItemCost) || 0,
      minAlertThreshold: Math.round((parseFloat(newItemMonthly) || 50) * 1.5),
      monthlyConsumptionRate: parseFloat(newItemMonthly) || 50,
    };

    onAddItem(created);
    setShowNewItemModal(false);
    setNewItemName('');
    setSuccessMessage(`Nuevo ítem "${created.name}" registrado en Almacén.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

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
                {items.filter((i) => i.category === 'alimentos').length}
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
                {items.filter((i) => i.category === 'medicinas').length}
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
                {items.filter((i) => i.category === 'otros').length}
              </span>
            </button>
          </div>

          <button
            onClick={() => setShowNewItemModal(true)}
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
              // Cálculo de 2 meses de stock (60 días):
              // Cobertura en meses = cantidad / consumo mensual
              const monthsOfStock =
                item.monthlyConsumptionRate > 0
                  ? item.quantity / item.monthlyConsumptionRate
                  : 99;
              const isUnderTwoMonths = monthsOfStock < 2.0;

              // Cálculo de sacos de 40kg (Requisito 3)
              const isFoodOrWeight =
                item.category === 'alimentos' || item.unit === 'kg' || item.unit === 'bultos (40kg)';
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
                        (Cobertura: ~{monthsOfStock.toFixed(1)} meses)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowConsumeDialog(item)}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Descontar consumo y cargarlo al animal/lote"
                      >
                        <MinusCircle className="w-3.5 h-3.5" /> Consumir
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar insumo del inventario (Requisito 3)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                Ítem: <strong className="text-slate-800">{showConsumeDialog.name}</strong> ({showConsumeDialog.unit})
              </p>

              <form onSubmit={handleApplyConsumption} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Cantidad a Descontar ({showConsumeDialog.unit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={consumeAmount}
                    onChange={(e) => setConsumeAmount(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Destino / Lote / Código de Animal:
                  </label>
                  <input
                    type="text"
                    value={consumeTarget}
                    onChange={(e) => setConsumeTarget(e.target.value)}
                    required
                    placeholder="Ej: Cerda CER-104 o Lote Engorde 12"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
                  Este consumo se descontará automáticamente del stock y se imputará al costo acumulado del animal para el balance financiero.
                </div>

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
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs cursor-pointer"
                  >
                    Confirmar Deducción
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
                      required
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Unidad de Medida:</label>
                    <select
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value as any)}
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
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700">Consumo Mensual:</label>
                    <input
                      type="number"
                      value={newItemMonthly}
                      onChange={(e) => setNewItemMonthly(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

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
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold"
                  >
                    Guardar Ítem
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
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
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
