import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { uniq } from 'lodash';

import { Asset } from '../../models/per/asset';
import { AssetSnapshot } from '../../models/per/asset-snapshot';
import { ExPriSyncService } from '../ex-sync/ex-pri-sync.service';
import { CmcApiService } from '../ex-api/cmc/cmc-api.service';
import { API, Exapi } from '../../models/sys/exapi';
import { Quote } from '../../models/mar/quote';
import { ExapisService } from '../sys/exapis.service';
import { Config } from '../../common/config';

@Injectable()
export class AssetEvaluatorService {
  constructor(
    @InjectRepository(Asset) private assetsRepository: Repository<Asset>,
    @InjectRepository(AssetSnapshot) private snapshotsRepository: Repository<AssetSnapshot>,
    private exPriSyncService: ExPriSyncService,
    private cmcApiService: CmcApiService,
    private exapisService: ExapisService
  ) {
  }

  async buildSnapshots(padToHour = true, save = true): Promise<AssetSnapshot[]> {
    const assets: Asset[] = await this.assetsRepository.find();
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);

    const threshold = Config.EX_DATA_SYNC.UPDATE_ASSET_THRESHOLD;
    const assets2 = assets.filter(a => a.holding > threshold);
    if (assets2.length === 0) {
      return [];
    }
    const symbols = uniq(assets2.map(a => a.ccy));
    const convert = 'USD';
    const timestamp = new Date();
    let ts = timestamp.getTime();
    if (padToHour) {
      const hourMill = 60 * 60 * 1000;
      ts = ts - ts % hourMill;
    }
    const hour = timestamp.getHours();

    const quoteRes = await this.cmcApiService.quotes(api, symbols, convert);

    const snapshotsMap = new Map<string, AssetSnapshot>();

    for (const asset of assets2) {
      const cq = quoteRes[asset.ccy];
      const quote: Quote = cq.quote[convert];
      if (!quote || !quote.price) {
        continue;
      }

      let snapshot: AssetSnapshot = snapshotsMap.get(asset.ccy);
      if (snapshot) {
        snapshot.holding += asset.holding;
      } else {
        snapshot = new AssetSnapshot();
        snapshot.ccy = asset.ccy;
        snapshot.ts = ts;
        snapshot.hour = hour;
        snapshot.price = quote.price;
        snapshot.holding = asset.holding;
        snapshotsMap.set(asset.ccy, snapshot);
      }
    }

    const snapshots: AssetSnapshot[] = Array.from(snapshotsMap.values());

    const generalSnapshot: AssetSnapshot = new AssetSnapshot();
    generalSnapshot.ccy = AssetSnapshot.CcyAll;
    generalSnapshot.ts = ts;
    generalSnapshot.hour = hour;
    generalSnapshot.price = 0;
    generalSnapshot.holding = 0;
    generalSnapshot.holdingValue = 0;

    for (const snapshot of snapshots) {
      snapshot.holdingValue = snapshot.holding * snapshot.price;
      generalSnapshot.holdingValue += snapshot.holdingValue;
    }

    const filtered = snapshots.filter(s => s.holdingValue > 1.0);
    const all = [generalSnapshot, ...filtered];
    if (!save) {
      return all;
    }

    await this.snapshotsRepository.delete({ts})
    await this.snapshotsRepository.save(all);
    return all;
  }

  async evaluate1(assets: Asset[], convert: string): Promise<void> {
    if (assets.length === 0) {
      return;
    }
    const symbols = uniq(assets.map(asset => asset.ccy));

    convert = convert || 'USD';
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    const quoteRes = await this.cmcApiService.quotes(api, symbols, convert);

    for (const asset of assets) {
      const cq = quoteRes[asset.ccy];
      const quote: Quote = cq.quote[convert];
      if (!quote) {
        continue;
      }
      const price = +quote.price;
      asset.price = price;
      asset.holdingValue = +asset.holding * price;
      asset.frozenValue = +asset.frozen * price;
    }
  }

}
