import { Injectable } from '@nestjs/common';
import { ExPairsService } from '../../mar/pairs.service';
import { CreateExPairDto, ExPair, UpdateExPairDto } from '../../../models/mar/ex-pair';
import { Exch } from '../../../models/sys/exch';
import { SyncResult } from '../../../models/sync-result';
import { HbPubApiService } from '../../ex-api/hb/hb-pub-api.service';

@Injectable()
export class HbPubSyncService {

  exchCode = Exch.CODE_HB;
  static exchCode = Exch.CODE_HB;

  exchangeInfoMap: Map<string, any> = null;

  constructor(private hbPubApiService: HbPubApiService,
              private pairsService: ExPairsService,
  ) {
  }


  private async setupSymbolsCache(): Promise<void> {
    const symbols = await this.hbPubApiService.symbols();
    if (!this.exchangeInfoMap) {
      this.exchangeInfoMap = new Map<string, any>();
    }
    for (const symbolInfo of symbols) {
      this.exchangeInfoMap.set(symbolInfo.symbol, symbolInfo);
    }
  }

  async getSymbolInfo(symbol: string): Promise<any> {
    if (!this.exchangeInfoMap) {
      await this.setupSymbolsCache();
    }
    return this.exchangeInfoMap.get(symbol);
  }

  async syncPairs(): Promise<SyncResult> {
    const syncResult = new SyncResult();

    const pairsMap = new Map<string, ExPair>();
    const allPairs = await this.pairsService.findAll();
    for (const p of allPairs) {
      pairsMap.set(`${p.baseCcy}-${p.quoteCcy}`, p);
    }

    const newPairsSymbol = new Set<string>();

    const symbols = await this.hbPubApiService.symbols();
    await this.setupSymbolsCache();

    for (const symbolInfo of symbols) {
      const symbol = symbolInfo.symbol;
      const baseCcy = symbolInfo['base-currency'].toUpperCase();
      const quoteCcy = symbolInfo['quote-currency'].toUpperCase();

      const key = `${baseCcy}-${quoteCcy}`;
      const pair1 = pairsMap.get(key);
      if (pair1) {
        pairsMap.delete(key);
        if (pair1.hbSymbol === symbol) {
          syncResult.skip++;
          continue;
        }
        const pair = new UpdateExPairDto();
        pair.hbSymbol = symbol;
        await this.pairsService.update(pair1.id, pair);
        syncResult.update++;
      } else {
        const pair: CreateExPairDto = new CreateExPairDto();
        pair.hbSymbol = symbol;
        pair.baseCcy = baseCcy;
        pair.quoteCcy = quoteCcy;
        await this.pairsService.create(pair);
        syncResult.create++;

        newPairsSymbol.add(baseCcy);
        newPairsSymbol.add(quoteCcy);
      }
    }

    for (const rp of pairsMap.values()) {
      if (rp.hbSymbol) {
        rp.hbSymbol = null;
        await this.pairsService.update(rp.id, {hbSymbol: null});
        syncResult.update++;
      }
    }

    syncResult.payload = Array.from(newPairsSymbol.values());

    return syncResult;
  }


}
