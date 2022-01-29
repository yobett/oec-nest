import { Injectable } from '@nestjs/common';
import { Command, Console, createSpinner } from 'nestjs-console';

import { ExPair } from '../../models/mar/ex-pair';
import { Arbitrage, Ring, ValueChain } from './arbitrage';
import { CurrentPriceService } from './current-price.service';
import { ExPairsService } from './pairs.service';

export interface ArbAnalysing {
  rings: Ring[];
  routes: ValueChain[];
}

@Injectable()
@Console({
  command: 'arbitrage',
  description: 'ArbitrageService'
})
export class ArbitrageService {

  constructor(protected pairsService: ExPairsService,
              protected priceService:CurrentPriceService
  ) {
  }


  async checkArbBA(allPairs?: ExPair[]): Promise<ArbAnalysing> {
    if (!allPairs) {
      allPairs = await this.pairsService.findAll();
    }
    const pairs = allPairs.filter(p => p.baSymbol);

    const arb = new Arbitrage(pairs);
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

    const pricesMap = await this.priceService.buildPriceMapBA();

    const baseQuotePricesMap = new Map<string, number>();
    for (const pair of pairs) {
      const price = pricesMap.get(pair.baSymbol);
      baseQuotePricesMap.set(this.priceService.pairPriceKey(pair), price);
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
      allPairs = await this.pairsService.findAll();
    }
    const pairs = allPairs.filter(p => p.oeSymbol);

    const arb = new Arbitrage(pairs);
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

    const baseQuotePricesMap = await this.priceService.buildPriceMapOE();

    arb.buildValueChains(baseQuotePricesMap);
    arb.printArbs();

    return {
      rings,
      routes: arb.arbRoutes
    };
  }

  async checkArbHB(allPairs?: ExPair[]): Promise<ArbAnalysing> {
    if (!allPairs) {
      allPairs = await this.pairsService.findAll();
    }
    const pairs = allPairs.filter(p => p.hbSymbol);

    const arb = new Arbitrage(pairs);
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

    const pricesMap = await this.priceService.buildPriceMapHB();
    const baseQuotePricesMap = new Map<string, number>();
    for (const pair of pairs) {
      const price = pricesMap.get(pair.hbSymbol);
      baseQuotePricesMap.set(this.priceService.pairPriceKey(pair), price);
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
    const allPairs = await this.pairsService.findAll();

    // TODO: return value

    await this.checkArbBA(allPairs);
    await this.checkArbOE(allPairs);
    await this.checkArbHB(allPairs);
  }

  @Command({
    command: 'seek',
    description: '套利发现'
  })
  async checkArbitrage2(): Promise<void> {
    const spin = createSpinner();
    spin.start(`套利发现 `);
    await this.checkArbitrage();
    spin.succeed('完成');
  }

}
