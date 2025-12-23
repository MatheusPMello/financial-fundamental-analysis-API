// src/controllers/stockController.ts
import { Request, Response } from 'express';
import * as analysisService from '../services/analysisService';

export const analyze = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticker } = req.params;

    if (!ticker) {
      res.status(400).json({ error: 'Ticker symbol is required' });
      return;
    }

    const data = await analysisService.performAnalysis(ticker);
    res.json(data);
  } catch (error: any) {
    console.error(error);

    if (error.message?.includes('not found')) {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
