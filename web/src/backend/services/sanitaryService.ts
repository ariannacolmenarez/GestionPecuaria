import { SanitaryTaskDTO, RubroType } from '../types';

/**
 * SanitaryService: Módulo modular de bioseguridad, tratamientos y calendario sanitario pecuario.
 * Gestiona tareas veterinarias, tiempos de retiro en carne/leche, dosificaciones y control de costos.
 */
class SanitaryService {
  private tasks: Map<string, SanitaryTaskDTO> = new Map();

  constructor() {
    this.seedSanitaryTasks();
  }

  private seedSanitaryTasks() {
    const seedTasks: SanitaryTaskDTO[] = [
      {
        id: 'st-001',
        rubro: 'porcino',
        title: 'Hierro Dextrano + Coccidiostato',
        animalCode: 'CAM-101',
        animalCategory: 'lechones',
        date: '2026-08-19',
        time: '08:00',
        status: 'pendiente',
        category: 'suplemento',
        medicationName: 'Gleptosil 200mg + Toltrazuril 5%',
        dosage: '1.0 ml IM + 1.0 ml oral',
        administrationRoute: 'Intramuscular',
        withdrawalDays: 0,
        responsible: 'Dr. Roberto Salas (Vet)',
        costUsd: 14.5,
        notes: 'Aplicar a lechones de la camada CER-101 en el día 3 de vida.',
      },
      {
        id: 'st-002',
        rubro: 'porcino',
        title: 'Vacuna Micoplasma & Circo (PCV2)',
        animalCode: 'CAM-098',
        animalCategory: 'lechones',
        date: '2026-08-19',
        time: '10:30',
        status: 'pendiente',
        category: 'vacunacion',
        medicationName: 'Suvaxyn Circo+Myco',
        dosage: '2.0 ml IM profunda',
        administrationRoute: 'Intramuscular',
        withdrawalDays: 21,
        responsible: 'Dr. Roberto Salas (Vet)',
        costUsd: 28.0,
        notes: 'Primo-vacunación a los 21 días post-parto en lechones de transición.',
      },
      {
        id: 'st-003',
        rubro: 'porcino',
        title: 'Desparasitación Interna y Externa',
        animalCode: 'VER-001',
        animalCategory: 'verracos',
        date: '2026-08-22',
        time: '09:00',
        status: 'pendiente',
        category: 'desparasitacion',
        medicationName: 'Ivermectina 1%',
        dosage: '1.0 ml por cada 33 kg',
        administrationRoute: 'Subcutánea',
        withdrawalDays: 28,
        responsible: 'Dr. Roberto Salas (Vet)',
        costUsd: 8.5,
        notes: 'Dosis semestral preventiva para sarna y parásitos gastrointestinales.',
      },
      {
        id: 'st-004',
        rubro: 'bovino',
        title: 'Vacunación Fiebre Aftosa y Rabia',
        animalCategory: 'vacas',
        date: '2026-08-25',
        status: 'pendiente',
        category: 'vacunacion',
        medicationName: 'Aftogan Bivalente',
        dosage: '2.0 ml SC',
        administrationRoute: 'Subcutánea',
        withdrawalDays: 15,
        responsible: 'Dra. Elena Ramos',
        costUsd: 65.0,
      },
      {
        id: 'st-005',
        rubro: 'avicola',
        title: 'Vacuna Newcastle + Gumboro en Agua',
        batchCode: 'LOTE-ENG-04',
        date: '2026-08-20',
        status: 'pendiente',
        category: 'vacunacion',
        medicationName: 'Avinew NeO + Bursine 2',
        dosage: '1000 dosis en 40L agua potable',
        administrationRoute: 'En agua',
        withdrawalDays: 0,
        responsible: 'Carlos Meza (Técnico Avícola)',
        costUsd: 18.0,
      }
    ];

    seedTasks.forEach((t) => this.tasks.set(t.id, t));
  }

  public async getTasks(filters?: {
    rubro?: RubroType;
    status?: 'pendiente' | 'completada' | 'cancelada';
    date?: string;
  }): Promise<SanitaryTaskDTO[]> {
    let list = Array.from(this.tasks.values());
    if (filters?.rubro) {
      list = list.filter((t) => t.rubro === filters.rubro);
    }
    if (filters?.status) {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters?.date) {
      list = list.filter((t) => t.date === filters.date);
    }
    return list;
  }

  public async getTodayPendingTasks(todayDate: string = '2026-08-19'): Promise<SanitaryTaskDTO[]> {
    return this.getTasks({ status: 'pendiente', date: todayDate });
  }

  public async createTask(dto: Omit<SanitaryTaskDTO, 'id'>): Promise<SanitaryTaskDTO> {
    const id = `st_${Date.now()}`;
    const newTask: SanitaryTaskDTO = {
      ...dto,
      id,
    };
    this.tasks.set(id, newTask);
    return newTask;
  }

  public async updateTaskStatus(
    id: string,
    status: 'pendiente' | 'completada' | 'cancelada',
    completedBy?: string
  ): Promise<SanitaryTaskDTO> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Sanitary task ${id} not found.`);
    }

    const completedAt = status === 'completada' ? new Date().toISOString() : undefined;
    const updated: SanitaryTaskDTO = {
      ...task,
      status,
      completedAt,
      completedBy: completedBy || task.completedBy,
    };
    this.tasks.set(id, updated);
    return updated;
  }

  /**
   * Genera el plan profiláctico automático para un nuevo lote porcino según días transcurridos
   */
  public generateBatchProtocol(params: {
    batchCode: string;
    startDateStr: string;
    animalCount: number;
  }): SanitaryTaskDTO[] {
    const startDate = new Date(params.startDateStr);

    const protocolTemplates = [
      { offsetDays: 3, title: 'Hierro Dextrano + Coccidiostato', cat: 'suplemento' as const, med: 'Gleptosil + Toltrazuril', route: 'Intramuscular' as const, cost: 0.95 },
      { offsetDays: 7, title: 'Refuerzo Complejo B + Selenio', cat: 'suplemento' as const, med: 'Complejo B12', route: 'Oral' as const, cost: 0.40 },
      { offsetDays: 14, title: 'Primo-vacunación Micoplasma Hyopneumoniae', cat: 'vacunacion' as const, med: 'M+Pac', route: 'Intramuscular' as const, cost: 1.20 },
      { offsetDays: 21, title: 'Vacuna Circo (PCV2) Pre-destete', cat: 'vacunacion' as const, med: 'Circumvent PCV', route: 'Intramuscular' as const, cost: 1.50 },
      { offsetDays: 28, title: 'Destete & Desparasitación Interna', cat: 'desparasitacion' as const, med: 'Levamisol 10%', route: 'En agua' as const, cost: 0.65 },
      { offsetDays: 60, title: 'Refuerzo Peste Porcina Clásica (PPC)', cat: 'vacunacion' as const, med: 'Cepa China Apatógena', route: 'Intramuscular' as const, cost: 1.10 },
    ];

    return protocolTemplates.map((p) => {
      const taskDate = new Date(startDate);
      taskDate.setDate(taskDate.getDate() + p.offsetDays);
      const dateStr = taskDate.toISOString().split('T')[0];

      return {
        id: `st-gen-${params.batchCode}-${p.offsetDays}-${Date.now()}`,
        rubro: 'porcino',
        title: `${p.title} (${params.batchCode})`,
        batchCode: params.batchCode,
        animalCategory: 'engorde',
        date: dateStr,
        time: '08:30',
        status: 'pendiente',
        category: p.cat,
        medicationName: p.med,
        dosage: 'Según peso vivo de lote',
        administrationRoute: p.route,
        withdrawalDays: 15,
        responsible: 'Dr. Roberto Salas (Vet)',
        costUsd: Math.round(p.cost * params.animalCount * 100) / 100,
        notes: `Actividad generada automáticamente para lote ${params.batchCode} en día de vida ${p.offsetDays}.`,
      };
    });
  }
}

export const sanitaryService = new SanitaryService();
