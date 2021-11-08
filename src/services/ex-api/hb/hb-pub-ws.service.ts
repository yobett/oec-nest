import * as zlib from 'zlib';
import { Injectable } from '@nestjs/common';
import { ClientOptions, RawData, WebSocket } from 'ws';
import { Config } from '../../../common/config';
import { defaultWsOptions } from '../../../common/utils';
import { WsTicker } from '../ws-ticker';
import { PubWsBaseService } from '../pub-ws-base.service';


@Injectable()
export class HbPubWsService extends PubWsBaseService {

  protected messageId = 1;

  setupWS(): void {
    const wsBase = Config.HB_API.WS_PUBLIC;
    const wsOptions: ClientOptions = defaultWsOptions();
    this.ws = new WebSocket(wsBase, wsOptions);

    this.setupWSEvent();
  }

  protected wsRawMessage(raw: RawData): void {
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
  }


  protected wsMessageObj(obj: any): void {
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
        this.publishTicker(watching, ticker);
      }
    }
  }

  protected subscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'sub');
  }

  protected unsubscribe(symbols: string[]): void {
    this.wsSymbolOp(symbols, 'unsub');
  }

  protected wsSymbolOp(symbols: string[], op: string): void {
    if (symbols.length === 0) {
      return;
    }
    for (const symbol of symbols) {
      const req = {
        [op]: `market.${symbol}.ticker`,
        id: this.messageId++
      };
      const reqStr = JSON.stringify(req);
      if (this.debug) {
        this.logger.log(reqStr);
      }
      this.ws.send(reqStr);
    }
  }

}
