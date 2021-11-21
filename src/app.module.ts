import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { SessionController } from './controllers/session.controller';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { UsersController } from './controllers/sys/users.controller';
import { ExchsController } from './controllers/sys/exchs.controller';
import { ServiceModule } from './services/service.module';
import { CcysController } from './controllers/mar/ccys.controller';
import { PairsController } from './controllers/mar/pairs.controller';
import { AssetsController } from './controllers/per/assets.controller';
import { AssetSnapshotController } from './controllers/per/asset-snapshot.controller';
import { SpotOrdersController } from './controllers/per/spot-orders.controller';
import { DataSyncPubController } from './controllers/sys/data-sync-pub.controller';
import { DataSyncPriController } from './controllers/sys/data-sync-pri.controller';
import { CcyQuotesController } from './controllers/mar/ccy-quotes.controller';
import { LastTransController } from './controllers/per/last-trans.controller';
import { ExapisController } from './controllers/sys/exapis.controller';
import { JobsModule } from './jobs/jobs.module';
import { JobsController } from './controllers/sys/jobs.controller';
import { KlinesController } from './controllers/mar/klines.controller';
import { StrategyController } from './controllers/str/strategy.controller';
import { StrategyHistoryController } from './controllers/str/strategy-history.controller';
import { Config } from './common/config';
import { NotificationsController } from './controllers/sys/notifications.controller';
import { UserProfileController } from './controllers/sys/user-profile.controller';
import { RollingPricesController } from './controllers/mar/rolling-prices.controller';
import { CcyListingsController } from './controllers/mar/ccy-listings.controller';
import { PricesController } from './controllers/mar/prices.controller';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: Config.STATIC_RES_DIR.BASE,
      exclude: ['/oec/api/*'],
    }),
    ServiceModule,
    JobsModule,
    AuthModule,
  ],
  controllers: [
    AppController, SessionController, UserProfileController, UsersController,
    ExchsController, NotificationsController, PricesController,
    CcysController, PairsController, ExapisController, JobsController,
    KlinesController, CcyQuotesController, RollingPricesController, CcyListingsController,
    AssetsController, AssetSnapshotController, SpotOrdersController, LastTransController,
    DataSyncPubController, DataSyncPriController,
    StrategyController, StrategyHistoryController
  ],
  providers: [AppService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
