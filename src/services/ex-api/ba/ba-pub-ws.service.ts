import { Injectable } from '@nestjs/common';
import { ClientOptions, WebSocket } from 'ws';
import { Config } from '../../../common/config';
import { defaultWsOptions } from '../../../common/utils';
import { WsTicker } from '../ws-ticker';
import { PubWsBaseService } from '../pub-ws-base.service';


@Injectable()
export class BaPubWsService extends PubWsBaseService {

  protected messageId = 1;

  setupWS(): void {
    const wsBase = Config.BA_API.WS_PUBLIC;
    const wsOptions: ClientOptions = defaultWsOptions();
    this.ws = new WebSocket(`${wsBase}/ws/a`, wsOptions);

    this.setupWSEvent();
  }

  protected wsMessageObj(obj: any): void {
    if (obj.e === '24hrMiniTicker') {
      const symbol = obj.s;
      const watching = this.watchingMap.get(symbol);
      if (watching) {
        const ticker: WsTicker = {ts: +obj.E, symbol, price: +obj.c};
        this.publishTicker(watching, ticker);
      }
    }
  }

  protected subscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'SUBSCRIBE', 'miniTicker');
  }

  protected unsubscribe(symbols: string[]): void {
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
    this.sendRequest(req);
  }

}
