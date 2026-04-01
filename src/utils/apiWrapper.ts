// src/utils/apiWrapper.ts
import YahooFinance from 'yahoo-finance2';
import Bottleneck from 'bottleneck';

// 1. Instantiate the Library and Set All Configs (The Strict v3 Way)
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'], // Notice suppression is now a constructor option
  fetchOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    },
  },
});

// 2. Setup the Rate Limiter (333ms delay, 1 request at a time)
const limiter = new Bottleneck({
  minTime: 333,
  maxConcurrent: 1,
});

// 3. The Wrapper Function
export const getStockDetails = limiter.wrap(
  async (ticker: string) => {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
      });
      return result;
    } catch (error: any) {
      // Gracefully handle tickers that do not exist
      if (error.message && error.message.includes('Not Found')) {
        console.warn(`Warning: Ticker ${ticker} not found.`);
        return null;
      }
      throw error;
    }
  }
);