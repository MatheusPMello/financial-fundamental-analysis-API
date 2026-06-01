import { Request, Response, NextFunction } from 'express';
import * as analysisService from '../services/analysisService';

/**
 * Endpoint controller to fetch fundamental financial analysis for a stock ticker.
 * Triggers the analysis service and returns a structured JSON payload.
 * Delegates exceptions to the global error middleware.
 * 
 * GET /api/stocks/analyze/:ticker
 */
export const analyze = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticker } = req.params;

    if (!ticker || typeof ticker !== 'string') {
      res.status(400).json({ error: 'Ticker symbol is required and must be a string' });
      return;
    }

    const data = await analysisService.performAnalysis(ticker);
    res.json(data);
  } catch (error) {
    next(error);
  }
};
