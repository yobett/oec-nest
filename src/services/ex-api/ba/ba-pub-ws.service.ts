import { Injectable, Logger } from '@nestjs/common';
import { ClientOptions, WebSocket } from 'ws';
import { Observable, Subject, Subscription } from 'rxjs';
import { Config } from '../../../common/config';
import { defaultWsOptions } from '../../../common/utils';
import { WsTicker } from '../ws-ticker';

type WatchState = 'waiting' | 'subscribing' | 'watching';

class Watching {
  symbol: string;
  state: WatchState;
  tickerSubject: Subject<WsTicker>;
  lastTouchTs?: number;

  constructor(symbol: string, state: WatchState) {
    this.symbol = symbol;
    this.state = state;
    this.tickerSubject = new Subject<WsTicker>();
  }
}

const DEBUG = false;

@Injectable()
export class BaPubWsService {
  private readonly logger = new Logger(BaPubWsService.name);

  private ws: WebSocket;

  private wsReady: boolean;

  private wsLastTouchTs: number;

  private watchingMap: Map<string, Watching> = new Map<string, Watching>();

  private messageId = 1;

  constructor() {
    setInterval(this.checkIdle.bind(this), 2 * 1000);
  }

  private checkIdle(): void {
    const ts = Date.now();
    if (this.wsReady) {
      // const mills = ts - this.wsLastTouchTs;
      // if (mills > 25 * 1000) {
      //   this.ws.send('ping');
      //   if (DEBUG) {
      //     this.logger.log('sent ping ...');
      //   }
      // }
    }
    if (DEBUG) {
      this.logger.log(`watching symbols: ${this.watchingMap.size}`);
    }
    if (this.watchingMap.size === 0) {
      return;
    }
    const toUnsubscribe = [];
    for (const [symbol, watching] of this.watchingMap) {
      const {state, tickerSubject, lastTouchTs} = watching;
      const observersCount = tickerSubject.observers.length;
      if (DEBUG) {
        this.logger.log(`  ${symbol},${watching.state},${observersCount}`);
      }
      const mills = ts - lastTouchTs;
      if (state === 'watching') {
        if (observersCount === 0) {
          if (mills > 3 * 1000) {
            toUnsubscribe.push(symbol);
          }
        }
      } else if (state === 'subscribing') {
        if (!this.wsReady) {
          watching.state = 'waiting';
        } else if (mills > 10 * 1000) {
          toUnsubscribe.push(symbol);
        }
      }
    }
    if (toUnsubscribe.length > 0) {
      for (const symbol of toUnsubscribe) {
        this.watchingMap.delete(symbol);
      }
      this.unsubscribe(toUnsubscribe);
    }
  }

  setupWS(): void {
    const wsBase = Config.BA_API.WS_PUBLIC;
    const wsOptions: ClientOptions = defaultWsOptions();
    this.ws = new WebSocket(`${wsBase}/ws/a`, wsOptions);

    this.ws.on('open', () => this.wsOpen());

    this.ws.on('close', () => this.wsClose());

    this.ws.on('message', (message) => {
      const now = new Date();
      this.wsLastTouchTs = now.getTime();
      const json = String(message);
      this.logger.log(json);
      if (json === 'ping') {
        if (DEBUG) {
          this.logger.log('got ping.');
        }
        this.ws.send('pong');
        return;
      } else if (json === 'pong') {
        if (DEBUG) {
          this.logger.log('got pong.');
        }
        return;
      }
      let obj;
      try {
        obj = JSON.parse(json);
      } catch (e) {
        console.error(e);
        if (DEBUG) {
          this.logger.log(json);
        }
        return;
      }
      if (obj.id) {
        // if (DEBUG) {
        //   this.logger.log(obj.id);
        // }
      } else if (obj.e === '24hrMiniTicker') {
        const symbol = obj.s;
        const watching = this.watchingMap.get(symbol);
        if (watching) {
          const ticker: WsTicker = {ts: +obj.E, symbol, price: +obj.c};
          if (DEBUG) {
            this.logger.log(ticker);
          }
          watching.state = 'watching';
          const tickerSubject = watching.tickerSubject;
          if (tickerSubject.observers.length > 0) {
            watching.lastTouchTs = now.getTime();
            tickerSubject.next(ticker);
          }
        }
      }
    });

    this.ws.on('error', console.error);
  }

  private wsOpen(): void {
    this.logger.log('ws opened.');
    this.wsReady = true;
    this.wsLastTouchTs = Date.now();
    const toSubscribe = [];
    for (const [symbol, watching] of this.watchingMap) {
      if (watching.state === 'waiting') {
        watching.state = 'subscribing';
        toSubscribe.push(symbol);
      }
    }
    this.subscribe(toSubscribe);
  }

  private wsClose(): void {
    this.logger.log('ws closed.');
    this.ws = null;
    this.wsReady = false;
  }

  private subscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'SUBSCRIBE', 'miniTicker');
  }

  private unsubscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'UNSUBSCRIBE', 'miniTicker');
  }

  private wsSymbolOp(symbols: string[], op: string, channel: string): void {
    if (symbols.length === 0) {
      return;
    }
    const req = {
      method: op,
      params: symbols.map(symbol => `${symbol.toLowerCase()}@${channel}`),
      id: this.messageId++
    };
    const reqStr = JSON.stringify(req);
    if (DEBUG) {
      this.logger.log(reqStr);
    }
    this.ws.send(reqStr);
  }

  watch(symbol: string): Observable<WsTicker> {
    if (!this.ws) {
      this.setupWS();
    }
    let watching = this.watchingMap.get(symbol);
    if (!watching) {
      if (this.wsReady) {
        this.subscribe([symbol]);
        watching = new Watching(symbol, 'subscribing');
        this.watchingMap.set(symbol, watching);
      } else {
        watching = new Watching(symbol, 'waiting');
        this.watchingMap.set(symbol, watching);
      }
    }
    return watching.tickerSubject;
  }

}


function test() {
  const service = new BaPubWsService();
  // service.setupWS();
  const s11: Subscription = service.watch('BTCUSDT').subscribe((e) => console.log('11 ', e));
  console.log('----- 11 + BTC');
  setTimeout(() => {
    const s21: Subscription = service.watch('BTCUSDT').subscribe((e) => console.log('21 ', e));
    console.log('----- 21 + BTC');
    const s22: Subscription = service.watch('ETHUSDT').subscribe((e) => console.log('22 ', e));
    console.log('----- 22 + ETH');
    setTimeout(() => {
      s21.unsubscribe();
      console.log('----- 11 - BTC');
    }, 3000);
    setTimeout(() => {
      s11.unsubscribe();
      console.log('----- 21 - BTC');
      s22.unsubscribe();
      console.log('----- 22 - ETH');
    }, 6000);
  }, 3000);
}

test();
