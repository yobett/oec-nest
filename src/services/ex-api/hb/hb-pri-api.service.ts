import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import * as moment from 'moment';

import { Config } from '../../../common/config';
import { API } from '../../../models/sys/exapi';
import { CancelOrderForm, OrderForm } from '../order-form';
import { defaultReqConfig } from '../../../common/utils';


declare type ParamPairs = [string, string][];

@Injectable()
export class HbPriApiService {
  constructor(private httpService: HttpService) {
  }

  apiBase = Config.HB_API.BASE_URL;

  private signParams(api: API, method: string, path: string, params?: ParamPairs): string {
    const timeStr = new Date().toISOString().substring(0, 19);
    let params2 = [
      ['AccessKeyId', api.key],
      ['SignatureMethod', 'HmacSHA256'],
      ['SignatureVersion', '2'],
      ['Timestamp', encodeURIComponent(timeStr)]
    ];
    if (params) {
      params2 = params2.concat(params);
    }

    params2.sort(
      (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [name1, value1], [name2, value2]
      ) => name1 <= name2 ? -1 : 1);

    const paramsString = params2.map(([name, value]) => `${name}=${value}`).join('&');

    const signSrc = [method, Config.HB_API.DOMAIN, path, paramsString].join('\n');
    const hmac = crypto.createHmac('sha256', api.secret);
    hmac.update(signSrc);
    const sign = hmac.digest('base64');
    const encodedSign = encodeURIComponent(sign);

    return paramsString + `&Signature=${encodedSign}`;
  }

  private async getData(api: API, path: string, params?: ParamPairs): Promise<any> {
    if (!api) {
      throw new Error('API未配置（HB）');
    }

    const paramsString = this.signParams(api, 'GET', path, params);
    const url = `${this.apiBase}${path}?${paramsString}`;
    console.log('-> ' + url);

    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    const res: AxiosResponse = await this.httpService.get(url, requestConfig).toPromise();
    const body = await res.data;
    if (body.status === 'error') {
      console.error(body);
      throw new Error(body['err-msg']);
    }
    return body;
  }

  private async post(api: API, path: string, paramObj: any): Promise<any> {
    if (!api) {
      throw new Error('API未配置（HB）');
    }

    const paramsString = this.signParams(api, 'POST', path);
    const url = `${this.apiBase}${path}?${paramsString}`;
    console.log('-> ' + url);

    const data = paramObj ? JSON.stringify(paramObj) : '';
    console.log('-> ' + data);

    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    requestConfig.headers = {
      'Accept': 'application/json',
      'Content-type': 'application/json'
    };
    const res: AxiosResponse = await this.httpService.post(url, data, requestConfig).toPromise();
    const body = await res.data;
    if (body.status === 'error') {
      console.error(body);
      throw new Error(body['err-msg']);
    }
    return body;
  }


  async accounts(api: API): Promise<any[]> {
    const body = await this.getData(api, '/v1/account/accounts');
    return body.data;
  }

  async getSpotAccount(api: API): Promise<any> {
    const accounts = await this.accounts(api);
    const spotAccount = accounts.find(acc => acc.type === 'spot');
    if (!spotAccount) {
      throw new Error('现货账户未找到');
    }
    return spotAccount;
  }

  async balance(api: API): Promise<any> {
    const spotAccount = await this.getSpotAccount(api);
    const body = await this.getData(api, `/v1/account/accounts/${spotAccount.id}/balance`);
    return body.data;
  }

  // BTC、CNY、USD、...
  async valuation(api: API, valuationCurrency: string): Promise<any> {
    const params: ParamPairs = [
      ['accountType', 'spot'],
      ['valuationCurrency', valuationCurrency]
    ];
    const body = await this.getData(api, '/v2/account/asset-valuation', params);
    return body.data;
  }


  async ordersLatest2d(api: API): Promise<any[]> {
    const body = await this.getData(api, '/v1/order/history');
    return body.data;
  }

  async orders(api: API, symbol: string, opts?: { fromDate?: string | number, fromOrderId?: string }): Promise<any[]> {
    const states = 'created,submitted,partial-filled,filled,partial-canceled,canceled';
    let params: ParamPairs = [
      ['symbol', symbol],
      ['states', encodeURIComponent(states)]
    ];
    if (opts.fromDate) {
      let ts;
      if (typeof opts.fromDate === 'number') {
        ts = opts.fromDate;
      } else if (/^\d{13}$/.test(opts.fromDate)) {
        ts = +opts.fromDate;
      } else {
        const mom = moment(opts.fromDate);
        ts = mom.valueOf();
      }
      params.push(['start-time', '' + ts]);
    }
    if (opts.fromOrderId) {
      params = params.concat([
        ['from', opts.fromOrderId],
        ['direct', 'next']
      ]);
    }
    const body = await this.getData(api, '/v1/order/orders', params);
    return body.data;
  }

  async order(api: API, orderId: string): Promise<any> {
    const body = await this.getData(api, '/v1/order/orders/' + orderId);
    return body.data;
  }

  private async getOpenOrders(api: API, symbols: string[], accountId: string): Promise<any[]> {
    const symbolStr = symbols.join(',');
    const params: ParamPairs = [
      ['account-id', accountId],
      ['symbol', encodeURIComponent(symbolStr)]
    ];
    const body = await this.getData(api, '/v1/order/openOrders', params);
    return body.data;
  }

  async openOrders(api: API, symbols: string[]): Promise<any[]> {
    const spotAccount = await this.getSpotAccount(api);
    // Support 10 trading pairs at most
    const BATCH = 10;
    let orders = [];
    let start = 0;
    let end;
    while (true) {
      end = start + BATCH;
      if (end > symbols.length) {
        end = symbols.length;
      }
      const symbols2 = symbols.slice(start, end);
      const orders2 = await this.getOpenOrders(api, symbols2, spotAccount.id);
      orders = orders.concat(orders2);
      start += BATCH;
      if (start > symbols.length) {
        break;
      }
    }
    return orders;
  }

  async placeOrder(api: API, order: OrderForm): Promise<any> {
    const spotAccount = await this.getSpotAccount(api);
    const paramObj: any = {
      'account-id': '' + spotAccount.id,
      symbol: order.symbol,
      // buy-market, sell-market, buy-limit, sell-limit
      type: `${order.side}-${order.type}`
    };
    // amount: 订单交易量（市价买单为订单交易额）
    if (order.side === 'buy' && order.type === 'market') {
      paramObj.amount = '' + order.quoteQuantity;
    } else { // sell / limit
      paramObj.amount = '' + order.quantity;
    }
    if (order.type === 'limit') {
      if (order.price) {
        paramObj.price = '' + order.price;
      } else {
        throw new Error('限价未设置');
      }
    }
    if (order.clientOrderId) {
      paramObj['client-order-id'] = order.clientOrderId;
    }

    return this.post(api, '/v1/order/orders/place', paramObj);
  }

  async cancelOrder(api: API, cancelOrderForm: CancelOrderForm): Promise<any> {
    return this.post(api, `/v1/order/orders/${cancelOrderForm.orderId}/submitcancel`, null);
  }

}
