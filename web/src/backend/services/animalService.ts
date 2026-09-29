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
    const seedData: AnimalDTO[] = [
      {
        id: 'p-cer-101',
        code: 'CER-101',
        name: 'Duquesa (L3)',
        rubro: 'porcino',
        category: 'maternidad',
        breed: 'Landrace x Large White',
        birthDate: '2024-03-12',
        currentWeightKg: 215,
        healthStatus: 'Optimo',
        stage: 'Lactante (Día 18)',
        penLocation: 'Maternidad 04',
        provenance: 'Granja San Antonio',
        admissionDate: '2024-03-12',
        admissionWeightKg: 1.4,
        admissionPriceUsd: 45,
        accumulatedCostUsd: 380.5,
        photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
      },
      {
        id: 'p-cer-104',
        code: 'CER-104',
        name: 'Princesa F1',
        rubro: 'porcino',
        category: 'maternidad',
        breed: 'F1 Camborough',
        birthDate: '2024-05-20',
        currentWeightKg: 198,
        healthStatus: 'Optimo',
        stage: 'Gestante (Día 98)',
        penLocation: 'Gestación 02',
        provenance: 'Genética PIC',
        admissionDate: '2024-05-20',
        admissionWeightKg: 1.3,
        admissionPriceUsd: 55,
        accumulatedCostUsd: 340.0,
        photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
      },
      {
        id: 'p-ver-001',
        code: 'VER-001',
        name: 'Thor Pietrain',
        rubro: 'porcino',
        category: 'verracos',
        breed: 'Pietrain Puro Alemán',
        birthDate: '2023-11-05',
        currentWeightKg: 245,
        healthStatus: 'Optimo',
        stage: 'Activo / Colecta Seminal',
        penLocation: 'Verraco 01',
        provenance: 'Cabaña El Roble',
        admissionDate: '2024-01-15',
        admissionWeightKg: 65,
        admissionPriceUsd: 420,
        accumulatedCostUsd: 680.0,
        photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
      },
      {
        id: 'p-ver-002',
        code: 'VER-002',
        name: 'Titan Duroc',
        rubro: 'porcino',
        category: 'verracos',
        breed: 'Duroc Jersey Línea Terminal',
        birthDate: '2024-01-18',
        currentWeightKg: 230,
        healthStatus: 'Optimo',
        stage: 'Activo / Monta Natural',
        penLocation: 'Verraco 02',
        provenance: 'Genética Porcina del Norte',
        admissionDate: '2024-03-10',
        admissionWeightKg: 50,
        admissionPriceUsd: 390,
        accumulatedCostUsd: 540.0,
        photoUrl: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=400&auto=format&fit=crop&q=80',
      },
      {
        id: 'p-eng-001',
        code: 'ENG-LOT-01',
        name: 'Lote Engorde Julio-Ceba',
        rubro: 'porcino',
        category: 'engorde',
        breed: 'Híbrido F1 x Pietrain',
        birthDate: '2026-04-10',
        currentWeightKg: 85.5,
        healthStatus: 'Optimo',
        stage: 'Engorde Fase 2',
        penLocation: 'Galpón Engorde 1',
        provenance: 'Nacidos en Granja',
        batchAnimalCount: 45,
        accumulatedCostUsd: 3200.0,
      }
    ];

    seedData.forEach((animal) => this.inMemoryAnimals.set(animal.id, animal));
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
    const id = `anim_${Date.now()}_${dto.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
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
