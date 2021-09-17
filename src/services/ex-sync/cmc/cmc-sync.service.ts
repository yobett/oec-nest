import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { SyncResult } from '../../../models/sync-result';
import { CcysService } from '../../mar/ccys.service';
import { CmcApiService } from '../../ex-api/cmc/cmc-api.service';
import { Ccy } from '../../../models/mar/ccy';
import { download } from '../../../common/utils';
import { Config } from '../../../common/config';
import { CcyMeta } from '../../ex-api/cmc/ccy-meta';
import { API, Exapi } from '../../../models/sys/exapi';
import { ExapisService } from '../../sys/exapis.service';
import { ExPairsService } from '../../mar/pairs.service';

@Injectable()
export class CmcSyncService {

  constructor(private cmcApiService: CmcApiService,
              private ccysService: CcysService,
              private exapisService: ExapisService,
              private pairsService: ExPairsService
  ) {
  }

  async syncNewCurrenciesForPairs(newOnly = false): Promise<SyncResult> {
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    const pairs = await this.pairsService.findAll();
    const symbolsSet = new Set<string>();
    for (const pair of pairs) {
      symbolsSet.add(pair.baseCcy);
      symbolsSet.add(pair.quoteCcy);
    }
    const symbols: string[] = Array.from(symbolsSet.values());

    return await this.syncCurrenciesForSymbols(
      api,
      symbols,
      newOnly);
  }

  checkLogoFileExists(logoPath: string | undefined, symbol: string): boolean {
    if (!logoPath) {
      return false;
    }
    const storePath = join(Config.STATIC_RES_DIR.BASE, logoPath);
    if (fs.existsSync(storePath)) {
      console.log('Logo Exists: ' + symbol + ', ' + storePath);
      return true;
    }
    return false;
  }


  async syncHeadingCurrencies(limit: number): Promise<SyncResult> {
    const api: API = await this.exapisService.findExapi(Exapi.EX_CMC);
    return await this.syncCurrencies(
      api,
      {limit},
      true);
  }

  async syncCurrencies(api: API, opts: {
    start?: string | number, // 1 based
    limit: string | number // default: first 100
  } = {limit: 100}, updateRank = false): Promise<SyncResult> {

    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    const syncResult = new SyncResult();

    const ccys = await this.ccysService.findAll();

    const ccyMap: Map<string, Ccy> = new Map<string, Ccy>();
    for (const ccy of ccys) {
      ccyMap.set(ccy.code, ccy);
    }

    const ccysToSaveMap: Map<string, Ccy> = new Map<string, Ccy>();
    const loadLogoSymbols = [];

    const coinsDir = Config.STATIC_RES_DIR.coins;

    const coins = await this.cmcApiService.coinsMap(api, opts);
    for (const coin of coins) {
      const {name, symbol, rank, slug} = coin;
      if (!/^[A-Za-z0-9]+$/.test(symbol)) {
        console.log('Ignore: ' + symbol);
        continue;
      }

      const ccy = ccyMap.get(symbol);
      if (ccy) {
        const logoFileExists = this.checkLogoFileExists(ccy.logoPath, symbol);
        if (!logoFileExists) {
          loadLogoSymbols.push(symbol);
        }

        if (ccy.name === name &&
          ccy.slug === slug &&
          (ccy.no === rank || !updateRank) &&
          logoFileExists) {
          syncResult.skip++;
          continue;
        }

        ccy.name = name;
        ccy.slug = slug;
        ccy.no = rank;
        if (!ccy.logoPath || !logoFileExists) {
          loadLogoSymbols.push(symbol);
        }
        ccysToSaveMap.set(symbol, ccy);
        syncResult.update++;
      } else {
        const newCcy = new Ccy();
        newCcy.code = symbol;
        newCcy.name = symbol;
        newCcy.no = rank;
        loadLogoSymbols.push(symbol);
        ccysToSaveMap.set(symbol, newCcy);
        ccyMap.set(symbol, newCcy);
        syncResult.create++;
      }
    }

    if (loadLogoSymbols.length > 0) {
      const batchSize = 500;
      while (true) {
        const symbols = loadLogoSymbols.splice(0, batchSize);
        if (symbols.length === 0) {
          break;
        }

        const metaObj = await this.cmcApiService.metadata(api, symbols, 'logo');
        for (const symbol of symbols) {
          const meta: CcyMeta = metaObj[symbol];
          if (!meta) {
            continue;
          }
          const logoUrl = meta.logo;
          if (!logoUrl) {
            continue;
          }

          const file = symbol + '.png';
          const logoPath = coinsDir + '/' + file;
          try {
            await download(logoUrl, logoPath);

            const ccy = ccyMap.get(symbol);
            ccy.logoPath = logoPath;
          } catch (e) {
            console.error(e);
          }
        }

        if (loadLogoSymbols.length === 0) {
          break;
        }
      }
    }

    const ccysToSave = Array.from(ccysToSaveMap.values());
    await this.ccysService.saveMany(ccysToSave);

    return syncResult;
  }

  async syncCurrenciesForSymbols(api: API,
                                 allSymbols: string[],
                                 newOnly = false): Promise<SyncResult> {
    if (!api) {
      throw new Error('API未配置（CMC）');
    }

    const syncResult = new SyncResult();

    if (allSymbols.length === 0) {
      return syncResult;
    }

    let ccys;
    if (allSymbols.length < 100) {
      ccys = await this.ccysService.findByCodes(allSymbols);
    } else {
      ccys = await this.ccysService.findAll();
    }

    const ccyMap: Map<string, Ccy> = new Map<string, Ccy>();
    for (const ccy of ccys) {
      ccyMap.set(ccy.code, ccy);
    }

    if (newOnly) {
      allSymbols = allSymbols.filter(s => !ccyMap.get(s));
      if (allSymbols.length === 0) {
        return syncResult;
      }
    }

    const coinsDir = Config.STATIC_RES_DIR.coins;

    const batchSize = 500;
    while (true) {
      let symbols = allSymbols.splice(0, batchSize);
      if (symbols.length === 0) {
        break;
      }

      let metaObj;
      try {
        metaObj = await this.cmcApiService.metadata(api, symbols, 'logo');
      } catch (e) {
        if (e.status !== 400) {
          throw e;
        }
        let message: string = e.message;
        if (!message) {
          throw e;
        }
        if (message === 'No items found.') {
          continue;
        }

        const pre = 'Invalid values for "symbol": "';
        if (!message.startsWith(pre)) {
          throw e;
        }

        // Invalid values for "symbol": "IOTA,LINK3L,LINK3S,LTC3S,NHBTC,PROPY,RPX,STORM,STRAT,UNI2S,XZC,YOYO"
        message = message.substring(pre.length, message.length - 1);
        const invalidSymbols = message.split(',');
        symbols = symbols.filter(c => !invalidSymbols.includes(c));
        if (symbols.length === 0) {
          continue;
        }
        try {
          metaObj = await this.cmcApiService.metadata(api, symbols, 'logo');
        } catch (e2) {
          if (e2.status === 400 && e2.message === 'No items found.') {
            continue;
          }
          throw e2;
        }
      }

      const ccysToSave: Ccy[] = [];
      for (const symbol of symbols) {
        const meta: CcyMeta = metaObj[symbol];
        if (!meta) {
          syncResult.skip++;
          continue;
        }

        let ccy = ccyMap.get(symbol);
        if (!ccy) {
          ccy = new Ccy();
          ccy.code = meta.symbol;
          const rand = Math.round(Math.random() * 5000);
          ccy.no = 5000 + rand;
        }

        const logoUrl = meta.logo;
        const logoFileExists = this.checkLogoFileExists(ccy.logoPath, symbol);
        if (logoFileExists) {
          if (ccy.name === symbol &&
            ccy.slug === meta.slug) {
            syncResult.skip++;
            continue;
          }
        } else {
          if (logoUrl) {
            const file = symbol + '.png';
            const logoPath = coinsDir + '/' + file;
            try {
              await download(logoUrl, logoPath);

              ccy.logoPath = logoPath;
            } catch (e) {
              console.error(e);
            }
          }
        }

        ccy.name = symbol;
        ccy.slug = meta.slug;
        if (ccy.id) {
          syncResult.update++;
        } else {
          syncResult.create++;
        }

        ccysToSave.push(ccy);
      }

      await this.ccysService.saveMany(ccysToSave);

      if (allSymbols.length === 0) {
        break;
      }
    }

    return syncResult;
  }

}
