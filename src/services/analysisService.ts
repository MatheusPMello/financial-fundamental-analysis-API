import { getStockDetails } from '../utils/apiWrapper';
import Decimal from 'decimal.js';
import { StockAnalysisResponse } from '../types/stockTypes';
import { cacheService } from './cacheService';

Decimal.set({ precision: 20, rounding: 4 });

// --- HELPER FUNCTION ---
// This helper normalizes Yahoo Finance data (which can be { raw: number } or just number) to a number or null.

type YahooField = number | { raw?: number } | null | undefined;

function getRawValue(field: YahooField): number | null {
  if (field === undefined || field === null) return null;
  if (typeof field === 'number') {
    return field;
  }
  if (typeof field === 'object' && typeof field.raw === 'number') {
    return field.raw;
  }

  return null;
}

export const performAnalysis = async (
  ticker: string,
): Promise<StockAnalysisResponse> => {
  const upperTicker = ticker.toUpperCase();

  // 1. Check Cache
  const cachedData = cacheService.get<StockAnalysisResponse>(upperTicker);
  if (cachedData) {
    console.log(`[CACHE HIT] Serving ${upperTicker} from memory.`);
    return cachedData;
  }

  console.log(`[CACHE MISS] Fetching ${upperTicker} from API...`);

  // 2. Fetch Data
  const rawData = await getStockDetails(upperTicker);

  if (!rawData) {
    throw new Error(`Stock ticker '${upperTicker}' not found.`);
  }

  const financials = rawData.financialData;
  const stats = rawData.defaultKeyStatistics;

  // 3. Robust Data Extraction (Using helper)
  const currentPrice = getRawValue(financials?.currentPrice);

  if (!currentPrice) {
    throw new Error(
      `Insufficient financial data: Missing price for ${upperTicker}`,
    );
  }

  const currency = financials?.currency || 'USD';

  const eps = getRawValue(stats?.trailingEps);
  const priceToBook = getRawValue(stats?.priceToBook);

  // 4. Calculations
  let peRatioFormatted: string | null = null;
  let analysisText;
  let epsFormatted: string | undefined;
  let pbFormatted: string | undefined;

  if (eps !== null && eps > 0) {
    const priceDec = new Decimal(currentPrice);
    const epsDec = new Decimal(eps);
    const peRatio = priceDec.dividedBy(epsDec);

    peRatioFormatted = peRatio.toFixed(2);
    epsFormatted = epsDec.toFixed(2);

    if (peRatio.lessThan(15))
      analysisText = 'Potentially Undervalued (Low P/E)';
    else if (peRatio.greaterThan(30))
      analysisText = 'Potentially Overvalued (High P/E)';
    else analysisText = 'Fair Value Range';
  } else {
    peRatioFormatted = 'N/A (Negative or Missing Earnings)';
    analysisText = 'High Risk (Unprofitable or No Data)';
  }

  if (priceToBook !== null) {
    pbFormatted = new Decimal(priceToBook).toFixed(2);
  }

  // 5. Construct Response
  const response: StockAnalysisResponse = {
    ticker: upperTicker,
    currency: currency,
    price: new Decimal(currentPrice).toFixed(2),
    analysis: analysisText,
    indicators: {
      pe_ratio: peRatioFormatted,
      eps: epsFormatted,
      pb_ratio: pbFormatted,
    },
    generated_at: new Date().toISOString(),
  };

  // 6. Save to Cache
  cacheService.set(upperTicker, response);

  return response;
};
