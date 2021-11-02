import { Injectable } from '@nestjs/common';
import { ExPairsService } from '../../mar/pairs.service';
import { CreateExPairDto, ExPair, UpdateExPairDto } from '../../../models/mar/ex-pair';
import { Exch } from '../../../models/sys/exch';
import { BaExchangeInfoAll, BaPubApiService } from '../../ex-api/ba/ba-pub-api.service';
import { SyncResult } from '../../../models/sync-result';

@Injectable()
export class BaPubSyncService {

  exchCode = Exch.CODE_BA;
  static exchCode = Exch.CODE_BA;

  constructor(private baPubApiService: BaPubApiService,
              private pairsService: ExPairsService,
  ) {

  }

  async syncPairs(): Promise<SyncResult> {
    const syncResult = new SyncResult();

    const pairsMap = new Map<string, ExPair>();
    const allPairs = await this.pairsService.findAll();
    for (const p of allPairs) {
      pairsMap.set(`${p.baseCcy}-${p.quoteCcy}`, p);
    }

    const newPairsSymbol = new Set<string>();

    const exchangeInfo: BaExchangeInfoAll = await this.baPubApiService.exchangeInfoAll();
    for (const symbol of exchangeInfo.symbols) {
      if (symbol.status === 'BREAK') { // BREAK,TRADING
        continue;
      }
      if (symbol.permissions && !symbol.permissions.includes('SPOT')) {
        continue;
      }
      const baseCcy = symbol.baseAsset;
      const quoteCcy = symbol.quoteAsset;
      const key = `${baseCcy}-${quoteCcy}`;
      const pair1 = pairsMap.get(key);
      if (pair1) {
        pairsMap.delete(key);
        if (pair1.baSymbol === symbol.symbol) {
          syncResult.skip++;
          continue;
        }
        const pair = new UpdateExPairDto();
        pair.baSymbol = symbol.symbol;
        await this.pairsService.update(pair1.id, pair);
        syncResult.update++;
      } else {
        const pair: CreateExPairDto = new CreateExPairDto();
        pair.baSymbol = symbol.symbol;
        pair.baseCcy = baseCcy;
        pair.quoteCcy = quoteCcy;
        await this.pairsService.create(pair);
        syncResult.create++;

        newPairsSymbol.add(baseCcy);
        newPairsSymbol.add(quoteCcy);
      }
    }

    for (const rp of pairsMap.values()) {
      if (rp.baSymbol) {
        rp.baSymbol = null;
        await this.pairsService.update(rp.id, {baSymbol: null});
        syncResult.update++;
      }
    }

    syncResult.payload = Array.from(newPairsSymbol.values());

    return syncResult;
  }


}
