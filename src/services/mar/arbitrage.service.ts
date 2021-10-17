import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Command, Console, createSpinner } from 'nestjs-console';

import { ExPair } from '../../models/mar/ex-pair';
import { BaPubApiService } from '../ex-api/ba/ba-pub-api.service';
import { OePubApiService } from '../ex-api/oe/oe-pub-api.service';
import { HbPubApiService } from '../ex-api/hb/hb-pub-api.service';
import { Arbitrage, PairModel, Ring, ValueChain } from './arbitrage';
import { CurrentPriceService } from './current-price.service';
import { CcysService } from './ccys.service';
import { CmcApiService } from '../ex-api/cmc/cmc-api.service';
import { ExapisService } from '../sys/exapis.service';

export interface ArbAnalysing {
  rings: Ring[];
  routes: ValueChain[];
}

@Injectable()
@Console({
  command: 'arbitrage',
  description: 'ArbitrageService'
})
export class ArbitrageService extends CurrentPriceService {

  constructor(@InjectRepository(ExPair)
              protected pairsRepository: Repository<ExPair>,
              protected baPubApiService: BaPubApiService,
              protected oePubApiService: OePubApiService,
              protected hbPubApiService: HbPubApiService,
              protected ccysService: CcysService,
              protected cmcApiService: CmcApiService,
              protected exapisService: ExapisService
  ) {
    super(pairsRepository, baPubApiService, oePubApiService, hbPubApiService,
      ccysService, cmcApiService, exapisService);
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
