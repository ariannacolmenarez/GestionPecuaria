import { newId } from '../../utils/ids';
import { AnimalDTO, CreateAnimalDTO, RubroType } from '../types';

/**
 * AnimalService: Gestión integral y modular de animales y lotes pecuarios.
 * Maneja operaciones CRUD, categorización, cálculo de ganancias de peso y estado sanitario.
 */
class AnimalService {
  private inMemoryAnimals: Map<string, AnimalDTO> = new Map();

  constructor() {
    this.seedInitialAnimals();
  }

  private seedInitialAnimals() {
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
  }

  public async getAllAnimals(rubro?: RubroType, category?: string): Promise<AnimalDTO[]> {
    let list = Array.from(this.inMemoryAnimals.values());
    if (rubro) {
      list = list.filter((a) => a.rubro === rubro);
    }
    if (category) {
      list = list.filter((a) => a.category.toLowerCase() === category.toLowerCase());
    }
    return list;
  }

  public async getAnimalById(id: string): Promise<AnimalDTO | null> {
    return this.inMemoryAnimals.get(id) || null;
  }

  public async getAnimalByCode(code: string): Promise<AnimalDTO | null> {
    const animals = Array.from(this.inMemoryAnimals.values());
    return animals.find((a) => a.code.toUpperCase() === code.toUpperCase()) || null;
  }

  public async createAnimal(dto: CreateAnimalDTO): Promise<AnimalDTO> {
    const id = newId('anim');
    const newAnimal: AnimalDTO = {
      ...dto,
      id,
      healthStatus: dto.healthStatus || 'Optimo',
      stage: dto.stage || 'Ingreso Reciente',
      accumulatedCostUsd: dto.admissionPriceUsd || 0,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryAnimals.set(id, newAnimal);
    return newAnimal;
  }

  public async updateAnimal(id: string, partial: Partial<AnimalDTO>): Promise<AnimalDTO> {
    const existing = this.inMemoryAnimals.get(id);
    if (!existing) {
      throw new Error(`Animal with ID ${id} not found.`);
    }
    const updated: AnimalDTO = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryAnimals.set(id, updated);
    return updated;
  }

  public async deleteAnimal(id: string): Promise<boolean> {
    return this.inMemoryAnimals.delete(id);
  }

  public async getCategoryCounts(rubro: RubroType): Promise<Record<string, number>> {
    const animals = await this.getAllAnimals(rubro);
    const counts: Record<string, number> = {};
    for (const a of animals) {
      const cat = a.category;
      const count = a.batchAnimalCount ? a.batchAnimalCount : 1;
      counts[cat] = (counts[cat] || 0) + count;
    }
    return counts;
  }
}

export const animalService = new AnimalService();
