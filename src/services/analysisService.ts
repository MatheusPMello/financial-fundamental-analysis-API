// src/services/analysisService.ts
import { getStockDetails } from '../utils/apiWrapper';
import Decimal from 'decimal.js';
import { StockAnalysisResponse } from '../types/stockTypes';

// Configure precision
Decimal.set({ precision: 20, rounding: 4 });

export const performAnalysis = async (ticker: string): Promise<StockAnalysisResponse> => {
  const upperTicker = ticker.toUpperCase();

  // 1. Get Raw Data
  const rawData = await getStockDetails(upperTicker);

  if (!rawData) {
    throw new Error(`Stock ticker '${upperTicker}' not found.`);
  }

  const financials = rawData.financialData;
  const stats = rawData.defaultKeyStatistics;

  // 2. Validation
  if (!financials || !financials.currentPrice) {
    throw new Error(`Insufficient financial data for ${upperTicker}`);
  }

  // 3. Setup Variables
  const currentPriceRaw = financials.currentPrice.raw;
  const currency = financials.currency || 'USD';
  
  let peRatioFormatted: string | null = null;
  let analysisText = "Insufficient Data";
  let epsFormatted: string | undefined;
  let pbFormatted: string | undefined;

  // 4. Calculate P/E Ratio
  if (stats?.trailingEps?.raw && stats.trailingEps.raw > 0) {
      const price = new Decimal(currentPriceRaw);
      const eps = new Decimal(stats.trailingEps.raw);
      const peRatio = price.dividedBy(eps);
      
      peRatioFormatted = peRatio.toFixed(2);
      epsFormatted = eps.toFixed(2);
      
      if (peRatio.lessThan(15)) analysisText = "Potentially Undervalued (Low P/E)";
      else if (peRatio.greaterThan(30)) analysisText = "Potentially Overvalued (High P/E)";
      else analysisText = "Fair Value Range";
  } else {
      peRatioFormatted = "N/A (Negative/Missing Earnings)";
      analysisText = "High Risk (Unprofitable)";
  }

  // 5. Calculate P/B Ratio (Price to Book)
  if (stats?.priceToBook?.raw) {
      pbFormatted = new Decimal(stats.priceToBook.raw).toFixed(2);
  }

  // 6. Build Response
  const response: StockAnalysisResponse = {
    ticker: upperTicker,
    currency: currency,
    price: new Decimal(currentPriceRaw).toFixed(2),
    analysis: analysisText,
    indicators: {
        pe_ratio: peRatioFormatted,
        eps: epsFormatted,
        pb_ratio: pbFormatted
    },
    generated_at: new Date().toISOString()
  };

  return response;
};