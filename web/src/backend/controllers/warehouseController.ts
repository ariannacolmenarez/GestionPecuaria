import { Request, Response } from 'express';
import { warehouseService } from '../services/warehouseService';
import { RubroType } from '../types';

export const warehouseController = {
  async getItems(req: Request, res: Response) {
    try {
      const rubro = req.query.rubro as RubroType | undefined;
      const items = await warehouseService.getItems(rubro);
      res.json({ success: true, data: items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getCritical(req: Request, res: Response) {
    try {
      const items = await warehouseService.getCriticalItems();
      res.json({ success: true, data: items });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async recordMovement(req: Request, res: Response) {
    try {
      const result = await warehouseService.recordMovement(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async createItem(req: Request, res: Response) {
    try {
      const item = await warehouseService.createItem(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
