import { Injectable } from '@nestjs/common';
import { ClientOptions, WebSocket } from 'ws';
import { Config } from '../../../common/config';
import { defaultWsOptions } from '../../../common/utils';
import { WsTicker } from '../ws-ticker';
import { PubWsBaseService } from '../pub-ws-base.service';


@Injectable()
export class OePubWsService extends PubWsBaseService {


  setupWS(): void {
    const wsBase = Config.OE_API.WS_PUBLIC;
    const wsOptions: ClientOptions = defaultWsOptions();
    this.ws = new WebSocket(wsBase, wsOptions);

    this.setupWSEvent();
  }

  protected wsMessageObj(obj: any): void {
    if (obj.event) {
      if (this.debug) {
        this.logger.log(obj.event);
      }
      if (obj.event === 'subscribe') {
        if (obj.arg && obj.arg.channel === 'tickers') {
          const symbol = obj.arg.instId;
          const watching = this.watchingMap.get(symbol);
          if (watching) {
            watching.state = 'watching';
            watching.lastTouchTs = Date.now();
          } else {
            if (this.debug) {
              this.logger.log('-');
            }
          }
        }
      } else if (obj.event === 'error') {
        this.logger.error(obj.msg);
      }
    } else if (obj.arg && obj.data) {
      const raw = obj.data[0];
      if (obj.arg.channel === 'tickers') {
        const symbol = raw.instId;
        const watching = this.watchingMap.get(symbol);
        if (watching) {
          const ticker: WsTicker = {ts: +raw.ts, symbol, price: +raw.last};
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
      }
    }
  }

  protected subscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'subscribe', 'tickers');
  }

  protected unsubscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'unsubscribe', 'tickers');
  }

  private wsSymbolOp(symbols: string[], op: string, channel: string): void {
    if (symbols.length === 0) {
      return;
    }
    const req = {
      op,
      args: symbols.map(symbol => ({
          channel,
          instId: symbol
        })
      )
    };
    const reqStr = JSON.stringify(req);
    if (this.debug) {
      this.logger.log(reqStr);
    }
    this.ws.send(reqStr);
  }

}
