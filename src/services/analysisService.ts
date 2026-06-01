import { getStockDetails } from '../utils/apiWrapper';
import Decimal from 'decimal.js';
import { StockAnalysisResponse } from '../types/stockTypes';
import { cacheService } from './cacheService';
import { SETTINGS } from '../config/settings';
import { NotFoundError, InsufficientDataError } from '../types/errors';

// Initialize Decimal settings from global configuration
Decimal.set({ 
  precision: SETTINGS.analysis.decimalPrecision, 
  rounding: SETTINGS.analysis.roundingDecimals as Decimal.Rounding
});

type YahooField = number | { raw?: number } | null | undefined;

/**
 * Normalizes Yahoo Finance data format (which can be a raw number or an object with a raw property)
 * to a clean number or null.
 * 
 * @param field The field value returned from Yahoo Finance API
 * @returns Clean normalized number or null
 */
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

/**
 * Performs fundamental financial analysis on a given stock symbol.
 * Retrieves stats from Yahoo Finance, applies formulas with high precision using decimal.js,
 * caches the outcomes, and categorizes the P/E ratio.
 * 
 * @param ticker Stock symbol (e.g. "AAPL")
 * @returns Formatted financial analysis response
 * @throws NotFoundError if the ticker symbol doesn't exist
 * @throws InsufficientDataError if stock is missing critical price data
 */
export const performAnalysis = async (
  ticker: string,
): Promise<StockAnalysisResponse> => {
  const upperTicker = ticker.toUpperCase();
  const sanitizedTicker = upperTicker.replace(/[^A-Z0-9.-]/g, '_');

  // 1. Check Cache
  const cachedData = cacheService.get<StockAnalysisResponse>(upperTicker);
  if (cachedData) {
    // eslint-disable-next-line no-console
    console.log(`[CACHE HIT] Serving ${sanitizedTicker} from memory.`);
    return cachedData;
  }

  // eslint-disable-next-line no-console
  console.log(`[CACHE MISS] Fetching ${sanitizedTicker} from API...`);

  // 2. Fetch Data from external wrapper
  const rawData = await getStockDetails(upperTicker);

  if (!rawData) {
    throw new NotFoundError(`Stock ticker '${upperTicker}' not found.`);
  }

  const financials = rawData.financialData;
  const stats = rawData.defaultKeyStatistics;

  // 3. Robust Data Extraction
  const currentPrice = getRawValue(financials?.currentPrice);

  if (!currentPrice) {
    throw new InsufficientDataError(
      `Insufficient financial data: Missing price for ${upperTicker}`,
    );
  }

  // FIX: Access library-defined 'financialCurrency' instead of undefined 'currency'
  const currency = financials?.financialCurrency || 'USD';

  const eps = getRawValue(stats?.trailingEps);
  const priceToBook = getRawValue(stats?.priceToBook);

  // 4. Fundamental Calculations
  let peRatioFormatted: string | null = null;
  let analysisText;
  let epsFormatted: string | undefined;
  let pbFormatted: string | undefined;

  const outDecimals = SETTINGS.analysis.outputDecimals;

  if (eps !== null && eps > 0) {
    const priceDec = new Decimal(currentPrice);
    const epsDec = new Decimal(eps);
    const peRatio = priceDec.dividedBy(epsDec);

    peRatioFormatted = peRatio.toFixed(outDecimals);
    epsFormatted = epsDec.toFixed(outDecimals);

    if (peRatio.lessThan(SETTINGS.analysis.peThresholdLow)) {
      analysisText = 'Potentially Undervalued (Low P/E)';
    } else if (peRatio.greaterThan(SETTINGS.analysis.peThresholdHigh)) {
      analysisText = 'Potentially Overvalued (High P/E)';
    } else {
      analysisText = 'Fair Value Range';
    }
  } else {
    peRatioFormatted = 'N/A (Negative or Missing Earnings)';
    analysisText = 'High Risk (Unprofitable or No Data)';
    if (eps !== null) {
      epsFormatted = new Decimal(eps).toFixed(outDecimals);
    }
  }

  if (priceToBook !== null) {
    pbFormatted = new Decimal(priceToBook).toFixed(outDecimals);
  }

  // 5. Construct Response
  const response: StockAnalysisResponse = {
    ticker: upperTicker,
    currency: currency,
    price: new Decimal(currentPrice).toFixed(outDecimals),
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
