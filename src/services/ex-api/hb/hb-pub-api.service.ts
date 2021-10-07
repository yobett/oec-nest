import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Config } from '../../../common/config';
import { defaultReqConfig } from '../../../common/utils';
import { Kline } from '../../../models/mar/kline';

export type HbDepthData = {
  ts: number,
  version: number,
  bids: [[price: number, amount: number]],
  asks: [[price: number, amount: number]]
};

@Injectable()
export class HbPubApiService {

  apiBase = Config.HB_API.BASE_URL;

  constructor(private httpService: HttpService) {
  }

  private async getData(path: string): Promise<any> {
    const url = this.apiBase + path;
    console.log('-> ' + url)

    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    const res: AxiosResponse = await this.httpService.get(url, requestConfig).toPromise();
    return res.data;
  }

  async status(): Promise<any> {
    const body = await this.getData('/v2/market-status');
    return body.data;
  }

  async symbols(): Promise<any[]> {
    const body = await this.getData('/v1/common/symbols');
    return body.data;
  }

  async currencies(): Promise<any> {
    const body = await this.getData('/v1/common/currencys');
    return body.data;
  }

  async timestamp(): Promise<number> {
    const body = await this.getData('/v1/common/timestamp');
    return body.data;
  }

  async tickers(): Promise<any[]> {
    const body = await this.getData('/market/tickers');
    return body.data;
  }

  async merged(symbol: string): Promise<any> {
    const body = await this.getData('/market/detail/merged?symbol=' + symbol);
    return body.tick;
  }

  // period: 1min, 5min, 15min, 30min, 60min, 4hour, 1day, 1mon, 1week, 1year
  // K线周期以新加坡时间为基准开始计算，例如日K线的起始周期为新加坡时间0时至新加坡时间次日0时
  async klines(symbol: string,
               period: string,
               size?: number // default 150, max 2000
  ): Promise<Kline[]> {

    let url = '/market/history/kline?symbol=' + symbol + '&period=' + period;
    if (size) {
      url += '&size=' + size;
    }
    const body = await this.getData(url);
    const klines: any[] = body.data;
    return klines.map(kline => {
      const {
        id, open, high, low, close, amount, vol
      } = kline;
      return {
        ts: id * 1000, open, high, low, close,
        // vol: amount, volQuote: vol
      } as Kline;
    });
  }

  async depth(symbol: string, type = 'step3', depth = 20): Promise<HbDepthData> {
    // type: step0，step1，step2，step3，step4，step5
    const body = await this.getData(`/market/depth?symbol=${symbol}&type=${type}&depth=${depth}`);
    return body.tick as HbDepthData;
  }

}
