import React, { useState } from 'react';
import {
  X,
  Plus,
  Milk,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  Scale,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { FinancialMovement, BovinoAnimal } from '../../types';
import { calculateBovinoCounters } from '../../models/PorcinoCalculations';
import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';

interface BovinoModalProps {
  onClose: () => void;
  herd?: BovinoAnimal[];
  onAddAnimal?: (animal: any) => void;
  onRecordMilking?: (tag: string, liters: number, pricePerLiter: number, date: string) => void;
  onAddFinancialMovement?: (movement: FinancialMovement) => void;
  onShowToast?: (msg: string) => void;
}

export const BovinoModal: React.FC<BovinoModalProps> = ({
  onClose,
  herd: externalHerd,
  onAddAnimal,
  onRecordMilking,
  onAddFinancialMovement,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'hato' | 'ordeno' | 'nuevo'>('hato');
  // Sin datos de ejemplo: el hato real llega por props (Firestore); local solo como respaldo sin controlador.
  const [localHerd, setLocalHerd] = useState<any[]>([]);

  const herd: any[] = externalHerd ?? localHerd;
  const bovCounters = calculateBovinoCounters(herd);

  // Form states
  const [selectedCowTag, setSelectedCowTag] = useState('BOV-101');
  const [milkingLiters, setMilkingLiters] = useState('18.5');
  const [milkingPricePerLiter, setMilkingPricePerLiter] = useState('0.42');
  const [milkingDate, setMilkingDate] = useState(todayISO());

  // New animal form
  const [newTag, setNewTag] = useState('BOV-104');
  const [newName, setNewName] = useState('Lucero');
  const [newType, setNewType] = useState('vaca_lactante');
  const [newBreed, setNewBreed] = useState('Girolando F1');
  const [newWeight, setNewWeight] = useState('480');
  const [newPaddock, setNewPaddock] = useState('Potrero Ordeño B');

  const [isSuccess, setIsSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Handle Milking record
  const handleRecordMilking = async (e: React.FormEvent) => {
    e.preventDefault();
    const liters = parseFloat(milkingLiters) || 0;
    const price = parseFloat(milkingPricePerLiter) || 0.42;
    const totalAmount = Math.round(liters * price * 100) / 100;

    if (onRecordMilking) {
      // El controlador ya registra el movimiento 'Venta de leche': no se agrega otro aquí.
      onRecordMilking(selectedCowTag, liters, price, milkingDate);
    } else {
      await apiClient.bovino.recordDailyMilking(selectedCowTag, liters);
      if (onAddFinancialMovement) {
        const movement: FinancialMovement = {
          id: newId('fm-bov-milk'),
          type: 'ingreso',
          concept: `Venta de leche ordeño: Vaca ${selectedCowTag} (${liters} Litros)`,
          rubro: 'bovino',
          amount: totalAmount,
          date: milkingDate,
          category: 'Venta de leche',
          details: `${liters} L a $${price}/L. Despacho a refrigeración.`,
        };
        onAddFinancialMovement(movement);
      }
    }

    setSuccessMsg(`Ordeño de ${liters} Litros registrado para ${selectedCowTag}. Ingreso estimado: +$${totalAmount} USD.`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('hato');
      if (onShowToast) onShowToast(`Ordeño registrado: +$${totalAmount} USD`);
    }, 1800);
  };

  // Handle Add New Cattle
  const handleAddNewAnimal = async (e: React.FormEvent) => {
    e.preventDefault();
    const weight = parseFloat(newWeight) || 450;

    const newAnimalObj = {
      id: newId('bov'),
      tag: newTag,
      name: newName,
      type: newType === 'vaca_lactante' ? 'Vaca Lactante' : newType === 'padrote' ? 'Padrote' : 'Becerro',
      breed: newBreed,
      weight,
      status: 'Optimo' as const,
      paddock: newPaddock,
    };

    if (onAddAnimal) {
      onAddAnimal(newAnimalObj);
    } else {
      await apiClient.bovino.addAnimal({
        tagNumber: newTag,
        name: newName,
        type: newType as any,
        breed: newBreed,
        birthDate: '2022-06-15',
        currentWeightKg: weight,
        healthStatus: 'Optimo',
        paddockLocation: newPaddock,
      });
    }

    setLocalHerd((prev) => [
      ...prev,
      newAnimalObj,
    ]);

    setSuccessMsg(`Bovino ${newTag} (${newName}) registrado en el hato correctamente.`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      setActiveTab('hato');
      if (onShowToast) onShowToast(`Bovino ${newTag} añadido al hato`);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg">
              🐂
            </div>
            <div>
              <h3 className="font-black text-base tracking-tight">Módulo de Gestión Bovina</h3>
              <p className="text-[11px] text-blue-100">Padrotes, Vacas de Leche y Becerros de Destete</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold px-2 pt-2 gap-1">
          <button
            onClick={() => setActiveTab('hato')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer ${
              activeTab === 'hato'
                ? 'bg-white text-blue-700 shadow-xs border-t-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hato General (85)
          </button>
          <button
            onClick={() => setActiveTab('ordeno')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'ordeno'
                ? 'bg-white text-blue-700 shadow-xs border-t-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Milk className="w-3.5 h-3.5" /> Registrar Ordeño
          </button>
          <button
            onClick={() => setActiveTab('nuevo')}
            className={`px-3 py-2 rounded-t-xl transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'nuevo'
                ? 'bg-white text-blue-700 shadow-xs border-t-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Bovino
          </button>
        </div>

        {/* Success alert */}
        {isSuccess && (
          <div className="m-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {activeTab === 'hato' && (
            <div className="space-y-3">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200/60 text-center">
                  <span className="text-[10px] text-blue-800 font-bold block">PADROTES</span>
                  <span className="text-xl font-black text-slate-900">{bovCounters.padrotes}</span>
                  <span className="text-[9px] text-blue-600 block font-medium">Toros reproductores</span>
                </div>
                <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-200/60 text-center">
                  <span className="text-[10px] text-indigo-800 font-bold block">VACAS</span>
                  <span className="text-xl font-black text-slate-900">{bovCounters.vacas}</span>
                  <span className="text-[9px] text-indigo-600 block font-medium">Ordeño & Secas</span>
                </div>
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/60 text-center">
                  <span className="text-[10px] text-emerald-800 font-bold block">BECERROS</span>
                  <span className="text-xl font-black text-slate-900">{bovCounters.becerros}</span>
                  <span className="text-[9px] text-emerald-600 block font-medium">Crías y Destete</span>
                </div>
              </div>

              {/* Animal List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Ejemplares Registrados con Caravana:</span>
                {herd.map((animal) => (
                  <div
                    key={animal.tag}
                    className="p-3 bg-slate-50 hover:bg-blue-50/40 rounded-xl border border-slate-200/80 flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{animal.tag}</span>
                        <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          {animal.type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{animal.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {animal.breed} • {animal.weight} kg • Ubicación: {animal.paddock}
                      </p>
                    </div>
                    <div className="text-right">
                      {animal.dailyLiters ? (
                        <span className="font-bold text-blue-700 text-xs flex items-center justify-end gap-1">
                          <Milk className="w-3.5 h-3.5" /> {animal.dailyLiters} L/día
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">Reposo</span>
                      )}
                      <span className="text-[10px] text-emerald-700 font-bold block">{animal.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ordeno' && (
            <form onSubmit={handleRecordMilking} className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                <p className="font-bold flex items-center gap-1.5">
                  <Milk className="w-4 h-4 text-blue-600" /> Registro de Producción Lechera
                </p>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Registra los litros obtenidos en el ordeño matutino/vespertino. El importe se sincronizará automáticamente en el balance financiero de la finca.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Vaca Ordeñada:</label>
                <select
                  value={selectedCowTag}
                  onChange={(e) => setSelectedCowTag(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-xs"
                >
                  <option value="BOV-101">BOV-101 - Mariposa (Girolando F1)</option>
                  <option value="BOV-102">BOV-102 - Paloma (Holstein x Brahman)</option>
                  <option value="BOV-103">BOV-103 - Esmeralda (Lactancia iniciada)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Litros Producidos (L):</label>
                  <input
                    type="number"
                    step="0.5"
                    value={milkingLiters}
                    onChange={(e) => setMilkingLiters(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Precio por Litro (USD):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={milkingPricePerLiter}
                    onChange={(e) => setMilkingPricePerLiter(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha de Ordeño:</label>
                <input
                  type="date"
                  value={milkingDate}
                  onChange={(e) => setMilkingDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                  required
                />
              </div>

              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Total Ingreso Calculado:</span>
                <span className="font-black text-blue-700 text-sm">
                  ${((parseFloat(milkingLiters) || 0) * (parseFloat(milkingPricePerLiter) || 0.42)).toFixed(2)} USD
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar y Guardar Ordeño
              </button>
            </form>
          )}

          {activeTab === 'nuevo' && (
            <form onSubmit={handleAddNewAnimal} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Número de Caravana:</label>
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre o Apodo:</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Categoría:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                  >
                    <option value="vaca_lactante">Vaca Lactante</option>
                    <option value="vaca_seca">Vaca Seca / Gestante</option>
                    <option value="padrote">Toro Padrote</option>
                    <option value="becerro">Becerro Destete</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Raza / Cruce:</label>
                  <input
                    type="text"
                    value={newBreed}
                    onChange={(e) => setNewBreed(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Peso Actual (kg):</label>
                  <input
                    type="number"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Potrero Asignado:</label>
                  <input
                    type="text"
                    value={newPaddock}
                    onChange={(e) => setNewPaddock(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-xs"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <Plus className="w-4 h-4" /> Agregar Ejemplar al Hato
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
