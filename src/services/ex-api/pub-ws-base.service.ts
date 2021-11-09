import { Logger } from '@nestjs/common';
import { RawData, WebSocket } from 'ws';
import { Observable, Subject } from 'rxjs';
import { WsTicker } from './ws-ticker';

export type WatchState = 'waiting' | 'subscribing' | 'watching';

export class Watching {
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


export abstract class PubWsBaseService {
  protected readonly logger = new Logger(PubWsBaseService.name);

  protected debug = false;

  protected ws: WebSocket;

  protected wsReady: boolean;

  protected wsLastTouchTs: number;

  protected noWatchingSince: number;

  protected watchingMap: Map<string, Watching> = new Map<string, Watching>();

  constructor() {
    setInterval(this.checkIdle.bind(this), 2 * 1000);
  }

  protected checkIdle(): void {
    const watchingSize = this.watchingMap.size;
    if (!this.wsReady && watchingSize === 0) {
      return;
    }
    if (this.debug) {
      this.logger.log(`watching symbols: ${watchingSize}`);
    }
    const ts = Date.now();
    if (this.wsReady) {
      if (watchingSize === 0) {
        if (this.noWatchingSince) {
          const mills = ts - this.noWatchingSince;
          if (mills > 5 * 1000) {
            this.ws.close();
            this.logger.log('no watching for 5s, close ...');
            return;
          }
        }
      } else {
        const mills = ts - this.wsLastTouchTs;
        if (mills > 25 * 1000) {
          this.ws.send('ping');
          if (this.debug) {
            this.logger.log('sent ping ...');
          }
        }
      }
    }
    if (watchingSize === 0) {
      return;
    }
    this.noWatchingSince = null;
    const toUnsubscribe = [];
    for (const [symbol, watching] of this.watchingMap) {
      const {state, tickerSubject, lastTouchTs} = watching;
      const observersCount = tickerSubject.observers.length;
      if (this.debug) {
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
      if (this.watchingMap.size === 0) {
        this.noWatchingSince = ts;
      }
    }
  }

  abstract setupWS(): void;

  protected setupWSEvent(): void {
    this.noWatchingSince = Date.now();

    this.ws.on('open', () => this.wsOpen());

    this.ws.on('close', () => this.wsClose());

    this.ws.on('message', this.wsRawMessage.bind(this));

    this.ws.on('error', console.error);
  }

  protected wsOpen(): void {
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

  protected wsRawMessage(raw: RawData): void {
    const json = String(raw);
    this.wsMessage(json);
  }

  protected wsMessage(json: string): void {
    if (this.debug) {
      this.logger.log(json);
    }
    this.wsLastTouchTs = Date.now();
    if (json === 'ping') {
      if (this.debug) {
        this.logger.log('got ping.');
      }
      this.ws.send('pong');
      return;
    } else if (json === 'pong') {
      if (this.debug) {
        this.logger.log('got pong.');
      }
      return;
    }
    let obj;
    try {
      obj = JSON.parse(json);
    } catch (e) {
      console.error(e);
      if (this.debug) {
        this.logger.log(json);
      }
      return;
    }
    this.wsMessageObj(obj);
  }

  protected abstract wsMessageObj(obj: any): void;

  protected wsClose(): void {
    this.logger.log('ws closed.');
    this.ws = null;
    this.wsReady = false;
  }

  protected publishTicker(watching: Watching, ticker: WsTicker) {
    if (this.debug) {
      this.logger.log(ticker);
    }
    watching.state = 'watching';
    const tickerSubject = watching.tickerSubject;
    if (tickerSubject.observers.length > 0) {
      watching.lastTouchTs = Date.now();
      tickerSubject.next(ticker);
    }
  }

  protected abstract subscribe(symbols: string[]): void;

  protected abstract unsubscribe(symbols: string[]): void;

  protected sendRequest(req: any) {
    const reqStr = JSON.stringify(req);
    if (this.debug) {
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
