import YahooFinance from 'yahoo-finance2';
import Bottleneck from 'bottleneck';
import { SETTINGS } from '../config/settings';

// 1. Instantiate the Library and Set All Configs (The Strict v3 Way)
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  fetchOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    },
  },
});

// 2. Setup the Rate Limiter using values from global settings
const limiter = new Bottleneck({
  minTime: SETTINGS.rateLimiter.minTime,
  maxConcurrent: SETTINGS.rateLimiter.maxConcurrent,
});

/**
 * Throttled wrapper function to fetch financial and statistic summaries for a stock ticker.
 * 
 * @param ticker Stock symbol (e.g. "AAPL")
 * @returns Result object from Yahoo Finance or null if the ticker is not found
 */
export const getStockDetails = limiter.wrap(
  async (ticker: string) => {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: [
          'financialData',
          'defaultKeyStatistics',
          'incomeStatementHistory',
          'balanceSheetHistory',
        ],
      });

      // Helper to normalize Yahoo Finance field values
      const getRawVal = (field: unknown): number | null => {
        if (field === undefined || field === null) return null;
        if (typeof field === 'number') return field;
        if (typeof field === 'object' && field !== null && 'raw' in field) {
          const rawVal = (field as { raw: unknown }).raw;
          if (typeof rawVal === 'number') return rawVal;
        }
        return null;
      };

      // Enrich statements using fundamentalsTimeSeries as a fallback if they return null/empty data (common since Nov 2024)
      try {
        const hasIncome = result.incomeStatementHistory?.incomeStatementHistory?.[0] &&
          getRawVal(result.incomeStatementHistory.incomeStatementHistory[0].operatingIncome) !== null;
        
        const hasBalance = result.balanceSheetHistory?.balanceSheetStatements?.[0] &&
          (getRawVal((result.balanceSheetHistory.balanceSheetStatements[0] as unknown as Record<string, unknown>).totalDebt) !== null ||
           getRawVal((result.balanceSheetHistory.balanceSheetStatements[0] as unknown as Record<string, unknown>).shortLongTermDebt) !== null);

        if (!hasIncome || !hasBalance) {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 2);
          const timeSeries = await yahooFinance.fundamentalsTimeSeries(ticker, {
            period1: oneYearAgo.toISOString().split('T')[0],
            type: 'quarterly',
            module: 'all',
          });

          if (timeSeries && timeSeries.length > 0) {
            // Find the latest entry that has date
            const latest = timeSeries[timeSeries.length - 1] as unknown as Record<string, unknown>;
            
            if (!hasIncome) {
              type IncomeElement = NonNullable<typeof result.incomeStatementHistory>['incomeStatementHistory'][number];
              result.incomeStatementHistory = {
                maxAge: 1,
                incomeStatementHistory: [
                  {
                    maxAge: 1,
                    endDate: latest.date as Date,
                    operatingIncome: (latest.operatingIncome ?? latest.EBIT ?? null) as number | null,
                    incomeTaxExpense: (latest.taxProvision ?? null) as number | null,
                    incomeBeforeTax: (latest.pretaxIncome ?? null) as number | null,
                  } as unknown as IncomeElement
                ]
              };
            }

            if (!hasBalance) {
              type BalanceElement = NonNullable<typeof result.balanceSheetHistory>['balanceSheetStatements'][number];
              result.balanceSheetHistory = {
                maxAge: 1,
                balanceSheetStatements: [
                  {
                    maxAge: 1,
                    endDate: latest.date as Date,
                    totalDebt: (latest.totalDebt ?? null) as number | null,
                    totalStockholderEquity: (latest.stockholdersEquity ?? latest.commonStockEquity ?? null) as number | null,
                    cashAndCashEquivalents: (latest.cashAndCashEquivalents ?? latest.cashCashEquivalentsAndShortTermInvestments ?? null) as number | null,
                  } as unknown as BalanceElement
                ]
              };
            }
          }
        }
      } catch (tsError) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: Failed to fetch fundamentalsTimeSeries for ${ticker}:`, tsError);
      }

      return result;
    } catch (error: unknown) {
      // Gracefully handle tickers that do not exist
      if (error instanceof Error && error.message?.includes('Not Found')) {
        // eslint-disable-next-line no-console
        console.warn(`Warning: Ticker ${ticker} not found.`);
        return null;
      }
      throw error;
    }
  }
);