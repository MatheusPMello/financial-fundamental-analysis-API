// src/utils/apiWrapper.ts
import YahooFinance from 'yahoo-finance2';
import Bottleneck from 'bottleneck';

// 1. Instantiate the Library (The v3 Fix)
const yahooFinance = new YahooFinance();

// 2. Setup the Rate Limiter
const limiter = new Bottleneck({
  minTime: 333,
  maxConcurrent: 1,
});

// 3. Define the specific type we expect to return
interface YahooResult {
  financialData: any;
  defaultKeyStatistics: any;
  summaryDetail: any;
  [key: string]: any;
}

// 4. The Wrapper Function
export const getStockDetails = limiter.wrap(
  async (ticker: string): Promise<YahooResult | null> => {
    try {
      const result = await yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail'],
      });
      return result as YahooResult;
    } catch (error: any) {
      if (error.message && error.message.includes('Not Found')) {
        console.warn(`Warning: Ticker ${ticker} not found.`);
        return null;
      }
      throw error;
    }
  },
);
