import { Request, Response } from 'express';
import { salesSlaughterService } from '../services/salesSlaughterService';

export const salesSlaughterController = {
  async getAll(req: Request, res: Response) {
    try {
      const sales = await salesSlaughterService.getAllSales();
      res.json({ success: true, data: sales });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async recordSaleOrSlaughter(req: Request, res: Response) {
    try {
      const recorded = await salesSlaughterService.recordSaleOrSlaughter(req.body);
      res.status(201).json({ success: true, data: recorded });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
