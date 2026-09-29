import { Request, Response } from 'express';
import { bovinoService } from '../services/bovinoService';

export const bovinoController = {
  async getHerd(req: Request, res: Response) {
    try {
      const type = req.query.type as string | undefined;
      const herd = await bovinoService.getHerd(type);
      res.json({ success: true, data: herd });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getCounts(req: Request, res: Response) {
    try {
      const counts = await bovinoService.getCounts();
      res.json({ success: true, data: counts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async addAnimal(req: Request, res: Response) {
    try {
      const animal = await bovinoService.addAnimal(req.body);
      res.status(201).json({ success: true, data: animal });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async recordMilking(req: Request, res: Response) {
    try {
      const { tagNumber, liters } = req.body;
      const updated = await bovinoService.recordDailyMilking(tagNumber, Number(liters));
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
