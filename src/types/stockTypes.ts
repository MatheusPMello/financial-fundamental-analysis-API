// src/types/stockTypes.ts
export interface FundamentalDataPayload {
  trailingPE: number | null;
  priceToBook: number | null;
  enterpriseToEbitda: number | null;
  returnOnEquity: number | null;
  currentRatio: number | null;
  netDebtToEbitda: number | null;
  roic: number | null;
}

export interface StockAnalysisResponse {
  ticker: string;
  currency: string;
  price: string;
  analysis: string;
  indicators: {
    pe_ratio: string | null;
    pb_ratio?: string;
    eps?: string;
    enterprise_to_ebitda: string | null;
    return_on_equity: string | null;
    current_ratio: string | null;
    net_debt_to_ebitda: string | null;
    roic: string | null;
  };
  generated_at: string;
}

export interface ValidatedFinancials {
  symbol: string;
  price: number;
  eps: number;
  currency: string;
}
