import { todayISO } from '../../utils/dates';
import { newId } from '../../utils/ids';
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
    // Sin datos de ejemplo: el servicio arranca vacío y solo contiene lo que registre el usuario.
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

  public async getTodayPendingTasks(todayDate: string = todayISO()): Promise<SanitaryTaskDTO[]> {
    return this.getTasks({ status: 'pendiente', date: todayDate });
  }

  public async createTask(dto: Omit<SanitaryTaskDTO, 'id'>): Promise<SanitaryTaskDTO> {
    const id = newId('st');
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
        id: newId(`st-gen-${params.batchCode}-${p.offsetDays}`),
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
        responsible: 'Médico veterinario',
        costUsd: Math.round(p.cost * params.animalCount * 100) / 100,
        notes: `Actividad generada automáticamente para lote ${params.batchCode} en día de vida ${p.offsetDays}.`,
      };
    });
  }
}

export const sanitaryService = new SanitaryService();
