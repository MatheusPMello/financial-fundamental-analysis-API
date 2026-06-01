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
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
      });
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