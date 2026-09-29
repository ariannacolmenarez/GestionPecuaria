import { Request, Response } from 'express';
import { financialService } from '../services/financialService';
import { RubroType } from '../types';

export const financialController = {
  async getMovements(req: Request, res: Response) {
    try {
      const rubro = req.query.rubro as RubroType | undefined;
      const type = req.query.type as 'ingreso' | 'egreso' | undefined;
      const month = req.query.month as string | undefined;
      const movements = await financialService.getMovements({ rubro, type, month });
      res.json({ success: true, data: movements });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createMovement(req: Request, res: Response) {
    try {
      const movement = await financialService.createMovement(req.body);
      res.status(201).json({ success: true, data: movement });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async getBalance(req: Request, res: Response) {
    try {
      const mode = (req.query.mode as 'mes' | 'año') || 'mes';
      const month = req.query.month ? parseInt(req.query.month as string, 10) : 8;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : 2026;
      const rubro = req.query.rubro as RubroType | undefined;
      const balance = await financialService.getBalance({ mode, month, year, rubro });
      res.json({ success: true, data: balance });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
