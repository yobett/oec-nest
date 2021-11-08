import * as zlib from 'zlib';
import { Injectable, Logger } from '@nestjs/common';
import { ClientOptions, RawData, WebSocket } from 'ws';
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
export class HbPubWsService {
  private readonly logger = new Logger(HbPubWsService.name);

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
    const wsBase = Config.HB_API.WS_PUBLIC;
    const wsOptions: ClientOptions = defaultWsOptions();
    this.ws = new WebSocket(wsBase, wsOptions);

    this.ws.on('open', () => this.wsOpen());

    this.ws.on('close', () => this.wsClose());

    this.ws.on('message', (raw: RawData) => {
      let buffer;
      if (raw instanceof Buffer || raw instanceof ArrayBuffer) {
        buffer = raw;
      } else {
        // Buffer[]
        buffer = Buffer.concat(raw);
      }
      zlib.gunzip(buffer, ((error, result) => {
        if (error) {
          console.error(error);
          return;
        }
        const json = String(result);
        this.wsMessage(json);
      }));
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

  private wsMessage(json: string): void {
    this.logger.log(json);
    const now = new Date();
    this.wsLastTouchTs = now.getTime();
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
    if (typeof obj.ping === 'number') {
      const pingNum = obj.ping;
      this.logger.log('got ping: ' + pingNum);
      const pong = {pong: pingNum};
      this.ws.send(JSON.stringify(pong));
      return;
    }
    if (obj.ch && /^market\.[a-zA-Z]+\.ticker$/.test(obj.ch)) {
      const channel = obj.ch as string;
      const symbol = channel.substring('market.'.length, channel.length - '.ticker'.length);
      const watching = this.watchingMap.get(symbol);
      if (watching) {
        const tick = obj.tick;
        const ticker: WsTicker = {ts: +obj.ts, symbol, price: +tick.lastPrice};
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
  }

  private wsClose(): void {
    this.logger.log('ws closed.');
    this.ws = null;
    this.wsReady = false;
  }

  private subscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'sub');
  }

  private unsubscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'unsub');
  }

  private wsSymbolOp(symbols: string[], op: string): void {
    if (symbols.length === 0) {
      return;
    }
    for (const symbol of symbols) {
      const req = {
        [op]: `market.${symbol}.ticker`,
        id: this.messageId++
      };
      const reqStr = JSON.stringify(req);
      if (DEBUG) {
        this.logger.log(reqStr);
      }
      this.ws.send(reqStr);
    }
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
  const service = new HbPubWsService();
  // service.setupWS();
  const s11: Subscription = service.watch('btcusdt').subscribe((e) => console.log('11 ', e));
  console.log('----- 11 + BTC');
  setTimeout(() => {
    const s21: Subscription = service.watch('btcusdt').subscribe((e) => console.log('21 ', e));
    console.log('----- 21 + BTC');
    const s22: Subscription = service.watch('ethusdt').subscribe((e) => console.log('22 ', e));
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
