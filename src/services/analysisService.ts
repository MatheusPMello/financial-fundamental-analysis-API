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
 * Normalizes and formats a numeric value to a fixed-decimal string, or null.
 *
 * @param val Number to format
 * @param outDecimals Decimal places
 * @returns Formatted string or null
 */
function formatDecimal(val: number | null, outDecimals: number): string | null {
  if (val === null) return null;
  return new Decimal(val).toFixed(outDecimals);
}

/**
 * Computes "Net Debt / EBITDA" manually.
 * Net Debt = (financialData.totalDebt || 0) - (financialData.totalCash || 0)
 * Ratio = Net Debt / (financialData.ebitda || 1)
 *
 * @param totalDebt Raw total debt from financial data
 * @param totalCash Raw total cash from financial data
 * @param ebitda Raw ebitda from financial data
 * @returns Net Debt / EBITDA ratio, or null if all fields are missing
 */
function calculateNetDebtToEbitda(
  totalDebt: number | null,
  totalCash: number | null,
  ebitda: number | null
): number | null {
  if (totalDebt === null && totalCash === null && ebitda === null) {
    return null;
  }
  const debt = new Decimal(totalDebt ?? 0);
  const cash = new Decimal(totalCash ?? 0);
  const netDebt = debt.minus(cash);
  
  // Use ebitda or 1 as fallback to prevent division by zero
  const ebitdaVal = ebitda !== null && ebitda !== 0 ? ebitda : 1;
  const denominator = new Decimal(ebitdaVal);
  
  return netDebt.dividedBy(denominator).toNumber();
}

/**
 * Computes Return on Invested Capital (ROIC) using multi-statement historical inputs.
 * NOPAT = Operating Income * (1 - (Tax Expense / Income Before Tax))
 * Invested Capital = Total Debt + Total Shareholder Equity - Cash & Cash Equivalents
 * ROIC = NOPAT / Invested Capital
 *
 * Returns null if any essential data points are missing.
 *
 * @param incomeStatement First entry in incomeStatementHistory
 * @param balanceSheet First entry in balanceSheetHistory
 * @returns Calculated ROIC ratio, or null if insufficient data
 */
function calculateROIC(
  incomeStatement: unknown,
  balanceSheet: unknown
): number | null {
  if (!incomeStatement || !balanceSheet) {
    return null;
  }

  const inc = incomeStatement as Record<string, unknown>;
  const bal = balanceSheet as Record<string, unknown>;

  // 1. Extract and normalize income statement values
  const operatingIncome = getRawValue(inc.operatingIncome as YahooField);
  const taxExpense = getRawValue(inc.incomeTaxExpense as YahooField);
  const incomeBeforeTax = getRawValue(inc.incomeBeforeTax as YahooField);

  if (operatingIncome === null || taxExpense === null || incomeBeforeTax === null || incomeBeforeTax === 0) {
    return null;
  }

  // 2. Extract and normalize balance sheet values
  // Support both totalDebt property or shortLongTermDebt + longTermDebt fallback
  const rawTotalDebt = getRawValue(bal.totalDebt as YahooField);
  const totalDebt = rawTotalDebt ??
    ((getRawValue(bal.shortLongTermDebt as YahooField) ?? 0) + (getRawValue(bal.longTermDebt as YahooField) ?? 0));

  const totalShareholderEquity = getRawValue(bal.totalStockholderEquity as YahooField) ?? getRawValue(bal.totalShareholderEquity as YahooField);
  
  const cashAndEquivalents = getRawValue(bal.cashAndCashEquivalents as YahooField) 
    ?? getRawValue(bal.cash as YahooField) 
    ?? getRawValue(bal.cashCashEquivalentsAndShortTermInvestments as YahooField);

  if (totalShareholderEquity === null || cashAndEquivalents === null) {
    return null;
  }

  // 3. Compute NOPAT
  // NOPAT = Operating Income * (1 - (Tax Expense / Income Before Tax))
  const opIncDec = new Decimal(operatingIncome);
  const taxExpDec = new Decimal(taxExpense);
  const incBeforeTaxDec = new Decimal(incomeBeforeTax);
  const taxRate = taxExpDec.dividedBy(incBeforeTaxDec);
  const nopat = opIncDec.times(new Decimal(1).minus(taxRate));

  // 4. Compute Invested Capital
  // Invested Capital = Total Debt + Total Shareholder Equity - Cash & Cash Equivalents
  const totalDebtDec = new Decimal(totalDebt);
  const equityDec = new Decimal(totalShareholderEquity);
  const cashDec = new Decimal(cashAndEquivalents);
  const investedCapital = totalDebtDec.plus(equityDec).minus(cashDec);

  if (investedCapital.isZero()) {
    return null;
  }

  // 5. Compute ROIC
  return nopat.dividedBy(investedCapital).toNumber();
}

/**
 * Evaluates stock metrics and determines the qualitative analysis rating.
 * 
 * @param eps Trailing Earnings Per Share
 * @param peRatio Calculated trailing P/E ratio Decimal object or null
 * @param netDebtToEbitda Calculated Net Debt to EBITDA leverage ratio
 * @returns Qualitative analysis statement (e.g. 'Potentially Undervalued', 'High Risk')
 */
function evaluateMetrics(
  eps: number | null,
  peRatio: Decimal | null,
  netDebtToEbitda: number | null
): string {
  // Flag high risk if EPS is negative or missing
  if (eps === null || eps <= 0) {
    return 'High Risk (Unprofitable or No Data)';
  }

  // Flag high risk if leverage is too high (Net Debt / EBITDA > 4)
  if (netDebtToEbitda !== null && netDebtToEbitda > 4) {
    return 'High Risk (Elevated Leverage)';
  }

  // Determine valuation category based on P/E ratio
  if (peRatio !== null) {
    if (peRatio.lessThan(SETTINGS.analysis.peThresholdLow)) {
      return 'Potentially Undervalued (Low P/E)';
    } else if (peRatio.greaterThan(SETTINGS.analysis.peThresholdHigh)) {
      return 'Potentially Overvalued (High P/E)';
    } else {
      return 'Fair Value Range';
    }
  }

  return 'High Risk (Unprofitable or No Data)';
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
  const outDecimals = SETTINGS.analysis.outputDecimals;

  const eps = getRawValue(stats?.trailingEps);
  const priceToBook = getRawValue(stats?.priceToBook);

  // New native metrics
  const enterpriseToEbitda = getRawValue((financials as Record<string, unknown>)?.enterpriseToEbitda as YahooField);
  const returnOnEquity = getRawValue(financials?.returnOnEquity);
  const currentRatio = getRawValue(financials?.currentRatio);

  // Leverage calculations (Net Debt / EBITDA)
  const totalDebt = getRawValue(financials?.totalDebt);
  const totalCash = getRawValue(financials?.totalCash);
  const ebitda = getRawValue(financials?.ebitda);
  const netDebtToEbitdaVal = calculateNetDebtToEbitda(totalDebt, totalCash, ebitda);

  // Multi-statement ROIC calculations
  const incomeStatement = rawData.incomeStatementHistory?.incomeStatementHistory?.[0];
  const balanceSheet = rawData.balanceSheetHistory?.balanceSheetStatements?.[0];
  const roicVal = calculateROIC(incomeStatement, balanceSheet);

  // 4. Fundamental Calculations & Ratings
  let peRatioFormatted: string | null = null;
  let peDec: Decimal | null = null;
  let epsFormatted: string | undefined;

  if (eps !== null && eps > 0) {
    const priceDec = new Decimal(currentPrice);
    const epsDec = new Decimal(eps);
    peDec = priceDec.dividedBy(epsDec);

    peRatioFormatted = peDec.toFixed(outDecimals);
    epsFormatted = epsDec.toFixed(outDecimals);
  } else {
    peRatioFormatted = 'N/A (Negative or Missing Earnings)';
    if (eps !== null) {
      epsFormatted = new Decimal(eps).toFixed(outDecimals);
    }
  }

  const analysisText = evaluateMetrics(eps, peDec, netDebtToEbitdaVal);

  // 5. Construct Response
  const response: StockAnalysisResponse = {
    ticker: upperTicker,
    currency: currency,
    price: new Decimal(currentPrice).toFixed(outDecimals),
    analysis: analysisText,
    indicators: {
      pe_ratio: peRatioFormatted,
      eps: epsFormatted,
      pb_ratio: formatDecimal(priceToBook, outDecimals) ?? undefined,
      enterprise_to_ebitda: formatDecimal(enterpriseToEbitda, outDecimals),
      return_on_equity: formatDecimal(returnOnEquity, outDecimals),
      current_ratio: formatDecimal(currentRatio, outDecimals),
      net_debt_to_ebitda: formatDecimal(netDebtToEbitdaVal, outDecimals),
      roic: formatDecimal(roicVal, outDecimals),
    },
    generated_at: new Date().toISOString(),
  };

  // 6. Save to Cache
  cacheService.set(upperTicker, response);

  return response;
};
