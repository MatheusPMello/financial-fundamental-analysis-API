import { performAnalysis } from './analysisService';
import { getStockDetails } from '../utils/apiWrapper';
import { cacheService } from './cacheService';
import { NotFoundError, InsufficientDataError } from '../types/errors';

jest.mock('../utils/apiWrapper');
jest.mock('./cacheService');

const mockedGetStockDetails = jest.mocked(getStockDetails);
const mockedCacheService = jest.mocked(cacheService);

describe('performAnalysis (Business Logic)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return Cached Data immediately if available (Cache Hit)', async () => {
    const mockCachedResponse = { 
        ticker: 'AAPL', 
        currency: 'USD',
        price: '100.00', 
        analysis: 'Fair Value Range', 
        indicators: { pe_ratio: '10.00', eps: '10.00', pb_ratio: '1.00' },
        generated_at: '2024-01-01T00:00:00.000Z'
    };
    
    mockedCacheService.get.mockReturnValue(mockCachedResponse);

    const result = await performAnalysis('AAPL');

    expect(result).toBe(mockCachedResponse);
    expect(mockedCacheService.get).toHaveBeenCalledWith('AAPL');
    expect(mockedGetStockDetails).not.toHaveBeenCalled();
  });

  it('should fetch data, calculate P/E, and cache it if cache is empty (Cache Miss)', async () => {
    mockedCacheService.get.mockReturnValue(undefined);

    const mockApiData = {
      financialData: { 
        currentPrice: 150, 
        financialCurrency: 'USD' 
      },
      defaultKeyStatistics: { 
        trailingEps: 5, 
        priceToBook: 3.5 
      }
    };
    
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>); 

    const result = await performAnalysis('AAPL');

    expect(result.indicators.pe_ratio).toBe('30.00');
    expect(result.indicators.eps).toBe('5.00');
    expect(result.indicators.pb_ratio).toBe('3.50');
    expect(result.indicators.enterprise_to_ebitda).toBeNull();
    expect(result.indicators.return_on_equity).toBeNull();
    expect(result.indicators.current_ratio).toBeNull();
    expect(result.indicators.net_debt_to_ebitda).toBeNull();
    expect(result.indicators.roic).toBeNull();
    expect(mockedCacheService.set).toHaveBeenCalledWith('AAPL', expect.any(Object));
  });

  it('should throw NotFoundError if the ticker symbol does not exist', async () => {
    mockedCacheService.get.mockReturnValue(undefined);
    mockedGetStockDetails.mockResolvedValue(null);

    await expect(performAnalysis('INVALID')).rejects.toThrow(NotFoundError);
    expect(mockedCacheService.set).not.toHaveBeenCalled();
  });

  it('should throw InsufficientDataError if stock current price is missing', async () => {
    mockedCacheService.get.mockReturnValue(undefined);
    
    const mockApiData = {
      financialData: { 
        financialCurrency: 'USD' 
      },
      defaultKeyStatistics: { 
        trailingEps: 5 
      }
    };
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>);

    await expect(performAnalysis('AAPL')).rejects.toThrow(InsufficientDataError);
    expect(mockedCacheService.set).not.toHaveBeenCalled();
  });

  it('should flag company as High Risk (N/A P/E) if EPS is negative', async () => {
    mockedCacheService.get.mockReturnValue(undefined);

    const mockApiData = {
      financialData: { 
        currentPrice: 100, 
        financialCurrency: 'USD' 
      },
      defaultKeyStatistics: { 
        trailingEps: -2,
        priceToBook: null
      }
    };
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>);

    const result = await performAnalysis('AAPL');

    expect(result.indicators.pe_ratio).toBe('N/A (Negative or Missing Earnings)');
    expect(result.analysis).toBe('High Risk (Unprofitable or No Data)');
    expect(result.indicators.eps).toBe('-2.00');
    expect(result.indicators.pb_ratio).toBeUndefined();
    expect(mockedCacheService.set).toHaveBeenCalled();
  });

  it('should correctly calculate Net Debt / EBITDA and flag company as High Risk if ratio > 4.0', async () => {
    mockedCacheService.get.mockReturnValue(undefined);

    const mockApiData = {
      financialData: {
        currentPrice: 100,
        financialCurrency: 'USD',
        totalDebt: 500,
        totalCash: 100,
        ebitda: 80, // Net Debt = 400. EBITDA = 80. Ratio = 5.0
        enterpriseToEbitda: 12.5,
        returnOnEquity: 0.15,
        currentRatio: 1.5,
      },
      defaultKeyStatistics: {
        trailingEps: 5,
        priceToBook: 2.0,
      }
    };
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>);

    const result = await performAnalysis('AAPL');

    expect(result.indicators.net_debt_to_ebitda).toBe('5.00');
    expect(result.indicators.enterprise_to_ebitda).toBe('12.50');
    expect(result.indicators.return_on_equity).toBe('0.15');
    expect(result.indicators.current_ratio).toBe('1.50');
    expect(result.analysis).toBe('High Risk (Elevated Leverage)');
  });

  it('should correctly calculate multi-statement ROIC using first historical statements', async () => {
    mockedCacheService.get.mockReturnValue(undefined);

    const mockApiData = {
      financialData: {
        currentPrice: 100,
        financialCurrency: 'USD',
      },
      defaultKeyStatistics: {
        trailingEps: 5,
      },
      incomeStatementHistory: {
        incomeStatementHistory: [
          {
            operatingIncome: 100,
            incomeTaxExpense: 20,
            incomeBeforeTax: 80, // Tax Rate = 25%. NOPAT = 100 * (1 - 0.25) = 75
          }
        ]
      },
      balanceSheetHistory: {
        balanceSheetStatements: [
          {
            totalDebt: 300,
            totalStockholderEquity: 200,
            cashAndCashEquivalents: 100, // Invested Capital = 300 + 200 - 100 = 400. ROIC = 75 / 400 = 0.1875
          }
        ]
      }
    };
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>);

    const result = await performAnalysis('AAPL');

    expect(result.indicators.roic).toBe('0.19'); // Rounded to 2 decimals
  });

  it('should fall back to shortLongTermDebt + longTermDebt and totalShareholderEquity / cash variations for ROIC calculation', async () => {
    mockedCacheService.get.mockReturnValue(undefined);

    const mockApiData = {
      financialData: {
        currentPrice: 100,
        financialCurrency: 'USD',
      },
      defaultKeyStatistics: {
        trailingEps: 5,
      },
      incomeStatementHistory: {
        incomeStatementHistory: [
          {
            operatingIncome: 100,
            incomeTaxExpense: 20,
            incomeBeforeTax: 80, // NOPAT = 75
          }
        ]
      },
      balanceSheetHistory: {
        balanceSheetStatements: [
          {
            shortLongTermDebt: 100,
            longTermDebt: 200, // Total Debt = 300
            totalShareholderEquity: 200,
            cash: 100, // Invested Capital = 300 + 200 - 100 = 400
          }
        ]
      }
    };
    mockedGetStockDetails.mockResolvedValue(mockApiData as unknown as ReturnType<typeof getStockDetails>);

    const result = await performAnalysis('AAPL');

    expect(result.indicators.roic).toBe('0.19');
  });
});