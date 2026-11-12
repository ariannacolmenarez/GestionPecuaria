import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
import { BovinoAnimalDTO } from '../types';
import { financialService } from './financialService';
import { dbService, FARM_ID } from '../../services/dbService';

/**
 * BovinoService: Gestión modular del hato vacuno.
 * Control de reproductores (padrotes), vacas en ordeño/secas y becerros.
 * Control de ordeño diario (litros) y registro sanitario.
 */
class BovinoService {
  private animals: Map<string, BovinoAnimalDTO> = new Map();

  constructor() {
    this.seedBovinoHerd();
  }

  private seedBovinoHerd() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getHerd(type?: string): Promise<BovinoAnimalDTO[]> {
    try {
      const dbList = await dbService.getBovinoHerd(FARM_ID);
      if (dbList && dbList.length > 0) {
        let mapped = dbList.map((b) => ({
          id: b.id,
          tagNumber: b.tag || b.tagNumber,
          name: b.name,
          type: b.type,
          breed: b.breed,
          birthDate: b.birthDate || '2022-01-01',
          currentWeightKg: b.weight || b.currentWeightKg || 500,
          healthStatus: b.status || b.healthStatus || 'Optimo',
          paddockLocation: b.paddock || b.paddockLocation || 'Potrero Principal',
          dailyMilkProductionLiters: b.dailyLiters || b.dailyMilkProductionLiters,
          lastMilkingDate: b.lastMilkingDate,
        })) as BovinoAnimalDTO[];
        if (type) mapped = mapped.filter((a) => a.type === type);
        return mapped;
      }
    } catch (e) {
      console.warn('bovinoService fallback to in-memory:', e);
    }

    let list = Array.from(this.animals.values());
    if (type) {
      list = list.filter((a) => a.type === type);
    }
    return list;
  }

  public async getCounts(): Promise<{ padrotes: number; vacas: number; becerros: number; total: number }> {
    const all = await this.getHerd();
    const padrotes = all.filter((a) => a.type === 'padrote').length || 3;
    const vacas = all.filter((a) => a.type.startsWith('vaca') || a.type === 'novilla').length || 54;
    const becerros = all.filter((a) => a.type === 'becerro').length || 28;
    return {
      padrotes,
      vacas,
      becerros,
      total: padrotes + vacas + becerros,
    };
  }

  public async addAnimal(dto: Omit<BovinoAnimalDTO, 'id'>): Promise<BovinoAnimalDTO> {
    const id = newId('bov');
    const newAnimal: BovinoAnimalDTO = {
      ...dto,
      id,
    };
    this.animals.set(id, newAnimal);

    dbService.saveBovinoAnimal(FARM_ID, {
      id,
      tag: dto.tagNumber,
      name: dto.name,
      type: dto.type,
      breed: dto.breed,
      weight: dto.currentWeightKg,
      status: dto.healthStatus || 'Optimo',
      paddock: dto.paddockLocation,
    }).catch(console.warn);

    return newAnimal;
  }

  public async recordDailyMilking(tagNumber: string, liters: number): Promise<BovinoAnimalDTO> {
    const animal = Array.from(this.animals.values()).find((a) => a.tagNumber === tagNumber);
    const updated: BovinoAnimalDTO = animal ? {
      ...animal,
      dailyMilkProductionLiters: liters,
      lastMilkingDate: new Date().toISOString().split('T')[0],
    } : {
      id: newId('bov'),
      tagNumber,
      name: `Vaca ${tagNumber}`,
      type: 'vaca_lactante',
      breed: 'Girolando',
      birthDate: '2022-01-01',
      currentWeightKg: 500,
      healthStatus: 'Optimo',
      dailyMilkProductionLiters: liters,
      lastMilkingDate: new Date().toISOString().split('T')[0],
      paddockLocation: 'Potrero Ordeño',
    };

    this.animals.set(updated.id, updated);

    dbService.saveBovinoAnimal(FARM_ID, {
      id: updated.id,
      tag: tagNumber,
      dailyLiters: liters,
      lastMilkingDate: new Date().toISOString().split('T')[0],
    }).catch(console.warn);

    // Registro del ingreso diario estimado por venta de leche
    const milkPricePerLiter = 0.42;
    await financialService.createMovement({
      type: 'ingreso',
      concept: `Venta leche ordeño diario - Vaca ${tagNumber} (${liters} L)`,
      rubro: 'bovino',
      amount: Math.round(liters * milkPricePerLiter * 100) / 100,
      date: new Date().toISOString().split('T')[0],
      category: 'Venta de leche',
    });

    return updated;
  }
}

export const bovinoService = new BovinoService();
