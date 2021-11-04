import { Injectable, Logger } from '@nestjs/common';
import { PairKline } from '../../models/mar/kline';
import { BaPubApiService } from '../ex-api/ba/ba-pub-api.service';
import { ExPairsService } from './pairs.service';
import { Exch } from '../../models/sys/exch';
import { Pager } from '../../models/query-params';
import { CountList } from '../../models/result';
import { ExPair } from '../../models/mar/ex-pair';
import { Config } from '../../common/config';


export interface RollingPricesFilter {
  list: 'dropping' | 'rising' | 'concerned';
  forceRefresh?: boolean;
  baseCcy?: string;
  quoteCcy?: string;
}

interface RollingPricesData {
  fetchTs: number;
  rising: PairKline[];
  dropping: PairKline[];
  klinesMap: Map<string, PairKline>;
}

const CacheTime = Config.Rolling24hPriceCacheMinutes * 60 * 1000;

@Injectable()
export class RollingPriceService {

  private readonly logger = new Logger(RollingPriceService.name);

  rolling24h: RollingPricesData;

  constructor(private pairsService: ExPairsService,
              private baPubApiService: BaPubApiService) {
  }


  private async fetchTickers(): Promise<void> {
    const fetchTs = Date.now();
    const [tickers, pairs] = await Promise.all([
      this.baPubApiService.ticker24H(),
      this.pairsService.findByEx(Exch.CODE_BA)
    ]);

    const pairsMap = new Map<string, ExPair>(pairs.map(p => [p.baSymbol, p]));

    const klines: PairKline[] = [];
    for (const ticker of tickers) {
      const pair = pairsMap.get(ticker.symbol);
      if (pair) {
        const kline = ticker as PairKline;
        kline.pair = pair;
        klines.push(kline);
      } else {
        // this.logger.log(`交易对未同步：ba.${ticker.symbol}`);
      }
    }
    this.logger.log(`count: ${klines.length}`);

    const klinesMap = new Map<string, PairKline>(klines.map(t => [t.symbol, t]));

    const rising = klines.filter(t => t.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent);
    const dropping = klines.filter(t => t.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent);

    this.rolling24h = {
      fetchTs,
      klinesMap,
      rising,
      dropping
    };
  }

  private async getRolling24(forceRefresh: boolean): Promise<{ rolling24h: RollingPricesData, fromCache: boolean }> {
    let fromCache = false;
    if (!this.rolling24h) {
      await this.fetchTickers();
    } else if (forceRefresh) {
      await this.fetchTickers();
    } else if ((Date.now() - this.rolling24h.fetchTs) > CacheTime) {
      await this.fetchTickers();
    } else {
      fromCache = true;
    }
    return {rolling24h: this.rolling24h, fromCache};
  }

  private async getConcernedKlines(getRolling24: RollingPricesData): Promise<PairKline[]> {
    const klinesMap = getRolling24.klinesMap;
    const pairs = await this.pairsService.findByExConcerned(Exch.CODE_BA);
    const klines: PairKline[] = [];
    for (const pair of pairs) {
      const kline = klinesMap.get(pair.baSymbol);
      if (kline) {
        klines.push(kline);
      }
    }

    return klines;
  }

  async query(pager: Pager, filter: RollingPricesFilter): Promise<CountList<PairKline>> {
    const {rolling24h, fromCache} = await this.getRolling24(filter.forceRefresh);

    let klines: PairKline[];
    if (filter.list === 'concerned') {
      klines = await this.getConcernedKlines(rolling24h);
    } else {
      klines = rolling24h[filter.list];
    }

    if (filter.baseCcy) {
      klines = klines.filter(t => t.pair.baseCcy.includes(filter.baseCcy));
    }
    if (filter.quoteCcy) {
      klines = klines.filter(t => t.pair.quoteCcy.includes(filter.quoteCcy));
    }

    const {page, pageSize} = pager;
    const start = page * pageSize;
    const end = start + pageSize;

    const slice = klines.slice(start, end);

    if (fromCache) {
      const symbols = slice.map(s => s.symbol);
      const concernedPairs = await this.pairsService.findByConcernedSymbols(Exch.CODE_BA, symbols);
      const concernedSymbolsSet = new Set<string>(concernedPairs.map(p => p.baSymbol));
      for (const kl of slice) {
        // update concerned, in case altered
        kl.pair.concerned = concernedSymbolsSet.has(kl.symbol);
      }
    }

    return {list: slice, count: klines.length};
  }

}
