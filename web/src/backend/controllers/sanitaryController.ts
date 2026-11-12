import { todayISO } from '../../utils/dates';
import { Request, Response } from 'express';
import { sanitaryService } from '../services/sanitaryService';
import { RubroType } from '../types';

export const sanitaryController = {
  async getTasks(req: Request, res: Response) {
    try {
      const rubro = req.query.rubro as RubroType | undefined;
      const status = req.query.status as any;
      const date = req.query.date as string | undefined;
      const tasks = await sanitaryService.getTasks({ rubro, status, date });
      res.json({ success: true, data: tasks });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTodayPending(req: Request, res: Response) {
    try {
      const date = (req.query.date as string) || todayISO();
      const tasks = await sanitaryService.getTodayPendingTasks(date);
      res.json({ success: true, data: tasks });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createTask(req: Request, res: Response) {
    try {
      const created = await sanitaryService.createTask(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status, completedBy } = req.body;
      const updated = await sanitaryService.updateTaskStatus(req.params.id, status, completedBy);
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async generateBatchProtocol(req: Request, res: Response) {
    try {
      const { batchCode, startDateStr, animalCount } = req.body;
      const tasks = sanitaryService.generateBatchProtocol({ batchCode, startDateStr, animalCount });
      res.json({ success: true, data: tasks });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
