import { performAnalysis } from './analysisService';
import { getStockDetails } from '../utils/apiWrapper';
import { cacheService } from './cacheService';

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
        price: '100', 
        analysis: 'Fair', 
        indicators: { pe_ratio: '10', eps: '10', pb_ratio: '1' },
        generated_at: '2024-01-01'
    };
    
    mockedCacheService.get.mockReturnValue(mockCachedResponse);

    const result = await performAnalysis('AAPL');

    expect(result).toBe(mockCachedResponse);
    expect(mockedCacheService.get).toHaveBeenCalledWith('AAPL');
    expect(mockedGetStockDetails).not.toHaveBeenCalled();
  });

  it('should fetch data, calculate P/E, and cache it if cache is empty', async () => {
    mockedCacheService.get.mockReturnValue(null);

    const mockApiData = {
      financialData: { 
        currentPrice: 150.00, 
        currency: 'USD' 
      },
      defaultKeyStatistics: { 
        trailingEps: 5.00, 
        priceToBook: { raw: 3.5 } 
      }
    };
    
    mockedGetStockDetails.mockResolvedValue(mockApiData as any); 

    const result = await performAnalysis('AAPL');

    expect(result.indicators.pe_ratio).toBe('30.00');
    expect(mockedCacheService.set).toHaveBeenCalled();
  });
});