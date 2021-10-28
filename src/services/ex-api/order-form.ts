export class OrderForm {
  ex: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  quoteQuantity: number;
  price: number; // type=LIMIT

  baseCcy?: string;
  quoteCcy?: string;

  clientOrderId?: string;
}

export class CancelOrderForm {
  ex: string;
  orderId: string;
  symbol?: string;
}
