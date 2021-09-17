export interface Kline {
  ts: number;
  open: number;
  close: number;
  high: number;
  low: number;
  vol?: number; // 交易货币的数量
  volQuote?: number; // 计价货币的数量
}
