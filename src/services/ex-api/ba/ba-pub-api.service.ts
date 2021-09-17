import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Config } from '../../../common/config';
import { Kline } from '../../../models/mar/kline';
import { defaultReqConfig } from '../../../common/utils';

@Injectable()
export class BaPubApiService {

  apiBase = Config.BA_API.BASE_URL;

  constructor(private httpService: HttpService) {
  }

  private async getData(path: string): Promise<any> {
    const url = this.apiBase + path;
    console.log('-> ' + url)
    const reqConfig: AxiosRequestConfig = defaultReqConfig();
    const res: AxiosResponse = await this.httpService.get(url, reqConfig).toPromise();
    return res.data;
  }

  async ping(): Promise<any> {
    return this.getData('/api/v3/ping');
  }

  async time(): Promise<any> {
    const data = await this.getData('/api/v3/time');
    const time = new Date(data.serverTime);
    data.serverTimeStr = time.toISOString();
    return data;
  }

  async exchangeInfoAll(): Promise<any> {
    return this.getData('/api/v3/exchangeInfo');
  }

  async exchangeInfo(symbol: string): Promise<any> {
    const path = '/api/v3/exchangeInfo?symbol=' + symbol;
    return this.getData(path);
  }

  async exchangeInfoSymbols(symbols: string[]): Promise<any> {
    const path = '/api/v3/exchangeInfo?symbol=' + JSON.stringify(symbols);
    return this.getData(path);
  }

  // interval: 1m/3m/5m/15m/30m/1h/2h/4h/6h/8h/12h/1d/3d/1w/1M
  async klines(symbol: string, interval: string,
               opts: {
                 limit?: number, // default 500, max 1000
                 startTime?: number,
                 endTime?: number
               } = {}): Promise<Kline[]> {
    let path = '/api/v3/klines?symbol=' + symbol + '&interval=' + interval;
    if (opts.startTime) {
      path = path + '&startTime=' + opts.startTime;
    }
    if (opts.endTime) {
      path = path + '&endTime=' + opts.endTime;
    }
    if (opts.limit) {
      path = path + '&limit=' + opts.limit;
    }

    const klines: any[] = await this.getData(path);
    return klines.map((kline: any[]) => {
      kline = kline.map(n => +n);
      const [
        ts, open, high, low, close, vol, closeTs, volCcy, num
      ] = kline;
      return {
        ts, open, high, low, close,
        // vol, volQuote: volCcy
      } as Kline;
    });
  }

  async avgPrice(symbol: string): Promise<any> {
    const path = '/api/v3/avgPrice?symbol=' + symbol;
    return this.getData(path);
  }

  async ticker24h(symbol: string): Promise<any> {
    const path = '/api/v3/ticker/24hr?symbol=' + symbol;
    return this.getData(path);
  }

  async tickerPrice(symbol?: string): Promise<any> {
    let path = '/api/v3/ticker/price';
    if (symbol) {
      path = path + '?symbol=' + symbol;
    }
    return this.getData(path);
  }

}
