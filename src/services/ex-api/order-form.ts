export class OrderForm {
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
  orderId: string;
  symbol?: string;
}
