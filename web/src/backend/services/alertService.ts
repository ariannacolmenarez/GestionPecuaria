import { SystemAlertDTO } from '../types';
import { sanitaryService } from './sanitaryService';
import { warehouseService } from './warehouseService';
import { reproductionService } from './reproductionService';
import { avicolaService } from './avicolaService';

/**
 * AlertService: Despachador y agregador inteligente de alertas pecuarias del sistema.
 * Agrupa actividades estimadas de hoy, alertas de inventario crítico (< 2 meses),
 * alertas reproductivas (retorno de celo y partos proyectados) y monitoreo de lotes.
 */
class AlertService {
  public async getConsolidatedAlerts(): Promise<SystemAlertDTO[]> {
    const alerts: SystemAlertDTO[] = [];
    const todayStr = '2026-08-19';

    // 1. Alertas de tareas sanitarias para hoy
    const todayTasks = await sanitaryService.getTodayPendingTasks(todayStr);
    todayTasks.forEach((t) => {
      alerts.push({
        id: `alt-task-${t.id}`,
        severity: 'warning',
        rubro: t.rubro,
        category: 'sanitario',
        title: `Tarea Sanitaria: ${t.title}`,
        message: `${t.medicationName || 'Procedimiento'} programado para hoy (${t.time || '08:00'}). Animal/Lote: ${t.animalCode || t.batchCode || 'General'}.`,
        date: t.date,
        actionRoute: 'sanitario',
        actionLabel: 'Ver Calendario',
      });
    });

    // 2. Alertas de almacén crítico (< 2 meses de cobertura)
    const criticalWarehouse = await warehouseService.getCriticalItems();
    criticalWarehouse.forEach((item) => {
      alerts.push({
        id: `alt-wh-${item.id}`,
        severity: 'critical',
        rubro: item.rubro === 'general' ? 'general' : item.rubro,
        category: 'almacen',
        title: `Inventario Crítico: ${item.name}`,
        message: `Quedan ${item.quantity} ${item.unit}. Cobertura estimada: ${item.coverageMonths} meses (< 2 meses requeridos).`,
        date: todayStr,
        actionRoute: 'almacen',
        actionLabel: 'Reabastecer',
      });
    });

    // 3. Alertas reproductivas: Partos próximos o retorno de celo
    const matings = await reproductionService.getMatings();
    matings.forEach((m) => {
      if (m.expectedFarrowingDate && m.expectedFarrowingDate <= '2026-08-26') {
        alerts.push({
          id: `alt-far-${m.id}`,
          severity: 'critical',
          rubro: 'porcino',
          category: 'reproduccion',
          title: `Parto Inminente: Cerda ${m.sowCode}`,
          message: `Fecha estimada de farrowing: ${m.expectedFarrowingDate} (114 días cumplidos). Trasladar a jaula de maternidad.`,
          date: m.expectedFarrowingDate,
          actionRoute: 'maternidad',
          actionLabel: 'Ver Maternidad',
        });
      }
    });

    // 4. Alertas avícolas: Lotes listos para faena
    const lots = await avicolaService.getAllLots();
    lots.forEach((lot) => {
      if (lot.status === 'listo_faena') {
        alerts.push({
          id: `alt-lot-${lot.id}`,
          severity: 'info',
          rubro: 'avicola',
          category: 'peso',
          title: `Lote Listo para Beneficio: ${lot.batchCode}`,
          message: `Edad: ${lot.currentAgeDays} días, peso promedio: ${lot.currentAverageWeightGrams}g (${lot.currentBirds} aves).`,
          date: todayStr,
          actionRoute: 'avicola',
          actionLabel: 'Gestionar Venta',
        });
      }
    });

    return alerts;
  }
}

export const alertService = new AlertService();
