// src/types/stockTypes.ts

import { type Decimal } from 'decimal.js';

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