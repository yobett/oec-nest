import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { catchError } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Config } from '../../../common/config';
import { API } from '../../../models/sys/exapi';
import { CancelOrderForm, OrderForm } from '../order-form';
import { defaultReqConfig } from '../../../common/utils';

@Injectable()
export class BaPriApiService {

  apiBase = Config.BA_API.BASE_URL;

  constructor(private httpService: HttpService) {
  }

  private genReqConfig(api: API): AxiosRequestConfig {
    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    requestConfig.headers = {'X-MBX-APIKEY': api.key};
    return requestConfig;
  }

  private signParams(api: API, paramsWithoutTs?: string): string {

    const timestamp = new Date().getTime();
    let paramString = 'timestamp=' + timestamp;
    if (paramsWithoutTs) {
      paramString = paramString + '&' + paramsWithoutTs;
    }

    const hmac = crypto.createHmac('sha256', api.secret);
    hmac.update(paramString);
    const sign = hmac.digest('hex');

    return paramString + '&signature=' + sign;
  }

  private async getData(api: API, path: string, paramsWithoutTs?: string): Promise<any> {
    if (!api) {
      throw new Error('API未配置（BA）');
    }

    const paramString = this.signParams(api, paramsWithoutTs);
    const url = this.apiBase + path + '?' + paramString;
    console.log('-> ' + url);

    const requestConfig = this.genReqConfig(api);
    const res: AxiosResponse = await this.httpService.get(url, requestConfig).toPromise();
    return res.data;
  }

  private async post(api: API, path: string, paramsWithoutTs?: string): Promise<any> {
    if (!api) {
      throw new Error('API未配置（BA）');
    }

    const paramString = this.signParams(api, paramsWithoutTs);
    const url = this.apiBase + path;
    console.log('-> ' + url);
    console.log('-> ' + paramString);

    const requestConfig = this.genReqConfig(api);
    const res: AxiosResponse = await this.httpService.post(url, paramString, requestConfig)
      .pipe(catchError(error => {
        if (error.response) {
          const resp = error.response;
          console.error('Response: ' + resp.status);
          // console.error(resp.headers);
          const data = resp.data;
          if (data) {
            // data: { code: -1013, msg: 'Filter failure: MIN_NOTIONAL' }
            console.error('Response Body:');
            console.error(data);
            if (data.msg) {
              const err = new Error(data.msg);
              err['status'] = resp.status;
              throw err;
            }
          }
        }
        throw error;
      })).toPromise();
    return res.data;
  }

  private async delete(api: API, path: string, paramsWithoutTs?: string): Promise<any> {
    if (!api) {
      throw new Error('API未配置（BA）');
    }

    const paramString = this.signParams(api, paramsWithoutTs);
    const url = this.apiBase + path + '?' + paramString;
    console.log('-> ' + url);

    const requestConfig = this.genReqConfig(api);
    const res: AxiosResponse = await this.httpService.delete(url, requestConfig).toPromise();
    return res.data;
  }

  async account(api: API): Promise<any> {
    const body = await this.getData(api, '/api/v3/account');
    // body.balances = body.balances.filter(it => {
    //   const {free, locked} = it;
    //   return !(
    //     (free === '0.00' || free.startsWith('0.000')) &&
    //     (locked === '0.00' || locked.startsWith('0.000')))
    // });
    return body;
  }

  async trades(api: API, symbol: string): Promise<any> {
    const paramsWithoutTs = 'symbol=' + symbol;
    return this.getData(api, '/api/v3/myTrades', paramsWithoutTs);
  }

  async order(api: API, symbol: string, orderId: string): Promise<any> {
    const paramsWithoutTs = 'symbol=' + symbol + '&orderId=' + orderId;
    return this.getData(api, '/api/v3/order', paramsWithoutTs);
  }

  async orders(api: API, symbol: string, orderId?: string): Promise<any[]> {
    let paramsWithoutTs = 'symbol=' + symbol;
    if (orderId) {
      paramsWithoutTs = paramsWithoutTs + '&orderId=' + orderId;
    }
    return this.getData(api, '/api/v3/allOrders', paramsWithoutTs);
  }

  async openOrders(api: API, symbol?: string): Promise<any[]> {
    const paramsWithoutTs = symbol ? 'symbol=' + symbol : null;
    return this.getData(api, '/api/v3/openOrders', paramsWithoutTs);
  }

  async placeOrder(api: API, order: OrderForm): Promise<{ orderId: string }> {
    const orderType = order.type;
    let paramsWithoutTs = 'symbol=' + order.symbol + '&side=' + order.side + '&type=' + orderType.toUpperCase();
    if (order.quantity) {
      paramsWithoutTs += '&quantity=' + order.quantity;
    } else if (order.quoteQuantity) { // only type=market
      paramsWithoutTs += '&quoteOrderQty=' + order.quoteQuantity;
    } else {
      throw new Error('quantity/quoteOrderQty 须设置其一');
    }
    if (orderType === 'market') {
    } else if (orderType === 'limit') {
      paramsWithoutTs += '&timeInForce=GTC';
      if (order.priceStr) {
        paramsWithoutTs += '&price=' + order.priceStr;
      } else {
        throw new Error('限价未设置');
      }
    } else {
      throw new Error('未支持的订单类型：' + orderType);
    }
    if (order.clientOrderId) {
      paramsWithoutTs += '&newClientOrderId=' + order.clientOrderId;
    }

    return this.post(api, '/api/v3/order', paramsWithoutTs);
  }


  async cancelOrder(api: API, cancelOrderForm: CancelOrderForm): Promise<any> {
    const {symbol, orderId} = cancelOrderForm;
    const paramsWithoutTs = 'symbol=' + symbol + '&orderId=' + orderId;
    return this.delete(api, '/api/v3/order', paramsWithoutTs);
  }
}
