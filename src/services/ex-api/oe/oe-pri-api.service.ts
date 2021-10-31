import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';

import { Config } from '../../../common/config';
import { API } from '../../../models/sys/exapi';
import { CancelOrderForm, OrderForm } from '../order-form';
import { defaultReqConfig } from '../../../common/utils';

@Injectable()
export class OePriApiService {
  constructor(private httpService: HttpService) {
  }

  apiBase = Config.OE_API.BASE_URL;


  private genReqConfig(api: API, method: string, path: string, bodyStr?: string): AxiosRequestConfig {
    const timeStr = new Date().toISOString();
    let signSrc = timeStr + method + path;
    if (bodyStr) {
      signSrc = signSrc + bodyStr;
    }

    const hmac = crypto.createHmac('sha256', api.secret);
    hmac.update(signSrc);
    const sign = hmac.digest('base64');

    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    requestConfig.headers = {
      'OK-ACCESS-KEY': api.key,
      'OK-ACCESS-PASSPHRASE': api.phase,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-TIMESTAMP': timeStr,
      'Content-Type': 'application/json'
    };
    return requestConfig;
  }


  private async getData(api: API, path: string): Promise<any> {
    if (!api) {
      throw new Error('API未配置（OE）');
    }

    const url = this.apiBase + path;
    console.log('-> ' + url);

    const requestConfig = this.genReqConfig(api, 'GET', path);
    const res: AxiosResponse = await this.httpService
      .get(url, requestConfig).toPromise();

    return res.data;
  }

  private async post(api: API, path: string, paramObj: any): Promise<any> {
    if (!api) {
      throw new Error('API未配置（OE）');
    }

    const url = this.apiBase + path;
    console.log('-> ' + url);

    const data = JSON.stringify(paramObj);
    console.log('-> ' + data);

    const requestConfig = this.genReqConfig(api, 'POST', path, data);
    const res: AxiosResponse = await this.httpService.post(url, data, requestConfig).toPromise();
    return res.data;
  }

  async currencies(api: API): Promise<any> {
    const path = '/api/v5/asset/currencies';
    const body = await this.getData(api, path);
    return body.data;
  }

  async balance(api: API, ccy?: string): Promise<any> {
    let path = '/api/v5/account/balance';
    if (ccy) {
      path = path + '?ccy=' + ccy;
    }
    const body = await this.getData(api, path);
    const data = body.data[0];
    // if (!ccy) {
    //   data.details = data.details.filter(b => !b.eqUsd.startsWith('0.00'));
    // }

    return data;
  }

  async ordersHistory7d(api: API, orderId?: string): Promise<any> {
    let path = '/api/v5/trade/orders-history?instType=SPOT';
    if (orderId) {
      path = path + '&before=' + orderId;
    }
    const body = await this.getData(api, path);
    return body.data;
  }

  async ordersHistory3m(api: API, orderId?: string): Promise<any> {
    let path = '/api/v5/trade/orders-history-archive?instType=SPOT';
    if (orderId) {
      path = path + '&before=' + orderId;
    }
    const body = await this.getData(api, path);
    return body.data;
  }

  async spotTrades(api: API, ordId?: string): Promise<any> {
    let path = '/api/v5/trade/fills?instType=SPOT';
    if (ordId) {
      path = path + '&ordId=' + ordId;
    }
    const body = await this.getData(api, path);
    return body.data;
  }

  async spotTradeOrder(api: API, instId: string, ordId: string): Promise<any> {
    const path = `/api/v5/trade/order?instId=${instId}&ordId=${ordId}`;
    const body = await this.getData(api, path);
    return body.data[0];
  }

  async pendingOrders(api: API): Promise<any[]> {
    const path = '/api/v5/trade/orders-pending?instType=SPOT';
    const body = await this.getData(api, path);
    return body.data;
  }

  async placeOrder(api: API, order: OrderForm): Promise<{ clOrdId: string }> {
    const paramObj: any = {
      instId: order.symbol,
      tdMode: 'cash',
      side: order.side,
      ordType: order.type
    };
    if (order.quantity) {
      paramObj.sz = '' + order.quantity;
      paramObj.tgtCcy = 'base_ccy';
    } else if (order.quoteQuantity) {
      paramObj.sz = '' + order.quoteQuantity;
      paramObj.tgtCcy = 'quote_ccy';
    } else {
      throw new Error('quantity/quoteOrderQty 须设置其一');
    }
    if (order.type === 'limit') {
      if (order.priceStr) {
        paramObj.px = order.priceStr;
      } else {
        throw new Error('未设置限价');
      }
    }
    if (order.clientOrderId) {
      paramObj.clOrdId = order.clientOrderId;
    }

    const res = await this.post(api, '/api/v5/trade/order', paramObj);
    if (res.code !== '0') {
      throw new Error(res.data[0].sMsg);
    }
    return res;
  }

  async cancelOrder(api: API, cancelOrderForm: CancelOrderForm): Promise<any> {
    const paramObj: any = {
      instId: cancelOrderForm.symbol,
      ordId: cancelOrderForm.orderId
    };

    const res = await this.post(api, '/api/v5/trade/cancel-order', paramObj);
    if (res.code !== '0') {
      throw new Error(res.data[0].sMsg);
    }
    return res;
  }

}
