import { Injectable } from '@nestjs/common';
import { ExPairsService } from '../../mar/pairs.service';
import { OePubApiService } from '../../ex-api/oe/oe-pub-api.service';
import { CcysService } from '../../mar/ccys.service';
import { CreateExPairDto, ExPair, UpdateExPairDto } from '../../../models/mar/ex-pair';
import { Exch } from '../../../models/sys/exch';
import { SyncResult } from '../../../models/sync-result';

@Injectable()
export class OePubSyncService {

  exchCode = Exch.CODE_OE;
  static exchCode = Exch.CODE_OE;

  constructor(private oePubService: OePubApiService,
              private ccysService: CcysService,
              private pairsService: ExPairsService,
  ) {
  }

  async syncCurrencies(): Promise<SyncResult> {
    let create = 0;
    let update = 0;
    const coins = await this.oePubService.coins();
    for (const coin of coins) {
      const ccy = await this.ccysService.findByCode(coin.code);
      if (ccy) {
        await this.ccysService.update(ccy.id, coin);
        update++;
      } else {
        await this.ccysService.create(coin);
        create++;
      }
    }
    return {update, create} as SyncResult;
  }

  async syncPairs(): Promise<SyncResult> {
    const syncResult = new SyncResult();

    const pairsMap = new Map<string, ExPair>();
    const allPairs = await this.pairsService.findAll();
    for (const p of allPairs) {
      pairsMap.set(`${p.baseCcy}-${p.quoteCcy}`, p);
    }

    const newPairsSymbol = new Set<string>();

    const insts = await this.oePubService.instrumentsAll();
    for (const inst of insts) {
      if (inst.state !== 'live') {
        continue;
      }
      const baseCcy = inst.baseCcy;
      const quoteCcy = inst.quoteCcy;
      const key = `${baseCcy}-${quoteCcy}`;
      const pair1 = pairsMap.get(key);
      if (pair1) {
        pairsMap.delete(key);
        if (pair1.oeSymbol === inst.instId) {
          syncResult.skip++;
          continue;
        }
        const pair = new UpdateExPairDto();
        pair.oeSymbol = inst.instId;
        await this.pairsService.update(pair1.id, pair);
        syncResult.update++;
      } else {
        const pair: CreateExPairDto = new CreateExPairDto();
        pair.oeSymbol = inst.instId;
        pair.baseCcy = baseCcy;
        pair.quoteCcy = quoteCcy;
        await this.pairsService.create(pair);
        syncResult.create++;

        newPairsSymbol.add(baseCcy);
        newPairsSymbol.add(quoteCcy);
      }
    }

    for (const rp of pairsMap.values()) {
      if (rp.oeSymbol) {
        rp.oeSymbol = null;
        await this.pairsService.update(rp.id, {oeSymbol: null});
        syncResult.update++;
      }
    }

    syncResult.payload = Array.from(newPairsSymbol.values());

    return syncResult;
  }

}
