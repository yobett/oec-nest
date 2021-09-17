export declare type Ring = string[];

export interface PairModel {
  baseCcy: string,
  quoteCcy: string;
}

declare type CandidateRing = Ring;

interface Chain {
  lastCcy: string;
  length: number;
  ring: CandidateRing;
}

export interface ValueChainNode {
  lastCcy?: string; // quote
  ccy: string;
  value: number;
  boughtPrice?: number;
}

export interface ValueChain {
  times: number;
  nodes: ValueChainNode[];
}

// 套利计算
export class Arbitrage {

  private readonly maxLength: number;
  private readonly pairs: PairModel[];
  // baseCcy -> quoteCcy[]
  private csMap: Map<string, string[]>;

  private ringsSet: Set<string>; // baseCcy1-baseCcy2-baseCcy3
  // result, quote -> base
  rings: Ring[];

  arbRoutes: ValueChain[];

  constructor(pairs: PairModel[], maxLength = 4) {
    this.pairs = pairs;
    this.maxLength = maxLength;

    this.csMap = new Map<string, string[]>();
    this.ringsSet = new Set<string>();
    this.rings = [];
  }

  private forward(chain: Chain) {
    if (chain.length === this.maxLength) {
      return;
    }

    const {lastCcy, length, ring} = chain;
    const quotes = this.csMap.get(lastCcy);
    if (!quotes) {
      return;
    }

    for (const quote of quotes) {
      if (ring.includes(quote)) {
        if (ring[0] === quote) {
          let minIndex = 0;
          let min = ring[0];
          for (let i = 1; i < ring.length; i++) {
            if (ring[i] < min) {
              min = ring[i];
              minIndex = i;
            }
          }
          const ccys2 = [...ring];
          const ccys3 = ccys2.splice(0, minIndex);
          // base -> quote
          const ccys: Ring = ccys2.concat(ccys3);

          // quote -> base
          const finalRing = ccys.reverse();

          const key = finalRing.join('-');
          if (!this.ringsSet.has(key)) {
            this.rings.push(finalRing);
          }
          this.ringsSet.add(key);
        }
        continue;
      }
      const newChain = {
        lastCcy: quote,
        length: length + 1,
        ring: [...ring, quote]
      } as Chain;
      this.forward(newChain);
    }
  }

  findRings(): void {

    console.log('Pairs: ' + this.pairs.length);

    const targetSet = new Set<string>();
    for (const cs of this.pairs) {
      targetSet.add(cs.quoteCcy);
    }

    for (const cs of this.pairs) {
      if (!targetSet.has(cs.baseCcy)) {
        continue;
      }
      let quotes = this.csMap.get(cs.baseCcy);
      if (!quotes) {
        quotes = [];
        this.csMap.set(cs.baseCcy, quotes);
      }
      quotes.push(cs.quoteCcy);
    }

    const startCss = Array.from(targetSet.values());
    const startNodes: Chain[] = startCss.map(cs => {
      return {lastCcy: cs, ring: [cs], length: 0} as Chain;
    });

    for (const startNode of startNodes) {
      this.forward(startNode);
    }

  }

  printRings(): void {
    for (const ring of this.rings) {
      console.log('  ' + ring.join(' -> ') + ' ->');
    }
    console.log('Rings: ' + this.rings.length);
  }

  buildValueChains(baseQuotePricesMap: Map<string, number>): void {

    this.arbRoutes = [];

    console.log('------------');
    const rings: Ring[] = this.rings;
    console.log('Rings: ' + rings.length);
    for (const ring of rings) {
      // console.log('Ring: ' + ring.join(' -> ') + ' ->');
      const twoRound = [...ring, ...ring];

      for (let start = 0; start < ring.length; start++) {
        // console.log('  Start From: ' + ring[start]);

        let route: ValueChainNode[] = [];
        let lastCcy: string = twoRound[start];
        let lastValue = 1.0;
        route.push({
          ccy: lastCcy,
          value: lastValue
        } as ValueChainNode);

        for (let i = start + 1; i < start + +ring.length + 1; i++) {
          const ccy = twoRound[i];
          // base: ccy, quote: lastCcy
          const priceKey = `${ccy}-${lastCcy}`;
          const price = baseQuotePricesMap.get(priceKey);
          if (typeof price === 'undefined') {
            console.log('  Price Missing: ' + priceKey);
            route = null;
            break;
          }

          const value = lastValue / price;
          route.push({
            lastCcy,
            ccy,
            value,
            boughtPrice: price
          } as ValueChainNode);
          lastCcy = ccy;
          lastValue = value;
        }
        if (!route) {
          break;
        }

        this.arbRoutes.push({
          times: lastValue,
          nodes: route
        });
      }
    }

    this.arbRoutes.sort((r1, r2) => r2.times - r1.times);

  }

  printArbs(threshold = 1.0) {
    console.log('-----');
    const routes = this.arbRoutes.filter(r => r.times > threshold);
    console.log('Chains(times > ' + threshold + '): ' + routes.length);
    for (const route of routes) {
      const nodesText = route.nodes
        .map(({
                lastCcy,
                ccy,
                value,
                boughtPrice
              }) => {
          const valueStr = value.toFixed(4);
          if (!lastCcy) {
            return `${ccy}:${valueStr}`;
          }
          const symbol = ccy + '-' + lastCcy
          const priceStr = boughtPrice.toFixed(boughtPrice > 100 ? 1 : (boughtPrice > 0.5 ? 3 : 6));
          return `${ccy}:${valueStr} (${symbol + ': ' + priceStr})`;
        })
        .join(' -> ');
      console.log('  ' + route.times.toFixed(4) + ': ' + nodesText);
    }
    console.log('-----');
  }

}
