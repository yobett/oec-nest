import { Injectable } from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { OePubWsService } from './oe/oe-pub-ws.service';
import { BaPubWsService } from './ba/ba-pub-ws.service';
import { HbPubWsService } from './hb/hb-pub-ws.service';
import { Exch } from '../../models/sys/exch';
import { WsTicker } from './ws-ticker';

@Injectable()
export class WsTickerService {

  constructor(private oePubWsService: OePubWsService,
              private baPubWsService: BaPubWsService,
              private hbPubWsService: HbPubWsService) {
  }

  watch(ex: string, symbol: string, rateMills = 500): Observable<WsTicker> {
    let obs: Observable<WsTicker>;
    if (ex === Exch.CODE_OE) {
      obs = this.oePubWsService.watch(symbol);
    } else if (ex === Exch.CODE_BA) {
      obs = this.baPubWsService.watch(symbol);
    } else if (ex === Exch.CODE_HB) {
      obs = this.hbPubWsService.watch(symbol);
    } else {
      throw new Error('未知交易所：' + ex);
    }
    if (!rateMills) {
      return obs;
    }
    let lastTs: number;
    return obs.pipe(filter(ticker => {
      if (!lastTs || (ticker.ts - lastTs) >= rateMills) {
        lastTs = ticker.ts;
        return true;
      }
      return false;
    }));
  }


  test(ex: string) {
    const [symbol1, symbol2] = {
      [Exch.CODE_OE]: ['KISHU-USDT', 'ETH-USDT'],
      [Exch.CODE_BA]: ['BTCUSDT', 'ETHUSDT'],
      [Exch.CODE_HB]: ['btcusdt', 'ethusdt']
    }[ex];

    const testWatch = (ex: string,
                       symbol: string,
                       prefix: string,
                       rateMills = 1000): Subscription => {
      const s11: Subscription = this.watch(ex, symbol, rateMills)
        .subscribe((e) => console.log(prefix, new Date(), e));
      console.log('----- ' + prefix + ' + ' + symbol);
      return s11;
    }

    const s11: Subscription = testWatch(ex, symbol1, '11');
    setTimeout(() => {
      const s21: Subscription = testWatch(ex, symbol1, '21');
      const s22: Subscription = testWatch(ex, symbol2, '22');
      setTimeout(() => {
        s21.unsubscribe();
        console.log('----- 11 - ' + symbol1);
      }, 3000);
      setTimeout(() => {
        s11.unsubscribe();
        console.log('----- 21 - ' + symbol1);
        s22.unsubscribe();
        console.log('----- 22 - ' + symbol2);
      }, 6000);
    }, 3000);
  }

}


function test() {
  const service = new WsTickerService(
    new OePubWsService(),
    new BaPubWsService(),
    new HbPubWsService()
  );
  service.test('ba');
}

test();
