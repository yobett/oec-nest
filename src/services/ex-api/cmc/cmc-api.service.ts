import { HttpService, Injectable } from '@nestjs/common';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { catchError } from 'rxjs/operators';
import { Config } from '../../../common/config';
import { CcyMeta } from '../../../models/mar/ccy-meta';
import { API } from '../../../models/sys/exapi';
import { defaultReqConfig } from '../../../common/utils';
import { CcyListingWithStatus } from '../../../models/mar/ccy-listing-item';

export interface ListingOptions {
  convert?: string;
  sort?: string;
  sort_dir?: 'asc' | 'desc';
  aux?: string;
  start?: string | number; // 1 based
  limit?: string | number; // default: first 100
}

@Injectable()
export class CmcApiService {

  apiBase = Config.CMC_API.BASE_URL;

  constructor(private httpService: HttpService) {
  }

  private async getData(api: API, path: string): Promise<any> {
    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    const url = this.apiBase + path;
    console.log('-> ' + url)

    const headers = {
      'X-CMC_PRO_API_KEY': api.key,
      Accept: 'application/json',
      decompress: true
    };
    const requestConfig: AxiosRequestConfig = defaultReqConfig();
    requestConfig.headers = headers;
    const res: AxiosResponse = await this.httpService
      .get(url, requestConfig)
      .pipe(catchError(error => {
        if (error.response) {
          const resp = error.response;
          console.error('Response: ' + resp.status);
          // console.error(resp.headers);
          const data = resp.data;
          if (data) {
            console.error('Response Body:');
            console.error(data);
            if (data.status) {
              const err = new Error(data.status['error_message']);
              err['status'] = resp.status;
              throw err;
            }
          }
        }
        throw error;
      })).toPromise();
    return res.data;
  }

  async coinsMap(api: API, opts: {
    start?: string | number, // 1 based
    limit?: string | number //  1 .. 5000, default: first 100
  } = {}): Promise<any> {
    let paramStr = `?sort=cmc_rank`;
    if (opts.start) {
      paramStr = paramStr + '&start=' + opts.start;
    }
    if (opts.limit) {
      paramStr = paramStr + '&limit=' + opts.limit;
    }
    const path = '/v1/cryptocurrency/map' + paramStr;
    const body = await this.getData(api, path);
    return body.data;
  }

  async metadata(api: API, symbols: string[], aux?: string): Promise<{ [symbol: string]: CcyMeta }> {
    symbols = symbols.filter(s => /^[A-Za-z0-9]+$/.test(s));
    const symbolStr = symbols.join(',');
    let paramStr = `?symbol=${symbolStr}`;
    if (aux) {
      paramStr = paramStr + '&aux=' + aux;
    }
    const path = '/v1/cryptocurrency/info' + paramStr;
    const body = await this.getData(api, path);
    return body.data;
  }

  async quotes(api: API, symbols: string[], convert?: string, aux?: string): Promise<any> {
    symbols = symbols.filter(s => /^[A-Za-z0-9]+$/.test(s));
    const symbolStr = symbols.join(',');
    convert ||= 'USD';
    aux ||= 'cmc_rank';
    const paramStr = `?symbol=${symbolStr}&convert=${convert}&aux=${aux}`;
    const path = '/v1/cryptocurrency/quotes/latest' + paramStr;
    const body = await this.getData(api, path);
    return body.data;
  }

  async listings(api: API, opts: ListingOptions = {}): Promise<CcyListingWithStatus> {
    let paramStr = `?convert=${opts.convert || 'USD'}`;
    if (opts.sort) {
      paramStr = paramStr + '&sort=' + opts.sort;
    }
    if (opts.sort_dir) {
      paramStr = paramStr + '&sort_dir=' + opts.sort_dir;
    }
    if (opts.aux) {
      paramStr = paramStr + '&aux=' + opts.aux;
    }
    if (opts.start) {
      paramStr = paramStr + '&start=' + opts.start;
    }
    if (opts.limit) {
      paramStr = paramStr + '&limit=' + opts.limit;
    }
    const path = '/v1/cryptocurrency/listings/latest' + paramStr;
    return await this.getData(api, path);
  }


}
