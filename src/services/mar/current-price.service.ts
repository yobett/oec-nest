import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Command, Console, createSpinner } from 'nestjs-console';

import { ExPair } from '../../models/mar/ex-pair';
import { Exch } from '../../models/sys/exch';
import { BaPubApiService } from '../ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../ex-api/hb/hb-pub-api.service';
import { Arbitrage, PairModel, Ring, ValueChain } from './arbitrage';

export declare type CurrentPrice = { source: string, price: number };
export declare type CurrentPrices = { [key: string]: CurrentPrice };

export interface ArbAnalysing {
  rings: Ring[];
  routes: ValueChain[];
}

@Injectable()
@Console({
  command: 'price',
  description: 'PriceService'
})
export class CurrentPriceService {

  constructor(@InjectRepository(ExPair)
              protected pairsRepository: Repository<ExPair>,
              protected baPubApiService: BaPubApiService,
              protected oePubApiService: OePubApiService,
              protected hbPubApiService: HbPubApiService,
  ) {
  }


  private pairPriceKey(pair: ExPair): string {
    return `${pair.baseCcy}-${pair.quoteCcy}`;
  }

  private async buildPriceMapBA(): Promise<Map<string, number>> {
    const inquireResult = await this.baPubApiService.tickerPrice();
    const pricesMap = new Map<string, number>();
    for (const {symbol, price} of inquireResult) {
      pricesMap.set(symbol, +price);
    }
    return pricesMap;
  }

  private async inquirePricesBA(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

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


  private async buildPriceMapHB(): Promise<Map<string, number>> {
    const inquireResult = await this.hbPubApiService.tickers();
    const pricesMap = new Map<string, number>();
    for (const {symbol, close} of inquireResult) {
      pricesMap.set(symbol, close);
    }
    return pricesMap;
  }

  private async inquirePricesHB(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

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

  private async buildPriceMapOE(): Promise<Map<string, number>> {
    const inquireResult = await this.oePubApiService.tickers();
    const pricesMap = new Map<string, number>();
    for (const {instId, last} of inquireResult) {
      pricesMap.set(instId, +last);
    }
    return pricesMap;
  }


  private async inquirePricesOE(pairs: ExPair[], prices: CurrentPrices): Promise<ExPair[]> {

    const leftPairs: ExPair[] = [];

    if (pairs.length <= 3) {
      for (const pair of pairs) {
        if (!pair.oeSymbol) {
          leftPairs.push(pair);
          continue;
        }
        const ticker = this.oePubApiService.ticker(pair.oeSymbol);
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

  async inquireConcernedPrices(): Promise<CurrentPrices> {

    const pairs = await this.pairsRepository.find({concerned: true});

    const prices: CurrentPrices = {};
    let leftPairs: ExPair[] = pairs;

    // console.log('1 Inquire Prices, All: ' + leftPairs.map(p => `${p.baseCcy}-${p.quoteCcy}`).join(' '));
    leftPairs = await this.inquirePricesBA(leftPairs, prices);
    if (leftPairs.length === 0) {
      return prices;
    }

    // console.log('2 Inquire Prices, After BA: ' + leftPairs.map(p => `${p.baseCcy}-${p.quoteCcy}`).join(' '));
    leftPairs = await this.inquirePricesHB(leftPairs, prices);
    if (leftPairs.length === 0) {
      return prices;
    }

    // console.log('3 Inquire Prices, After HB: ' + leftPairs.map(p => `${p.baseCcy}-${p.quoteCcy}`).join(' '));
    leftPairs = await this.inquirePricesOE(leftPairs, prices);
    if (leftPairs.length === 0) {
      return prices;
    }
    // console.log('4 Inquire Prices, After OE: ' + leftPairs.map(p => `${p.baseCcy}-${p.quoteCcy}`).join(' '));

    return prices;
  }


  async checkArbBA(allPairs?: ExPair[]): Promise<ArbAnalysing> {
    if (!allPairs) {
      allPairs = await this.pairsRepository.find();
    }
    const pairs = allPairs.filter(p => p.baSymbol);

    const arb = new Arbitrage(pairs as PairModel[]);
    arb.findRings();
    // arb.printRings();

    console.log('-----');
    console.log('BA:');

    const rings = arb.rings;
    if (rings.length === 0) {
      return {
        rings,
        routes: []
      };
    }

    const pricesMap = await this.buildPriceMapBA();

    const baseQuotePricesMap = new Map<string, number>();
    for (const pair of pairs) {
      const price = pricesMap.get(pair.baSymbol);
      baseQuotePricesMap.set(this.pairPriceKey(pair), price);
    }

    arb.buildValueChains(baseQuotePricesMap);
    arb.printArbs();

    return {
      rings,
      routes: arb.arbRoutes
    };
  }

  async checkArbOE(allPairs?: ExPair[]): Promise<ArbAnalysing> {
    if (!allPairs) {
      allPairs = await this.pairsRepository.find();
    }
    const pairs = allPairs.filter(p => p.oeSymbol);

    const arb = new Arbitrage(pairs as PairModel[]);
    arb.findRings();
    // arb.printRings();
    console.log('-----');
    console.log('OE:');

    const rings = arb.rings;
    if (rings.length === 0) {
      return {
        rings,
        routes: []
      };
    }

    const baseQuotePricesMap = await this.buildPriceMapOE();

    arb.buildValueChains(baseQuotePricesMap);
    arb.printArbs();

    return {
      rings,
      routes: arb.arbRoutes
    };
  }

  async checkArbHB(allPairs?: ExPair[]): Promise<ArbAnalysing> {
    if (!allPairs) {
      allPairs = await this.pairsRepository.find();
    }
    const pairs = allPairs.filter(p => p.hbSymbol);

    const arb = new Arbitrage(pairs as PairModel[]);
    arb.findRings();
    // arb.printRings();
    console.log('-----');
    console.log('HB:');

    const rings = arb.rings;
    if (rings.length === 0) {
      return {
        rings,
        routes: []
      };
    }

    const pricesMap = await this.buildPriceMapHB();
    const baseQuotePricesMap = new Map<string, number>();
    for (const pair of pairs) {
      const price = pricesMap.get(pair.hbSymbol);
      baseQuotePricesMap.set(this.pairPriceKey(pair), price);
    }

    arb.buildValueChains(baseQuotePricesMap);

    arb.buildValueChains(baseQuotePricesMap);
    arb.printArbs();

    return {
      rings,
      routes: arb.arbRoutes
    };
  }

  async checkArbitrage(): Promise<void> {
    const allPairs = await this.pairsRepository.find();

    // TODO: return value

    await this.checkArbBA(allPairs);
    await this.checkArbOE(allPairs);
    await this.checkArbHB(allPairs);
  }

  @Command({
    command: 'arbitrage',
    description: '套利发现'
  })
  async checkArbitrage2(): Promise<void> {
    const spin = createSpinner();
    spin.start(`套利发现 `);
    await this.checkArbitrage();
    spin.succeed('完成');
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

  private async hbPrice(symbol: string): Promise<number | undefined> {
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
