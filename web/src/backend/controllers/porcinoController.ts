import { Request, Response } from 'express';
import { PorcinoCounterModel } from '../models/porcinoCounterModel';
import { animalService } from '../services/animalService';
import { porcinoService } from '../services/porcinoService';

export const porcinoController = {
  /**
   * Obtiene los contadores de la sección de gestión porcina calculados en tiempo real
   * garantizando concordancia matemática con los registros de la base de datos.
   */
  async getCounters(req: Request, res: Response) {
    try {
      const animals = await animalService.getAllAnimals('porcino');
      // Sin camadas de ejemplo: el backend en memoria no persiste camadas; se calculan solo con los animales reales.
      const litters: any[] = [];

      const counters = PorcinoCounterModel.calculate(animals, litters);
      res.json({
        success: true,
        data: counters,
        message: 'Contadores porcinos calculados con éxito concordando con los registros.',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Recalcula los contadores y devuelve el informe de censo por corral
   */
  async getCensusAudit(req: Request, res: Response) {
    try {
      const animals = await animalService.getAllAnimals('porcino');
      const groupedByPen: Record<string, any[]> = {};

      animals.forEach((a) => {
        const pen = a.penLocation || 'Sin Corral';
        if (!groupedByPen[pen]) groupedByPen[pen] = [];
        groupedByPen[pen].push({
          code: a.code,
          name: a.name || a.code,
          category: a.category,
          stage: a.stage,
          count: a.batchAnimalCount || 1,
          weightKg: a.currentWeightKg,
          healthStatus: a.healthStatus,
        });
      });

      res.json({
        success: true,
        data: {
          totalAnimalsRegistered: animals.length,
          pensCount: Object.keys(groupedByPen).length,
          census: groupedByPen,
        },
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Registra o sincroniza un nuevo animal porcino actualizando los contadores
   */
  async registerAnimal(req: Request, res: Response) {
    try {
      const created = await animalService.createAnimal({
        ...req.body,
        rubro: 'porcino',
      });
      res.status(201).json({
        success: true,
        data: created,
        message: 'Animal registrado y contadores actualizados en la base de datos.',
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Métricas y cálculos del módulo de Engorde (GDP, FCR, lotes, peso promedio)
   */
  async getEngordeMetrics(_req: Request, res: Response) {
    try {
      const metrics = await porcinoService.getEngordeMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Métricas y cálculos del módulo de Maternidad (LNV, fertilidad, pezones)
   */
  async getMaternidadMetrics(_req: Request, res: Response) {
    try {
      const metrics = await porcinoService.getMaternidadMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Métricas y cálculos del módulo de Verracos (montas, efectividad, descanso)
   */
  async getVerracosMetrics(_req: Request, res: Response) {
    try {
      const metrics = await porcinoService.getVerracosMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Métricas y cálculos del módulo de Lechones (camadas activas, mortalidad)
   */
  async getLechonesMetrics(_req: Request, res: Response) {
    try {
      const metrics = await porcinoService.getLechonesMetrics();
      res.json({ success: true, data: metrics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Conciliación matemática de movimientos del rebaño
   */
  async getMovementsLedger(_req: Request, res: Response) {
    try {
      const ledger = await porcinoService.getMovementsLedger();
      res.json({ success: true, data: ledger });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Planes nutricionales por tipo de producción
   */
  async getFeedingPlans(req: Request, res: Response) {
    try {
      const type = req.query.type as string | undefined;
      const plans = await porcinoService.getFeedingPlans(type);
      res.json({ success: true, data: plans });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Actualiza los planes nutricionales
   */
  async updateFeedingPlans(req: Request, res: Response) {
    try {
      const updated = await porcinoService.updateFeedingPlans(req.body);
      res.json({ success: true, data: updated, message: 'Planes nutricionales actualizados exitosamente.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * Calculadora de bultos por lote
   */
  async calculateFeedingBatch(req: Request, res: Response) {
    try {
      const { sowsInGestation = 30, sowsInLactation = 12, pigsInEngorde = 140, engordeKgPerDay = 2.2 } = req.body;
      const result = porcinoService.calculateFeedingBatch({
        sowsInGestation: Number(sowsInGestation),
        sowsInLactation: Number(sowsInLactation),
        pigsInEngorde: Number(pigsInEngorde),
        engordeKgPerDay: Number(engordeKgPerDay),
      });
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
