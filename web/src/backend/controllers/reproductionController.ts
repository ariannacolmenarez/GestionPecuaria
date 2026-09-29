import { Request, Response } from 'express';
import { reproductionService } from '../services/reproductionService';

export const reproductionController = {
  async getMatings(req: Request, res: Response) {
    try {
      const sowCode = req.query.sowCode as string | undefined;
      const matings = await reproductionService.getMatings(sowCode);
      res.json({ success: true, data: matings });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async registerMating(req: Request, res: Response) {
    try {
      const mating = await reproductionService.registerMating(req.body);
      res.status(201).json({ success: true, data: mating });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async getFarrowings(req: Request, res: Response) {
    try {
      const sowCode = req.query.sowCode as string | undefined;
      const farrowings = await reproductionService.getFarrowings(sowCode);
      res.json({ success: true, data: farrowings });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async registerFarrowing(req: Request, res: Response) {
    try {
      const farrowing = await reproductionService.registerFarrowing(req.body);
      res.status(201).json({ success: true, data: farrowing });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async calculateWeaning(req: Request, res: Response) {
    try {
      const result = reproductionService.calculateWeaningProrating(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
