import { Injectable } from '@nestjs/common';
import { Console } from 'nestjs-console';
import { groupBy } from 'lodash';

import { ExPair, PairBQ } from '../../models/mar/ex-pair';
import { Exch } from '../../models/sys/exch';
import { BaPubApiService } from '../ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../ex-api/hb/hb-pub-api.service';
import { Ccy } from '../../models/mar/ccy';
import { API, Exapi } from '../../models/sys/exapi';
import { Quote } from '../../models/mar/quote';
import { CcysService } from './ccys.service';
import { CmcApiService } from '../ex-api/cmc/cmc-api.service';
import { ExapisService } from '../sys/exapis.service';
import { ExPairsService } from './pairs.service';

export declare type CurrentPrice = { source: string, price: number };
export declare type CurrentPrices = { [key: string]: CurrentPrice };

export interface PriceRequest extends PairBQ{
  ex: string;
}

export interface PriceResponse extends PriceRequest {
  symbol: string;
  price: number;
}


@Injectable()
@Console({
  command: 'price',
  description: 'PriceService'
})
export class CurrentPriceService {

  constructor(protected pairsService: ExPairsService,
              protected baPubApiService: BaPubApiService,
              protected oePubApiService: OePubApiService,
              protected hbPubApiService: HbPubApiService,
              protected ccysService: CcysService,
              protected cmcApiService: CmcApiService,
              protected exapisService: ExapisService
  ) {
  }

  async ccyQuote(symbol: string, convert?: string): Promise<Quote> {

    convert = convert || 'USD';
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const quoteRes = await this.cmcApiService.quotes(api, [symbol], convert);

    const cq = quoteRes[symbol];
    if (!cq) {
      return null;
    }
    const quote: Quote = cq.quote[convert];
    quote.symbol = symbol;
    return quote;
  }

  async ccyQuotes(convert?: string): Promise<Quote[]> {

    const list: Ccy[] = await this.ccysService.findConcerned();
    if (list.length === 0) {
      return [];
    }
    const symbols = list.map(c => c.code);

    convert = convert || 'USD';
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const quoteRes = await this.cmcApiService.quotes(api, symbols, convert);

    const quotes: Quote[] = [];
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    for (const c in quoteRes) {
      if (!hasOwnProperty.call(quoteRes, c)) {
        continue;
      }
      const cq = quoteRes[c];
      const symbol = cq.symbol;
      const quote: Quote = cq.quote[convert];
      if (symbol && quote) {
        quote.symbol = symbol;
        quotes.push(quote);
      }
    }

    return quotes;
  }


  pairPriceKey(pair: ExPair): string {
    return `${pair.baseCcy}-${pair.quoteCcy}`;
  }

  async buildPriceMapBA(): Promise<Map<string, number>> {
    const inquireResult = await this.baPubApiService.tickerPrice();
    const pricesMap = new Map<string, number>();
    for (const {symbol, price} of inquireResult) {
      pricesMap.set(symbol, +price);
    }
    return pricesMap;
  }

  protected async inquirePricesBA(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

    const leftPairs: ExPair[] = [];

    if (pairs.length <= 3) {
      for (const pair of pairs) {
        if (!pair.baSymbol) {
          leftPairs.push(pair);
          continue;
        }
        const ticker = await this.baPubApiService.tickerPrice(pair.baSymbol);
        if (!ticker) {
          leftPairs.push(pair);
          continue;
        }
        const price = +ticker.price;
        const key = this.pairPriceKey(pair);
        prices[key] = {
          source: Exch.CODE_BA, price
        };
      }
    }

    const pricesMap = await this.buildPriceMapBA();

    for (const pair of pairs) {
      if (pair.baSymbol) {
        const price = pricesMap.get(pair.baSymbol);
        if (price) {
          const key = this.pairPriceKey(pair);
          prices[key] = {
            source: Exch.CODE_BA, price
          };
          continue;
        }
      }
      leftPairs.push(pair);
    }

    return leftPairs;
  }


  async buildPriceMapHB(): Promise<Map<string, number>> {
    const inquireResult = await this.hbPubApiService.tickers();
    const pricesMap = new Map<string, number>();
    for (const {symbol, close} of inquireResult) {
      pricesMap.set(symbol, close);
    }
    return pricesMap;
  }

  protected async inquirePricesHB(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

    const leftPairs: ExPair[] = [];

    if (pairs.length <= 3) {
      for (const pair of pairs) {
        if (!pair.hbSymbol) {
          leftPairs.push(pair);
          continue;
        }
        const price = await this.hbPrice(pair.hbSymbol);
        if (price) {
          const key = this.pairPriceKey(pair);
          prices[key] = {
            source: Exch.CODE_HB, price
          };
        } else {
          leftPairs.push(pair);
        }
      }
      return leftPairs;
    }

    const pricesMap = await this.buildPriceMapHB();

    for (const pair of pairs) {
      if (pair.hbSymbol) {
        const price = pricesMap.get(pair.hbSymbol);
        if (price) {
          const key = this.pairPriceKey(pair);
          prices[key] = {
            source: Exch.CODE_HB, price
          };
          continue;
        }
      }
      leftPairs.push(pair);
    }

    return leftPairs;
  }

  async buildPriceMapOE(): Promise<Map<string, number>> {
    const inquireResult = await this.oePubApiService.tickers();
    const pricesMap = new Map<string, number>();
    for (const {instId, last} of inquireResult) {
      pricesMap.set(instId, +last);
    }
    return pricesMap;
  }


  protected async inquirePricesOE(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

    const leftPairs: ExPair[] = [];

    if (pairs.length <= 3) {
      for (const pair of pairs) {
        if (!pair.oeSymbol) {
          leftPairs.push(pair);
          continue;
        }
        const ticker = await this.oePubApiService.ticker(pair.oeSymbol);
        if (!ticker || !ticker[0]) {
          leftPairs.push(pair);
          continue;
        }
        const key = this.pairPriceKey(pair);
        const price = +ticker[0].last;
        prices[key] = {source: Exch.CODE_OE, price};
      }
      return leftPairs;
    }

    const pricesMap = await this.buildPriceMapOE();

    for (const pair of pairs) {
      if (pair.oeSymbol) {
        const price = pricesMap.get(pair.oeSymbol);
        if (price) {
          const key = this.pairPriceKey(pair);
          prices[key] = {
            source: Exch.CODE_OE, price
          };
          continue;
        }
      }
      leftPairs.push(pair);
    }

    return leftPairs;
  }

  async inquireConcernedPrices(preferDS: string = null): Promise<CurrentPrices> {

    const pairs = await this.pairsService.findConcerned();

    const prices: CurrentPrices = {};
    let leftPairs: ExPair[] = pairs;

    const actions = {
      [Exch.CODE_BA]: (leftPairs, prices) => this.inquirePricesBA(leftPairs, prices),
      [Exch.CODE_HB]: (leftPairs, prices) => this.inquirePricesHB(leftPairs, prices),
      [Exch.CODE_OE]: (leftPairs, prices) => this.inquirePricesOE(leftPairs, prices),
    };

    const exchs = [Exch.CODE_BA, Exch.CODE_HB, Exch.CODE_OE];
    const dataSources = preferDS ? [preferDS].concat(exchs.filter(ex => ex !== preferDS)) : exchs;

    for (let dsi = 0; dsi < dataSources.length; dsi++) {
      const ds = dataSources[dsi];
      const action = actions[ds];
      if (!action) {
        throw new Error('未知交易所');
      }
      // const pairsStr = leftPairs.map(p => `${p.baseCcy}-${p.quoteCcy}`).join(' ');
      // console.log(`${dsi} Inquire Prices ${ds}: ${pairsStr}`);
      leftPairs = await action(leftPairs, prices);
      if (leftPairs.length === 0) {
        return prices;
      }
    }

    return prices;
  }

  async inquirePrice(ex: string, symbol: string): Promise<number | string> {
    if (ex === Exch.CODE_OE) {
      const ticker = await this.oePubApiService.ticker(symbol);
      if (!ticker || !ticker[0]) {
        return undefined;
      }
      return ticker[0].last;
    }
    if (ex === Exch.CODE_BA) {
      const ticker = await this.baPubApiService.tickerPrice(symbol);
      if (!ticker) {
        return undefined;
      }
      return ticker.price;
    }
    if (ex === Exch.CODE_HB) {
      return await this.hbPrice(symbol);
    }
  }

  async inquirePricesEx(priceRequests: PriceRequest[]): Promise<PriceResponse[]> {

    const pairs = await this.pairsService.findPairs(priceRequests);
    const pairsMap: Map<string, ExPair> = new Map<string, ExPair>(pairs.map(p => [p.baseCcy, p]));

    const exGroups = groupBy(priceRequests, 'ex');

    const actions = {
      [Exch.CODE_BA]: (leftPairs, prices) => this.inquirePricesBA(leftPairs, prices),
      [Exch.CODE_HB]: (leftPairs, prices) => this.inquirePricesHB(leftPairs, prices),
      [Exch.CODE_OE]: (leftPairs, prices) => this.inquirePricesOE(leftPairs, prices),
    };

    const prices: CurrentPrices = {};
    const promises: Promise<ExPair[]>[] = [];
    const requestWithPairs: (PriceRequest & { pair: ExPair })[] = [];

    for (const ex of [Exch.CODE_BA, Exch.CODE_HB, Exch.CODE_OE]) {
      const exGroup = exGroups[ex];
      if (!exGroup) {
        continue;
      }
      const pairs: ExPair[] = [];
      for (const priceRequest of exGroup) {
        const pair: ExPair = pairsMap.get(priceRequest.baseCcy);
        if (pair) {
          pairs.push(pair);
        }
        requestWithPairs.push({...priceRequest, pair});
      }
      promises.push(actions[ex](pairs, prices));
    }

    await Promise.all(promises);

    return requestWithPairs.map(rp => {
      const {baseCcy, ex, pair} = rp;
      let symbol = undefined;
      let price = undefined;
      if (pair) {
        symbol = pair[ex + 'Symbol'];
        const key = this.pairPriceKey(pair);
        const cp: CurrentPrice = prices[key];
        if (cp) {
          price = cp.price;
        }
      }
      return {baseCcy, ex, symbol, price} as PriceResponse;
    });
  }

  protected async hbPrice(symbol: string): Promise<number | undefined> {
    const ticker = await this.hbPubApiService.merged(symbol);
    if (!ticker) {
      return undefined;
    }
    const {bid, ask} = ticker;
    const highestBuyPrice = bid[0];
    const lowestSellPrice = ask[0];
    if (!highestBuyPrice) {
      return lowestSellPrice;
    }
    if (!lowestSellPrice) {
      return highestBuyPrice;
    }
    return (highestBuyPrice + lowestSellPrice) / 2;
  }

}
