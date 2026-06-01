import request from 'supertest';
import app from '../app';
import * as analysisService from '../services/analysisService';
import { NotFoundError, InsufficientDataError } from '../types/errors';

jest.mock('../services/analysisService');

const mockedPerformAnalysis = jest.mocked(analysisService.performAnalysis);

describe('GET /api/stocks/analyze/:ticker (Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should respond with 200 and JSON data on successful analysis', async () => {
    const mockResponse = {
      ticker: 'AAPL',
      currency: 'USD',
      price: '150.00',
      analysis: 'Fair Value Range',
      indicators: {
        pe_ratio: '30.00',
        eps: '5.00',
        pb_ratio: '3.50',
      },
      generated_at: new Date().toISOString(),
    };

    mockedPerformAnalysis.mockResolvedValue(mockResponse);

    const res = await request(app).get('/api/stocks/analyze/AAPL');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual(mockResponse);
    expect(mockedPerformAnalysis).toHaveBeenCalledWith('AAPL');
  });

  it('should respond with 404 if the ticker symbol is not found', async () => {
    mockedPerformAnalysis.mockRejectedValue(new NotFoundError("Stock ticker 'INVALID' not found."));

    const res = await request(app).get('/api/stocks/analyze/INVALID');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "Stock ticker 'INVALID' not found.",
    });
  });

  it('should respond with 422 if data is insufficient', async () => {
    mockedPerformAnalysis.mockRejectedValue(
      new InsufficientDataError("Insufficient financial data: Missing price for AAPL")
    );

    const res = await request(app).get('/api/stocks/analyze/AAPL');

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: "Insufficient financial data: Missing price for AAPL",
    });
  });

  it('should respond with 500 for unhandled general exceptions', async () => {
    mockedPerformAnalysis.mockRejectedValue(new Error("Database crash!"));

    const res = await request(app).get('/api/stocks/analyze/AAPL');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: "Internal Server Error",
    });
  });
});
