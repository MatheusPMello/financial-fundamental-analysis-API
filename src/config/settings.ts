/**
 * Application Settings and Configuration
 */
export const SETTINGS = {
  // Server Port
  port: process.env.PORT || 3000,

  // Cache configuration (node-cache)
  cache: {
    ttl: 600, // Standard Time To Live in seconds (10 minutes)
  },

  // Rate Limiting configuration for Yahoo Finance (Bottleneck)
  rateLimiter: {
    minTime: 333, // Minimum time in milliseconds between requests (approx 3 req/sec)
    maxConcurrent: 1, // Max concurrent requests to avoid rate limit bans
  },

  // Valuation metrics & thresholds for business logic analysis
  analysis: {
    peThresholdLow: 15, // P/E below this value is labeled "Potentially Undervalued"
    peThresholdHigh: 30, // P/E above this value is labeled "Potentially Overvalued"
    decimalPrecision: 20, // Precision for decimal.js mathematical operations
    roundingDecimals: 4, // Intermediate calculation decimal rounding rule
    outputDecimals: 2, // Standard output decimals for P/E, EPS, P/B ratios
  },
};
