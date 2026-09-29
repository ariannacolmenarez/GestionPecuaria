import { Request, Response } from 'express';
import { avicolaService } from '../services/avicolaService';

export const avicolaController = {
  async getLots(req: Request, res: Response) {
    try {
      const lots = await avicolaService.getAllLots();
      res.json({ success: true, data: lots });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async getTotalCount(req: Request, res: Response) {
    try {
      const total = await avicolaService.getTotalBirdsCount();
      res.json({ success: true, data: { totalBirds: total } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  async createLot(req: Request, res: Response) {
    try {
      const lot = await avicolaService.createLot(req.body);
      res.status(201).json({ success: true, data: lot });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async recordDaily(req: Request, res: Response) {
    try {
      const { batchCode, feedConsumedKg, deadBirdsCount, sampledAverageWeightGrams } = req.body;
      const updated = await avicolaService.recordDailyFeedAndMortality(
        batchCode,
        Number(feedConsumedKg),
        Number(deadBirdsCount),
        sampledAverageWeightGrams ? Number(sampledAverageWeightGrams) : undefined
      );
      res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  async liquidateSale(req: Request, res: Response) {
    try {
      const { batchCode, salePricePerKg, buyerName } = req.body;
      const result = await avicolaService.liquidateLotSale(
        batchCode,
        Number(salePricePerKg),
        buyerName
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
};
