import { ExPair } from './ex-pair';

export interface Kline {
  ts: number;
  open: number;
  close: number;
  high: number;
  low: number;
  vol?: number; // 交易货币的数量
  volQuote?: number; // 计价货币的数量
}

export interface SymbolKline extends Kline {
  symbol: string;
  avgPrice: number;
  changePercent: number;
}

export interface PairKline extends SymbolKline {
  pair: ExPair;
}
