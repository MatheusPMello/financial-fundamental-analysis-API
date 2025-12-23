// src/types/stockTypes.ts
export interface StockAnalysisResponse {
  ticker: string;
  currency: string;
  price: string;
  analysis: string;
  indicators: {
    pe_ratio: string | null;
    pb_ratio?: string;
    eps?: string;
  };
  generated_at: string;
}

export interface ValidatedFinancials {
  symbol: string;
  price: number;
  eps: number;
  currency: string;
}
