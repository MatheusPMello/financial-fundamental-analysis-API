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
});