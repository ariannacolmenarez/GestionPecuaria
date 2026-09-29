/**
 * ============================================================================
 * CAPA CONTROLADOR (CONTROLLER) - CONTROLADOR SANITARIO Y VETERINARIO
 * ============================================================================
 * Maneja:
 * - Filtrado y planificación de actividades sanitarias por fecha y estado
 * - Marcar tareas como completadas o pendientes
 * - Generación de tareas automáticas por protocolo de lotes
 */

import { SanitaryTask } from '../models/FarmModel';

export const SanitaryController = {
  /**
   * Obtiene las tareas pendientes estimadas para la fecha dada
   */
  getPendingTasksForDate(tasks: SanitaryTask[], date: string): SanitaryTask[] {
    return tasks.filter((t) => t.date === date && t.status === 'pendiente');
  },

  /**
   * Conmuta el estado de una tarea entre completada y pendiente
   */
  toggleStatus(tasks: SanitaryTask[], taskId: string): SanitaryTask[] {
    return tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: t.status === 'completada' ? 'pendiente' : 'completada' }
        : t
    );
  },

  /**
   * Agrega una nueva actividad sanitaria al calendario
   */
  addTask(tasks: SanitaryTask[], newTask: SanitaryTask): SanitaryTask[] {
    return [newTask, ...tasks];
  },
};
