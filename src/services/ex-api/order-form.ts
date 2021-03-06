import { ExchangePair } from '../../models/mar/ex-pair';

export class OrderForm implements ExchangePair {
  ex: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  quoteQuantity: number;
  price: number; // type=LIMIT
  priceStr: string;

  baseCcy: string;
  quoteCcy: string;

  clientOrderId?: string;
}

export class CancelOrderForm {
  ex: string;
  orderId: string;
  symbol?: string;
  waitSyncAssets?: boolean;
}

export interface PlaceOrderResult {
  orderId: string;
}

export interface BatchPlaceOrderResult extends PlaceOrderResult {
  ex: string;
  symbol: string;
  success: boolean;
  message?: string;
}
