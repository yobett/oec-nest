import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provider } from '@nestjs/common/interfaces/modules/provider.interface';
import { ConsoleModule } from 'nestjs-console';

import { AccountModule } from './account.module';
import { Config } from '../common/config';
import { TypeormLogger } from '../common/typeorm-logger';
import { UsersService } from './sys/users.service';
import { ExchsService } from './sys/exchs.service';
import { Exch } from '../models/sys/exch';
import { Ccy } from '../models/mar/ccy';
import { ExPair } from '../models/mar/ex-pair';
import { Asset } from '../models/per/asset';
import { RapiModule } from './ex-api/rapi.module';
import { CcysService } from './mar/ccys.service';
import { ExPairsService } from './mar/pairs.service';
import { SpotOrder } from '../models/per/spot-order';
import { AssetService } from './per/asset.service';
import { SpotOrderService } from './per/spot-order.service';
import { OePubSyncService } from './ex-sync/oe/oe-pub-sync.service';
import { BaPriSyncService } from './ex-sync/ba/ba-pri-sync.service';
import { BaPubSyncService } from './ex-sync/ba/ba-pub-sync.service';
import { OePriSyncService } from './ex-sync/oe/oe-pri-sync.service';
import { HbPubSyncService } from './ex-sync/hb/hb-pub-sync.service';
import { HbPriSyncService } from './ex-sync/hb/hb-pri-sync.service';
import { CmcSyncService } from './ex-sync/cmc/cmc-sync.service';
import { LastTransaction } from '../models/per/last-transaction';
import { LastTransactionService } from './per/last-transaction.service';
import { ExapisService } from './sys/exapis.service';
import { Exapi } from '../models/sys/exapi';
import { ExPriSyncService } from './ex-sync/ex-pri-sync.service';
import { ExPubSyncService } from './ex-sync/ex-pub-sync.service';
import { CurrentPriceService } from './mar/current-price.service';
import { Strategy } from '../models/str/strategy';
import { StrategiesService } from './str/strategies.service';
import { StrategyExecutorService } from './str/strategy-executor.service';
import { StrategyHistory } from '../models/str/strategy-history';
import { HistoryStrategiesService } from './str/history-strategies.service';
import { AssetSnapshot } from '../models/per/asset-snapshot';
import { AssetSnapshotService } from './per/asset-snapshot.service';
import { AssetEvaluatorService } from './per/asset-evaluator.service';
import { NotificationService } from './sys/notification.service';

const services: Provider[] = [
  UsersService, ExchsService, ExapisService, NotificationService,
  CcysService, ExPairsService, CurrentPriceService,
  AssetService, AssetSnapshotService, AssetEvaluatorService,
  SpotOrderService, LastTransactionService,
  BaPubSyncService, BaPriSyncService,
  OePubSyncService, OePriSyncService,
  HbPubSyncService, HbPriSyncService,
  CmcSyncService, ExPriSyncService, ExPubSyncService,
  StrategiesService, StrategyExecutorService, HistoryStrategiesService
];

@Module({
  imports: [
    RapiModule,
    TypeOrmModule.forFeature([Exch, Exapi,
      Ccy, ExPair, Asset, AssetSnapshot, SpotOrder, LastTransaction,
      Strategy, StrategyHistory
    ]),
    TypeOrmModule.forRoot({
      ...Config.DB,
      autoLoadEntities: true,
      synchronize: true,
      logger: new TypeormLogger()
    }),
    AccountModule,
    ConsoleModule,
  ],
  providers: services,
  exports: [RapiModule, TypeOrmModule, ...services]
})
export class ServiceModule {
}
