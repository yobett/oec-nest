import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { JSDOM } from 'jsdom';
import { join } from 'path';
import { Config } from '../../../common/config';
import { download, defaultReqConfig } from '../../../common/utils';
import { CreateCcyDto } from '../../../models/mar/ccy';
import { Kline } from '../../../models/mar/kline';

@Injectable()
export class OePubApiService {

  apiBase = Config.OE_API.BASE_URL;

  constructor(private httpService: HttpService) {
  }

  private async getData(path: string): Promise<any> {
    const url = this.apiBase + path;
    console.log('-> ' + url)

    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    const res: AxiosResponse = await this.httpService.get(url, requestConfig).toPromise();
    return res.data;
  }

  async instrumentsAll(): Promise<any> {
    const path = '/api/v5/public/instruments?instType=SPOT';
    const body = await this.getData(path);
    return body.data;
  }

  async instruments(instId: string): Promise<any> {
    const path = '/api/v5/public/instruments?instType=SPOT&instId=' + instId;
    const body = await this.getData(path);
    return body.data;
  }

  async tickers(): Promise<any> {
    const path = '/api/v5/market/tickers?instType=SPOT';
    const body = await this.getData(path);
    return body.data;
  }

  async ticker(instId: string): Promise<any> {
    const path = '/api/v5/market/ticker?instId=' + instId;
    const body = await this.getData(path);
    return body.data;
  }


  async coins(): Promise<CreateCcyDto[]> {

    // https://www.okex.com/markets/prices
    const urlBase = 'http://localhost:3001';
    const dom = await JSDOM.fromURL(urlBase + '/currs.html');
    const document = dom.window.document;
    const coinsTable = document.querySelector('#root div.market-list-main.coin table.table-box.token-list-table');
    const coinTrs = coinsTable.querySelectorAll('tbody tr');

    const ccys = [];
    let no = 0;
    for (const coinTr of coinTrs) {
      no++;
      const nameTd = coinTr.querySelector('td.name');
      const code = nameTd.querySelector('.short-name').textContent;
      const name = nameTd.querySelector('.full-name').textContent;
      const img = nameTd.querySelector('picture.token-icon img') as HTMLImageElement;
      const file = code + '.png';

      const ccyDto = new CreateCcyDto();
      ccyDto.code = code;
      ccyDto.name = name;
      ccyDto.no = no;

      const imgUrl = img.src;
      if (imgUrl) {
        try {
          const coinsDir = Config.STATIC_RES_DIR.coins;
          await download(imgUrl, join(coinsDir, file));
          ccyDto.logoPath = coinsDir + '/' + file;
        } catch (e) {
          console.error(e);
          console.error(no + ' ' + code + ': ' + imgUrl);
        }
      }

      ccys.push(ccyDto);
    }

    return ccys;
  }

  // bar: 1m/3m/5m/15m/30m/1H/2H/4H/6H/12H/1D/1W/1M/3M/6M/1Y
  // limit: default 100, max 100
  async getCandles(path: string, instId: string, bar: string,
                   opts: {
                     limit?: number,
                     olderThan?: number,
                     newerThan?: number
                   } = {}): Promise<Kline[]> {
    path = path + '?instId=' + instId + '&bar=' + bar;
    if (opts.olderThan) {
      path = path + '&after=' + opts.olderThan;
    }
    if (opts.newerThan) {
      path = path + '&before=' + opts.newerThan;
    }
    if (opts.limit) {
      path = path + '&limit=' + opts.limit;
    }
    const body = await this.getData(path);

    const klines: any[] = await body.data;
    return klines.map((kline: any[]) => {
      kline = kline.map(n => +n);
      const [
        ts, open, high, low, close, vol, volCcy
      ] = kline;
      return {
        ts, open, high, low, close,
        // vol, volQuote: volCcy
      } as Kline;
    });
  }

  async candles(instId: string, bar: string,
                opts: {
                  limit?: number,
                  olderThan?: number,
                  newerThan?: number
                } = {}): Promise<Kline[]> {
    return this.getCandles('/api/v5/market/candles', instId, bar, opts);
  }

  async indexCandles(instId: string, bar: string,
                     opts: {
                       limit?: number,
                       olderThan?: number,
                       newerThan?: number
                     } = {}): Promise<Kline[]> {
    return this.getCandles('/api/v5/market/index-candles', instId, bar, opts);
  }

  async markPriceCandles(instId: string, bar: string,
                         opts: {
                           limit?: number,
                           olderThan?: number,
                           newerThan?: number
                         } = {}): Promise<Kline[]> {
    return this.getCandles('/api/v5/market/mark-price-candles', instId, bar, opts);
  }

}
